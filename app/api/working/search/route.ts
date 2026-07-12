// Search every open task (client board + CRM + today's tasks) to pull one into
// Currently Working On. Matches against the task title AND its client/entity,
// so "newsletter BYTOX" finds the BYTOX newsletter task.
import { NextResponse } from "next/server";
import { collectCandidates } from "@/lib/nextup";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] }, { headers: { "cache-control": "no-store" } });
  const tokens = q.split(/\s+/);
  const { items } = await collectCandidates();
  const results = items
    .filter((it) => {
      const hay = `${it.title} ${it.who ?? ""}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    })
    .slice(0, 8)
    .map((it) => ({
      key: it.id,
      source: it.source,
      title: it.title,
      who: it.who,
      href: it.href,
      taskId: it.taskId,
      projectId: it.projectId,
      date: it.date,
    }));
  return NextResponse.json({ results }, { headers: { "cache-control": "no-store" } });
}
