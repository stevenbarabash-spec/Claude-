import type {
  DailyLog,
  DailyNotes,
  IncomeEntry,
  MemoryChunk,
  Project,
  RawCapture,
  Receivable,
  Task,
} from "../types";

export interface Store {
  listTasks(includeDone?: boolean): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  createTask(t: Partial<Task> & { title: string }): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task | null>;
  deleteTask(id: string): Promise<void>;

  getLog(date: string): Promise<DailyLog | null>;
  listLogs(days: number): Promise<DailyLog[]>;
  // Shallow-merges the given keys into notes for that date (creates the row if needed).
  mergeLogNotes(date: string, patch: Partial<DailyNotes>): Promise<DailyLog>;

  addCapture(c: Omit<RawCapture, "id" | "created_at">): Promise<RawCapture>;
  listCaptures(limit: number): Promise<RawCapture[]>;

  addMemory(m: Omit<MemoryChunk, "id" | "created_at">): Promise<void>;
  searchMemoryByVector(embedding: number[], limit: number): Promise<MemoryChunk[]>;
  searchMemoryByText(query: string, limit: number): Promise<MemoryChunk[]>;

  addAudit(action: string, resourceType: string, resourceId: string, metadata?: object): Promise<void>;

  // ── Monthly cash-flow ──
  listProjects(): Promise<Project[]>;
  createProject(p: Partial<Project> & { name: string }): Promise<Project>;
  updateProject(id: string, patch: Partial<Project>): Promise<Project | null>;
  deleteProject(id: string): Promise<void>;

  listIncome(months: number): Promise<IncomeEntry[]>;
  addIncome(e: Omit<IncomeEntry, "id" | "created_at">): Promise<IncomeEntry>;
  updateIncome(id: string, patch: Partial<IncomeEntry>): Promise<IncomeEntry | null>;
  deleteIncome(id: string): Promise<void>;

  listReceivables(includePaid?: boolean): Promise<Receivable[]>;
  createReceivable(r: Partial<Receivable> & { client: string; amount: number }): Promise<Receivable>;
  updateReceivable(id: string, patch: Partial<Receivable>): Promise<Receivable | null>;
  deleteReceivable(id: string): Promise<void>;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
