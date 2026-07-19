import { NextResponse } from "next/server";
import { stopWorking } from "@/lib/working";

// Stop working on an item — banks the elapsed session onto the (client) task for
// time tracking, then removes it from the strip without marking it done.
export async function POST(req: Request) {
  const { key } = (await req.json()) as { key?: string };
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  return NextResponse.json({ items: await stopWorking(key) });
}
