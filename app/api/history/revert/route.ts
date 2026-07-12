import { NextResponse } from "next/server";
import { revertEvent } from "@/lib/history";

export async function POST(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const result = await revertEvent(id);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ ok: true, message: result.message });
}
