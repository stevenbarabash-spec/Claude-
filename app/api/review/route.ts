// Weekly review, stored on the Monday anchor of the week.
import { NextResponse } from "next/server";
import { localDateKey, weekAnchor } from "@/lib/dates";
import { getStore } from "@/lib/store";
import type { WeeklyReview } from "@/lib/types";

const EMPTY: WeeklyReview = {
  wins: "",
  slipped: "",
  open_loops: "",
  follow_ups: "",
  content_shipped: "",
  health_pattern: "",
  next_top3: "",
  sealed: false,
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const anchor = weekAnchor(url.searchParams.get("week") ?? localDateKey());
  const log = await getStore().getLog(anchor);
  return NextResponse.json(
    { anchor, review: log?.notes.review ?? EMPTY },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const body = await req.json();
  const anchor = weekAnchor(body.week ?? localDateKey());
  const review: WeeklyReview = { ...EMPTY, ...body.review };
  await getStore().mergeLogNotes(anchor, { review });
  return NextResponse.json({ anchor, review });
}
