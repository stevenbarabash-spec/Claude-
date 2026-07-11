"use client";
// Brain tab (guide §6): search everything you've ever captured, plus the raw
// capture stream so you can see what Jarvis filed and where.
import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { api } from "@/lib/client";
import type { RawCapture } from "@/lib/types";

interface MemoryHit {
  id: string;
  source_type: string;
  source_id: string;
  text: string;
  created_at: string;
}

export default function BrainPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryHit[] | null>(null);
  const [mode, setMode] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [captures, setCaptures] = useState<RawCapture[]>([]);

  useEffect(() => {
    api<{ captures: RawCapture[] }>("/api/capture")
      .then((r) => setCaptures(r.captures))
      .catch(() => {});
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ results: MemoryHit[]; mode: string }>("/api/memory/search", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      setResults(r.results);
      setMode(r.mode);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 900, margin: "0 auto" }}>
      <form className="row" onSubmit={search}>
        <input
          className="input"
          style={{ fontSize: 15, padding: "13px 16px" }}
          placeholder='Ask your memory — "that idea I had at the gym in March"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn primary" disabled={busy}>{busy ? "…" : "Search"}</button>
      </form>

      {results && (
        <Panel title="Matches" right={<span>{mode} · {results.length}</span>}>
          <div className="stack">
            {results.map((r) => (
              <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{r.text}</div>
                <div className="label" style={{ marginTop: 5, fontSize: 9 }}>
                  {r.source_type} · {r.created_at.slice(0, 10)}
                </div>
              </div>
            ))}
            {results.length === 0 && <div className="faint">Nothing matched. Memory builds as you capture.</div>}
          </div>
        </Panel>
      )}

      <Panel title="Capture Stream" right={<span>{captures.length} recent</span>}>
        <div className="stack">
          {captures.map((c) => (
            <div key={c.id} className="spread" style={{ padding: "9px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5 }}>{c.raw_text}</div>
                <div className="label" style={{ marginTop: 4, fontSize: 9 }}>
                  {c.created_at.slice(0, 16).replace("T", " ")} · via {c.source} · llm {c.llm_source ?? "—"}
                </div>
              </div>
              <div className="row" style={{ flexShrink: 0 }}>
                <span className="chip">{c.classification?.kind ?? "raw"}</span>
                <span className="chip ok">{(c.routed_to ?? "").replace("daily_logs.", "")}</span>
              </div>
            </div>
          ))}
          {captures.length === 0 && (
            <div className="faint" style={{ fontSize: 13 }}>
              Nothing captured yet. Open Jarvis (bottom right) and say something.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
