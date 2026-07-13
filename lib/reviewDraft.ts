// "Draft my week" — assembles the week's real data (completions, overdue,
// open loops, follow-ups, content, health, next-up) and has Claude write the
// weekly-review fields. Falls back to plain bulleted lists without an AI key.
// Nothing is sent anywhere; it just pre-fills the Review tab.
import { aiAvailable, llmJson } from "./ai/llm";
import { listClientProjects } from "./clientProjects";
import { config } from "./config";
import { addDays, localDateKey } from "./dates";
import { listHistory } from "./history";
import { collectCandidates } from "./nextup";
import { getStore } from "./store";
import type { WeeklyReview } from "./types";

type Draft = Omit<WeeklyReview, "sealed">;

const CONTENT_RE = /newsletter|essay|content|video|post|blog|article|podcast|reel|short|episode|thread/i;

export async function buildReviewDraft(): Promise<Draft> {
  const store = getStore();
  const today = localDateKey();
  const since = addDays(today, -7);

  const [logs, history, projects, openTasks, candidates] = await Promise.all([
    store.listLogs(10),
    listHistory(),
    listClientProjects(),
    store.listTasks(false),
    collectCandidates(),
  ]);

  // Completed this week — from History and the day-log done-list.
  const completions = history
    .filter((e) => e.ts.slice(0, 10) >= since && /(completed|checked off)/i.test(e.label))
    .map((e) => e.label.replace(/^[^:]*:\s*/, ""));
  const doneDayTasks = logs
    .filter((l) => l.log_date >= since && l.log_date <= today)
    .flatMap((l) => (l.notes.day_tasks ?? []).filter((t) => t.done).map((t) => t.title));
  const completed = [...new Set([...completions, ...doneDayTasks])].slice(0, 25);

  // Overdue / open across CRM + client board.
  const overdueCrm = openTasks.filter((t) => t.due_date && t.due_date < today).map((t) => t.title);
  const clientOpen = projects
    .filter((p) => p.status !== "done")
    .flatMap((p) =>
      p.tasks.filter((t) => !t.done).map((t) => ({ title: t.title, client: p.name.split("—")[0].trim(), overdue: Boolean(t.due && t.due < today) })),
    );
  const overdue = [...overdueCrm, ...clientOpen.filter((t) => t.overdue).map((t) => `${t.title} (${t.client})`)].slice(0, 20);
  const open = [...openTasks.map((t) => t.title).slice(0, 15), ...clientOpen.map((t) => `${t.title} (${t.client})`).slice(0, 15)];

  const followUps = [...new Set([...clientOpen.map((t) => t.client), ...openTasks.map((t) => t.entity).filter((e): e is string => Boolean(e))])].slice(0, 15);
  const content = completed.filter((t) => CONTENT_RE.test(t)).slice(0, 15);

  // Health: habit-logged days + average calories vs target this week.
  let habitDays = 0;
  let kcalTotal = 0;
  let kcalDays = 0;
  for (const l of logs.filter((l) => l.log_date >= since && l.log_date <= today)) {
    if ((l.notes.habits?.done?.length ?? 0) > 0) habitDays++;
    const meals = l.notes.nutrition?.meals ?? [];
    if (meals.length) {
      kcalTotal += meals.reduce((a, m) => a + m.kcal, 0);
      kcalDays++;
    }
  }
  const avgKcal = kcalDays ? Math.round(kcalTotal / kcalDays) : 0;

  const nextTop3 = candidates.items
    .slice(0, 3)
    .map((it, i) => `${i + 1}) ${it.title}${it.who ? ` (${it.who})` : ""}`)
    .join("   ");

  const raw = {
    completed,
    overdue,
    open,
    followUps,
    content,
    health: { habitDays, avgKcal, kcalTarget: config.nutrition.kcalTarget },
    nextTop3,
  };

  if (!aiAvailable()) {
    const bullets = (a: string[]) => (a.length ? a.map((x) => `• ${x}`).join("\n") : "");
    return {
      wins: bullets(completed),
      slipped: bullets(overdue),
      open_loops: bullets(open),
      follow_ups: bullets(followUps),
      content_shipped: bullets(content),
      health_pattern: habitDays
        ? `Habits logged on ${habitDays} day${habitDays === 1 ? "" : "s"}. Avg ${avgKcal} kcal vs ${config.nutrition.kcalTarget} target.`
        : "",
      next_top3: nextTop3,
    };
  }

  const result = await llmJson<Draft>(
    `You are ${config.owner.name}'s chief of staff, drafting his weekly review from real data. Write each field concisely in his voice — punchy, first-person, short bullet lines where it helps. Use ONLY what's in the data; if a field has nothing, return an empty string for it. Return JSON with exactly these keys: wins, slipped, open_loops, follow_ups, content_shipped, health_pattern, next_top3.`,
    JSON.stringify(raw),
    1200,
  );
  const d = result?.data;
  return {
    wins: d?.wins ?? "",
    slipped: d?.slipped ?? "",
    open_loops: d?.open_loops ?? "",
    follow_ups: d?.follow_ups ?? "",
    content_shipped: d?.content_shipped ?? "",
    health_pattern: d?.health_pattern ?? "",
    next_top3: d?.next_top3 || nextTop3,
  };
}
