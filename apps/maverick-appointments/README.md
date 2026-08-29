# Team Maverick · Appointments

A fast, beautiful appointment calendar for **Team Maverick**, built to work like
Google Calendar and themed with the Wholesale Payments brand — the logo colors
used as subtle hues, never bulky blocks.

- **Four views — Day, Week, Month, Schedule.** Switch instantly (top switcher on
  desktop, bottom bar on mobile, or the `D` / `W` / `M` / `A` keys). The
  **Schedule** view is the daily summary: every agent's appointments for each
  day, listed with times, locations, statuses and notes.
- **Time-grid Day & Week** with a live "now" line and side-by-side layout for
  overlapping appointments.
- **Month calendar** with subtly tinted, agent-colored event chips; click a day
  to jump straight to it.
- **Sidebar** with a mini-month for quick navigation, an agent list ("My agents")
  you can toggle on/off like Google's calendars, and a live "Today at a glance"
  panel (appointments today, agents booked, first appointment, confirmed).
- **Search** across every appointment (title, agent, location, notes, status).
- **Event popovers** — click any appointment for its full details.
- **Dark mode** — follows your device automatically, or force Light/Dark in
  Settings.
- **PWA** — installs to your phone's home screen and works offline with the
  last-loaded data.
- **Keyboard shortcuts** — press `?` for the full list.
- **Zero dependencies, no build step** — plain HTML/CSS/JS, hosted anywhere
  static files can live.

## Connect your Google Apps Script

The dashboard reads appointments from the Apps Script web app in your
`justin.woodruff@wholesalepayments.com` account:

1. In the Apps Script editor: **Deploy → New deployment → Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
2. Copy the `…/exec` URL.
3. Open the dashboard → **⚙ Settings** → paste the URL → **Save & Test**.

The URL is stored in your browser only (localStorage) — it is never committed
to this repo.

### What the script should return

Any of these shapes work — a bare array or `{ events: [...] }` /
`{ appointments: [...] }` / `{ data: [...] }`:

```json
{
  "events": [
    {
      "date": "2026-08-19",
      "time": "9:30 AM",
      "agent": "Alex Rivera",
      "title": "Statement review — Joe's Diner",
      "location": "Odessa, TX",
      "status": "Confirmed",
      "notes": "Bring updated rate sheet."
    }
  ]
}
```

Field names are matched loosely (`agent`/`rep`/`owner`/`assignedTo`,
`title`/`task`/`merchant`, `date`+`time` or a single `start` datetime, etc.) —
see [`apps-script/Code.gs`](apps-script/Code.gs) for the full alias list, a
drop-in reference script, and an optional **morning email digest** function.

> **Tip:** send `date`/`time` as plain strings (as above). Raw `Date` objects
> are serialized in UTC by Apps Script and can shift hours between time zones.

## Merchant volume → 💰 payout milestones

When a Team Maverick merchant crosses **$1,000** in volume — and again at
**$5,000** — a gold 💰 payout event is added to the calendar for that day under
the agent's name, so everyone can see who's getting paid.

**Where the volume comes from:** browsers can't call
`sales.wholesalepayments.org` directly (cross-origin + login), so an Apps
Script provides the numbers. Either have your main script include a
`merchants` array in its JSON, or paste a separate volume-feed `/exec` URL in
Settings. Each merchant row needs at least:

```json
{ "merchant": "Joe's Diner", "agent": "Kyle Pettit", "volume": 1250.50 }
```

Optional `date1k` / `date5k` fields pin the exact payout day (recommended —
they're consistent across every device). Without them, the dashboard tracks
each merchant's last-seen volume and stamps a milestone on the day it first
observes the crossing; the very first sync only baselines (it won't invent
history for merchants already over a threshold).

`apps-script/Code.gs` includes a ready `readMerchants()` for a
`Merchants` sheet (**Merchant | Agent | Volume | Date1K | Date5K**) and a
commented `UrlFetchApp` skeleton for pulling straight from the sales portal
server-side with a stored API token.

### “Failed to fetch” when saving the URL

This is a network/permissions error — the browser couldn't read a response — and
it's almost always the web app's **access setting**, not your data:

1. In the Apps Script editor: **Deploy → Manage deployments →** (edit your web
   app). Set **Who has access** to **Anyone**. On a Google Workspace domain the
   choices may read *Only myself / Anyone within your-domain / Anyone* — you must
   pick **Anyone** (a domain-only setting still forces a login the browser can't
   pass). If your Workspace admin has disabled public web apps, they'll need to
   allow it.
2. Set **Execute as: Me**.
3. **Deploy a new version** after any edit — editing the script does *not* update
   the live `/exec` URL until you deploy again.
4. Make sure the URL ends in **`/exec`** (not `/dev`, which always requires login).

The dashboard first tries a normal `fetch`, and if the browser blocks it for
cross-origin reasons it automatically retries with **JSONP** (a `<script>`
request that isn't subject to CORS). The reference `Code.gs` supports JSONP out
of the box; if you use your own script, add the `?callback=` handling shown in
`doGet` there to make the fallback work.

## Hosting (GitHub Pages)

1. Merge this branch, then in the repo: **Settings → Pages → Deploy from a
   branch** → `main` / root.
2. Your dashboard will be live at `https://<user>.github.io/wpimaverickappts/`.

Any other static host (Netlify, Cloudflare Pages, …) works the same — upload
the files as-is.

## Install on your phone (PWA)

- **iPhone:** open the site in Safari → Share → **Add to Home Screen**.
- **Android:** open in Chrome → menu → **Install app**.

You'll get the Wholesale Payments bar-mark as the app icon, full-screen
standalone display, and offline access to the last-loaded schedule.

## Project layout

```
index.html            App shell (app bar, sidebar, overlays)
css/styles.css        Design system (brand tints, light/dark themes)
js/app.js             Data layer + Day/Week/Month/Schedule views + settings
sw.js                 Service worker (offline app shell)
manifest.webmanifest  PWA manifest
assets/logo.png       Official Wholesale Payments logo
assets/icons/         PWA icons generated from the logo's bar mark
apps-script/Code.gs   Reference Apps Script + daily email digest
```

## Timezone note

Appointment times are shown in **your device's local timezone**. If your Apps
Script sends a full datetime with a `Z`/UTC offset (as Apps Script does when it
serializes a raw `Date`), it's converted to local time correctly. Date-only
values (a plain `date` field) are treated as wall-dates and never shift days.
