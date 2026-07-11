import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { Meal } from "@/lib/types";

// Replace the meal list for a given date (client owns the date key).
export async function POST(req: Request) {
  const { date, meals } = (await req.json()) as { date: string; meals: Meal[] };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Array.isArray(meals)) {
    return NextResponse.json({ error: "date + meals[] required" }, { status: 400 });
  }
  const log = await getStore().mergeLogNotes(date, { nutrition: { meals } });
  return NextResponse.json({ log });
}
