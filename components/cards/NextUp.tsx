"use client";
// Next Up — one button that ranks everything you owe (client work + CRM +
// today's tasks) by what's due and what matters, and tells you what to do
// next. Hybrid: instant scoring, sharpened by Claude's sequencing + reasons.
import { useState } from "react";
import { api, fmtTime12 } from "@/lib/client";
import { Panel } from "../Panel";

interface NextItem {
  id: string;
  source: "client" | "crm" | "day";
  title: string;
  who: string | null;
  due: string | null;
  when: string | null;
  reason: string;
  href: string;
  taskId: string;
  projectId?: string;
  date?: string;
}
interface Result {
  items: NextItem[];
  headline: string | null;
  ai: boolean;
  generatedAt: string;
}

const SOURCE_LABEL: Record<NextItem["source"], string> = {
  client: "client work",
  crm: "CRM",
  day: "today",
};

// Overdue / due today / due tomorrow = red (act now). This week = yellow.
function reasonColor(reason: string): string {
  if (/overdue|was due|due today|tomorrow/.test(reason)) return "var(--hot)";
  if (/due in \d+ days?|this week|due \d/.test(reason)) return "var(--warm)";
  return "var(--text-dim)";
}

export function NextUp() {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    try {
      const r = await api<Result>("/api/next");
      setResult(r);
    } catch {
      setResult({ items: [], headline: "Couldn't build the list — try again.", ai: false, generatedAt: "" });
    }
    setBusy(false);
  }

  // Pull a suggestion into "Currently Working On".
  async function startWorking(it: NextItem) {
    setStarting(it.id);
    await api("/api/working", {
      method: "POST",
      body: JSON.stringify({
        key: it.id,
        source: it.source,
        title: it.title,
        who: it.who,
        href: it.href,
        taskId: it.taskId,
        projectId: it.projectId,
        date: it.date,
      }),
    }).catch(() => {});
    setStarting(null);
    // Drop it from the list and tell the working card to refresh.
    setResult((r) => (r ? { ...r, items: r.items.filter((x) => x.id !== it.id) } : r));
    window.dispatchEvent(new CustomEvent("jarvis:capture"));
  }

  return (
    <Panel
      idx="11"
      title="Next Up"
      right={
        <button className="btn small primary" onClick={run} disabled={busy}>
          {busy ? "thinking…" : result ? "↻ refresh" : "what's next?"}
        </button>
      }
    >
      {result === null ? (
        <div className="faint" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Tap <span className="accent">what&apos;s next?</span> and I&apos;ll rank everything you owe — client work,
          CRM follow-ups, and today&apos;s tasks — by what&apos;s due and what matters, then tell you where to start.
        </div>
      ) : result.items.length === 0 ? (
        <div className="faint" style={{ fontSize: 13 }}>{result.headline ?? "Nothing open. Clear runway."}</div>
      ) : (
        <div className="stack" style={{ gap: 0 }}>
          {result.headline && (
            <div style={{ fontSize: 13.5, lineHeight: 1.5, marginBottom: 12, color: "var(--text)" }}>
              {result.headline}
            </div>
          )}
          {result.items.map((it, i) => (
            <div
              key={it.id}
              className="row"
              style={{ gap: 11, padding: "10px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start" }}
            >
              <span
                className="num"
                style={{
                  fontSize: 13,
                  width: 20,
                  flexShrink: 0,
                  color: i === 0 ? "var(--accent)" : "var(--text-faint)",
                  fontWeight: i === 0 ? 700 : 400,
                }}
              >
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>{it.title}</div>
                <div className="row" style={{ gap: 7, marginTop: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: reasonColor(it.reason), fontWeight: /overdue|was due|due today|tomorrow/.test(it.reason) ? 600 : 400 }}>
                    {it.reason}
                  </span>
                  <span className="faint" style={{ fontSize: 10, fontFamily: "var(--mono)" }}>
                    {it.who ? `${it.who.toUpperCase()} · ` : ""}
                    {SOURCE_LABEL[it.source].toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                className="btn small primary"
                style={{ flexShrink: 0 }}
                disabled={starting === it.id}
                onClick={() => startWorking(it)}
                title="Pull into Currently Working On"
              >
                {starting === it.id ? "…" : "work on"}
              </button>
            </div>
          ))}
          <div className="faint" style={{ fontSize: 10, fontFamily: "var(--mono)", marginTop: 10 }}>
            {result.ai ? "SEQUENCED BY JARVIS" : "RANKED BY DUE DATE + PRIORITY"}
            {result.generatedAt ? ` · ${fmtTime12(new Date(result.generatedAt))}` : ""}
          </div>
        </div>
      )}
    </Panel>
  );
}
