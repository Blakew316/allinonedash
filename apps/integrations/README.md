# Integration Atlas

An interactive, filterable directory of every processing-compatible brand in the
*POS Conversions — Compatible Brands by Category* workbook — 624 brands across 33
categories, each enriched with:

- **Rank** — a 1–10 read on the software's overall strength today (10 = best)
- **SaaS fees** — the vendor's published pricing, web-verified for major vendors
- **3 benefits** — why merchants pick it
- **Who to call** — company, direct phone line (tap-to-dial), email, and website per
  brand, sourced from the POS Conversions site data (398 brands have phone lines)
- **Conversion & compatibility** — EMV terminal and gift-card support, cash-discount
  notes, hardware, conversion costs, and the field notes from the POS Conversions site
- **Directory details** — category, solution type (Point of Sale / Virtual Solution /
  Gateway / API Solution), niche, and listing date from the workbook

## Using it

Open `index.html` in any browser — no build step, no server needed. Search with `/`,
filter by category pills or solution type, and click any card for the full breakdown.

**Install as an app (PWA):** when hosted over HTTPS, open the site in Safari on
iPhone/iPad → Share → **Add to Home Screen**. It installs with the Wholesale Payments
logo as the app icon, launches full-screen, and keeps working offline.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The site — single file, data embedded |
| `data/integrations.json` | The enriched dataset, for reuse |
| `data/POSConversions_CompatibleBrands_byCategory.xlsx` | The source workbook |
| `data/pos-data.json` | Raw POS Conversions site data (all 1,602 entries) |
| `manifest.webmanifest`, `sw.js`, `icon-*.png`, `apple-touch-icon.png` | PWA layer — installable on iOS/Android with offline support |

## Data provenance

Brands and categories mirror the source workbook (all entries are processing-compatible
"green checkmark" systems). Rankings and fees are directional estimates as of Aug 2026,
web-verified where the vendor publishes pricing. Always confirm pricing and compatibility
with the vendor before quoting a merchant.
