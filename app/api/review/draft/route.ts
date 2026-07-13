import { NextResponse } from "next/server";
import { buildReviewDraft } from "@/lib/reviewDraft";

export async function POST() {
  const draft = await buildReviewDraft();
  return NextResponse.json({ draft });
}
