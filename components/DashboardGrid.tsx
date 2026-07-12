"use client";
// The home board, drag-and-drop. Every card has a grip (top-left); drag it to
// any spot in any of the three columns. Layout persists per device in
// localStorage and survives new cards being added later (unknown ids append,
// missing ids drop). "Reset layout" in Settings restores the default.
import { useEffect, useRef, useState } from "react";
import { Blockers } from "@/components/cards/Blockers";
import { CalendarCard } from "@/components/cards/CalendarCard";
import { ClientWork } from "@/components/cards/ClientWork";
import { CurrentlyWorkingOn } from "@/components/cards/CurrentlyWorkingOn";
import { DayTasks } from "@/components/cards/DayTasks";
import { DayTimeline } from "@/components/cards/DayTimeline";
import { FeatureRequests } from "@/components/cards/FeatureRequests";
import { FinancePulse } from "@/components/cards/FinancePulse";
import { GoalsCard } from "@/components/cards/Goals";
import { Habits } from "@/components/cards/Habits";
import { NextUp } from "@/components/cards/NextUp";
import { Nutrition } from "@/components/cards/Nutrition";
import { Operator } from "@/components/cards/Operator";
import { Session } from "@/components/cards/Session";
import { Timers } from "@/components/cards/Timers";

const CARDS: Record<string, React.ReactNode> = {
  operator: <Operator />,
  cashflow: <FinancePulse />,
  blockers: <Blockers />,
  timers: <Timers />,
  session: <Session />,
  timeline: <DayTimeline />,
  working: <CurrentlyWorkingOn />,
  daytasks: <DayTasks />,
  clientwork: <ClientWork />,
  habits: <Habits />,
  calendar: <CalendarCard />,
  nextup: <NextUp />,
  nutrition: <Nutrition />,
  goals: <GoalsCard />,
  features: <FeatureRequests />,
};

const DEFAULT_LAYOUT: string[][] = [
  ["operator", "cashflow", "blockers", "timers"],
  ["session", "timeline", "working", "daytasks", "clientwork", "habits", "calendar"],
  ["nextup", "nutrition", "goals", "features"],
];

const STORE_KEY = "jarvis-layout-v1";

// Keep every registered card exactly once: drop unknown ids, append new ones.
function reconcile(layout: string[][]): string[][] {
  const known = new Set(Object.keys(CARDS));
  const seen = new Set<string>();
  const cols = layout.map((col) =>
    col.filter((id) => known.has(id) && !seen.has(id) && (seen.add(id), true)),
  );
  while (cols.length < 3) cols.push([]);
  for (const id of Object.keys(CARDS)) {
    if (!seen.has(id)) {
      // append missing card to the shortest column
      let min = 0;
      for (let i = 1; i < cols.length; i++) if (cols[i].length < cols[min].length) min = i;
      cols[min].push(id);
    }
  }
  return cols.slice(0, 3);
}

// Focus mode: only these cards, for heads-down work (alerts banner stays via Shell).
const FOCUS_SET = ["working", "nextup", "calendar"];

export function DashboardGrid() {
  const [cols, setCols] = useState<string[][]>(DEFAULT_LAYOUT);
  const [mounted, setMounted] = useState(false);
  const [focus, setFocus] = useState(false);
  const dragId = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ card?: string; col?: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setCols(reconcile(JSON.parse(raw)));
      setFocus(localStorage.getItem("jarvis-focus") === "1");
    } catch {}
    setMounted(true);
    const onReset = () => {
      setCols(DEFAULT_LAYOUT);
      try {
        localStorage.removeItem(STORE_KEY);
      } catch {}
    };
    const onFocus = () =>
      setFocus((f) => {
        const next = !f;
        try {
          localStorage.setItem("jarvis-focus", next ? "1" : "0");
        } catch {}
        return next;
      });
    window.addEventListener("layout:reset", onReset);
    window.addEventListener("focus:toggle", onFocus);
    return () => {
      window.removeEventListener("layout:reset", onReset);
      window.removeEventListener("focus:toggle", onFocus);
    };
  }, []);

  function exitFocus() {
    setFocus(false);
    try {
      localStorage.setItem("jarvis-focus", "0");
    } catch {}
  }

  function persist(next: string[][]) {
    setCols(next);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {}
  }

  function dropBeforeCard(targetCol: number, targetId: string) {
    const id = dragId.current;
    if (!id || id === targetId) return;
    const next = cols.map((c) => c.filter((x) => x !== id));
    const arr = next[targetCol];
    const ti = arr.indexOf(targetId);
    arr.splice(ti < 0 ? arr.length : ti, 0, id);
    persist(next);
  }

  function dropInColumn(targetCol: number) {
    const id = dragId.current;
    if (!id) return;
    const next = cols.map((c) => c.filter((x) => x !== id));
    next[targetCol].push(id);
    persist(next);
  }

  function endDrag() {
    dragId.current = null;
    setDragging(null);
    setOver(null);
  }

  if (focus) {
    return (
      <div className="focus-view">
        <div className="focus-head">
          <span className="label" style={{ color: "var(--accent)" }}>🎯 Focus mode</span>
          <span className="faint" style={{ fontSize: 12 }}>Heads-down — everything else is hidden.</span>
          <span style={{ flex: 1 }} />
          <button className="btn small" onClick={exitFocus}>exit focus</button>
        </div>
        <div className="focus-stack">
          {FOCUS_SET.map((id) => (
            <div key={id}>{CARDS[id]}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="home-grid">
      {cols.map((col, ci) => (
        <div
          key={ci}
          className={`col ${over?.col === ci && over?.card === undefined ? "col-drop-target" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver({ col: ci });
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropInColumn(ci);
            endDrag();
          }}
        >
          {col.map((id) => (
            <div
              key={id}
              className={`card-wrap ${dragging === id ? "dragging" : ""} ${
                over?.card === id ? "drop-before" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragId.current && dragId.current !== id) setOver({ col: ci, card: id });
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dropBeforeCard(ci, id);
                endDrag();
              }}
            >
              {mounted && (
                <div
                  className="card-grip"
                  draggable
                  onDragStart={(e) => {
                    dragId.current = id;
                    setDragging(id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", id);
                  }}
                  onDragEnd={endDrag}
                  title="Drag to move this card"
                >
                  ⠿
                </div>
              )}
              {CARDS[id]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
