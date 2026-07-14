// Apple Reminders / Siri import — classify an incoming reminder and route it to
// the right home in WARROOM, following the locked cascade:
//   1. names a known client        → that client's board
//   2. chore / kids / doctor        → Home Chores board
//   3. "due today" / "add to tasks" → Section 10 (Tasks · Today)
//   4. anything unsure              → Project Miscellaneous
// A "due today" item also lands in Section 10 on top of its board (client/home).
import { clientOf, listClientProjects, projectOf, saveClientProjects } from "./clientProjects";
import { addDays, localDateKey } from "./dates";
import { recordHistory } from "./history";
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type ClientProject, type ClientTask, type DayTask } from "./types";

export interface IncomingReminder {
  id: string; // Apple's stable reminder id — used for dedup
  text: string;
  due?: string | null; // ISO or YYYY-MM-DD from the Reminders due date
  notes?: string | null;
}

export interface ImportOutcome {
  id: string;
  title: string;
  routedTo: string; // human-readable destination
  alsoToday: boolean; // additionally added to Section 10
  duplicate?: boolean;
}

const CHORE = /\b(trash|garbage|recycl\w*|clean\w*|car\s?wash|wash the car|\bgas\b|fill\s?up|lawn|mow\w*|laundry|grocer\w*|dishes|vacuum|yard|dry\s?clean\w*|oil change|home\s?depot|light bulb|change the|take out)\b/i;
const KIDS = /\b(kid|kids|son|daughter|child\w*|school|daycare|day\s?care|pick\s?up|drop\s?off|soccer|baseball|practice|piano|playdate|play\s?date|homework|carpool)\b/i;
const APPT = /\b(doctor|dentist|dr\.?|appointment|appt|check\s?up|physical|\bvet\b|clinic|orthodont\w*|dermatolog\w*|pediatric\w*|specialist)\b/i;
const TODAY_PHRASE = /\b(due today|today|add to my tasks|add to tasks|tasks due today|for today)\b/i;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isHome(text: string): boolean {
  return CHORE.test(text) || KIDS.test(text) || APPT.test(text);
}

// Find a project by a loose name match on its client/full name (e.g. "Home Chores").
function findNamedProject(projects: ClientProject[], re: RegExp): ClientProject | undefined {
  return projects.find((p) => re.test(p.name));
}

// Generic words that shouldn't alone trigger a client match.
const CLIENT_STOP = new Set([
  "the", "and", "for", "get", "back", "website", "redesign", "support", "funnel",
  "newsletter", "group", "company", "restaurant", "entertainment", "media", "studio",
  "project", "client", "services", "prospecting", "inc", "llc", "e-bike", "ebike",
]);

// Which client project (if any) this reminder names. Skips the Home/Misc buckets.
// Matches on the full client name OR a distinctive brand word (e.g. "Hydrogel"
// from "Get Hydrogel — Funnel", "BYTOX", "Greenwich"). Longest match wins.
function matchClient(text: string, projects: ClientProject[]): ClientProject | undefined {
  const t = normalize(text);
  let best: { p: ClientProject; len: number } | undefined;
  for (const p of projects) {
    if (/home\s?chores|miscellaneous/i.test(p.name)) continue;
    const client = normalize(clientOf(p.name));
    const keywords = new Set<string>();
    if (client.length >= 3) keywords.add(client); // full client phrase
    for (const w of client.split(" ")) {
      if (w.length >= 4 && !CLIENT_STOP.has(w)) keywords.add(w); // distinctive brand word
    }
    for (const kw of keywords) {
      const re = new RegExp(`\\b${kw.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (re.test(t) && (!best || kw.length > best.len)) best = { p, len: kw.length };
    }
  }
  return best?.p;
}

// A stable dedup id: use Apple's id when the Shortcut sends one, else synthesize
// from the text + due so re-running the same reminder doesn't double-file.
function reminderId(r: IncomingReminder): string {
  if (r.id && r.id.trim()) return r.id.trim();
  return `syn:${normalize(r.text)}|${(r.due ?? "").slice(0, 10)}`;
}

// Resolve the due date: explicit reminder due wins (any format Apple sends),
// else parse today/tomorrow/weekday from the text.
function resolveDue(r: IncomingReminder, today: string): string | null {
  if (r.due && /^\d{4}-\d{2}-\d{2}/.test(r.due)) return r.due.slice(0, 10);
  if (r.due && r.due.trim()) {
    const s = r.due.trim();
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      const d = new Date(parsed);
      // date-only string (no clock time) → use UTC parts so the calendar day
      // isn't shifted by the timezone conversion.
      if (!/\d:\d/.test(s)) {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      }
      return localDateKey(d);
    }
  }
  const t = normalize(r.text);
  if (/\btoday\b/.test(t)) return today;
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b${WEEKDAYS[i]}\\b`).test(t)) {
      // next occurrence of that weekday (today counts)
      const todayDow = new Date(today + "T12:00:00Z").getUTCDay();
      const delta = (i - todayDow + 7) % 7;
      return addDays(today, delta);
    }
  }
  return null;
}

