"use client";
// Client work due today — fed by the schedule tracker (separate branch, its own
// session maintains it). Read-only view: overdue / due-today / deadlines by client.
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Panel } from "../Panel";

interface Row {
  client: string;
  project: string;
  title: string;
  due: string | null;
  kind: "overdue" | "today" | "deadline";
}
interface Group {
  client: string;
  rows: Row[];
  hasOverdue: boolean;
}

const TRACKER_URL = "https://claude.ai/code/artifact/468a77a7-19b0-4149-9977-2436e7413801";

export function ClientWork() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [activeProjects, setActiveProjects] = useState(0);

  useEffect(() => {
    api<{ groups: Group[]; activeProjects: number; ok: boolean }>("/api/clientwork")
      .then((r) => {
        setGroups(r.ok ? r.groups : []);
        setActiveProjects(r.activeProjects);
      })
      .catch(() => setGroups([]));
  }, []);

  const chip = (kind: Row["kind"]) =>
    kind === "overdue" ? (
      <span className="chip hot">overdue</span>
    ) : kind === "deadline" ? (
      <span className="chip ok">deadline</span>
    ) : (
      <span className="chip warm">today</span>
    );

  return (
    <Panel
      idx="09"
      title="Client Work · Due Today"
      right={
        <a href={TRACKER_URL} target="_blank" rel="noreferrer" className="chip">
          {activeProjects} active · tracker ↗
        </a>
      }
    >
      {groups === null ? (
        <div className="faint" style={{ fontSize: 13 }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div className="faint" style={{ fontSize: 13 }}>
          Nothing due today across client projects. Clear runway.
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {groups.map((g) => (
            <div key={g.client}>
              <div className="label" style={{ marginBottom: 6, color: g.hasOverdue ? "var(--hot)" : undefined }}>
                {g.client}
              </div>
              <div className="stack" style={{ gap: 0 }}>
                {g.rows.map((r, i) => (
                  <div key={i} className="spread" style={{ padding: "7px 0", borderBottom: "1px solid var(--border-soft)" }}>
                    <div>
                      <div style={{ fontSize: 13 }}>{r.title}</div>
                      <div className="faint" style={{ fontSize: 10.5, marginTop: 2, fontFamily: "var(--mono)" }}>
                        {r.project.toUpperCase()}
                        {r.kind === "overdue" && r.due ? ` · DUE ${r.due}` : ""}
                      </div>
                    </div>
                    {chip(r.kind)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
