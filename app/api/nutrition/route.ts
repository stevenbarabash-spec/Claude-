import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(90, Number(url.searchParams.get("days") ?? 30));
  const logs = await getStore().listLogs(days + 5);
  const rows = logs
    .filter((l) => l.notes.nutrition?.meals?.length)
    .map((l) => ({ date: l.log_date, meals: l.notes.nutrition!.meals }));
  return NextResponse.json({ days: rows }, { headers: { "cache-control": "no-store" } });
}
