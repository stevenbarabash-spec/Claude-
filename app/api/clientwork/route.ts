// Client work due today — now reads the INTERNAL client board (single source
// of truth), so checking off a task reflects here instantly.
import { NextResponse } from "next/server";
import { clientOf, listClientProjects, projectOf } from "@/lib/clientProjects";
import { localDateKey } from "@/lib/dates";

export interface ClientWorkItem {
  client: string;
  project: string;
  title: string;
  due: string | null;
  kind: "overdue" | "today" | "deadline";
}

export async function GET() {
  const projects = await listClientProjects();
  const today = localDateKey();
  const items: ClientWorkItem[] = [];

  for (const p of projects) {
    if (p.status === "done") continue;
    const client = clientOf(p.name);
    const project = projectOf(p.name);
    for (const t of p.tasks) {
      if (t.done || !t.due) continue;
      if (t.due === today) items.push({ client, project, title: t.title, due: t.due, kind: "today" });
      else if (t.due < today) items.push({ client, project, title: t.title, due: t.due, kind: "overdue" });
    }
    if (p.deadline === today) {
      items.push({ client, project, title: `PROJECT DEADLINE: ${project}`, due: p.deadline, kind: "deadline" });
    }
  }

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

  const activeProjects = projects.filter((p) => p.status === "active").length;
  return NextResponse.json(
    { groups, activeProjects, ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
