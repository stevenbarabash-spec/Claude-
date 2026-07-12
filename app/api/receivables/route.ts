import { NextResponse } from "next/server";
import { recordHistory } from "@/lib/history";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const includePaid = url.searchParams.get("all") === "1";
  const receivables = await getStore().listReceivables(includePaid);
  return NextResponse.json({ receivables }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.client || typeof body.amount !== "number") {
    return NextResponse.json({ error: "client + amount required" }, { status: 400 });
  }
  const receivable = await getStore().createReceivable(body);
  await getStore().addAudit("create", "receivable", receivable.id, { amount: receivable.amount });
  await recordHistory({
    action: "create",
    resource: "receivable",
    resource_id: receivable.id,
    label: `Receivable added: $${receivable.amount.toLocaleString()} from ${receivable.client}`,
    before: null,
    after: receivable,
  });
  return NextResponse.json({ receivable });
}
