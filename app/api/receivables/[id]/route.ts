import { NextResponse } from "next/server";
import { localDateKey } from "@/lib/dates";
import { recordHistory } from "@/lib/history";
import { getStore } from "@/lib/store";

// Marking a receivable paid also books the income entry — one tap, both ledgers.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const patch = await req.json();
  const store = getStore();
  const existing = (await store.listReceivables(true)).find((r) => r.id === id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (patch.status === "paid") {
    if (existing.status !== "paid") {
      const today = localDateKey();
      const receivable = await store.updateReceivable(id, { status: "paid", paid_at: today });
      const entry = await store.addIncome({
        date: today,
        source: `${existing.client}${existing.description ? ` — ${existing.description}` : ""}`,
        project_id: existing.project_id,
        amount: existing.amount,
        currency: existing.currency,
        kind: "project",
      });
      await store.addAudit("paid", "receivable", id, { amount: existing.amount, income_id: entry.id });
      await recordHistory({
        action: "update",
        resource: "receivable",
        resource_id: id,
        label: `Marked paid: $${existing.amount.toLocaleString()} from ${existing.client}`,
        before: existing,
        after: receivable,
      });
      await recordHistory({
        action: "create",
        resource: "income",
        resource_id: entry.id,
        label: `Income booked: $${entry.amount.toLocaleString()} from ${entry.source}`,
        before: null,
        after: entry,
      });
      return NextResponse.json({ receivable, income: entry });
    }
  }

  const receivable = await store.updateReceivable(id, patch);
  if (!receivable) return NextResponse.json({ error: "not found" }, { status: 404 });
  await recordHistory({
    action: "update",
    resource: "receivable",
    resource_id: id,
    label: `Receivable updated: $${receivable.amount.toLocaleString()} from ${receivable.client} (${receivable.status})`,
    before: existing,
    after: receivable,
  });
  return NextResponse.json({ receivable });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const before = (await store.listReceivables(true)).find((r) => r.id === id);
  await store.deleteReceivable(id);
  if (before) {
    await recordHistory({
      action: "delete",
      resource: "receivable",
      resource_id: id,
      label: `Receivable deleted: $${before.amount.toLocaleString()} from ${before.client}`,
      before,
      after: null,
    });
  }
  return NextResponse.json({ ok: true });
}
