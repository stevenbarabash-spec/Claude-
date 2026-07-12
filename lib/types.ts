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
export interface ClientTask {
  id: string;
  title: string;
  done: boolean;
  due: string | null; // YYYY-MM-DD
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

// A destructive change Jarvis has proposed but not yet executed.
export interface PendingCommand {
  action: "delete" | "update" | "mark_paid";
  target: "receivable" | "income";
  id: string;
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
