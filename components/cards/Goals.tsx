"use client";
// Goals card (guide §5.7): week + month lists on a sentinel date — never auto-clear.
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { GoalItem } from "@/lib/types";
import { Panel } from "../Panel";

type Goals = { week: GoalItem[]; month: GoalItem[] };

export function GoalsCard() {
  const [goals, setGoals] = useState<Goals>({ week: [], month: [] });
  const [inputs, setInputs] = useState({ week: "", month: "" });

  useEffect(() => {
    api<{ goals: Goals }>("/api/goals")
      .then((r) => setGoals(r.goals))
      .catch(() => {});
  }, []);

  function persist(scope: "week" | "month", items: GoalItem[]) {
    setGoals((g) => ({ ...g, [scope]: items }));
    void api("/api/goals", { method: "POST", body: JSON.stringify({ scope, items }) }).catch(() => {});
  }

  const section = (scope: "week" | "month", label: string) => (
    <div>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div className="stack" style={{ gap: 6 }}>
        {goals[scope].map((g) => (
          <div key={g.id} className={`habit ${g.done ? "done" : ""}`} style={{ padding: "7px 10px" }}>
            <span
              className="box"
              onClick={() => persist(scope, goals[scope].map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))}
            >
              {g.done ? "✓" : ""}
            </span>
            <span style={{ fontSize: 12.5, flex: 1, textDecoration: g.done ? "line-through" : "none", opacity: g.done ? 0.5 : 1 }}>
              {g.text}
            </span>
            <button
              className="faint"
              style={{ fontSize: 11 }}
              onClick={() => persist(scope, goals[scope].filter((x) => x.id !== g.id))}
            >
              ✕
            </button>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = inputs[scope].trim();
            if (!text) return;
            persist(scope, [...goals[scope], { id: crypto.randomUUID(), text, done: false }]);
            setInputs((s) => ({ ...s, [scope]: "" }));
          }}
        >
          <input
            className="input"
            style={{ padding: "6px 10px", fontSize: 12.5 }}
            placeholder="Add a goal…"
            value={inputs[scope]}
            onChange={(e) => setInputs((s) => ({ ...s, [scope]: e.target.value }))}
          />
        </form>
      </div>
    </div>
  );

  return (
    <Panel idx="05" title="Goals">
      <div className="stack" style={{ gap: 16 }}>
        {section("week", "This Week")}
        {section("month", "This Month")}
      </div>
    </Panel>
  );
}
