// Recurring tasks — day-of-week routines (e.g. trash Mon/Thu 9am) that
// auto-materialize into a day's Tasks when that day is opened, and show
// forward on the Schedule. Stored on the sentinel log.
import { addDays } from "./dates";
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type DayTask, type Routine } from "./types";

// Weekday of a YYYY-MM-DD key, timezone-stable (0=Sun … 6=Sat).
export function weekdayOf(dateKey: string): number {
  return new Date(dateKey + "T12:00:00Z").getUTCDay();
}

export async function listRoutines(): Promise<Routine[]> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  return log?.notes.routines ?? [];
}

async function saveRoutines(routines: Routine[]): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { routines });
}

export async function addRoutine(r: Omit<Routine, "id">): Promise<Routine[]> {
  const routines = await listRoutines();
  routines.push({ ...r, id: crypto.randomUUID() });
  await saveRoutines(routines);
  return routines;
}

export async function removeRoutine(id: string): Promise<Routine[]> {
  const routines = (await listRoutines()).filter((x) => x.id !== id);
  await saveRoutines(routines);
  return routines;
}

// Ensure every routine due on `date` exists in that day's tasks (idempotent).
// Returns the day's tasks after materializing.
export async function materializeForDay(date: string): Promise<DayTask[]> {
  const store = getStore();
  const [log, routines] = await Promise.all([store.getLog(date), listRoutines()]);
  const tasks: DayTask[] = log?.notes.day_tasks ?? [];
  const wd = weekdayOf(date);
  let added = false;
  for (const r of routines) {
    if (!r.days.includes(wd)) continue;
    if (tasks.some((t) => t.routineId === r.id)) continue;
    tasks.push({
      id: crypto.randomUUID(),
      title: r.title,
      time: r.time,
      done: false,
      routineId: r.id,
    });
    added = true;
  }
  if (added) {
    tasks.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
    await store.mergeLogNotes(date, { day_tasks: tasks });
  }
  return tasks;
}

// How many days back to sweep for un-done tasks. Covers a two-week gap of not
// opening the dashboard; tasks older than this stay put (never deleted), they
// just won't surface until swept.
const CARRY_LOOKBACK_DAYS = 14;

// Roll incomplete tasks from prior days forward onto `today`, tagged with the
// date they were originally due (→ shown as "overdue · was due …"). The origin
// day keeps only its completed / done-log entries.
//
// LOSS-PROOF ORDERING: tasks are written onto `today` FIRST, then removed from
// their origin days. If anything fails in between, the worst case is a task
// appearing on two days (a visible, recoverable duplicate) — never a task that
// vanishes. Dedup by the task's own id keeps re-runs idempotent, so a partial
// failure self-heals on the next sweep without duplicating.
export async function carryForwardInto(today: string): Promise<void> {
  const store = getStore();
  const carried: DayTask[] = [];
  const originDays: string[] = [];
  for (let i = 1; i <= CARRY_LOOKBACK_DAYS; i++) {
    const d = addDays(today, -i);
    const log = await store.getLog(d);
    const dt: DayTask[] = log?.notes.day_tasks ?? [];
    const incomplete = dt.filter((t) => !t.done && !t.fromWork);
    if (incomplete.length === 0) continue;
    for (const t of incomplete) {
      // Keep the task's id so re-carrying the same task can't duplicate it.
      carried.push({ ...t, routineId: undefined, carriedFrom: t.carriedFrom ?? d });
    }
    originDays.push(d);
  }
  if (carried.length === 0) return;

  // 1) Write onto today first, de-duping by id against what's already there.
  const todayLog = await store.getLog(today);
  const existing: DayTask[] = todayLog?.notes.day_tasks ?? [];
  const existingIds = new Set(existing.map((t) => t.id));
  const toAdd = carried.filter((t) => !existingIds.has(t.id));
  const merged = [...toAdd, ...existing];
  merged.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  await store.mergeLogNotes(today, { day_tasks: merged });

  // 2) Only now clear the carried tasks from their origin days.
  for (const d of originDays) {
    const log = await store.getLog(d);
    const dt: DayTask[] = log?.notes.day_tasks ?? [];
    await store.mergeLogNotes(d, { day_tasks: dt.filter((t) => t.done || t.fromWork) });
  }
}
