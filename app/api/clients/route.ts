import { NextResponse } from "next/server";
import { listClientProjects, saveClientProjects } from "@/lib/clientProjects";
import type { ClientProject } from "@/lib/types";

export async function GET() {
  const projects = await listClientProjects();
  return NextResponse.json({ projects }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const projects = await listClientProjects();
  const now = new Date().toISOString();
  const project: ClientProject = {
    id: crypto.randomUUID(),
    name: String(body.name),
    status: body.status ?? "active",
    progress: Number(body.progress) || 0,
    phase: body.phase ?? null,
    deadline: body.deadline ?? null,
    next_milestone: body.next_milestone ?? null,
    team: Array.isArray(body.team) ? body.team : [],
    budget: body.budget ?? null,
    iterations: [],
    tasks: [],
    created_at: now,
    updated_at: now,
  };
  await saveClientProjects([project, ...projects]);
  return NextResponse.json({ project });
}
