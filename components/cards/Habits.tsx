"use client";
// Habit tracker (guide §5.3): localStorage for instant feedback, synced to the
// store on every click, keyed by the BROWSER's date so it resets at local midnight.
// The habit list itself is editable in place (✎) and stored in the DB.
import { useEffect, useRef, useState } from "react";
import { api, clientDateKey } from "@/lib/client";
import { config } from "@/lib/config";
import type { HabitDef } from "@/lib/types";
import { Panel } from "../Panel";

function lsKey(date: string): string {
  return `jarvis-habits-${date}`;
}

export function Habits() {
  const [defs, setDefs] = useState<HabitDef[]>(config.habits);
  const [done, setDone] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HabitDef[]>([]);
  const [newHabit, setNewHabit] = useState({ label: "", category: "" });
  const dirty = useRef(false);
  const today = clientDateKey();

  useEffect(() => {
    try {
      const cached = localStorage.getItem(lsKey(today));
      if (cached) setDone(JSON.parse(cached));
    } catch {}
    api<{ habits: HabitDef[] }>("/api/habits/config")
      .then((r) => setDefs(r.habits))
      .catch(() => {});
    api<{ habits: { date: string; done: string[] }[] }>("/api/habits?days=3")
      .then((r) => {
        if (dirty.current) return; // a fresh click beats a slow GET (guide §8.4)
        const server = r.habits.find((h) => h.date === today);
        if (server) setDone(server.done);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    dirty.current = true;
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    try {
      localStorage.setItem(lsKey(today), JSON.stringify(next));
    } catch {}
    void api(`/api/habits/${today}`, { method: "POST", body: JSON.stringify({ done: next }) }).catch(() => {});
  }

  function startEditing() {
    setDraft(defs.map((d) => ({ ...d })));
    setNewHabit({ label: "", category: "" });
    setEditing(true);
  }

  async function saveEditing() {
    const cleaned = draft.filter((d) => d.label.trim());
    const r = await api<{ habits: HabitDef[] }>("/api/habits/config", {
      method: "POST",
      body: JSON.stringify({ habits: cleaned }),
    });
    setDefs(r.habits);
    setEditing(false);
  }

  function addDraftHabit() {
    const label = newHabit.label.trim();
    if (!label) return;
    setDraft((d) => [...d, { id: "", label, category: newHabit.category.trim() || "Habit" }]);
    setNewHabit({ label: "", category: "" });
  }

  const score = done.filter((id) => defs.some((d) => d.id === id)).length;
  const total = defs.length;

  return (
    <Panel
      idx="03"
      title="Habits"
      right={
        <span className="row" style={{ gap: 6 }}>
          <span>
            {score}/{total} · {total ? Math.round((score / total) * 100) : 0}%
          </span>
          <button className="btn small" onClick={() => (editing ? setEditing(false) : startEditing())}>
            {editing ? "cancel" : "✎ edit"}
          </button>
        </span>
      }
    >
      {editing ? (
        <div className="stack">
          {draft.map((h, i) => (
            <div key={i} className="row">
              <input
                className="input"
                style={{ flex: 2 }}
                value={h.label}
                onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
              <input
                className="input"
                style={{ flex: 1 }}
                value={h.category}
                placeholder="Category"
                onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
              />
              <button
                className="btn small"
                style={{ color: "var(--hot)" }}
                onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              addDraftHabit();
            }}
          >
            <input
              className="input"
              style={{ flex: 2 }}
              placeholder="New habit…"
              value={newHabit.label}
              onChange={(e) => setNewHabit({ ...newHabit, label: e.target.value })}
            />
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="Category"
              value={newHabit.category}
              onChange={(e) => setNewHabit({ ...newHabit, category: e.target.value })}
            />
            <button className="btn small">+ add</button>
          </form>
          <button className="btn primary" onClick={saveEditing}>
            Save habits
          </button>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <div
              className="rail-avatar"
              style={{ width: 40, height: 40, fontSize: 16, color: score === total ? "var(--accent)" : "var(--text-dim)" }}
            >
              {score}
            </div>
            <div>
              <div className="dim" style={{ fontSize: 13 }}>Daily score · resets at midnight</div>
              <div className="faint" style={{ fontSize: 12 }}>
                {score === 0 ? "Start with one." : score === total ? "Perfect day." : "Keep stacking."}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="row" style={{ gap: 3 }}>
              {defs.map((h) => (
                <div
                  key={h.id}
                  style={{
                    width: 5,
                    height: 18,
                    borderRadius: 2,
                    background: done.includes(h.id) ? "var(--accent)" : "rgba(255,255,255,0.08)",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="grid-2" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {defs.map((h) => (
              <div key={h.id} className={`habit ${done.includes(h.id) ? "done" : ""}`} onClick={() => toggle(h.id)}>
                <span className="box">{done.includes(h.id) ? "✓" : ""}</span>
                <div>
                  <div style={{ fontSize: 12.5 }}>{h.label}</div>
                  <div className="label" style={{ fontSize: 9, marginTop: 1 }}>{h.category}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
