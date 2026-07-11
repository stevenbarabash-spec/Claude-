import type { DailyLog, DailyNotes, MemoryChunk, RawCapture, Task } from "../types";

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
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
