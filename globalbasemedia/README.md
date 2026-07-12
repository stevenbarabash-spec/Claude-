# GlobalBaseMedia.com — redesigned website

A complete redesign of [globalbasemedia.com](https://globalbasemedia.com): dark navy +
electric blue/cyan brand, conversion-first layout, fully responsive, zero dependencies.

## Pages

| File | Page |
|---|---|
| `index.html` | Home — hero, stats, services, how-it-works, results, ROI calculator, testimonials, pricing preview, FAQ, CTA |
| `ai-receptionist.html` | AI Receptionist & Chatbot |
| `website-design.html` | Website Design |
| `seo.html` | SEO Services (incl. Generative Engine Optimization) |
| `google-reviews.html` | Google Reviews & Automation |
| `ads.html` | Social Media & Google Ads |
| `pricing.html` | Pricing (3 plans + pricing FAQ) |
| `contact.html` | Contact — strategy-call CTA + message form |

Shared assets: `styles.css` (design system) and `script.js` (mobile nav, scroll
reveals, ROI calculator, contact form → pre-filled email).

## What carried over from the old site

- All real copy anchors: tagline, testimonials, case-study numbers (145→476 reviews,
  430% more reviews, 5K+ sites / 10K bots), pricing ranges, FAQ points.
- The live lead funnel: every "Book a Strategy Call" CTA points at the existing
  LeadConnector booking form, and the phone number (561) 556-9190 is click-to-call
  throughout.

## Tech notes

- **Static HTML/CSS/JS — no build step, no frameworks, no external fonts/CDNs.**
  Fast, secure, and hostable anywhere.
- Responsive: desktop, tablet, and phone (hamburger nav with services submenu).
- Respects `prefers-reduced-motion`; semantic HTML with accessible details/summary FAQ.
- The contact form opens a pre-filled email (`hello@globalbasemedia.com`) — swap the
  handler in `script.js` for a real endpoint (LeadConnector webhook, Formspree, etc.)
  when ready.

## Deploy

Any static host works — drop the folder in:

- **Vercel**: `vercel --prod` from this directory
- **Netlify**: drag the folder into the Netlify dashboard
- **GitHub Pages / Cloudflare Pages**: point at this directory

Then switch the `globalbasemedia.com` DNS to the new host.
