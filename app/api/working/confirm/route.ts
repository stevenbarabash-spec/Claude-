import { NextResponse } from "next/server";
import { confirmWorking } from "@/lib/working";

export async function POST(req: Request) {
  const { key } = (await req.json()) as { key?: string };
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  return NextResponse.json({ items: await confirmWorking(key) });
}
