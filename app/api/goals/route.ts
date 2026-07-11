// Goals live on a sentinel date so they never auto-clear (guide §5.7).
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { GOALS_SENTINEL_DATE, type GoalItem } from "@/lib/types";

export async function GET() {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  const goals = log?.notes.goals ?? { week: [], month: [] };
  return NextResponse.json({ goals }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const { scope, items } = (await req.json()) as { scope: "week" | "month"; items: GoalItem[] };
  if (!["week", "month"].includes(scope) || !Array.isArray(items)) {
    return NextResponse.json({ error: "scope + items[] required" }, { status: 400 });
  }
  const store = getStore();
  const log = await store.getLog(GOALS_SENTINEL_DATE);
  const goals = log?.notes.goals ?? { week: [], month: [] };
  goals[scope] = items;
  await store.mergeLogNotes(GOALS_SENTINEL_DATE, { goals });
  return NextResponse.json({ goals });
}
