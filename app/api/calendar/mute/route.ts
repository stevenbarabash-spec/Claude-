// Hide (or unhide) a whole calendar event series from every dashboard view.
// The source calendar keeps the event — this only mutes it here.
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { GOALS_SENTINEL_DATE } from "@/lib/types";

export async function POST(req: Request) {
  const { uid, action } = (await req.json()) as { uid?: string; action?: "mute" | "unmute" };
  if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 });
  const store = getStore();
  const log = await store.getLog(GOALS_SENTINEL_DATE);
  const muted = new Set(log?.notes.muted_events ?? []);
  if (action === "unmute") muted.delete(uid);
  else muted.add(uid);
  await store.mergeLogNotes(GOALS_SENTINEL_DATE, { muted_events: [...muted] });
  await store.addAudit(action === "unmute" ? "unmute_event" : "mute_event", "calendar", uid);
  return NextResponse.json({ ok: true, muted: [...muted] });
}
