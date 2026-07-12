"use client";
// HISTORY — every change with its timestamp, and a one-tap revert.
import { useEffect, useState } from "react";
import { api, clientDateKey, fmtTime12 } from "@/lib/client";
import type { HistoryEvent, HistoryResource } from "@/lib/types";

const RESOURCE_LABEL: Record<HistoryResource, string> = {
  task: "CRM task",
  client_project: "Client work",
  receivable: "Money owed",
  income: "Income",
  project: "Money project",
  day_tasks: "Day task",
};

const ACTION_COLOR: Record<HistoryEvent["action"], string> = {
  create: "var(--accent)",
  update: "var(--warm)",
  delete: "var(--hot)",
};

export default function HistoryPage() {
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [filter, setFilter] = useState<HistoryResource | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const today = clientDateKey();

  function load() {
    api<{ events: HistoryEvent[] }>("/api/history").then((r) => setEvents(r.events)).catch(() => setEvents([]));
  }
  useEffect(() => {
    load();
    window.addEventListener("jarvis:capture", load);
    return () => window.removeEventListener("jarvis:capture", load);
  }, []);

  async function revert(e: HistoryEvent) {
    setBusyId(e.id);
    setNote(null);
    try {
      const r = await api<{ message: string }>("/api/history/revert", {
        method: "POST",
        body: JSON.stringify({ id: e.id }),
      });
      setNote(r.message);
      window.dispatchEvent(new CustomEvent("jarvis:capture"));
      load();
    } catch (err) {
      setNote(String(err));
    } finally {
      setBusyId(null);
      setTimeout(() => setNote(null), 5000);
    }
  }

  if (events === null) return <div className="faint">Loading…</div>;

  const visible = filter === "all" ? events : events.filter((e) => e.resource === filter);

  // Group by calendar day, newest first.
  const byDay = new Map<string, HistoryEvent[]>();
  for (const e of visible) {
    const day = clientDateKey(new Date(e.ts));
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }

  const dayLabel = (day: string) =>
    day === today
      ? "Today"
      : new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="row">
          <span className="label" style={{ fontSize: 12 }}>History //</span>
          <span className="chip ok">{events.length} changes</span>
        </div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          <button className={`btn small ${filter === "all" ? "primary" : ""}`} onClick={() => setFilter("all")}>
            all
          </button>
          {(Object.keys(RESOURCE_LABEL) as HistoryResource[]).map((r) => (
            <button key={r} className={`btn small ${filter === r ? "primary" : ""}`} onClick={() => setFilter(r)}>
              {RESOURCE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && (
        <div className="panel faint" style={{ textAlign: "center", padding: 30 }}>
          No changes recorded yet — history starts logging from now on: tasks, client work, money records and day tasks.
        </div>
      )}

      {[...byDay.entries()].map(([day, list]) => (
        <div key={day}>
          <div className="label" style={{ marginBottom: 8 }}>{dayLabel(day)}</div>
          <div className="panel" style={{ padding: "4px 14px" }}>
            {list.map((e) => (
              <div
                key={e.id}
                className="spread"
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border-soft)",
                  opacity: e.reverted ? 0.45 : 1,
                  gap: 12,
                }}
              >
                <div className="row" style={{ gap: 12, minWidth: 0, alignItems: "flex-start" }}>
                  <span
                    style={{
                      width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0,
                      background: ACTION_COLOR[e.action],
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, lineHeight: 1.45, textDecoration: e.reverted ? "line-through" : "none" }}>
                      {e.label}
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 4 }}>
                      <span className="num faint" style={{ fontSize: 11 }}>{fmtTime12(new Date(e.ts))}</span>
                      <span className="chip">{RESOURCE_LABEL[e.resource]}</span>
                      {e.source === "jarvis" && <span className="chip ok">jarvis</span>}
                      {e.reverted && <span className="chip warm">reverted</span>}
                      {e.is_revert && <span className="chip cool">revert</span>}
                    </div>
                  </div>
                </div>
                {!e.reverted && !e.is_revert && (
                  <button
                    className="btn small"
                    style={{ flexShrink: 0 }}
                    disabled={busyId === e.id}
                    onClick={() => revert(e)}
                  >
                    {busyId === e.id ? "…" : "↩ revert"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {note && <div className="toast">{note}</div>}
    </div>
  );
}
