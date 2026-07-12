"use client";
// Currently Working On — the live strip under the timeline. You pull tasks in
// from Next Up; each shows a blinking red-green status light and a running
// clock. Hit Done and it checks off at the source (client board / CRM / today's
// tasks) everywhere at once. "Stop" just removes it from the strip.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, debounce } from "@/lib/client";
import type { Task, WorkingItem } from "@/lib/types";
import { Panel } from "../Panel";

interface SearchHit {
  key: string;
  source: WorkingItem["source"];
  title: string;
  who: string | null;
  href: string;
  taskId: string;
  projectId?: string;
  date?: string;
}

const SOURCE_LABEL: Record<WorkingItem["source"], string> = {
  client: "client work",
  crm: "CRM",
  day: "today",
};

function elapsed(startedAt: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

export function CurrentlyWorkingOn() {
  const [items, setItems] = useState<WorkingItem[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [adding, setAdding] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // While the results dropdown is open, lift the whole card above its
  // neighbors so the dropdown isn't trapped behind them (backdrop-filter
  // gives each card its own stacking context).
  useEffect(() => {
    const wrap = searchRef.current?.closest(".card-wrap");
    if (!wrap) return;
    wrap.classList.toggle("raised", query.trim().length >= 2);
    return () => wrap.classList.remove("raised");
  }, [query]);

  function load() {
    api<{ items: WorkingItem[] }>("/api/working").then((r) => setItems(r.items)).catch(() => setItems([]));
  }

  useEffect(() => {
    load();
    window.addEventListener("jarvis:capture", load);
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.removeEventListener("jarvis:capture", load);
      clearInterval(t);
    };
  }, []);

  const runSearch = useRef(
    debounce((q: string) => {
      if (q.trim().length < 2) {
        setHits([]);
        return;
      }
      api<{ results: SearchHit[] }>(`/api/working/search?q=${encodeURIComponent(q)}`)
        .then((r) => setHits(r.results))
        .catch(() => setHits([]));
    }, 250),
  ).current;

  function onQuery(q: string) {
    setQuery(q);
    runSearch(q);
  }

  async function pull(hit: SearchHit) {
    setAdding(true);
    const r = await api<{ items: WorkingItem[] }>("/api/working", {
      method: "POST",
      body: JSON.stringify(hit),
    }).catch(() => null);
    setAdding(false);
    if (r) {
      setItems(r.items);
      setQuery("");
      setHits([]);
      window.dispatchEvent(new CustomEvent("jarvis:capture"));
    }
  }

  // Create a brand-new task and immediately start working on it.
  async function createAndStart() {
    const title = query.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const t = await api<{ task: Task }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title, urgency: "today" }),
      });
      const r = await api<{ items: WorkingItem[] }>("/api/working", {
        method: "POST",
        body: JSON.stringify({ key: `crm:${t.task.id}`, source: "crm", title, who: null, href: "/crm", taskId: t.task.id }),
      });
      setItems(r.items);
      setQuery("");
      setHits([]);
      window.dispatchEvent(new CustomEvent("jarvis:capture"));
    } catch {
      /* leave the text so nothing is lost */
    }
    setAdding(false);
  }

  async function done(item: WorkingItem) {
    setBusy(item.key);
    const r = await api<{ items: WorkingItem[] }>("/api/working/done", {
      method: "POST",
      body: JSON.stringify({ key: item.key }),
    }).catch(() => null);
    setBusy(null);
    if (r) {
      setItems(r.items);
      window.dispatchEvent(new CustomEvent("jarvis:capture")); // sync board, next up, history
    }
  }

  async function stop(item: WorkingItem) {
    const r = await api<{ items: WorkingItem[] }>("/api/working", {
      method: "DELETE",
      body: JSON.stringify({ key: item.key }),
    }).catch(() => null);
    if (r) setItems(r.items);
  }

  return (
    <Panel
      idx="13"
      title="Currently Working On"
      right={items && items.length > 0 ? <span className="chip ok">{items.length} active</span> : undefined}
    >
      {/* Search existing tasks or create a new one to start on */}
      <div ref={searchRef} style={{ position: "relative", marginBottom: items && items.length ? 12 : 8 }}>
        <input
          className="input"
          placeholder="Search a task (e.g. “newsletter BYTOX”) or type a new one…"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (hits[0]) pull(hits[0]);
              else createAndStart();
            }
          }}
        />
        {query.trim().length >= 2 && (
          <div className="work-results">
            {hits.map((h) => (
              <button key={h.key} className="work-result" onClick={() => pull(h)} disabled={adding}>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</span>
                <span className="faint" style={{ fontSize: 9.5, fontFamily: "var(--mono)", flexShrink: 0 }}>
                  {h.who ? `${h.who.toUpperCase()} · ` : ""}
                  {h.source === "client" ? "CLIENT" : h.source === "crm" ? "CRM" : "TODAY"}
                </span>
              </button>
            ))}
            <button className="work-result work-create" onClick={createAndStart} disabled={adding}>
              ➕ Create &amp; start: <span style={{ color: "var(--accent)" }}>&ldquo;{query.trim()}&rdquo;</span>
            </button>
          </div>
        )}
      </div>

      {items === null ? (
        <div className="faint" style={{ fontSize: 13 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div className="faint" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Nothing in progress. Search above, or tap a task in <span className="accent">Next Up</span> to start the clock.
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {items.map((it) => (
            <div
              key={it.key}
              className="row"
              style={{
                gap: 11,
                padding: "11px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.02)",
                alignItems: "flex-start",
              }}
            >
              <span className="status-live" style={{ marginTop: 4 }} title="In progress" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={it.href} style={{ fontSize: 14, lineHeight: 1.4, display: "block" }}>
                  {it.title}
                </Link>
                <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <span className="faint" style={{ fontSize: 10, fontFamily: "var(--mono)" }}>
                    {it.who ? `${it.who.toUpperCase()} · ` : ""}
                    {SOURCE_LABEL[it.source].toUpperCase()}
                  </span>
                  <span className="num" style={{ fontSize: 10.5, color: "var(--accent)" }}>
                    ● {elapsed(it.startedAt, now)}
                  </span>
                </div>
              </div>
              <div className="stack" style={{ gap: 5, flexShrink: 0 }}>
                <button className="btn small primary" disabled={busy === it.key} onClick={() => done(it)}>
                  {busy === it.key ? "…" : "✓ done"}
                </button>
                <button className="btn small" onClick={() => stop(it)} title="Remove without completing">
                  stop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
