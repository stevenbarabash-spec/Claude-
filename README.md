# Greenwich Dental Group Website

Next.js (App Router) + TypeScript + Tailwind CSS site for Greenwich Dental
Group, built as a **static export** so it can be hosted anywhere — including
pasted directly into GoHighLevel (GHL) — with no Node server required.

## Getting Started (local dev)

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Building the static site

```bash
npm run build
```

This produces a fully static `out/` folder (plain HTML/CSS/JS, one file per
page) — nothing in this project requires a running server.

## Deploying to GoHighLevel

GHL doesn't run Node/Next.js, so the deliverable is the static `out/` export:

1. Run `npm run build` to (re)generate `out/`.
2. In GoHighLevel, create a Site/Funnel page for each route (Home, About,
   Services, each Location, etc.) and add a **Custom HTML** element.
3. Open the matching file in `out/` (e.g. `out/locations/downtown-greenwich.html`)
   and paste its `<body>` contents into that element. The `<head>` styles are
   inlined via Tailwind's compiled CSS bundle referenced in each file — copy
   any linked `<link rel="stylesheet">` / `<script>` tags into GHL's page
   head/footer code injection as well.
4. Replace every `GhlFormEmbed` placeholder (visible on the Complimentary
   Consultation, New Patient Form, and each Location page) with your real
   GHL form embed: in GHL, build the form under **Sites → Forms** with Name,
   Email, Phone, and a Preferred Office field (Downtown Greenwich / Old
   Greenwich), always labeled **"Complimentary,"** then copy that form's
   embed `<iframe>` snippet into `src/components/GhlFormEmbed.tsx` (pass its
   `src` as the `ghlEmbedSrc` prop) and rebuild.

## Structure

- `src/lib/data.ts` — all site content (doctors, locations, services, nav, FAQs, testimonials). Update here first when swapping in real content.
- `src/components/` — shared UI (nav, footer, GHL form embed placeholder, doctor cards, FAQ accordion).
- `src/app/` — pages, one route per folder, matching the nav structure (About Us, Services, Locations, Gallery, Testimonials, Internship, Patient Info, Dental Technology).
- `public/images/` — placeholder SVG images. Replace with real photography/video as it's provided.

## Still needed

- Real photography and hero b-roll video (swap into `public/images/hero/poster.svg` placeholder and add a `<source>` in `src/app/page.tsx`)
- Doctor bios, videos, and Master Ceramist bios/photos
- Real service descriptions/photos, gallery before/afters, Google reviews, internship video
- Real GHL form embeds for the consultation/new-patient forms (see above)
