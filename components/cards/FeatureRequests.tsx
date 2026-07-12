"use client";
// Feature Enhancement Requests — a parking lot for ideas to improve the
// dashboard. Drop a note, cycle its status as you decide, delete when done.
// Both you and Jarvis can add here; it's stored server-side so it persists.
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { FeatureRequest } from "@/lib/types";
import { Panel } from "../Panel";

const STATUS_ORDER: FeatureRequest["status"][] = ["new", "considering", "planned", "passed"];
const STATUS_STYLE: Record<FeatureRequest["status"], string> = {
  new: "ok",
  considering: "warm",
  planned: "cool",
  passed: "",
};
const STATUS_LABEL: Record<FeatureRequest["status"], string> = {
  new: "new",
  considering: "considering",
  planned: "planned",
  passed: "passed",
};

export function FeatureRequests() {
  const [items, setItems] = useState<FeatureRequest[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api<{ items: FeatureRequest[] }>("/api/features").then((r) => setItems(r.items)).catch(() => setItems([]));
  }

  useEffect(() => {
    load();
    window.addEventListener("jarvis:capture", load);
    return () => window.removeEventListener("jarvis:capture", load);
  }, []);

  async function add() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    const r = await api<{ items: FeatureRequest[] }>("/api/features", {
      method: "POST",
      body: JSON.stringify({ text: t }),
    }).catch(() => null);
    setBusy(false);
    if (r) {
      setItems(r.items);
      setText("");
    }
  }

  async function cycle(f: FeatureRequest) {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(f.status) + 1) % STATUS_ORDER.length];
    const r = await api<{ items: FeatureRequest[] }>("/api/features", {
      method: "PATCH",
      body: JSON.stringify({ id: f.id, status: next }),
    }).catch(() => null);
    if (r) setItems(r.items);
  }

  async function remove(f: FeatureRequest) {
    const r = await api<{ items: FeatureRequest[] }>("/api/features", {
      method: "DELETE",
      body: JSON.stringify({ id: f.id }),
    }).catch(() => null);
    if (r) setItems(r.items);
  }

  const open = items?.filter((f) => f.status !== "passed").length ?? 0;

  return (
    <Panel
      idx="14"
      title="Feature Enhancement Requests"
      right={items && items.length > 0 ? <span>{open} open</span> : undefined}
    >
      <div className="row" style={{ marginBottom: 12 }}>
        <input
          className="input"
          placeholder="Drop an idea to improve the dashboard…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn primary" onClick={add} disabled={busy || !text.trim()}>
          Add
        </button>
      </div>

      {items === null ? (
        <div className="faint" style={{ fontSize: 13 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div className="faint" style={{ fontSize: 13, lineHeight: 1.6 }}>
          No ideas parked yet. Anything you or Jarvis want to improve later lands here — click a status chip to sort
          the keepers from the maybes.
        </div>
      ) : (
        <div className="stack" style={{ gap: 0 }}>
          {items.map((f) => (
            <div
              key={f.id}
              className="row"
              style={{ gap: 10, padding: "9px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start", opacity: f.status === "passed" ? 0.5 : 1 }}
            >
              <button
                className={`chip ${STATUS_STYLE[f.status]}`}
                onClick={() => cycle(f)}
                title="Click to change status"
                style={{ flexShrink: 0, cursor: "pointer" }}
              >
                {STATUS_LABEL[f.status]}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, lineHeight: 1.45, textDecoration: f.status === "passed" ? "line-through" : "none" }}>
                  {f.text}
                </div>
                {f.source === "claude" && (
                  <div className="faint" style={{ fontSize: 9.5, fontFamily: "var(--mono)", marginTop: 2 }}>
                    SUGGESTED BY JARVIS
                  </div>
                )}
              </div>
              <button className="faint" onClick={() => remove(f)} title="Delete" style={{ fontSize: 14, lineHeight: 1, padding: "0 2px", flexShrink: 0 }}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
