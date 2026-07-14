"use client";
// Header ticker — live market quotes (editable watchlist) + rotating news
// headlines, shown under the date on the Session card. Polls every 3 minutes.
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { TickerSymbol } from "@/lib/types";

interface Quote {
  symbol: string;
  label: string;
  price: number | null;
  changePct: number | null;
  currency: string;
}
interface Headline {
  title: string;
  source: string;
  link: string;
}
interface Feed {
  quotes: Quote[];
  news: Headline[];
  symbols: TickerSymbol[];
}

function fmtPrice(q: Quote): string {
  if (q.price == null) return "—";
  const prefix = q.symbol.startsWith("^") ? "" : "$";
  const digits = q.price >= 100 ? 0 : q.price >= 1 ? 2 : 4;
  return prefix + q.price.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function Ticker() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [newsIdx, setNewsIdx] = useState(0);
  const [adding, setAdding] = useState(false);
  const [manage, setManage] = useState(false);
  const [sym, setSym] = useState("");
  const [label, setLabel] = useState("");

  function load() {
    api<Feed>("/api/ticker").then(setFeed).catch(() => setFeed({ quotes: [], news: [], symbols: [] }));
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 180_000); // 3 min
    return () => clearInterval(t);
  }, []);

  // Rotate the headline every 6s.
  useEffect(() => {
    if (!feed?.news.length) return;
    const t = setInterval(() => setNewsIdx((i) => (i + 1) % feed.news.length), 6000);
    return () => clearInterval(t);
  }, [feed?.news.length]);

  async function addSymbol(e: React.FormEvent) {
    e.preventDefault();
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setSym("");
    setLabel("");
    setAdding(false);
    await api("/api/ticker", { method: "POST", body: JSON.stringify({ symbol: s, label: label.trim() }) }).catch(() => {});
    load();
  }

  async function removeSymbol(symbol: string) {
    await api("/api/ticker", { method: "DELETE", body: JSON.stringify({ symbol }) }).catch(() => {});
    load();
  }

  if (!feed) return null;
  const headline = feed.news[newsIdx];

  return (
    <div
      className="ticker"
      style={{
        marginTop: 10,
        padding: "8px 10px",
        border: "1px solid var(--border-soft)",
        borderRadius: 8,
        background: "rgba(0,0,0,0.18)",
      }}
    >
      {/* Market chips */}
      <div className="row" style={{ gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        {feed.quotes.map((q) => {
          const up = (q.changePct ?? 0) >= 0;
          const color = q.changePct == null ? "var(--text-faint)" : up ? "var(--accent)" : "var(--hot)";
          return (
            <span key={q.symbol} className="row" style={{ gap: 6, position: "relative" }}>
              <span className="label" style={{ fontSize: 10 }}>{q.label}</span>
              <span className="num" style={{ fontSize: 12.5 }}>{fmtPrice(q)}</span>
              {q.changePct != null && (
                <span className="num" style={{ fontSize: 11, color }}>
                  {up ? "▲" : "▼"}{Math.abs(q.changePct).toFixed(2)}%
                </span>
              )}
              {manage && (
                <button
                  title="Remove"
                  onClick={() => removeSymbol(q.symbol)}
                  style={{ background: "transparent", border: "none", color: "var(--hot)", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}

        <span style={{ flex: 1 }} />

        {adding ? (
          <form className="row" style={{ gap: 6 }} onSubmit={addSymbol}>
            <input className="input" style={{ width: 96, padding: "3px 7px", fontSize: 11 }} placeholder="Symbol (AAPL)" value={sym} onChange={(e) => setSym(e.target.value)} autoFocus />
            <input className="input" style={{ width: 96, padding: "3px 7px", fontSize: 11 }} placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <button className="btn small">add</button>
            <button type="button" className="btn small" onClick={() => setAdding(false)}>×</button>
          </form>
        ) : (
          <span className="row" style={{ gap: 4 }}>
            <button className="btn small" title="Add a ticker" onClick={() => setAdding(true)} style={{ padding: "2px 8px" }}>＋ ticker</button>
            <button className="btn small" title="Edit watchlist" onClick={() => setManage((m) => !m)} style={{ padding: "2px 8px" }}>{manage ? "done" : "✎"}</button>
          </span>
        )}
      </div>

      {/* Rotating news headline */}
      {headline && (
        <div className="row" style={{ gap: 8, marginTop: 7, paddingTop: 7, borderTop: "1px solid var(--border-soft)", alignItems: "baseline", minWidth: 0 }}>
          <span className="label accent" style={{ fontSize: 9, flexShrink: 0 }}>NEWS</span>
          <a
            href={headline.link}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 12, color: "var(--text)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
            title={headline.title}
          >
            {headline.title}
            {headline.source && <span className="faint" style={{ fontSize: 10.5 }}> · {headline.source}</span>}
          </a>
          <span className="num faint" style={{ fontSize: 9.5, flexShrink: 0 }}>{newsIdx + 1}/{feed.news.length}</span>
        </div>
      )}
    </div>
  );
}
