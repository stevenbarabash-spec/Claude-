// "Currently Working On" — the small strip of tasks the user pulled from Next
// Up. Stored on the sentinel log so it's the same on phone and desktop. Marking
// one Done routes back to its real home (client board / CRM / day-tasks) so it
// checks off everywhere, and records the change in history.
import { listClientProjects, saveClientProjects } from "./clientProjects";
import { recordHistory } from "./history";
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type DayTask, type WorkingItem } from "./types";

export async function listWorking(): Promise<WorkingItem[]> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  return log?.notes.working_on ?? [];
}

async function save(items: WorkingItem[]): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { working_on: items });
}

export async function addWorking(item: Omit<WorkingItem, "startedAt">): Promise<WorkingItem[]> {
  const items = await listWorking();
  if (!items.find((x) => x.key === item.key)) {
    items.unshift({ ...item, startedAt: new Date().toISOString() });
  }
  await save(items);
  return items;
}

export async function removeWorking(key: string): Promise<WorkingItem[]> {
  const items = (await listWorking()).filter((x) => x.key !== key);
  await save(items);
  return items;
}

// Check the task off at its source, drop it from the strip, log it.
export async function completeWorking(key: string): Promise<{ items: WorkingItem[]; ok: boolean; message: string }> {
  const items = await listWorking();
  const item = items.find((x) => x.key === key);
  if (!item) return { items, ok: false, message: "Not in the working list." };
  const store = getStore();

  try {
    if (item.source === "crm") {
      const before = await store.getTask(item.taskId);
      const after = await store.updateTask(item.taskId, { completed_at: new Date().toISOString() });
      if (before) {
        await recordHistory({
          action: "update", resource: "task", resource_id: item.taskId,
          label: `Task completed: ${item.title}`, before, after,
        });
      }
    } else if (item.source === "client" && item.projectId) {
      const projects = await listClientProjects();
      const p = projects.find((x) => x.id === item.projectId);
      if (p) {
        const before = JSON.parse(JSON.stringify(p));
        p.tasks = p.tasks.map((t) => (t.id === item.taskId ? { ...t, done: true } : t));
        p.updated_at = new Date().toISOString();
        await saveClientProjects(projects);
        await recordHistory({
          action: "update", resource: "client_project", resource_id: p.id,
          label: `Client task checked off: ${item.title}${item.who ? ` (${item.who})` : ""}`,
          before, after: p,
        });
      }
    } else if (item.source === "day" && item.date) {
      const log = await store.getLog(item.date);
      const before: DayTask[] = log?.notes.day_tasks ?? [];
      const after = before.map((t) => (t.id === item.taskId ? { ...t, done: true } : t));
      await store.mergeLogNotes(item.date, { day_tasks: after });
      await recordHistory({
        action: "update", resource: "day_tasks", resource_id: item.date,
        label: `Day task checked off: ${item.title}`, before, after,
      });
    }
  } catch {
    // If the source write fails we still clear it from the strip below.
  }

  const remaining = items.filter((x) => x.key !== key);
  await save(remaining);
  return { items: remaining, ok: true, message: `Done: ${item.title}` };
}
