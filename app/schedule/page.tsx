"use client";
// Schedule — day / week / MONTH (default) views over one merged feed:
// client task due dates + project deadlines (Clients board), personal CRM
// tasks with due dates, and Google Calendar events. Click a month cell to
// zoom into that day.
import { useEffect, useState } from "react";
import { api, clientDateKey, fmtTime12 } from "@/lib/client";
import type { CalendarEvent, ClientProject, Task } from "@/lib/types";

function clientOf(name: string): string {
  return name.split("—")[0].trim();
}

type View = "day" | "week" | "month";

interface DayItem {
  key: string;
  label: string;
  sub?: string;
  time?: string; // sortable HH:MM for day view
  kind: "client" | "deadline" | "task" | "event";
  overdue?: boolean;
  // payload for the click-through details drawer
  ev?: CalendarEvent;
  who?: string; // client / project name for tasks & deadlines
  due?: string | null;
}

function addDays(key: string, n: number): string {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + n);
  return clientDateKey(d);
}

// Sunday-first, matching the Command board's week strip.
function sundayOf(key: string): string {
  const d = new Date(key + "T12:00:00");
  return addDays(key, -d.getDay());
}

export default function SchedulePage() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [gcalConfigured, setGcalConfigured] = useState(true);
  const [failedFeeds, setFailedFeeds] = useState<string[]>([]);
  const [view, setView] = useState<View>("month");
  const [anchor, setAnchor] = useState(clientDateKey());
  const [detail, setDetail] = useState<DayItem | null>(null);
  const today = clientDateKey();

  useEffect(() => {
    try {
      const v = localStorage.getItem("jarvis-schedule-view");
      if (v === "day" || v === "week" || v === "month") setView(v);
    } catch {}
    const load = () => {
      api<{ projects: ClientProject[] }>("/api/clients").then((r) => setProjects(r.projects)).catch(() => {});
      api<{ tasks: Task[] }>("/api/tasks").then((r) => setTasks(r.tasks)).catch(() => {});
      api<{ events: CalendarEvent[]; configured: boolean; failedFeeds?: string[] }>("/api/calendar")
        .then((r) => {
          setEvents(r.events);
          setGcalConfigured(r.configured);
          setFailedFeeds(r.failedFeeds ?? []);
        })
        .catch(() => {});
    };
    load();
    // Keep the schedule live while it sits open — re-check every 5 minutes.
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  async function hideSeries(ev: CalendarEvent) {
    await api("/api/calendar/mute", { method: "POST", body: JSON.stringify({ uid: ev.uid }) }).catch(() => {});
    setEvents((es) => es.filter((e) => e.uid !== ev.uid));
    setDetail(null);
  }

  function switchView(v: View) {
    setView(v);
    try {
      localStorage.setItem("jarvis-schedule-view", v);
    } catch {}
  }

  function shift(dir: -1 | 1) {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else {
      const d = new Date(anchor + "T12:00:00");
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      setAnchor(clientDateKey(d));
    }
  }

  function itemsFor(dayKey: string): DayItem[] {
    const items: DayItem[] = [];
    for (const e of events) {
      if (clientDateKey(new Date(e.start)) === dayKey) {
        const s = new Date(e.start);
        items.push({
          key: e.id,
          label: e.title,
          sub: e.allDay ? "all day" : fmtTime12(s),
          time: e.allDay ? "00:00" : `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`,
          kind: "event",
          ev: e,
        });
      }
    }
    for (const p of projects) {
      if (p.status === "done") continue;
      if (p.deadline === dayKey) {
        items.push({ key: p.id + "dl", label: `${clientOf(p.name)} — deadline`, kind: "deadline", who: p.name, due: p.deadline });
      }
      for (const t of p.tasks) {
        if (!t.done && t.due === dayKey) {
          items.push({
            key: t.id,
            label: t.title,
            sub: clientOf(p.name),
            kind: "client",
            overdue: dayKey < today,
            who: p.name,
            due: t.due,
          });
        }
      }
    }
    for (const t of tasks) {
      if (t.due_date === dayKey && !t.completed_at) {
        items.push({ key: t.id, label: t.title, sub: "personal", kind: "task", overdue: dayKey < today, who: t.entity ?? undefined, due: t.due_date });
      }
    }
    return items.sort((a, b) => (a.time ?? "99:98").localeCompare(b.time ?? "99:98"));
  }

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

  /* ── Ranges per view ── */
  const anchorDate = new Date(anchor + "T12:00:00");
  const monthLabel = anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const weekDays: string[] = [];
  if (view === "week") {
    const start = sundayOf(anchor);
    for (let i = 0; i < 7; i++) weekDays.push(addDays(start, i));
  }

  // Month grid: Sunday-first rows spanning the whole month.
  const monthCells: { key: string; inMonth: boolean }[] = [];
  if (view === "month") {
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 12);
    const firstKey = clientDateKey(first);
    let cursor = sundayOf(firstKey);
    const month = anchorDate.getMonth();
    do {
      for (let i = 0; i < 7; i++) {
        monthCells.push({ key: cursor, inMonth: new Date(cursor + "T12:00:00").getMonth() === month });
        cursor = addDays(cursor, 1);
      }
    } while (new Date(cursor + "T12:00:00").getMonth() === month);
  }

  const headLabel =
    view === "day"
      ? anchorDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : view === "week"
        ? `${new Date(weekDays[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${new Date(weekDays[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
        : monthLabel;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="row">
          <span className="label" style={{ fontSize: 12 }}>Schedule //</span>
          <span className="chip">{headLabel}</span>
        </div>
        <div className="row">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button key={v} className={`btn small ${view === v ? "primary" : ""}`} onClick={() => switchView(v)}>
              {v}
            </button>
          ))}
          <span style={{ width: 10 }} />
          <button className="btn small" onClick={() => shift(-1)}>←</button>
          <button className="btn small" onClick={() => setAnchor(today)}>today</button>
          <button className="btn small" onClick={() => shift(1)}>→</button>
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
          TIP: connect your calendars (GOOGLE_CALENDAR_ICAL_URL — multiple iCal links, comma-separated) to see events here too.
        </div>
      )}
      {failedFeeds.length > 0 && (
        <div style={{ fontSize: 11.5, fontFamily: "var(--mono)", color: "var(--hot)" }}>
          ⚠ {failedFeeds.length} calendar feed{failedFeeds.length > 1 ? "s" : ""} failed to load: {failedFeeds.join(" · ")} — check those links in Vercel.
        </div>
      )}

      {/* ── DAY ── */}
      {view === "day" && (
        <div className="panel" style={{ padding: 16, maxWidth: 720 }}>
          {(() => {
            const items = itemsFor(anchor);
            if (items.length === 0)
              return <div className="faint" style={{ fontSize: 13 }}>Nothing scheduled — clear runway.</div>;
            return (
              <div className="stack" style={{ gap: 0 }}>
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="row"
                    style={{ gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start", cursor: "pointer" }}
                    onClick={() => setDetail(item)}
                  >
                    <span className="num" style={{ width: 76, flexShrink: 0, fontSize: 12, color: "var(--text-dim)" }}>
                      {item.kind === "event" ? (item.sub === "all day" ? "all day" : item.sub) : "—"}
                    </span>
                    <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: color(item.kind, item.overdue), flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13.5, color: item.overdue ? "var(--hot)" : undefined }}>{item.label}</div>
                      {item.sub && item.sub !== "all day" && item.kind !== "event" && (
                        <div className="faint" style={{ fontSize: 10.5, fontFamily: "var(--mono)", marginTop: 2 }}>{item.sub.toUpperCase()}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── WEEK ── */}
      {view === "week" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, alignItems: "start" }}>
          {weekDays.map((key) => {
            const date = new Date(key + "T12:00:00");
            const items = itemsFor(key);
            const isToday = key === today;
            return (
              <div
                key={key}
                className="panel"
                style={{
                  padding: 10,
                  minHeight: 160,
                  cursor: "pointer",
                  borderColor: isToday ? "rgba(111,224,174,0.4)" : undefined,
                  background: isToday ? "var(--accent-dim)" : undefined,
                }}
                onClick={() => {
                  setAnchor(key);
                  switchView("day");
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
                      style={{ borderLeft: `2px solid ${color(item.kind, item.overdue)}`, paddingLeft: 7, fontSize: 11.5, lineHeight: 1.4 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(item);
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
      )}

      {/* ── MONTH ── */}
      {view === "month" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <div key={d} className="label" style={{ fontSize: 9, textAlign: "center" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {monthCells.map(({ key, inMonth }) => {
              const date = new Date(key + "T12:00:00");
              const items = itemsFor(key);
              const isToday = key === today;
              const MAX = 3;
              return (
                <div
                  key={key}
                  className="panel"
                  style={{
                    padding: 8,
                    minHeight: 96,
                    cursor: "pointer",
                    opacity: inMonth ? 1 : 0.35,
                    borderColor: isToday ? "rgba(111,224,174,0.5)" : undefined,
                    background: isToday ? "var(--accent-dim)" : undefined,
                  }}
                  onClick={() => {
                    setAnchor(key);
                    switchView("day");
                  }}
                  title="Open day view"
                >
                  <div className="num" style={{ fontSize: 12, color: isToday ? "var(--accent)" : "var(--text-dim)" }}>
                    {date.getDate()}
                  </div>
                  <div className="stack" style={{ gap: 3, marginTop: 5 }}>
                    {items.slice(0, MAX).map((item) => (
                      <div
                        key={item.key}
                        style={{
                          borderLeft: `2px solid ${color(item.kind, item.overdue)}`,
                          paddingLeft: 5,
                          fontSize: 10.5,
                          lineHeight: 1.35,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: item.overdue ? "var(--hot)" : undefined,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetail(item);
                        }}
                      >
                        {item.label}
                      </div>
                    ))}
                    {items.length > MAX && (
                      <div className="faint" style={{ fontSize: 9.5, fontFamily: "var(--mono)" }}>+{items.length - MAX} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Item details drawer ── */}
      {detail && (
        <>
          <div className="drawer-overlay" onClick={() => setDetail(null)} />
          <div className="drawer">
            <div className="spread">
              <span className="label" style={{ fontSize: 11 }}>
                {detail.kind === "event" ? "Calendar event" : detail.kind === "client" ? "Client work" : detail.kind === "deadline" ? "Project deadline" : "Personal task"}
              </span>
              <button className="btn small" onClick={() => setDetail(null)}>close</button>
            </div>

            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4 }}>{detail.label}</div>

            <div className="stack" style={{ gap: 10 }}>
              {detail.ev ? (
                <>
                  <div>
                    <div className="label" style={{ fontSize: 9 }}>When</div>
                    <div style={{ fontSize: 13.5, marginTop: 3 }}>
                      {new Date(detail.ev.start).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      {detail.ev.allDay
                        ? " · all day"
                        : ` · ${fmtTime12(new Date(detail.ev.start))} – ${fmtTime12(new Date(detail.ev.end))}`}
                    </div>
                  </div>
                  {detail.ev.calendar && (
                    <div>
                      <div className="label" style={{ fontSize: 9 }}>From calendar</div>
                      <div style={{ fontSize: 13.5, marginTop: 3 }}>
                        <span className="chip cool">{detail.ev.calendar}</span>
                      </div>
                    </div>
                  )}
                  {detail.ev.location && (
                    <div>
                      <div className="label" style={{ fontSize: 9 }}>Where</div>
                      <div style={{ fontSize: 13.5, marginTop: 3 }}>{detail.ev.location}</div>
                    </div>
                  )}
                  {detail.ev.description && (
                    <div>
                      <div className="label" style={{ fontSize: 9 }}>Details</div>
                      <div className="dim" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                        {detail.ev.description}
                      </div>
                    </div>
                  )}
                  <div className="divider" />
                  <button
                    className="btn"
                    style={{ color: "var(--hot)" }}
                    onClick={() => void hideSeries(detail.ev!)}
                  >
                    🚫 Hide this event everywhere (whole series)
                  </button>
                  <div className="faint" style={{ fontSize: 11, lineHeight: 1.5 }}>
                    Hiding only affects this dashboard — the event stays in the “{detail.ev.calendar}” calendar. To remove it
                    for real, delete the series in that calendar app.
                  </div>
                </>
              ) : (
                <>
                  {detail.who && (
                    <div>
                      <div className="label" style={{ fontSize: 9 }}>{detail.kind === "task" ? "Related to" : "Project"}</div>
                      <div style={{ fontSize: 13.5, marginTop: 3 }}>{detail.who}</div>
                    </div>
                  )}
                  {detail.due && (
                    <div>
                      <div className="label" style={{ fontSize: 9 }}>Due</div>
                      <div style={{ fontSize: 13.5, marginTop: 3, color: detail.overdue ? "var(--hot)" : undefined }}>
                        {new Date(detail.due + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        {detail.overdue ? " · OVERDUE" : ""}
                      </div>
                    </div>
                  )}
                  <div className="divider" />
                  <a
                    className="btn primary"
                    style={{ textAlign: "center" }}
                    href={detail.kind === "task" ? "/crm" : "/clients"}
                  >
                    {detail.kind === "task" ? "Open in CRM →" : "Open the client board →"}
                  </a>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
