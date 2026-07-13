// Quick daily tasks with optional times — stored on the day's log so each day
// starts clean. Feeds the Tasks card and the day timeline.
import { NextResponse } from "next/server";
import { recordHistory } from "@/lib/history";
import { materializeForDay } from "@/lib/routines";
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
  // Auto-add any recurring routines due today (trash Mon/Thu, etc.).
  const tasks = await materializeForDay(date);
  return NextResponse.json({ tasks }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { date?: string; title?: string; time?: string | null };
  const date = body.date ?? "";
  const title = (body.title ?? "").trim();
  if (!DATE_RE.test(date) || !title) {
    return NextResponse.json({ error: "date + title required" }, { status: 400 });
  }
  const time = body.time && TIME_RE.test(body.time) ? body.time : null;
  const before = await readTasks(date);
  const tasks = [...before];
  const task: DayTask = { id: crypto.randomUUID(), title, time, done: false };
  tasks.push(task);
  tasks.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  await getStore().mergeLogNotes(date, { day_tasks: tasks });
  await recordHistory({
    action: "create",
    resource: "day_tasks",
    resource_id: date,
    label: `Day task added: ${title}`,
    before,
    after: tasks,
  });
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
  const before = await readTasks(date);
  const tasks = JSON.parse(JSON.stringify(before)) as DayTask[];
  const task = tasks.find((t) => t.id === body.id);
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  const patch = body.patch ?? {};
  const wasDone = task.done;
  if (typeof patch.title === "string" && patch.title.trim()) task.title = patch.title.trim();
  if ("time" in patch) task.time = patch.time && TIME_RE.test(patch.time) ? patch.time : null;
  if (typeof patch.done === "boolean") task.done = patch.done;
  tasks.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  await getStore().mergeLogNotes(date, { day_tasks: tasks });
  await recordHistory({
    action: "update",
    resource: "day_tasks",
    resource_id: date,
    label:
      typeof patch.done === "boolean" && patch.done !== wasDone
        ? `Day task ${patch.done ? "checked off" : "reopened"}: ${task.title}`
        : `Day task edited: ${task.title}`,
    before,
    after: tasks,
  });
  return NextResponse.json({ task, tasks });
}

export async function DELETE(req: Request) {
  const body = (await req.json()) as { date?: string; id?: string };
  const date = body.date ?? "";
  if (!DATE_RE.test(date) || !body.id) {
    return NextResponse.json({ error: "date + id required" }, { status: 400 });
  }
  const before = await readTasks(date);
  const removed = before.find((t) => t.id === body.id);
  const tasks = before.filter((t) => t.id !== body.id);
  await getStore().mergeLogNotes(date, { day_tasks: tasks });
  if (removed) {
    await recordHistory({
      action: "delete",
      resource: "day_tasks",
      resource_id: date,
      label: `Day task deleted: ${removed.title}`,
      before,
      after: tasks,
    });
  }
  return NextResponse.json({ ok: true, tasks });
}
