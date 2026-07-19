// One-shot meeting booking for the iOS Shortcut ("Hey Siri, book a meeting").
// The Shortcut dictates text and POSTs it here with the x-api-secret header
// (middleware handles auth). Two modes:
//   { "text": "..." }                  → parse AND book immediately, invites sent
//   { "text": "...", "mode": "preview" } → parse only; returns the draft + readback
//   { "draft": { ...MeetingDraft } }   → book a previously previewed/edited draft
// The reply field is written to be spoken aloud by the Shortcut.
import { NextResponse } from "next/server";
import { clearPendingMeeting, getPendingMeeting, setPendingMeeting } from "@/lib/jarvis/commands";
import {
  bookMeeting,
  bookingConfigured,
  describeMeeting,
  parseMeetingRequest,
} from "@/lib/meetings";
import type { MeetingDraft } from "@/lib/types";

export async function GET() {
  return NextResponse.json(
    { configured: bookingConfigured() },
    { headers: { "cache-control": "no-store" } },
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Shortcuts apps (Siri Shortcuts, etc.) round-trip a "Dictionary" value
// through their own type system before re-serializing it as JSON — numbers
// and booleans routinely come back as strings, a single-item array can
// collapse into a bare object, and absent fields can arrive as null instead
// of just missing. Coerce instead of strictly requiring exact JS types, so a
// draft that's shaped right but typed loosely still books.
function coerceDraft(d: unknown): MeetingDraft | null {
  if (!d || typeof d !== "object") return null;
  const m = d as Record<string, unknown>;

  const title = typeof m.title === "string" ? m.title.trim() : "";
  const date = typeof m.date === "string" ? m.date.trim() : "";
  const start_time = typeof m.start_time === "string" ? m.start_time.trim() : "";
  const duration_min = Number(m.duration_min);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start_time) || !Number.isFinite(duration_min)) {
    return null;
  }

  const toArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v != null ? [v] : []);

  const attendees = toArray(m.attendees)
    .map((a) => {
      const rec = a as Record<string, unknown> | null;
      const email = typeof rec?.email === "string" ? rec.email.trim() : "";
      const name = typeof rec?.name === "string" ? rec.name.trim() : null;
      return { name, email };
    })
    .filter((a) => EMAIL_RE.test(a.email));

  const unmatched = toArray(m.unmatched)
    .map((v) => String(v).trim())
    .filter(Boolean);

  const withMeetRaw = m.with_meet;
  const with_meet =
    withMeetRaw === true || withMeetRaw === "true" || withMeetRaw === 1 || withMeetRaw === "1";

  return {
    title,
    date,
    start_time,
    duration_min: Math.max(5, Math.min(8 * 60, Math.round(duration_min))),
    attendees,
    unmatched,
    location: typeof m.location === "string" && m.location.trim() ? m.location.trim() : null,
    notes: typeof m.notes === "string" && m.notes.trim() ? m.notes.trim() : null,
    with_meet,
  };
}

export async function POST(req: Request) {
  if (!bookingConfigured()) {
    return NextResponse.json(
      {
        error: "not_configured",
        reply:
          "Calendar booking isn't set up yet. Add the Google OAuth env vars — see the Meetings section of the README.",
      },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { text?: string; mode?: string; draft?: unknown; confirm?: unknown }
    | null;

  // Book the pending preview set by an earlier mode:"preview" call. This is
  // the recommended second leg for Shortcuts clients — a plain {"confirm":
  // true} is trivial to send, unlike round-tripping a full draft object
  // through Shortcuts' own "Dictionary" type, which in practice mangles
  // nested numbers/booleans/arrays badly enough to get rejected as
  // malformed. The server remembers the draft instead (same 10-minute
  // confirm-gated pattern Jarvis chat uses).
  const confirmed =
    body?.confirm === true || body?.confirm === "true" || body?.confirm === 1 || body?.confirm === "1";
  if (confirmed) {
    const pending = await getPendingMeeting();
    if (!pending) {
      return NextResponse.json(
        {
          error: "nothing_pending",
          reply: "There's nothing pending to confirm — it may have expired. Tell me the meeting again.",
        },
        { status: 409 },
      );
    }
    await clearPendingMeeting();
    try {
      const { reply, booked } = await bookMeeting(pending.draft);
      return NextResponse.json({ reply, booked });
    } catch (err) {
      return NextResponse.json(
        { error: "booking_failed", reply: `Booking failed — nothing was sent. ${err instanceof Error ? err.message : ""}` },
        { status: 502 },
      );
    }
  }

  // Book a pre-built draft directly — kept for API callers that manage their
  // own state; Shortcuts should prefer the confirm:true flow above.
  if (body?.draft !== undefined) {
    const draft = coerceDraft(body.draft);
    if (!draft) {
      return NextResponse.json(
        { error: "bad_draft", reply: "That draft was malformed — nothing was booked." },
        { status: 400 },
      );
    }
    try {
      const { reply, booked } = await bookMeeting(draft);
      return NextResponse.json({ reply, booked });
    } catch (err) {
      return NextResponse.json(
        { error: "booking_failed", reply: `Booking failed — nothing was sent. ${err instanceof Error ? err.message : ""}` },
        { status: 502 },
      );
    }
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "text_required", reply: "I didn't catch any meeting details — try again." },
      { status: 400 },
    );
  }

  const { draft, reason } = await parseMeetingRequest(text);
  if (!draft) {
    return NextResponse.json(
      {
        error: "parse_failed",
        reply: `I couldn't book that: ${reason ?? "missing details"}. Say who, what day, and what time.`,
      },
      { status: 422 },
    );
  }

  if (body?.mode === "preview") {
    const readback = describeMeeting(draft);
    await setPendingMeeting(text, draft, readback);
    return NextResponse.json({ draft, readback, reply: readback });
  }

  try {
    const { reply, booked } = await bookMeeting(draft);
    return NextResponse.json({ reply, booked, draft });
  } catch (err) {
    return NextResponse.json(
      { error: "booking_failed", reply: `Booking failed — nothing was sent. ${err instanceof Error ? err.message : ""}` },
      { status: 502 },
    );
  }
}