// Strip trigger phrases and filler so the stored title is clean.
function cleanTitle(text: string): string {
  return text
    .replace(/^\s*(remind me to|reminder to|remember to|to)\s+/i, "")
    .replace(/\b(and )?(please )?(add (it )?to my tasks|add to tasks|due today|for today)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[\s,;:.\-]+$/, "") // trailing punctuation left by removed trigger phrases
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

async function getImportedIds(): Promise<Set<string>> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  return new Set(log?.notes.imported_reminders ?? []);
}

async function markImported(ids: string[]): Promise<void> {
  const existing = await getImportedIds();
  for (const id of ids) existing.add(id);
  // keep the last 500 to bound growth
  const arr = [...existing].slice(-500);
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { imported_reminders: arr });
}

async function addClientTask(project: ClientProject, task: ClientTask, projects: ClientProject[]): Promise<void> {
  const before = JSON.parse(JSON.stringify(project)) as ClientProject;
  project.tasks = [...project.tasks, task];
  project.updated_at = new Date().toISOString();
  await saveClientProjects(projects);
  await recordHistory({
    action: "update",
    resource: "client_project",
    resource_id: project.id,
    label: `Reminder imported: ${task.title} → ${clientOf(project.name)}`,
    before,
    after: project,
    source: "jarvis",
  });
}

async function addDayTask(today: string, title: string, time: string | null): Promise<void> {
  const store = getStore();
  const log = await store.getLog(today);
  const before: DayTask[] = log?.notes.day_tasks ?? [];
  const tasks: DayTask[] = [...before, { id: crypto.randomUUID(), title, time, done: false }];
  tasks.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  await store.mergeLogNotes(today, { day_tasks: tasks });
  await recordHistory({
    action: "create",
    resource: "day_tasks",
    resource_id: today,
    label: `Reminder imported to today: ${title}`,
    before,
    after: tasks,
    source: "jarvis",
  });
}

// Import one batch of reminders. Idempotent per reminder id.
export async function importReminders(reminders: IncomingReminder[]): Promise<ImportOutcome[]> {
  const today = localDateKey();
  const seen = await getImportedIds();
  const projects = await listClientProjects();
  const home = findNamedProject(projects, /home\s?chores/i);
  const misc = findNamedProject(projects, /miscellaneous/i);
  const outcomes: ImportOutcome[] = [];
  const newlyImported: string[] = [];

  for (const r of reminders) {
    if (!r.text?.trim()) continue;
    const id = reminderId(r);
    if (seen.has(id)) {
      outcomes.push({ id, title: r.text.trim(), routedTo: "already imported", alsoToday: false, duplicate: true });
      continue;
    }
    const title = cleanTitle(r.text);
    const due = resolveDue(r, today);
    const isToday = due === today || TODAY_PHRASE.test(r.text);

    const client = matchClient(r.text, projects);
    let routedTo: string;
    let board: ClientProject | undefined;

    if (client) {
      board = client;
    } else if (isHome(r.text)) {
      board = home ?? misc; // Home Chores if it exists, else Miscellaneous
    } else if (!isToday) {
      board = misc; // rule 4 — unsure
    }

    if (board) {
      await addClientTask(board, { id: crypto.randomUUID(), title, done: false, due }, projects);
      routedTo = clientOf(board.name);
    } else {
      // rule 3 — "due today" with no client/home match, or no Misc project exists
      await addDayTask(today, title, null);
      routedTo = "Tasks · Today";
    }

    // A "due today" board item also shows in Section 10.
    const alsoToday = Boolean(board) && isToday;
    if (alsoToday) await addDayTask(today, title, null);

    outcomes.push({ id, title, routedTo, alsoToday });
    newlyImported.push(id);
  }

  if (newlyImported.length) await markImported(newlyImported);
  return outcomes;
}
