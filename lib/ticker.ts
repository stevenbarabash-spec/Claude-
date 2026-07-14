// Header ticker — the watchlist of market symbols shown under the date, plus
// the live quote + news fetchers. Symbols are stored on the sentinel log so the
// list is editable from the dashboard ("add more tickers").
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type TickerSymbol } from "./types";

export const DEFAULT_TICKERS: TickerSymbol[] = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^DJI", label: "Dow" },
  { symbol: "XRP-USD", label: "XRP" },
];

export async function listTickers(): Promise<TickerSymbol[]> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  const t = log?.notes.tickers;
  return t && t.length ? t : DEFAULT_TICKERS;
}

export async function saveTickers(tickers: TickerSymbol[]): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { tickers });
}

export interface Quote {
  symbol: string;
  label: string;
  price: number | null;
  changePct: number | null;
  currency: string;
}

export interface Headline {
  title: string;
  source: string;
  link: string;
}

// Yahoo Finance chart endpoint — one call per symbol. Returns last price and
// percent change vs the previous close. Null price = fetch failed (shown as "—").
async function fetchQuote(t: TickerSymbol): Promise<Quote> {
  const base: Quote = { symbol: t.symbol, label: t.label, price: null, changePct: null, currency: "USD" };
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return base;
    const j = (await res.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; currency?: string } }[] };
    };
    const m = j.chart?.result?.[0]?.meta;
    if (!m || typeof m.regularMarketPrice !== "number") return base;
    const prev = m.chartPreviousClose ?? m.previousClose;
    const changePct = typeof prev === "number" && prev !== 0 ? ((m.regularMarketPrice - prev) / prev) * 100 : null;
    return { ...base, price: m.regularMarketPrice, changePct, currency: m.currency ?? "USD" };
  } catch {
    return base;
  }
}

export async function fetchQuotes(tickers: TickerSymbol[]): Promise<Quote[]> {
  return Promise.all(tickers.map(fetchQuote));
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Google News "Top stories" RSS → the first N headlines. Titles arrive as
// "Headline - Source"; we split the source off for a cleaner strip.
export async function fetchHeadlines(limit = 8): Promise<Headline[]> {
  try {
    const res = await fetch("https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en", {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.split("<item>").slice(1, limit + 1);
    const out: Headline[] = [];
    for (const it of items) {
      const rawTitle = it.match(/<title>(.*?)<\/title>/s)?.[1] ?? "";
      const link = it.match(/<link>(.*?)<\/link>/s)?.[1] ?? "";
      const title = decodeEntities(rawTitle).trim();
      if (!title) continue;
      const sep = title.lastIndexOf(" - ");
      out.push({
        title: sep > 20 ? title.slice(0, sep) : title,
        source: sep > 20 ? title.slice(sep + 3) : "",
        link: link.trim(),
      });
    }
    return out;
  } catch {
    return [];
  }
}
