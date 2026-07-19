// Google Calendar WRITE access — creating events and sending invites.
// The read side stays on the zero-config iCal feed (app/api/calendar); writes
// need real OAuth. We use a refresh token minted once with
// scripts/google-refresh-token.mjs, exchanged here for short-lived access
// tokens (cached in module memory until ~1 min before expiry).
import { config } from "../config";
import type { MeetingDraft } from "../types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

export function bookingConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`google token refresh failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

export interface BookedMeeting {
  id: string;
  htmlLink: string | null;
  meetLink: string | null;
  start: string;
  end: string;
}

function endTime(date: string, start: string, durationMin: number): { date: string; time: string } {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + durationMin;
  const dayOverflow = Math.floor(total / 1440);
  const mm = total % 1440;
  let endDate = date;
  if (dayOverflow > 0) {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + dayOverflow);
    endDate = d.toISOString().slice(0, 10);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: endDate, time: `${pad(Math.floor(mm / 60))}:${pad(mm % 60)}` };
}

// Creates the event with sendUpdates=all so Google emails every attendee an
// invite. conferenceDataVersion=1 lets us attach a Meet link.
export async function insertEvent(draft: MeetingDraft): Promise<BookedMeeting> {
  const token = await accessToken();
  const calendarId = process.env.GOOGLE_BOOKING_CALENDAR_ID || "primary";
  const end = endTime(draft.date, draft.start_time, draft.duration_min);

  const body: Record<string, unknown> = {
    summary: draft.title,
    description: draft.notes || undefined,
    location: draft.location || undefined,
    start: { dateTime: `${draft.date}T${draft.start_time}:00`, timeZone: config.timezone },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone: config.timezone },
    attendees: draft.attendees.map((a) => ({
      email: a.email,
      ...(a.name ? { displayName: a.name } : {}),
    })),
    reminders: { useDefault: true },
    ...(draft.with_meet
      ? {
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }
      : {}),
  };

  const url = `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all&conferenceDataVersion=1`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`google event insert failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const ev = (await res.json()) as {
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
  };
  return {
    id: ev.id,
    htmlLink: ev.htmlLink ?? null,
    meetLink: ev.hangoutLink ?? null,
    start: ev.start?.dateTime ?? `${draft.date}T${draft.start_time}:00`,
    end: ev.end?.dateTime ?? `${end.date}T${end.time}:00`,
  };
}
