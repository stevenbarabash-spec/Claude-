# Greenwich Dental Group Website

Next.js (App Router) + TypeScript + Tailwind CSS site for Greenwich Dental Group.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Structure

- `src/lib/data.ts` — all site content (doctors, locations, services, nav, FAQs, testimonials). Update here first when swapping in real content.
- `src/components/` — shared UI (nav, footer, consultation form, doctor cards, FAQ accordion).
- `src/app/` — pages, one route per folder, matching the nav structure (About Us, Services, Locations, Gallery, Testimonials, Internship, Patient Info, Dental Technology).
- `public/images/` — placeholder SVG images. Replace with real photography/video as it's provided.

## Consultation / new patient forms

Both forms post to `POST /api/consultation`, which routes the message to the correct office email based on the "Preferred Office" field (see `officeEmail` in `src/lib/data.ts`). Configure SMTP via `.env.local` (see `.env.example`) to actually send email — until then, submissions are logged to the server console.

## Still needed

- Real photography and hero b-roll video (swap into `public/images/hero/poster.svg` placeholder and add a `<source>` in `src/app/page.tsx`)
- Doctor bios, videos, and Master Ceramist bios/photos
- Real service descriptions/photos, gallery before/afters, Google reviews, internship video
- SMTP credentials for form email delivery
