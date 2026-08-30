# 🌱 Hiring HQ — BambooHR Hiring Automation

A self-hosted web app that automates your hiring workflow on top of the [BambooHR API](https://documentation.bamboohr.com/docs):

- **Pipeline** — see every open role and candidate from BambooHR's applicant tracking, and move candidates between stages with one click
- **Resume upload** — drop in a PDF, Word, or text resume and the candidate's name, email, and phone are extracted automatically; they're added to the pipeline ready for a one-tap onboarding packet send
- **Hire** — turn a candidate into a BambooHR employee record instantly (and auto-mark their application as Hired)
- **Onboarding packet, one button** — generate a personalized set of PDFs (welcome letter, offer letter, first-day checklist, benefits overview, IT setup, payroll forms, handbook acknowledgment), email the whole packet to the new hire, and file copies on their BambooHR employee record — all with a single click
- **Directory** — see your employee roster, with new hires flagged

Your BambooHR API key never leaves the server — the browser talks only to this app.

## Quick start

```bash
npm install
npm start
```

Open http://localhost:3000. With no configuration, the app runs in **demo mode** with sample candidates so you can try the entire flow — including sending a (simulated) onboarding packet — before touching your real account.

## Connecting your BambooHR account

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. In BambooHR, click your avatar → **API Keys** → **Add New Key**, and put the key and your subdomain in `.env`:
   ```
   BAMBOOHR_SUBDOMAIN=yourcompany     # https://yourcompany.bamboohr.com
   BAMBOOHR_API_KEY=xxxxxxxxxxxxxxxx
   ```
3. Restart the app. The header badge switches from **Demo Mode** to **Live**.

The API key inherits the permissions of the user who created it — it needs access to the Applicant Tracking System, the ability to add employees, and employee file management for the full feature set.

## Sending real emails

Add SMTP credentials to `.env` (any provider works — Gmail app passwords, SES, Mailgun, etc.):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourco.com
SMTP_PASS=your-app-password
MAIL_FROM=People Ops <people@yourco.com>
MAIL_CC=hr@yourco.com
```

Without SMTP configured, packet sends are **simulated**: the PDFs are still generated and the UI shows exactly what would have been sent.

## Customizing the packet

- **Documents** live in [`templates/`](templates/) as markdown files with `{{placeholders}}` (`{{firstName}}`, `{{jobTitle}}`, `{{startDate}}`, `{{salary}}`, `{{manager}}`, `{{companyName}}`, …). Edit them and every future packet picks up the changes — no restart needed.
- **Branding** (company name, address, HR contact) comes from `.env`.
- Supported template syntax: `#`/`##` headings, `-` bullets, `[ ]` checkboxes, `>` callouts, numbered lists, `**bold**`, `---` rules, and `[signature]` for signature/date lines.
- Use the **Preview PDF** link next to any document to see it rendered with the current form values before sending.

## How "the button" works

`POST /api/onboarding/send` runs three steps and reports each one:

1. **Generate** — renders every selected template into a branded PDF, personalized for the hire
2. **Email** — sends the packet as attachments to the new hire (optionally CCing HR) with a polished HTML welcome email
3. **File** — uploads each PDF to the employee's BambooHR **Files** section under an "Onboarding Packet" category, shared with the employee

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/status` | Mode (demo/live), email config, company branding |
| `GET /api/jobs` | Open job listings (ATS) |
| `GET /api/candidates?jobId=` | Applications, filterable by job |
| `POST /api/candidates/:id/status` | Move a candidate to a new stage |
| `POST /api/hire` | Create the employee record from a candidate |
| `GET /api/employees` | Employee directory |
| `POST /api/resume/parse` | Extract name/email/phone from an uploaded resume |
| `GET /api/packet/documents` | Available packet documents |
| `POST /api/packet/preview` | Render one document to PDF for preview |
| `POST /api/onboarding/send` | Generate + email + file the full packet |

## Deploying to Netlify

The repo is Netlify-ready: the frontend in `public/` deploys as static files, and the whole API runs as a serverless function (`netlify/functions/api.mjs`), with `/api/*` routed to it by `netlify.toml`. Just connect the repo to a Netlify site (or push, if it's already connected) — no build settings needed.

Configuration on Netlify happens through environment variables (Site configuration → Environment variables) instead of `.env`:

- `BAMBOOHR_SUBDOMAIN`, `BAMBOOHR_API_KEY` — switch from demo to live
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_CC` — real email
- `COMPANY_NAME`, `COMPANY_ADDRESS`, `HR_CONTACT_NAME`, `HR_CONTACT_EMAIL` — branding
- `APP_PASSWORD` — optional access gate. When set, every API call requires the password (the UI prompts for it once per session); when unset, the site is open to anyone with the URL — including candidate data and packet sending, so weigh this carefully with real API keys configured. Re-enable at any time by setting the variable and triggering a deploy. For stronger protection, Netlify Pro plans can also enable site-wide password protection in the Netlify UI.

One demo-mode caveat on Netlify: serverless instances are ephemeral, so demo-mode stage changes and hires reset between invocations. Live mode is unaffected — real state lives in BambooHR.

## Notes

- Requires Node 18+ (uses built-in `fetch`).
- BambooHR auth is HTTP Basic with the API key as username — handled server-side in [`src/bamboohr.js`](src/bamboohr.js).
- Demo data lives in [`src/demo.js`](src/demo.js) and is kept in the same shapes the real API returns.
