"use client";
// Tasks · Today — quick daily to-dos with an optional clock time
// ("BYTOX — send draft" at 3:00 PM). Lives between Session and Client Work.
// Timed entries also show up as notches on the day timeline.
import { useEffect, useRef, useState } from "react";
import { api, clientDateKey, fmt12, fmtTime12 } from "@/lib/client";
import type { DayTask } from "@/lib/types";
import { Panel } from "../Panel";

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function DayTasks() {
  const [tasks, setTasks] = useState<DayTask[] | null>(null);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = clientDateKey();

  const load = () =>
    api<{ tasks: DayTask[] }>(`/api/daytasks?date=${today}`)
      .then((r) => setTasks(r.tasks))
      .catch(() => setTasks([]));

  useEffect(() => {
    load();
    window.addEventListener("jarvis:capture", load);
    return () => window.removeEventListener("jarvis:capture", load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = () => window.dispatchEvent(new CustomEvent("jarvis:capture"));

  async function add() {
    const t = title.trim();
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
      changed();
      inputRef.current?.focus();
    } catch {
      /* keep input so nothing is lost */
    }
    setBusy(false);
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
      <div className="row" style={{ marginBottom: 12 }}>
        <input
          ref={inputRef}
          className="input"
          placeholder='Add a task… e.g. "BYTOX — send the draft"'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
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
            const late = !t.done && t.time !== null && t.time < now;
            const span =
              t.finishedAt
                ? `started ${t.startedAt ? fmtTime12(new Date(t.startedAt)) : "—"} · finished ${fmtTime12(new Date(t.finishedAt))}`
                : null;
            return (
              <div
                key={t.id}
                className="spread"
                style={{ padding: "7px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start" }}
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
                  {t.time && (
                    <span className={`chip ${t.done ? "" : late ? "hot" : "warm"}`}>{fmt12(t.time)}</span>
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
    </Panel>
  );
}
