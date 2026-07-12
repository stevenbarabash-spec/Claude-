// Change history with one-tap revert. Every meaningful edit (tasks, client
// board, money records, day tasks) records a before/after snapshot on its own
// sentinel log row; revert applies the inverse through the normal store.
import { getStore } from "./store";
import type {
  ClientProject,
  DayTask,
  HistoryEvent,
  IncomeEntry,
  Project,
  Receivable,
  Task,
} from "./types";
import { listClientProjects, saveClientProjects } from "./clientProjects";

export const HISTORY_SENTINEL_DATE = "2000-01-02";
const MAX_EVENTS = 150;

async function readEvents(): Promise<HistoryEvent[]> {
  const log = await getStore().getLog(HISTORY_SENTINEL_DATE);
  return log?.notes.history ?? [];
}

async function writeEvents(events: HistoryEvent[]): Promise<void> {
  await getStore().mergeLogNotes(HISTORY_SENTINEL_DATE, {
    history: events.slice(0, MAX_EVENTS),
  });
}

export async function recordHistory(
  e: Omit<HistoryEvent, "id" | "ts" | "source"> & { source?: HistoryEvent["source"] },
): Promise<void> {
  try {
    const events = await readEvents();
    events.unshift({
      ...e,
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      source: e.source ?? "web",
    });
    await writeEvents(events);
  } catch {
    // History must never break the edit it describes.
  }
}

export async function listHistory(): Promise<HistoryEvent[]> {
  return readEvents();
}

// Field whitelists so a revert can't resurrect stale system fields.
const TASK_FIELDS: (keyof Task)[] = [
  "title", "description", "urgency", "key", "priority_score",
  "time_estimate_min", "tags", "due_date", "owner", "entity", "completed_at",
];
const RECEIVABLE_FIELDS: (keyof Receivable)[] = [
  "client", "description", "amount", "currency", "status", "invoiced_at", "due_date", "paid_at",
];
const INCOME_FIELDS: (keyof IncomeEntry)[] = ["date", "source", "project_id", "amount", "currency", "kind"];
const PROJECT_FIELDS: (keyof Project)[] = ["name", "client", "status", "kind", "value", "currency", "notes"];

function pick<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

export async function revertEvent(id: string): Promise<{ ok: boolean; message: string }> {
  const events = await readEvents();
  const e = events.find((x) => x.id === id);
  if (!e) return { ok: false, message: "That history entry no longer exists." };
  if (e.reverted) return { ok: false, message: "Already reverted." };
  if (e.is_revert) return { ok: false, message: "A revert can't be reverted — make the change again instead." };

  const store = getStore();

  try {
    switch (e.resource) {
      case "task": {
        if (e.action === "create") await store.deleteTask(e.resource_id);
        else if (e.action === "delete") await store.createTask(pick(e.before as Task, TASK_FIELDS) as Task);
        else await store.updateTask(e.resource_id, pick(e.before as Task, TASK_FIELDS));
        break;
      }
      case "receivable": {
        if (e.action === "create") await store.deleteReceivable(e.resource_id);
        else if (e.action === "delete")
          await store.createReceivable(pick(e.before as Receivable, RECEIVABLE_FIELDS) as Receivable);
        else await store.updateReceivable(e.resource_id, pick(e.before as Receivable, RECEIVABLE_FIELDS));
        break;
      }
      case "income": {
        if (e.action === "create") await store.deleteIncome(e.resource_id);
        else if (e.action === "delete") {
          const b = e.before as IncomeEntry;
          await store.addIncome(pick(b, INCOME_FIELDS) as Omit<IncomeEntry, "id" | "created_at">);
        } else await store.updateIncome(e.resource_id, pick(e.before as IncomeEntry, INCOME_FIELDS));
        break;
      }
      case "project": {
        if (e.action === "create") await store.deleteProject(e.resource_id);
        else if (e.action === "delete") await store.createProject(pick(e.before as Project, PROJECT_FIELDS) as Project);
        else await store.updateProject(e.resource_id, pick(e.before as Project, PROJECT_FIELDS));
        break;
      }
      case "client_project": {
        const projects = await listClientProjects();
        if (e.action === "create") {
          await saveClientProjects(projects.filter((p) => p.id !== e.resource_id));
        } else if (e.action === "delete") {
          await saveClientProjects([e.before as ClientProject, ...projects]);
        } else {
          const before = e.before as ClientProject;
          await saveClientProjects(projects.map((p) => (p.id === e.resource_id ? before : p)));
        }
        break;
      }
      case "day_tasks": {
        await store.mergeLogNotes(e.resource_id, { day_tasks: (e.before as DayTask[] | null) ?? [] });
        break;
      }
    }
  } catch (err) {
    return { ok: false, message: `Revert failed: ${String(err)}` };
  }

  // Mark it reverted and log the revert itself (not re-revertible).
  const updated = (await readEvents()).map((x) => (x.id === id ? { ...x, reverted: true } : x));
  updated.unshift({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    action: e.action,
    resource: e.resource,
    resource_id: e.resource_id,
    label: `Reverted: ${e.label}`,
    before: e.after,
    after: e.before,
    source: "web",
    is_revert: true,
  });
  await writeEvents(updated);
  await store.addAudit("revert", e.resource, e.resource_id, { history_id: id });
  return { ok: true, message: `Reverted: ${e.label}` };
}
