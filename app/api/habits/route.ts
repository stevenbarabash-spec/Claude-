import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.min(90, Number(url.searchParams.get("days") ?? 30));
  const logs = await getStore().listLogs(days + 5);
  const habits = logs
    .filter((l) => l.notes.habits)
    .map((l) => ({ date: l.log_date, done: l.notes.habits!.done }));
  return NextResponse.json({ habits }, { headers: { "cache-control": "no-store" } });
}
