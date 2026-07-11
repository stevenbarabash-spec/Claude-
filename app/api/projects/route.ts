import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const projects = await getStore().listProjects();
  return NextResponse.json({ projects }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const project = await getStore().createProject(body);
  await getStore().addAudit("create", "project", project.id);
  return NextResponse.json({ project });
}
