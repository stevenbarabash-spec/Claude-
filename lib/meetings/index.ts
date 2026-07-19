// Voice → booked meeting. Parses a dictated request ("book a call with John
// tomorrow at 3, invite john@acme.com") into a MeetingDraft with Claude,
// resolves spoken names against the MEETING_CONTACTS address book, and books
// it on Google Calendar (which emails the invites).
import { aiAvailable, llmJson } from "../ai/llm";
import { config } from "../config";
import { localDateKey } from "../dates";
import { getStore } from "../store";
import type { MeetingDraft } from "../types";
import { bookingConfigured, insertEvent, type BookedMeeting } from "./google";

export { bookingConfigured };

// Cheap regex used by the no-AI intent fallback AND as a hint alongside the
// LLM intent classifier.
export function looksLikeMeetingRequest(text: string): boolean {
  return (
    /\b(book|schedule|set ?up|create|arrange|put)\b[\s\S]{0,60}\b(meeting|call|invite|appointment|sync|catch ?up|zoom|meet)\b/i.test(text) ||
    /\b(meeting|call) with\b/i.test(text)
  );
}

// Address book: MEETING_CONTACTS="John Smith <john@acme.com>; Jane <jane@x.io>"
// (also accepts commas/newlines between entries).
export function contactBook(): { name: string; email: string }[] {
  const raw = process.env.MEETING_CONTACTS ?? "";
  const out: { name: string; email: string }[] = [];
  for (const part of raw.split(/[;\n,]+/)) {
    const m = part.trim().match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
    if (m) out.push({ name: m[1].trim(), email: m[2].trim() });
  }
  return out;
}

interface ParsedMeeting {
  ok: boolean;
  reason?: string;
  title?: string;
  date?: string;
  start_time?: string;
  duration_min?: number;
  attendees?: { name?: string | null; email?: string | null }[];
  location?: string | null;
  notes?: string | null;
  no_video_call?: boolean;
}

export async function parseMeetingRequest(
  text: string,
): Promise<{ draft: MeetingDraft | null; reason: string | null }> {
  if (!aiAvailable()) {
    return {
      draft: null,
      reason: "I need an AI key (ANTHROPIC_API_KEY) to parse meeting requests.",
    };
  }
  const today = localDateKey();
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    weekday: "long",
  }).format(new Date());
  const contacts = contactBook();
  const contactLines = contacts.map((c) => `${c.name} <${c.email}>`).join("\n");

  const result = await llmJson<ParsedMeeting>(
    `You extract ONE calendar meeting from the user's spoken request. Return JSON:
{"ok": true,
 "title": "short event title, e.g. \\"Steven / John — catch-up\\"",
 "date": "YYYY-MM-DD",
 "start_time": "HH:MM 24h",
 "duration_min": number,
 "attendees": [{"name": "..." | null, "email": "..." | null}],
 "location": "..." | null,
 "notes": "..." | null,
 "no_video_call": true | false}
Rules:
- Resolve relative dates ("tomorrow", "next Tuesday") against today's date in the user's timezone.
- Spoken emails: normalize "john at acme dot com" → "john@acme.com".
- If an attendee is named without an email, match the name (case-insensitive, first names ok) against the contact list; use that email. If no match, keep the name with email null.
- Default duration 30 minutes if unstated. If no start time was given at all, return {"ok": false, "reason": "no time given"}.
- Every meeting gets a Google Meet video link by default — including ones with a physical location (hybrid). Set "no_video_call": true ONLY if the user explicitly says something like "in person only", "no video call", "no Zoom/Meet link", or "phone call only".
- Do NOT invent emails, dates, or times.
- If this is not actually a meeting/call request, return {"ok": false, "reason": "..."}.`,
    `Today is ${weekday} ${today} (${config.timezone}). The user is ${config.owner.fullName}.
Contacts:
${contactLines || "(none)"}

Request: ${text}`,
    768,
  );

  const p = result?.data;
  if (!p || !p.ok || !p.date || !p.start_time || !p.title) {
    return { draft: null, reason: p?.reason ?? "I couldn't parse that into a meeting." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^\d{2}:\d{2}$/.test(p.start_time)) {
    return { draft: null, reason: "I couldn't pin down the date and time — try saying them explicitly." };
  }

  const attendees: MeetingDraft["attendees"] = [];
  const unmatched: string[] = [];
  for (const a of p.attendees ?? []) {
    const email = (a.email ?? "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      attendees.push({ name: a.name?.trim() || null, email });
    } else if (a.name?.trim()) {
      unmatched.push(a.name.trim());
    }
  }

  return {
    draft: {
      title: p.title.trim(),
      date: p.date,
      start_time: p.start_time,
      duration_min: Math.max(5, Math.min(8 * 60, Math.round(p.duration_min ?? 30))),
      attendees,
      unmatched,
      location: p.location?.trim() || null,
      notes: p.notes?.trim() || null,
      // Meet link by default, even alongside a physical location (hybrid),
      // unless the user explicitly opted out.
      with_meet: !p.no_video_call,
    },
    reason: null,
  };
}

export function describeMeeting(d: MeetingDraft): string {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(d.date + "T12:00:00Z"));
  const [h, m] = d.start_time.split(":").map(Number);
  const t12 = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  const lines = [
    `Meeting — "${d.title}"`,
    `When: ${day} ${d.date} at ${t12} (${d.duration_min} min, ${config.timezone})`,
    d.attendees.length
      ? `Invites to: ${d.attendees.map((a) => (a.name ? `${a.name} (${a.email})` : a.email)).join(", ")}`
      : `Invites to: nobody — just your calendar`,
  ];
  if (d.location && d.with_meet) lines.push(`Where: ${d.location} + Google Meet (link auto-attached)`);
  else if (d.location) lines.push(`Where: ${d.location}`);
  else if (d.with_meet) lines.push(`Where: Google Meet (link auto-attached)`);
  else lines.push(`Where: not set — no video call, no location`);
  if (d.unmatched.length) {
    lines.push(
      `⚠ No email on file for: ${d.unmatched.join(", ")} — they will NOT get an invite. Say their email or add them to MEETING_CONTACTS.`,
    );
  }
  return lines.join("\n");
}

// Book it: create the event (Google emails the invites) + audit + memory.
export async function bookMeeting(draft: MeetingDraft): Promise<{ reply: string; booked: BookedMeeting }> {
  const booked = await insertEvent(draft);
  const store = getStore();
  await store.addAudit("meeting_booked", "google_calendar", booked.id, {
    title: draft.title,
    date: draft.date,
    start_time: draft.start_time,
    attendees: draft.attendees.map((a) => a.email),
  });
  try {
    const { embed } = await import("../ai/embed");
    const text = `Booked meeting: ${draft.title} on ${draft.date} at ${draft.start_time} with ${draft.attendees.map((a) => a.name ?? a.email).join(", ") || "nobody"}`;
    const vector = await embed(text);
    await store.addMemory({ source_type: "capture", source_id: booked.id, text, embedding: vector });
  } catch {
    // memory is best-effort — the meeting is already booked
  }

  const invitees = draft.attendees.length;
  const parts = [
    `Booked — "${draft.title}" is on your calendar${invitees ? ` and ${invitees === 1 ? "the invite is" : `${invitees} invites are`} on the way` : ""}.`,
  ];
  if (booked.meetLink) parts.push(`Meet link: ${booked.meetLink}`);
  if (draft.unmatched.length) parts.push(`Heads up: no email for ${draft.unmatched.join(", ")} — they weren't invited.`);
  return { reply: parts.join("\n"), booked };
}
