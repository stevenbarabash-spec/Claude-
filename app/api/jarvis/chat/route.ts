// Jarvis — the assistant that replaces the guide's Telegram bot.
// Every message is routed by intent:
//   capture → the full capture pipeline (classify → route → embed → audit)
//   ask     → memory search + answer with citations ("ask my OS", guide §6)
//   chat    → conversational reply grounded in today's dashboard state
import { NextResponse } from "next/server";
import { embed } from "@/lib/ai/embed";
import { aiAvailable, llmJson, llmText } from "@/lib/ai/llm";
import { config } from "@/lib/config";
import { localDateKey } from "@/lib/dates";
import {
  clearPendingCommand,
  executePendingCommand,
  getPendingCommand,
  isCancellation,
  isConfirmation,
  proposeCommand,
} from "@/lib/jarvis/commands";
import { runCapturePipeline } from "@/lib/pipeline";
import { getStore } from "@/lib/store";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function detectIntent(text: string): Promise<"capture" | "ask" | "chat" | "command"> {
  if (!aiAvailable()) {
    if (/\b(delete|remove|change|update|edit|correct|mark .{0,20}paid|push .{0,20}date)\b/i.test(text)) return "command";
    return text.trim().endsWith("?") ? "ask" : "capture";
  }
  const result = await llmJson<{ intent: "capture" | "ask" | "chat" | "command" }>(
    `Classify the user's message for a personal-OS assistant. Return {"intent": ...}:
- "capture": a NEW to-do, reminder, meal eaten, money owed/received, idea, decision, or journal entry to be FILED (statements about things to do or that happened)
- "command": modify, correct, or delete an EXISTING record — e.g. "delete the Meridian receivable", "change Acme's invoice to $5k", "mark the Relay invoice paid", "push the due date to next month", "actually remove that"
- "ask": a question about the user's own data, history, tasks, or past captures
- "chat": general conversation, greetings, requests for advice/summaries`,
    text,
    128,
  );
  return result?.data.intent ?? "capture";
}

async function todayContext(): Promise<string> {
  const store = getStore();
  const today = localDateKey();
  const [tasks, log, income, receivables] = await Promise.all([
    store.listTasks(false),
    store.getLog(today),
    store.listIncome(1),
    store.listReceivables(false),
  ]);
  const top = tasks.filter((t) => t.urgency === "today").slice(0, 5);
  const habitsDone = log?.notes.habits?.done ?? [];
  const meals = log?.notes.nutrition?.meals ?? [];
  const kcal = meals.reduce((a, m) => a + m.kcal, 0);
  const thisMonth = today.slice(0, 7);
  const received = income.filter((e) => e.date.startsWith(thisMonth)).reduce((a, e) => a + e.amount, 0);
  const owed = receivables.reduce((a, r) => a + r.amount, 0);
  return [
    `Date: ${today}. Owner: ${config.owner.name}.`,
    `Today's focus: ${log?.notes.focus || "not set"}.`,
    `Today's tasks: ${top.map((t) => t.title).join("; ") || "none"}.`,
    `Habits done: ${habitsDone.length}/${config.habits.length}.`,
    `Nutrition so far: ${kcal} kcal across ${meals.length} meals (target ${config.nutrition.kcalTarget}).`,
    `Money this month: $${received.toLocaleString()} received; $${owed.toLocaleString()} owed across ${receivables.length} open receivables.`,
  ].join("\n");
}

async function answerFromMemory(question: string): Promise<string> {
  const store = getStore();
  const vector = await embed(question);
  const chunks = vector
    ? await store.searchMemoryByVector(vector, 20)
    : await store.searchMemoryByText(question, 20);
  if (!aiAvailable()) {
    if (chunks.length === 0) return "I don't have anything in memory matching that yet.";
    return "Closest matches from memory:\n" + chunks.slice(0, 5).map((c) => `• ${c.text.slice(0, 160)}`).join("\n");
  }
  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.source_type}, ${c.created_at.slice(0, 10)}) ${c.text.slice(0, 800)}`)
    .join("\n");
  const { text } = await llmText(
    `You are Jarvis, ${config.owner.name}'s personal assistant. Answer the question using ONLY the provided context from their personal memory. Cite sources with [n]. If the context is insufficient, say so plainly.`,
    `Question: ${question}\n\nContext:\n${context || "(no matches)"}`,
    1024,
  );
  return text;
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  const last = messages?.filter((m) => m.role === "user").at(-1);
  if (!last?.content) return NextResponse.json({ error: "message required" }, { status: 400 });
  const text = last.content.trim();

  // A pending destructive command takes priority: "confirm" executes, "cancel"
  // (or any other message) clears it so a stale yes can never fire later.
  const pending = await getPendingCommand();
  if (pending) {
    if (isConfirmation(text)) {
      const reply = await executePendingCommand();
      return NextResponse.json({ reply, action: { type: "command_executed" } });
    }
    await clearPendingCommand();
    if (isCancellation(text)) {
      return NextResponse.json({ reply: "Cancelled — nothing was changed.", action: { type: "command_cancelled" } });
    }
    // fall through: treat as a fresh message
  }

  // Explicit prefixes let the user force a mode: "capture: ..." / "ask: ..."
  let intent: "capture" | "ask" | "chat" | "command";
  let payload = text;
  if (/^capture[:,]/i.test(text)) {
    intent = "capture";
    payload = text.replace(/^capture[:,]\s*/i, "");
  } else if (/^ask[:,]/i.test(text)) {
    intent = "ask";
    payload = text.replace(/^ask[:,]\s*/i, "");
  } else {
    intent = await detectIntent(text);
  }

  if (intent === "command") {
    const { reply, proposed } = await proposeCommand(payload);
    return NextResponse.json({ reply, action: { type: proposed ? "command_proposed" : "command_failed" } });
  }

  if (intent === "capture") {
    const result = await runCapturePipeline(payload, "jarvis");
    return NextResponse.json({
      reply: result.reply,
      action: { type: "capture", routed_to: result.routed_to, kind: result.capture.classification?.kind },
    });
  }

  if (intent === "ask") {
    const reply = await answerFromMemory(payload);
    return NextResponse.json({ reply, action: { type: "ask" } });
  }

  // chat
  if (!aiAvailable()) {
    return NextResponse.json({
      reply:
        "I'm running without an AI key, so I can only file captures and search memory. Add ANTHROPIC_API_KEY to unlock conversation.",
      action: { type: "chat" },
    });
  }
  const context = await todayContext();
  const history = messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? config.owner.name : "Jarvis"}: ${m.content}`)
    .join("\n");
  const { text: reply } = await llmText(
    `You are Jarvis — ${config.owner.name}'s calm, sharp personal chief of staff living inside their life dashboard. Be concise and useful. You can see today's dashboard state:\n${context}\nWhen the user mentions something actionable they haven't asked you to file, offer to capture it.`,
    history,
    1024,
  );
  return NextResponse.json({ reply, action: { type: "chat" } });
}
