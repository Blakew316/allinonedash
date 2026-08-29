/*
 * Card processing statement PDF engine ("template 2").
 *
 * Reproduces the 4-page "YOUR CARD PROCESSING STATEMENT" reference
 * measured in docs/template2-spec.md: CMYK banded sections, faux
 * small-caps banners, batch funding table with colored columns,
 * per-card-type summaries, grouped fee schedule and tax section,
 * including the print-house artifacts (IMb barcode, OMR marks,
 * control codes).
 *
 * Coordinates are top-left origin; bands are stroked lines that cover
 * y ± width/2, exactly like the reference generator drew them.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StatementPDF2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAGE_W = 612;
  var PAGE_H = 792;
  var LEFT = 36;
  var RIGHT = 594.2;
  var BOTTOM_LIMIT = 712;

  // CMYK palette
  var GRAY25 = [0, 0, 0, 0.251];
  var GRAY12 = [0, 0, 0, 0.122];
  var RED = [0, 1, 1, 0];
  var GREEN = [0.149, 0, 0.149, 0];
  var PINK = [0, 0.102, 0.102, 0];
  var PURPLE = [0.122, 0.149, 0, 0];
  var BLUE = [0.502, 0.251, 0, 0];
  var DARKGREEN = [0.502, 0, 0.502, 0.502];
  var ORANGE = [0, 0.42, 0.702, 0];
  var PURPLEDARK = [0.4, 0.502, 0, 0];
  var BLACK = [0, 0, 0, 1];
  var WHITE = [0, 0, 0, 0];

  var MONTHS3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  function round2(n) {
    var v = Number(n) || 0;
    var sign = v < 0 ? -1 : 1;
    return sign * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
  }

  function toNum(v) {
    if (v === null || v === undefined) return 0;
    var s = String(v).trim();
    var n = Number(s.replace(/[$,()%\s]/g, ''));
    if (!isFinite(n)) return 0;
    if (/^\(.*\)$/.test(s)) n = -n;
    return n;
  }

  function hasValue(v) {
    return v !== null && v !== undefined && String(v).trim() !== '';
  }

  // Make any string safe to draw with the PDF fonts. Imported statements can
  // carry glyphs a font cannot encode — most often an apostrophe/quote that the
  // source PDF stored in the Unicode Private Use Area (e.g. "DAVES"),
  // which would otherwise throw "WinAnsi cannot encode ..." and abort the whole
  // render. Normalise common typographic characters to ASCII and drop anything
  // still outside the Latin-1 range the fonts support, so a render never fails.
  function sanitizeText(str) {
    return String(str == null ? '' : str)
      .replace(/[\u2018\u2019\u201A\u201B\u2032\uFF07]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      .replace(/[\u0080-\u009F\uE000-\uF8FF]/g, '')
      .replace(/[^\t\n\r\u0020-\u00FF]/g, '');
  }

  function money(n) {
    var v = round2(Math.abs(Number(n) || 0));
    var parts = v.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // "$1,812.10" / "-$1,563.91"
  function usd(n) {
    var v = round2(n);
    return (v < 0 ? '-$' : '$') + money(v);
  }

  // "0.00" style (no $), used for zero-ish cells
  function plain(n) { return money(n); }

  // Third-party / adjustment / chargeback value: a bare "0.00" when it is
  // exactly zero (as the reference statements print it), otherwise the signed
  // "-$71.18" form. Rendering the sign keeps a negative chargeback negative and
  // lets the importer read it back with its sign intact on re-import.
  function sval(n) { return round2(n) === 0 ? plain(n) : usd(n); }

  // "2026-07-01" -> "07/01/26"
  function shortDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return String(iso || '');
    return m[2] + '/' + m[3] + '/' + m[1].slice(2);
  }

  /* ------------------------------------------------------------------ *
   * Derived figures (shared with the UI)
   * ------------------------------------------------------------------ */

  function resolveFeeTotal(row) {
    if (hasValue(row.total)) return round2(toNum(row.total));
    var volume = hasValue(row.volume) ? toNum(row.volume) : null;
    var rate = hasValue(row.rate) ? toNum(row.rate) : null;
    if (volume !== null && rate !== null && rate !== 0) {
      return -round2(Math.abs(volume * rate));
    }
    return null;
  }

  function computeTotals(data) {
    var cardTypes = (data.cardTypes || []).filter(function (c) {
      return hasValue(c.name);
    }).map(function (c) {
      var items = Math.round(toNum(c.items));
      var amount = round2(toNum(c.amount));
      var refundItems = Math.round(toNum(c.refundItems));
      var refundAmount = round2(toNum(c.refundAmount));
      return {
        name: c.name,
        items: items,
        amount: amount,
        refundItems: refundItems,
        refundAmount: refundAmount,
        avgTicket: items > 0 ? round2(amount / items) : 0,
        net: round2(amount - refundAmount)
      };
    });
    var cardTotal = {
      items: cardTypes.reduce(function (s, c) { return s + c.items; }, 0),
      amount: round2(cardTypes.reduce(function (s, c) { return s + c.amount; }, 0)),
      refundItems: cardTypes.reduce(function (s, c) { return s + c.refundItems; }, 0),
      refundAmount: round2(cardTypes.reduce(function (s, c) { return s + c.refundAmount; }, 0))
    };
    cardTotal.net = round2(cardTotal.amount - cardTotal.refundAmount);

    var fees = (data.fees || []).filter(function (f) {
      return hasValue(f.description);
    }).map(function (f) {
      return {
        group: f.group || '',
        type: (f.type || 'CF').toUpperCase() === 'MISC' ? 'MISC' : 'CF',
        description: f.description,
        volume: f.volume,
        rate: f.rate,
        total: resolveFeeTotal(f) || 0,
        totalResolved: resolveFeeTotal(f)
      };
    });
    var cardFees = fees.filter(function (f) { return f.type === 'CF'; });
    var miscFees = fees.filter(function (f) { return f.type === 'MISC'; });
    var cardFeesTotal = round2(cardFees.reduce(function (s, f) { return s + f.total; }, 0));
    var miscFeesTotal = round2(miscFees.reduce(function (s, f) { return s + f.total; }, 0));
    var feesTotal = round2(cardFeesTotal + miscFeesTotal);

    function simpleRows(rows) {
      return (rows || []).filter(function (r) {
        return hasValue(r.description) || hasValue(r.amount);
      }).map(function (r) {
        return { date: r.date, description: r.description, amount: round2(toNum(r.amount)) };
      });
    }
    var thirdParty = simpleRows(data.thirdParty);
    var adjustments = simpleRows(data.adjustments);
    var thirdPartyTotal = round2(thirdParty.reduce(function (s, r) { return s + r.amount; }, 0));
    var adjustmentsTotal = round2(adjustments.reduce(function (s, r) { return s + r.amount; }, 0));

    var batches = (data.batches || []).filter(function (b) {
      return hasValue(b.date) || hasValue(b.number);
    }).map(function (b) {
      var submitted = round2(toNum(b.salesAmount) - toNum(b.refundAmount));
      return { date: b.date, number: b.number, submitted: submitted };
    });
    var batchTotal = round2(batches.reduce(function (s, b) { return s + b.submitted; }, 0));

    var amountsSubmitted = cardTotal.net;
    var fundedTotal = round2(amountsSubmitted - thirdPartyTotal + adjustmentsTotal + feesTotal);

    return {
      cardTypes: cardTypes,
      cardTotal: cardTotal,
      cardFees: cardFees,
      miscFees: miscFees,
      cardFeesTotal: cardFeesTotal,
      miscFeesTotal: miscFeesTotal,
      feesTotal: feesTotal,
      thirdParty: thirdParty,
      adjustments: adjustments,
      thirdPartyTotal: thirdPartyTotal,
      adjustmentsTotal: adjustmentsTotal,
      batches: batches,
      batchTotal: batchTotal,
      amountsSubmitted: amountsSubmitted,
      fundedTotal: fundedTotal
    };
  }

  /* ------------------------------------------------------------------ *
   * Generation
   * ------------------------------------------------------------------ */

  function generate(data, env) {
    var PDFLib = env.pdfLib;
    var doc;
    var fonts = {};   // arial, arialBold, arialBoldItalic (embedded), helv, helvBold (standard)
    var logoImage = null;

    return PDFLib.PDFDocument.create().then(function (d) {
      doc = d;
      doc.registerFontkit(env.fontkit);
      return Promise.all([
        doc.embedFont(env.fonts.sans, { subset: true }),
        doc.embedFont(env.fonts.sansBold, { subset: true }),
        doc.embedFont(env.fonts.sansBoldItalic, { subset: true }),
        doc.embedFont(PDFLib.StandardFonts.Helvetica),
        doc.embedFont(PDFLib.StandardFonts.HelveticaBold),
        env.logo
          ? (env.logo.mime === 'image/jpeg'
            ? doc.embedJpg(env.logo.bytes)
            : doc.embedPng(env.logo.bytes))
          : Promise.resolve(null)
      ]);
    }).then(function (loaded) {
      fonts.arial = loaded[0];
      fonts.arialBold = loaded[1];
      fonts.arialBoldItalic = loaded[2];
      fonts.helv = loaded[3];
      fonts.helvBold = loaded[4];
      logoImage = loaded[5];

      var totals = computeTotals(data);
      var cmyk = PDFLib.cmyk;
      var degrees = PDFLib.degrees;

      var pages = [];
      var page = null;
      var cursor = 0;

      function color(c) { return cmyk(c[0], c[1], c[2], c[3]); }

      // Descent ratios so glyph-box tops land like the reference's.
      function descentRatio(font) {
        var fk = font.embedder && font.embedder.font;
        if (fk && fk.descent && fk.unitsPerEm) return fk.descent / fk.unitsPerEm;
        return -0.207; // standard Helvetica AFM descender
      }

      function baselineY(top, font, size) {
        return PAGE_H - top - size * (1 + descentRatio(font));
      }

      function widthOf(str, font, size) {
        return font.widthOfTextAtSize(sanitizeText(str), size); // unkerned, like the reference
      }

      // Word gap used by the reference composer for its embedded (Arial)
      // text: ~0.235em instead of the font's space glyph.
      var ARIAL_SPACE_EM = 0.235;

      // The reference composer draws unkerned text, so plain drawText (which
      // advances by raw glyph widths) reproduces it exactly.
      function drawRun(str, x, y, font, size, col) {
        page.drawText(sanitizeText(str), { x: x, y: y, size: size, font: font, color: color(col || BLACK) });
      }

      function isEmbedded(font) {
        return !!(font.embedder && font.embedder.font && font.embedder.font.layout);
      }

      // Draw with the font's real space glyphs (sender/footer lines).
      function textRaw(str, x, top, font, size, col) {
        drawRun(String(str), x, baselineY(top, font, size), font, size, col);
      }

      // Merchant numbers display grouped 4-4-remainder.
      function groupedNumber(v) {
        var s = String(v || '').replace(/\s+/g, '');
        if (s.length > 8) return s.slice(0, 4) + ' ' + s.slice(4, 8) + ' ' + s.slice(8);
        return s;
      }

      function text(str, x, top, font, size, col) {
        str = String(str);
        if (!str) return;
        var y = baselineY(top, font, size);
        if (isEmbedded(font) && str.indexOf(' ') >= 0) {
          // draw word-by-word with the composer's narrow gap
          var cx = x;
          str.split(' ').forEach(function (word, i) {
            if (i > 0) cx += ARIAL_SPACE_EM * size;
            if (word) {
              drawRun(word, cx, y, font, size, col);
              cx += widthOf(word, font, size);
            }
          });
          return;
        }
        drawRun(str, x, y, font, size, col);
      }

      // Words spread between fixed extents (the composer justifies its
      // annotation strings to set widths).
      function textJust(str, x0, x1, top, font, size, col) {
        var words = String(str).split(/\s+/).filter(Boolean);
        var lettersW = words.reduce(function (s, w) { return s + widthOf(w, font, size); }, 0);
        var gap = words.length > 1 ? (x1 - x0 - lettersW) / (words.length - 1) : 0;
        var y = baselineY(top, font, size);
        var cx = x0;
        words.forEach(function (w) {
          drawRun(w, cx, y, font, size, col);
          cx += widthOf(w, font, size) + gap;
        });
      }

      // Width including the composer's narrow word gaps for embedded fonts.
      function textWidth(str, font, size) {
        str = String(str);
        if (isEmbedded(font) && str.indexOf(' ') >= 0) {
          var w = 0;
          var words = str.split(' ');
          words.forEach(function (word, i) {
            if (i > 0) w += ARIAL_SPACE_EM * size;
            if (word) w += widthOf(word, font, size);
          });
          return w;
        }
        return widthOf(str, font, size);
      }

      function right(str, rightEdge, top, font, size, col) {
        text(str, rightEdge - textWidth(str, font, size), top, font, size, col);
      }

      function center(str, cx, top, font, size, col) {
        text(str, cx - textWidth(str, font, size) / 2, top, font, size, col);
      }

      // A "band": stroked horizontal line at path-y covering y ± w/2.
      function band(x0, x1, yPath, thickness, col) {
        page.drawLine({
          start: { x: x0, y: PAGE_H - yPath },
          end: { x: x1, y: PAGE_H - yPath },
          thickness: thickness,
          color: color(col)
        });
      }

      function vline(x, top0, top1, thickness, col) {
        page.drawLine({
          start: { x: x, y: PAGE_H - top0 },
          end: { x: x, y: PAGE_H - top1 },
          thickness: thickness,
          color: color(col)
        });
      }

      // Faux small-caps: first letter of each word 12pt, rest 10pt.
      function smallCaps(str, x, top, font, col, s1, s2) {
        s1 = s1 || 12;
        s2 = s2 || 10;
        var cx = x;
        String(str).toUpperCase().split(/\s+/).forEach(function (word, wi) {
          if (!word) return;
          if (wi > 0) cx += 3.2;
          // a capital after "/" is also drawn large (ADJUSTMENTS/CHARGEBACKS)
          (word.match(/[^/]*\/|[^/]+/g) || [word]).forEach(function (part) {
            text(part[0], cx, top, font, s1, col);
            cx += widthOf(part[0], font, s1) - 0.1;
            if (part.length > 1) {
              text(part.slice(1), cx, top + 1.6, font, s2, col);
              cx += widthOf(part.slice(1), font, s2);
            }
          });
        });
        return cx;
      }

      /* ------------------------- page furniture ------------------------- */

      var seq = String(data.statementSeq || '487845').replace(/\D/g, '') || '487845';
      var processorLine = data.processorLine || '';
      var periodLabel = shortDate(data.periodStart) + ' - ' + shortDate(data.periodEnd);

      function cornerMarks() {
        band(36, 45.1, 787.55, 0.72, BLACK);
        band(570, 579.1, 787.55, 0.72, BLACK);
        vline(0.7, 535.4, 544.8, 0.72, BLACK);
        band(598.6, 607.7, 540, 0.72, BLACK);
      }

      function footer() {
        band(LEFT, RIGHT, 726.5, 2.88, GRAY25);
        textRaw(processorLine, 36, 734.6, fonts.arial, 7);
      }

      // Rotated print-control column on odd pages.
      function controlColumn(sheetNo, sheetCount) {
        var frags = [
          [162.0, 'COLR637F'], [193.7, '1101'], [211.0, '8888'], [228.2, '124'],
          [250.6, '07'], [260.6, '260802'], [285.1, 'PAGE'],
          [302.4, String(sheetNo).padStart(5, '0')], [323.3, 'OF'],
          [333.4, String(sheetCount).padStart(5, '0')],
          [377.3, ('00' + seq).slice(-8)]
        ];
        frags.forEach(function (f) {
          page.drawText(f[1], {
            x: 15.5,
            y: PAGE_H - f[0],
            size: 3.6,
            font: fonts.helv,
            color: color(BLACK),
            rotate: degrees(-90)
          });
        });
      }

      // OMR mark column on even pages.
      function omrColumn() {
        for (var i = 0; i < 16; i++) {
          page.drawRectangle({
            x: 13.2,
            y: PAGE_H - (504 + i * 10.4) - 2.2,
            width: 8.4,
            height: 2.2,
            color: color(BLACK)
          });
        }
        page.drawText('0-0', {
          x: 21.4,
          y: PAGE_H - 457.2,
          size: 3.6,
          font: fonts.helv,
          color: color(BLACK),
          rotate: degrees(-90)
        });
      }

      // Header band on pages 2+ (page number backfilled later).
      var headerRows = [];
      function continuationHeader() {
        band(LEFT, RIGHT, 25.2, 7.2, GRAY25);
        band(LEFT, 252.7, 37.7, 18, GRAY25);
        smallCaps('Your Card Processing Statement', 39.6, 32.3, fonts.arialBold, BLACK);
        text('Merchant Number', 39.6, 57.5, fonts.arial, 8);
        text(groupedNumber(data.merchantNumber), 138.2, 57.5, fonts.arial, 8);
        text('Page', 360.2, 57.5, fonts.arial, 8);
        text('Customer Service', 39.6, 71.9, fonts.arial, 8);
        text(data.customerService || '', 138.2, 71.9, fonts.arial, 8);
        band(39.6, 293.3, 68.4, 0.72, BLACK);
        band(39.6, 293.3, 82.8, 0.72, BLACK);
        text('Statement Period', 360.2, 71.9, fonts.arial, 8);
        right(periodLabel, 591.6, 71.9, fonts.arial, 8);
        band(360.2, 590.9, 68.4, 0.72, BLACK);
        band(360.2, 590.9, 82.8, 0.72, BLACK);
        headerRows.push({ page: page, pageIndex: pages.length - 1 });
        cursor = 99.4;
      }

      function addPage(first) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        pages.push(page);
        cornerMarks();
        footer();
        if (!first) continuationHeader();
      }

      /* ----------------------------- page 1 ----------------------------- */

      addPage(true);
      var summaryPageRefs = { submitted: 2, thirdParty: 2, adjustments: 3, fees: 3 };

      if (logoImage) {
        var boxW = 142.1, boxH = 36;
        var scale = Math.min(boxW / logoImage.width, boxH / logoImage.height);
        page.drawImage(logoImage, {
          x: 36,
          y: PAGE_H - 17.3 - boxH + (boxH - logoImage.height * scale) / 2,
          width: logoImage.width * scale,
          height: logoImage.height * scale
        });
      }
      text(processorLine, 36, 62.6, fonts.arial, 8);

      band(LEFT, 252.2, 105.6, 4.56, GRAY25);
      band(252.0, RIGHT, 105.6, 4.56, GRAY25);
      band(LEFT, 252.2, 116.9, 18, GRAY25);
      smallCaps('Your Card Processing Statement', 39.6, 111.5, fonts.arialBold, BLACK);

      // addressee + sequence + IMb barcode
      (data.addressee || []).slice(0, 5).forEach(function (line, i) {
        text(String(line).toUpperCase(), 39.1, 145.8 + i * 10.55, fonts.helv, 9);
      });
      // The sequence sits to the right of the business name; start it past the
      // end of a long name (capped before the summary box) so the two never
      // overprint each other.
      var addr0 = String((data.addressee || [])[0] || '').toUpperCase();
      var seqX = Math.min(332, Math.max(205.2, 39.1 + textWidth(addr0, fonts.helv, 9) + 8));
      text(seq, seqX, 146.2, fonts.helv, 5);

      // Intelligent Mail barcode: 65 bars derived from the sequence.
      (function imb() {
        var kinds = 'TADF';
        var top = 196.4, full = 10.5;
        var x = 41.0;
        var state = 0;
        for (var i = 0; i < 65; i++) {
          state = (state * 31 + seq.charCodeAt(i % seq.length) + i * 7) % 97;
          var kind = kinds[state % 4];
          var y0 = top, h = full;
          if (kind === 'T') { y0 = top + 3.5; h = 3.5; }
          else if (kind === 'A') { y0 = top; h = 7; }
          else if (kind === 'D') { y0 = top + 3.5; h = 7; }
          page.drawRectangle({
            x: x, y: PAGE_H - y0 - h, width: 1.44, height: h, color: color(BLACK)
          });
          x += 3.118;
        }
      })();

      // right info block
      text('Page', 340.6, 148.1, fonts.arial, 7);
      // "1 of N" backfilled with page count later (recorded via headerRows-like list)
      var page1Ref = { page: page };
      textJust('THIS IS NOT A BILL', 427.0, 512.0, 147.0, fonts.arialBoldItalic, 9, RED);
      [158.4, 169.9, 181.4, 193.0].forEach(function (y) {
        band(340.6, RIGHT, y, 0.72, BLACK);
      });
      text('Statement Period', 340.6, 160.5, fonts.arial, 8);
      text(periodLabel, 427.0, 159.6, fonts.arial, 10);
      text('Merchant Number', 340.6, 172.0, fonts.arial, 8);
      textRaw(groupedNumber(data.merchantNumber), 427.0, 171.5, fonts.helv, 9);
      text('Customer Service', 340.6, 183.5, fonts.arial, 8);
      text(data.customerService || '', 427.0, 183.0, fonts.helv, 9);

      text('Location:', 344.9, 218.6, fonts.arial, 8);
      (data.location || []).slice(0, 4).forEach(function (line, i) {
        text(String(line).toUpperCase(), 358.6, 227.9 + i * 10.55, fonts.helv, 9);
      });

      // SUMMARY box (page-number cells drawn later, after layout)
      band(212.4, RIGHT, 315.4, 4.56, GRAY25);
      // left vertical drawn in the reference's segments
      [[313.2, 318.0], [317.8, 339.6], [339.4, 343.2], [343.0, 357.6],
       [357.4, 361.2], [361.0, 375.6], [375.4, 379.2], [379.0, 393.6],
       [393.4, 397.2], [397.0, 411.6], [411.4, 440.4]].forEach(function (seg) {
        vline(212.4, seg[0], seg[1], 2.16, GRAY25);
      });
      band(212.4, 281.0, 328.6, 21.6, GRAY25);
      smallCaps('Summary', 216.0, 322.9, fonts.arialBold, WHITE);
      textJust('An overview of account activity for the statement period.', 284.4, 496.6, 324.9, fonts.arialBold, 8, GRAY25);

      var summaryRows = [
        { y: 350.2, col: GREEN, label: 'Amounts Submitted', value: usd(totals.amountsSubmitted), ref: 'submitted' },
        { y: 368.2, col: PINK, label: 'Third Party Transactions', value: sval(totals.thirdPartyTotal), ref: 'thirdParty' },
        { y: 386.2, col: PURPLE, label: 'Adjustments/Chargebacks', value: sval(totals.adjustmentsTotal), ref: 'adjustments' },
        { y: 404.2, col: BLUE, label: 'Fees Charged', value: usd(totals.feesTotal), ref: 'fees' }
      ];
      summaryRows.forEach(function (row) {
        band(212.4, RIGHT, row.y, 14.4, row.col);
        text(row.label, 284.4, row.y - 5.4, fonts.arialBold, 12);
        right(row.value, 586.4, row.y - 5.1, fonts.arial, 11);
        text('Page', 216.0, row.y - 3.2, fonts.arial, 7);
      });
      band(450, RIGHT, 411.4, 1.44, BLACK);
      text('Total Amount Funded to Your Bank', 216.0, 420.1, fonts.arialBold, 12);
      right(usd(totals.fundedTotal), 589.9, 419.0, fonts.arialBold, 14);
      band(212.4, RIGHT, 440.2, 0.72, BLACK);
      textJust('(Amount Submitted - Third Party) + Adjustments + Chargebacks + Fees Charged = Amount Funded',
        216.0, 558.5, 446.6, fonts.arial, 8, GRAY25);

      // IMPORTANT INFORMATION box
      band(36, 309.8, 480.2, 22.56, RED);
      band(36, 309.8, 469.0, 2.16, RED);
      vline(309.6, 468.0, 491.8, 2.16, RED);
      band(36, 310.8, 491.5, 2.16, RED);
      vline(36, 468.0, 492.7, 2.16, RED);
      smallCaps('Important Information About Your Account', 39.6, 474.6, fonts.arialBold, WHITE);
      band(310.3, RIGHT, 469.0, 2.16, GRAY25);
      band(35.0, 37.2, 491.8, 0.72, GRAY25);
      vline(36, 492.0, 528.2, 2.16, GRAY25);
      band(36, RIGHT, 528.0, 2.16, GRAY25);
      band(36, RIGHT, 528.0, 2.16, GRAY25);
      vline(594, 469.0, 528.2, 2.16, GRAY25);
      // free-form info text inside the box
      (function importantInfo() {
        var info = String(data.importantInfo || '').trim();
        if (!info) return;
        var lines = [];
        info.split(/\n/).forEach(function (para) {
          var words = para.split(/\s+/).filter(Boolean);
          var line = '';
          words.forEach(function (w) {
            var cand = line ? line + ' ' + w : w;
            if (line && widthOf(cand, fonts.arial, 8) > 550) {
              lines.push(line);
              line = w;
            } else line = cand;
          });
          lines.push(line);
        });
        lines.slice(0, 3).forEach(function (line, i) {
          text(line, 40, 497.5 + i * 9.6, fonts.arial, 8);
        });
      })();

      // SUMMARY BY CARD TYPE
      band(LEFT, RIGHT, 541.0, 4.56, GRAY25);
      band(LEFT, 205.4, 552.2, 18, GRAY25);
      smallCaps('Summary By Card Type', 39.6, 546.4, fonts.helvBold, WHITE);
      textJust('(Total Sales You Submitted - Refunds = Total Amount You Submitted)', 223.2, 484.3, 548.8, fonts.arialBold, 8, GRAY25);

      var CT = { rows: totals.cardTypes };
      var ctRows = CT.rows.length;
      // green column bands
      band(486, RIGHT, 568.6, 14.4, GREEN);
      band(486, RIGHT, 586.6, 21.6, GREEN);
      for (var cri = 0; cri < ctRows; cri++) {
        band(486, RIGHT, 602.4 + cri * 10.07, 10.08, GREEN);
      }
      // group heads + column heads
      textJust('Total Gross Sales You Submitted', 220.1, 330.4, 564.9, fonts.helvBold, 7);
      center('Refunds', 415.8, 564.9, fonts.helvBold, 7);
      textJust('Total Amount You Submitted', 492.5, 588.9, 564.9, fonts.helvBold, 7);
      center('Card Type', 80.9, 582.9, fonts.helvBold, 7);
      center('Average', 165.7, 578.8, fonts.helvBold, 7);
      center('Ticket', 165.6, 587.2, fonts.helvBold, 7);
      right('Items', 264.3, 582.9, fonts.helvBold, 7);
      right('Amount', 343.7, 582.9, fonts.helvBold, 7);
      right('Items', 404.7, 582.9, fonts.helvBold, 7);
      right('Amount', 484.1, 582.9, fonts.helvBold, 7);
      right('Amount', 589.2, 582.9, fonts.helvBold, 7);
      // rules and verticals
      band(LEFT, RIGHT, 561.4, 0.72, GRAY25);
      band(205.2, RIGHT, 575.8, 0.72, GRAY25);
      band(LEFT, RIGHT, 597.4, 0.72, GRAY25);
      for (var rri = 1; rri <= ctRows; rri++) {
        band(LEFT, RIGHT, 597.4 + rri * 10.07 + 0.05, 0.24, GRAY25);
      }
      var totalBandY = 597.4 + ctRows * 10.07 + 8.85;
      band(LEFT, RIGHT, totalBandY, 18, GRAY12);
      var ctEnd = totalBandY + 9.2;
      band(LEFT, RIGHT, ctEnd, 1.44, GRAY25);
      band(LEFT, RIGHT, ctEnd, 1.44, GRAY25);
      vline(126, 561.4, ctEnd + 0.2, 0.72, GRAY25);
      vline(205.2, 543.4, ctEnd + 0.2, 0.72, GRAY25);
      vline(266.4, 575.8, ctEnd + 0.2, 0.72, GRAY25);
      vline(345.6, 561.4, ctEnd + 0.2, 0.72, GRAY25);
      vline(406.8, 575.8, ctEnd + 0.2, 0.72, GRAY25);
      vline(486, 561.4, ctEnd + 0.2, 0.72, GRAY25);
      vline(594, 538.8, ctEnd + 0.2, 0.72, GRAY25);
      // rows
      CT.rows.forEach(function (c, i) {
        var top = 598.7 + i * 10.07;
        text(c.name, 39.6, top, fonts.helv, 7);
        right('$' + money(c.avgTicket), 203.4, top, fonts.helv, 7);
        right(String(c.items), 264.3, top, fonts.helv, 7);
        right('$' + money(c.amount), 343.9, top, fonts.helv, 7);
        right(String(c.refundItems), 404.7, top, fonts.helv, 7);
        right(plain(c.refundAmount), 484.0, top, fonts.helv, 7);
        right('$' + money(c.net), 589.4, top, fonts.helv, 7);
      });
      var totTop = totalBandY - 3.4;
      text('Total', 39.6, totTop, fonts.helvBold, 7);
      right(String(totals.cardTotal.items), 264.4, totTop, fonts.helvBold, 7);
      right('$' + money(totals.cardTotal.amount), 343.9, totTop, fonts.helvBold, 7);
      right(String(totals.cardTotal.refundItems), 404.7, totTop, fonts.helvBold, 7);
      right(plain(totals.cardTotal.refundAmount), 484.0, totTop, fonts.helvBold, 7);
      right('$' + money(totals.cardTotal.net), 589.4, totTop, fonts.helvBold, 7);

      /* ----------------------------- page 2+ ----------------------------- */

      addPage(false);

      // ---- AMOUNTS FUNDED BY BATCH ----
      summaryPageRefs.submitted = pages.length; // updated below by sections
      var Y = cursor; // 99.4
      band(LEFT, RIGHT, Y, 4.56, GRAY25);
      band(LEFT, 207.4, Y + 11.2, 18, GRAY25);
      smallCaps('Amounts Funded By Batch', 39.6, Y + 5.4, fonts.helvBold, WHITE);
      textJust('(Amount Submitted - Third Party) + Adjustments + Chargebacks + Fees Charged = Amount Funded',
        210.7, 579.2, Y + 7.8, fonts.arialBold, 8, GRAY25);

      var COLS = [
        { x0: 173.3, x1: 256.3, col: GREEN },
        { x0: 257.3, x1: 340.3, col: PINK },
        { x0: 341.3, x1: 424.3, col: PURPLE },
        { x0: 425.3, x1: 508.3, col: BLUE }
      ];
      // Two-line column header band; factored so it can repeat when the batch
      // table spills to a continuation page. bandY is the 28.8 header band top.
      function batchColHeader(bandY) {
        COLS.forEach(function (c) { band(c.x0, c.x1, bandY, 28.8, c.col); });
        var h1 = bandY - 3.7, h2 = bandY + 4.7;
        text('Date', 39.6, h1, fonts.helvBold, 7);
        text('Submitted', 39.6, h2, fonts.helvBold, 7);
        text('Batch', 120.5, h1, fonts.helvBold, 7);
        text('Number', 116.9, h2, fonts.helvBold, 7);
        right('Submitted', 231.7, h1, fonts.helvBold, 7);
        right('Amount', 228.0, h2, fonts.helvBold, 7);
        right('Third Party', 317.3, h1, fonts.helvBold, 7);
        right('Transactions', 320.5, h2, fonts.helvBold, 7);
        right('Adjustments/', 405.1, h1, fonts.helvBold, 7);
        right('Chargebacks', 404.7, h2, fonts.helvBold, 7);
        right('Fees', 474.6, h1, fonts.helvBold, 7);
        right('Charged', 480.8, h2, fonts.helvBold, 7);
        right('Funded', 589.3, h1, fonts.helvBold, 7);
        right('Amount', 589.7, h2, fonts.helvBold, 7);
        band(LEFT, RIGHT, bandY + 14.4, 0.72, GRAY25); // header underline
        return bandY + 15.7; // first row text top
      }

      var batchBorderFrom = Y - 2.2; // top of the section's right border, per page
      var rowTop = batchColHeader(Y + 34.8); // 149.9 on the first page
      function batchRow(dateStr, numberStr, submitted, fees, funded, isMonthEnd) {
        if (rowTop + 10.08 > BOTTOM_LIMIT) {
          vline(594.5, batchBorderFrom, rowTop + 3, 1.44, GRAY25); // close this page's border
          addPage(false);
          rowTop = batchColHeader(cursor + 34.8);
          batchBorderFrom = cursor + 20;
        }
        COLS.forEach(function (c) { band(c.x0, c.x1, rowTop + 3.7, 10.08, c.col); });
        if (isMonthEnd) {
          text('Month End Charge', 101.0, rowTop, fonts.helv, 7);
        } else {
          text(dateStr, 39.6, rowTop, fonts.helv, 7);
          text(numberStr, 109.0, rowTop, fonts.helv, 7);
        }
        right(isMonthEnd ? plain(0) : usd(submitted), 254.3, rowTop, fonts.helv, 7);
        right(plain(0), 338.1, rowTop, fonts.helv, 7);
        right(plain(0), 422.1, rowTop, fonts.helv, 7);
        right(isMonthEnd ? usd(fees) : plain(0), 506.1, rowTop, fonts.helv, 7);
        right(usd(funded), 589.9, rowTop, fonts.helv, 7);
        rowTop += 10.08;
      }
      totals.batches.forEach(function (b) {
        batchRow(shortDate(b.date), String(b.number || ''), b.submitted, 0, b.submitted, false);
      });
      if (totals.feesTotal !== 0 || totals.batches.length) {
        batchRow('', '', 0, totals.feesTotal, totals.feesTotal, true);
      }
      // if the last row sat near the page bottom, move the Total to a fresh page
      if (rowTop - 10.08 + 31 > BOTTOM_LIMIT + 14) {
        vline(594.5, batchBorderFrom, rowTop + 3, 1.44, GRAY25);
        addPage(false);
        rowTop = batchColHeader(cursor + 34.8) + 10.08;
        batchBorderFrom = cursor + 20;
      }
      band(LEFT, RIGHT, rowTop - 10.08 + 8.7, 0.72, GRAY25); // pre-total rule (471.1)
      var batchTotalBandY = rowTop - 10.08 + 3.7 + 13.9;
      COLS.forEach(function (c) { band(c.x0, c.x1, batchTotalBandY, 18, c.col); });
      vline(594.5, batchBorderFrom, batchTotalBandY + 9.2, 1.44, GRAY25); // section right border
      var btTop = batchTotalBandY - 3.4;
      text('Total', 39.6, btTop, fonts.helvBold, 7);
      right(usd(totals.batchTotal), 254.4, btTop, fonts.helvBold, 7);
      right(sval(totals.thirdPartyTotal), 338.1, btTop, fonts.helvBold, 7);
      right(sval(totals.adjustmentsTotal), 422.1, btTop, fonts.helvBold, 7);
      right(usd(totals.feesTotal), 506.3, btTop, fonts.helvBold, 7);
      // Funded total foots its own columns: Submitted − ThirdParty + Adjustments + Fees.
      right(usd(round2(totals.batchTotal - totals.thirdPartyTotal +
        totals.adjustmentsTotal + totals.feesTotal)), 589.9, btTop, fonts.helvBold, 7);
      cursor = batchTotalBandY + 9;

      // ---- AMOUNTS SUBMITTED ----
      if (cursor + 110 > BOTTOM_LIMIT) { addPage(false); }
      summaryPageRefs.submitted = pages.length;
      var S = cursor + 24.7; // thick band path y (513.4 in the sample)
      band(LEFT, RIGHT, S - 11.3, 4.56, DARKGREEN);
      band(LEFT, 162.2, S, 18, DARKGREEN);
      smallCaps('Amounts Submitted', 39.6, S - 5.4, fonts.arialBold, WHITE);
      vline(594.7, S - 13.5, S + 83.7, 1.44, DARKGREEN);
      var sH = S + 20.1;   // header first line top (533.5 in sample; S=513.4)
      band(LEFT, RIGHT, S + 9.1, 0.72, GRAY25);
      text('Date', 39.6, sH, fonts.arialBold, 7);
      text('Submitted', 39.6, sH + 8.4, fonts.arialBold, 7);
      right('Total', 589.6, sH, fonts.arialBold, 7);
      right('Submitted', 589.6, sH + 8.4, fonts.arialBold, 7);
      // one column per card type, right edges evenly distributed
      var colRights = [];
      var nCT = totals.cardTypes.length;
      for (var ci = 0; ci < nCT; ci++) {
        colRights.push(204.6 + (ci * (512.8 - 204.6)) / Math.max(1, (nCT - 1) || 1) * (nCT > 1 ? 1 : 0));
      }
      if (nCT === 1) colRights = [204.6];
      totals.cardTypes.forEach(function (c, i) {
        right(c.name, colRights[i], sH + 8.4, fonts.arialBold, 7);
      });
      band(LEFT, RIGHT, S + 37.9, 0.72, GRAY25);
      var sRow = S + 39.5; // data row top (552.9)
      text(shortDate(data.periodEnd), 39.6, sRow, fonts.arial, 7);
      totals.cardTypes.forEach(function (c, i) {
        right('$' + money(c.net), colRights[i], sRow, fonts.arial, 7);
      });
      right('$' + money(totals.cardTotal.net), 590.1, sRow, fonts.arial, 7);
      band(LEFT, RIGHT, S + 47.5, 0.72, GRAY25);
      var sSub = S + 53.2; // sub-total row top (566.6)
      text('Sub-Total', 39.6, sSub, fonts.arialBold, 7);
      totals.cardTypes.forEach(function (c, i) {
        right('$' + money(c.net), colRights[i], sSub, fonts.arialBold, 7);
      });
      right('$' + money(totals.cardTotal.net), 590.1, sSub, fonts.arialBold, 7);
      band(LEFT, RIGHT, S + 65.5, 0.72, GRAY25);
      band(LEFT, RIGHT, S + 74.4, 18, GREEN);
      text('Total', 39.6, S + 71.2, fonts.arialBold, 7);
      right('$' + money(totals.cardTotal.net), 590.1, S + 71.2, fonts.arialBold, 7);
      cursor = S + 83.4;

      // ---- THIRD PARTY TRANSACTIONS ----
      cursor = simpleSection('Third Party Transactions', ORANGE, PINK, 198.2, totals.thirdParty,
        'There are no Third Party Transactions for this statement period.',
        totals.thirdPartyTotal, cursor, 'thirdParty');

      // ---- ADJUSTMENTS/CHARGEBACKS ----
      cursor = simpleSection('Adjustments/Chargebacks', PURPLEDARK, PURPLE, 207.6, totals.adjustments,
        'There are no Adjustments/Chargebacks for this statement period.',
        totals.adjustmentsTotal, cursor, 'adjustments');

      // Mid-page: thick title band only. Page-top: thin band + thick band
      // (like the reference's ADJUSTMENTS/CHARGEBACKS on page 3).
      function simpleSection(title, col, totalCol, bannerW, rows, emptyMsg, total, fromY, refKey) {
        var height = 105 + Math.max(rows.length, 1) * 9.6;
        var thickY, borderFrom;
        if (fromY + height > BOTTOM_LIMIT) {
          addPage(false);
          thickY = cursor + 11.2;                     // 110.6
          borderFrom = cursor - 2.2;                  // 97.2
        } else {
          thickY = fromY + 24.3;
          borderFrom = thickY - 13.4;
        }
        summaryPageRefs[refKey] = pages.length;
        band(LEFT, RIGHT, thickY - 11.3, 4.56, col);
        band(LEFT, bannerW, thickY, 18, col);
        smallCaps(title, 39.6, thickY - 5.4, fonts.arialBold, WHITE);
        var hTop = thickY + 21.4;
        text('Date', 39.6, hTop, fonts.arialBold, 7);
        text('Description', 99.4, hTop, fonts.arialBold, 7);
        right('Amount', 589.2, hTop, fonts.arialBold, 7);
        band(LEFT, RIGHT, hTop + 9.4, 0.72, GRAY25);
        var rTop = hTop + 15.1;
        if (!rows.length) {
          // the reference spreads the message with ~normal spaces around 315
          var msgW = widthOf(emptyMsg.replace(/ /g, ''), fonts.arial, 7) +
            (emptyMsg.split(' ').length - 1) * 1.98;
          textJust(emptyMsg, 315.1 - msgW / 2, 315.1 + msgW / 2, rTop, fonts.arial, 7);
          rTop += 9.6;
        } else {
          rows.forEach(function (r) {
            // continue onto a new page (repeating banner + header) rather than
            // draw over the footer when a section has many rows
            if (rTop + 9.6 > BOTTOM_LIMIT) {
              vline(594, borderFrom, rTop + 2, 1.44, col);
              addPage(false);
              var ct = cursor + 11.2;
              band(LEFT, RIGHT, ct - 11.3, 4.56, col);
              band(LEFT, bannerW, ct, 18, col);
              smallCaps(title + ' continued', 39.6, ct - 5.4, fonts.arialBold, WHITE);
              var ch = ct + 21.4;
              text('Date', 39.6, ch, fonts.arialBold, 7);
              text('Description', 99.4, ch, fonts.arialBold, 7);
              right('Amount', 589.2, ch, fonts.arialBold, 7);
              band(LEFT, RIGHT, ch + 9.4, 0.72, GRAY25);
              borderFrom = cursor - 2.2;
              rTop = ch + 15.1;
            }
            text(shortDate(r.date), 39.6, rTop, fonts.arial, 7);
            text(String(r.description || ''), 99.4, rTop, fonts.arial, 7);
            right(sval(r.amount), 589.1, rTop, fonts.arial, 7);
            rTop += 9.6;
          });
        }
        band(LEFT, RIGHT, rTop + 2.6, 0.72, GRAY25);
        var tBand = rTop + 11.5;
        band(LEFT, RIGHT, tBand, 18, totalCol);
        text('Total', 39.6, tBand - 3.1, fonts.arialBold, 7);
        right(sval(total), 589.1, tBand - 3.1, fonts.arialBold, 7);
        vline(594, borderFrom, tBand + 9.4, 1.44, col);
        return tBand + 9;
      }

      // ---- FEES CHARGED ----
      var feeSequence = [];
      var lastGroup = null;
      totals.cardFees.forEach(function (f) {
        if (f.group && f.group !== lastGroup) {
          feeSequence.push({ kind: 'group', label: f.group });
          lastGroup = f.group;
        }
        feeSequence.push({ kind: 'row', row: f });
      });
      feeSequence.push({ kind: 'cardTotal' });
      totals.miscFees.forEach(function (f) {
        feeSequence.push({ kind: 'row', row: f });
      });
      feeSequence.push({ kind: 'miscTotal' });

      function feeBannerAndHeader(fromY) {
        var B = fromY;
        band(LEFT, RIGHT, B, 4.56, BLUE);
        band(LEFT, 133.4, B + 11.2, 18, BLUE);
        smallCaps('Fees Charged', 39.6, B + 5.8, fonts.arialBold, WHITE);
        var hTop = B + 32.6;
        text('Date', 39.6, hTop, fonts.arialBold, 7);
        text('Type', 101.5, hTop, fonts.arialBold, 7);
        text('Description', 133.2, hTop, fonts.arialBold, 7);
        right('Volume', 457.3, hTop, fonts.arialBold, 7);
        right('Rate', 514.8, hTop, fonts.arialBold, 7);
        right('Total', 588.9, hTop, fonts.arialBold, 7);
        band(LEFT, RIGHT, hTop + 9.4, 0.72, GRAY25);
        return { rowTop: hTop + 11.0, borderFrom: B - 2.1 };
      }

      var feeDate = shortDate(data.periodEnd);
      var fStart;
      if (cursor + 13.1 + 60 > BOTTOM_LIMIT) {
        addPage(false);
        fStart = cursor; // 99.4
      } else {
        fStart = cursor + 13.1;
      }
      summaryPageRefs.fees = pages.length;
      var fh = feeBannerAndHeader(fStart);
      var fRow = fh.rowTop;
      var borderFrom = fh.borderFrom;

      function feePageBreak() {
        vline(594, borderFrom, 712.6, 1.44, BLUE);
        addPage(false);
        var nf = feeBannerAndHeader(cursor);
        fRow = nf.rowTop;
        borderFrom = nf.borderFrom;
      }

      feeSequence.forEach(function (entry) {
        var isTotal = entry.kind === 'cardTotal' || entry.kind === 'miscTotal';
        if (isTotal) fRow += 0.5; // totals sit 10.1 below the previous row
        if (fRow > 705.5) feePageBreak();
        if (entry.kind === 'group') {
          text(entry.label, 133.2, fRow, fonts.arial, 7);
          band(LEFT, RIGHT, fRow + 8.0, 0.24, GRAY25);
          fRow += 9.6;
        } else if (entry.kind === 'row') {
          var f = entry.row;
          text(feeDate, 39.6, fRow, fonts.arial, 7);
          if (f.type === 'MISC') text('MISC', 101.3, fRow, fonts.arial, 7);
          else text('CF', 105.1, fRow, fonts.arial, 7);
          text(f.description, 144.0, fRow, fonts.arial, 7);
          if (hasValue(f.volume)) right(String(f.volume), 457.5, fRow, fonts.arial, 7);
          if (hasValue(f.rate)) right(String(f.rate), 515.1, fRow, fonts.arial, 7);
          right(usd(f.total), 589.1, fRow, fonts.arial, 7);
          band(LEFT, RIGHT, fRow + 8.0, 0.24, GRAY25);
          fRow += 9.6;
        } else if (entry.kind === 'cardTotal') {
          text('Total Card Fees', 133.2, fRow, fonts.arialBold, 7);
          right(usd(totals.cardFeesTotal), 589.3, fRow, fonts.arialBold, 7);
          band(LEFT, RIGHT, fRow + 8.7, 0.24, GRAY25);
          fRow += 10.3;
        } else if (entry.kind === 'miscTotal') {
          text('Total Miscellaneous Fees', 133.2, fRow, fonts.arialBold, 7);
          right(usd(totals.miscFeesTotal), 589.1, fRow, fonts.arialBold, 7);
          band(LEFT, RIGHT, fRow + 8.7, 0.24, GRAY25);
          fRow += 9.6;
        }
      });
      // grand total band: 17.5 below the misc-total row (which is fRow-9.6)
      if (fRow + 20 > BOTTOM_LIMIT) feePageBreak();
      var gBand = fRow - 9.6 + 17.5;
      band(LEFT, RIGHT, gBand, 18, BLUE);
      text('Total (Misc Fees and Card Fees)', 39.6, gBand - 3.4, fonts.arialBold, 8);
      right(usd(totals.feesTotal), 590.0, gBand - 3.4, fonts.arialBold, 8);
      cursor = gBand + 12.6;

      // legend (the blue right border runs on past it, like the reference)
      if (cursor + 50 > BOTTOM_LIMIT) { vline(594, borderFrom, gBand + 9, 1.44, BLUE); addPage(false); borderFrom = cursor; }
      text('Fee Type Legend', 39.6, cursor + 9.2, fonts.arialBold, 8);
      textJust('MISC = Miscellaneous Fees', 39.6, 136.6, cursor + 22.2, fonts.arial, 8);
      textJust('CF = Card Fees', 39.6, 95.8, cursor + 31.5, fonts.arial, 8);
      cursor += 31.5;
      vline(594, borderFrom, cursor + 8.5, 1.44, BLUE);

      // ---- TAX GROSS REPORTABLE SALES BY TIN ----
      if (cursor + 100 > BOTTOM_LIMIT) addPage(false);
      var T = cursor + 21.2;
      band(LEFT, RIGHT, T, 4.56, GRAY25);
      // right border drawn in the reference's segments
      [[T - 2.1, T + 2.7], [T + 2.4, T + 24.3], [T + 24.0, T + 42.3],
       [T + 42.0, T + 74.7]].forEach(function (seg) {
        vline(594, seg[0], seg[1], 1.44, GRAY25);
      });
      band(LEFT, 261.4, T + 13.2, 21.6, GRAY25);
      smallCaps('Tax Gross Reportable Sales By Tin', 39.6, T + 7.1, fonts.helvBold, WHITE);
      [
        ['Total dollar amount of aggregate reportable payment card transactions funded and third party network', 540.5],
        ['transactions, for each participating payee, without regard to any adjustments for credits, cash equivalents,', 552.5],
        ['discount amount, fees, refunded amounts, or any other amounts per respective tax identification number.', 549.1]
      ].forEach(function (line, i) {
        textJust(line[0], 268.3, line[1], T + 3.4 + i * 6.95, fonts.helv, 6);
      });
      text('Month', 39.6, T + 30.2, fonts.arialBold, 8);
      text('Description', 126.0, T + 30.2, fonts.arialBold, 8);
      right('Total', 589.1, T + 30.2, fonts.arialBold, 8);
      band(LEFT, RIGHT, T + 42.0, 0.72, GRAY25);
      band(LEFT, RIGHT, T + 42.0, 0.72, GRAY25);
      var pm = /^(\d{4})-(\d{2})/.exec(data.periodStart || '');
      var monthWord = pm ? MONTHS3[Number(pm[2]) - 1] : '';
      var year = pm ? pm[1] : '';
      text(monthWord, 39.6, T + 45.5, fonts.arial, 8);
      text('Gross Reportable Sales - TIN ' + (data.tinLabel || ''), 126.0, T + 45.5, fonts.arial, 8);
      right('$' + money(totals.amountsSubmitted), 590.1, T + 45.5, fonts.arial, 8);
      band(LEFT, RIGHT, T + 56.4, 0.72, GRAY25);
      band(LEFT, RIGHT, T + 65.3, 18, GRAY12);
      text(year + ' YTD Gross Reportable Sales', 126.0, T + 61.9, fonts.arialBold, 8);
      right('$' + money(toNum(data.ytdReportable)), 590.2, T + 61.9, fonts.arialBold, 8);
      band(LEFT, RIGHT, T + 74.4, 1.44, GRAY25);

      /* --------------------- backfill page numbers ---------------------- */

      var N = pages.length;
      var sheetCount = Math.ceil(N / 2);

      // page 1 "Page 1 of N" + summary box page refs
      page = pages[0];
      text('1 of ' + N, 358.9, 148.1, fonts.arial, 7);
      var refByRow = ['submitted', 'thirdParty', 'adjustments', 'fees'];
      [347.0, 365.0, 383.0, 401.0].forEach(function (top, i) {
        text(String(summaryPageRefs[refByRow[i]]), 248.4, top, fonts.arial, 7);
      });

      // continuation headers "Page n of N"
      headerRows.forEach(function (h) {
        page = h.page;
        text((h.pageIndex + 1) + ' of ' + N, 381.1, 57.5, fonts.arial, 8);
      });

      // print-control artifacts per page
      pages.forEach(function (p, i) {
        page = p;
        if (i % 2 === 0) controlColumn(Math.floor(i / 2) + 1, sheetCount);
        else omrColumn();
      });

      return doc.save();
    });
  }

  return {
    generate: generate,
    computeTotals: computeTotals,
    resolveFeeTotal: resolveFeeTotal,
    format: { usd: usd, money: money, plain: plain, shortDate: shortDate, toNum: toNum }
  };
});
