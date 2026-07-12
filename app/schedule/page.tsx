"use client";
// Schedule tab — the weekly calendar, rebuilt in-house. One week grid that
// merges: client task due dates + project deadlines (Clients board), personal
// CRM tasks with due dates, and Google Calendar events (when connected).
import { useEffect, useState } from "react";
import { api, clientDateKey, fmtTime12 } from "@/lib/client";
import type { CalendarEvent, ClientProject, Task } from "@/lib/types";

function clientOf(name: string): string {
  return name.split("—")[0].trim();
}

interface DayItem {
  key: string;
  label: string;
  sub?: string;
  kind: "client" | "deadline" | "task" | "event";
  overdue?: boolean;
}

function mondayOf(dateKey: string): Date {
  const d = new Date(dateKey + "T12:00:00");
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  return d;
}

export default function SchedulePage() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [gcalConfigured, setGcalConfigured] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const today = clientDateKey();

  useEffect(() => {
    api<{ projects: ClientProject[] }>("/api/clients").then((r) => setProjects(r.projects)).catch(() => {});
    api<{ tasks: Task[] }>("/api/tasks").then((r) => setTasks(r.tasks)).catch(() => {});
    api<{ events: CalendarEvent[]; configured: boolean }>("/api/calendar")
      .then((r) => {
        setEvents(r.events);
        setGcalConfigured(r.configured);
      })
      .catch(() => {});
  }, []);

  const monday = mondayOf(today);
  monday.setDate(monday.getDate() + weekOffset * 7);

  const days: { key: string; date: Date }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push({ key: clientDateKey(d), date: d });
  }

  function itemsFor(dayKey: string): DayItem[] {
    const items: DayItem[] = [];
    for (const e of events) {
      if (clientDateKey(new Date(e.start)) === dayKey) {
        items.push({
          key: e.id,
          label: e.title,
          sub: e.allDay ? "all day" : fmtTime12(new Date(e.start)),
          kind: "event",
        });
      }
    }
    for (const p of projects) {
      if (p.status === "done") continue;
      if (p.deadline === dayKey) {
        items.push({ key: p.id + "dl", label: `${clientOf(p.name)} — deadline`, kind: "deadline" });
      }
      for (const t of p.tasks) {
        if (!t.done && t.due === dayKey) {
          items.push({
            key: t.id,
            label: t.title,
            sub: clientOf(p.name),
            kind: "client",
            overdue: dayKey < today,
          });
        }
      }
    }
    for (const t of tasks) {
      if (t.due_date === dayKey && !t.completed_at) {
        items.push({ key: t.id, label: t.title, sub: "personal", kind: "task", overdue: dayKey < today });
      }
    }
    return items;
  }

  const rangeLabel = `${days[0].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${days[6].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const color = (kind: DayItem["kind"], overdue?: boolean) =>
    overdue
      ? "var(--hot)"
      : kind === "deadline"
        ? "var(--accent)"
        : kind === "client"
          ? "var(--warm)"
          : kind === "event"
            ? "var(--cool)"
            : "var(--text-dim)";

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="row">
          <span className="label" style={{ fontSize: 12 }}>Schedule //</span>
          <span className="chip">{rangeLabel}</span>
        </div>
        <div className="row">
          <button className="btn small" onClick={() => setWeekOffset((w) => w - 1)}>← prev</button>
          <button className={`btn small ${weekOffset === 0 ? "primary" : ""}`} onClick={() => setWeekOffset(0)}>this week</button>
          <button className="btn small" onClick={() => setWeekOffset((w) => w + 1)}>next →</button>
        </div>
        <div className="row" style={{ gap: 12, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.1em" }}>
          <span style={{ color: "var(--warm)" }}>■ CLIENT</span>
          <span style={{ color: "var(--accent)" }}>■ DEADLINE</span>
          <span style={{ color: "var(--text-dim)" }}>■ PERSONAL</span>
          <span style={{ color: "var(--cool)" }}>■ CALENDAR</span>
        </div>
      </div>

      {!gcalConfigured && (
        <div className="faint" style={{ fontSize: 11.5, fontFamily: "var(--mono)" }}>
          TIP: connect Google Calendar (GOOGLE_CALENDAR_ICAL_URL) to see events here too.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, alignItems: "start" }}>
        {days.map(({ key, date }) => {
          const items = itemsFor(key);
          const isToday = key === today;
          return (
            <div
              key={key}
              className="panel"
              style={{
                padding: 10,
                minHeight: 160,
                borderColor: isToday ? "rgba(111,224,174,0.4)" : undefined,
                background: isToday ? "var(--accent-dim)" : undefined,
              }}
            >
              <div className="spread" style={{ marginBottom: 8 }}>
                <span className="label" style={{ fontSize: 9 }}>
                  {date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                </span>
                <span className="num" style={{ fontSize: 15, color: isToday ? "var(--accent)" : undefined }}>
                  {String(date.getDate()).padStart(2, "0")}
                </span>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                {items.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      borderLeft: `2px solid ${color(item.kind, item.overdue)}`,
                      paddingLeft: 7,
                      fontSize: 11.5,
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ color: item.overdue ? "var(--hot)" : undefined }}>{item.label}</div>
                    {item.sub && <div className="faint" style={{ fontSize: 9.5, fontFamily: "var(--mono)" }}>{item.sub.toUpperCase()}</div>}
                  </div>
                ))}
                {items.length === 0 && <div className="faint" style={{ fontSize: 11 }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
