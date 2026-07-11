import { NextResponse } from "next/server";
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
  return NextResponse.json({ receivable });
}
