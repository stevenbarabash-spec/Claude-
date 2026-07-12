// Client work due today — read from the schedule-tracker's data file, which
// lives on its own branch of this repo and is maintained by its own Claude
// session. We read; we never write.
import { NextResponse } from "next/server";
import { localDateKey } from "@/lib/dates";

const DATA_URL =
  "https://raw.githubusercontent.com/stevenbarabash-spec/Claude-/claude/schedule-tracker-dashboard-8jusxi/data/projects.json";

interface TrackerTask {
  title: string;
  done: boolean;
  due: string | null;
}
interface TrackerProject {
  name: string;
  status: "active" | "done" | "paused";
  deadline: string | null;
  phase?: string;
  nextMilestone?: string;
  tasks: TrackerTask[];
}

export interface ClientWorkItem {
  client: string;
  project: string;
  title: string;
  due: string | null;
  kind: "overdue" | "today" | "deadline";
}

let cached: { at: number; data: { projects: TrackerProject[] } } | null = null;
const TTL = 2 * 60 * 1000;

function clientOf(projectName: string): string {
  return projectName.split("—")[0].trim();
}

export async function GET() {
  try {
    if (!cached || Date.now() - cached.at > TTL) {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`tracker fetch ${res.status}`);
      cached = { at: Date.now(), data: await res.json() };
    }
    const today = localDateKey();
    const items: ClientWorkItem[] = [];

    for (const p of cached.data.projects ?? []) {
      if (p.status === "done") continue;
      const client = clientOf(p.name);
      const project = p.name.includes("—") ? p.name.split("—").slice(1).join("—").trim() : p.name;
      for (const t of p.tasks ?? []) {
        if (t.done || !t.due) continue;
        if (t.due === today) items.push({ client, project, title: t.title, due: t.due, kind: "today" });
        else if (t.due < today) items.push({ client, project, title: t.title, due: t.due, kind: "overdue" });
      }
      if (p.deadline === today) {
        items.push({ client, project, title: `PROJECT DEADLINE: ${project}`, due: p.deadline, kind: "deadline" });
      }
    }

    // Group by client, clients with overdue items first.
    const byClient = new Map<string, ClientWorkItem[]>();
    for (const item of items) {
      byClient.set(item.client, [...(byClient.get(item.client) ?? []), item]);
    }
    const groups = [...byClient.entries()]
      .map(([client, rows]) => ({
        client,
        rows: rows.sort((a, b) => (a.kind === "overdue" ? -1 : b.kind === "overdue" ? 1 : 0)),
        hasOverdue: rows.some((r) => r.kind === "overdue"),
      }))
      .sort((a, b) => Number(b.hasOverdue) - Number(a.hasOverdue));

    const activeProjects = (cached.data.projects ?? []).filter((p) => p.status === "active").length;
    return NextResponse.json(
      { groups, activeProjects, ok: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { groups: [], activeProjects: 0, ok: false, error: String(err) },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
