// The ONLY place the finance AI pipeline runs: manual refresh button or Vercel cron.
import { NextResponse } from "next/server";
import { localDateKey } from "@/lib/dates";
import { extractFinanceSnapshot, financeConfigured } from "@/lib/finance/sheets";
import { getStore } from "@/lib/store";

async function run() {
  if (!financeConfigured()) {
    return NextResponse.json(
      { error: "Finance sheet not configured. Set GOOGLE_SHEETS_FINANCE_ID + service account env vars." },
      { status: 400 },
    );
  }
  const snapshot = await extractFinanceSnapshot();
  const today = localDateKey();
  await getStore().mergeLogNotes(today, { finance: snapshot });
  await getStore().addAudit("finance_snapshot", "daily_logs", today, { net_worth: snapshot.net_worth });
  return NextResponse.json({ snapshot });
}

// Vercel cron sends GET with Authorization: Bearer CRON_SECRET (checked in middleware).
export async function GET() {
  return run();
}

// Manual refresh from the dashboard.
export async function POST() {
  return run();
}
