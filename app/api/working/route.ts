import { NextResponse } from "next/server";
import { addWorking, listWorking, removeWorking } from "@/lib/working";
import type { WorkingItem } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ items: await listWorking() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<WorkingItem>;
  if (!body.key || !body.title || !body.source || !body.taskId) {
    return NextResponse.json({ error: "key, title, source, taskId required" }, { status: 400 });
  }
  const items = await addWorking({
    key: body.key,
    source: body.source,
    title: body.title,
    who: body.who ?? null,
    href: body.href ?? "/",
    taskId: body.taskId,
    projectId: body.projectId,
    date: body.date,
  });
  return NextResponse.json({ items });
}

export async function DELETE(req: Request) {
  const { key } = (await req.json()) as { key?: string };
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  return NextResponse.json({ items: await removeWorking(key) });
}
