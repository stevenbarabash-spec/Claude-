// Calendars via secret iCal URLs, parsed with ical.js — NOT node-ical,
// which breaks on Vercel's bundler (guide §8.1). Recurring events expanded
// with event.iterator(). Parsed feeds cached in module memory for 5 minutes.
// Multiple feeds (comma/newline-separated) merge into one view; each event
// carries its source calendar name; muted series UIDs are filtered out.
import { NextResponse } from "next/server";
import ICAL from "ical.js";
import { getStore } from "@/lib/store";
import { GOALS_SENTINEL_DATE, type CalendarEvent } from "@/lib/types";

let cached: { at: number; key: string; events: CalendarEvent[]; failed: string[] } | null = null;
const TTL = 5 * 60 * 1000;

function feedHost(u: string): string {
  try {
    return new URL(u.replace(/^webcal:\/\//i, "https://")).hostname;
  } catch {
    return u.slice(0, 30);
  }
}

function expand(icsText: string, fallbackName: string): CalendarEvent[] {
  const jcal = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcal);
  const calName = (comp.getFirstPropertyValue("x-wr-calname") as string | null) || fallbackName;
  const vevents = comp.getAllSubcomponents("vevent");
  const now = new Date();
  // Wide enough for the month view to page back and forward.
  const windowStart = new Date(now.getTime() - 45 * 86400000);
  const windowEnd = new Date(now.getTime() + 75 * 86400000);
  const out: CalendarEvent[] = [];

  for (const ve of vevents) {
    const event = new ICAL.Event(ve);
    const push = (start: Date, end: Date) => {
      if (end < windowStart || start > windowEnd) return;
      out.push({
        id: `${event.uid}-${start.toISOString()}`,
        uid: event.uid,
        calendar: calName,
        title: event.summary || "(untitled)",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: event.startDate?.isDate ?? false,
        location: event.location || undefined,
        description: (event.description || "").slice(0, 500) || undefined,
      });
    };

    try {
      if (event.isRecurring()) {
        const iterator = event.iterator(ICAL.Time.fromJSDate(windowStart, false));
        let next;
        let guard = 0;
        while ((next = iterator.next()) && guard++ < 500) {
          const start = next.toJSDate();
          if (start > windowEnd) break;
          const duration = event.duration?.toSeconds?.() ?? 3600;
          push(start, new Date(start.getTime() + duration * 1000));
        }
      } else {
        const start = event.startDate?.toJSDate();
        const end = event.endDate?.toJSDate() ?? start;
        if (start) push(start, end ?? start);
      }
    } catch {
      // Skip malformed events rather than failing the whole feed.
    }
  }
  return out;
}

async function mutedUids(): Promise<Set<string>> {
  try {
    const log = await getStore().getLog(GOALS_SENTINEL_DATE);
    return new Set(log?.notes.muted_events ?? []);
  } catch {
    return new Set();
  }
}

export async function GET() {
  const raw = process.env.GOOGLE_CALENDAR_ICAL_URL ?? "";
  const urls = raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u) || u.startsWith("webcal://"));
  if (urls.length === 0) {
    return NextResponse.json(
      { events: [], configured: false },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const cacheKey = urls.join("|");
  if (!cached || cached.key !== cacheKey || Date.now() - cached.at >= TTL) {
    const results = await Promise.allSettled(
      urls.map(async (u) => {
        const res = await fetch(u.replace(/^webcal:\/\//i, "https://"), { cache: "no-store" });
        if (!res.ok) throw new Error(`ical fetch ${res.status}`);
        return expand(await res.text(), feedHost(u));
      }),
    );
    const events = results
      .filter((r): r is PromiseFulfilledResult<CalendarEvent[]> => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    const failed = results
      .map((r, i) => (r.status === "rejected" ? `${feedHost(urls[i])} (${String((r as PromiseRejectedResult).reason).slice(0, 60)})` : null))
      .filter((x): x is string => Boolean(x));
    // Keep the previous good snapshot if every feed failed this round.
    if (results.some((r) => r.status === "fulfilled") || !cached) {
      cached = { at: Date.now(), key: cacheKey, events, failed };
    }
  }

  const muted = await mutedUids();
  const visible = cached.events.filter((e) => !muted.has(e.uid));
  return NextResponse.json(
    {
      events: visible,
      configured: true,
      feeds: urls.length,
      failedFeeds: cached.failed,
      mutedCount: cached.events.length - visible.length,
      ...(cached.failed.length > 0
        ? { error: `${cached.failed.length} of ${urls.length} calendar feeds failed to load` }
        : {}),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
