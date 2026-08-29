# Customer Connect — site redesign

A rebuild of [customerconnectwp.com](https://customerconnectwp.com) as a fast, fully
self-contained static site, branded from the Wholesale Payments logo with an
Apple-style system type stack and a motion layer built from scratch.

The original site was WordPress + Elementor + the Silicon theme: ~120 KB of markup per
page, a dozen jQuery plugins, and remote assets on every view. This version ships the
same 43 pages as ~30–55 KB of clean HTML each, one 41 KB stylesheet, one 14 KB script,
and the logo artwork — **zero external requests, zero fonts to download, zero JS
dependencies.**

```
open index.html          # works straight off the filesystem
python3 -m http.server    # or serve it, for nicer relative-link behaviour
```

---

## What's here

| Path | What it is |
| --- | --- |
| `*.html` | 43 generated pages (same URL slugs as the original site) |
| `assets/css/site.css` | The whole design system — tokens, components, motion, responsive |
| `assets/js/site.js` | Interaction layer: nav, reveals, counters, tabs, carousel, forms |
| `assets/img/` | Header lockup, bar glyph, favicon — cut from `assets/logo.png` |
| `tools/` | The generator that produces the pages (see below) |
| `sitemap.xml`, `robots.txt` | Generated alongside the pages |

## Branch layout

This repository was created empty, with no commits and no branches, so the redesign
landed before a trunk existed. The current shape:

| Branch | Contents |
| --- | --- |
| `claude/site-redesign-professional-cprfye` | The redesign. **Currently the repository default branch** — GitHub assigned it when it was the only branch. |
| `main` | An empty baseline commit, created solely to give the pull request something to target. |

Two consequences worth knowing about:

- The open pull request merges the *default* branch into a non-default one, which is the
  reverse of the usual direction.
- Switching the default to `main` before that PR merges would leave the repository home
  page showing an empty tree, because `main` currently holds no files.

The intended end state is `main` as both trunk and default branch, once the redesign has
merged into it.

## Brand system

Colour is sampled directly from `assets/logo.png` with `tools/palette.py` — not
eyeballed. The five measured source colours, with their contrast on white:

| Role | Hex | On white | Usable for |
| --- | --- | --- | --- |
| Navy (wordmark) | `#00115b` | 17.06:1 | Body text, dark sections, footer |
| Blue (bar, upper) | `#0091ea` | 3.37:1 | Large text, fills, gradients |
| Emerald (bar, middle) | `#00c16e` | 2.37:1 | Fills and gradients only |
| Mint (bar, lower) | `#51ed80` | 1.52:1 | Fills and gradients only |
| Gray ("payments") | `#a3acb3` | 2.31:1 | Decorative only |

Only the navy is legible as body text, so the scale adds two darkened tints for
anything type-bearing: `--wp-600: #006eb3` for links and eyebrows (4.68:1 even on
the tinted washes) and `--gr-700: #007542` for green icons and ticks.

The signature gradient is the logo's own bar glyph read left to right —
`--grad-brand: linear-gradient(135deg, #0091ea, #00c16e 58%, #51ed80)` — and it
carries every primary action, icon tile, and numeric highlight. Dark sections use
a navy ramp built on `#00115b`.

Star ratings keep a warm `--gold-500`, which is a rating convention rather than
brand chrome; change that one token if it should be brand-coloured instead.

**Type** is the Apple system stack — `-apple-system, BlinkMacSystemFont, "SF Pro
Display", "SF Pro Text"`, falling back through Segoe UI Variable / Inter / Roboto.
Real SF on Apple hardware, nothing to download anywhere, and tuned the way Apple
sets it: negative tracking that tightens as size grows (`-0.042em` on display,
`-0.011em` on body), semibold rather than bold headings (`640`), and
`text-wrap: balance` on headings.

**Logo assets** are cut from the supplied artwork by `tools/crop_logo.py`. The
source lockup carries ~22% empty width and ~60% empty height around the ink, so
it is trimmed to true bounds before use:

| File | Size | Where |
| --- | --- | --- |
| `assets/logo.png` | 1125×540 | Original artwork, untouched |
| `assets/img/logo.png` | 876×217 | Header lockup |
| `assets/img/mark.png` | 143×217 | Footer and auth — the bar glyph alone, since the navy wordmark cannot read on dark |
| `assets/img/favicon.png` | 64×64 | Browser tab — glyph only |

## App icon

The installable/home-screen icon carries the `WPI CC` wordmark under a reduced
glyph. It is rendered from `tools/icon/icon.template.html` by
`tools/make_icon.js` — there is no imaging library here, so headless Chromium
does the rasterising, which also gives real font rendering for the wordmark.

| File | Size | Where |
| --- | --- | --- |
| `assets/img/icon-512.png` | 512×512 | PWA manifest |
| `assets/img/icon-192.png` | 192×192 | PWA manifest |
| `assets/img/apple-touch-icon.png` | 180×180 | iOS home screen |
| `assets/img/favicon.png` | 64×64 | Browser tab — **no wordmark**, illegible at tab size |

The artwork is full-bleed rather than pre-rounded, because iOS and Android apply
their own mask and baking corners in would double-round. All ink sits inside the
Android maskable safe circle (furthest corner 196.7px against a 204.8px radius),
so a single asset serves `purpose: "any maskable"`.

`site.webmanifest` sets `short_name` to `WPI CC` so the home-screen label matches
the icon; `apple-mobile-web-app-title` does the same on iOS.

```bash
node tools/make_icon.js    # re-render every icon size
```

## Motion

Everything is CSS transitions and transforms driven by `IntersectionObserver` — no
animation library, nothing that blocks paint, and every effect gated behind
`prefers-reduced-motion: reduce`.

- **Scroll reveals** with four variants (up / left / right / scale / blur) and automatic
  stagger for grid children via `data-stagger`
- **Hero word rotator** — cross-fading stacked grid so the headline never reflows
- **Count-up statistics** on `easeOutQuart`, formatted with prefix/suffix/decimals
- **Sticky header** that gains blur, a hairline, and 10px of height on scroll
- **Mega menus** that fade and lift, with hover intent, keyboard support, and `Escape`
- **Animated tab rail** with a spring indicator that tracks the active item, plus
  pause-on-hover autoplay
- **Accordions** using `grid-template-rows: 0fr → 1fr` so height animates without JS
  measurement
- **Testimonial carousel** with scroll-snap, pointer drag, and nav that hides itself when
  every slide already fits
- **Pricing toggle** with a sliding knob and a flash transition on each price
- **Cursor-tracked card glow**, gradient-border hover states, floating phone mock with a
  live SMS thread, animated bar charts, marquee, scroll progress, page-transition veil

Easing is Apple-flavoured throughout: `cubic-bezier(.16, 1, .3, 1)` for entrances,
`cubic-bezier(.34, 1.56, .64, 1)` for the springy ones.

## Content

Marketing copy is carried over from the live site. Long-form content — 14 blog articles,
the privacy policy, merchant terms, and kiosk troubleshooting — is extracted from the
original export rather than rewritten, so nothing legal or editorial is paraphrased. Two
things were changed deliberately: the lorem-ipsum blocks that shipped on the live
`/custom-mobile-web-app/` and home pages are replaced with real copy, and the `Products`,
`Solutions`, `Sign-In`, and `Resource Center` pages — which were empty title-only stubs —
are built out as working hub, auth, and resource pages.

## Regenerating

```bash
python3 tools/build.py                        # rebuild from the cached content
python3 tools/build.py --src path/to/export   # re-extract from the WordPress export
```

| File | Responsibility |
| --- | --- |
| `tools/build.py` | Page assembly, WordPress extraction/cleanup, sitemap |
| `tools/layout.py` | Header, footer, nav model, and shared section builders |
| `tools/content.py` | Per-page content data (heroes, features, pillars, posts) |
| `tools/icons.py` | ~90 inline SVG icons on a 24px stroke grid |
| `tools/palette.py` | Samples the logo and emits the brand token scale |
| `tools/crop_logo.py` | Cuts the header lockup and glyph from the artwork |
| `tools/make_icon.js` | Renders the app icons, wordmark included, via headless Chromium |
| `tools/longform/` | Cached, cleaned article and legal fragments |

`tools/longform/` means the site rebuilds without the 4.6 MB original export. Pass
`--src` when you have it and the cache refreshes in place.

## Accessibility & quality

- Semantic landmarks, skip link, one `<h1>` per page, visible focus rings
- `aria-expanded` / `aria-selected` / `aria-controls` on every disclosure and tab;
  arrow-key navigation on the tab rail; `Escape` closes menus and the drawer
- All 43 pages pass a tag-nesting validation pass and an internal-link check
- No horizontal overflow from 320px up; no console errors on any page
- Print stylesheet strips chrome and reveals all animated content
