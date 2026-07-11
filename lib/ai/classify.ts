// Capture classifier (guide §4): Claude primary, OpenAI fallback, regex last resort.
import type { CaptureKind, Urgency } from "../types";
import { aiAvailable, llmJson, type LlmSource } from "./llm";

export interface Classification {
  kind: CaptureKind;
  urgency: Urgency;
  tags: string[];
  summary: string;
  title: string;
  meal?: { kcal: number; p: number; c: number; f: number };
  money?: { amount: number; client?: string; due_date?: string };
}

const SYSTEM = `You classify short personal captures (voice notes / quick thoughts) for a life dashboard.
Return JSON: {
  "kind": "task" | "note" | "journal" | "meal" | "idea" | "decision" | "receivable" | "income",
  "urgency": "today" | "week" | "month" | "someday",
  "tags": string[] (1-3 lowercase tags),
  "title": short imperative title (max 60 chars),
  "summary": one sentence,
  "meal": { "kcal": n, "p": n, "c": n, "f": n } — ONLY when kind is "meal", estimate macros for the described food,
  "money": { "amount": n, "client": string, "due_date": "YYYY-MM-DD" } — ONLY when kind is "receivable" or "income"
}
Rules: "kind" is "receivable" when someone owes the user money or an invoice was/should be sent ("Acme owes me $6k, due the 21st"); "income" when money was RECEIVED ("Relay paid me $4k"); "task" for anything else actionable; "meal" when the text describes food eaten; "journal" for reflections about the day; "idea" for product/content ideas; "decision" for choices made. Default urgency "week" unless the text implies today. For money, resolve relative dates against today's date given in the message.`;

function parseAmount(text: string): number | undefined {
  const m =
    text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)\s*(k)?/i) ??
    text.match(/\b([\d,]+(?:\.\d+)?)\s*(k)\b/i) ??
    text.match(/([\d,]+(?:\.\d{1,2})?)()\s*(?:dollars|bucks|usd)/i);
  if (!m) return undefined;
  const base = Number(m[1].replace(/,/g, ""));
  return m[2] ? base * 1000 : base;
}

function parseClient(text: string, kind: CaptureKind): string | undefined {
  if (kind === "receivable") {
    const m = text.match(/^(.{2,40}?)\s+owes?\b/i) ?? text.match(/\binvoiced?\s+(.{2,40}?)(?:\s+for|\s*$|,)/i);
    return m?.[1].trim();
  }
  if (kind === "income") {
    const m = text.match(/\bfrom\s+(?:the\s+)?(.{2,40}?)(?:\s+gig|\s+project|\s*$|,|\.)/i) ?? text.match(/^(.{2,40}?)\s+paid\b/i);
    const client = m?.[1].trim();
    // Discard pronoun/filler "clients" like "Just got" or "I finally".
    if (client && /^(i|we|just|finally|got|they|he|she|it)\b/i.test(client)) return undefined;
    return client;
  }
  return undefined;
}

function regexClassify(text: string): Classification {
  const lower = text.toLowerCase();
  let kind: CaptureKind = "note";
  const amount = parseAmount(text);
  if (amount !== undefined && /\b(owes?|owed|invoice[ds]?|bill(ed)?|due)\b/.test(lower)) kind = "receivable";
  else if (amount !== undefined && /\b(paid me|got paid|received|landed|came in|deposited)\b/.test(lower)) kind = "income";
  else if (/\b(ate|eating|meal|breakfast|lunch|dinner|snack|calories)\b/.test(lower)) kind = "meal";
  else if (/\b(idea|what if|we could|concept)\b/.test(lower)) kind = "idea";
  else if (/\b(decided|decision|going with|choosing)\b/.test(lower)) kind = "decision";
  else if (/\b(today i|felt|feeling|grateful|journal)\b/.test(lower)) kind = "journal";
  else if (/\b(need to|todo|remind|call|email|send|fix|buy|book|schedule|finish|ship)\b/.test(lower)) kind = "task";
  const urgency: Urgency = /\b(today|tonight|asap|now|urgent)\b/.test(lower)
    ? "today"
    : /\b(someday|eventually|one day)\b/.test(lower)
      ? "someday"
      : "week";
  return {
    kind,
    urgency,
    tags: [kind],
    title: text.slice(0, 60),
    summary: text.slice(0, 140),
    money:
      amount !== undefined && (kind === "receivable" || kind === "income")
        ? { amount, client: parseClient(text, kind) }
        : undefined,
  };
}

export async function classifyCapture(
  text: string,
): Promise<{ classification: Classification; source: LlmSource | "regex" }> {
  if (aiAvailable()) {
    const today = new Date().toISOString().slice(0, 10);
    const result = await llmJson<Classification>(SYSTEM, `Today is ${today}.\nCapture: ${text}`, 512);
    if (result?.data?.kind) {
      const c = result.data;
      return {
        classification: {
          kind: c.kind,
          urgency: c.urgency ?? "week",
          tags: Array.isArray(c.tags) ? c.tags.slice(0, 3) : [],
          title: c.title || text.slice(0, 60),
          summary: c.summary || text.slice(0, 140),
          meal: c.meal,
          money: c.money,
        },
        source: result.source,
      };
    }
  }
  return { classification: regexClassify(text), source: "regex" };
}
