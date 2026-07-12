import { NextResponse } from "next/server";
import { recordHistory } from "@/lib/history";
import { getStore } from "@/lib/store";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const patch = await req.json();
  const store = getStore();
  const before = (await store.listProjects()).find((p) => p.id === id) ?? null;
  const project = await store.updateProject(id, patch);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  await recordHistory({
    action: "update",
    resource: "project",
    resource_id: id,
    label: `Money project updated: ${project.name} (${project.status})`,
    before,
    after: project,
  });
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const before = (await store.listProjects()).find((p) => p.id === id);
  await store.deleteProject(id);
  if (before) {
    await recordHistory({
      action: "delete",
      resource: "project",
      resource_id: id,
      label: `Money project deleted: ${before.name}`,
      before,
      after: null,
    });
  }
  return NextResponse.json({ ok: true });
}
