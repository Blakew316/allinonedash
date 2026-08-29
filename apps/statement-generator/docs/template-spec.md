# Merchant Statement Template — Geometry Specification

This spec was reverse-engineered from five reference statements (April–June 2026,
two merchant accounts). All five share one template; every coordinate below was
measured from the source PDFs with pdfplumber and is expressed in PDF points
using a **top-left origin** (y grows downward). The layout engine
(`js/statement.js`) converts to PDF bottom-left origin when drawing.

## Page

| Property | Value |
|---|---|
| Page size | 594.96 × 841.92 pt (A4 rendered at 96 dpi by the original HTML engine) |
| Content left edge | x = 36.8 |
| Content right edge | x = 559.2 |
| Content top (continuation pages) | y = 28.0 |
| Content bottom limit | y ≈ 810 (blocks must end above the page footer) |

## Type

| Role | Font | Size | Line box |
|---|---|---|---|
| Body | DejaVu Sans ExtraLight | 9.5 | 14.25 |
| Emphasis / headers / notices | DejaVu Sans Bold | 9.5 | 14.25 |
| "Statement" title | DejaVu Sans Bold | 17.0 | — |
| Page footer ("Page: n/N") | DejaVu Sans (Book) | 10.0 | — |

Text rows sit in 14.25pt line boxes; the glyph top ("text top" below) is
**box top + 2.9**. Word-wrap is greedy, left-aligned, never justified.

## Color

| Role | RGB (0–1) | Hex |
|---|---|---|
| Navy rules | (0.2039, 0.2863, 0.3686) | `#34495E` |
| Gray rules | (0.4, 0.4, 0.4) | `#666666` |
| Logo placeholder fill | (0.7529, 0.7529, 0.7529) | `#C0C0C0` |
| Text | black | `#000000` |

Rule weights: heavy = 1.4pt, thin = 0.7pt, gray = 0.7pt. All rules are filled
rects, not stroked lines.

## Page footer (every page, including cover)

- `Page:` — DejaVu Sans 10pt at x=500.2, text top y=817.7
- `n/N` — same style at x=530.2 (cover counts as page 1)

## Cover page (page 1)

Fixed composition; no flowing content.

| Element | Geometry |
|---|---|
| Logo box | (37.2, 37.2) to (189.1, 95.5) — w=151.9, h=58.3. Gray `#C0C0C0` placeholder when no logo; uploaded logo drawn contain-fit, anchored left, vertically centered |
| Remittance address | ExtraLight 9.5, left-aligned at x=446.4; first text top y=47.9, then 14.25 per line (line boxes from y=45.0). Capped at 3 lines — a fourth would collide with the rule at y=95.8 |
| Navy rule | (36.8, 95.8) to (559.2, 96.5) — thin, 0.7 |
| Auto-charge notice | Bold 9.5 at x=36.8, wrapped at width 531.2 (samples overflow the 559.2 edge to ≈568); single line has text top y=788.7; with n lines the first line top is 788.7 − (n−1)·14.25 |

## Content flow (pages 2+)

Content blocks flow top to bottom starting at y=28.0 (the very first block on
page 2 starts at line-box y=31.4). Order:

1. **Important notices** — optional. Bold 9.5, UPPERCASE, wrapped at width
   522.4 (36.8→559.2). Multiple notices are joined with a literal `||`
   separator (matches samples). Breakable across pages.
