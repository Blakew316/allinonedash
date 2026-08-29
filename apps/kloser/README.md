# Kloser CRM — Wholesale Payments

A ground-up redesign of the Kloser CRM field application: the same information
architecture and the same data as the original, rebuilt as a fast, animated,
brand-native interface that works from a 390 px phone to a 1600 px desktop.

```
npm start          # http://localhost:5173
```

No build step, no dependencies. `server.js` is a ~50-line static server; the app
is ES modules, plain CSS and JSON. Any static host will serve it as-is.

---

## What's in here

| Area | Route | What it does |
| --- | --- | --- |
| Dashboard | `#/` | KPIs, lead intake, pipeline snapshot, conversion efficiency, pending action, rep performance, live activity, territory coverage, appointment queue |
| Team | `#/team` | Conversion funnel, conversion metrics, per-rep leaderboard, visit volume, GPS verification, full roster |
| Map | `#/map` | Google Maps (with a key) or the built-in tile map — Area Search, Biz Search, Select Leads, filters, clustered pins, lead detail |
| Routes | `#/routes` | Planned routes, stop progress, completed runs, field sessions, route builder |
| My Schedule | `#/schedule` | Today / overdue / upcoming agendas and a month calendar whose every square opens that day |
| Activities | `#/activities` | Every logged visit, call and appointment, with setter notes |
| Leads | `#/list` | The full lead list — stage rail, filters, sort, pagination, row selection, bulk actions, column chooser, CSV export, detail drawer |
| Rep Pipeline | `#/pipeline` | The book as a ten-column stage board |
| BCL Queue | `#/bcl-queue` | Business card leads awaiting call-center follow-up — status tabs, GPS-source and flagged filters, date range, selection, paging |
| Rep Schedule | `#/rep-schedule` | A working month calendar of everything dated, filterable by rep and type, plus the weekly availability matrix across all 925 reps |
| Appointment Board | `#/appointment-board` | Bookability, pull-lead ZIPs and call-center assignment per rep |
| Email | `#/email` | Mailbox, templates, composer, Google connection state |
| Location Verify | `#/location-verify` | GPS verification report, flagged reps, per-record detail |
| Settings | `#/settings` | Account, appearance, communication, notifications, organization, danger zone |
| Sign in | `#/signin` | Front door |

Every screen from the original build is present, and every control on them: the
original's 174 labeled buttons, tabs, selects and switches were extracted from
its own `data-testid` markup and checked off one by one against this build.

---

## Installed app (PWA)

The app installs to the iOS Home Screen and **cold-launches with no network at
all** — which is the actual field condition: basements, back offices, rural
territory.

```
Add to Home Screen  →  full-screen, no Safari chrome, works offline
```

**Icon.** The real Wholesale Payments mark, shrunk just enough to sit above the
wording "WPI Kloser CRM", on a white brand tile. Exported opaque, full-bleed
and un-rounded — iOS composites icons on an opaque layer (transparency renders
black) and applies its own squircle mask, so a pre-rounded PNG gets rounded
twice. Sizes at or below 192px get an unsharp pass to counteract the softening
that downsampling introduces; without it the mark's bars turn to mush at 60pt.
A dark variant ships alongside the light one.

**What actually reacts to dark mode.** Worth being precise, because iOS is
inconsistent here:

| Surface | Reacts? |
| --- | --- |
| Launch screen (88 images) | **Yes** — `(prefers-color-scheme: dark)` on every `apple-touch-startup-image` |
| Browser favicon | **Yes** — `media` on `<link rel="icon">` |
| Safari chrome tint | **Yes** — `theme-color` per scheme |
| Status bar on next launch | **Yes** — `pwa.js` rewrites the meta on theme change |
| The app UI itself | **Yes** — full second palette |
| **iOS Home Screen icon** | **No** — WebKit has no dark-variant slot for `apple-touch-icon`. The dark master is shipped and wired everywhere that does honor it. |

**Launch screens.** 22 devices × 2 orientations × 2 themes = 88 exact-pixel
images, from iPhone SE (1st gen) to iPad Pro 13-inch M4/M5. iOS synthesizes
nothing from the manifest and will not scale a near miss — an unmatched device
cold-starts into a white flash.

**Offline.** `sw.js` precaches the shell atomically (46 entries; every ES module
listed explicitly, because the browser only discovers imports by executing
them) and warms all eight datasets. Navigations resolve to the cached shell.
The two large datasets revalidate at most once a day rather than re-downloading
291KB every time someone opens the appointment board.

**Install prompt.** WebKit has no `beforeinstallprompt`, so the app renders its
own coach mark pointing at Safari's Share button — on the second visit, never
the first, and dismissible for good.

