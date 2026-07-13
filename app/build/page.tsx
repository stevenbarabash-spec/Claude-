"use client";
// Build Console — request features from inside WARROOM. A PIN-gated request
// goes to the build pipeline (a GitHub issue the Claude app builds from), the
// log tracks status, and Revert rolls the live site back to the previous deploy.
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { BuildRequest } from "@/lib/types";
import { Panel } from "@/components/Panel";

const STATUS_STYLE: Record<BuildRequest["status"], string> = {
  requested: "warm",
  building: "cool",
  shipped: "ok",
  failed: "hot",
  reverted: "",
};

export default function BuildPage() {
  const [builds, setBuilds] = useState<BuildRequest[] | null>(null);
  const [text, setText] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api<{ builds: BuildRequest[] }>("/api/build").then((r) => setBuilds(r.builds)).catch(() => setBuilds([]));
  }
  useEffect(load, []);

  async function submit() {
    if (!text.trim() || busy) return;
    if (pin !== "1782") {
      setMsg("Enter your PIN (1782) to authorize a build.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ builds: BuildRequest[]; note?: string }>("/api/build", {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), pin }),
      });
      setBuilds(r.builds);
      setText("");
      setMsg(r.note ?? "Sent to the build pipeline. Watch the log below.");
    } catch (e) {
      setMsg(String(e));
    }
    setBusy(false);
  }

  async function revert() {
    if (pin !== "1782") {
      setMsg("Enter your PIN (1782) to authorize a revert.");
      return;
    }
    if (!confirm("Roll the LIVE site back to the previous deployment?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ ok: boolean; revertedTo?: string }>("/api/build/revert", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      setMsg(r.ok ? `Reverting live site to ${r.revertedTo}… it redeploys in ~1 min.` : "Revert failed.");
    } catch (e) {
      setMsg(`Revert: ${String(e)}`);
    }
    setBusy(false);
  }

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 900, margin: "0 auto" }}>
      <Panel idx="15" title="Build Console" right={<span className="chip hot">PIN-gated</span>}>
        <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 12 }}>
          Describe a feature or change in plain words. With your PIN it goes to the build pipeline and ships
          automatically — no need to open Claude Code. Use <span className="accent">Revert</span> to instantly roll the
          live site back if something goes wrong.
        </div>
        <textarea
          className="input"
          style={{ minHeight: 84 }}
          placeholder='e.g. "Add a card that shows my top 3 clients by revenue this month"'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ width: 100, flexShrink: 0 }}
          />
          <button className="btn primary" onClick={submit} disabled={busy || !text.trim()}>
            {busy ? "…" : "🛠 Build it"}
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn" style={{ color: "var(--hot)" }} onClick={revert} disabled={busy} title="Roll the live site back one deploy">
            ↩ Revert last deploy
          </button>
        </div>
        {msg && <div className="faint" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{msg}</div>}
      </Panel>

      <Panel idx="16" title="Build Log">
        {builds === null ? (
          <div className="faint" style={{ fontSize: 13 }}>Loading…</div>
        ) : builds.length === 0 ? (
          <div className="faint" style={{ fontSize: 13 }}>No builds requested yet.</div>
        ) : (
          <div className="stack" style={{ gap: 0 }}>
            {builds.map((b) => (
              <div key={b.id} className="spread" style={{ padding: "10px 0", borderBottom: "1px solid var(--border-soft)", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.45 }}>{b.text}</div>
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <span className="num faint" style={{ fontSize: 10.5 }}>{new Date(b.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    {b.issueUrl && (
                      <a className="chip" href={b.issueUrl} target="_blank" rel="noreferrer">issue →</a>
                    )}
                  </div>
                  {b.note && <div className="faint" style={{ fontSize: 10.5, marginTop: 3, lineHeight: 1.4 }}>{b.note}</div>}
                </div>
                <span className={`chip ${STATUS_STYLE[b.status]}`} style={{ flexShrink: 0 }}>{b.status}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
