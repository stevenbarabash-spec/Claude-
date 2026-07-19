// Jarvis command engine: modify or delete existing money records by voice/text.
// Two-phase for safety — propose (Claude picks the record, we describe the exact
// change) → the user says "confirm" → execute. The pending command lives in the
// store (sentinel log) so it works statelessly from any client, phone app included.
// Captures use the same two-phase gate (propose → confirm) via PendingCapture.
import { aiAvailable, llmJson, llmText } from "../ai/llm";
import { localDateKey } from "../dates";
import { getStore } from "../store";
import { GOALS_SENTINEL_DATE, type MeetingDraft, type PendingCapture, type PendingCommand, type PendingMeeting } from "../types";

const PENDING_TTL_MS = 10 * 60 * 1000;

export function isConfirmation(text: string): boolean {
  return /^(yes|yep|yeah|yup|confirm|confirmed|do it|go ahead|sure|correct|ok|okay|file it|send it)\b/i.test(text.trim());
}

export function isCancellation(text: string): boolean {
  return /^(no|nope|cancel|cancelled|nevermind|never mind|forget it|stop|don'?t|wait)\b/i.test(text.trim());
}

// "No, make it $500" / "actually tomorrow" — an edit to the pending item,
// not a cancellation. Checked BEFORE isCancellation wherever both apply.
export function isCorrection(text: string): boolean {
  const t = text.trim();
  if (/\b(cancel|nevermind|never mind|forget it|drop it|scratch that)\b/i.test(t)) return false;
  return (
    /^(no[,\s]|nope[,\s]|actually|wait[,\s]|change|make (it|that)|instead|not |it should|i meant|rather)/i.test(t) &&
    t.split(/\s+/).length >= 3
  );
}

/* ── Pending capture (confirm-gated filing) ─────────────── */

export async function getPendingCapture(): Promise<PendingCapture | null> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  const cap = log?.notes.pending_capture;
  if (!cap) return null;
  if (new Date(cap.expires_at).getTime() < Date.now()) {
    await clearPendingCapture();
    return null;
  }
  return cap;
}

export async function setPendingCapture(text: string, description: string): Promise<void> {
  const cap: PendingCapture = {
    text,
    description,
    expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
  };
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { pending_capture: cap });
}

export async function clearPendingCapture(): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { pending_capture: null });
}

// Fold a spoken correction into the original capture, returning the new text.
export async function reviseCaptureText(original: string, correction: string): Promise<string> {
  if (!aiAvailable()) return correction;
  const { text } = await llmText(
    `The user dictated a capture, then corrected part of it. Combine them into ONE final capture sentence that says what they actually meant. Return ONLY that sentence — no quotes, no commentary.`,
    `Original: ${original}\nCorrection: ${correction}`,
    256,
  );
  return text.trim() || correction;
}

/* ── Pending meeting (confirm-gated booking) ────────────── */

export async function getPendingMeeting(): Promise<PendingMeeting | null> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  const m = log?.notes.pending_meeting;
  if (!m) return null;
  if (new Date(m.expires_at).getTime() < Date.now()) {
    await clearPendingMeeting();
    return null;
  }
  return m;
}

export async function setPendingMeeting(text: string, draft: MeetingDraft, description: string): Promise<void> {
  const m: PendingMeeting = {
    text,
    draft,
    description,
    expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
  };
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { pending_meeting: m });
}

export async function clearPendingMeeting(): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { pending_meeting: null });
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
  action: "delete" | "update" | "mark_paid" | "add_client_task" | "complete_client_task" | "none";
  target?: "receivable" | "income" | "client";
  id?: string;
  patch?: Record<string, unknown>;
  description?: string;
  reason?: string;
}

const RECEIVABLE_PATCH_KEYS = ["client", "description", "amount", "due_date", "status"];
const INCOME_PATCH_KEYS = ["source", "amount", "date"];

function clientOf(name: string): string {
  return name.split("—")[0].trim();
}

