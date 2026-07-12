"use client";
// Imminent alert — a red bar pinned under the rail when a timed task or a
// calendar meeting is about to start, with a live countdown. Also fires a
// browser/phone notification (when permission is granted) ~15 min out and
// again at start. Shows on every tab.
import { useEffect, useRef, useState } from "react";
import { api, clientDateKey, fmtTime12 } from "@/lib/client";
import type { CalendarEvent, DayTask } from "@/lib/types";

const LEAD_MIN = 15; // banner + first alert this many minutes before start
const GRACE_MIN = 2; // keep showing "starting now" this long after start

interface Imm {
  id: string;
  title: string;
  kind: "task" | "meeting";
  start: number; // epoch ms
}

function notifiedKey(): string {
  return `jarvis-notified-${clientDateKey()}`;
}
function getNotified(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(notifiedKey()) ?? "[]"));
  } catch {
    return new Set();
  }
}
function markNotified(k: string) {
  try {
    const s = getNotified();
    s.add(k);
    localStorage.setItem(notifiedKey(), JSON.stringify([...s]));
  } catch {}
}

export function ImminentBanner() {
  const [items, setItems] = useState<Imm[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [canNotify, setCanNotify] = useState(false);
  const lastLoad = useRef(0);

  useEffect(() => {
    setCanNotify(typeof Notification !== "undefined" && Notification.permission === "granted");

    const load = () => {
      const today = clientDateKey();
      Promise.all([
        api<{ tasks: DayTask[] }>(`/api/daytasks?date=${today}`).catch(() => ({ tasks: [] as DayTask[] })),
        api<{ events: CalendarEvent[] }>("/api/calendar").catch(() => ({ events: [] as CalendarEvent[] })),
      ]).then(([dt, cal]) => {
        const out: Imm[] = [];
        for (const t of dt.tasks) {
          if (t.done || !t.time) continue;
          const start = new Date(`${today}T${t.time}:00`).getTime();
          if (!Number.isNaN(start)) out.push({ id: `dt-${t.id}`, title: t.title, kind: "task", start });
        }
        for (const e of cal.events) {
          if (e.allDay) continue;
          const start = new Date(e.start).getTime();
          if (clientDateKey(new Date(start)) === today) out.push({ id: `ev-${e.id}`, title: e.title, kind: "meeting", start });
        }
        setItems(out);
      });
    };
    load();
    lastLoad.current = Date.now();

    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - lastLoad.current > 60000) {
        load();
        lastLoad.current = t;
      }
    }, 1000);
    window.addEventListener("jarvis:capture", load);
    return () => {
      clearInterval(tick);
      window.removeEventListener("jarvis:capture", load);
    };
  }, []);

  // Items currently in the alert window, soonest first.
  const windowed = items
    .filter((it) => {
      const m = (it.start - now) / 60000;
      return m <= LEAD_MIN && m > -GRACE_MIN;
    })
    .sort((a, b) => a.start - b.start);

  // Fire notifications at ~lead and at start (once each).
  useEffect(() => {
    if (!canNotify) return;
    const done = getNotified();
    for (const it of windowed) {
      const m = (it.start - now) / 60000;
      const label = it.kind === "meeting" ? "Meeting" : "Task";
      if (m <= LEAD_MIN && m > 1 && !done.has(`${it.id}:soon`)) {
        new Notification(`⏰ ${label} in ${Math.round(m)} min`, { body: it.title });
        markNotified(`${it.id}:soon`);
      }
      if (m <= 1 && m > -GRACE_MIN && !done.has(`${it.id}:now`)) {
        new Notification(`⏰ ${label} starting now`, { body: it.title });
        markNotified(`${it.id}:now`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, canNotify]);

  const next = windowed.find((it) => it.id !== dismissed);
  if (!next) return null;

  const diff = next.start - now;
  const late = diff <= 0;
  const secs = Math.max(0, Math.round(diff / 1000));
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const countdown = late ? "STARTING NOW" : `${mm}:${String(ss).padStart(2, "0")}`;

  return (
    <div className={`imminent-bar ${late ? "now" : ""}`}>
      <span className="imminent-dot" />
      <span className="imminent-label">{next.kind === "meeting" ? "MEETING" : "TASK"}</span>
      <span className="imminent-title">{next.title}</span>
      <span className="imminent-count">{late ? countdown : `in ${countdown}`}</span>
      <span className="imminent-at">{fmtTime12(new Date(next.start))}</span>
      {!canNotify && "Notification" in globalThis && Notification.permission !== "denied" && (
        <button
          className="btn small"
          onClick={() => Notification.requestPermission().then((p) => setCanNotify(p === "granted"))}
        >
          🔔 alerts
        </button>
      )}
      <button className="imminent-x" onClick={() => setDismissed(next.id)} title="Dismiss">
        ✕
      </button>
    </div>
  );
}
