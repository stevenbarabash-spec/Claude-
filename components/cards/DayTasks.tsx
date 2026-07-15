"use client";
// Tasks · Today — quick daily to-dos with an optional clock time
// ("BYTOX — send draft" at 3:00 PM). Lives between Session and Client Work.
// Timed entries also show up as notches on the day timeline.
import { useEffect, useRef, useState } from "react";
import { api, clientDateKey, debounce, fmt12, fmtTime12 } from "@/lib/client";
import type { DayTask, Routine } from "@/lib/types";
import { Panel } from "../Panel";

interface SearchHit {
  key: string;
  source: "client" | "crm" | "day";
  title: string;
  who: string | null;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function DayTasks() {
  const [tasks, setTasks] = useState<DayTask[] | null>(null);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [timeEditId, setTimeEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const today = clientDateKey();

  // Search existing tasks (client board + CRM + today) as you type, so you can
  // pull one into today's plan — same as Currently Working On.
  const runSearch = useRef(
    debounce((q: string) => {
      if (q.trim().length < 2) {
        setHits([]);
        return;
      }
      api<{ results: SearchHit[] }>(`/api/working/search?q=${encodeURIComponent(q)}`)
        .then((r) => setHits(r.results))
        .catch(() => setHits([]));
    }, 250),
  ).current;

  // Lift the card above its neighbors while the dropdown is open.
  useEffect(() => {
    const wrap = searchRef.current?.closest(".card-wrap");
    if (!wrap) return;
    wrap.classList.toggle("raised", title.trim().length >= 2 && hits.length > 0);
    return () => wrap.classList.remove("raised");
  });

  // Recurring-routines manager.
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [showRepeat, setShowRepeat] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rDays, setRDays] = useState<number[]>([]);
  const [rTime, setRTime] = useState("");

  const load = (carry = false) => {
    api<{ tasks: DayTask[] }>(`/api/daytasks?date=${today}${carry ? "&carry=1" : ""}`)
      .then((r) => setTasks(r.tasks))
      .catch(() => setTasks([]));
    api<{ routines: Routine[] }>("/api/routines").then((r) => setRoutines(r.routines)).catch(() => {});
  };

  useEffect(() => {
    load(true); // on open, roll yesterday's unfinished tasks forward
    const reload = () => load(false);
    window.addEventListener("jarvis:capture", reload);
    return () => window.removeEventListener("jarvis:capture", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addRoutine() {
    const t = rTitle.trim();
    if (!t || rDays.length === 0) return;
    const r = await api<{ routines: Routine[] }>("/api/routines", {
      method: "POST",
      body: JSON.stringify({ title: t, days: rDays, time: rTime || null }),
    }).catch(() => null);
    if (r) {
      setRoutines(r.routines);
      setRTitle("");
      setRDays([]);
      setRTime("");
      changed();
      load();
    }
  }

  async function removeRoutine(id: string) {
    const r = await api<{ routines: Routine[] }>("/api/routines", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }).catch(() => null);
    if (r) setRoutines(r.routines);
  }

  const changed = () => window.dispatchEvent(new CustomEvent("jarvis:capture"));

  async function addTask(taskTitle: string) {
    const t = taskTitle.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const r = await api<{ tasks: DayTask[] }>("/api/daytasks", {
        method: "POST",
        body: JSON.stringify({ date: today, title: t, time: time || null }),
      });
      setTasks(r.tasks);
      setTitle("");
      setTime("");
      setHits([]);
      changed();
      inputRef.current?.focus();
    } catch {
      /* keep input so nothing is lost */
    }
    setBusy(false);
  }

  function add() {
    void addTask(title);
  }

  // Pull an existing task into today's plan (keeps the client for context).
  function pull(hit: SearchHit) {
    void addTask(hit.who ? `${hit.title} · ${hit.who}` : hit.title);
  }

  async function toggle(task: DayTask) {
    const r = await api<{ tasks: DayTask[] }>("/api/daytasks", {
      method: "PATCH",
      body: JSON.stringify({ date: today, id: task.id, patch: { done: !task.done } }),
    }).catch(() => null);
    if (r) {
      setTasks(r.tasks);
      changed();
    }
  }

  function openEditor(t: DayTask) {
    setTimeEditId(t.id);
    setEditDate(today);
    setEditTime(t.time ?? "");
  }

  // Reschedule to a new day and/or time. Same day → just change the time;
  // a different day → move the task onto that day's list.
  async function reschedule(t: DayTask) {
    setTimeEditId(null);
    const newTime = editTime || null;
    if (!editDate || editDate === today) {
      const r = await api<{ tasks: DayTask[] }>("/api/daytasks", {
        method: "PATCH",
        body: JSON.stringify({ date: today, id: t.id, patch: { time: newTime } }),
      }).catch(() => null);
      if (r) {
        setTasks(r.tasks);
        changed();
      }
      return;
    }
    // Move to another day: add to the new date FIRST. Only remove it from today
    // once the new task is confirmed created — never delete before the add
    // succeeds, or a failed POST would lose the task entirely.
    const add = await api<{ task: DayTask }>("/api/daytasks", {
      method: "POST",
      body: JSON.stringify({ date: editDate, title: t.title, time: newTime }),
    }).catch(() => null);
    if (!add) {
      setNote("Couldn't move the task — it's still here. Try again.");
      setTimeout(() => setNote(null), 4000);
      return; // keep the task on today; nothing was deleted
    }
    const del = await api<{ tasks: DayTask[] }>("/api/daytasks", {
      method: "DELETE",
      body: JSON.stringify({ date: today, id: t.id }),
    }).catch(() => null);
    if (del) setTasks(del.tasks);
    changed();
    const label = new Date(editDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    setNote(`Moved to ${label}${newTime ? ` at ${fmt12(newTime)}` : ""}.`);
    setTimeout(() => setNote(null), 4000);
  }

  async function remove(task: DayTask) {
    const r = await api<{ tasks: DayTask[] }>("/api/daytasks", {
      method: "DELETE",
      body: JSON.stringify({ date: today, id: task.id }),
    }).catch(() => null);
    if (r) {
      setTasks(r.tasks);
      changed();
    }
  }

  const open = tasks?.filter((t) => !t.done).length ?? 0;
  const now = nowHHMM();

  return (
    <Panel
      idx="10"
      title="Tasks · Today"
      right={<span>{tasks === null ? "…" : `${open} open`}</span>}
    >
      {note && (
        <div
          className="chip"
          style={{ display: "block", marginBottom: 10, padding: "7px 10px", background: "var(--accent-dim)", borderColor: "rgba(111,224,174,0.3)", fontSize: 12 }}
        >
          {note}
        </div>
      )}
      <div ref={searchRef} style={{ position: "relative", marginBottom: 12 }}>
        <div className="row">
          <input
            ref={inputRef}
            className="input"
            placeholder='Search a task or add one… e.g. "newsletter BYTOX"'
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              runSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setHits([]);
            }}
          />
          <input
            className="input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ width: 120, flexShrink: 0 }}
            title="Optional time"
          />
          <button className="btn primary" onClick={add} disabled={busy || !title.trim()}>
            Add
          </button>
        </div>
        {title.trim().length >= 2 && hits.length > 0 && (
          <div className="work-results">
            {hits.map((h) => (
              <button key={h.key} className="work-result" onClick={() => pull(h)} disabled={busy}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</span>
                <span className="faint" style={{ fontSize: 9.5, fontFamily: "var(--mono)", flexShrink: 0 }}>
                  {h.who ? `${h.who.toUpperCase()} · ` : ""}
                  {h.source === "client" ? "CLIENT" : h.source === "crm" ? "CRM" : "TODAY"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {tasks === null ? (
        <div className="faint" style={{ fontSize: 13 }}>Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="faint" style={{ fontSize: 13 }}>
          Nothing on the list yet. Add the day&apos;s must-dos — give them a time and they land on the timeline.
        </div>
      ) : (
        <div className="stack" style={{ gap: 0 }}>
          {/* Open tasks first, then a "done today" log at the bottom. */}
          {[...tasks].sort((a, b) => Number(a.done) - Number(b.done)).map((t) => {
            // A task is "late" (blinks red) if it's a timed task past its hour
            // OR it rolled over from an earlier day (overdue carry-forward).
            const late = !t.done && ((t.time !== null && t.time < now) || Boolean(t.carriedFrom));
            const span =
              t.finishedAt
                ? `started ${t.startedAt ? fmtTime12(new Date(t.startedAt)) : "—"} · finished ${fmtTime12(new Date(t.finishedAt))}`
                : null;
            return (
              <div
                key={t.id}
                className={`spread ${late ? "task-late" : ""}`}
                style={{ padding: late ? "8px 8px" : "7px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start" }}
              >
                <div
                  className="row"
                  style={{ cursor: "pointer", minWidth: 0, alignItems: "flex-start" }}
                  onClick={() => toggle(t)}
                  title={t.done ? "Mark as not done" : "Mark done"}
                >
                  <span className={`habit ${t.done ? "done" : ""}`} style={{ padding: 0, border: "none", background: "none", marginTop: 1 }}>
                    <span className="box">{t.done ? "✓" : ""}</span>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 13,
                        textDecoration: t.done ? "line-through" : "none",
                        color: t.done ? "var(--text-faint)" : undefined,
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.title}
                    </span>
                    {span && (
                      <span className="num" style={{ fontSize: 10, color: "var(--accent)", opacity: 0.8 }}>{span}</span>
                    )}
                  </span>
                </div>
                <div className="row" style={{ flexShrink: 0 }}>
                  {t.fromWork && t.done && <span className="chip ok">done</span>}
                  {t.carriedFrom && !t.done && (
                    <span
                      className="chip hot"
                      title={`Rolled over from ${new Date(t.carriedFrom + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
                    >
                      overdue · was due {new Date(t.carriedFrom + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {timeEditId === t.id ? (
                    <span className="row" style={{ gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <input
                        className="input"
                        type="date"
                        value={editDate}
                        min={today}
                        onChange={(e) => setEditDate(e.target.value)}
                        style={{ width: 132, padding: "3px 6px", fontSize: 12 }}
                        title="Day"
                      />
                      <input
                        className="input"
                        type="time"
                        value={editTime}
                        autoFocus
                        onChange={(e) => setEditTime(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") reschedule(t);
                          if (e.key === "Escape") setTimeEditId(null);
                        }}
                        style={{ width: 100, padding: "3px 6px", fontSize: 12 }}
                        title="Time"
                      />
                      <button className="btn small primary" onClick={() => reschedule(t)}>save</button>
                      <button className="btn small" onClick={() => setTimeEditId(null)}>×</button>
                    </span>
                  ) : late ? (
                    <>
                      <span className="chip hot">{fmt12(t.time!)} · overdue</span>
                      <button
                        className="btn small"
                        style={{ color: "var(--hot)", borderColor: "var(--hot)" }}
                        onClick={() => openEditor(t)}
                        title="Move to a new day / time"
                      >
                        ⟳ reschedule
                      </button>
                    </>
                  ) : t.time ? (
                    <span
                      className={`chip ${t.done ? "" : "warm"}`}
                      onClick={() => !t.done && openEditor(t)}
                      style={{ cursor: t.done ? "default" : "pointer" }}
                      title={t.done ? undefined : "Change day / time"}
                    >
                      {fmt12(t.time)}
                    </span>
                  ) : (
                    !t.done && (
                      <button className="btn small" onClick={() => openEditor(t)} title="Set a day / time">
                        🕐 set time
                      </button>
                    )
                  )}
                  <button
                    className="faint"
                    onClick={() => remove(t)}
                    title="Delete"
                    style={{ fontSize: 14, lineHeight: 1, padding: "0 2px" }}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Repeating routines ── */}
      <div style={{ marginTop: 12, borderTop: "1px solid var(--border-soft)", paddingTop: 10 }}>
        <button
          className="label"
          style={{ fontSize: 9, cursor: "pointer", color: "var(--text-dim)" }}
          onClick={() => setShowRepeat((s) => !s)}
        >
          {showRepeat ? "▼" : "▶"} ↻ Repeating {routines.length > 0 ? `(${routines.length})` : ""}
        </button>
        {showRepeat && (
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            {routines.map((r) => (
              <div key={r.id} className="spread" style={{ fontSize: 12.5 }}>
                <span className="row" style={{ gap: 8, minWidth: 0 }}>
                  <span className="row" style={{ gap: 2 }}>
                    {DAY_LABELS.map((d, i) => (
                      <span
                        key={i}
                        style={{
                          fontFamily: "var(--mono)", fontSize: 9, width: 12, textAlign: "center",
                          color: r.days.includes(i) ? "var(--accent)" : "var(--text-faint)",
                          fontWeight: r.days.includes(i) ? 700 : 400,
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </span>
                  <span>{r.title}</span>
                  {r.time && <span className="chip">{fmt12(r.time)}</span>}
                </span>
                <button className="faint" onClick={() => removeRoutine(r.id)} title="Remove" style={{ fontSize: 14, padding: "0 2px" }}>×</button>
              </div>
            ))}
            <div className="stack" style={{ gap: 6 }}>
              <input
                className="input"
                placeholder="Repeating task… e.g. Take out the trash"
                value={rTitle}
                onChange={(e) => setRTitle(e.target.value)}
                style={{ fontSize: 12.5, padding: "6px 9px" }}
              />
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <div className="row" style={{ gap: 3 }}>
                  {DAY_LABELS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => setRDays((ds) => (ds.includes(i) ? ds.filter((x) => x !== i) : [...ds, i]))}
                      style={{
                        width: 24, height: 24, borderRadius: 6, fontSize: 11, fontFamily: "var(--mono)",
                        border: `1px solid ${rDays.includes(i) ? "var(--accent)" : "var(--border-soft)"}`,
                        color: rDays.includes(i) ? "var(--accent)" : "var(--text-dim)",
                        background: rDays.includes(i) ? "var(--accent-dim)" : "transparent",
                      }}
                      title={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <input className="input" type="time" value={rTime} onChange={(e) => setRTime(e.target.value)} style={{ width: 110, fontSize: 12, padding: "5px 8px" }} title="Due-by time (optional)" />
                <button className="btn small primary" onClick={addRoutine} disabled={!rTitle.trim() || rDays.length === 0}>
                  add repeat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