**Also handled:** safe-area insets on every fixed surface (notch, Dynamic
Island, home indicator, landscape); 16px form controls so focusing a field
never zooms the viewport; 44pt hit areas on coarse pointers; a position-fixed
scroll lock (`body { overflow: hidden }` does not hold in WKWebView);
`touch-action` on the map so a vertical drag pans instead of scrolling the
page; chart tooltips that dismiss on touch-end; row actions that are visible
without hover; `visualViewport` tracking so the keyboard never buries the
command palette; resume-where-you-left-off, because iOS kills backgrounded web
apps; `navigator.storage.persist()` against eviction; and a Home Screen badge
carrying the overdue count.

### Deploying

Two things the local preview server hides:

- **Bump `VERSION` in `sw.js` on every deploy.** There is no build step and no
  hashed filenames, so the cache name is the only version boundary. Forget it
  and installed users keep the old shell forever.
- **Serve `/sw.js` with `Cache-Control: no-cache`.** Default CDN configs cache
  it, which pins users to a stale worker.

Serve `manifest.webmanifest` as `application/manifest+json`, and the whole app
over HTTPS — service workers require it (localhost excepted).

## Design

**Brand.** The palette is sampled straight from the Wholesale Payments logo —
navy `#001160`, blue `#0090E9`, cyan `#00BAE6`, green `#00C271`, mint `#4FE778`,
gray `#AAAFB5`. Color is applied as light hues: tinted surfaces, hairlines,
low-opacity glows and thin gradient rules. There are no large color slabs
anywhere in the interface — the brand shows up in the accents, not the walls.

**Type.** Apple's system stack first (`-apple-system` → SF Pro), with Inter as
the cross-platform twin so non-Apple devices land in the same place. Tracking
tightens as type grows, exactly as SF does optically. Numerals are tabular
everywhere a figure might change.

**Motion.** Page transitions, scroll reveals with stagger, counters that tick
up, SVG paths that draw in, bars that grow from their baseline, spring-eased
sheets and menus, shimmer skeletons and press ripples. The entire motion layer
collapses to zero under `prefers-reduced-motion`.

**Dark mode.** A full second palette, not an inversion. Follows the system by
default; can be pinned light or dark from the top bar or Settings.

---

## Navigation

The rail groups the fourteen screens into five workflows — Overview, Field,
Pipeline, Booking, Admin — instead of one flat list. It collapses to icons,
remembers that choice, and becomes a drawer under 1024 px with a five-item tab
bar for the destinations reps actually use in the field.

`⌘K` (or `/`) opens a command palette that indexes every page, action, lead, rep
and activity in the app — all 200 leads, all 925 reps, every activity. It is the
fastest path between any two points.

**Everything leads somewhere.** Every rep name in the app — a table cell, a
schedule row, a lead's owner — opens the same rep sheet: availability for the
week, 30-day numbers, GPS verification rate, ZIP coverage, and one tap through
to their activities, their leads, their verification record or the availability
board. Every calendar square opens that day. Every KPI and pending-action row
drills into the screen that explains it.

**Back always works.** Modals and drawers push a history entry, so the iOS back
swipe and the browser Back button dismiss the sheet instead of leaving the
screen underneath it. Changing route tears down any sheet that is still open.
Filters on the lead list write themselves into the hash, so a filtered view can
be reloaded, shared or reached with Back.

**Keyboard and screen readers.** Route changes move focus to the top of the new
view and announce it through a polite live region, so a keyboard user is not
left parked on the nav link they just activated. The skip link jumps to the
content region without being mistaken for a route.

---

## Structure

```
index.html              boot splash, theme pre-paint, module entry
config.js               Google Maps key + map home position
server.js               zero-dependency static server
assets/                 logo mark (SVG), wordmark, favicon
data/*.json             the datasets, extracted from the original app
styles/
  tokens.css            brand seeds, semantic surfaces, motion + layout metrics
  base.css              reset, typography, grid helpers
  animations.css        the whole motion layer
  layout.css            rail, top bar, content, tab bar, chromeless routes
  components.css        cards, buttons, badges, tables, modals, palette, toasts
  charts.css            chart primitives
  pages.css             per-screen styles
js/
  main.js               route table + boot
  core/                 router, store, DOM helpers, formatters, icons
  components/           shell, palette, overlays, rep sheet, maps, calendar,
                        notifications, Google auth, charts, table, UI primitives
  pages/                one module per screen
```

## The map

The original ran the Google Maps JavaScript API with the field controls floated
over it, so this does the same. The Map screen is full bleed — the map fills the
whole canvas under the rail and top bar, with Google's own UI switched off and
the app's Area Search / Biz Search / Select Leads / Filters floating on top.

