"use client";
// Calendar card (guide §5.2): 7-day strip, click a day to view its events.
import { useEffect, useState } from "react";
import { api, clientDateKey, fmtTime12 } from "@/lib/client";
import type { CalendarEvent } from "@/lib/types";
import { Panel } from "../Panel";

export function CalendarCard() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [configured, setConfigured] = useState(true);
  const [selected, setSelected] = useState(clientDateKey());

  useEffect(() => {
    const load = () =>
      api<{ events: CalendarEvent[]; configured: boolean }>("/api/calendar")
        .then((r) => {
          setEvents(r.events);
          setConfigured(r.configured);
        })
        .catch(() => {});
    load();
    // Keep an always-open dashboard current: re-check every 5 minutes.
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const days: { key: string; label: string; num: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i - new Date().getDay() + 1 + (new Date().getDay() === 0 ? -7 : 0)); // start Monday
    const key = clientDateKey(d);
    days.push({
      key,
      label: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      num: String(d.getDate()).padStart(2, "0"),
    });
  }

  const dayEvents = events.filter((e) => clientDateKey(new Date(e.start)) === selected);
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();

  return (
    <Panel idx="04" title="Calendar" right={<span>{monthLabel}</span>}>
      <div className="row" style={{ gap: 6, marginBottom: 14 }}>
        {days.map((d) => {
          const has = events.some((e) => clientDateKey(new Date(e.start)) === d.key);
          const isToday = d.key === clientDateKey();
          const isSel = d.key === selected;
          return (
            <button
              key={d.key}
              onClick={() => setSelected(d.key)}
              className="panel"
              style={{
                flex: 1,
                padding: "10px 4px",
                textAlign: "center",
                borderColor: isSel ? "rgba(111,224,174,0.4)" : undefined,
                background: isSel ? "var(--accent-dim)" : undefined,
              }}
            >
              <div className="label" style={{ fontSize: 9 }}>{d.label}</div>
              <div className="num" style={{ fontSize: 17, marginTop: 3, color: isToday ? "var(--accent)" : undefined }}>
                {d.num}
              </div>
              <div style={{ height: 4, marginTop: 3 }}>
                {has && <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: 2, background: "var(--accent)" }} />}
              </div>
            </button>
          );
        })}
      </div>

      {!configured && (
        <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
          Connect Google Calendar: Settings → your calendar → &ldquo;Secret address in iCal format&rdquo; →{" "}
          <span className="num">GOOGLE_CALENDAR_ICAL_URL</span> in .env
        </div>
      )}

      <div className="stack">
        {dayEvents.map((e) => {
          const start = new Date(e.start);
          const end = new Date(e.end);
          return (
            <div key={e.id} className="row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start" }}>
              <div className="num faint" style={{ fontSize: 11.5, width: 84, flexShrink: 0, lineHeight: 1.5 }}>
                {e.allDay ? "ALL DAY" : `${fmtTime12(start)} —\n${fmtTime12(end)}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>{e.title}</div>
                {e.location && <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{e.location}</div>}
              </div>
            </div>
          );
        })}
        {configured && dayEvents.length === 0 && (
          <div className="faint" style={{ fontSize: 13 }}>Nothing scheduled.</div>
        )}
      </div>
    </Panel>
  );
}
