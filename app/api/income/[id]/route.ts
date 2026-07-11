import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await getStore().deleteIncome(id);
  return NextResponse.json({ ok: true });
}
