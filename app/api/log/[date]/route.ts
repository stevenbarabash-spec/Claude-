import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  const log = await getStore().getLog(date);
  return NextResponse.json({ log }, { headers: { "cache-control": "no-store" } });
}

// Merge simple per-day fields (today's focus, mood).
export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.focus === "string") patch.focus = body.focus;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  const log = await getStore().mergeLogNotes(date, patch);
  return NextResponse.json({ log });
}
