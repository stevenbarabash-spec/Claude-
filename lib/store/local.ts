// File-backed store for zero-setup local development. Data lives in .data/store.json.
// Not suitable for serverless deploys (ephemeral disk) — use Supabase there.
import fs from "fs";
import path from "path";
import type { DailyLog, DailyNotes, MemoryChunk, RawCapture, Task } from "../types";
import { seedData } from "../demoData";
import { newId, nowIso, type Store } from "./types";

interface Db {
  tasks: Task[];
  logs: Record<string, DailyLog>;
  captures: RawCapture[];
  memory: MemoryChunk[];
  audit: { action: string; resource_type: string; resource_id: string; metadata?: object; at: string }[];
}

const DB_PATH = path.join(process.cwd(), ".data", "store.json");
let cache: Db | null = null;

function load(): Db {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as Db;
  } catch {
    cache = seedData();
    persist();
  }
  return cache!;
}

function persist() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(cache, null, 2));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export class LocalStore implements Store {
  async listTasks(includeDone = false): Promise<Task[]> {
    const db = load();
    const tasks = includeDone ? db.tasks : db.tasks.filter((t) => !t.completed_at);
    return [...tasks].sort((a, b) => b.priority_score - a.priority_score);
  }

  async getTask(id: string): Promise<Task | null> {
    return load().tasks.find((t) => t.id === id) ?? null;
  }

  async createTask(t: Partial<Task> & { title: string }): Promise<Task> {
    const db = load();
    const maxScore = Math.max(0, ...db.tasks.filter((x) => x.urgency === (t.urgency ?? "week")).map((x) => x.priority_score));
    const task: Task = {
      id: newId(),
      title: t.title,
      description: t.description ?? null,
      urgency: t.urgency ?? "week",
      key: t.key ?? false,
      priority_score: t.priority_score ?? maxScore + 10,
      time_estimate_min: t.time_estimate_min ?? null,
      tags: t.tags ?? [],
      due_date: t.due_date ?? null,
      owner: t.owner ?? null,
      entity: t.entity ?? null,
      completed_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.tasks.push(task);
    persist();
    return task;
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task | null> {
    const db = load();
    const task = db.tasks.find((t) => t.id === id);
    if (!task) return null;
    Object.assign(task, patch, { id: task.id, updated_at: nowIso() });
    persist();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    const db = load();
    db.tasks = db.tasks.filter((t) => t.id !== id);
    persist();
  }

  async getLog(date: string): Promise<DailyLog | null> {
    return load().logs[date] ?? null;
  }

  async listLogs(days: number): Promise<DailyLog[]> {
    const db = load();
    return Object.values(db.logs)
      .sort((a, b) => (a.log_date < b.log_date ? 1 : -1))
      .slice(0, days);
  }

  async mergeLogNotes(date: string, patch: Partial<DailyNotes>): Promise<DailyLog> {
    const db = load();
    const existing = db.logs[date] ?? { log_date: date, notes: {}, mood: null, updated_at: nowIso() };
    existing.notes = { ...existing.notes, ...patch };
    existing.updated_at = nowIso();
    db.logs[date] = existing;
    persist();
    return existing;
  }

  async addCapture(c: Omit<RawCapture, "id" | "created_at">): Promise<RawCapture> {
    const db = load();
    const capture: RawCapture = { ...c, id: newId(), created_at: nowIso() };
    db.captures.unshift(capture);
    persist();
    return capture;
  }

  async listCaptures(limit: number): Promise<RawCapture[]> {
    return load().captures.slice(0, limit);
  }

  async addMemory(m: Omit<MemoryChunk, "id" | "created_at">): Promise<void> {
    const db = load();
    db.memory.unshift({ ...m, id: newId(), created_at: nowIso() });
    persist();
  }

  async searchMemoryByVector(embedding: number[], limit: number): Promise<MemoryChunk[]> {
    const db = load();
    return db.memory
      .filter((m) => m.embedding)
      .map((m) => ({ m, score: cosine(embedding, m.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.m);
  }

  async searchMemoryByText(query: string, limit: number): Promise<MemoryChunk[]> {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const db = load();
    return db.memory
      .map((m) => ({
        m,
        score: words.reduce((acc, w) => acc + (m.text.toLowerCase().includes(w) ? 1 : 0), 0),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.m);
  }

  async addAudit(action: string, resourceType: string, resourceId: string, metadata?: object): Promise<void> {
    const db = load();
    db.audit.unshift({ action, resource_type: resourceType, resource_id: resourceId, metadata, at: nowIso() });
    db.audit = db.audit.slice(0, 2000);
    persist();
  }
}
