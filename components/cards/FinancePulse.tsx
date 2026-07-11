"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtMoney } from "@/lib/client";
import type { FinanceSnapshot } from "@/lib/types";
import { Panel } from "../Panel";

type Snap = FinanceSnapshot & { date: string };

export function Spark({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <svg className="spark" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${40 - ((v - min) / range) * 36}`).join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 44" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,44 ${pts} 100,44`} fill={color} opacity="0.07" />
    </svg>
  );
}

export function FinancePulse() {
  const [monthly, setMonthly] = useState<Snap[]>([]);

  useEffect(() => {
    api<{ monthly: Snap[] }>("/api/finance")
      .then((r) => setMonthly([...r.monthly].reverse()))
      .catch(() => {});
  }, []);

  const latest = monthly.at(-1);
  const prev = monthly.at(-2);
  const delta30 = latest && prev ? latest.net_worth - prev.net_worth : 0;
  const pct30 = prev ? (delta30 / prev.net_worth) * 100 : 0;

  return (
    <Panel idx="07" title="Finance Pulse" right={<Link href="/finance" className="chip">live →</Link>}>
      <div className="label">Net Worth</div>
      {latest ? (
        <>
          <div className="big-num" style={{ margin: "4px 0 2px" }}>{fmtMoney(latest.net_worth, latest.currency)}</div>
          <span className={`chip ${delta30 >= 0 ? "ok" : "hot"}`}>
            {delta30 >= 0 ? "▲" : "▼"} {pct30.toFixed(1)}% · 30D
          </span>
          <Spark values={monthly.map((m) => m.net_worth)} />
          <div className="grid-2">
            <div className="panel" style={{ padding: 10 }}>
              <div className="label">Monthly Δ</div>
              <div className={`num ${delta30 >= 0 ? "accent" : ""}`} style={{ fontSize: 17, marginTop: 3 }}>
                {delta30 >= 0 ? "+" : ""}
                {fmtMoney(delta30, latest.currency)}
              </div>
            </div>
            <div className="panel" style={{ padding: 10 }}>
              <div className="label">Liquid</div>
              <div className="num" style={{ fontSize: 17, marginTop: 3 }}>{fmtMoney(latest.liquid, latest.currency)}</div>
            </div>
          </div>
          {latest.source === "demo" && (
            <div className="faint" style={{ fontSize: 10, marginTop: 8, fontFamily: "var(--mono)" }}>
              DEMO DATA — connect your sheet on the Finance tab
            </div>
          )}
        </>
      ) : (
        <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>
          No snapshots yet. Run one from the Finance tab.
        </div>
      )}
    </Panel>
  );
}
