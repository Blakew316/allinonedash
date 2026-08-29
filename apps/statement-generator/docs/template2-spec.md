# Card Processing Statement — Template 2 Geometry

Reverse-engineered from five 4-page reference statements ("YOUR CARD
PROCESSING STATEMENT", March–July 2026). Coordinates in PDF points,
top-left origin. Raw measurements: the pdfplumber extraction this spec was
distilled from lives with the session notes; `js/statement2.js` implements it.

## Page & palette

- Letter 612×792. Content x = 36 → 594.2. Footer band (2.88) at y=726.5,
  footer text (Arial 7) at (36, 734.6). Corner registration ticks (0.72
  black): (36,787.4)-(45.1,787.7), (570,787.4)-(579.1,787.7),
  (0.7,535.4)-(0.7,544.8), (598.6,540)-(607.7,540) on every page.
- All fills are stroked horizontal lines ("bands"); a band drawn at y with
  width w covers y±w/2. Colors are **CMYK**:

| Role | CMYK |
|---|---|
| banner gray | (0,0,0,.251) |
| light gray (total rows) | (0,0,0,.122) |
| red (not-a-bill, important box) | (0,1,1,0) |
| green rows / submitted col | (.149,0,.149,0) |
| pink (third party col) | (0,.102,.102,0) |
| purple (adjustments col) | (.122,.149,0,0) |
| blue (fees col + FEES CHARGED) | (.502,.251,0,0) |
| dark green (AMOUNTS SUBMITTED) | (.502,0,.502,.502) |
| orange (THIRD PARTY) | (0,.42,.702,0) |
| purple-dark (ADJUSTMENTS banner) | (.4,.502,0,0) |

## Type

- Body/labels: ArialMT (→ Liberation Sans, metric-identical). Table text:
  Helvetica std. Addressee/location/merchant#/customer-service values: the
  original embeds an unnamed font whose widths equal **Helvetica** — use
  std Helvetica 9.
- Faux small-caps titles: first letter of each word 12pt (glyph top t),
  rest 10pt (top t+1.6). White on banded headers, black on the page-top
  banner. Word gap ≈3pt.
- Section banner pattern: thin band lw=4.56 at yB across full width, thick
  band lw=18 at yB+11.2 spanning just the title width, title text top ≈
  yB+5.8 (12pt letters). Page-top banner: lw=7.2 at y=25.2 + lw=18 at
  37.7 (36→252.7), title top 32.3. Page 1 banner: lw=4.56 at 105.6 +
  lw=18 at 116.9 (36→252.2), title top 111.5, black text.
- Sections carry a right-edge vertical border (lw=1.44, banner color) from
  banner to section bottom at x=594; total band lw=18 in section color.

## Page 1

- Logo image box (36,17.3)-(178.1,53.3), contain-fit; sender line Arial 8
  at (36,62.6).
- Addressee Helvetica 9 at x=39.1, tops 145.8 + n·10.55; sequence number
  (Helvetica 5) at (205.2,146.2).
- USPS IMb barcode: 65 bars from x=41.0, pitch 3.118, bar width 1.44,
  band top 196.4 height 10.5 (T=middle third, A=top⅔, D=bottom⅔, F=full).
- Right info block: "Page 1 of 4" Arial 7 at (340.6,148.1); "THIS IS NOT A
  BILL" Arial-BoldItalic 9 red at (427,147); 0.72 rules 340.6→594.2 at y=
  158.4/169.9/181.4/193.0; labels Arial 8 at x=340.6 tops 160.5/172/183.5
  (StatementPeriod, MerchantNumber, CustomerService); values at x=427:
  period Arial 10 top 159.6 ("07/01/26 - 07/31/26"), others Helvetica 9
  tops 171.5/183.
- Location: label Arial 8 (344.9,218.6); Helvetica 9 lines x=358.6 tops
  227.9 + n·10.55.
- SUMMARY box (x 212.4→594.2): band 4.56 at y=315.4; left vertical 2.16
  gray x=212.4 (313.2→440.4); title band 21.6 at y=328.6 (212.4→281);
  white title top 322.9; gray subtitle Arial-Bold 8 at (284.4,324.9).
  Four color bands lw=14.4 at y=350.2/368.2/386.2/404.2; each row: "Page
  n" Arial 7 at 216 top y−3.2; label Arial-Bold 12 top y−5.4; value Arial
  11 right→586.4 top y−5.1. Total row: black 1.44 rule at y=411.4
  (450→594.2); label Arial-Bold 12 at 216 top 420.1; value Arial-Bold 14
  right→589.9 top 419. Bottom 0.72 rule at 440.2 (212.4→594.2). Formula
  note gray Arial 8 at (216,446.6).
- IMPORTANT INFORMATION ABOUT YOUR ACCOUNT: red band lw=22.56 at y=480.2
  (36→309.8) with red 2.16 outline (top 469, bottom 491.5, left x=36
  468→492.7, right x=309.6 468→491.8); white small-caps title at 39.6 top
  474.6. Gray 2.16 box lines: top y=469 (310.3→594.2), left x=36
  (492→528.2), bottom y=528 (36→594.2), right x=594 (469→528.2). Body
  text (Arial 8) drawn inside 40→590, from y≈497.
- SUMMARY BY CARD TYPE: banner 4.56 at 541 + 18 at 552.2 (36→205.4),
  white Helvetica-Bold title top 546.4; gray formula at (223.2,548.8).
  Table x edges: 36, 126, 205.2, 266.4, 345.6, 406.8, 486, 594 (verticals
  0.72 gray; x=205.2 starts at 543.4, x=126/345.6/486 at 561.4,
  x=266.4/406.8 at 575.8; all run to 666). Green header bands 486→594.2:
  lw=14.4 at 568.6 and lw=21.6 at 586.6; green row bands lw=10.08 at
  602.4+n·10.07. Group heads Helvetica-Bold 7 (centered): "Total Gross
  Sales You Submitted" (220.1,564.9), "Refunds" (401.8,564.9), "Total
  Amount You Submitted" (492.5,564.9). Column heads top 582.9: Card Type
  (63.8), Average/Ticket (151.9 top 578.8 / 155.5 top 587.2), Items right
  264.3, Amount right 343.7, Items right 404.7, Amount right 484.1,
  Amount right 589.2. Rules: 0.72 at 561.4 & 597.4; 0.24 between rows at
  607.4+n·10.07. Rows Helvetica 7 top 598.7+n·10.07: name left 39.6, avg
  ticket right 203.4, items right 264.3, amount right 343.9, refund items
  right 404.7, refund amount right 484.0, total right 589.4. Total band
  lw=18 gray-12 at 656.6; bold total row top 653.2; bottom 1.44 rule at
  665.8.

## Page 2

- Header: page-top banner; left info at x=39.6 labels / 138.2 values,
  tops 57.5 & 71.9, 0.72 rules 39.6→293.3 at 68.4 & 82.8; right "Page n
  of N" at (360.2,57.5), StatementPeriod at (360.2,71.9) value right→
  591.6, rules 360.2→590.9.
- AMOUNTS FUNDED BY BATCH: banner 4.56 at 99.4 + 18 at 110.6 (36→207.4);
  gray formula at (210.7,107.2). Column bands x: green 173.3→256.3, pink
  257.3→340.3, purple 341.3→424.3, blue 425.3→508.3; header band lw=28.8
  at y=134.2; per-row lw=10.08 at 153.6+n·10.07; total lw=18 at 480 (the
  total band y = last row band + 13.9). Two-line header Helvetica-Bold 7
  tops 130.5/138.9: Date/Submitted left 39.6, Batch/Number left ~116.9,
  Submitted/Amount right 231.7/228, Third Party/Transactions right
  317.3/320.5, Adjustments//Chargebacks right 405.1/404.7, Fees/Charged
  right 474.6/480.8, Funded/Amount right 589.3/589.7. Rows Helvetica 7
  top 149.9+n·10.07: date left 39.6, batch left 109, submitted right
  254.3, third party right 338.1, adjustments right 422.1, fees right
  506.1, funded right 589.9. "Month End Charge" label left 101.0 on its
  own row (carries the fee total in fees+funded, 0.00/blank elsewhere).
  Bold total row text top = band y − 3.4.
- AMOUNTS SUBMITTED: dark-green band lw=18 at 513.4 (36→162.2), white
  Arial-Bold title top 508; right border x=594.7 (499.9→597.1). Header
  Arial-Bold 7 two lines tops 533.5/541.9: Date/Submitted left 39.6; one
  right-aligned column per card type ending at 589.6, evenly spaced
  (sample right edges: 204.6, 281.7, 359.3, 436.1, 512.8); Total/
  Submitted right 589.6. 0.72 rules at 522.5 (above), 551.3, 560.9,
  578.9. Data row (period end date) Arial 7 top 552.9; Sub-Total bold top
  566.6; green Total band lw=18 at 587.8 full width, bold Total row top
  584.6 (value right 590.1).
- THIRD PARTY TRANSACTIONS: orange band lw=18 at 621.1 (36→198.2); right
  border x=594 (607.7→688.1). Header bold 7 top 642.5 (Date 39.6,
  Description 99.4, Amount right 589.2); 0.72 rules at 651.8 & 669.8;
  empty message Arial 7 centered top 657.6 ("There are no Third Party
  Transactions for this statement period."); orange total band lw=18 at
  678.7, bold Total top 675.6 (0.00 right 589.1).

## Page 3

- ADJUSTMENTS/CHARGEBACKS: purple-dark banner 4.56 at 99.4 + 18 at 110.6
  (36→207.6); right border x=594 (97.2→177.6); header top 132; 0.72 rule
  at 141.4; message top 147.1; purple band lw=18 at 168.2; Total top
  165.1. Same column layout as Third Party.
- FEES CHARGED: blue banner 4.56 at 190.3 + 18 at 201.6 (36→133.4); right
  border x=594 from 188.2 to the section bottom. Header Arial-Bold 7 top
  223 (Date 39.6, Type 101.5, Description 133.2, Volume right 457.3, Rate
  right 514.8, Total right 588.9); 0.72 rule 9.4 below header top. Rows
  Arial 7, pitch 9.6: group headers (card names, "AUTHS & AVS") at x=
  133.2; data rows: date 39.6, type left ~101.3 (centered under Type),
  description 144, volume right 457.5, rate right 515.1 (5dp, 4dp for
  0.1000), total right 589.1 (−$x.xx). 0.24 rules between rows. Splits to
  the next page with banner+header repeated. After CF rows: bold "Total
  Card Fees" (desc col) + total right 589.3, then MISC rows, "Total
  Miscellaneous Fees", then blue band lw=18 with bold Arial 8 "Total
  (Misc Fees and Card Fees)" at 39.6 / total right 590, text top =
  band−3.4. Legend follows: "Fee Type Legend" bold 8, then "MISC =
  Miscellaneous Fees", "CF = Card Fees" Arial 8, 9.3 pitch.

## Page 4 (tail)

- TAX GROSS REPORTABLE SALES BY TIN: gray banner 4.56 at yT + lw=21.6 at
  yT+13.2 (36→261.4), white Helvetica-Bold title; fine print Helvetica 6
  3 lines at x=268.3 tops yT+3.4/10.3/17.3; header Arial-Bold 8 top
  yT+30.2 (Month 39.6, Description 126, Total right 589.1); 0.72 rules at
  yT+42/56.4; data row Arial 8 top yT+45.5 (month JUL at 39.6, "Gross
  Reportable Sales - TIN XXXXX0360" at 126, amount right 590.1); gray-12
  band lw=18 at yT+65.3 with bold YTD row top yT+61.9; bottom 1.44 rule
  at yT+74.4. (Sample: yT=352.3.)

## Print-house artifacts (reproduced)

- Sheet-side marks: odd pages carry a rotated control line (Helvetica ~3.6)
  down the left edge at x≈10.8 (codes, PAGE nnnnn OF nnnnn, statement
  sequence); even pages carry an OMR mark column at (13.2,504)-(21.6,670.6)
  (drawn as short bars) and tiny "0-0" at (16.6,457.2).
- Addressee IMb barcode and sequence numbers derive from the statement
  sequence field.

## Derived figures

- Card type rows: avg ticket = amount/items; totals row sums.
- Amounts Submitted (summary + tables) = card type total.
- Fees: CF rows grouped (group header when the group label changes), then
  Total Card Fees, MISC rows, Total Miscellaneous Fees, grand total =
  cards+misc, shown negative. Row total derives from −(volume×rate) when
  both present (override allowed).
- Batch table: submitted from the shared batch rows; Month End Charge row
  carries the grand fee total; Funded = Submitted + Fees per row; totals
  down each column. Total Amount Funded = submitted − thirdParty +
  adjustments + fees.
- Tax section: month from the period, amount = amounts submitted, YTD and
  TIN label are fields.
