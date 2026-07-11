// The editable habit list, stored on the sentinel log so it never expires.
import { NextResponse } from "next/server";
import { getHabitDefs, slugify } from "@/lib/habits";
import { getStore } from "@/lib/store";
import { GOALS_SENTINEL_DATE, type HabitDef } from "@/lib/types";

export async function GET() {
  const habits = await getHabitDefs();
  return NextResponse.json({ habits }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!Array.isArray(body.habits)) {
    return NextResponse.json({ error: "habits[] required" }, { status: 400 });
  }
  const seen = new Set<string>();
  const habits: HabitDef[] = [];
  for (const h of body.habits) {
    const label = String(h.label ?? "").trim();
    if (!label) continue;
    let id = String(h.id ?? "").trim() || slugify(label);
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);
    habits.push({ id, label: label.slice(0, 60), category: String(h.category ?? "").trim().slice(0, 20) || "Habit" });
  }
  if (habits.length === 0 || habits.length > 20) {
    return NextResponse.json({ error: "1–20 habits required" }, { status: 400 });
  }
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { habit_defs: habits });
  return NextResponse.json({ habits });
}
