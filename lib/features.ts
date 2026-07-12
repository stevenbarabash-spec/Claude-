// Feature Enhancement Requests — a durable list of ideas for improving the
// dashboard, parked on the sentinel log so we can review them later and decide
// what's worth building. Both you and Jarvis can drop items in.
import { getStore } from "./store";
import { GOALS_SENTINEL_DATE, type FeatureRequest } from "./types";

export async function listFeatures(): Promise<FeatureRequest[]> {
  const log = await getStore().getLog(GOALS_SENTINEL_DATE);
  return log?.notes.feature_requests ?? [];
}

async function save(items: FeatureRequest[]): Promise<void> {
  await getStore().mergeLogNotes(GOALS_SENTINEL_DATE, { feature_requests: items });
}

export async function addFeature(text: string, source: FeatureRequest["source"] = "you"): Promise<FeatureRequest[]> {
  const items = await listFeatures();
  const item: FeatureRequest = {
    id: crypto.randomUUID(),
    text: text.trim(),
    status: "new",
    source,
    created_at: new Date().toISOString(),
  };
  items.unshift(item);
  await save(items);
  return items;
}

export async function setFeatureStatus(id: string, status: FeatureRequest["status"]): Promise<FeatureRequest[]> {
  const items = (await listFeatures()).map((f) => (f.id === id ? { ...f, status } : f));
  await save(items);
  return items;
}

export async function removeFeature(id: string): Promise<FeatureRequest[]> {
  const items = (await listFeatures()).filter((f) => f.id !== id);
  await save(items);
  return items;
}
