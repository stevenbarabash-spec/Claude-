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

export interface DailyNotes {
  focus?: string;
  habits?: { done: string[] };
  habit_defs?: HabitDef[]; // only on sentinel date — user-editable habit list
  client_projects?: ClientProject[]; // only on sentinel date — the client work board
  nutrition?: { meals: Meal[] };
  goals?: { week: GoalItem[]; month: GoalItem[] }; // only on sentinel date
  review?: WeeklyReview; // only on week-anchor (Monday) dates
  briefing?: { text: string; generated_at: string };
  pending_command?: PendingCommand | null; // only on sentinel date — awaiting "confirm"
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
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  location?: string;
  description?: string;
}

export const GOALS_SENTINEL_DATE = "2000-01-01";
