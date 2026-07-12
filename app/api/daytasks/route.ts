// Quick daily tasks with optional times — stored on the day's log so each day
// starts clean. Feeds the Tasks card and the day timeline.
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { DayTask } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

async function readTasks(date: string): Promise<DayTask[]> {
  const log = await getStore().getLog(date);
  return log?.notes.day_tasks ?? [];
}

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) return NextResponse.json({ error: "date=YYYY-MM-DD required" }, { status: 400 });
  return NextResponse.json({ tasks: await readTasks(date) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { date?: string; title?: string; time?: string | null };
  const date = body.date ?? "";
  const title = (body.title ?? "").trim();
  if (!DATE_RE.test(date) || !title) {
    return NextResponse.json({ error: "date + title required" }, { status: 400 });
  }
  const time = body.time && TIME_RE.test(body.time) ? body.time : null;
  const tasks = await readTasks(date);
  const task: DayTask = { id: crypto.randomUUID(), title, time, done: false };
  tasks.push(task);
  tasks.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  await getStore().mergeLogNotes(date, { day_tasks: tasks });
  return NextResponse.json({ task, tasks });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    date?: string;
    id?: string;
    patch?: { title?: string; time?: string | null; done?: boolean };
  };
  const date = body.date ?? "";
  if (!DATE_RE.test(date) || !body.id) {
    return NextResponse.json({ error: "date + id required" }, { status: 400 });
  }
  const tasks = await readTasks(date);
  const task = tasks.find((t) => t.id === body.id);
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  const patch = body.patch ?? {};
  if (typeof patch.title === "string" && patch.title.trim()) task.title = patch.title.trim();
  if ("time" in patch) task.time = patch.time && TIME_RE.test(patch.time) ? patch.time : null;
  if (typeof patch.done === "boolean") task.done = patch.done;
  tasks.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  await getStore().mergeLogNotes(date, { day_tasks: tasks });
  return NextResponse.json({ task, tasks });
}

export async function DELETE(req: Request) {
  const body = (await req.json()) as { date?: string; id?: string };
  const date = body.date ?? "";
  if (!DATE_RE.test(date) || !body.id) {
    return NextResponse.json({ error: "date + id required" }, { status: 400 });
  }
  const tasks = (await readTasks(date)).filter((t) => t.id !== body.id);
  await getStore().mergeLogNotes(date, { day_tasks: tasks });
  return NextResponse.json({ ok: true, tasks });
}
