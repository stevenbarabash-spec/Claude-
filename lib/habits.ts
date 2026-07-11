// The live habit list: user-edited defs from the DB, falling back to config.
import { config } from "./config";
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type HabitDef } from "./types";

export async function getHabitDefs(): Promise<HabitDef[]> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  const defs = log?.notes.habit_defs;
  return defs && defs.length > 0 ? defs : config.habits;
}

export function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || `habit-${Date.now()}`
  );
}
