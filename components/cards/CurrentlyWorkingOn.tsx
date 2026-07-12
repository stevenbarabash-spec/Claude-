"use client";
// Currently Working On — the live strip under the timeline. You pull tasks in
// from Next Up; each shows a blinking red-green status light and a running
// clock. Hit Done and it checks off at the source (client board / CRM / today's
// tasks) everywhere at once. "Stop" just removes it from the strip.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { WorkingItem } from "@/lib/types";
import { Panel } from "../Panel";

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
      {items === null ? (
        <div className="faint" style={{ fontSize: 13 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div className="faint" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Nothing in progress. Tap a task in <span className="accent">Next Up</span> to pull it here and start the clock.
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