2. **"Statement" title** — Bold 17. Title text top = last notice line box
   bottom + 8.75 (measured 20.1 below the last notice line's text top). When
   there are no notices, the title is the first block.
3. **Bill to / Details section** — starts 23.1 below title text top:
   - Heavy navy rule (1.4) across 36.8→559.2
   - Header row: `Bill to` bold at x=36.8, `Details` bold at x=271.9; text top
     = rule top + 6.3
   - Thin navy rule at rule top + 18.3 (0.7 thick)
   - Content rows: line boxes start at thin-rule bottom; text top +2.9; rows
     every 14.25
   - Left column (Bill to): merchant name + address lines, ExtraLight, x=36.8,
     wrapped at width 225
   - Right column labels: Bold at x=271.9, wrapped at width 110 (e.g. "Billing
     Account Number" wraps after "Account")
   - Right column values: ExtraLight at x=386.8, **never wrapped** (Billing ID
     may overflow past 559.2 — matches samples), stacked at 14.25 regardless
     of label wrapping
   - Labels: Statement Number, Issue date, Payment terms, Billing ID, Billing
     Account Number, Product ID
   - Unusually long sections simply continue their rows on the next page
     (no header repetition)
4. **Summary header** — `Summary for <Mon DD, YYYY> - <Mon DD, YYYY>` bold;
   text top = section end + 16.45 below the last content line box bottom.
5. **Total Sales / Transaction Count** — labels bold at x=36.8 and x=201.1,
   text top = summary top + 27.8; values ExtraLight one line box below
   (+14.25). Total Sales formatted `$1,925.59`.
6. **Fee type summary table** — heavy rule top = value line box bottom
   + 14.15:
   - Header: `Type` bold left at 36.8; `Amount($)` bold right-aligned to
     559.2; text top = rule top + 4.3; thin rule at rule top + 15.6 (column
     split at x=350.2, invisible in output)
   - Rows (one per included fee category): name ExtraLight at 36.8, amount
     right-aligned to 559.2, first text top = rule top + 19.2, rows at 14.25
   - Closing **gray** rule (0.7) at the last row's box bottom **+ 0.7**
     (measured in the references: April gray top 397.0 vs box bottom 396.35,
     May 300.0 vs 299.35 — unlike the fee detail tables, whose gray rule sits
     exactly at the box bottom)
7. **Totals block** — labels at x=298.0, values right-aligned to 559.2; first
   text top = gray rule bottom + 8.4; rows on 14.25 line boxes:
   - `Subtotal in <CUR>:` `$129.51`
   - `Tax (<r>%):` `$0.00`
   - navy thin rule (298.0→559.2) at row box boundary; next row's box top =
     rule bottom
   - `Amount Total:` + `Fees Collected:` `$(74.05)` — these two rows and the
     rule after them appear **only when fees collected ≠ 0** (April omits
     them; the rule after Tax then directly precedes Amount Due)
   - `Amount Due:` bold, both label and value
   - Negative currency renders as `$(74.05)`
8. **Forced page break**
9. **Fee detail tables** — one per included category, in order: Transaction
   Fees, Card Network Fees, Other Processing Fees, Third Party Fees,
   Recurring Fees. Category included ⇒ table renders even with zero items
   (header + Total 0.00). Category excluded ⇒ appears nowhere (neither here
   nor in the type summary). Table geometry (top = Y):
   - Heavy navy rule at Y (1.4), full width, columns split at x = 336.0,
     367.9, 423.5, 466.9, 501.5
   - Header: section name bold at 36.8; column heads bold right-aligned:
     `Count`→367.9, `Volume($)`→423.5, `Rate(%)`→466.9, `Fee($)`→501.5,
     `Amount($)`→559.2; text top = Y + 4.3
   - Thin rule at Y + 15.6
   - Item rows: description ExtraLight at 36.8 (single line, clipped at the
     column edge); numerics right-aligned to the column edges above; first
     text top = Y + 19.2; rows at 14.25. Empty cells render `--`; an empty
     Amount is first derived from Volume × Rate(%) or Fee × Count when those
     are present (tool behavior — the references always carry explicit
     amounts), rendering `--` only when nothing is derivable. Volume
     formatted with thousands separators, 2dp. Rate and Fee are free-form
     strings (e.g. `3.85%`, `45`, `0.1`).
   - Gray rule (0.7) at last item row's box bottom, then `Total` ExtraLight +
     summed amount right-aligned; total text top = gray rule bottom + 2.9
   - Gap between tables: next heavy rule top = total row box bottom + 20.3
   - If a table's full height cannot fit and it is not at a page top, break
     before it; only tables taller than a full page split between item rows,
     repeating the header band on the continuation page
10. **Forced page break**
11. **Batch Details** — omitted when there are no batch rows:
    - Title `Batch Details` ExtraLight at 36.8, text top = 44.5 (16.5 below
      content top on its page)
    - Heavy rule at title top + 24.9; column splits at x = 98.6, 177.9, 231.5,
      304.8, 365.8, 446.6, 492.7
    - Two-line bold header, right-aligned per column with 3.4pt right inset
      (→ 95.2, 174.5, 228.1, 301.4, 362.4, 443.2, 489.3, 555.8): `Date`,
      `Batch/Number`, `Sales/Count`, `Sales/Amount($)`, `Refund/Count`,
      `Refund/Amount($)`, `Net/Count`, `Net/Amount($)`; first header line top
      = rule top + 4.3, second +14.2
    - Thin rule at rule top + 29.8
    - Data rows: all cells right-aligned to the same insets (date lands at
      x=40.4); first text top = thin rule bottom + 2.9; rows at 14.25. No
      total row.

## Amount formatting

- Type-summary and table amounts: `74.26`, `1,207.69` (2dp, thousands
  separators, no `$`)
- Totals block: `$129.51`, negative `$(74.05)`
- Total Sales: `$1,925.59`
- Batch and fee counts: integers, thousands-separated when ≥ 1,000 (the
  references contain no such values; grouping matches the amount columns)

## Reference sample values

`Statement_815230777881_May_2026.pdf`: Subtotal $129.51 = category totals
74.26 + 0.25 + 55.00 + 0.00 + 0.00; Amount Due $55.46 = 129.51 − 74.05;
Total Sales $1,925.59 and Transaction Count 21 equal the batch table's summed
net amounts / sales counts.
