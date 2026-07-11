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

export interface FinanceCategory {
  name: string;
  value: number;
  kind: "liquid" | "invested" | "liability";
}

export interface FinanceSnapshot {
  net_worth: number;
  currency: string;
  as_of: string;
  liquid: number;
  invested: number;
  liabilities: number;
  categories: FinanceCategory[];
  notes?: string;
  source: "sheet" | "manual" | "demo";
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

export interface DailyNotes {
  focus?: string;
  habits?: { done: string[] };
  nutrition?: { meals: Meal[] };
  finance?: FinanceSnapshot;
  goals?: { week: GoalItem[]; month: GoalItem[] }; // only on sentinel date
  review?: WeeklyReview; // only on week-anchor (Monday) dates
  briefing?: { text: string; generated_at: string };
}

export interface DailyLog {
  log_date: string; // YYYY-MM-DD
  notes: DailyNotes;
  mood: number | null;
  updated_at: string;
}

export type CaptureKind = "task" | "note" | "journal" | "meal" | "idea" | "decision";

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
