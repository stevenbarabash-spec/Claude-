// Given a food name + a target kcal, return plausible macros (guide §5.5).
import { NextResponse } from "next/server";
import { aiAvailable, llmJson } from "@/lib/ai/llm";

export async function POST(req: Request) {
  const { name, kcal } = await req.json();
  if (!name || typeof kcal !== "number") {
    return NextResponse.json({ error: "name + kcal required" }, { status: 400 });
  }
  if (!aiAvailable()) {
    // 30/45/25 split as a neutral default: kcal = 4p + 4c + 9f
    const p = Math.round((kcal * 0.3) / 4);
    const c = Math.round((kcal * 0.45) / 4);
    const f = Math.round((kcal * 0.25) / 9);
    return NextResponse.json({ p, c, f, source: "default" });
  }
  const result = await llmJson<{ p: number; c: number; f: number }>(
    `A food's calorie total was adjusted. Redistribute macros for that food at the new calorie target so that 4*p + 4*c + 9*f ≈ kcal, keeping the macro ratio typical for the food. Return {"p": n, "c": n, "f": n} in grams, whole numbers.`,
    `Food: ${name}\nTarget kcal: ${kcal}`,
    256,
  );
  if (!result) return NextResponse.json({ error: "redistribute failed" }, { status: 502 });
  return NextResponse.json({ ...result.data, source: result.source });
}
