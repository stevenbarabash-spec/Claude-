"use client";
// Nutrition card (guide §5.5): type a meal → AI estimates macros. Bidirectional
// coupling — edit a macro and kcal recomputes (4p+4c+9f); edit kcal and the AI
// redistributes macros for that food.
import { useEffect, useRef, useState } from "react";
import { api, clientDateKey, debounce } from "@/lib/client";
import { config } from "@/lib/config";
import type { Meal } from "@/lib/types";
import { Panel } from "../Panel";

export function Nutrition() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const dirty = useRef(false);
  const today = clientDateKey();

  function load() {
    api<{ log: { notes: { nutrition?: { meals: Meal[] } } } | null }>(`/api/log/${today}`)
      .then((r) => {
        if (!dirty.current) setMeals(r.log?.notes.nutrition?.meals ?? []);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const onCapture = () => {
      dirty.current = false;
      load();
    };
    window.addEventListener("jarvis:capture", onCapture);
    return () => window.removeEventListener("jarvis:capture", onCapture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(next: Meal[]) {
    dirty.current = true;
    setMeals(next);
    void api("/api/nutrition/meals", { method: "POST", body: JSON.stringify({ date: today, meals: next }) }).catch(() => {});
  }

  async function addMeal(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const est = await api<{ kcal: number; p: number; c: number; f: number }>("/api/nutrition/estimate", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      const meal: Meal = {
        id: crypto.randomUUID(),
        t: new Date().toTimeString().slice(0, 5),
        n: text,
        kcal: est.kcal,
        p: est.p,
        c: est.c,
        f: est.f,
        estimated: true,
      };
      save([...meals, meal]);
      setInput("");
    } finally {
      setBusy(false);
    }
  }

  const redistribute = useRef(
    debounce(async (meal: Meal, kcal: number, all: Meal[]) => {
      try {
        const r = await api<{ p: number; c: number; f: number }>("/api/nutrition/redistribute", {
          method: "POST",
          body: JSON.stringify({ name: meal.n, kcal }),
        });
        save(all.map((m) => (m.id === meal.id ? { ...m, kcal, p: r.p, c: r.c, f: r.f } : m)));
      } catch {}
    }, 600),
  ).current;

  function editMacro(id: string, field: "p" | "c" | "f", value: number) {
    const next = meals.map((m) => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: value };
      updated.kcal = Math.round(4 * updated.p + 4 * updated.c + 9 * updated.f);
      return updated;
    });
    save(next);
  }

  function editKcal(id: string, kcal: number) {
    const meal = meals.find((m) => m.id === id);
    if (!meal) return;
    const next = meals.map((m) => (m.id === id ? { ...m, kcal } : m));
    dirty.current = true;
    setMeals(next);
    redistribute(meal, kcal, next);
  }

  const totals = meals.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const n = config.nutrition;
  const deficit = n.kcalTarget - totals.kcal;

  const [cutoffLeft, setCutoffLeft] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      const [h, m] = n.cutoff.split(":").map(Number);
      const cutoff = new Date();
      cutoff.setHours(h, m, 0, 0);
      const diff = cutoff.getTime() - Date.now();
      setCutoffLeft(diff > 0 ? `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m` : null);
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [n.cutoff]);

  const macro = (label: string, value: number, target: number) => (
    <div style={{ flex: 1 }}>
      <div className="spread">
        <span className="label" style={{ fontSize: 9 }}>{label}</span>
        <span className="num faint" style={{ fontSize: 10.5 }}>
          {Math.round(value)}/{target}g
        </span>
      </div>
      <div className="bar" style={{ marginTop: 4 }}>
        <div style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
      </div>
    </div>
  );

  return (
    <Panel idx="08" title="Nutrition" right={<span>today</span>}>
      <div className="spread">
        <div>
          <div className="big-num">{totals.kcal.toLocaleString()}</div>
          <div className="faint" style={{ fontSize: 11 }}>
            of {n.kcalTarget.toLocaleString()} kcal ·{" "}
            <span style={{ color: deficit >= 0 ? "var(--accent)" : "var(--hot)" }}>
              {deficit >= 0 ? `−${deficit}` : `+${-deficit}`} {deficit >= 0 ? "deficit" : "over"}
            </span>
          </div>
        </div>
        {cutoffLeft && (
          <div style={{ textAlign: "right" }}>
            <span className="chip warm">cutoff in {cutoffLeft}</span>
            <div className="label" style={{ marginTop: 4 }}>cutoff · {n.cutoff}</div>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 12, gap: 12 }}>
        {macro("Protein", totals.p, n.proteinTarget)}
        {macro("Carbs", totals.c, n.carbsTarget)}
        {macro("Fat", totals.f, n.fatTarget)}
      </div>

      <form className="row" style={{ marginTop: 14 }} onSubmit={addMeal}>
        <input
          className="input"
          placeholder='Log a meal — try "chicken rice bowl"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button className="btn primary" disabled={busy || !input.trim()}>
          {busy ? "…" : "+"}
        </button>
      </form>

      <div className="stack" style={{ marginTop: 12 }}>
        {meals.map((m) => (
          <div key={m.id}>
            <div
              className="spread"
              style={{ padding: "7px 0", cursor: "pointer" }}
              onClick={() => setEditing(editing === m.id ? null : m.id)}
            >
              <div className="row" style={{ gap: 8 }}>
                <span className="num faint" style={{ fontSize: 11 }}>{m.t}</span>
                <span style={{ fontSize: 13 }}>{m.n}</span>
              </div>
              <div className="num" style={{ fontSize: 12 }}>
                {m.kcal}k <span className="faint">{m.p}p</span>
              </div>
            </div>
            {editing === m.id && (
              <div className="row" style={{ gap: 8, padding: "4px 0 10px" }}>
                {(["kcal", "p", "c", "f"] as const).map((field) => (
                  <label key={field} style={{ flex: 1 }}>
                    <span className="label" style={{ fontSize: 8.5 }}>{field}</span>
                    <input
                      className="input num"
                      style={{ padding: "5px 8px", fontSize: 12 }}
                      type="number"
                      value={Math.round(m[field])}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (field === "kcal") editKcal(m.id, v);
                        else editMacro(m.id, field, v);
                      }}
                    />
                  </label>
                ))}
                <button
                  className="btn small"
                  style={{ alignSelf: "flex-end", color: "var(--hot)" }}
                  onClick={() => save(meals.filter((x) => x.id !== m.id))}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
        {meals.length === 0 && <div className="faint" style={{ fontSize: 12.5 }}>Nothing logged yet today.</div>}
      </div>
    </Panel>
  );
}
