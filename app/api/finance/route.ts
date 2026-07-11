// Read-only finance summary. Page loads NEVER trigger AI (guide §5.8) —
// this endpoint only reads stored snapshots.
import { NextResponse } from "next/server";
import { financeConfigured } from "@/lib/finance/sheets";
import { getStore } from "@/lib/store";
import type { FinanceSnapshot } from "@/lib/types";

export async function GET() {
  const logs = await getStore().listLogs(400);
  const snapshots = logs
    .filter((l) => l.notes.finance)
    .map((l) => ({ date: l.log_date, ...(l.notes.finance as FinanceSnapshot) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Monthly history: last snapshot seen for each month.
  const byMonth = new Map<string, (typeof snapshots)[number]>();
  for (const s of [...snapshots].reverse()) byMonth.set(s.date.slice(0, 7), s);
  const monthly = [...byMonth.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 24);

  return NextResponse.json(
    { latest: snapshots[0] ?? null, snapshots: snapshots.slice(0, 60), monthly, configured: financeConfigured() },
    { headers: { "cache-control": "no-store" } },
  );
}
