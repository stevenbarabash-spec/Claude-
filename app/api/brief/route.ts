// Read-only status-brief feed for an external assistant. Reads the same live
// client-project data the dashboard uses. Auth via BRIEF_API_KEY, accepted as
// "Authorization: Bearer <token>" or "?key=<token>". No writes are possible here.
import { NextResponse } from "next/server";
import { clientOf, listClientProjects, projectOf } from "@/lib/clientProjects";
import type { ClientProject } from "@/lib/types";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const configured = process.env.BRIEF_API_KEY;
  if (!configured) return false; // not configured → deny (never expose data)
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("key");
  const header = req.headers.get("authorization") ?? "";
  const fromBearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return fromQuery === configured || fromBearer === configured;
}

// active → in progress · paused → blocked · done → done · (else) not started.
function projectStatus(p: ClientProject): string {
  if (p.status === "done") return "done";
  if (p.status === "paused") return "blocked";
  const started = (p.progress ?? 0) > 0 || p.tasks.some((t) => t.done);
  return started ? "in progress" : "not started";
}

function projectNotes(p: ClientProject): string {
  const parts: string[] = [];
  if (p.phase) parts.push(`Phase: ${p.phase}`);
  if (p.next_milestone) parts.push(`Next: ${p.next_milestone}`);
  if (p.budget) parts.push(`Budget: ${p.budget}`);
  const last = p.iterations?.at(-1);
  if (last) parts.push(`Latest (${last.date}): ${last.note}`);
  if (p.tasks.length) {
    const done = p.tasks.filter((t) => t.done).length;
    const open = p.tasks.filter((t) => !t.done).map((t) => (t.due ? `${t.title} (due ${t.due})` : t.title));
    parts.push(`Tasks ${done}/${p.tasks.length} done${open.length ? ` · open: ${open.join("; ")}` : ""}`);
  }
  return parts.join(" · ");
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const projects = await listClientProjects();
  const byClient = new Map<string, ClientProject[]>();
  for (const p of projects) {
    const c = clientOf(p.name);
    byClient.set(c, [...(byClient.get(c) ?? []), p]);
  }

  const clients = [...byClient.entries()].map(([name, ps]) => ({
    name,
    status: ps.some((p) => p.status === "active") ? "active" : ps.some((p) => p.status === "paused") ? "paused" : "done",
    projects: ps.map((p) => ({
      name: projectOf(p.name),
      status: projectStatus(p),
      priority: null as string | null, // not tracked at project level
      dueDate: p.deadline ?? null,
      percentComplete: typeof p.progress === "number" ? p.progress : null,
      notes: projectNotes(p),
      lastUpdated: p.updated_at ?? null,
    })),
  }));

  return NextResponse.json(
    { generatedAt: new Date().toISOString(), clients },
    { headers: { "cache-control": "no-store" } },
  );
}
