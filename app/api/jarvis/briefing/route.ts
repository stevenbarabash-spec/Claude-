// Morning briefing (guide §9, "going further") — generated on demand and cached
// in today's log so it costs one AI call per day.
import { NextResponse } from "next/server";
import { aiAvailable, llmText } from "@/lib/ai/llm";
import { config } from "@/lib/config";
import { addDays, localDateKey } from "@/lib/dates";
import { getHabitDefs } from "@/lib/habits";
import { getStore } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";
  const store = getStore();
  const today = localDateKey();
  const log = await store.getLog(today);

  if (!force && log?.notes.briefing) {
    return NextResponse.json({ briefing: log.notes.briefing.text, cached: true });
  }
  if (!aiAvailable()) {
    return NextResponse.json({ briefing: null, cached: false });
  }

  const [tasks, goalsLog, yesterdayLog, income, receivables] = await Promise.all([
    store.listTasks(false),
    store.getLog("2000-01-01"),
    store.getLog(addDays(today, -1)),
    store.listIncome(1),
    store.listReceivables(false),
  ]);
  const todayTasks = tasks.filter((t) => t.urgency === "today");
  const goals = goalsLog?.notes.goals?.week ?? [];
  const habitsYesterday = yesterdayLog?.notes.habits?.done?.length ?? 0;
  const thisMonth = today.slice(0, 7);
  const receivedThisMonth = income.filter((e) => e.date.startsWith(thisMonth)).reduce((a, e) => a + e.amount, 0);
  const owed = receivables.reduce((a, r) => a + r.amount, 0);
  const overdue = receivables.filter((r) => r.due_date && r.due_date < today);

  const { text } = await llmText(
    `You are Jarvis, ${config.owner.name}'s chief of staff. Write a crisp morning briefing: 3-5 short lines, no headers, no fluff. Prioritize what actually matters today — overdue money always matters.`,
    [
      `Today: ${today}`,
      `Today's tasks: ${todayTasks.map((t) => `${t.title}${t.key ? " (KEY)" : ""}`).join("; ") || "none filed"}`,
      `Week goals: ${goals.map((g) => `${g.text}${g.done ? " ✓" : ""}`).join("; ") || "none"}`,
      `Habits completed yesterday: ${habitsYesterday}/${(await getHabitDefs()).length}`,
      `Money: received $${receivedThisMonth.toLocaleString()} this month; owed $${owed.toLocaleString()} across ${receivables.length} receivables${overdue.length ? `; OVERDUE: ${overdue.map((r) => `${r.client} $${r.amount.toLocaleString()}`).join(", ")}` : ""}`,
    ].join("\n"),
    512,
  );

  await store.mergeLogNotes(today, { briefing: { text, generated_at: new Date().toISOString() } });
  return NextResponse.json({ briefing: text, cached: false });
}
