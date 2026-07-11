import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

// The client sends its own date key so "today" is the USER's day, not the server's.
export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  const { done } = await req.json();
  if (!Array.isArray(done)) return NextResponse.json({ error: "done[] required" }, { status: 400 });
  const log = await getStore().mergeLogNotes(date, { habits: { done } });
  return NextResponse.json({ log });
}
