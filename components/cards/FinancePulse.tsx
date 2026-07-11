"use client";
// Cashflow pulse (home card): received this month, owed to you, projected.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtMoney } from "@/lib/client";
import { Panel } from "../Panel";

export function Spark({ values, color = "var(--accent)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <svg className="spark" />;
  const min = Math.min(...values, 0);
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

interface Summary {
  receivedThisMonth: number;
  owedTotal: number;
  overdueTotal: number;
  overdueCount: number;
  projections: { label: string; total: number }[];
  monthlyHistory: { month: string; total: number }[];
}

export function FinancePulse() {
  const [s, setS] = useState<Summary | null>(null);

  const load = () => api<Summary>("/api/finance").then(setS).catch(() => {});
  useEffect(() => {
    load();
    window.addEventListener("jarvis:capture", load);
    return () => window.removeEventListener("jarvis:capture", load);
  }, []);

  const projThisMonth = s?.projections.find((p) => p.label === "This month")?.total ?? 0;

  return (
    <Panel idx="07" title="Cashflow" right={<Link href="/finance" className="chip">this month →</Link>}>
      <div className="label">Received this month</div>
      {s ? (
        <>
          <div className="big-num" style={{ margin: "4px 0 2px" }}>{fmtMoney(s.receivedThisMonth)}</div>
          <span className="chip ok">projected {fmtMoney(projThisMonth)}</span>
          <Spark values={s.monthlyHistory.map((m) => m.total)} />
          <div className="grid-2">
            <div className="panel" style={{ padding: 10 }}>
              <div className="label">Owed to you</div>
              <div className="num" style={{ fontSize: 17, marginTop: 3 }}>{fmtMoney(s.owedTotal)}</div>
            </div>
            <div className="panel" style={{ padding: 10, borderColor: s.overdueCount ? "rgba(224,112,111,0.3)" : undefined }}>
              <div className="label" style={{ color: s.overdueCount ? "var(--hot)" : undefined }}>Overdue</div>
              <div className="num" style={{ fontSize: 17, marginTop: 3, color: s.overdueCount ? "var(--hot)" : undefined }}>
                {s.overdueCount ? fmtMoney(s.overdueTotal) : "—"}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>Loading…</div>
      )}
    </Panel>
  );
}
