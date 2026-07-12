import { NextResponse } from "next/server";
import { recordHistory } from "@/lib/history";
import { getStore } from "@/lib/store";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const patch = await req.json();
  const store = getStore();
  const before = await store.getTask(id);
  const task = await store.updateTask(id, patch);
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  const label =
    patch.completed_at && !before?.completed_at
      ? `Task completed: ${task.title}`
      : before?.completed_at && patch.completed_at === null
        ? `Task reopened: ${task.title}`
        : `Task updated: ${task.title}`;
  await recordHistory({
    action: "update",
    resource: "task",
    resource_id: id,
    label,
    before,
    after: task,
  });
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const before = await store.getTask(id);
  await store.deleteTask(id);
  if (before) {
    await recordHistory({
      action: "delete",
      resource: "task",
      resource_id: id,
      label: `Task deleted: ${before.title}`,
      before,
      after: null,
    });
  }
  return NextResponse.json({ ok: true });
}
