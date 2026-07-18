// Client project board — stored on the sentinel log (no migration needed),
// the single source of truth for client work across the dashboard and Jarvis.
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type ClientProject } from "./types";

// Ensure each project's recurring definitions have a task on `today` when due.
// Weekly → matches a weekday; monthly → matches a day-of-month (clamped to the
// month's last day so "30" still fires in February). Idempotent: keyed by the
// recurring id + due date, so it never duplicates.
export async function materializeClientRecurring(today: string): Promise<void> {
  const projects = await listClientProjects();
  const d = new Date(today + "T12:00:00Z");
  const wd = d.getUTCDay();
  const dom = d.getUTCDate();
  const lastDom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  let changed = false;
  for (const p of projects) {
    for (const r of p.recurring ?? []) {
      const due =
        r.cadence === "weekly"
          ? (r.weekdays ?? []).includes(wd)
          : dom === Math.min(Math.max(r.dayOfMonth ?? 1, 1), lastDom);
      if (!due) continue;
      if (p.tasks.some((t) => t.recurringId === r.id && t.due === today)) continue;
      p.tasks.push({ id: crypto.randomUUID(), title: r.title, done: false, due: today, time: r.time ?? null, recurringId: r.id });
      p.updated_at = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) await saveClientProjects(projects);
}

export async function listClientProjects(): Promise<ClientProject[]> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  return log?.notes.client_projects ?? [];
}

export async function saveClientProjects(projects: ClientProject[]): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { client_projects: projects });
}

// Mirror a done-state onto the underlying client task (used when a client task
// pulled into Section 10 is checked off there, so the client board / "due today"
// card stay in sync). Returns the project + its prior snapshot if anything changed.
export async function setClientTaskDoneById(
  taskId: string,
  done: boolean,
): Promise<{ project: ClientProject; before: ClientProject } | null> {
  const projects = await listClientProjects();
  for (const p of projects) {
    const t = p.tasks.find((x) => x.id === taskId);
    if (t && t.done !== done) {
      const before = JSON.parse(JSON.stringify(p)) as ClientProject;
      t.done = done;
      p.updated_at = new Date().toISOString();
      await saveClientProjects(projects);
      return { project: p, before };
    }
  }
  return null;
}

export function clientOf(name: string): string {
  return name.split("—")[0].trim();
}

export function projectOf(name: string): string {
  return name.includes("—") ? name.split("—").slice(1).join("—").trim() : name;
}
