import { NextResponse } from "next/server";
import { addRoutine, listRoutines, removeRoutine } from "@/lib/routines";

const TIME_RE = /^\d{2}:\d{2}$/;

export async function GET() {
  return NextResponse.json({ routines: await listRoutines() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { title?: string; days?: number[]; time?: string | null };
  const title = (body.title ?? "").trim();
  const days = Array.isArray(body.days) ? body.days.filter((d) => d >= 0 && d <= 6) : [];
  if (!title || days.length === 0) {
    return NextResponse.json({ error: "title + at least one day required" }, { status: 400 });
  }
  const time = body.time && TIME_RE.test(body.time) ? body.time : null;
  return NextResponse.json({ routines: await addRoutine({ title, days, time }) });
}

export async function DELETE(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  return NextResponse.json({ routines: await removeRoutine(id) });
}
