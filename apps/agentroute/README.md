# WPI Agent Route

A team field-route planner for Wholesale Payments: managers sign in, build
ZIP-based merchant routes for their reps, and watch notes roll in live.

`index.html` is the whole app. Deploy the full repo to Netlify (it includes
`netlify.toml`, `netlify/functions/`, `manifest*.webmanifest`, `sw.js`, and
`icons/`).

## Team logins

Auth and data run on Supabase (project `xeevmevxjuawskugedds`, tables
`wp_teams` / `wp_team_members` / `wp_team_state`, row-level security so a
team's members are the only people who can read or write its data; the
`wp_create_team` / `wp_join_team` RPCs handle setup).

- Sign in with email + password (create an account on first use; accounts
  work on every device — each browser signs in once and the session then
  persists there). A signed-in user can set a new password from the team
  menu (tap the team name), which then works everywhere. To skip email-confirmation friction, disable
  "Confirm email" under Authentication → Providers in the Supabase
  dashboard.
- First sign-in offers **Create a team** (empty to start) or **Join a
  team** with a 6-character join code. The built-in Team Maverick agent
  roster preload is reserved for its owner's sign-in only — no one else
  sees the option.
- The team name shows at the top of the site, generates into the
  checkpoint labels and reports, and the team chip opens join-code
  sharing, team switching, and sign-out.
- Changes sync to the team silently within seconds (Postgres realtime).
  Per-device data is cached per team, and offline edits merge back
  newest-wins.
- Inside the Claude artifact the app instead syncs through the artifact
  runtime (no login); with neither available it runs per-device.

## Building routes

Each agent profile (tap a roster card) holds their territory ZIP, home
base, contact info, and route tools:

- **Auto-generate list** (hosted site only) searches the agent's ZIP via
  Google Places for small businesses at or under the review cap (default
  150 reviews), interleaves categories, best-effort pulls a public contact
  email / owner name from each business's website, and builds the agent's
  **full 6-day route with up to 25 merchants per day**, checkpoints every
  5 stops. Requires `GOOGLE_PLACES_API_KEY` in Netlify environment
  variables (Places API (New), billing enabled).
- Manual paste-import: one business per line into any day ("owner: Name",
  a second phone, and an email are auto-detected).

## Working a route

Merchant cards are minimal: name, tap-to-call phone, tap-to-open Maps
address, tappable owner contact when known, and a **notes line** — a note
marks the stop worked, stamps the time, advances the Up-next marker, and
feeds the day/week tallies, the live ticker, the copyable day report, and
the PDF export (all six days, blank note lines when unworked).

Also included: iOS PWA install (offline shell, safe-area layout, light and
dark app icons chosen by the in-app theme toggle), and an animated team
activity ticker above the header.
