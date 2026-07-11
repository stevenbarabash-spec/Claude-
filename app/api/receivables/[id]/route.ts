import { NextResponse } from "next/server";
import { localDateKey } from "@/lib/dates";
import { getStore } from "@/lib/store";

// Marking a receivable paid also books the income entry — one tap, both ledgers.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const patch = await req.json();
  const store = getStore();

  if (patch.status === "paid") {
    const existing = (await store.listReceivables(true)).find((r) => r.id === id);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
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
      return NextResponse.json({ receivable, income: entry });
    }
  }

  const receivable = await store.updateReceivable(id, patch);
  if (!receivable) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ receivable });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await getStore().deleteReceivable(id);
  return NextResponse.json({ ok: true });
}
