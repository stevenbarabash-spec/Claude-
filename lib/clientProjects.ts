// Client project board — stored on the sentinel log (no migration needed),
// the single source of truth for client work across the dashboard and Jarvis.
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type ClientProject } from "./types";

export async function listClientProjects(): Promise<ClientProject[]> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  return log?.notes.client_projects ?? [];
}

export async function saveClientProjects(projects: ClientProject[]): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { client_projects: projects });
}

export function clientOf(name: string): string {
  return name.split("—")[0].trim();
}

export function projectOf(name: string): string {
  return name.includes("—") ? name.split("—").slice(1).join("—").trim() : name;
}
