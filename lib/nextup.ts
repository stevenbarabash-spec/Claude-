// "What's next?" engine — hybrid: a deterministic priority score ranks every
// open task across the client board, the CRM, and today's day-tasks; then
// Claude re-sequences the shortlist (batching by client, weighing effort and
// time-of-day) and writes the reason each one earns its spot. If no AI key is
// present it falls back cleanly to the pure scoring order.
import { aiAvailable, llmJson } from "./ai/llm";
import { listClientProjects } from "./clientProjects";
import { config } from "./config";
import { localDateKey, localTime } from "./dates";
import { getStore } from "./store";
import type { DayTask, Urgency } from "./types";

export interface NextItem {
  id: string;
  source: "client" | "crm" | "day";
  title: string;
  who: string | null; // client / project / entity
  due: string | null; // YYYY-MM-DD
  when: string | null; // HH:MM for timed day-tasks
  score: number;
  reason: string; // why it ranks here (Claude's line, or the deterministic one)
  href: string; // where to act on it
}

function daysBetween(fromKey: string, toKey: string): number {
  const a = new Date(fromKey + "T12:00:00Z").getTime();
  const b = new Date(toKey + "T12:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

const URGENCY_BASE: Record<Urgency, number> = { today: 42, week: 26, month: 13, someday: 5 };

// Deterministic score + a plain-English reason from a due date.
function scoreDue(due: string | null, today: string): { score: number; reason: string } {
  if (!due) return { score: 0, reason: "" };
  const d = daysBetween(today, due); // negative = overdue
  if (d < 0) return { score: 120 + Math.min(60, -d * 8), reason: `overdue ${-d} day${-d === 1 ? "" : "s"}` };
  if (d === 0) return { score: 95, reason: "due today" };
  if (d === 1) return { score: 74, reason: "due tomorrow" };
  if (d <= 7) return { score: 62 - d * 4, reason: `due in ${d} days` };
  if (d <= 30) return { score: 30 - d * 0.6, reason: `due in ${d} days` };
  return { score: 8, reason: `due ${due}` };
}

function clientOf(name: string): string {
  return name.split("—")[0].trim();
}

// Gather + score every open item into one ranked pool.
export async function collectCandidates(): Promise<{ today: string; nowHHMM: string; items: NextItem[] }> {
  const store = getStore();
  const today = localDateKey();
  const nowHHMM = localTime();

  const [projects, tasks, log] = await Promise.all([
    listClientProjects(),
    store.listTasks(false),
    store.getLog(today),
  ]);

  const items: NextItem[] = [];

  // Client board tasks
  for (const p of projects) {
    if (p.status === "done") continue;
    for (const t of p.tasks) {
      if (t.done) continue;
      const dd = scoreDue(t.due, today);
      const noDue = t.due ? 0 : 14; // active client work matters even without a date
      items.push({
        id: `client:${t.id}`,
        source: "client",
        title: t.title,
        who: clientOf(p.name),
        due: t.due,
        when: null,
        score: dd.score + noDue + (p.status === "active" ? 6 : 0),
        reason: dd.reason || "client work",
        href: "/clients",
      });
    }
  }

  // CRM tasks
  for (const t of tasks) {
    const dd = scoreDue(t.due_date, today);
    const base = dd.score || URGENCY_BASE[t.urgency];
    items.push({
      id: `crm:${t.id}`,
      source: "crm",
      title: t.title,
      who: t.entity,
      due: t.due_date,
      when: null,
      score: base + (t.key ? 22 : 0),
      reason: dd.reason || `no due date · ${t.urgency}`,
      href: "/crm",
    });
  }

  // Today's day-tasks (all implicitly due today; a passed time bumps them)
  const dayTasks: DayTask[] = log?.notes.day_tasks ?? [];
  for (const t of dayTasks) {
    if (t.done) continue;
    const past = t.time !== null && t.time < nowHHMM;
    items.push({
      id: `day:${t.id}`,
      source: "day",
      title: t.title,
      who: null,
      due: today,
      when: t.time,
      score: (t.time ? 80 : 60) + (past ? 30 : 0),
      reason: t.time ? (past ? `was due ${t.time} today` : `today at ${t.time}`) : "on today's list",
      href: "/",
    });
  }

  items.sort((a, b) => b.score - a.score);
  return { today, nowHHMM, items };
}

export interface NextUpResult {
  items: NextItem[];
  headline: string | null;
  ai: boolean;
  generatedAt: string;
}

interface AiOrder {
  order: { id: string; why: string }[];
  headline: string;
}

export async function buildNextUp(limit = 6): Promise<NextUpResult> {
  const { today, nowHHMM, items } = await collectCandidates();
  const generatedAt = new Date().toISOString();

  if (items.length === 0) {
    return { items: [], headline: "Nothing open — clear runway.", ai: false, generatedAt };
  }

  // Deterministic fallback / shortlist to hand the model.
  const shortlist = items.slice(0, 14);
  const fallback: NextUpResult = { items: items.slice(0, limit), headline: null, ai: false, generatedAt };

  if (!aiAvailable()) return fallback;

  const lines = shortlist
    .map((it) => `${it.id} | ${it.title} | ${it.who ?? "—"} | ${it.reason} | score ${Math.round(it.score)}`)
    .join("\n");

  const result = await llmJson<AiOrder>(
    `You are ${config.owner.name}'s chief of staff. From the candidate tasks, choose the ${limit} they should tackle next, in order.
Rank by: what's overdue or due soonest, then impact, and BATCH tasks for the same client together so they don't context-switch. Consider it's ${nowHHMM} now — favor things that fit the time left in the workday.
Return JSON: {"headline": "one short motivating sentence about the top priority", "order": [{"id": "<exact id from the list>", "why": "<=12 words on why it's here now"}]}
Use ONLY ids from the list. Do not invent tasks.`,
    `Today is ${today}, time ${nowHHMM}.\nCandidates (id | title | client | timing | score):\n${lines}`,
    700,
  );

  if (!result?.data?.order?.length) return fallback;

  const byId = new Map(items.map((it) => [it.id, it]));
  const ordered: NextItem[] = [];
  for (const o of result.data.order) {
    const it = byId.get(o.id);
    if (it && !ordered.find((x) => x.id === it.id)) {
      ordered.push({ ...it, reason: o.why?.trim() || it.reason });
    }
    if (ordered.length >= limit) break;
  }
  if (ordered.length === 0) return fallback;

  return { items: ordered, headline: result.data.headline?.trim() || null, ai: true, generatedAt };
}
