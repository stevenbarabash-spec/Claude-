// Web capture form → same pipeline as Jarvis (guide §4.4).
import { NextResponse } from "next/server";
import { runCapturePipeline } from "@/lib/pipeline";

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const result = await runCapturePipeline(text.trim(), "web");
  return NextResponse.json(result);
}

export async function GET() {
  const { getStore } = await import("@/lib/store");
  const captures = await getStore().listCaptures(50);
  return NextResponse.json({ captures }, { headers: { "cache-control": "no-store" } });
}
