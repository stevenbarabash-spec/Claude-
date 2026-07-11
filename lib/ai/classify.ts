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
}

const SYSTEM = `You classify short personal captures (voice notes / quick thoughts) for a life dashboard.
Return JSON: {
  "kind": "task" | "note" | "journal" | "meal" | "idea" | "decision",
  "urgency": "today" | "week" | "month" | "someday",
  "tags": string[] (1-3 lowercase tags),
  "title": short imperative title (max 60 chars),
  "summary": one sentence,
  "meal": { "kcal": n, "p": n, "c": n, "f": n } — ONLY when kind is "meal", estimate macros for the described food
}
Rules: "kind" is "task" for anything actionable; "meal" when the text describes food eaten; "journal" for reflections about the day; "idea" for product/content ideas; "decision" for choices made. Default urgency "week" unless the text implies today.`;

function regexClassify(text: string): Classification {
  const lower = text.toLowerCase();
  let kind: CaptureKind = "note";
  if (/\b(ate|eating|meal|breakfast|lunch|dinner|snack|calories)\b/.test(lower)) kind = "meal";
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
  };
}

export async function classifyCapture(
  text: string,
): Promise<{ classification: Classification; source: LlmSource | "regex" }> {
  if (aiAvailable()) {
    const result = await llmJson<Classification>(SYSTEM, text, 512);
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
        },
        source: result.source,
      };
    }
  }
  return { classification: regexClassify(text), source: "regex" };
}
