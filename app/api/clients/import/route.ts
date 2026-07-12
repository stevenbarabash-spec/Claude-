// One-time (re-runnable) import from the schedule-tracker's projects.json.
// REPLACES the current board with the file's contents.
import { NextResponse } from "next/server";
import { saveClientProjects } from "@/lib/clientProjects";
import type { ClientProject } from "@/lib/types";

const DATA_URL =
  "https://raw.githubusercontent.com/stevenbarabash-spec/Claude-/claude/schedule-tracker-dashboard-8jusxi/data/projects.json";

export async function POST() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: `tracker fetch failed: ${res.status}` }, { status: 502 });
  }
  const data = await res.json();
  const now = new Date().toISOString();
  const projects: ClientProject[] = (data.projects ?? []).map(
    (p: {
      name: string;
      status?: string;
      progress?: number;
      phase?: string;
      deadline?: string | null;
      nextMilestone?: string;
      team?: string[];
      budget?: string;
      iterations?: { date: string; note: string }[];
      tasks?: { title: string; done?: boolean; due?: string | null }[];
    }) => ({
      id: crypto.randomUUID(),
      name: p.name,
      status: (["active", "done", "paused"].includes(p.status ?? "") ? p.status : "active") as ClientProject["status"],
      progress: Number(p.progress) || 0,
      phase: p.phase ?? null,
      deadline: p.deadline ?? null,
      next_milestone: p.nextMilestone ?? null,
      team: Array.isArray(p.team) ? p.team : [],
      budget: p.budget ?? null,
      iterations: (p.iterations ?? []).map((i) => ({ date: i.date, note: i.note })),
      tasks: (p.tasks ?? []).map((t) => ({
        id: crypto.randomUUID(),
        title: t.title,
        done: Boolean(t.done),
        due: t.due ?? null,
      })),
      created_at: now,
      updated_at: now,
    }),
  );
  await saveClientProjects(projects);
  return NextResponse.json({ imported: projects.length });
}