The map opens on the user's own position when they allow it, with a live "you
are here" marker, and falls back to fitting every pin when they do not. It
follows the site's light and dark setting rather than sticking to one.

**Turning Google on is one line.** Put a Maps JavaScript API key in `config.js`:

```js
export const MAPS_KEY = 'AIza…';
```

Restrict it to your domain in the Google console — `config.js` ships to the
browser, so the domain restriction is what protects it. A per-browser key can
also be pasted into Settings → Organization or the map's Layers menu, and that
overrides `config.js`.

**Without a key it still works.** `js/components/tilemap.js` is a slippy map
written from scratch — Web Mercator projection, raster tiles on a translated
layer, markers on a second unscaled layer so pins stay a constant size. Pan,
pinch, wheel-zoom, keyboard, clustering and fitting all behave the same either
way, because both engines expose the same small surface (`project`, `fit`,
`view`, `onRender`) and the Map screen does not know which one it got. If tiles
cannot be reached at all, the pins still render over a plain grid rather than a
gray void — a rep in a basement still needs to see the book.

**The three field tools.**

- **Area Search** scopes the book to whatever is on screen and lists it. With a
  Google key it also asks Places for businesses in that view that are *not* leads
  yet, which is the point of the button on a door-knocking round.
- **Biz Search** searches all 200 leads instantly, and Google Places alongside
  them when a key is set, so a rep can fly to somewhere that is not in the book.
- **Select Leads** turns the map into a selection surface: drag a box to take
  everything inside it, or tap pins one at a time, then add the lot to a route or
  export them with coordinates.

**Where the pins actually are.** The export carried street addresses but no
coordinates, and no geocoder is reachable from the build environment, so the
repo ships `data/geo.json` — a center point for each of the 45 towns in the book,
cross-checked so every one lands inside its own state. A lead sits at its city's
center with a deterministic spread, so the same lead is always in the same place,
and the screen says "city-level placement" rather than implying otherwise. With a
Google key the Geocoding API resolves the real addresses in the background and
caches them, and the pins move from the middle of town to the actual door.

## The calendar

Rep Schedule opens on a month calendar for the current month. Each day shows how
much is on it and a dot per activity type; picking one opens a panel listing
every entry with its rep, its time and its status, and any entry opens in full.
Filter by rep or by type, walk months with the arrows or the keyboard, and Today
snaps back.

It is built from the two datasets that actually carry timestamps — the activity
log and the GPS verification records. The weekly availability matrix has no
appointment counts in it at all (every row is zeroes in the export), so a
calendar drawn from that alone would be an empty grid. That matrix is still
there on its own tab, because it is what the original screen showed.

## Notifications

The bell opens a real panel rather than a fixed list. Items are derived from the
data — overdue activities, leads with no touch in two weeks, reps with no visits,
cards waiting on QA, reps below the verification target, and what is booked
today. Each can be read or unread, "mark all read" clears the dot, and that state
survives a reload. It lives in this browser; there is no server to hold it.

## Connecting Google

Settings → Organization connects a real Google account through Google Identity
Services: it opens Google's own consent screen and asks for Calendar events and
Gmail send, which is what that screen says it does. Put an OAuth 2.0 Web client
ID in `config.js` as `GOOGLE_CLIENT_ID` and add this site's origin to its
authorized JavaScript origins. Disconnecting revokes the token with Google.

There is no server in this build, so the token stays in the browser and expires
when Google says it does — nothing is refreshed behind the user's back.

## Data

`data/` holds the real datasets lifted from the original build — 200 leads,
925 reps, the weekly availability matrix, activities, routes, the BCL queue,
the verification report and the dashboard aggregates.

The original's own tables paginate, so its HTML export only ever contained the
first page of the long ones: 200 of 665 leads, 25 of 194 activities, 25 of 66
verification records. Those remaining rows were never in the file and cannot be
recovered from it. Rather than imply completeness, every count in the interface
says which number it is — "200 of 665 in this export" — and the stage rail,
funnel and donut all read their totals from the same aggregates, so no two
screens here can disagree.

Where the original disagrees with *itself* the numbers are reproduced as found,
with the discrepancy labeled rather than papered over: its lead list totals 665
while its dashboard KPI says 666, and its pipeline donut covers 605 of the book
because three stages sit outside those five buckets.

The dashboard's daily series are decoded from the original chart's own SVG path
coordinates rather than estimated, so the peaks land on the same dates with the
same values.

Swapping in a live API means changing one function — `data()` in
`js/core/store.js` — to hit real endpoints. Nothing else needs to move.

## Browser support

Evergreen Chrome, Safari, Firefox and Edge. Uses `color-mix()`, CSS nesting-free
custom properties, ES modules, `IntersectionObserver` and `Intl`. No polyfills,
no transpilation.
