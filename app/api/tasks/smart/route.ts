// Natural-language task search (guide §5.4): "what should I do this morning?"
import { NextResponse } from "next/server";
import { aiAvailable, llmJson } from "@/lib/ai/llm";
import { getStore } from "@/lib/store";

export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });
  const tasks = await getStore().listTasks(false);

  if (!aiAvailable()) {
    const q = String(query).toLowerCase();
    const ids = tasks
      .filter((t) => (t.title + " " + (t.description ?? "") + " " + t.tags.join(" ")).toLowerCase().includes(q))
      .map((t) => t.id);
    return NextResponse.json({ ids, source: "keyword" });
  }

  const list = tasks
    .map((t) => `${t.id} | ${t.urgency} | key=${t.key} | ${t.title} | tags: ${t.tags.join(",")}`)
    .join("\n");
  const result = await llmJson<{ ids: string[] }>(
    `You pick tasks matching a natural-language query. Given a task list (one per line: id | urgency | key | title | tags), return {"ids": [...]} — matching task ids in the order they should be tackled. Return at most 8.`,
    `Query: ${query}\n\nTasks:\n${list}`,
    512,
  );
  const valid = new Set(tasks.map((t) => t.id));
  const ids = (result?.data.ids ?? []).filter((id) => valid.has(id)); // never trust hallucinated ids (guide §4)
  return NextResponse.json({ ids, source: result?.source ?? "none" });
}
