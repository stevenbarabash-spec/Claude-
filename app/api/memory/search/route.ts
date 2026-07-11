// Semantic memory search (guide §6). Falls back to keyword search without embeddings.
import { NextResponse } from "next/server";
import { embed } from "@/lib/ai/embed";
import { getStore } from "@/lib/store";

export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });
  const store = getStore();
  const vector = await embed(query);
  const results = vector
    ? await store.searchMemoryByVector(vector, 20)
    : await store.searchMemoryByText(query, 20);
  return NextResponse.json({
    results: results.map((r) => ({
      id: r.id,
      source_type: r.source_type,
      source_id: r.source_id,
      text: r.text,
      created_at: r.created_at,
    })),
    mode: vector ? "semantic" : "keyword",
  });
}
