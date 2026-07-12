// Google Calendar via secret iCal URL, parsed with ical.js — NOT node-ical,
// which breaks on Vercel's bundler (guide §8.1). Recurring events expanded
// with event.iterator(). Parsed feed cached in module memory for 5 minutes.
import { NextResponse } from "next/server";
import ICAL from "ical.js";
import type { CalendarEvent } from "@/lib/types";

let cached: { at: number; events: CalendarEvent[] } | null = null;
const TTL = 5 * 60 * 1000;

function expand(icsText: string, windowDays: number): CalendarEvent[] {
  const jcal = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");
  const now = new Date();
  const windowStart = new Date(now.getTime() - 1 * 86400000);
  const windowEnd = new Date(now.getTime() + windowDays * 86400000);
  const out: CalendarEvent[] = [];

  for (const ve of vevents) {
    const event = new ICAL.Event(ve);
    const push = (start: Date, end: Date) => {
      if (end < windowStart || start > windowEnd) return;
      out.push({
        id: `${event.uid}-${start.toISOString()}`,
        title: event.summary || "(untitled)",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: event.startDate?.isDate ?? false,
        location: event.location || undefined,
        description: (event.description || "").slice(0, 300) || undefined,
      });
    };

    try {
      if (event.isRecurring()) {
        const iterator = event.iterator();
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
  return out.sort((a, b) => (a.start < b.start ? -1 : 1));
}

export async function GET() {
  // One or MANY feeds: separate multiple iCal URLs with commas or newlines —
  // every Gmail, Outlook, iCloud and birthday calendar merges into one view.
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
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json(
      { events: cached.events, configured: true },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const results = await Promise.allSettled(
    urls.map(async (u) => {
      const res = await fetch(u.replace(/^webcal:\/\//i, "https://"), { cache: "no-store" });
      if (!res.ok) throw new Error(`ical fetch ${res.status}`);
      return expand(await res.text(), 14);
    }),
  );
  const events = results
    .filter((r): r is PromiseFulfilledResult<CalendarEvent[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  const failed = results.filter((r) => r.status === "rejected").length;
  if (results.some((r) => r.status === "fulfilled")) {
    cached = { at: Date.now(), events };
  }
  return NextResponse.json(
    {
      events: events.length > 0 ? events : (cached?.events ?? []),
      configured: true,
      feeds: urls.length,
      ...(failed > 0 ? { error: `${failed} of ${urls.length} calendar feeds failed to load` } : {}),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
