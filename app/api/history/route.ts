import { NextResponse } from "next/server";
import { listHistory } from "@/lib/history";

export async function GET() {
  const events = await listHistory();
  return NextResponse.json({ events }, { headers: { "cache-control": "no-store" } });
}