export async function proposeCommand(text: string): Promise<{ reply: string; proposed: boolean }> {
  if (!aiAvailable()) {
    return {
      reply: "I need an AI key to interpret edit commands — for now, use the checkboxes and click-to-edit on the Finance tab.",
      proposed: false,
    };
  }
  const store = getStore();
  const { listClientProjects } = await import("../clientProjects");
  const [receivables, income, projects] = await Promise.all([
    store.listReceivables(false),
    store.listIncome(2),
    listClientProjects(),
  ]);
  const activeProjects = projects.filter((p) => p.status !== "done");

  const records = [
    ...receivables.map(
      (r) =>
        `receivable | ${r.id} | ${r.client} | $${r.amount} | due ${r.due_date ?? "none"} | ${r.status}${r.description ? ` | ${r.description}` : ""}`,
    ),
    ...income.map((e) => `income | ${e.id} | ${e.source} | $${e.amount} | received ${e.date}`),
    ...activeProjects.map((p) => `client_project | ${p.id} | ${clientOf(p.name)} — ${p.name}`),
    ...activeProjects.flatMap((p) =>
      p.tasks.filter((t) => !t.done).map((t) => `client_task | ${t.id} | in project ${p.id} (${p.name}) | ${t.title}`),
    ),
  ].join("\n");

  // Maps for validation.
  const projectIds = new Set(activeProjects.map((p) => p.id));
  const taskToProject = new Map<string, string>();
  for (const p of activeProjects) for (const t of p.tasks) taskToProject.set(t.id, p.id);

  const today = localDateKey();
  const result = await llmJson<ProposedCommand>(
    `You translate a user's request into a single command over their records.
Records are given one per line: type | id | details.
Return JSON:
{"action": "delete" | "update" | "mark_paid" | "add_client_task" | "complete_client_task" | "none",
 "target": "receivable" | "income" | "client",
 "id": "<exact id from the list>",
 "patch": { changed/new fields only },
 "description": "one plain sentence describing EXACTLY what will happen"}
Rules:
- Money: patch keys for receivable = client, description, amount (number), due_date (YYYY-MM-DD), status ("expected"|"invoiced"); for income = source, amount, date. "mark_paid" (receivable only) books income; no patch.
- Client board:
  - "add_client_task": target "client", id = the client_project id to add to, patch = { "title": "...", "due": "YYYY-MM-DD" | null }. Match the project by client/name in the request.
  - "complete_client_task": target "client", id = the exact client_task id to check off.
- resolve relative dates against today.
- if ambiguous or nothing matches, return {"action":"none","reason":"..."}.
- NEVER invent an id.`,
    `Today is ${today}.\nRequest: ${text}\n\nRecords:\n${records || "(no records)"}`,
    768,
  );

  const cmd = result?.data;
  if (!cmd || cmd.action === "none" || !cmd.id || !cmd.target) {
    return {
      reply: cmd?.reason
        ? `I couldn't pin that down: ${cmd.reason}`
        : "I couldn't match that to a record. Try naming the client, task, or amount.",
      proposed: false,
    };
  }

  // ── Client-board actions ──
  if (cmd.action === "add_client_task") {
    if (cmd.target !== "client" || !projectIds.has(cmd.id)) {
      return { reply: "I couldn't tell which client project to add that to.", proposed: false };
    }
    const title = String((cmd.patch as { title?: unknown })?.title ?? "").trim();
    if (!title) return { reply: "What's the task you want to add?", proposed: false };
    const dueRaw = (cmd.patch as { due?: unknown })?.due;
    const due = typeof dueRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null;
    await setPendingCommand({
      action: "add_client_task", target: "client", id: cmd.id,
      patch: { title, due },
      description: cmd.description ?? `Add "${title}" to that client project`,
      expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    });
    return { reply: `${cmd.description ?? `Add "${title}"`}\n\nSay "confirm" and I'll add it — or "cancel".`, proposed: true };
  }
  if (cmd.action === "complete_client_task") {
    const projectId = taskToProject.get(cmd.id);
    if (cmd.target !== "client" || !projectId) {
      return { reply: "I couldn't match that to an open client task.", proposed: false };
    }
    await setPendingCommand({
      action: "complete_client_task", target: "client", id: cmd.id,
      patch: { projectId },
      description: cmd.description ?? "Check off that client task",
      expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
    });
    return { reply: `${cmd.description ?? "Check off that client task"}\n\nSay "confirm" and I'll do it — or "cancel".`, proposed: true };
  }

  // ── Money actions (existing) ──
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
  const { recordHistory } = await import("../history");

  // ── Client-board actions ──
  if (cmd.target === "client") {
    const { listClientProjects, saveClientProjects } = await import("../clientProjects");
    const projects = await listClientProjects();

    if (cmd.action === "add_client_task") {
      const p = projects.find((x) => x.id === cmd.id);
      if (!p) return "That client project no longer exists — nothing added.";
      const before = JSON.parse(JSON.stringify(p));
      const title = String(cmd.patch?.title ?? "").trim();
      const due = (cmd.patch?.due as string | null) ?? null;
      p.tasks.push({ id: crypto.randomUUID(), title, done: false, due });
      p.updated_at = new Date().toISOString();
      await saveClientProjects(projects);
      await recordHistory({
        action: "update", resource: "client_project", resource_id: p.id,
        label: `Client task added by Jarvis: ${title} (${clientOf(p.name)})`,
        before, after: p, source: "jarvis",
      });
      return `Done — added "${title}" to ${clientOf(p.name)}. (${cmd.description})`;
    }

    // complete_client_task
    const projectId = (cmd.patch?.projectId as string) ?? "";
    const p = projects.find((x) => x.id === projectId);
    if (!p) return "That client task no longer exists — nothing changed.";
    const task = p.tasks.find((t) => t.id === cmd.id);
    if (!task) return "That client task no longer exists — nothing changed.";
    const before = JSON.parse(JSON.stringify(p));
    task.done = true;
    p.updated_at = new Date().toISOString();
    await saveClientProjects(projects);
    await recordHistory({
      action: "update", resource: "client_project", resource_id: p.id,
      label: `Client task checked off by Jarvis: ${task.title} (${clientOf(p.name)})`,
      before, after: p, source: "jarvis",
    });
    return `Done — checked off "${task.title}" for ${clientOf(p.name)}. (${cmd.description})`;
  }

  if (cmd.target === "receivable") {
    const before = (await store.listReceivables(true)).find((r) => r.id === cmd.id) ?? null;
    if (cmd.action === "delete") {
      await store.deleteReceivable(cmd.id);
      await store.addAudit("jarvis_delete", "receivable", cmd.id);
      if (before) {
        await recordHistory({
          action: "delete", resource: "receivable", resource_id: cmd.id,
          label: `Jarvis: ${cmd.description}`, before, after: null, source: "jarvis",
        });
      }
      return `Done — deleted. (${cmd.description})`;
    }
    if (cmd.action === "mark_paid") {
      const existing = before;
      if (!existing) return "That receivable no longer exists — nothing to do.";
      if (existing.status !== "paid") {
        const today = localDateKey();
        const updated = await store.updateReceivable(cmd.id, { status: "paid", paid_at: today });
        const entry = await store.addIncome({
          date: today,
          source: `${existing.client}${existing.description ? ` — ${existing.description}` : ""}`,
          project_id: existing.project_id,
          amount: existing.amount,
          currency: existing.currency,
          kind: "project",
        });
        await recordHistory({
          action: "update", resource: "receivable", resource_id: cmd.id,
          label: `Jarvis marked paid: $${existing.amount.toLocaleString()} from ${existing.client}`,
          before: existing, after: updated, source: "jarvis",
        });
        await recordHistory({
          action: "create", resource: "income", resource_id: entry.id,
          label: `Income booked: $${entry.amount.toLocaleString()} from ${entry.source}`,
          before: null, after: entry, source: "jarvis",
        });
      }
      await store.addAudit("jarvis_paid", "receivable", cmd.id);
      return `Done — marked paid and booked $${(await store.listIncome(1))[0]?.amount.toLocaleString() ?? ""} as income.`;
    }
    const updated = await store.updateReceivable(cmd.id, cmd.patch ?? {});
    await store.addAudit("jarvis_update", "receivable", cmd.id, cmd.patch);
    if (updated && before) {
      await recordHistory({
        action: "update", resource: "receivable", resource_id: cmd.id,
        label: `Jarvis: ${cmd.description}`, before, after: updated, source: "jarvis",
      });
    }
    return updated ? `Done — updated. (${cmd.description})` : "That receivable no longer exists — nothing changed.";
  }

  // income
  const beforeIncome = (await store.listIncome(36)).find((e) => e.id === cmd.id) ?? null;
  if (cmd.action === "delete") {
    await store.deleteIncome(cmd.id);
    await store.addAudit("jarvis_delete", "income", cmd.id);
    if (beforeIncome) {
      await recordHistory({
        action: "delete", resource: "income", resource_id: cmd.id,
        label: `Jarvis: ${cmd.description}`, before: beforeIncome, after: null, source: "jarvis",
      });
    }
    return `Done — removed from the income log. (${cmd.description})`;
  }
  const updated = await store.updateIncome(cmd.id, cmd.patch ?? {});
  await store.addAudit("jarvis_update", "income", cmd.id, cmd.patch);
  if (updated && beforeIncome) {
    await recordHistory({
      action: "update", resource: "income", resource_id: cmd.id,
      label: `Jarvis: ${cmd.description}`, before: beforeIncome, after: updated, source: "jarvis",
    });
  }
  return updated ? `Done — updated. (${cmd.description})` : "That income entry no longer exists — nothing changed.";
}
