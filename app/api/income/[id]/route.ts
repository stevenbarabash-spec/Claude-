import { NextResponse } from "next/server";
import { recordHistory } from "@/lib/history";
import { getStore } from "@/lib/store";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.source === "string") patch.source = body.source;
  if (typeof body.amount === "number") patch.amount = body.amount;
  if (typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) patch.date = body.date;
  if (typeof body.kind === "string") patch.kind = body.kind;
  const store = getStore();
  const before = (await store.listIncome(36)).find((e) => e.id === id) ?? null;
  const entry = await store.updateIncome(id, patch);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  await recordHistory({
    action: "update",
    resource: "income",
    resource_id: id,
    label: `Income updated: $${entry.amount.toLocaleString()} from ${entry.source}`,
    before,
    after: entry,
  });
  return NextResponse.json({ entry });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const before = (await store.listIncome(36)).find((e) => e.id === id);
  await store.deleteIncome(id);
  if (before) {
    await recordHistory({
      action: "delete",
      resource: "income",
      resource_id: id,
      label: `Income deleted: $${before.amount.toLocaleString()} from ${before.source}`,
      before,
      after: null,
    });
  }
  return NextResponse.json({ ok: true });
}
