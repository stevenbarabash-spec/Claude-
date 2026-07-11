// Monthly cash-flow summary: income received, what's owed, and projections
// built from unpaid receivables + active retainers.
import { NextResponse } from "next/server";
import { localDateKey } from "@/lib/dates";
import { getStore } from "@/lib/store";
import type { IncomeEntry, Project, Receivable } from "@/lib/types";

function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

function monthKeyOffset(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d.toLocaleDateString("en-CA").slice(0, 7);
}

function lastDayOfMonthOffset(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0);
  return d.toLocaleDateString("en-CA");
}

// Expected date for an unpaid receivable — due date, else end of next month.
function expectedDate(r: Receivable): string {
  return r.due_date ?? lastDayOfMonthOffset(1);
}

interface Projection {
  label: string;
  key: string;
  received: number;
  fromReceivables: number;
  fromRetainers: number;
  total: number;
}

export async function GET() {
  const store = getStore();
  const [projects, income, receivables] = await Promise.all([
    store.listProjects(),
    store.listIncome(13),
    store.listReceivables(false),
  ]);

  const today = localDateKey();
  const thisMonth = monthKeyOffset(0);

  const receivedThisMonth = income
    .filter((e) => monthKeyOf(e.date) === thisMonth)
    .reduce((a, e) => a + e.amount, 0);
  const owedTotal = receivables.reduce((a, r) => a + r.amount, 0);
  const overdue = receivables.filter((r) => r.due_date && r.due_date < today);
  const overdueTotal = overdue.reduce((a, r) => a + r.amount, 0);

  const retainerMonthly = projects
    .filter((p) => p.status === "active" && p.kind === "retainer")
    .reduce((a, p) => a + p.value, 0);

  // Projection windows. Rules:
  // - unpaid receivables count in the window their expected date falls in
  //   (anything already overdue counts toward THIS month — it's still expected);
  // - retainers contribute their monthly amount for FUTURE months only (this
  //   month's retainer is assumed to already be in income or receivables);
  // - "this month" also includes what's already been received.
  function windowProjection(label: string, fromOffset: number, toOffset: number): Projection {
    const fromKey = monthKeyOffset(fromOffset);
    const toKey = monthKeyOffset(toOffset);
    const fromReceivables = receivables
      .filter((r) => {
        const key = monthKeyOf(expectedDate(r));
        const clamped = key < thisMonth ? thisMonth : key; // overdue → this month
        return clamped >= fromKey && clamped <= toKey;
      })
      .reduce((a, r) => a + r.amount, 0);
    let retainerMonths = 0;
    for (let m = Math.max(fromOffset, 1); m <= toOffset; m++) retainerMonths++;
    const fromRetainers = retainerMonths * retainerMonthly;
    const received = fromOffset === 0 ? receivedThisMonth : 0;
    return {
      label,
      key: `${fromKey}..${toKey}`,
      received,
      fromReceivables,
      fromRetainers,
      total: received + fromReceivables + fromRetainers,
    };
  }

  const projections: Projection[] = [
    windowProjection("This month", 0, 0),
    windowProjection("Next month", 1, 1),
    windowProjection("Next 3 months", 0, 2),
    windowProjection("Next 12 months", 0, 11),
  ];

  // Income history by month (last 12) for the trend line.
  const byMonth = new Map<string, number>();
  for (let m = -11; m <= 0; m++) byMonth.set(monthKeyOffset(m), 0);
  for (const e of income) {
    if (byMonth.has(monthKeyOf(e.date))) {
      byMonth.set(monthKeyOf(e.date), (byMonth.get(monthKeyOf(e.date)) ?? 0) + e.amount);
    }
  }
  const monthlyHistory = [...byMonth.entries()].map(([month, total]) => ({ month, total }));

  // Per-project rollups: received + still owed against each project.
  const projectRollups = projects.map((p) => ({
    ...p,
    received: income.filter((e) => e.project_id === p.id).reduce((a, e) => a + e.amount, 0),
    owed: receivables.filter((r) => r.project_id === p.id).reduce((a, r) => a + r.amount, 0),
  }));

  return NextResponse.json(
    {
      month: thisMonth,
      receivedThisMonth,
      owedTotal,
      overdueTotal,
      overdueCount: overdue.length,
      retainerMonthly,
      projections,
      monthlyHistory,
      projects: projectRollups,
      receivables,
      incomeThisMonth: income.filter((e: IncomeEntry) => monthKeyOf(e.date) === thisMonth),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export type { Projection };
export type ProjectRollup = Project & { received: number; owed: number };
