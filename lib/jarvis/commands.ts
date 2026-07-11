// Jarvis command engine: modify or delete existing money records by voice/text.
// Two-phase for safety — propose (Claude picks the record, we describe the exact
// change) → the user says "confirm" → execute. The pending command lives in the
// store (sentinel log) so it works statelessly from any client, phone app included.
import { aiAvailable, llmJson } from "../ai/llm";
import { localDateKey } from "../dates";
import { getStore } from "../store";
import { GOALS_SENTINEL_DATE, type PendingCommand } from "../types";

const PENDING_TTL_MS = 10 * 60 * 1000;

export function isConfirmation(text: string): boolean {
  return /^(yes|yep|yeah|yup|confirm|confirmed|do it|go ahead|sure|correct|ok|okay)\b/i.test(text.trim());
}

export function isCancellation(text: string): boolean {
  return /^(no|nope|cancel|cancelled|nevermind|never mind|stop|don'?t|wait)\b/i.test(text.trim());
}

export async function getPendingCommand(): Promise<PendingCommand | null> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  const cmd = log?.notes.pending_command;
  if (!cmd) return null;
  if (new Date(cmd.expires_at).getTime() < Date.now()) {
    await clearPendingCommand();
    return null;
  }
  return cmd;
}

export async function setPendingCommand(cmd: PendingCommand | null): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { pending_command: cmd });
}

export async function clearPendingCommand(): Promise<void> {
  await setPendingCommand(null);
}

interface ProposedCommand {
  action: "delete" | "update" | "mark_paid" | "none";
  target?: "receivable" | "income";
  id?: string;
  patch?: Record<string, unknown>;
  description?: string;
  reason?: string;
}

const RECEIVABLE_PATCH_KEYS = ["client", "description", "amount", "due_date", "status"];
const INCOME_PATCH_KEYS = ["source", "amount", "date"];

export async function proposeCommand(text: string): Promise<{ reply: string; proposed: boolean }> {
  if (!aiAvailable()) {
    return {
      reply: "I need an AI key to interpret edit commands — for now, use the checkboxes and click-to-edit on the Finance tab.",
      proposed: false,
    };
  }
  const store = getStore();
  const [receivables, income] = await Promise.all([store.listReceivables(false), store.listIncome(2)]);

  const records = [
    ...receivables.map(
      (r) =>
        `receivable | ${r.id} | ${r.client} | $${r.amount} | due ${r.due_date ?? "none"} | ${r.status}${r.description ? ` | ${r.description}` : ""}`,
    ),
    ...income.map((e) => `income | ${e.id} | ${e.source} | $${e.amount} | received ${e.date}`),
  ].join("\n");

  const today = localDateKey();
  const result = await llmJson<ProposedCommand>(
    `You translate a user's request to modify their financial records into a single command.
You are given their records, one per line: type | id | details.
Return JSON:
{"action": "delete" | "update" | "mark_paid" | "none",
 "target": "receivable" | "income",
 "id": "<exact id from the list>",
 "patch": { changed fields only },
 "description": "one plain sentence describing EXACTLY what will happen, with names and amounts"}
Rules:
- patch keys for receivable: client, description, amount (number), due_date (YYYY-MM-DD), status ("expected"|"invoiced")
- patch keys for income: source, amount (number), date (YYYY-MM-DD)
- "mark_paid" is only for receivables (books the income automatically); no patch needed
- resolve relative dates against today
- if the request is ambiguous between records or matches nothing, return {"action":"none","reason":"..."}
- NEVER invent an id.`,
    `Today is ${today}.\nRequest: ${text}\n\nRecords:\n${records || "(no records)"}`,
    768,
  );

  const cmd = result?.data;
  if (!cmd || cmd.action === "none" || !cmd.id || !cmd.target) {
    return {
      reply: cmd?.reason
        ? `I couldn't pin down which record you mean: ${cmd.reason}`
        : "I couldn't match that to a record. Try naming the client and amount.",
      proposed: false,
    };
  }

  // Never trust a hallucinated id, target, or patch key.
  const validIds = new Set(
    cmd.target === "receivable" ? receivables.map((r) => r.id) : income.map((e) => e.id),
  );
  if (!validIds.has(cmd.id)) {
    return { reply: "I couldn't match that to an existing record — nothing was changed.", proposed: false };
  }
  if (cmd.action === "mark_paid" && cmd.target !== "receivable") {
    return { reply: "Only receivables can be marked paid.", proposed: false };
  }
  const allowed = cmd.target === "receivable" ? RECEIVABLE_PATCH_KEYS : INCOME_PATCH_KEYS;
  const patch = Object.fromEntries(Object.entries(cmd.patch ?? {}).filter(([k]) => allowed.includes(k)));
  if (cmd.action === "update" && Object.keys(patch).length === 0) {
    return { reply: "I understood which record, but not what to change about it. Try again with the new value.", proposed: false };
  }

  const pending: PendingCommand = {
    action: cmd.action,
    target: cmd.target,
    id: cmd.id,
    patch: cmd.action === "update" ? patch : undefined,
    description: cmd.description ?? `${cmd.action} ${cmd.target}`,
    expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
  };
  await setPendingCommand(pending);
  return {
    reply: `${pending.description}\n\nSay "confirm" and I'll do it — or "cancel".`,
    proposed: true,
  };
}

export async function executePendingCommand(): Promise<string> {
  const cmd = await getPendingCommand();
  if (!cmd) return "There's nothing pending to confirm — it may have expired. Tell me again what to change.";
  const store = getStore();
  await clearPendingCommand();

  if (cmd.target === "receivable") {
    if (cmd.action === "delete") {
      await store.deleteReceivable(cmd.id);
      await store.addAudit("jarvis_delete", "receivable", cmd.id);
      return `Done — deleted. (${cmd.description})`;
    }
    if (cmd.action === "mark_paid") {
      const existing = (await store.listReceivables(true)).find((r) => r.id === cmd.id);
      if (!existing) return "That receivable no longer exists — nothing to do.";
      if (existing.status !== "paid") {
        const today = localDateKey();
        await store.updateReceivable(cmd.id, { status: "paid", paid_at: today });
        await store.addIncome({
          date: today,
          source: `${existing.client}${existing.description ? ` — ${existing.description}` : ""}`,
          project_id: existing.project_id,
          amount: existing.amount,
          currency: existing.currency,
          kind: "project",
        });
      }
      await store.addAudit("jarvis_paid", "receivable", cmd.id);
      return `Done — marked paid and booked $${(await store.listIncome(1))[0]?.amount.toLocaleString() ?? ""} as income.`;
    }
    const updated = await store.updateReceivable(cmd.id, cmd.patch ?? {});
    await store.addAudit("jarvis_update", "receivable", cmd.id, cmd.patch);
    return updated ? `Done — updated. (${cmd.description})` : "That receivable no longer exists — nothing changed.";
  }

  // income
  if (cmd.action === "delete") {
    await store.deleteIncome(cmd.id);
    await store.addAudit("jarvis_delete", "income", cmd.id);
    return `Done — removed from the income log. (${cmd.description})`;
  }
  const updated = await store.updateIncome(cmd.id, cmd.patch ?? {});
  await store.addAudit("jarvis_update", "income", cmd.id, cmd.patch);
  return updated ? `Done — updated. (${cmd.description})` : "That income entry no longer exists — nothing changed.";
}
