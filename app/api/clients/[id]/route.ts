import { NextResponse } from "next/server";
import { listClientProjects, saveClientProjects } from "@/lib/clientProjects";
import { localDateKey } from "@/lib/dates";
import { recordHistory } from "@/lib/history";
import { setDayTaskDoneByRef } from "@/lib/routines";
import type { ClientProject } from "@/lib/types";

const PATCHABLE: (keyof ClientProject)[] = [
  "name",
  "status",
  "progress",
  "phase",
  "deadline",
  "next_milestone",
  "team",
  "budget",
  "iterations",
  "tasks",
  "recurring",
];

// The most specific one-line description of what a patch actually did.
function describeChange(before: ClientProject, after: ClientProject): string {
  const client = before.name.split("—")[0].trim();
  for (const t of after.tasks) {
    const prev = before.tasks.find((x) => x.id === t.id);
    if (!prev) return `Client task added: ${t.title} (${client})`;
    if (prev.done !== t.done)
      return t.done
        ? `Client task checked off: ${t.title} (${client})`
        : `Client task reopened: ${t.title} (${client})`;
    if (prev.title !== t.title || prev.due !== t.due) return `Client task edited: ${t.title} (${client})`;
  }
  for (const prev of before.tasks) {
    if (!after.tasks.find((x) => x.id === prev.id)) return `Client task removed: ${prev.title} (${client})`;
  }
  if (after.iterations.length > before.iterations.length)
    return `Update logged on ${before.name}: ${after.iterations.at(-1)?.note.slice(0, 60) ?? ""}`;
  if (after.iterations.length < before.iterations.length) return `Update deleted on ${before.name}`;
  if (before.status !== after.status) return `Project marked ${after.status}: ${before.name}`;
  const changed = PATCHABLE.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  return `Project edited (${changed.join(", ") || "no changes"}): ${before.name}`;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const projects = await listClientProjects();
  const project = projects.find((p) => p.id === id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const before = JSON.parse(JSON.stringify(project)) as ClientProject;
  for (const key of PATCHABLE) {
    if (key in body) (project as unknown as Record<string, unknown>)[key] = body[key];
  }
  project.updated_at = new Date().toISOString();
  await saveClientProjects(projects);
  await recordHistory({
    action: "update",
    resource: "client_project",
    resource_id: id,
    label: describeChange(before, project),
    before,
    after: project,
  });
  // Reverse sync: if a task's done-state changed here, mirror it onto its
  // Section 10 copy (today) so checking off on the board updates Tasks · Today.
  for (const t of project.tasks) {
    const prev = before.tasks.find((x) => x.id === t.id);
    if (prev && prev.done !== t.done) {
      await setDayTaskDoneByRef(localDateKey(), `client:${t.id}`, t.done);
    }
  }
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projects = await listClientProjects();
  const before = projects.find((p) => p.id === id);
  await saveClientProjects(projects.filter((p) => p.id !== id));
  if (before) {
    await recordHistory({
      action: "delete",
      resource: "client_project",
      resource_id: id,
      label: `Project deleted: ${before.name}`,
      before,
      after: null,
    });
  }
  return NextResponse.json({ ok: true });
}
