// Apple Reminders / Siri import endpoint. An iPhone Shortcut POSTs a batch of
// reminders here; each is classified and routed into WARROOM (client board,
// Home Chores, Section 10, or Miscellaneous). Guarded by x-api-secret — the
// middleware already enforces it, this is a defense-in-depth second check.
import { NextResponse } from "next/server";
import { checkApiSecret } from "@/lib/auth";
import { importReminders, type IncomingReminder } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // authEnabled() gates the middleware; when auth is on, require the secret here too.
  if (process.env.API_SECRET && !checkApiSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { reminders?: IncomingReminder[]; reminder?: IncomingReminder };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Accept either a batch { reminders: [...] } or a single { reminder: {...} }.
  const list = body.reminders ?? (body.reminder ? [body.reminder] : []);
  if (!Array.isArray(list) || list.length === 0) {
    return NextResponse.json({ error: "reminders[] required" }, { status: 400 });
  }

  const outcomes = await importReminders(list);
  const imported = outcomes.filter((o) => !o.duplicate).length;
  const duplicates = outcomes.filter((o) => o.duplicate).length;
  return NextResponse.json({ ok: true, imported, duplicates, outcomes });
}
