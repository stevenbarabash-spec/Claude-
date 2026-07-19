#!/usr/bin/env node
// One-time helper: mint the Google OAuth refresh token that lets Jarvis book
// meetings on your calendar, send invites, and look up attendees by name in
// your Google/Gmail contacts.
//
// Setup (once, ~5 min):
//   1. console.cloud.google.com → create/select a project
//   2. "APIs & Services" → enable the **Google Calendar API** AND the **People API**
//   3. "OAuth consent screen" → External → add yourself as a test user
//   4. "Credentials" → Create credentials → OAuth client ID → **Web application**
//      → add redirect URI  http://localhost:8765/callback
//   5. Run:  GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... node scripts/google-refresh-token.mjs
//   6. A browser URL is printed — open it, approve, and the refresh token is
//      printed here. Put it in .env.local / Vercel as GOOGLE_OAUTH_REFRESH_TOKEN.
//
// Re-run this (with prompt=consent, already set below) any time you add a
// new scope — Google only issues a refresh token covering the scopes you
// approved in that specific run.
import http from "node:http";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const PORT = 8765;
const REDIRECT = `http://localhost:${PORT}/callback`;
const SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts.other.readonly",
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first (see comments at the top of this file).");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // force a refresh_token even if previously granted
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("Missing ?code — try again.");
    return;
  }
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const data = await tokenRes.json();
    if (!data.refresh_token) {
      console.error("\nNo refresh_token in the response:", JSON.stringify(data, null, 2));
      res.writeHead(500).end("No refresh token returned — check the terminal.");
    } else {
      console.log("\n✅ Success! Add this to .env.local (and Vercel):\n");
      console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${data.refresh_token}\n`);
      res.writeHead(200, { "content-type": "text/html" }).end(
        "<h2>Done — refresh token printed in your terminal. You can close this tab.</h2>",
      );
    }
  } catch (err) {
    console.error("Token exchange failed:", err);
    res.writeHead(500).end("Token exchange failed — check the terminal.");
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log("\nOpen this URL in your browser and approve access:\n");
  console.log(authUrl + "\n");
  console.log(`(waiting on http://localhost:${PORT}/callback ...)`);
});
