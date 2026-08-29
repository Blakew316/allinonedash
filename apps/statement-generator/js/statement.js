/*
 * Merchant statement PDF layout engine.
 *
 * Reproduces the reference statement template measured in
 * docs/template-spec.md. All layout constants are in PDF points with a
 * top-left origin ("top" = glyph-box top as reported by pdfminer, i.e.
 * baseline + descent + fontsize); drawing converts to pdf-lib's
 * bottom-left baseline origin.
 *
 * Works in the browser (window.StatementPDF) and in Node (module.exports)
 * so the exact same code path can be verified headlessly against the
 * reference PDFs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StatementPDF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAGE_W = 594.95996;
  var PAGE_H = 841.91998;

  var LEFT = 36.8;
  var RIGHT = 559.2;
  var CONTENT_TOP = 28.0;
  var CONTENT_BOTTOM = 810.0;

  var SIZE_BODY = 9.5;
  var SIZE_TITLE = 17.0;
  var SIZE_FOOTER = 10.0;
  var LINE = 14.25;      // line box height
  var TEXT_PAD = 2.9;    // glyph top within a line box

  var NAVY = { r: 0.2039, g: 0.2863, b: 0.3686 };
  var GRAY = { r: 0.4, g: 0.4, b: 0.4 };
  var PLACEHOLDER = { r: 0.7529, g: 0.7529, b: 0.7529 };

  var HEAVY = 1.4;
  var THIN = 0.7;

  // Details section columns.
  var DETAILS_LABEL_X = 271.9;
  var DETAILS_VALUE_X = 386.8;
  var DETAILS_LABEL_WIDTH = 110;
  var DETAILS_VALUE_MAX_WIDTH = 183.5; // values clip at the body edge (x≈568.8)
  var BILLTO_WIDTH = 225;

  // Fee detail table column right edges (text is flush to these).
  var FEE_COLS = { count: 367.9, volume: 423.5, rate: 466.9, fee: 501.5, amount: 559.2 };
  // Batch table column right edges (3.4pt inset from the rule boundaries).
  var BATCH_COLS = [95.2, 174.5, 228.1, 301.4, 362.4, 443.2, 489.3, 555.8];

  var CATEGORY_ORDER = [
    { key: 'transaction', name: 'Transaction Fees' },
    { key: 'cardNetwork', name: 'Card Network Fees' },
    { key: 'otherProcessing', name: 'Other Processing Fees' },
    { key: 'thirdParty', name: 'Third Party Fees' },
    { key: 'recurring', name: 'Recurring Fees' }
  ];

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ------------------------------------------------------------------ *
   * Formatting helpers
   * ------------------------------------------------------------------ */

  function round2(n) {
    var v = Number(n) || 0;
    var sign = v < 0 ? -1 : 1;
    return sign * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
  }

  function money(n) {
    var v = round2(Math.abs(Number(n) || 0));
    var parts = v.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // Table cell amount: "1,207.69" (accounting negatives: "(1.00)").
  function fmtAmount(n) {
    var v = Number(n) || 0;
    return v < 0 ? '(' + money(v) + ')' : money(v);
  }

  // Totals block currency: "$129.51" / "$(74.05)".
  function fmtCurrency(n) {
    var v = Number(n) || 0;
    return v < 0 ? '$(' + money(v) + ')' : '$' + money(v);
  }

  // Strip glyphs the PDF fonts can't encode (e.g. private-use punctuation that
  // an imported statement carries) so a render never throws "WinAnsi cannot
  // encode ..." and abandons the preview.
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

  function fmtInt(n) {
    return String(Math.round(toNum(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // "2026-05-01" -> "May 01, 2026"
  function fmtLongDate(iso) {
    if (!iso) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
    if (!m) return String(iso);
    return MONTHS[Number(m[2]) - 1] + ' ' + m[3] + ', ' + m[1];
  }

  // "2026-05-21" -> "05/21/2026"
  function fmtSlashDate(iso) {
    if (!iso) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
    if (!m) return String(iso);
    return m[2] + '/' + m[3] + '/' + m[1];
  }

  function toNum(v) {
    if (v === null || v === undefined) return 0;
    var s = String(v).trim();
    var n = Number(s.replace(/[$,()%\s]/g, ''));
    if (!isFinite(n)) return 0;
    if (/^\(.*\)$/.test(s) || /^\$\(.*\)$/.test(s)) n = -n;
    return n;
  }

  function hasValue(v) {
    return v !== null && v !== undefined && String(v).trim() !== '';
  }

  /* ------------------------------------------------------------------ *
   * Derived figures
   * ------------------------------------------------------------------ */

  // Effective amount for a fee item: an explicit amount wins; otherwise it
  // is derived from Volume × Rate(%) or Fee × Count when those are present.
  // Returns null when nothing is derivable.
  function resolveAmount(it) {
    if (hasValue(it.amount)) return round2(toNum(it.amount));
    var volume = hasValue(it.volume) ? toNum(it.volume) : null;
    var rate = hasValue(it.rate) ? toNum(it.rate) : null;
    var fee = hasValue(it.fee) ? toNum(it.fee) : null;
    var count = hasValue(it.count) ? Math.round(toNum(it.count)) : null;
    if (volume !== null && rate !== null) return round2(volume * rate / 100);
    if (fee !== null) return round2(fee * (count !== null ? count : 1));
    return null;
  }

  function itemHasContent(it) {
    return hasValue(it.description) || hasValue(it.count) || hasValue(it.volume) ||
      hasValue(it.rate) || hasValue(it.fee) || hasValue(it.amount);
  }

  // Computes every derived number the statement shows. Exposed so the UI
  // shares the exact arithmetic with the PDF.
  function computeTotals(data) {
    var cats = CATEGORY_ORDER.map(function (def) {
      var cat = (data.categories || {})[def.key] || {};
      var items = (cat.items || []).filter(itemHasContent).map(function (it) {
        return {
          description: it.description,
          count: it.count,
          volume: it.volume,
          rate: it.rate,
          fee: it.fee,
          amount: it.amount,
          amountResolved: resolveAmount(it)
        };
      });
      return {
        key: def.key,
        name: def.name,
        included: cat.included !== false,
        items: items,
        total: round2(items.reduce(function (sum, it) {
          return sum + (it.amountResolved || 0);
        }, 0))
      };
    });
    var included = cats.filter(function (c) { return c.included; });
    var subtotal = round2(included.reduce(function (s, c) { return s + c.total; }, 0));
    var taxRate = toNum(data.taxRate);
    var tax = round2(subtotal * taxRate / 100);
    var amountTotal = round2(subtotal + tax);
    var feesCollected = round2(toNum(data.feesCollected));
    var showCollected = feesCollected !== 0;
    var amountDue = round2(amountTotal - feesCollected);

    var batches = (data.batches || []).filter(function (b) {
      return hasValue(b.date) || hasValue(b.number);
    }).map(function (b) {
      return {
        date: b.date, number: b.number,
        salesCount: Math.round(toNum(b.salesCount)),
        salesAmount: round2(toNum(b.salesAmount)),
        refundCount: Math.round(toNum(b.refundCount)),
        refundAmount: round2(toNum(b.refundAmount)),
        netCount: Math.round(toNum(b.salesCount)) + Math.round(toNum(b.refundCount)),
        netAmount: round2(toNum(b.salesAmount) - toNum(b.refundAmount))
      };
    });
    var batchSales = round2(batches.reduce(function (s, b) { return s + b.netAmount; }, 0));
    var batchCount = batches.reduce(function (s, b) { return s + b.salesCount; }, 0);

    // Auto summary figures come from the batches; with no batch rows they
    // fall back to the Transaction Fees items' volume and count.
    var txn = cats.filter(function (c) { return c.key === 'transaction'; })[0];
    var txnSales = round2(txn.items.reduce(function (s, it) {
      return s + (hasValue(it.volume) ? toNum(it.volume) : 0);
    }, 0));
    var txnCount = txn.items.reduce(function (s, it) {
      return s + (hasValue(it.count) ? Math.round(toNum(it.count)) : 0);
    }, 0);

    return {
      categories: cats,
      includedCategories: included,
      subtotal: subtotal,
      taxRate: taxRate,
      tax: tax,
      amountTotal: amountTotal,
      feesCollected: feesCollected,
      showCollected: showCollected,
      amountDue: amountDue,
      batches: batches,
      autoTotalSales: batches.length ? batchSales : txnSales,
      autoTransactionCount: batches.length ? batchCount : txnCount
    };
  }

  /* ------------------------------------------------------------------ *
   * Generation
   * ------------------------------------------------------------------ */

  /**
   * data: statement content (see docs/template-spec.md and js/app.js)
   * env:  { pdfLib, fontkit, fonts: {light, bold, book}, logo: {bytes, mime} | null }
   * Resolves to a Uint8Array of PDF bytes.
   */
  function generate(data, env) {
    var PDFLib = env.pdfLib;
    var doc, light, bold, book, logoImage;

    // Kerned text width. pdf-lib's widthOfTextAtSize sums unkerned glyph
    // advances, but the reference renderer shaped text with kerning; the
    // sum of laid-out advances matches it.
    function widthOf(str, font, size) {
      str = sanitizeText(str);
      var fk = font.embedder && font.embedder.font;
      if (fk && typeof fk.layout === 'function') {
        try {
          var run = fk.layout(str);
          var sum = 0;
          for (var i = 0; i < run.positions.length; i++) {
            sum += run.positions[i].xAdvance;
          }
          return sum * size / fk.unitsPerEm;
        } catch (e) { /* fall through */ }
      }
      return font.widthOfTextAtSize(str, size);
    }

    // Greedy left-aligned wrap. Like the original renderer, words may
    // additionally break after in-word hyphens ("CARD-PRESENT" can split
    // into "CARD-" / "PRESENT").
    function wrap(text, font, size, width) {
      var tokens = [];
      String(text).split(/\s+/).forEach(function (word) {
        if (!word.length) return;
        // Split after hyphens, keeping the hyphen on the left part.
        var parts = word.match(/[^-]*-|[^-]+/g) || [word];
        parts.forEach(function (part, i) {
          tokens.push({ text: part, glue: i === 0 ? ' ' : '' });
        });
      });
      var out = [];
      var line = '';
      tokens.forEach(function (tok) {
        var candidate = line ? line + (tok.glue && line ? tok.glue : '') + tok.text : tok.text;
        if (line && widthOf(candidate, font, size) > width + 0.2) {
          out.push(line);
          line = tok.text;
        } else {
          line = candidate;
        }
      });
      if (line) out.push(line);
      return out.length ? out : [''];
    }

    return PDFLib.PDFDocument.create().then(function (d) {
      doc = d;
      doc.registerFontkit(env.fontkit);
      return Promise.all([
        doc.embedFont(env.fonts.light, { subset: true }),
        doc.embedFont(env.fonts.bold, { subset: true }),
        doc.embedFont(env.fonts.book, { subset: true }),
        env.logo
          ? (env.logo.mime === 'image/jpeg'
            ? doc.embedJpg(env.logo.bytes)
            : doc.embedPng(env.logo.bytes))
          : Promise.resolve(null)
      ]);
    }).then(function (loaded) {
      light = loaded[0];
      bold = loaded[1];
      book = loaded[2];
      logoImage = loaded[3];

      var totals = computeTotals(data);
      var rgb = PDFLib.rgb;
      var pages = [];
      var page = null;
      var cursor = CONTENT_TOP; // top-origin y of the next free line-box top

      function color(c) { return rgb(c.r, c.g, c.b); }

      // Distance from the glyph-box top down to the baseline: fontsize +
      // descent (descent < 0), matching the char boxes both the reference
      // and this output expose through their font descriptors.
      function baselineDrop(font, size) {
        var fk = font.embedder && font.embedder.font;
        if (fk && fk.descent && fk.unitsPerEm) {
          return size * (1 + fk.descent / fk.unitsPerEm);
        }
        return size * 0.7642; // DejaVu Sans fallback
      }

      // Draw text so its glyph-box top lands at yTop (top-origin). Text is
      // split into runs at kerning adjustments so glyphs land exactly where
      // the (kerned) reference renderer put them, even though PDF advances
      // come from the font's unkerned width table.
      function text(str, x, yTop, font, size) {
        str = sanitizeText(str);
        var y = PAGE_H - yTop - baselineDrop(font, size);
        var fk = font.embedder && font.embedder.font;
        var opts = { size: size, font: font, color: rgb(0, 0, 0) };

        var runs = null;
        if (fk && typeof fk.layout === 'function') {
          try {
            var laid = fk.layout(str);
            var scale = size / fk.unitsPerEm;
            runs = [];
            var runText = '';
            var runStartX = 0;
            var cumX = 0;
            for (var i = 0; i < laid.glyphs.length; i++) {
              var glyph = laid.glyphs[i];
              var pos = laid.positions[i];
              runText += String.fromCodePoint.apply(null, glyph.codePoints);
              cumX += pos.xAdvance;
              var kerned = i < laid.glyphs.length - 1 &&
                pos.xAdvance !== glyph.advanceWidth;
              if (kerned) {
                runs.push({ text: runText, x: runStartX * scale });
                runText = '';
                runStartX = cumX;
              }
            }
            if (runText) runs.push({ text: runText, x: runStartX * scale });
          } catch (e) {
            runs = null;
          }
        }

        if (runs) {
          runs.forEach(function (run) {
            var o = { x: x + run.x, y: y, size: size, font: font, color: opts.color };
            page.drawText(run.text, o);
          });
        } else {
          page.drawText(str, { x: x, y: y, size: size, font: font, color: opts.color });
        }
      }

      function textRight(str, rightEdge, yTop, font, size) {
        text(str, rightEdge - widthOf(str, font, size), yTop, font, size);
      }

      function rule(x0, x1, yTop, thickness, c) {
        page.drawRectangle({
          x: x0,
          y: PAGE_H - yTop - thickness,
          width: x1 - x0,
          height: thickness,
          color: color(c)
        });
      }

      // The reference renderer draws table rules as one rect per column;
      // visually identical to a single rect, reproduced for exactness.
      function ruleSegments(bounds, yTop, thickness, c) {
        for (var i = 0; i < bounds.length - 1; i++) {
          rule(bounds[i], bounds[i + 1], yTop, thickness, c);
        }
      }

      function addPage() {
        page = doc.addPage([PAGE_W, PAGE_H]);
        pages.push(page);
        cursor = CONTENT_TOP;
      }

      function ensure(height) {
        if (cursor + height > CONTENT_BOTTOM) addPage();
      }

      /* ------------------------------ cover ------------------------------ */

      addPage();

      if (logoImage) {
        var boxX = 37.2, boxY = 37.2, boxW = 151.9, boxH = 58.3;
        var scale = Math.min(boxW / logoImage.width, boxH / logoImage.height);
        var w = logoImage.width * scale;
        var h = logoImage.height * scale;
        page.drawImage(logoImage, {
          x: boxX,
          y: PAGE_H - boxY - boxH + (boxH - h) / 2, // left-anchored, vertically centered
          width: w,
          height: h
        });
      } else {
        page.drawRectangle({
          x: 37.2, y: PAGE_H - 95.5, width: 151.9, height: 58.3,
          color: color(PLACEHOLDER)
        });
      }

      (data.remitAddress || []).filter(hasValue).slice(0, 3).forEach(function (line, i) {
        text(line, 446.4, 47.9 + i * LINE, light, SIZE_BODY);
      });

      rule(LEFT, RIGHT, 95.8, THIN, NAVY);

      if (hasValue(data.coverNotice)) {
        var coverLines = wrap(data.coverNotice, bold, SIZE_BODY, 531.2);
        var firstTop = 788.7 - (coverLines.length - 1) * LINE;
        coverLines.forEach(function (line, i) {
          text(line, LEFT, firstTop + i * LINE, bold, SIZE_BODY);
        });
      }

      /* --------------------------- content flow -------------------------- */

      addPage();
      cursor = 31.4; // the first block on page 2 starts slightly below content top

      // Important notices (uppercase, joined with a literal "||").
      var noticeSource = String(data.notices || '').trim();
      var hadNotices = false;
      if (noticeSource) {
        hadNotices = true;
        // Blank lines separate notices (joined with the reference's literal
        // "||"); single newlines inside a notice are just spaces.
        var joined = noticeSource.toUpperCase().split(/\n\s*\n/)
          .map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
          .filter(Boolean)
          .join('||');
        wrap(joined, bold, SIZE_BODY, RIGHT - LEFT).forEach(function (line) {
          ensure(LINE);
          text(line, LEFT, cursor + TEXT_PAD, bold, SIZE_BODY);
          cursor += LINE;
        });
      }

      // Pre-measure the Bill to / Details rows and the Summary block so the
      // whole run (title → section → rows → summary/totals) stays on one page;
      // the reference never splits it across a page break.
      var details = data.details || {};
      var labelDefs = [
        'Statement Number', 'Issue date', 'Payment terms',
        'Billing ID', 'Billing Account Number', 'Product ID'
      ];
      var values = [
        details.statementNumber, details.issueDate, details.paymentTerms,
        details.billingId, details.billingAccountNumber, details.productId
      ];
      var labelLines = [];
      labelDefs.forEach(function (label) {
        wrap(label, bold, SIZE_BODY, DETAILS_LABEL_WIDTH).forEach(function (l) {
          labelLines.push(l);
        });
      });
      var billLines = [];
      (data.billTo || []).forEach(function (line) {
        if (!hasValue(line)) return;
        wrap(line, light, SIZE_BODY, BILLTO_WIDTH).forEach(function (l) {
          billLines.push(l);
        });
      });
      var rowCount = Math.max(billLines.length, labelLines.length, values.length);

      var typeRows = totals.includedCategories;
      var totalsRowCount = totals.showCollected ? 5 : 3;
      var blockHeight = 16.45 + 27.8 + LINE * 2 + 14.15 + 16.3 +
        typeRows.length * LINE + 0.7 + THIN + 8.4 +
        totalsRowCount * LINE + THIN * 2;

      // Keep the title + section header together (the reference draws them at
      // the bottom of a page and lets the data rows fall to the next).
      ensure(8.75 + 23.1 + 19.0);
      var titleTop = hadNotices && cursor !== CONTENT_TOP
        ? cursor + 8.75            // measured: 20.1 below the last notice line's glyph top
        : cursor + TEXT_PAD;
      text('Statement', LEFT, titleTop, bold, SIZE_TITLE);

      var sectionTop = titleTop + 23.1;
      rule(LEFT, RIGHT, sectionTop, HEAVY, NAVY);
      text('Bill to', LEFT, sectionTop + 6.3, bold, SIZE_BODY);
      text('Details', DETAILS_LABEL_X, sectionTop + 6.3, bold, SIZE_BODY);
      rule(LEFT, RIGHT, sectionTop + 18.3, THIN, NAVY);

      // The data rows + Summary block are kept together: if they won't both
      // fit under the header, they fall to the next page (leaving the header
      // where it is), matching the reference. Values stack independently of
      // label wrapping; long values clip at the body edge, as in the samples.
      var rowY = sectionTop + 18.3 + THIN;
      if (rowY + rowCount * LINE + blockHeight > CONTENT_BOTTOM) {
        addPage();
        rowY = CONTENT_TOP;
      }
      for (var ri = 0; ri < rowCount; ri++) {
        if (rowY + LINE > CONTENT_BOTTOM) {
          addPage();
          rowY = CONTENT_TOP;
        }
        if (billLines[ri] !== undefined) {
          text(billLines[ri], LEFT, rowY + TEXT_PAD, light, SIZE_BODY);
        }
        if (labelLines[ri] !== undefined) {
          text(labelLines[ri], DETAILS_LABEL_X, rowY + TEXT_PAD, bold, SIZE_BODY);
        }
        if (hasValue(values[ri])) {
          var s = String(values[ri]);
          while (s.length > 1 && widthOf(s, light, SIZE_BODY) > DETAILS_VALUE_MAX_WIDTH) {
            s = s.slice(0, -1);
          }
          text(s, DETAILS_VALUE_X, rowY + TEXT_PAD, light, SIZE_BODY);
        }
        rowY += LINE;
      }
      cursor = rowY;

      // Summary + fee type table + totals (already guaranteed to fit by the
      // keep-together reserve above; this ensure is a safety net).
      ensure(blockHeight);

      var summaryTop = cursor + 16.45; // glyph top
      text('Summary for ' + fmtLongDate(data.periodStart) + ' - ' +
        fmtLongDate(data.periodEnd), LEFT, summaryTop, bold, SIZE_BODY);

      var salesTop = summaryTop + 27.8;
      text('Total Sales', LEFT, salesTop, bold, SIZE_BODY);
      text('Transaction Count', 201.1, salesTop, bold, SIZE_BODY);
      text(fmtCurrency(toNum(data.totalSales)), LEFT, salesTop + LINE, light, SIZE_BODY);
      text(fmtInt(data.transactionCount), 201.1, salesTop + LINE, light, SIZE_BODY);

      var TYPE_BOUNDS = [LEFT, 350.2, RIGHT];
      var typeTop = salesTop - TEXT_PAD + LINE * 2 + 14.15;
      ruleSegments(TYPE_BOUNDS, typeTop, HEAVY, NAVY);
      text('Type', LEFT, typeTop + 4.3, bold, SIZE_BODY);
      textRight('Amount($)', RIGHT, typeTop + 4.3, bold, SIZE_BODY);
      ruleSegments(TYPE_BOUNDS, typeTop + 15.6, THIN, NAVY);
      typeRows.forEach(function (cat, i) {
        text(cat.name, LEFT, typeTop + 19.2 + i * LINE, light, SIZE_BODY);
        textRight(fmtAmount(cat.total), RIGHT, typeTop + 19.2 + i * LINE, light, SIZE_BODY);
      });
      var grayTop = typeTop + 16.3 + typeRows.length * LINE + 0.7;
      rule(LEFT, RIGHT, grayTop, THIN, GRAY);

      // Totals block.
      var ty = grayTop + THIN + 8.4; // glyph top of the first row
      function totalsRow(label, value, useBold) {
        var f = useBold ? bold : light;
        text(label, 298.0, ty, f, SIZE_BODY);
        textRight(value, RIGHT, ty, f, SIZE_BODY);
        ty += LINE;
      }
      function totalsRule() {
        rule(298.0, RIGHT, ty - TEXT_PAD, THIN, NAVY);
        ty += THIN;
      }
      var taxLabel = parseFloat(totals.taxRate.toFixed(4));
      totalsRow('Subtotal in ' + (data.currency || 'USD') + ':', fmtCurrency(totals.subtotal));
      totalsRow('Tax (' + taxLabel + '%):', fmtCurrency(totals.tax));
      totalsRule();
      if (totals.showCollected) {
        totalsRow('Amount Total:', fmtCurrency(totals.amountTotal));
        totalsRow('Fees Collected:', fmtCurrency(-totals.feesCollected));
        totalsRule();
      }
      totalsRow('Amount Due:', fmtCurrency(totals.amountDue), true);
      cursor = ty - TEXT_PAD;

      /* ------------------------- fee detail tables ------------------------ */

      var FEE_BOUNDS = [LEFT, 336.0, 367.9, 423.5, 466.9, 501.5, RIGHT];

      function feeHeader(name, top) {
        ruleSegments(FEE_BOUNDS, top, HEAVY, NAVY);
        text(name, LEFT, top + 4.3, bold, SIZE_BODY);
        textRight('Count', FEE_COLS.count, top + 4.3, bold, SIZE_BODY);
        textRight('Volume($)', FEE_COLS.volume, top + 4.3, bold, SIZE_BODY);
        textRight('Rate(%)', FEE_COLS.rate, top + 4.3, bold, SIZE_BODY);
        textRight('Fee($)', FEE_COLS.fee, top + 4.3, bold, SIZE_BODY);
        textRight('Amount($)', FEE_COLS.amount, top + 4.3, bold, SIZE_BODY);
        ruleSegments(FEE_BOUNDS, top + 15.6, THIN, NAVY);
        return top + 15.6 + THIN; // first row's line-box top
      }

      function feeCell(v, formatter) {
        return hasValue(v) ? formatter(v) : '--';
      }

      function drawFeeRow(item, rowTop) {
        var yText = rowTop + TEXT_PAD;
        // Descriptions are single-line; clip at the column edge.
        var desc = String(item.description || '');
        while (desc.length > 1 && widthOf(desc, light, SIZE_BODY) > 296) {
          desc = desc.slice(0, -1);
        }
        text(desc, LEFT, yText, light, SIZE_BODY);
        textRight(feeCell(item.count, fmtInt), FEE_COLS.count, yText, light, SIZE_BODY);
        textRight(feeCell(item.volume, function (v) { return fmtAmount(toNum(v)); }),
          FEE_COLS.volume, yText, light, SIZE_BODY);
        textRight(feeCell(item.rate, String), FEE_COLS.rate, yText, light, SIZE_BODY);
        textRight(feeCell(item.fee, String), FEE_COLS.fee, yText, light, SIZE_BODY);
        textRight(item.amountResolved === null || item.amountResolved === undefined
          ? '--' : fmtAmount(item.amountResolved),
          FEE_COLS.amount, yText, light, SIZE_BODY);
      }

      if (totals.includedCategories.length) {
        addPage(); // forced break before the detail tables

        totals.includedCategories.forEach(function (cat, idx) {
          if (idx > 0) cursor += 20.3; // inter-table gap
          // Break before the table when it cannot finish on this page but
          // would fit whole on a fresh one; tables taller than a full page
          // instead split between rows (with the header band repeated), so
          // they only need the header + one row + total to start.
          var tableHeight = 16.3 + cat.items.length * LINE + THIN + LINE;
          if (cursor !== CONTENT_TOP && cursor + tableHeight > CONTENT_BOTTOM) {
            if (CONTENT_TOP + tableHeight <= CONTENT_BOTTOM ||
                cursor + 16.3 + LINE * 2 + THIN > CONTENT_BOTTOM) {
              addPage();
            }
          }
          var rowTop = feeHeader(cat.name, cursor);
          cat.items.forEach(function (item) {
            if (rowTop + LINE + THIN + LINE > CONTENT_BOTTOM) {
              addPage();
              rowTop = feeHeader(cat.name, cursor);
            }
            drawFeeRow(item, rowTop);
            rowTop += LINE;
          });
          ruleSegments(FEE_BOUNDS, rowTop, THIN, GRAY);
          text('Total', LEFT, rowTop + THIN + TEXT_PAD, light, SIZE_BODY);
          textRight(fmtAmount(cat.total), FEE_COLS.amount, rowTop + THIN + TEXT_PAD,
            light, SIZE_BODY);
          cursor = rowTop + THIN + LINE;
        });
      }

      /* ---------------------------- batch details ------------------------- */

      var BATCH_BOUNDS = [LEFT, 98.6, 177.9, 231.5, 304.8, 365.8, 446.6, 492.7, RIGHT];

      function batchHeader(top) {
        ruleSegments(BATCH_BOUNDS, top, HEAVY, NAVY);
        var line1 = ['Date', 'Batch', 'Sales', 'Sales', 'Refund', 'Refund', 'Net', 'Net'];
        var line2 = [null, 'Number', 'Count', 'Amount($)', 'Count', 'Amount($)', 'Count', 'Amount($)'];
        line1.forEach(function (label, i) {
          textRight(label, BATCH_COLS[i], top + 4.3, bold, SIZE_BODY);
        });
        line2.forEach(function (label, i) {
          if (label) textRight(label, BATCH_COLS[i], top + 4.3 + 14.2, bold, SIZE_BODY);
        });
        ruleSegments(BATCH_BOUNDS, top + 29.8, THIN, NAVY);
        return top + 29.8 + THIN;
      }

      if (totals.batches.length) {
        addPage(); // forced break before batch details
        text('Batch Details', LEFT, 44.5, light, SIZE_BODY);
        var rowsY = batchHeader(44.5 + 24.9);
        totals.batches.forEach(function (b) {
          if (rowsY + LINE > CONTENT_BOTTOM) {
            addPage();
            rowsY = batchHeader(CONTENT_TOP);
          }
          var yText = rowsY + TEXT_PAD;
          [
            fmtSlashDate(b.date), String(b.number || ''),
            fmtInt(b.salesCount), fmtAmount(b.salesAmount),
            fmtInt(b.refundCount), fmtAmount(b.refundAmount),
            fmtInt(b.netCount), fmtAmount(b.netAmount)
          ].forEach(function (cell, i) {
            textRight(cell, BATCH_COLS[i], yText, light, SIZE_BODY);
          });
          rowsY += LINE;
        });
      }

      /* ---------------------------- page footers -------------------------- */

      pages.forEach(function (p, i) {
        page = p;
        text('Page: ', 500.2, 817.7, book, SIZE_FOOTER);
        text((i + 1) + '/' + pages.length, 530.2, 817.7, book, SIZE_FOOTER);
      });

      return doc.save();
    });
  }

  return {
    generate: generate,
    computeTotals: computeTotals,
    resolveAmount: resolveAmount,
    format: {
      money: money,
      amount: fmtAmount,
      currency: fmtCurrency,
      int: fmtInt,
      longDate: fmtLongDate,
      slashDate: fmtSlashDate,
      toNum: toNum
    },
    CATEGORY_ORDER: CATEGORY_ORDER
  };
});
