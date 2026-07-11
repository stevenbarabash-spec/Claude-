// Seed data so the dashboard looks alive on first run with the local store.
// Everything here is fake and clearly disposable — clear .data/store.json to reset.
import { addDays, localDateKey } from "./dates";
import type { DailyLog, FinanceSnapshot, Task } from "./types";
import { GOALS_SENTINEL_DATE } from "./types";

function iso(d: string): string {
  return d + "T12:00:00.000Z";
}

export function seedData() {
  const today = localDateKey();
  let score = 1000;
  const task = (
    title: string,
    urgency: Task["urgency"],
    opts: Partial<Task> = {},
  ): Task => ({
    id: crypto.randomUUID(),
    title,
    description: opts.description ?? null,
    urgency,
    key: opts.key ?? false,
    priority_score: (score -= 10),
    time_estimate_min: opts.time_estimate_min ?? null,
    tags: opts.tags ?? [],
    due_date: opts.due_date ?? null,
    owner: opts.owner ?? null,
    entity: opts.entity ?? null,
    completed_at: opts.completed_at ?? null,
    created_at: iso(addDays(today, -7)),
    updated_at: iso(addDays(today, -1)),
    ...opts,
  });

  const tasks: Task[] = [
    task("Ship weekly essay", "today", { key: true, tags: ["content"], time_estimate_min: 90 }),
    task("Close term sheet review", "today", { key: true, entity: "Northlake Capital", tags: ["blocker", "hot"], owner: "Steven" }),
    task("Intro call — waiting on ref check", "today", { entity: "Atlas", tags: ["crm"] }),
    task("Partnership proposal draft", "week", { entity: "Relay", tags: ["crm", "warm"] }),
    task("Quarterly catch-up + update deck", "week", { entity: "Investor group", tags: ["crm"] }),
    task("Finance snapshot automation", "week", { tags: ["blocker", "warm"], owner: "Steven" }),
    task("Design crit on finance tab", "month", { entity: "Design", tags: ["product"] }),
    task("Compress view for stale tasks", "someday", { tags: ["product"] }),
  ];

  const financeMonths: [string, number, number, number, number][] = [
    // date, net worth, liquid, invested, liabilities
    [addDays(today, -210), 982400, 221800, 742000, 65000],
    [addDays(today, -180), 1014200, 232100, 769500, 63100],
    [addDays(today, -150), 1062800, 241400, 810800, 61200],
    [addDays(today, -120), 1108300, 258000, 840300, 59200],
    [addDays(today, -90), 1154100, 264200, 881900, 57400],
    [addDays(today, -60), 1198200, 272400, 918100, 55800],
    [addDays(today, -30), 1248920, 284500, 962420, 54200],
    [today, 1262400, 287900, 973100, 52600],
  ];

  const logs: Record<string, DailyLog> = {};
  for (const [date, net, liquid, invested, liabilities] of financeMonths) {
    const snapshot: FinanceSnapshot = {
      net_worth: net,
      currency: "USD",
      as_of: date,
      liquid,
      invested,
      liabilities,
      categories: [
        { name: "Checking", value: Math.round(liquid * 0.3), kind: "liquid" },
        { name: "HYSA", value: Math.round(liquid * 0.55), kind: "liquid" },
        { name: "Stables", value: Math.round(liquid * 0.15), kind: "liquid" },
        { name: "Index funds", value: Math.round(invested * 0.55), kind: "invested" },
        { name: "Equities", value: Math.round(invested * 0.3), kind: "invested" },
        { name: "Crypto", value: Math.round(invested * 0.15), kind: "invested" },
        { name: "CC float", value: Math.round(liabilities * 0.2), kind: "liability" },
        { name: "Car lease", value: Math.round(liabilities * 0.8), kind: "liability" },
      ],
      source: "demo",
    };
    logs[date] = {
      log_date: date,
      notes: { finance: snapshot },
      mood: null,
      updated_at: iso(date),
    };
  }

  // A few days of habit/nutrition history for the health tab.
  for (let i = 1; i <= 5; i++) {
    const date = addDays(today, -i);
    const existing = logs[date] ?? { log_date: date, notes: {}, mood: null, updated_at: iso(date) };
    existing.notes.habits = { done: ["train", "deep-work", "read"].slice(0, 1 + (i % 3)) };
    existing.notes.nutrition = {
      meals: [
        { id: crypto.randomUUID(), t: "08:30", n: "Eggs, toast, coffee", kcal: 520, p: 32, c: 45, f: 22, estimated: true },
        { id: crypto.randomUUID(), t: "13:00", n: "Chicken rice bowl", kcal: 700, p: 55, c: 80, f: 16, estimated: true },
        { id: crypto.randomUUID(), t: "18:30", n: "Salmon, potatoes, veg", kcal: 640, p: 42, c: 50, f: 28, estimated: true },
      ],
    };
    logs[date] = existing;
  }

  logs[GOALS_SENTINEL_DATE] = {
    log_date: GOALS_SENTINEL_DATE,
    notes: {
      goals: {
        week: [
          { id: crypto.randomUUID(), text: "Ship essay", done: false },
          { id: crypto.randomUUID(), text: "Close term sheet review", done: false },
          { id: crypto.randomUUID(), text: "Finance snapshot live", done: false },
        ],
        month: [
          { id: crypto.randomUUID(), text: "Launch dashboard v1", done: false },
          { id: crypto.randomUUID(), text: "3 partnership calls", done: false },
        ],
      },
    },
    mood: null,
    updated_at: iso(today),
  };

  return {
    tasks,
    logs,
    captures: [],
    memory: [],
    audit: [],
  };
}
