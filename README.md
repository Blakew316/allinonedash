# Wholesale Payments — All-In-One Dashboard

A single, self-contained dashboard (`index.html`) gathering every product built for
Wholesale Payments — thirteen applications, one hundred three screens and pages — with each
build extracted and live under `apps/`.

The dashboard is themed from the official Wholesale Payments logo (`assets/logo.png`):
navy `#00125e`, blue `#00a3e6`, green `#00c776`, mint `#50e56f`, slate `#aaafb5` —
used only as light tints, hairlines and micro-gradients over a white base, with the
Apple system type stack, scroll-triggered reveals, count-up stats and two
banner-style tickers (live updates and suite numbers).

## Run it

```bash
python3 -m http.server 8000     # from the repo root
# open http://localhost:8000
```

Any static host works (GitHub Pages included — `.nojekyll` is present). On Netlify,
`netlify.toml` also deploys WPI Route's prospect-generator function — set
`GOOGLE_PLACES_API_KEY` in the site's environment variables to enable Auto-generate. Serving over
HTTP matters: Kloser CRM loads its datasets with `fetch`, so it won't run from `file://`.

## The apps

| App | Path | What it is |
| --- | --- | --- |
| Kloser CRM | `apps/kloser/` | Offline-first field sales CRM — 15 screens, territory map, routes, GPS verification |
| Maverick Dashboard | `apps/team-maverick/` | Team Maverick command center — rankings, merchant health, recruiting, call transfers |
| Maverick Appointments | `apps/maverick-appointments/` | Google-Calendar-style appointment hub with payout milestones |
| AppUpload | `apps/appupload/` | Handwritten merchant applications → typed PDFs — live at [myappupload.com](https://myappupload.com); this folder is the source snapshot |
| WPI Route | `apps/agentroute/` | ZIP-based six-day field-route planner with live team sync |
| Statement Studio | `apps/statement-generator/` | Pixel-accurate financial-document PDFs, generated entirely in the browser |
| WPI University | `apps/wpi-university/` | The 30-course training & certification platform, plus proposal tooling |
| Wholesale Payments | `apps/wholesale-payments/` | The redesigned public site with an encrypted merchant portal |
| Customer Connect | `apps/customerconnect/` | The 43-page Customer Connect marketing site, zero dependencies |
| Integration Atlas | `apps/integrations/` | Searchable directory of 624 processing-compatible software brands |
| Sales Questionnaire | `apps/sales-questionnaire/` | Scored sales-hiring assessment sent to candidates, results emailed to managers |
| Hiring HQ | `apps/bamboohr-automation/` | BambooHR hiring pipeline + onboarding automation (needs its Node server: `npm install && npm start`) |
| WPI Rewards | `apps/wpi-rewards/` | Merchant rewards portal — points, catalog, cart and orders |

Each `apps/` directory is the extracted build of the matching `*.zip` archive kept at
the repo root; the archives are the originals and remain untouched.
