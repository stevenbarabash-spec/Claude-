"use client";
// Health tab (guide §5.6): 30-day calorie log, averages over LOGGED days only.
import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { api } from "@/lib/client";
import { config } from "@/lib/config";
import type { Meal } from "@/lib/types";

interface DayRow {
  date: string;
  meals: Meal[];
}

export default function HealthPage() {
  const [days, setDays] = useState<DayRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<{ days: DayRow[] }>("/api/nutrition?days=30")
      .then((r) => setDays(r.days))
      .catch(() => {});
  }, []);

  const totals = days.map((d) => ({
    date: d.date,
    meals: d.meals,
    kcal: d.meals.reduce((a, m) => a + m.kcal, 0),
    p: d.meals.reduce((a, m) => a + m.p, 0),
    c: d.meals.reduce((a, m) => a + m.c, 0),
    f: d.meals.reduce((a, m) => a + m.f, 0),
  }));
  const logged = totals.filter((d) => d.meals.length > 0);
  const avg = (fn: (d: (typeof totals)[number]) => number) =>
    logged.length ? Math.round(logged.reduce((a, d) => a + fn(d), 0) / logged.length) : 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {(
          [
            ["Avg kcal", avg((d) => d.kcal), config.nutrition.kcalTarget],
            ["Avg protein", avg((d) => d.p), config.nutrition.proteinTarget],
            ["Avg carbs", avg((d) => d.c), config.nutrition.carbsTarget],
            ["Avg fat", avg((d) => d.f), config.nutrition.fatTarget],
          ] as const
        ).map(([label, value, target]) => (
          <Panel key={label} title={label} right={<span>target {target}</span>}>
            <div className="big-num">{value.toLocaleString()}</div>
            <div className="bar" style={{ marginTop: 10 }}>
              <div style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
            </div>
            <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>over {logged.length} logged days</div>
          </Panel>
        ))}
      </div>

      <Panel title="30-Day Log" right={<span>click a row to expand</span>}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Kcal</th>
              <th>P</th>
              <th>C</th>
              <th>F</th>
              <th>Meals</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((d) => (
              <RowGroup key={d.date} d={d} open={open === d.date} onToggle={() => setOpen(open === d.date ? null : d.date)} />
            ))}
            {totals.length === 0 && (
              <tr>
                <td colSpan={6} className="faint" style={{ textAlign: "center", padding: 24 }}>
                  No nutrition data yet — log a meal from the home page or tell Jarvis what you ate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function RowGroup({
  d,
  open,
  onToggle,
}: {
  d: { date: string; meals: Meal[]; kcal: number; p: number; c: number; f: number };
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: "pointer" }}>
        <td>{d.date}</td>
        <td>{d.kcal.toLocaleString()}</td>
        <td className="faint">{Math.round(d.p)}</td>
        <td className="faint">{Math.round(d.c)}</td>
        <td className="faint">{Math.round(d.f)}</td>
        <td className="faint">{d.meals.length} {open ? "▾" : "▸"}</td>
      </tr>
      {open &&
        d.meals.map((m) => (
          <tr key={m.id} style={{ background: "rgba(255,255,255,0.01)" }}>
            <td className="faint" style={{ paddingLeft: 28, fontFamily: "var(--sans)" }}>
              {m.t} · {m.n}
            </td>
            <td className="faint">{m.kcal}</td>
            <td className="faint">{m.p}</td>
            <td className="faint">{m.c}</td>
            <td className="faint">{m.f}</td>
            <td className="faint">{m.estimated ? "est" : ""}</td>
          </tr>
        ))}
    </>
  );
}
