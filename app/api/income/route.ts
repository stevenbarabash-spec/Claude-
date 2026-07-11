import { NextResponse } from "next/server";
import { localDateKey } from "@/lib/dates";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const months = Math.min(36, Number(url.searchParams.get("months") ?? 12));
  const income = await getStore().listIncome(months);
  return NextResponse.json({ income }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (typeof body.amount !== "number" || !body.source) {
    return NextResponse.json({ error: "source + amount required" }, { status: 400 });
  }
  const entry = await getStore().addIncome({
    date: body.date ?? localDateKey(),
    source: body.source,
    project_id: body.project_id ?? null,
    amount: body.amount,
    currency: body.currency ?? "USD",
    kind: body.kind ?? "project",
  });
  await getStore().addAudit("create", "income", entry.id, { amount: entry.amount });
  return NextResponse.json({ entry });
}
