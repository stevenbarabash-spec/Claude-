export type Urgency = "today" | "week" | "month" | "someday";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  urgency: Urgency;
  key: boolean;
  priority_score: number;
  time_estimate_min: number | null;
  tags: string[];
  due_date: string | null;
  owner: string | null;
  entity: string | null; // person/company this relates to
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Meal {
  id: string;
  t: string; // HH:MM
  n: string; // name
  kcal: number;
  p: number;
  c: number;
  f: number;
  estimated: boolean;
}

export interface GoalItem {
  id: string;
  text: string;
  done: boolean;
}

// ── Monthly cash-flow model ──────────────────────────────
export type ProjectStatus = "active" | "paused" | "done";
export type ProjectKind = "fixed" | "retainer" | "hourly";

export interface Project {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
  kind: ProjectKind;
  // fixed: total contract value · retainer: amount per month · hourly: rate
  value: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncomeEntry {
  id: string;
  date: string; // YYYY-MM-DD received
  source: string;
  project_id: string | null;
  amount: number;
  currency: string;
  kind: "project" | "retainer" | "other";
  created_at: string;
}

export type ReceivableStatus = "expected" | "invoiced" | "paid";

export interface Receivable {
  id: string;
  project_id: string | null;
  client: string;
  description: string | null;
  amount: number;
  currency: string;
  status: ReceivableStatus;
  invoiced_at: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReview {
  wins: string;
  slipped: string;
  open_loops: string;
  follow_ups: string;
  content_shipped: string;
  health_pattern: string;
  next_top3: string;
  sealed: boolean;
}

export interface HabitDef {
  id: string;
  label: string;
  category: string;
}

// ── Client work (migrated from the schedule-tracker) ──
// One tracked work session on a task (for time-spent / hourly billing).
export interface WorkSession {
  start: string; // ISO
  end: string; // ISO
}

export interface ClientTask {
  id: string;
  title: string;
  done: boolean;
  due: string | null; // YYYY-MM-DD
  time?: string | null; // HH:MM (24h) — optional clock time, carried into Section 10
  recurringId?: string; // materialized from a ClientRecurring definition
  sessions?: WorkSession[]; // logged work sessions — total = billable time spent
}

// A recurring task on a client project — weekly (by weekday) or monthly (by day
// of month). Materializes into the project's tasks on its due dates.
export interface ClientRecurring {
  id: string;
  title: string;
  cadence: "weekly" | "monthly";
  weekdays?: number[]; // weekly: 0=Sun … 6=Sat
  dayOfMonth?: number; // monthly: 1-31 (clamped to the last day of short months)
  time?: string | null; // HH:MM
}

export interface ClientIteration {
  date: string;
  note: string;
}

export interface ClientProject {
  id: string;
  name: string; // "Client — Project"
  status: "active" | "done" | "paused";
  progress: number; // 0-100
  phase: string | null;
  deadline: string | null;
  next_milestone: string | null;
  team: string[];
  budget: string | null;
  iterations: ClientIteration[];
  tasks: ClientTask[];
  recurring?: ClientRecurring[]; // per-project recurring task definitions
  created_at: string;
  updated_at: string;
}

// Quick daily to-dos with an optional clock time ("BYTOX — send draft @ 3 PM").
// They live on the day's log, so each day starts with a fresh list.
export interface DayTask {
  id: string;
  title: string;
  time: string | null; // HH:MM (24h) or null = anytime today
  done: boolean;
  startedAt?: string; // ISO — set when finished via Currently Working On
  finishedAt?: string; // ISO — set when finished via Currently Working On
  fromWork?: boolean; // logged here by completing a Currently Working On item
  routineId?: string; // materialized from a recurring Routine
  carriedFrom?: string; // rolled forward from this earlier date, undone → "overdue"
  ref?: string; // source key (e.g. "client:<id>") — dedups repeated pulls into today
}

// A recurring task that auto-appears on its weekdays (e.g. trash Mon/Thu 9am).
export interface Routine {
  id: string;
  title: string;
  days: number[]; // 0=Sun … 6=Sat
  time: string | null; // HH:MM
}

export interface DailyNotes {
  focus?: string;
  day_tasks?: DayTask[];
  habits?: { done: string[] };
  habit_defs?: HabitDef[]; // only on sentinel date — user-editable habit list
  client_projects?: ClientProject[]; // only on sentinel date — the client work board
  nutrition?: { meals: Meal[] };
  goals?: { week: GoalItem[]; month: GoalItem[] }; // only on sentinel date
  review?: WeeklyReview; // only on week-anchor (Monday) dates
  briefing?: { text: string; generated_at: string };
  pending_command?: PendingCommand | null; // only on sentinel date — awaiting "confirm"
  pending_capture?: PendingCapture | null; // only on sentinel date — awaiting "confirm"
  history?: HistoryEvent[]; // only on the history sentinel date
  muted_events?: string[]; // only on sentinel date — calendar series UIDs to hide
  working_on?: WorkingItem[]; // only on sentinel date — the Currently Working On strip
  feature_requests?: FeatureRequest[]; // only on sentinel date — the idea parking lot
  routines?: Routine[]; // only on sentinel date — recurring day-of-week tasks
  builds?: BuildRequest[]; // only on sentinel date — Build Console request log
  tickers?: TickerSymbol[]; // only on sentinel date — the header ticker watchlist
  imported_reminders?: string[]; // only on sentinel date — Apple Reminder ids already imported (dedup)
}

// A market symbol shown in the header ticker (Yahoo Finance symbol + label).
export interface TickerSymbol {
  symbol: string; // Yahoo symbol, e.g. "^GSPC", "XRP-USD", "AAPL"
  label: string; // display name, e.g. "S&P 500", "XRP"
}

// A capture Jarvis has understood and read back, but not yet filed.
export interface PendingCapture {
  text: string; // the capture text that will run through the pipeline on confirm
  description: string; // human-readable "here's what I'll file"
  expires_at: string;
}

// A task the user pulled from Next Up into "Currently Working On". Carries the
// routing back to its real home so "Done" checks it off at the source.
export interface WorkingItem {
  key: string; // NextItem composite id (e.g. "client:g1") — dedup key
  source: "client" | "crm" | "day";
  title: string;
  who: string | null;
  href: string;
  taskId: string; // underlying task id
  projectId?: string; // client-board tasks
  date?: string; // day-task log date
  startedAt: string; // ISO
  status?: "pending" | "active"; // pending = staged, awaiting Confirm (default active)
}

// A feature request submitted from the in-WARROOM Build Console.
export interface BuildRequest {
  id: string;
  text: string;
  status: "requested" | "building" | "shipped" | "failed" | "reverted";
  createdAt: string;
  issueUrl?: string; // GitHub issue that drives the autonomous build
  note?: string; // status detail (error, PR link, etc.)
}

// A parked idea for improving the dashboard — reviewed later, not a task.
export interface FeatureRequest {
  id: string;
  text: string;
  status: "new" | "considering" | "planned" | "passed";
  source: "you" | "claude";
  created_at: string;
}

// ── Change history (lives on its own sentinel log) ──────
export type HistoryResource =
  | "task"
  | "client_project"
  | "receivable"
  | "income"
  | "project"
  | "day_tasks";

export interface HistoryEvent {
  id: string;
  ts: string; // ISO timestamp of the change
  action: "create" | "update" | "delete";
  resource: HistoryResource;
  resource_id: string; // for day_tasks this is the date (YYYY-MM-DD)
  label: string; // human-readable "what happened"
  before: unknown | null; // snapshot pre-change (null on create)
  after: unknown | null; // snapshot post-change (null on delete)
  source: "web" | "jarvis";
  reverted?: boolean;
  is_revert?: boolean; // revert events themselves can't be re-reverted
}

// A change Jarvis has proposed but not yet executed (confirm-gated).
export interface PendingCommand {
  action: "delete" | "update" | "mark_paid" | "add_client_task" | "complete_client_task";
  target: "receivable" | "income" | "client";
  id: string; // money: record id · add_client_task: project id · complete: task id
  patch?: Record<string, unknown>;
  description: string;
  expires_at: string;
}

export interface DailyLog {
  log_date: string; // YYYY-MM-DD
  notes: DailyNotes;
  mood: number | null;
  updated_at: string;
}

export type CaptureKind =
  | "task"
  | "note"
  | "journal"
  | "meal"
  | "idea"
  | "decision"
  | "receivable"
  | "income";

export interface RawCapture {
  id: string;
  source: "jarvis" | "web" | "api";
  raw_text: string;
  classification: {
    kind: CaptureKind;
    urgency?: Urgency;
    tags?: string[];
    summary?: string;
  } | null;
  llm_source: "anthropic" | "openai" | "regex" | null;
  routed_to: string | null;
  routed_id: string | null;
  created_at: string;
}

export interface MemoryChunk {
  id: string;
  source_type: string;
  source_id: string;
  text: string;
  embedding: number[] | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  uid: string; // series UID — stable across recurrences, used for muting
  calendar?: string; // source calendar name (X-WR-CALNAME) or feed host
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
  description?: string;
}

export const GOALS_SENTINEL_DATE = "2000-01-01";
