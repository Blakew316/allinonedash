# WPI University

A rebuild of [wpiuniversity.com](https://www.wpiuniversity.com) — the training platform
behind every Wholesale Payments rep — as a fast, animated, static front end.

The original is a Rails + Bootstrap 4 admin wrapped around a SvelteKit app (ISO Amp).
This is a ground-up redesign of the same information architecture: same courses, same
lessons, same admin surface, rebuilt around the Wholesale Payments logo.

## Design

**Typography** is the Apple system stack — `-apple-system` / `SF Pro Display` first,
with Inter loaded as the cross-platform stand-in. Headings run tight (−0.02em to
−0.035em tracking), numerals are tabular everywhere a figure can change.

**Colour** is sampled directly from the supplied logo:

| Token     | Value     | Where it comes from       |
|-----------|-----------|---------------------------|
| `--navy`  | `#00125e` | the wordmark              |
| `--blue`  | `#00a3e6` | the first bar             |
| `--green` | `#00c776` | the middle bar            |
| `--mint`  | `#50e56f` | the third bar             |
| `--slate` | `#aaafb5` | "payments"                |

Those five values are used as **tints, hairlines and micro-gradients only** — 2–14%
alpha washes behind icon tiles, 2px rules, progress rings, focus states. There is no
large field of brand colour anywhere in the site. The single full-strength moment is
the 2px gradient hairline across the top of every page, which traces the logo's three
bars left to right.

The logo ships as two crops of the single supplied file — the three bars and the
wordmark. That split lets the bars keep their blue and green on a dark background while
the navy wordmark flips to white, instead of the whole lockup washing out to grey.

**Motion** is built from a handful of primitives in `assets/js/app.js`:
scroll-triggered reveals with per-container stagger, easing counters on every figure,
bars and rings that grow from zero when they enter the viewport, a nav that gains its
border on scroll, a scroll-progress line, spring-eased press states, and the View
Transitions API for page-to-page navigation where the browser supports it. Everything
collapses under `prefers-reduced-motion`.

## Navigation

- **Five destinations**, always in the top bar: Dashboard, Training, People, Reports, Settings.
- **⌘K / Ctrl-K** (or `/`) opens a command palette that searches all 30 courses, all 228
  lesson titles, every person and every page — with prefix, substring and subsequence
  matching, so `hrps` finds *How to Read a Processing Statement*. Arrow keys and Enter
  work throughout.
- **Breadcrumbs** on every inner page, and prev/next course links that stay within a track.
- **A slide-out drawer** replaces the nav below 820px.
- **Light and dark** follow the system by default and can be toggled; the choice persists.

## Pages

| File | What it is |
|------|-----------|
| `index.html` | Dashboard — activity, resume-where-you-left-off, weekly volume, tracks, admin shortcuts |
| `training.html` | The catalog — filter by track, search across lesson titles, four sort orders |
| `course.html?c=<slug>` | Course detail — lesson list, progress, team completion |
| `lesson.html?c=<slug>&l=<n>` | Lesson player with a sticky course outline |
| `people.html` | Roster — search, status and team filters, progress per rep |
| `teams.html` | The 48 sales teams and their learning-plan progress |
| `reports.html` | Daily activity, lessons-completed log, completion by course |
| `invite.html` | Single and bulk invitations |
| `profile.html` | Account settings and personal training progress |
| `settings.html` | Appearance, sign-up, training, API keys, SSO, retention, billing |

## Content and data

Course and lesson names are the real Wholesale Payments training catalog, extracted
from the site archive: **30 courses, 228 lessons** across four tracks.

### The real roster

People and Sales teams read the true roster — all 3,703 reps, their teams, and their
per-lesson completion history — from `assets/js/roster.js`. **That file is not committed**,
because this repository is public and the roster contains real names and personal email
addresses. Generate it locally from your archive:

```sh
python3 tools/extract-roster.py path/to/wpiuniversity.com
```

Reload and both pages pick it up automatically; People switches from the demo set to the
live roster (paged 100 at a time) and Teams computes head-counts and averages from actual
membership. Without it, both fall back to the seeded demo set and say so on the page.
`.gitignore` covers `assets/js/roster.js` so a stray `git add -A` cannot publish it.

The fallback data in `assets/js/data.js` is synthetic, generated with a fixed seed so the
demo is stable between loads, on the reserved `example-demo.test` domain. Course and
lesson names, aggregate figures and sales-team names are organisational, not personal, and
are committed as-is.

### Video

Lesson video sources live in `assets/js/media.js`, keyed by course slug and then
by either the lesson's index or its exact title:

```js
window.WPI_MEDIA = {
  "kloser-training": {
    0: { src: "https://cdn.example.com/kloser-setup.mp4" },
    "How To Create A Record": { src: "https://vimeo.com/123456789" }
  }
};
```

`src` can be a direct file (`.mp4`, `.webm`, `.m3u8`) or a share URL for Vimeo,
YouTube or Wistia — the player works out which and renders a `<video>` element or
the right embed. Optional per-entry fields: `type`, `poster`, `captions` (a WebVTT
URL or a list of tracks), `duration`, `download`.

For a bulk export, the importer matches rows to the catalog by normalised lesson
title, so a spreadsheet does not have to match character for character:

```sh
python3 tools/import-media.py lessons.csv --dry-run   # report coverage first
python3 tools/import-media.py lessons.csv
```

It needs a course column, a lesson column and a URL column under any reasonable
header name, and it reports every row it could not match along with the closest
candidate rather than dropping it silently.

`assets/js/media.js` is generated from the LMS migration manifest and maps **199
lessons to their Vimeo videos** — 25.2 hours of runtime, 19 of 30 courses covered
end to end. The importer reads the manifest's `.xlsx` directly, understands its
`Vimeo ID` / `Vimeo Hash` / `Video` columns, and skips the rows it marks as having
no video:

```sh
python3 tools/import-media.py WPI_LMS_Migration_Manifest.xlsx --fuzzy
```

`--fuzzy` accepts close title matches and prints each one for review — the manifest
writes one objection lesson as "does not qualify" where the LMS has "doesn't".

**The Vimeo hash is the unlisted-video key.** 132 of the 199 videos are unlisted,
and anyone holding the id and hash can watch them. That is why this repository is
private. If it ever goes public, self-host the files instead (below) and drop the
hashes.

To self-host rather than embed, download the originals with the manifest's own
script and re-import against the file paths:

```sh
python download_vimeo.py --token <VIMEO_TOKEN> --manifest wpi_video_manifest.csv --out ./wpi_videos
python3 tools/import-media.py WPI_LMS_Migration_Manifest.xlsx --base https://cdn.example.com/wpi
```

**29 lessons have no video, and that is mostly correct**: 19 are quizzes and 6 are
document downloads. Four are genuine gaps — PCI Program's single lesson, and three
of the four Customer Connect lessons.

Playback is wired for an LMS rather than a bare `<video>` tag: position is saved
as it plays and resumed on return, a lesson marks itself complete at 95% or on
`ended` and advances to the next one, playback speed persists across lessons, and
keyboard control covers space/`k`, arrows for seek and volume, `m` and `f`.
Progress is per lesson in `localStorage` and drives the ticks in the course
outline, the ring on the course page, the resume button and the dashboard.

A lesson with no source mapped is not broken — it says so and shows the exact key
to add.

### Offline

The site is a PWA: a service worker precaches the app shell, so it opens and
navigates with no connection at all. Course pages offer **Download course**, which
stores that course's video files on the device; Settings → Offline shows what is
stored, the browser's storage quota, and lets you remove a course or all of them.

**Only self-hosted files can be taken offline.** A Vimeo embed fetches from
`player.vimeo.com` at play time and never reaches the service worker, so those
lessons need a connection every time and the UI says so rather than pretending
otherwise. Making the library offline-capable means downloading the originals and
serving them yourself:

```sh
python download_vimeo.py --token <VIMEO_TOKEN> --manifest wpi_video_manifest.csv --out ./wpi_videos
python3 tools/import-media.py WPI_LMS_Migration_Manifest.xlsx --base https://cdn.example.com/wpi
```

Two constraints worth planning around. A service worker needs a secure context, so
this is inert on `file://` and over plain HTTP to a remote host — serve it over
HTTPS or localhost. And the whole library is 25.2 hours: at roughly 0.9 MB per
minute that is about 1.4 GB, which is why downloads are opt-in per course rather
than all-or-nothing. iOS Safari is much stricter about storage than Chrome, so
expect reps on iPhones to keep a couple of courses rather than everything.

### Billing

Settings → Billing runs on the account's real records: **50 invoices and 58 charge
attempts, June 2022 to August 2026**. Regenerate from a billing export with:

```sh
python3 tools/import-billing.py path/to/WPI_Billing_Records
```

That writes `assets/js/billing.js` and copies the invoice PDFs into
`assets/billing/invoices/` so each row links to one. Every total is recomputed from the
CSVs rather than trusted from the summary sheet, and the importer prints a warning if
invoiced, paid and applied ever stop agreeing. Today they reconcile exactly:
**$21,500.00 invoiced, $21,500.00 paid, nothing outstanding.**

Three things the page is careful to state rather than gloss:

- **The PDFs were generated from the account's own records**, not issued by the billing
  provider. They are a filing convenience; documents on the provider's letterhead have
  to be requested from them.
- **Payments carry no invoice reference in the source.** Each charge is attributed to the
  most recent invoice issued on or before it. Every one resolves cleanly, but the link is
  inferred, and the panel says so.
- **8 of 58 charges were declined**, in three clusters (Oct–Nov 2022, Oct–Nov 2025,
  Dec 2025–Jan 2026). Each cluster ended in a success so nothing went unpaid, but the
  panel flags the pattern — repeated declines usually mean the card is near an expiry or
  limit. The Dec 2025 failure is also why the billing date moved from the 28th to the
  12th, so there is no invoice dated 2026-01-28; that is a re-anchor, not a gap.

Card details were deliberately excluded from the export and none are stored here. The
records are still real financial data for a real account — another reason this repository
stays private.

## Running it

No build step, no dependencies. Serve the directory:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Any static host works.

## Structure

```
assets/
  css/app.css      design tokens, components, motion — one file, no preprocessor
  js/data.js       generated content model (courses, lessons, fallback roster)
  js/roster.js     the real roster — generated locally, never committed
  js/media.js      lesson video sources, keyed by course and lesson
  js/billing.js    invoices and payments, generated from the account export
  billing/         invoice PDFs, one per invoice
  js/app.js        shell: nav, drawer, command palette, theme, motion primitives
  img/             the logo, split into mark + wordmark, and an SVG favicon drawn from it
*.html             one file per page; shared chrome is rendered by app.js
sw.js              service worker: shell cache, video cache, download messaging
manifest.webmanifest  PWA manifest so the site installs to a home screen
tools/
  extract-roster.py  rebuilds assets/js/roster.js from a site archive
  import-media.py    fills assets/js/media.js from a CSV of lesson video URLs
  import-billing.py  fills assets/js/billing.js from a billing export
```

Each page defines a `window.pageInit` before loading `app.js`; the shell calls it, then
wires up reveals, counters, rings and bars. Re-render dynamic content and call
`App.refresh()` to re-arm them.
