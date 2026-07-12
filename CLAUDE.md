# CLAUDE.md — working rules for this repo

This repo contains two products:

1. **Jarvis OS** (repo root: `app/`, `components/`, `lib/`) — Steven's personal
   Next.js life-OS dashboard. See `README.md`.
2. **GlobalBaseMedia.com** (`globalbasemedia/`) — the public marketing site for
   Global Base Media, a static HTML/CSS/JS build. See `globalbasemedia/README.md`.

## Verification protocol (applies to ALL work)

1. **Before starting any piece of work, state how you will verify it.**
   Name the concrete check up front: the command, the page you'll render, the
   flow you'll drive, the numbers you'll compare. "It compiles" is not a plan.
2. **After finishing, actually run that verification and report the results** —
   including failures, verbatim. Typical checks in this repo:
   - Jarvis OS: `npm run typecheck`, then drive the affected page/API route.
   - GlobalBaseMedia site: render the changed pages headless (Chromium at
     `/opt/pw-browsers/chromium`) at desktop (1440px) and mobile (390px) widths
     and inspect the screenshots; exercise any JS you touched (nav, ROI
     calculator, forms).
3. Never report work as done without having run the stated verification.

## Hot Zones — ask first, explain blast radius

Before changing ANY code in these areas, stop and ask Steven first, explaining
what could break and how far the damage reaches (the blast radius):

- **Live lead funnel** (`globalbasemedia/`): the LeadConnector booking-form URL
  (`api.leadconnectorhq.com/widget/form/TvVxKhAbj09pNmLwQHD1`), the phone number
  `(561) 556-9190`, and any `tel:`/booking CTA links. Breaking these silently
  loses real customers.
- **Auth & security**: `middleware.ts`, `lib/auth.ts`, `app/api/auth/**`,
  `components/PinShield.tsx`. Mistakes here expose personal finance/health data.
- **Data layer & migrations**: `lib/store/**`, `supabase/migrations/**`.
  Schema or store changes can corrupt or orphan live personal data.
- **Money paths**: `app/api/finance/**`, `app/api/income/**`,
  `app/api/receivables/**` and the projection math they feed.
- **Capture pipeline**: `lib/pipeline.ts`, `lib/ai/classify.ts` — misrouting
  silently swallows captures.

The ask must include: what you want to change, why, what depends on it, the
worst realistic failure, and how you'll verify nothing broke.

## Other conventions

- Develop on the designated `claude/*` branch; never push elsewhere without
  explicit permission.
- Static site (`globalbasemedia/`) stays dependency-free: no frameworks, no
  external fonts/CDNs, no build step.
- TypeScript strict; plain CSS design system (no Tailwind) in the Jarvis app.
