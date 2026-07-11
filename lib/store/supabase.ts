// Supabase backend (guide §3). Requires the migration in supabase/migrations/0001_init.sql.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DailyLog, DailyNotes, MemoryChunk, RawCapture, Task } from "../types";
import { nowIso, type Store } from "./types";

const USER_ID = process.env.USER_ID || "steven";

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Bust PostgREST's edge cache which can serve stale snapshots on bulk selects (guide §8.5).
function cacheBust(): number {
  return 100000 + (Date.now() % 100000);
}

export class SupabaseStore implements Store {
  private sb = client();

  async listTasks(includeDone = false): Promise<Task[]> {
    let q = this.sb.from("tasks").select("*").eq("user_id", USER_ID).limit(cacheBust());
    if (!includeDone) q = q.is("completed_at", null);
    const { data, error } = await q.order("priority_score", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Task[];
  }

  async getTask(id: string): Promise<Task | null> {
    const { data } = await this.sb.from("tasks").select("*").eq("id", id).eq("user_id", USER_ID).maybeSingle();
    return (data as Task) ?? null;
  }

  async createTask(t: Partial<Task> & { title: string }): Promise<Task> {
    const row = {
      user_id: USER_ID,
      title: t.title,
      description: t.description ?? null,
      urgency: t.urgency ?? "week",
      key: t.key ?? false,
      priority_score: t.priority_score ?? Date.now() % 1000000,
      time_estimate_min: t.time_estimate_min ?? null,
      tags: t.tags ?? [],
      due_date: t.due_date ?? null,
      owner: t.owner ?? null,
      entity: t.entity ?? null,
      completed_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    const { data, error } = await this.sb.from("tasks").insert(row).select().single();
    if (error) throw error;
    return data as Task;
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task | null> {
    const { data, error } = await this.sb
      .from("tasks")
      .update({ ...patch, updated_at: nowIso() })
      .eq("id", id)
      .eq("user_id", USER_ID)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Task) ?? null;
  }

  async deleteTask(id: string): Promise<void> {
    await this.sb.from("tasks").delete().eq("id", id).eq("user_id", USER_ID);
  }

  async getLog(date: string): Promise<DailyLog | null> {
    const { data } = await this.sb
      .from("daily_logs")
      .select("*")
      .eq("user_id", USER_ID)
      .eq("log_date", date)
      .maybeSingle();
    if (!data) return null;
    return { log_date: data.log_date, notes: data.notes ?? {}, mood: data.mood, updated_at: data.updated_at };
  }

  async listLogs(days: number): Promise<DailyLog[]> {
    const { data, error } = await this.sb
      .from("daily_logs")
      .select("*")
      .eq("user_id", USER_ID)
      .order("log_date", { ascending: false })
      .limit(days);
    if (error) throw error;
    return (data ?? []).map((d) => ({ log_date: d.log_date, notes: d.notes ?? {}, mood: d.mood, updated_at: d.updated_at }));
  }

  async mergeLogNotes(date: string, patch: Partial<DailyNotes>): Promise<DailyLog> {
    // Read-merge-write: notes is a JSON column holding several card states.
    const existing = await this.getLog(date);
    const notes = { ...(existing?.notes ?? {}), ...patch };
    const row = { user_id: USER_ID, log_date: date, notes, mood: existing?.mood ?? null, updated_at: nowIso() };
    const { error } = await this.sb.from("daily_logs").upsert(row, { onConflict: "user_id,log_date" });
    if (error) throw error;
    return { log_date: date, notes, mood: row.mood, updated_at: row.updated_at };
  }

  async addCapture(c: Omit<RawCapture, "id" | "created_at">): Promise<RawCapture> {
    const row = { user_id: USER_ID, ...c, created_at: nowIso() };
    const { data, error } = await this.sb.from("raw_captures").insert(row).select().single();
    if (error) throw error;
    return data as RawCapture;
  }

  async listCaptures(limit: number): Promise<RawCapture[]> {
    const { data, error } = await this.sb
      .from("raw_captures")
      .select("*")
      .eq("user_id", USER_ID)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RawCapture[];
  }

  async addMemory(m: Omit<MemoryChunk, "id" | "created_at">): Promise<void> {
    await this.sb.from("memory_chunks").insert({ user_id: USER_ID, ...m, created_at: nowIso() });
  }

  async searchMemoryByVector(embedding: number[], limit: number): Promise<MemoryChunk[]> {
    const { data, error } = await this.sb.rpc("match_memory", {
      p_user_id: USER_ID,
      query_embedding: embedding,
      match_count: limit,
    });
    if (error) throw error;
    return (data ?? []) as MemoryChunk[];
  }

  async searchMemoryByText(query: string, limit: number): Promise<MemoryChunk[]> {
    const { data, error } = await this.sb
      .from("memory_chunks")
      .select("id, source_type, source_id, text, created_at")
      .eq("user_id", USER_ID)
      .ilike("text", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((d) => ({ ...d, embedding: null })) as MemoryChunk[];
  }

  async addAudit(action: string, resourceType: string, resourceId: string, metadata?: object): Promise<void> {
    await this.sb.from("audit_log").insert({
      user_id: USER_ID,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata: metadata ?? {},
      created_at: nowIso(),
    });
  }
}
