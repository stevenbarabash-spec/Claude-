// One-shot meeting booking for the iOS Shortcut ("Hey Siri, book a meeting").
// The Shortcut dictates text and POSTs it here with the x-api-secret header
// (middleware handles auth). Two modes:
//   { "text": "..." }                  → parse AND book immediately, invites sent
//   { "text": "...", "mode": "preview" } → parse only; returns the draft + readback
//   { "draft": { ...MeetingDraft } }   → book a previously previewed/edited draft
// The reply field is written to be spoken aloud by the Shortcut.
import { NextResponse } from "next/server";
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

function isDraft(d: unknown): d is MeetingDraft {
  if (!d || typeof d !== "object") return false;
  const m = d as Partial<MeetingDraft>;
  return (
    typeof m.title === "string" &&
    typeof m.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.date) &&
    typeof m.start_time === "string" && /^\d{2}:\d{2}$/.test(m.start_time) &&
    typeof m.duration_min === "number" &&
    Array.isArray(m.attendees) &&
    m.attendees.every((a) => typeof a?.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email))
  );
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
    | { text?: string; mode?: string; draft?: unknown }
    | null;

  // Book a pre-built draft (second leg of a preview → confirm Shortcut).
  if (body?.draft !== undefined) {
    if (!isDraft(body.draft)) {
      return NextResponse.json(
        { error: "bad_draft", reply: "That draft was malformed — nothing was booked." },
        { status: 400 },
      );
    }
    const draft: MeetingDraft = {
      ...body.draft,
      unmatched: Array.isArray(body.draft.unmatched) ? body.draft.unmatched : [],
      location: body.draft.location ?? null,
      notes: body.draft.notes ?? null,
      with_meet: body.draft.with_meet ?? !body.draft.location,
    };
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
    return NextResponse.json({ draft, readback: describeMeeting(draft), reply: describeMeeting(draft) });
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
