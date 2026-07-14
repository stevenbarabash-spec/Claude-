// Header ticker feed — live market quotes for the watchlist + top news
// headlines. GET returns data; POST adds a symbol; DELETE removes one.
import { NextResponse } from "next/server";
import { fetchHeadlines, fetchQuotes, listTickers, saveTickers } from "@/lib/ticker";
import type { TickerSymbol } from "@/lib/types";

export const dynamic = "force-dynamic";

// Warm-instance cache so client polling doesn't hammer the upstreams.
let cache: { at: number; data: unknown } | null = null;
const TTL_MS = 60_000;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, { headers: { "cache-control": "no-store" } });
  }
  const tickers = await listTickers();
  const [quotes, news] = await Promise.all([fetchQuotes(tickers), fetchHeadlines(8)]);
  const data = { quotes, news, symbols: tickers, fetchedAt: new Date().toISOString() };
  cache = { at: Date.now(), data };
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { symbol?: string; label?: string };
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  const label = (body.label ?? "").trim() || symbol.replace(/^\^/, "").replace(/-USD$/, "");
  const tickers = await listTickers();
  if (tickers.some((t) => t.symbol.toUpperCase() === symbol)) {
    return NextResponse.json({ error: "already watching", symbols: tickers }, { status: 409 });
  }
  const next: TickerSymbol[] = [...tickers, { symbol, label }];
  await saveTickers(next);
  cache = null; // force a refetch next GET
  return NextResponse.json({ symbols: next });
}

export async function DELETE(req: Request) {
  const body = (await req.json()) as { symbol?: string };
  const symbol = (body.symbol ?? "").trim().toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });
  const tickers = await listTickers();
  const next = tickers.filter((t) => t.symbol.toUpperCase() !== symbol);
  await saveTickers(next);
  cache = null;
  return NextResponse.json({ symbols: next });
}
