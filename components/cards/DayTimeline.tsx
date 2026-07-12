"use client";
// Today · Timeline — a horizontal chart of the day with a notch for every
// scheduled item: timed Tasks, Google Calendar events, and client work due
// today. Hover a notch to see what it is; the glowing line is "now".
// Date-only items (client work, untimed tasks, all-day events) sit in the
// ANYTIME lane underneath.
import { useEffect, useState } from "react";
import { api, clientDateKey, fmt12, fmtTime12 } from "@/lib/client";
import type { CalendarEvent, DayTask } from "@/lib/types";
import { Panel } from "../Panel";

interface ClientRow {
  client: string;
  project: string;
  title: string;
  due: string | null;
  kind: "overdue" | "today" | "deadline";
}

interface Notch {
  id: string;
  minutes: number; // since midnight
  title: string;
  detail: string; // second tooltip line: time · source
  color: string;
  done?: boolean;
}

interface AnytimeItem {
  id: string;
  label: string;
  chipClass: string;
  title: string;
}

function hourLabel(h: number): string {
  const h24 = h % 24;
  const h12 = h24 % 12 || 12;
  return `${h12}${h24 < 12 ? "A" : "P"}`;
}

export function DayTimeline() {
  const [dayTasks, setDayTasks] = useState<DayTask[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const today = clientDateKey();

  useEffect(() => {
    const load = () => {
      api<{ tasks: DayTask[] }>(`/api/daytasks?date=${today}`)
        .then((r) => setDayTasks(r.tasks))
        .catch(() => {});
      api<{ events: CalendarEvent[] }>("/api/calendar")
        .then((r) => setEvents(r.events))
        .catch(() => {});
      api<{ groups: { rows: ClientRow[] }[]; ok: boolean }>("/api/clientwork")
        .then((r) => setClientRows(r.ok ? r.groups.flatMap((g) => g.rows) : []))
        .catch(() => {});
    };
    load();
    window.addEventListener("jarvis:capture", load);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => {
      window.removeEventListener("jarvis:capture", load);
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Collect timed notches ──
  const notches: Notch[] = [];
  for (const t of dayTasks) {
    if (!t.time) continue;
    const [h, m] = t.time.split(":").map(Number);
    notches.push({
      id: `dt-${t.id}`,
      minutes: h * 60 + m,
      title: (t.done ? "✓ " : "") + t.title,
      detail: `${fmt12(t.time)} · TASK`,
      color: "var(--hot)",
      done: t.done,
    });
  }
  const todaysEvents = events.filter((e) => clientDateKey(new Date(e.start)) === today);
  for (const e of todaysEvents) {
    if (e.allDay) continue;
    const s = new Date(e.start);
    notches.push({
      id: `ev-${e.id}`,
      minutes: s.getHours() * 60 + s.getMinutes(),
      title: e.title,
      detail: `${fmtTime12(s)} – ${fmtTime12(new Date(e.end))} · CALENDAR`,
      color: "var(--cool)",
    });
  }
  notches.sort((a, b) => a.minutes - b.minutes);

  // ── Anytime lane: date-only items ──
  const anytime: AnytimeItem[] = [];
  for (const r of clientRows) {
    anytime.push({
      id: `cw-${r.client}-${r.title}`,
      label: r.client,
      chipClass: r.kind === "overdue" ? "hot" : "warm",
      title: r.title,
    });
  }
  for (const t of dayTasks) {
    if (t.time || t.done) continue;
    anytime.push({ id: `dt-${t.id}`, label: "task", chipClass: "", title: t.title });
  }
  for (const e of todaysEvents) {
    if (!e.allDay) continue;
    anytime.push({ id: `ev-${e.id}`, label: "all day", chipClass: "cool", title: e.title });
  }

  // ── Window: 7 AM → 11 PM, stretched to fit anything outside it ──
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : null;
  let startH = 7;
  let endH = 23;
  for (const n of notches) {
    startH = Math.min(startH, Math.floor(n.minutes / 60));
    endH = Math.max(endH, Math.ceil((n.minutes + 1) / 60));
  }
  startH = Math.max(0, startH);
  endH = Math.min(24, Math.max(endH, startH + 8));
  const span = endH * 60 - startH * 60;
  const pct = (min: number) => ((min - startH * 60) / span) * 100;
  const labelStep = endH - startH > 12 ? 3 : 2;

  // Nudge notches fully apart when two land at (almost) the same minute,
  // so each stays hoverable on its own.
  let lastPct = -10;
  let lastOffset = 0;
  const positioned = notches.map((n) => {
    const p = pct(n.minutes);
    const offset = p - lastPct < 1.6 ? lastOffset + 12 : 0;
    lastPct = p;
    lastOffset = offset;
    return { ...n, p, offset };
  });

  const hours: number[] = [];
  for (let h = startH; h <= endH; h++) hours.push(h);

  return (
    <Panel
      idx="00"
      title="Today · Timeline"
      right={
        <span suppressHydrationWarning className="num">
          {now ? fmtTime12(now) : "--:--"}
        </span>
      }
    >
      <div className="tl">
        <div className="tl-axis" />
        {hours.map((h) => (
          <span key={h}>
            <span className="tl-hour" style={{ left: `${pct(h * 60)}%` }} />
            {(h - startH) % labelStep === 0 && (
              <span className="tl-hlabel" style={{ left: `${pct(h * 60)}%` }}>
                {hourLabel(h)}
              </span>
            )}
          </span>
        ))}
        {nowMin !== null && nowMin >= startH * 60 && nowMin <= endH * 60 && (
          <span className="tl-now" style={{ left: `${pct(nowMin)}%` }} title={`Now · ${now ? fmtTime12(now) : ""}`} />
        )}
        {positioned.map((n) => (
          <span
            key={n.id}
            className={`tl-notch ${n.done || (nowMin !== null && n.minutes < nowMin) ? "past" : ""}`}
            style={{ left: `${n.p}%`, marginLeft: n.offset }}
          >
            <span className="bar" style={{ background: n.color }} />
            <span className={`tl-tip ${n.p < 8 ? "edge-left" : n.p > 92 ? "edge-right" : ""}`}>
              <span style={{ display: "block" }}>{n.title}</span>
              <span className="faint" style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.08em" }}>
                {n.detail}
              </span>
            </span>
          </span>
        ))}
        {positioned.length === 0 && (
          <span
            className="faint"
            style={{ position: "absolute", top: 18, left: 0, fontSize: 11.5 }}
          >
            No timed items yet — tasks with a time, meetings, and events land here.
          </span>
        )}
      </div>

      {anytime.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <span className="label" style={{ fontSize: 9 }}>Anytime //</span>
          {anytime.map((a) => (
            <span key={a.id} className={`chip ${a.chipClass}`} title={a.title}>
              {a.label}: {a.title.length > 34 ? a.title.slice(0, 33) + "…" : a.title}
            </span>
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 12, marginTop: 10, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em" }}>
        <span style={{ color: "var(--hot)" }}>■ TASKS</span>
        <span style={{ color: "var(--cool)" }}>■ CALENDAR</span>
        <span style={{ color: "var(--warm)" }}>■ CLIENT WORK</span>
        <span style={{ color: "var(--accent)" }}>| NOW</span>
      </div>
    </Panel>
  );
}
