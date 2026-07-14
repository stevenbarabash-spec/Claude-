import { NextResponse } from "next/server";
import { listClientProjects, saveClientProjects } from "@/lib/clientProjects";
import { recordHistory } from "@/lib/history";
import type { ClientProject } from "@/lib/types";

// Move a single task from one project to another in one atomic save. Used by the
// client board when a task lands under the wrong project (or arrives via Siri and
// needs reslotting). Keeps the task's id/title/due/done intact.
export async function POST(req: Request) {
  const body = (await req.json()) as { taskId?: string; fromProjectId?: string; toProjectId?: string };
  const { taskId, fromProjectId, toProjectId } = body;
  if (!taskId || !fromProjectId || !toProjectId) {
    return NextResponse.json({ error: "taskId, fromProjectId, toProjectId required" }, { status: 400 });
  }
  if (fromProjectId === toProjectId) return NextResponse.json({ error: "same project" }, { status: 400 });

  const projects = await listClientProjects();
  const from = projects.find((p) => p.id === fromProjectId);
  const to = projects.find((p) => p.id === toProjectId);
  if (!from || !to) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const task = from.tasks.find((t) => t.id === taskId);
  if (!task) return NextResponse.json({ error: "task not found" }, { status: 404 });

  const beforeFrom = JSON.parse(JSON.stringify(from)) as ClientProject;
  const beforeTo = JSON.parse(JSON.stringify(to)) as ClientProject;
  const now = new Date().toISOString();
  from.tasks = from.tasks.filter((t) => t.id !== taskId);
  to.tasks = [...to.tasks, task];
  from.updated_at = now;
  to.updated_at = now;
  await saveClientProjects(projects);

  const fromClient = beforeFrom.name.split("—")[0].trim();
  const toClient = beforeTo.name.split("—")[0].trim();
  await recordHistory({
    action: "update",
    resource: "client_project",
    resource_id: toProjectId,
    label: `Task moved: ${task.title} (${fromClient} → ${toClient})`,
    before: beforeTo,
    after: to,
  });

  return NextResponse.json({ ok: true, projects });
}
