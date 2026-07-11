"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Task } from "@/lib/types";
import { Panel } from "../Panel";

function heat(t: Task): "hot" | "warm" | "cool" {
  if (t.tags.includes("hot")) return "hot";
  if (t.tags.includes("warm")) return "warm";
  if (t.tags.includes("cool")) return "cool";
  const days = stuckDays(t);
  return days >= 5 ? "hot" : days >= 2 ? "warm" : "cool";
}

function stuckDays(t: Task): number {
  return Math.max(0, Math.floor((Date.now() - new Date(t.updated_at).getTime()) / 86400000));
}

export function Blockers() {
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = () =>
    api<{ tasks: Task[] }>("/api/tasks")
      .then((r) => setTasks(r.tasks.filter((t) => t.tags.includes("blocker") || t.key)))
      .catch(() => {});

  useEffect(() => {
    load();
    window.addEventListener("jarvis:capture", load);
    return () => window.removeEventListener("jarvis:capture", load);
  }, []);

  const shown = tasks.slice(0, 5);

  return (
    <Panel idx="06" title="Key Blockers" right={<span>{tasks.length} active</span>}>
      <div className="stack">
        {shown.map((t) => (
          <div key={t.id} className="spread" style={{ padding: "8px 0", borderBottom: "1px solid var(--border-soft)" }}>
            <div>
              <div style={{ fontSize: 13 }}>{t.title}</div>
              <div className="faint" style={{ fontSize: 11, marginTop: 2, fontFamily: "var(--mono)" }}>
                OWNER {(t.owner ?? "You").toUpperCase()} · STUCK {stuckDays(t)}D
              </div>
            </div>
            <span className={`chip ${heat(t)}`}>{heat(t)}</span>
          </div>
        ))}
        {shown.length === 0 && <div className="faint" style={{ fontSize: 13 }}>Nothing blocked. Clean board.</div>}
        {tasks.length > shown.length && (
          <Link href="/crm" className="label" style={{ textAlign: "center", padding: 6 }}>
            + {tasks.length - shown.length} more · view all
          </Link>
        )}
      </div>
    </Panel>
  );
}
