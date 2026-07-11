// Finance Pulse pipeline (guide §5.8): Google Sheet → all tabs as 2D arrays →
// Claude extracts net worth + categories. Auth via service account (guide §7.3),
// implemented with node:crypto JWT signing + the Sheets REST API — no heavy deps.
import crypto from "crypto";
import { llmJson } from "../ai/llm";
import type { FinanceSnapshot } from "../types";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

async function serviceAccountToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  key = key.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key).toString("base64url");
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`google token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

export function financeConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_FINANCE_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  );
}

async function fetchAllTabs(): Promise<Record<string, string[][]>> {
  const sheetId = process.env.GOOGLE_SHEETS_FINANCE_ID!;
  const token = await serviceAccountToken();
  const headers = { authorization: `Bearer ${token}` };

  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers },
  );
  if (!metaRes.ok) throw new Error(`sheet metadata failed: ${metaRes.status}`);
  const meta = await metaRes.json();
  const titles: string[] = (meta.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);

  const ranges = titles.map((t) => `ranges=${encodeURIComponent(`'${t}'!A1:Z200`)}`).join("&");
  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE`,
    { headers },
  );
  if (!valuesRes.ok) throw new Error(`sheet values failed: ${valuesRes.status}`);
  const values = await valuesRes.json();

  const tabs: Record<string, string[][]> = {};
  (values.valueRanges ?? []).forEach((vr: { values?: string[][] }, i: number) => {
    tabs[titles[i]] = vr.values ?? [];
  });
  return tabs;
}

export async function extractFinanceSnapshot(): Promise<FinanceSnapshot> {
  const tabs = await fetchAllTabs();
  const dump = Object.entries(tabs)
    .map(([name, rows]) => `## TAB: ${name}\n${rows.map((r) => r.join(" | ")).join("\n")}`)
    .join("\n\n")
    .slice(0, 60000);

  const result = await llmJson<Omit<FinanceSnapshot, "source">>(
    `You extract a personal finance snapshot from a raw spreadsheet dump (multiple tabs, messy layout, no labels guaranteed).
Return JSON: {
  "net_worth": number,
  "currency": "USD" | "CAD" | etc,
  "as_of": "YYYY-MM-DD",
  "liquid": number (cash-like assets),
  "invested": number (equities, index, crypto, private),
  "liabilities": number (positive number),
  "categories": [{"name": string, "value": number, "kind": "liquid" | "invested" | "liability"}],
  "notes": string (flag any ambiguity or possible double-counting for human review)
}
Rules: AVOID DOUBLE-COUNTING — a summary tab plus per-category tabs must not both be summed. For time-series tabs, use ONLY the most recent row. net_worth should equal liquid + invested - liabilities (reconcile and note discrepancies).`,
    dump,
    2048,
  );
  if (!result) throw new Error("finance extraction failed — no AI provider configured or bad response");
  return { ...result.data, source: "sheet" };
}
