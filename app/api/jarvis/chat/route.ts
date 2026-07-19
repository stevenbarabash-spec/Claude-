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
  clearPendingCapture,
  clearPendingCommand,
  clearPendingMeeting,
  executePendingCommand,
  getPendingCapture,
  getPendingCommand,
  getPendingMeeting,
  isCancellation,
  isConfirmation,
  isCorrection,
  proposeCommand,
  reviseCaptureText,
  setPendingCapture,
  setPendingMeeting,
} from "@/lib/jarvis/commands";
import {
  bookMeeting,
  bookingConfigured,
  describeMeeting,
  looksLikeMeetingRequest,
  parseMeetingRequest,
} from "@/lib/meetings";
import { previewCapture, runCapturePipeline } from "@/lib/pipeline";
import { getStore } from "@/lib/store";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type Intent = "capture" | "ask" | "chat" | "command" | "start_work" | "next" | "meeting";

const NEXT_RE = /what('?s| should| do| to| shall).*(next|work on|do now|do first|priorit|focus on|tackle)|what'?s next|what do i do|plan my day|where (should|do) i start/i;

async function detectIntent(text: string): Promise<Intent> {
  if (!aiAvailable()) {
    if (NEXT_RE.test(text)) return "next";
    if (looksLikeMeetingRequest(text)) return "meeting";
    if (/\b(work on|working on|start (on|working|the)|let'?s do|i want to do|i'?ll do|tackle|focus on)\b/i.test(text) && /\b(today|now|next|this|first|top|one)\b/i.test(text)) {
      return "start_work";
    }
    if (/\b(delete|remove|change|update|edit|correct|mark .{0,20}paid|push .{0,20}date)\b/i.test(text)) return "command";
    return text.trim().endsWith("?") ? "ask" : "capture";
  }
  const result = await llmJson<{ intent: Intent }>(
    `Classify the user's message for a personal-OS assistant. Return {"intent": ...}:
- "next": the user asks what to work on or do next / what to prioritize / where to start / to plan their day — "what should I work on?", "what's next?", "what should I do now?", "prioritize my day"
- "start_work": the user wants to START a specific task now/today — "let me work on the BYTOX newsletter", "I want to do the funnel today", "start the essay", "let's do the first one"
- "meeting": book/schedule a NEW meeting, call, or appointment on the calendar, possibly inviting people — "book a meeting with John tomorrow at 3", "schedule a call with jane@acme.com Friday at noon"
- "capture": a NEW to-do, reminder, meal eaten, money owed/received, idea, decision, or journal entry to be FILED
- "command": modify/delete an EXISTING money record, OR act on the CLIENT BOARD — e.g. "delete the Meridian receivable", "change Acme's invoice to $5k", "mark the Relay invoice paid", "add a task to BYTOX to send the invoice", "mark the Greenwich homepage task done"
- "ask": a question about the user's own data, history, tasks, or past captures
- "chat": general conversation, greetings, requests for advice/summaries`,
    text,
    128,
  );
  return result?.data.intent ?? "capture";
}

// Speak the Next Up ranking aloud.
async function answerWhatsNext(): Promise<string> {
  const { buildNextUp } = await import("@/lib/nextup");
  const r = await buildNextUp(5);
  if (r.items.length === 0) return "You're all clear — nothing open right now. Nice work.";
  const list = r.items
    .map((it, i) => `${i + 1}. ${it.title}${it.who ? ` (${it.who})` : ""} — ${it.reason}`)
    .join("\n");
  const head = r.headline ? `${r.headline}\n\n` : "Here's what to tackle next:\n\n";
  return `${head}${list}\n\nSay "start the first one" and I'll pull it into Currently Working On.`;
}

// Turn "I want to work on the BYTOX newsletter today" into a staged working item.
async function stageFromUtterance(text: string): Promise<{ reply: string; staged: boolean }> {
  const store = getStore();
  const { collectCandidates, buildNextUp } = await import("@/lib/nextup");
  const { stageWorking } = await import("@/lib/working");

  // "start the first / top / number one" → stage the #1 Next Up suggestion.
  if (/\b(first|top|number one|1st|next one)\b/i.test(text) && text.trim().split(/\s+/).length <= 6) {
    const r = await buildNextUp(1);
    const top = r.items[0];
    if (top) {
      await stageWorking({ key: top.id, source: top.source, title: top.title, who: top.who, href: top.href, taskId: top.taskId, projectId: top.projectId, date: top.date });
      return { reply: `Staged “${top.title}” in Currently Working On — tap Confirm to start the clock.`, staged: true };
    }
  }

  const q = text
    .replace(/^\s*(hey\s+)?(jarvis[,\s]*)?/i, "")
    .replace(/\b(i want to|i'd like to|i would like to|let me|let'?s|lets|can you|could you|please|start|begin|working on|work on|do|tackle|focus on|today|right now|now|next|this)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!q) return { reply: "Sure — what would you like to work on?", staged: false };

  const { items } = await collectCandidates();
  const tokens = q.toLowerCase().split(/\s+/);
  const match = items.find((it) => {
    const hay = `${it.title} ${it.who ?? ""}`.toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });

  let staged;
  if (match) {
    staged = { key: match.id, source: match.source, title: match.title, who: match.who, href: match.href, taskId: match.taskId, projectId: match.projectId, date: match.date };
  } else {
    const title = q.charAt(0).toUpperCase() + q.slice(1);
    const task = await store.createTask({ title, urgency: "today" });
    staged = { key: `crm:${task.id}`, source: "crm" as const, title, who: null, href: "/crm", taskId: task.id };
  }
  await stageWorking(staged);
  return {
    reply: `Staged “${staged.title}” in Currently Working On — tap Confirm to start the clock.`,
    staged: true,
  };
}

async function todayContext(): Promise<string> {
  const store = getStore();
  const today = localDateKey();
  const [tasks, log, income, receivables, habitDefs] = await Promise.all([
    store.listTasks(false),
    store.getLog(today),
    store.listIncome(1),
    store.listReceivables(false),
    (await import("@/lib/habits")).getHabitDefs(),
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
    `Habits done: ${habitsDone.length}/${habitDefs.length}.`,
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

  // A pending meeting awaiting read-back confirmation: "confirm" books it and
  // sends the invites, a correction re-parses, "cancel" (or anything else) drops it.
  const pendingMeeting = await getPendingMeeting();
  if (pendingMeeting) {
    if (isConfirmation(text)) {
      await clearPendingMeeting();
      try {
        const { reply } = await bookMeeting(pendingMeeting.draft);
        return NextResponse.json({ reply, action: { type: "meeting_booked" } });
      } catch (err) {
        return NextResponse.json({
          reply: `Booking failed — nothing was sent. ${err instanceof Error ? err.message : "Unknown error."}`,
          action: { type: "meeting_failed" },
        });
      }
    }
    if (isCorrection(text)) {
      const revised = await reviseCaptureText(pendingMeeting.text, text);
      const { draft, reason } = await parseMeetingRequest(revised);
      if (!draft) {
        return NextResponse.json({
          reply: `I lost the thread on that one (${reason ?? "couldn't re-parse"}) — tell me the whole meeting again.`,
          action: { type: "meeting_failed" },
        });
      }
      const description = describeMeeting(draft);
      await setPendingMeeting(revised, draft, description);
      return NextResponse.json({
        reply: `Updated — here's what I'll book now:\n\n${description}\n\nSay "confirm" to book it and send the invites, or correct me again.`,
        action: { type: "meeting_proposed" },
      });
    }
    await clearPendingMeeting();
    if (isCancellation(text)) {
      return NextResponse.json({ reply: "Cancelled — nothing was booked, no invites sent.", action: { type: "meeting_cancelled" } });
    }
    // fall through: treat as a fresh message
  }

  // A pending capture awaiting read-back confirmation: "confirm" files it,
  // a correction revises it, "cancel" (or anything else) drops it.
  const pendingCap = await getPendingCapture();
  if (pendingCap) {
    if (isConfirmation(text)) {
      await clearPendingCapture();
      const result = await runCapturePipeline(pendingCap.text, "jarvis");
      return NextResponse.json({
        reply: `Filed. ${result.reply}`,
        action: { type: "capture", routed_to: result.routed_to, kind: result.capture.classification?.kind },
      });
    }
    if (isCorrection(text)) {
      const revised = await reviseCaptureText(pendingCap.text, text);
      const preview = await previewCapture(revised);
      await setPendingCapture(revised, preview.description);
      return NextResponse.json({
        reply: `Updated — here's what I'll file now:\n\n${preview.description}\n\nSay "confirm" to file it, or correct me again.`,
        action: { type: "capture_proposed", proposal_text: revised },
      });
    }
    await clearPendingCapture();
    if (isCancellation(text)) {
      return NextResponse.json({ reply: "Dropped it — nothing was filed.", action: { type: "capture_cancelled" } });
    }
    // fall through: treat as a fresh message
  }

  // Explicit prefixes let the user force a mode: "capture: ..." / "ask: ..."
  let intent: Intent;
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

  if (intent === "next") {
    return NextResponse.json({ reply: await answerWhatsNext(), action: { type: "next" } });
  }

  if (intent === "start_work") {
    const { reply, staged } = await stageFromUtterance(payload);
    return NextResponse.json({ reply, action: { type: staged ? "work_staged" : "chat" } });
  }

  if (intent === "meeting") {
    if (!bookingConfigured()) {
      return NextResponse.json({
        reply:
          "Calendar booking isn't wired up yet — set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN (run scripts/google-refresh-token.mjs to mint the token).",
        action: { type: "meeting_failed" },
      });
    }
    const { draft, reason } = await parseMeetingRequest(payload);
    if (!draft) {
      return NextResponse.json({
        reply: `I couldn't book that: ${reason ?? "missing details"}. Give me a person, a day, and a time — e.g. "book a call with John tomorrow at 3pm".`,
        action: { type: "meeting_failed" },
      });
    }
    const description = describeMeeting(draft);
    await setPendingMeeting(payload, draft, description);
    return NextResponse.json({
      reply: `Here's what I'll book:\n\n${description}\n\nSay "confirm" and I'll create it and send the invites — "cancel" to drop it, or correct me (e.g. "no, make it 4pm").`,
      action: { type: "meeting_proposed" },
    });
  }

  if (intent === "command") {
    const { reply, proposed } = await proposeCommand(payload);
    return NextResponse.json({ reply, action: { type: proposed ? "command_proposed" : "command_failed" } });
  }

  if (intent === "capture") {
    // Never file straight away — read back what was understood and wait for
    // a "confirm" (voice or button) so a misheard phrase can't become a record.
    const preview = await previewCapture(payload);
    await setPendingCapture(payload, preview.description);
    return NextResponse.json({
      reply: `Here's what I heard — I'll file:\n\n${preview.description}\n\nSay "confirm" and it's in, "cancel" to drop it, or correct me (e.g. "no, make it Friday").`,
      action: { type: "capture_proposed", proposal_text: payload },
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
