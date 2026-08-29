# Wholesale Payments — Website

A complete, professional redesign of [wholesalepayments.com](https://wholesalepayments.com) —
light, Apple-inspired, and themed entirely around the official Wholesale Payments
logo (blue `#20a0d0` · teal `#45a583` · green `#48b84f`). Built with zero tooling:
plain HTML, CSS, and vanilla JavaScript, deployable anywhere static files are served.

## Design principles

- **Light and airy** — white base with very light hues of the logo's blue and
  green. No heavy fills, no dark sections; hairline borders and soft shadows.
- **Apple-style type** — the SF Pro system font stack (`-apple-system`) with
  Inter as the cross-platform fallback; large tracking-tight headlines.
- **The exact logo** — `assets/logo.png` is the official mark (extracted from
  brand collateral), used as-is everywhere. The favicon is a crop of its bar mark.
- **Elegant, restrained animation** — scroll reveals, animated count-ups, a
  floating sales-dashboard card, industry ticker, and gentle hover lifts, all
  honoring `prefers-reduced-motion`.

## Pages

| Page | Content |
| --- | --- |
| `index.html` | Home — hero, advantage cards, transparency & support panels, equipment teaser, stats, $45 pricing, contact |
| `products.html` | **Products tab** — three simple sections: Terminals (Valor VL550, Dejavoo P1), POS Systems (Clover Station Duo, Genius POS, Union POS), SaaS Integrations (QuickBooks Online, Shopify, Aloha) |
| `about.html` | Story (2007 garage start-up → 50 states), the Wholesale difference, industries, leadership |
| `processing-solutions.html` | No-fee processing, industry solutions (retail, restaurant, online, wireless, petroleum, B2B) |
| `careers.html` | Benefits, open positions, application form |
| `contact-us.html` | Quote form, every direct line, HQ & office locations |
| `privacy-policy.html` / `terms-and-conditions.html` | Verbatim legal text from the existing site, restyled |

Product copy is sourced from the real vendor collateral (Valor VL550, Dejavoo P1,
Clover Duo, Genius, and Union POS PDFs); product photos in `assets/products/` are
extracted from that same collateral.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Notes

- The contact/careers forms are front-end demos — wire them to HubSpot or your
  CRM endpoint in `scripts/main.js` (the old site used an embedded HubSpot form).
- The Agent Portal link points to the live site's `/resource-bank`, which is
  internal/agent-facing and intentionally not part of this public redesign.
