// Seed data so the dashboard looks alive on first run with the local store.
// Everything here is fake and clearly disposable — clear .data/store.json to reset.
import { addDays, localDateKey } from "./dates";
import type { DailyLog, IncomeEntry, Project, Receivable, Task } from "./types";
import { GOALS_SENTINEL_DATE } from "./types";

function iso(d: string): string {
  return d + "T12:00:00.000Z";
}

function monthStart(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return d.toLocaleDateString("en-CA");
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
    task("Send Acme milestone 2 invoice", "today", { key: true, entity: "Acme", tags: ["blocker", "hot"], owner: "Steven" }),
    task("Intro call — waiting on ref check", "today", { entity: "Atlas", tags: ["crm"] }),
    task("Partnership proposal draft", "week", { entity: "Relay", tags: ["crm", "warm"] }),
    task("Quarterly catch-up + update deck", "week", { entity: "Northlake Capital", tags: ["crm"] }),
    task("Chase Atlas overdue invoice", "week", { entity: "Atlas", tags: ["blocker", "warm"], owner: "Steven" }),
    task("Design crit on finance tab", "month", { entity: "Design", tags: ["product"] }),
    task("Compress view for stale tasks", "someday", { tags: ["product"] }),
  ];

  // ── Cash-flow demo (projects → receivables → income) ──
  const now = () => new Date().toISOString();
  const project = (name: string, client: string, kind: Project["kind"], value: number, status: Project["status"] = "active"): Project => ({
    id: crypto.randomUUID(),
    name,
    client,
    status,
    kind,
    value,
    currency: "USD",
    notes: null,
    created_at: now(),
    updated_at: now(),
  });

  const pDashboard = project("Dashboard build", "Acme", "fixed", 12000);
  const pRetainer = project("Advisory retainer", "Northlake Capital", "retainer", 3000);
  const pBrand = project("Brand site", "Relay", "fixed", 8000);
  const pContent = project("Content sprint", "Atlas", "fixed", 4500, "done");
  const projects = [pDashboard, pRetainer, pBrand, pContent];

  const income: IncomeEntry[] = [];
  const pay = (date: string, source: string, amount: number, kind: IncomeEntry["kind"], project_id: string | null) =>
    income.push({ id: crypto.randomUUID(), date, source, project_id, amount, currency: "USD", kind, created_at: now() });

  // Retainer lands on the 1st of each month, including this one.
  for (let m = -5; m <= 0; m++) pay(monthStart(m), "Northlake Capital — retainer", 3000, "retainer", pRetainer.id);
  pay(addDays(monthStart(-2), 11), "Atlas — content sprint", 4500, "project", pContent.id);
  pay(addDays(monthStart(-1), 7), "Acme — milestone 1", 6000, "project", pDashboard.id);
  pay(addDays(monthStart(0), 2), "Relay — brand site deposit", 4000, "project", pBrand.id);

  const receivable = (
    client: string,
    description: string,
    amount: number,
    due: string,
    status: Receivable["status"],
    project_id: string | null,
  ): Receivable => ({
    id: crypto.randomUUID(),
    project_id,
    client,
    description,
    amount,
    currency: "USD",
    status,
    invoiced_at: status === "invoiced" ? addDays(due, -14) : null,
    due_date: due,
    paid_at: null,
    created_at: now(),
    updated_at: now(),
  });

  const receivables: Receivable[] = [
    receivable("Acme", "Milestone 2 — dashboard build", 6000, addDays(today, 10), "invoiced", pDashboard.id),
    receivable("Relay", "Brand site — final payment", 4000, addDays(monthStart(1), 14), "expected", pBrand.id),
    receivable("Atlas", "Content sprint — usage bonus", 500, addDays(today, -5), "invoiced", pContent.id),
  ];

  // ── Daily logs: habits + nutrition history ──
  const logs: Record<string, DailyLog> = {};
  for (let i = 1; i <= 5; i++) {
    const date = addDays(today, -i);
    logs[date] = {
      log_date: date,
      notes: {
        habits: { done: ["train", "deep-work", "read"].slice(0, 1 + (i % 3)) },
        nutrition: {
          meals: [
            { id: crypto.randomUUID(), t: "08:30", n: "Eggs, toast, coffee", kcal: 520, p: 32, c: 45, f: 22, estimated: true },
            { id: crypto.randomUUID(), t: "13:00", n: "Chicken rice bowl", kcal: 700, p: 55, c: 80, f: 16, estimated: true },
            { id: crypto.randomUUID(), t: "18:30", n: "Salmon, potatoes, veg", kcal: 640, p: 42, c: 50, f: 28, estimated: true },
          ],
        },
      },
      mood: null,
      updated_at: iso(date),
    };
  }

  logs[GOALS_SENTINEL_DATE] = {
    log_date: GOALS_SENTINEL_DATE,
    notes: {
      goals: {
        week: [
          { id: crypto.randomUUID(), text: "Ship essay", done: false },
          { id: crypto.randomUUID(), text: "Invoice Acme milestone 2", done: false },
          { id: crypto.randomUUID(), text: "Collect Atlas overdue $500", done: false },
        ],
        month: [
          { id: crypto.randomUUID(), text: "Launch dashboard v1", done: false },
          { id: crypto.randomUUID(), text: "$15k collected", done: false },
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
    projects,
    income,
    receivables,
  };
}
