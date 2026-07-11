// LLM layer: Anthropic Claude primary, OpenAI fallback (guide §1).
// Every caller degrades gracefully when no API keys are configured.
import Anthropic from "@anthropic-ai/sdk";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const OPENAI_MODEL = process.env.OPENAI_CLASSIFIER_MODEL || "gpt-4o-mini";

let anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
export function aiAvailable(): boolean {
  return hasAnthropicKey() || hasOpenAIKey();
}

async function anthropicText(system: string, user: string, maxTokens = 1024): Promise<string> {
  const client = getAnthropic();
  if (!client) throw new Error("no anthropic key");
  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function openaiText(system: string, user: string, maxTokens = 1024): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("no openai key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export type LlmSource = "anthropic" | "openai";

// Plain-text completion with fallback. Throws if no provider is configured.
export async function llmText(
  system: string,
  user: string,
  maxTokens = 1024,
): Promise<{ text: string; source: LlmSource }> {
  if (hasAnthropicKey()) {
    try {
      return { text: await anthropicText(system, user, maxTokens), source: "anthropic" };
    } catch (err) {
      if (!hasOpenAIKey()) throw err;
    }
  }
  return { text: await openaiText(system, user, maxTokens), source: "openai" };
}

// JSON completion: instructs the model to output JSON only, parses defensively.
export async function llmJson<T>(
  system: string,
  user: string,
  maxTokens = 1024,
): Promise<{ data: T; source: LlmSource } | null> {
  try {
    const { text, source } = await llmText(system + "\nOutput ONLY valid JSON — no prose, no code fences.", user, maxTokens);
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    return { data: JSON.parse(match[0]) as T, source };
  } catch {
    return null;
  }
}
