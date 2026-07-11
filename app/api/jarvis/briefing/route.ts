// Morning briefing (guide §9, "going further") — generated on demand and cached
// in today's log so it costs one AI call per day.
import { NextResponse } from "next/server";
import { aiAvailable, llmText } from "@/lib/ai/llm";
import { config } from "@/lib/config";
import { addDays, localDateKey } from "@/lib/dates";
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

  const [tasks, goalsLog, yesterdayLog, financeLogs] = await Promise.all([
    store.listTasks(false),
    store.getLog("2000-01-01"),
    store.getLog(addDays(today, -1)),
    store.listLogs(40),
  ]);
  const todayTasks = tasks.filter((t) => t.urgency === "today");
  const goals = goalsLog?.notes.goals?.week ?? [];
  const habitsYesterday = yesterdayLog?.notes.habits?.done?.length ?? 0;
  const finance = financeLogs.find((l) => l.notes.finance)?.notes.finance;

  const { text } = await llmText(
    `You are Jarvis, ${config.owner.name}'s chief of staff. Write a crisp morning briefing: 3-5 short lines, no headers, no fluff. Prioritize what actually matters today.`,
    [
      `Today: ${today}`,
      `Today's tasks: ${todayTasks.map((t) => `${t.title}${t.key ? " (KEY)" : ""}`).join("; ") || "none filed"}`,
      `Week goals: ${goals.map((g) => `${g.text}${g.done ? " ✓" : ""}`).join("; ") || "none"}`,
      `Habits completed yesterday: ${habitsYesterday}/${config.habits.length}`,
      `Net worth (latest snapshot): ${finance ? `${finance.currency} ${finance.net_worth.toLocaleString()}` : "n/a"}`,
    ].join("\n"),
    512,
  );

  await store.mergeLogNotes(today, { briefing: { text, generated_at: new Date().toISOString() } });
  return NextResponse.json({ briefing: text, cached: false });
}
