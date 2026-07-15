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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Accept whatever shape the Shortcut sends:
  //   { reminders: [...] } · { reminder: {...} } · a bare array [...] ·
  //   or a single reminder object { text, due }.
  let list: IncomingReminder[];
  if (Array.isArray(body)) {
    list = body as IncomingReminder[];
  } else if (body && typeof body === "object") {
    const b = body as {
      reminders?: unknown;
      reminder?: IncomingReminder;
      text?: string;
      client?: string | null;
      when?: string | null;
      due?: string | null;
    };
    // reminders may arrive as an array, or as a JSON string if Shortcuts
    // serialized the list into a text field — accept both.
    let rem = b.reminders;
    if (typeof rem === "string") {
      try {
        rem = JSON.parse(rem);
      } catch {
        rem = undefined;
      }
    }
    if (Array.isArray(rem)) list = rem as IncomingReminder[];
    else if (rem && typeof rem === "object") list = [rem as IncomingReminder];
    else if (b.reminder) list = [b.reminder];
    // Guided single capture: task + optional client + optional when.
    else if (typeof b.text === "string") list = [{ text: b.text, client: b.client, when: b.when, due: b.due }];
    else list = [];
  } else {
    list = [];
  }
  // Drop empties (a reminder with no text is noise).
  list = list.filter((r) => r && typeof r.text === "string" && r.text.trim());
  if (list.length === 0) {
    return NextResponse.json({ error: "reminders[] required" }, { status: 400 });
  }

  const outcomes = await importReminders(list);
  const imported = outcomes.filter((o) => !o.duplicate).length;
  const duplicates = outcomes.filter((o) => o.duplicate).length;
  // A friendly line Siri can read back.
  const fresh = outcomes.filter((o) => !o.duplicate);
  const spoken =
    fresh.length === 0
      ? duplicates > 0
        ? "That was already on your dashboard."
        : "Nothing to add."
      : fresh.length === 1
        ? `Added ${fresh[0].title} to ${fresh[0].routedTo}.`
        : `Added ${fresh.length} items to your dashboard.`;
  return NextResponse.json({ ok: true, imported, duplicates, spoken, outcomes });
}
