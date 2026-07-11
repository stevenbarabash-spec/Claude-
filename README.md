# JARVIS // Life OS

A personal, AI-native operating system: one dashboard that runs your tasks, habits,
calendar, nutrition, finances, goals, and weekly reviews — with **Jarvis**, a built-in
voice/chat assistant that files everything into the right place and answers questions
about your own life.

Based on the *Personal OS Build Cheat Sheet* (Miles Deutscher / AI Edge) with one big
change: **no Telegram bot**. Capture happens through Jarvis — the floating assistant in
the bottom-right corner of every page.

## What's inside

| Surface | What it does |
|---|---|
| **Home** | Operator card, session greeting + daily focus, quick capture, 6-habit tracker, 7-day calendar, nutrition with AI macro estimation, finance pulse, key blockers, week/month goals |
| **CRM** | 4-tier task kanban (Today / Week / Month / Later), drag-drop reorder, click-to-edit drawer, AI smart search ("what should I do this morning?") |
| **Finance** | Net worth hero, runway, asset/liability breakdown, 24-month snapshot history. AI reads your *messy, unlabeled* Google Sheet and extracts everything — refreshed by button or daily cron only, never on page load |
| **Health** | 30-day calorie/macro log with per-meal expansion, averages over logged days |
| **Review** | Weekly review (wins / slipped / open loops / follow-ups / content / health / next top-3), auto-saved, sealable |
| **Brain** | Semantic search over everything you've ever captured + the raw capture stream |
| **Jarvis** | Voice + text assistant. Say *"remind me to call the accountant"* → task filed. *"Ate a chicken burrito"* → meal logged with macros. *"What did I say about Atlas?"* → answers from memory with citations. Also generates a cached morning briefing |

## The capture pipeline

```
voice/text → Jarvis → classify (Claude → OpenAI → regex fallback)
           → route (tasks / meals / notes / ideas / decisions)
           → embed to memory (pgvector or local cosine)
           → audit log → confirmation reply
```

## Quick start (zero config)

```bash
npm install
npm run dev
```

That's it. With no env vars the app runs on a local JSON store (`.data/store.json`,
gitignored) seeded with demo data, auth is disabled, and the classifier falls back to
regex. Everything works; it's just not smart yet.

## Level up progressively

Copy `.env.example` → `.env.local` and add pieces as you go:

1. **AI** — `ANTHROPIC_API_KEY` (primary) and/or `OPENAI_API_KEY` (Whisper voice
   transcription, embeddings, fallback classifier). This unlocks the real classifier,
   nutrition estimation, smart search, briefings, and conversational Jarvis.
2. **Database** — create a free [Supabase](https://supabase.com) project, enable the
   `vector` extension (Database → Extensions), run
   `supabase/migrations/0001_init.sql` in the SQL editor, then set
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`. The store switches over automatically.
3. **Auth** — set `AUTH_SECRET` (`openssl rand -hex 32`) + `DASHBOARD_PASSWORD`.
   Optional `API_SECRET` for programmatic access via the `x-api-secret` header.
4. **Calendar** — Google Calendar → Settings → your calendar → *"Secret address in
   iCal format"* → `GOOGLE_CALENDAR_ICAL_URL`.
5. **Finance sheet** — use a **service account**, never "publish to web":
   [console.cloud.google.com](https://console.cloud.google.com) → new project → enable
   **Sheets API** → IAM → Service Accounts → create + JSON key → share your finance
   sheet with the service-account email as *Viewer* → set `GOOGLE_SHEETS_FINANCE_ID`
   (between `/d/` and `/edit` in the URL), `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_SERVICE_ACCOUNT_KEY` (the `private_key` field, keep the `\n` escapes).
   Then hit **↻ Refresh from sheet** on the Finance tab.

## Deploy (Vercel)

```bash
npm i -g vercel
vercel link
vercel --prod
```

Push every env var from `.env.example` (`vercel env add NAME production`), including
`CRON_SECRET` — `vercel.json` schedules the finance snapshot daily at 05:00 UTC and
Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

> Note: the local JSON store does not persist on serverless — configure Supabase
> before deploying.

## Voice capture

- Chrome/Edge/Safari: uses the browser's built-in speech recognition — free, instant.
- Other browsers: records audio and transcribes server-side with Whisper
  (needs `OPENAI_API_KEY`).

## Make it yours

Personal knobs live in one file: `lib/config.ts` — name, location, brand, the six
habits, kcal/macro targets, and the eating cutoff. Timezone via `USER_TIMEZONE`
(server-side helpers only; the browser clock always wins for "what day is it").

## Architecture notes

- **Next.js 15 App Router + TypeScript strict**, plain CSS design system (no Tailwind).
- **Pluggable store** (`lib/store/`): `LocalStore` (JSON file) ⇄ `SupabaseStore`,
  selected by env vars at runtime.
- **LLM layer** (`lib/ai/`): Anthropic Claude primary → OpenAI fallback → regex last
  resort. Model configurable via `ANTHROPIC_MODEL` (default `claude-opus-4-8`).
- **Known-bug guards baked in** (from the guide's Part 8): `ical.js` instead of
  node-ical, user-clock day rollover, dirty-ref against GET-clobbers-edit races,
  PostgREST cache busting, classifier ID validation, page loads never trigger AI.
