# WPI Rewards — Portal Redesign

A ground-up redesign of the WPI Rewards merchant portal (wpirewards.com) as a
static, dependency-free prototype: professional and corporate, with Apple-style
system typography (SF Pro stack), a simplified navigation flow, and seamless
page transitions.

## Pages

| Page | File |
|---|---|
| Dashboard | `index.html` |
| Rewards Catalog | `rewards.html` |
| Earnings Summary | `earnings.html` |
| Order History | `orders.html` |
| Cart | `cart.html` |
| My Profile | `profile.html` |
| Terms / Privacy | `terms.html`, `privacy.html` |

## What actually works

- **Live catalog** — category segmented control, search, sort, and a
  "Within my points" toggle, all filtering a real data set
  (`assets/js/data.js`) built from the account snapshot.
- **Working cart** — persisted in `localStorage`, quantity steppers, points
  math against the available balance, an insufficient-points guard, and a demo
  checkout that files the order into Order History.
- **Charts without libraries** — the balance donut and the
  points-over-time line chart (with hover crosshair + tooltip) are generated
  inline as SVG from the transaction data.
- **Seamless transitions** — cross-document View Transitions where supported,
  a JS fade fallback elsewhere, scroll-reveal sections, count-up numerals, and
  respectful `prefers-reduced-motion` handling.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## Notes

- Profile contact/shipping fields are prefilled with **sanitized placeholder
  values** — swap in real account data when wiring to the API.
- Terms and Privacy pages are clearly-marked placeholders; paste the official
  program text before launch.
- Fonts and scripts are self-contained (nothing fetched from CDNs). Product
  photos load from the live catalog's image host; when those are unreachable,
  each card falls back to its built-in gradient art automatically.
