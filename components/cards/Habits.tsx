"use client";
// Habit tracker (guide §5.3): localStorage for instant feedback, synced to the
// store on every click, keyed by the BROWSER's date so it resets at local midnight.
import { useEffect, useRef, useState } from "react";
import { api, clientDateKey } from "@/lib/client";
import { config } from "@/lib/config";
import { Panel } from "../Panel";

function lsKey(date: string): string {
  return `jarvis-habits-${date}`;
}

export function Habits() {
  const [done, setDone] = useState<string[]>([]);
  const dirty = useRef(false);
  const today = clientDateKey();

  useEffect(() => {
    try {
      const cached = localStorage.getItem(lsKey(today));
      if (cached) setDone(JSON.parse(cached));
    } catch {}
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

  const score = done.length;
  const total = config.habits.length;

  return (
    <Panel
      idx="03"
      title="Habits"
      right={
        <span>
          {score}/{total} · {Math.round((score / total) * 100)}%
        </span>
      }
    >
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
          {config.habits.map((h) => (
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
      <div className="grid-2" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {config.habits.map((h) => (
          <div key={h.id} className={`habit ${done.includes(h.id) ? "done" : ""}`} onClick={() => toggle(h.id)}>
            <span className="box">{done.includes(h.id) ? "✓" : ""}</span>
            <div>
              <div style={{ fontSize: 12.5 }}>{h.label}</div>
              <div className="label" style={{ fontSize: 9, marginTop: 1 }}>{h.category}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
