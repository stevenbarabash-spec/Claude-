"use client";
// Finance tab: hero metrics + asset breakdown + monthly snapshot history.
// Reads stored snapshots only — the AI pipeline runs solely via the refresh
// button or the daily cron (guide §5.8).
import { useEffect, useState } from "react";
import { Spark } from "@/components/cards/FinancePulse";
import { Panel } from "@/components/Panel";
import { api, fmtMoney } from "@/lib/client";
import type { FinanceSnapshot } from "@/lib/types";

type Snap = FinanceSnapshot & { date: string };

export default function FinancePage() {
  const [latest, setLatest] = useState<Snap | null>(null);
  const [monthly, setMonthly] = useState<Snap[]>([]);
  const [configured, setConfigured] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api<{ latest: Snap | null; monthly: Snap[]; configured: boolean }>("/api/finance")
      .then((r) => {
        setLatest(r.latest);
        setMonthly(r.monthly);
        setConfigured(r.configured);
      })
      .catch(() => {});
  }
  useEffect(load, []);

  async function refresh() {
    setRefreshing(true);
    setMsg(null);
    try {
      await api("/api/finance/snapshot", { method: "POST" });
      setMsg("Snapshot updated from your sheet.");
      load();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setRefreshing(false);
    }
  }

  const asc = [...monthly].reverse();
  const prev = asc.at(-2);
  const delta = latest && prev ? latest.net_worth - prev.net_worth : 0;
  const burn = prev && delta < 0 ? -delta : 0;
  const runway = latest && burn > 0 ? Math.floor(latest.liquid / burn) : null;

  const cat = (kind: "liquid" | "invested" | "liability") =>
    latest?.categories.filter((c) => c.kind === kind) ?? [];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="spread">
        <span className="label" style={{ fontSize: 12 }}>Finance</span>
        <div className="row">
          {msg && <span className="faint" style={{ fontSize: 12 }}>{msg}</span>}
          <button className="btn" onClick={refresh} disabled={refreshing || !configured}>
            {refreshing ? "Extracting…" : "↻ Refresh from sheet"}
          </button>
        </div>
      </div>

      {!configured && (
        <div className="panel" style={{ borderColor: "rgba(224,194,111,0.3)" }}>
          <span className="chip warm">setup</span>
          <p className="dim" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.7 }}>
            Connect your Google Sheet with a service account (never &ldquo;publish to web&rdquo;):
            create a project at console.cloud.google.com → enable Sheets API → create a service
            account + JSON key → share the sheet with the service account email as Viewer → set{" "}
            <span className="num">GOOGLE_SHEETS_FINANCE_ID</span>,{" "}
            <span className="num">GOOGLE_SERVICE_ACCOUNT_EMAIL</span> and{" "}
            <span className="num">GOOGLE_SERVICE_ACCOUNT_KEY</span>. Claude reads every tab and
            figures out your net worth — no labels needed.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16 }}>
        <Panel title="Net Worth · Live">
          {latest ? (
            <>
              <div className="big-num" style={{ fontSize: 38 }}>{fmtMoney(latest.net_worth, latest.currency)}</div>
              <div className="row" style={{ marginTop: 6 }}>
                <span className={`chip ${delta >= 0 ? "ok" : "hot"}`}>
                  {delta >= 0 ? "▲" : "▼"} {prev ? ((delta / prev.net_worth) * 100).toFixed(1) : "0"}% · 30D
                </span>
                <span className="faint num" style={{ fontSize: 11 }}>as of {latest.as_of}</span>
              </div>
              <Spark values={asc.map((m) => m.net_worth)} />
            </>
          ) : (
            <div className="faint">No snapshots yet.</div>
          )}
        </Panel>
        <Panel title="Runway">
          <div className="big-num">{runway !== null ? `${runway}` : "∞"}<span className="faint" style={{ fontSize: 14 }}> mo</span></div>
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>@ current burn · static</div>
        </Panel>
        <Panel title="Monthly Δ">
          <div className={`big-num ${delta >= 0 ? "accent" : ""}`} style={{ color: delta < 0 ? "var(--hot)" : undefined }}>
            {latest ? `${delta >= 0 ? "+" : ""}${fmtMoney(delta, latest.currency)}` : "—"}
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>vs prior snapshot</div>
        </Panel>
        <Panel title="Liabilities">
          <div className="big-num">{latest ? fmtMoney(latest.liabilities, latest.currency) : "—"}</div>
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>
            {latest ? `${((latest.liabilities / latest.net_worth) * 100).toFixed(1)}% of net` : ""}
          </div>
        </Panel>
      </div>

      {latest && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {(
            [
              ["a1", "Liquid Cash", "liquid", latest.liquid, "var(--accent)"],
              ["a2", "Invested Assets", "invested", latest.invested, "var(--cool)"],
              ["a3", "Liabilities", "liability", latest.liabilities, "var(--hot)"],
            ] as const
          ).map(([idx, title, kind, total]) => (
            <Panel key={kind} idx={idx} title={title} right={<span>{((total / latest.net_worth) * 100).toFixed(0)}% of net</span>}>
              <div className="big-num" style={{ fontSize: 26 }}>{fmtMoney(total, latest.currency)}</div>
              <div className="grid-2" style={{ marginTop: 12 }}>
                {cat(kind).map((c) => (
                  <div key={c.name}>
                    <div className="label" style={{ fontSize: 9 }}>{c.name}</div>
                    <div className="num" style={{ fontSize: 14, marginTop: 2 }}>{fmtMoney(c.value, latest.currency)}</div>
                  </div>
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel idx="a4" title="Snapshot History" right={<span>monthly · {monthly.length}mo</span>}>
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Net Worth</th>
              <th>Liquid</th>
              <th>Invested</th>
              <th>Liabilities</th>
              <th>Δ vs prior</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m, i) => {
              const prior = monthly[i + 1];
              const d = prior ? m.net_worth - prior.net_worth : 0;
              return (
                <tr key={m.date}>
                  <td>{new Date(m.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                  <td>{fmtMoney(m.net_worth, m.currency)}</td>
                  <td className="faint">{fmtMoney(m.liquid, m.currency)}</td>
                  <td className="faint">{fmtMoney(m.invested, m.currency)}</td>
                  <td className="faint">{fmtMoney(m.liabilities, m.currency)}</td>
                  <td style={{ color: d >= 0 ? "var(--accent)" : "var(--hot)" }}>
                    {prior ? `${d >= 0 ? "+" : ""}${fmtMoney(d, m.currency)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
