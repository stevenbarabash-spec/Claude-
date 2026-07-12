import { NextResponse } from "next/server";
import { buildNextUp } from "@/lib/nextup";

export async function GET() {
  const result = await buildNextUp(6);
  return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
}
