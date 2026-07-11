import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includeDone = url.searchParams.get("status") === "all";
  const tasks = await getStore().listTasks(includeDone);
  return NextResponse.json({ tasks }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const task = await getStore().createTask(body);
  await getStore().addAudit("create", "task", task.id);
  return NextResponse.json({ task });
}
