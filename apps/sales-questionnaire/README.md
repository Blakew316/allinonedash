# Wholesale Payments — Sales Talent Questionnaire

A beautiful, installable (PWA) 10-question sales talent assessment for the
hiring process. Candidates answer difficult situational-judgment questions
(every option is written to sound defensible), are never shown their score,
and the scored breakdown across five sales competencies is emailed to the
hiring manager automatically on completion.

![Theme](https://img.shields.io/badge/theme-light%20brand%20hues-blue) — styled
with light tints of the Wholesale Payments logo palette (navy, blue, green),
no heavy color blocks. Typography is the Apple system font stack (SF Pro on
Apple devices, with matching fallbacks elsewhere).

## Two separate pages

**Hiring Dashboard** (`index.html` — the main URL, for managers only):

- **Your team** — an Apple-style dropdown of the sales teams; choosing one
  auto-fills the results-delivery email with that team lead's address (the
  email stays editable, and a manual edit clears the team selection). Every
  completed assessment is scored and delivered there automatically. Agents
  never see their results. The team list lives in `js/config.js`.
- **Upload Résumé** — drop (or browse for) a candidate's PDF and their
  **name, email, and phone number are read automatically** (parsed on-device
  with a vendored copy of Mozilla's pdf.js — no resume data ever leaves the
  browser). Extracted details open in a confirmation sheet before saving.
- **Add Manually** — type a name, email, and phone when there's no resume.
- **Send questionnaire** — one button emails the assessment link to every
  candidate who hasn't received it yet (per-row send/re-send also available).
- Rows track status — *Not sent → Sent → Completed (with score)* — and the
  score fills in automatically when a candidate finishes on this device.
- **Reports** — every completed assessment files a report row showing the
  candidate's name, tier, score out of 100, completion date, and **how long
  the assessment took** (timed from Begin Assessment to the last answer).
  Reports appear for completions on this device; remote completions arrive
  in your email, which includes the same time-to-complete line.
- Candidates, reports, and your email are stored in `localStorage` on the
  device only.

**Candidate assessment** (`assessment.html` — the page invite links point
to): a completely separate page with none of the dashboard's markup, tools,
or navigation — there is no way to reach the dashboard from it. It greets
the candidate with "Prepared for <name>" and **Begin Assessment goes
directly to question 1 — candidates never type their own details**. Their
identity and the manager's email ride along in the link (`c` and `mgr`
parameters, base64), so completions on any device route results back to
you. The roster's ▶ button opens the same page with that candidate loaded,
and a completion on the manager's device updates the roster status through
shared local storage. A link with no identity runs anonymously and the
results email is labeled "Unidentified candidate". On finishing, the
candidate sees only a thank-you screen — no score.

## What it measures

| Competency | Questions |
|---|---|
| Resilience & Motivation | 2 |
| Problem-Solving & Objections | 2 |
| Client Rapport & Discovery | 2 |
| Strategy & Results | 2 |
| Coachability & Teamwork | 2 |

Each answer is worth 1–10 points → total score out of 100, mapped to a tier:

- **85–100 · Elite Talent** — move quickly
- **70–84 · Strong Potential** — coachable, real upside
- **50–69 · Developing** — second interview recommended
- **0–49 · Not Sales-Ready**

## Running it

It's a fully static site — no build step.

```bash
# any static server works, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080`. For the PWA features (install button,
offline) it must be served over **HTTPS** in production (localhost is exempt).
Works great on GitHub Pages, Netlify, Vercel, etc.

## PWA

- `manifest.webmanifest` + full icon set (regular + maskable, generated from the logo mark)
- `sw.js` precaches the app shell — the assessment runs fully offline after first visit
- An **Install app** button appears in the header when the browser allows install
- In-progress answers are auto-saved (per browser session), so a refresh doesn't lose progress

## Email setup

Both emails (results to the manager, invites to candidates) work out of the
box via a **mailto fallback** — the device's mail app opens pre-written, and
you just press send. Nothing to configure.

For fully automatic, silent sending (no mail app involved), plug in
[EmailJS](https://www.emailjs.com) (free tier available):

1. Create an EmailJS account → add an email **Service** (e.g. your Gmail).
2. Create a **results template** — this goes to the manager. Variables
   provided: `{{to_email}}` (the manager), `{{candidate_name}}`,
   `{{candidate_email}}`, `{{candidate_phone}}`, `{{candidate_role}}`,
   `{{score}}`, `{{tier}}`, `{{tier_blurb}}`, `{{breakdown_text}}`,
   `{{completed_date}}`, `{{company_name}}`.
   Set the template's "To" field to `{{to_email}}`.
3. Create an **invite template** — this goes to candidates. Variables:
   `{{to_email}}`, `{{candidate_name}}`, `{{candidate_phone}}`,
   `{{form_link}}`, `{{manager_email}}`, `{{company_name}}`.
4. Copy your **Public Key**, **Service ID**, and both **Template IDs** into
   [`js/config.js`](js/config.js) (`templateId` = results,
   `inviteTemplateId` = invites).

Where results get sent (first match wins): the `mgr` parameter embedded in
the candidate's invite link → the email saved on the dashboard → the
`hiringManagerEmail` fallback in `js/config.js`.

## Customizing

- **Questions / scoring** — edit [`js/questions.js`](js/questions.js). Keep 4
  options per question with a max of 10 points; everything else (progress,
  scoring, breakdown) adapts automatically.
- **Tiers** — same file, `TIERS` array.
- **Branding** — colors are CSS variables at the top of
  [`css/styles.css`](css/styles.css); logo assets live in `assets/` and
  `icons/`.
