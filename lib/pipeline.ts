// The capture pipeline (guide §4), driven by Jarvis instead of Telegram:
// text → classify → write raw capture → route to the right table → embed → audit.
import { classifyCapture } from "./ai/classify";
import { embed } from "./ai/embed";
import { localDateKey, localTime } from "./dates";
import { getStore } from "./store";
import type { Meal, RawCapture } from "./types";

export interface CaptureResult {
  capture: RawCapture;
  routed_to: string;
  routed_id: string | null;
  reply: string;
}

export async function runCapturePipeline(
  text: string,
  source: RawCapture["source"],
): Promise<CaptureResult> {
  const store = getStore();
  const { classification, source: llmSource } = await classifyCapture(text);

  let routedTo = "raw_captures";
  let routedId: string | null = null;
  let reply: string;

  switch (classification.kind) {
    case "task": {
      const task = await store.createTask({
        title: classification.title,
        description: text === classification.title ? null : text,
        urgency: classification.urgency,
        tags: classification.tags,
      });
      routedTo = "tasks";
      routedId = task.id;
      reply = `Task filed under "${classification.urgency}": ${task.title}`;
      break;
    }
    case "meal": {
      const today = localDateKey();
      const log = await store.getLog(today);
      const meals: Meal[] = log?.notes.nutrition?.meals ?? [];
      const meal: Meal = {
        id: crypto.randomUUID(),
        t: localTime(),
        n: classification.title,
        kcal: classification.meal?.kcal ?? 0,
        p: classification.meal?.p ?? 0,
        c: classification.meal?.c ?? 0,
        f: classification.meal?.f ?? 0,
        estimated: true,
      };
      await store.mergeLogNotes(today, { nutrition: { meals: [...meals, meal] } });
      routedTo = "daily_logs.nutrition";
      routedId = meal.id;
      reply = `Meal logged: ${meal.n} — ~${meal.kcal} kcal (${meal.p}p / ${meal.c}c / ${meal.f}f)`;
      break;
    }
    default: {
      routedTo = "raw_captures";
      reply = `Captured as ${classification.kind}: ${classification.summary}`;
    }
  }

  const capture = await store.addCapture({
    source,
    raw_text: text,
    classification: {
      kind: classification.kind,
      urgency: classification.urgency,
      tags: classification.tags,
      summary: classification.summary,
    },
    llm_source: llmSource === "regex" ? "regex" : llmSource,
    routed_to: routedTo,
    routed_id: routedId,
  });

  // Memory layer (guide §6): embed every capture so "ask my OS" can find it later.
  const vector = await embed(text);
  await store.addMemory({
    source_type: "capture",
    source_id: capture.id,
    text,
    embedding: vector,
  });
  await store.addAudit("capture", routedTo, routedId ?? capture.id, { kind: classification.kind, llm: llmSource });

  return { capture, routed_to: routedTo, routed_id: routedId, reply };
}
