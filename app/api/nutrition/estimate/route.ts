// Meal text → macros (guide §5.5).
import { NextResponse } from "next/server";
import { aiAvailable, llmJson } from "@/lib/ai/llm";

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
  if (!aiAvailable()) {
    return NextResponse.json({ kcal: 500, p: 25, c: 50, f: 20, estimated: true, source: "default" });
  }
  const result = await llmJson<{ kcal: number; p: number; c: number; f: number }>(
    `Estimate calories and macros for a described meal. Return {"kcal": n, "p": grams protein, "c": grams carbs, "f": grams fat}. Round to whole numbers. Be realistic for typical portions.`,
    text,
    256,
  );
  if (!result) return NextResponse.json({ error: "estimate failed" }, { status: 502 });
  return NextResponse.json({ ...result.data, estimated: true, source: result.source });
}
