import { NextResponse } from "next/server";
import { listClientProjects, saveClientProjects } from "@/lib/clientProjects";
import type { ClientProject } from "@/lib/types";

const PATCHABLE: (keyof ClientProject)[] = [
  "name",
  "status",
  "progress",
  "phase",
  "deadline",
  "next_milestone",
  "team",
  "budget",
  "iterations",
  "tasks",
];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  const projects = await listClientProjects();
  const project = projects.find((p) => p.id === id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  for (const key of PATCHABLE) {
    if (key in body) (project as unknown as Record<string, unknown>)[key] = body[key];
  }
  project.updated_at = new Date().toISOString();
  await saveClientProjects(projects);
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const projects = await listClientProjects();
  await saveClientProjects(projects.filter((p) => p.id !== id));
  return NextResponse.json({ ok: true });
}
