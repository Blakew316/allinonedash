/*
 * Generic bank statement engine.
 *
 * This renders the COMMON STRUCTURE of a bank statement — masthead, account
 * summary, and transaction tables — in a neutral house style. It is not a
 * reproduction of any real bank's statement: no real logo, brand colors, or
 * trade dress. The bank name and details are placeholders the user edits.
 *
 * Runs in the browser (window.StatementBank) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StatementBank = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAGE_W = 612;
  var PAGE_H = 792;
  var LEFT = 48;
  var RIGHT = 564;
  var CONTENT_BOTTOM = 726;

  var INK = { r: 0.114, g: 0.114, b: 0.122 };
  var MUTE = { r: 0.43, g: 0.43, b: 0.45 };
  var NAVY = { r: 0.204, g: 0.286, b: 0.369 };
  var RULE = { r: 0.80, g: 0.80, b: 0.83 };
  var SHADE = { r: 0.965, g: 0.965, b: 0.969 };
  var SUMSHADE = { r: 0.925, g: 0.945, b: 0.965 };

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  /* ------------------------------ helpers ------------------------------ */

  function round2(n) {
    var v = Number(n) || 0;
    var s = v < 0 ? -1 : 1;
    return s * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
  }
  function toNum(v) {
    if (v === null || v === undefined) return 0;
    var s = String(v).trim();
    var n = Number(s.replace(/[$,()\s]/g, ''));
    if (!isFinite(n)) return 0;
    // accounting negatives, symbol inside OR outside the parens: (50) / $(50)
    if (/^\(.*\)$/.test(s) || /^\$\(.*\)$/.test(s)) n = -n;
    return n;
  }
  function hasValue(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }

  function money(n) {
    var v = round2(Math.abs(Number(n) || 0));
    var parts = v.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  // Strip glyphs the PDF fonts can't encode (private-use punctuation from
  // imported statements, etc.) so a render never throws "WinAnsi cannot encode".
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
  // "$1,234.56" / "-$1,234.56"
  function usd(n) {
    var v = Number(n) || 0;
    return (v < 0 ? '-$' : '$') + money(v);
  }
  function fmtLong(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return String(iso || '');
    return MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1];
  }
  function fmtShort(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    return m ? m[2] + '/' + m[3] + '/' + m[1].slice(2) : String(iso || '');
  }
  function dayKey(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    return m ? m[1] + m[2] + m[3] : '';
  }

  function cleanRows(rows, fields) {
    return (rows || []).filter(function (r) {
      return fields.some(function (f) { return hasValue(r[f]); });
    });
  }

  /* --------------------------- derived figures -------------------------- */

  function computeTotals(data) {
    var credits = cleanRows(data.credits, ['date', 'description', 'amount']);
    var debits = cleanRows(data.debits, ['date', 'description', 'amount']);
    var checks = cleanRows(data.checks, ['date', 'number', 'amount']);

    var sum = function (rows) {
      return round2(rows.reduce(function (s, r) { return s + toNum(r.amount); }, 0));
    };
    var creditsTotal = sum(credits);
    var debitsTotal = sum(debits);
    var checksTotal = sum(checks);
    var fees = round2(toNum(data.fees));
    var beginning = round2(toNum(data.beginningBalance));
    var ending = round2(beginning + creditsTotal - debitsTotal - checksTotal - fees);

    // running end-of-day balance across all movements, ordered by date
    var moves = [];
    credits.forEach(function (r) { moves.push({ k: dayKey(r.date), v: toNum(r.amount) }); });
    debits.forEach(function (r) { moves.push({ k: dayKey(r.date), v: -toNum(r.amount) }); });
    checks.forEach(function (r) { moves.push({ k: dayKey(r.date), v: -toNum(r.amount) }); });
    // The fee, and any movement with a missing/unparseable date, attach to the
    // latest dated day so they roll into the final balance instead of sorting
    // to the front and shifting every earlier daily balance. (If nothing has a
    // valid date, keys stay empty and the daily table is suppressed below.)
    var lastKey = moves.reduce(function (m, mv) { return mv.k > m ? mv.k : m; }, '');
    if (fees) moves.push({ k: dayKey(data.periodEnd) || lastKey, v: -fees });
    moves.forEach(function (mv) { if (!mv.k) mv.k = lastKey; });
    moves.sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : 0; });
    var daily = [];
    var bal = beginning;
    var curr = null;
    moves.forEach(function (mv) {
      if (!mv.k) { bal = round2(bal + mv.v); return; }
      if (curr && curr.k !== mv.k) { daily.push(curr); curr = null; }
      bal = round2(bal + mv.v);
      if (!curr) curr = { k: mv.k, balance: bal };
      else curr.balance = bal;
    });
    if (curr) daily.push(curr);
    var dailyRows = daily.map(function (d) {
      return {
        date: d.k.slice(0, 4) + '-' + d.k.slice(4, 6) + '-' + d.k.slice(6, 8),
        balance: d.balance
      };
    });

    return {
      credits: credits, debits: debits, checks: checks,
      creditsTotal: creditsTotal, debitsTotal: debitsTotal, checksTotal: checksTotal,
      fees: fees, beginning: beginning, ending: ending,
      daily: dailyRows
    };
  }

  /* ------------------------------ generation ---------------------------- */

  function generate(data, env) {
    var PDFLib = env.pdfLib;
    var doc, sans, bold, logoImage;

    return PDFLib.PDFDocument.create().then(function (d) {
      doc = d;
      doc.registerFontkit(env.fontkit);
      return Promise.all([
        doc.embedFont(env.fonts.sans, { subset: true }),
        doc.embedFont(env.fonts.sansBold, { subset: true }),
        env.logo
          ? (env.logo.mime === 'image/jpeg' ? doc.embedJpg(env.logo.bytes)
            : doc.embedPng(env.logo.bytes))
          : Promise.resolve(null)
      ]);
    }).then(function (loaded) {
      sans = loaded[0];
      bold = loaded[1];
      logoImage = loaded[2];

      var rgb = PDFLib.rgb;
      var totals = computeTotals(data);
      var pages = [];
      var page = null;
      var cursor = 0;

      function col(c) { return rgb(c.r, c.g, c.b); }
      function descent(font) {
        var fk = font.embedder && font.embedder.font;
        return fk && fk.descent && fk.unitsPerEm ? fk.descent / fk.unitsPerEm : -0.212;
      }
      function text(str, x, top, font, size, c) {
        str = sanitizeText(str);
        if (!str) return;
        page.drawText(str, {
          x: x, y: PAGE_H - top - size * (1 + descent(font)),
          size: size, font: font, color: col(c || INK)
        });
      }
      function wOf(str, font, size) { return font.widthOfTextAtSize(sanitizeText(str), size); }
      function right(str, edge, top, font, size, c) {
        text(str, edge - wOf(str, font, size), top, font, size, c);
      }
      function rule(x0, x1, top, thick, c) {
        page.drawRectangle({ x: x0, y: PAGE_H - top - thick, width: x1 - x0, height: thick, color: col(c || RULE) });
      }
      function band(x0, x1, top, height, c) {
        page.drawRectangle({ x: x0, y: PAGE_H - top - height, width: x1 - x0, height: height, color: col(c) });
      }

      function newPage() {
        page = doc.addPage([PAGE_W, PAGE_H]);
        pages.push(page);
      }

      // Slim continuation header on pages after the first.
      function continuationHeader() {
        newPage();
        text('Account Statement', LEFT, 40, bold, 11, NAVY);
        text('continued', LEFT + wOf('Account Statement', bold, 11) + 6, 42.5, sans, 8, MUTE);
        right(fmtLong(data.periodStart) + ' – ' + fmtLong(data.periodEnd), RIGHT, 42, sans, 8, MUTE);
        rule(LEFT, RIGHT, 56, 0.7, RULE);
        cursor = 70;
      }

      function ensure(space) {
        if (cursor + space > CONTENT_BOTTOM) continuationHeader();
      }

      /* ------------------------------ page 1 masthead ------------------- */

      newPage();

      var nameX = LEFT;
      if (logoImage) {
        var boxW = 118, boxH = 46, boxT = 44;
        var scale = Math.min(boxW / logoImage.width, boxH / logoImage.height);
        var lw = logoImage.width * scale, lh = logoImage.height * scale;
        page.drawImage(logoImage, { x: LEFT, y: PAGE_H - boxT - lh, width: lw, height: lh });
        nameX = LEFT + lw + 14;
      }
      text(data.bankName || 'Meridian Bank', nameX, 48, bold, 16, NAVY);
      var infoTop = 70;
      (data.bankAddress || []).filter(hasValue).slice(0, 3).forEach(function (line) {
        text(line, nameX, infoTop, sans, 8, MUTE);
        infoTop += 10.5;
      });
      if (hasValue(data.bankPhone)) { text(data.bankPhone, nameX, infoTop, sans, 8, MUTE); infoTop += 10.5; }
      if (hasValue(data.bankWebsite)) { text(data.bankWebsite, nameX, infoTop, sans, 8, MUTE); }

      // right info grid
      var gx = 372, gvx = 452;
      var grid = [
        ['Account number', data.accountNumber || ''],
        ['Statement period', fmtShort(data.periodStart) + ' – ' + fmtShort(data.periodEnd)],
        ['Statement date', fmtLong(data.periodEnd)]
      ];
      rule(gx, RIGHT, 44, 0.7, RULE);
      var gy = 52;
      grid.forEach(function (r) {
        text(r[0], gx, gy, sans, 8, MUTE);
        right(r[1], RIGHT, gy, bold, 8.5, INK);
        gy += 15;
        rule(gx, RIGHT, gy - 4, 0.5, RULE);
      });

      // title + account holder
      var titleTop = Math.max(infoTop + 22, 116);
      text('Account Statement', LEFT, titleTop, bold, 15, INK);
      if (hasValue(data.accountType)) {
        text(data.accountType, LEFT, titleTop + 20, sans, 9.5, MUTE);
      }

      var holderTop = titleTop + 40;
      text('ACCOUNT HOLDER', LEFT, holderTop, bold, 7.5, MUTE);
      var hy = holderTop + 13;
      if (hasValue(data.holderName)) { text(data.holderName, LEFT, hy, bold, 9.5, INK); hy += 12.5; }
      (data.holderAddress || []).filter(hasValue).forEach(function (line) {
        text(line, LEFT, hy, sans, 9, INK); hy += 12.5;
      });

      /* ------------------------------ account summary ------------------- */

      var sumTop = holderTop;
      text('ACCOUNT SUMMARY', 330, sumTop, bold, 7.5, MUTE);
      var boxTop = sumTop + 12;
      var rowH = 16.5;
      var rows = [
        { label: 'Beginning balance', sub: fmtLong(data.periodStart), value: usd(totals.beginning) },
        { label: 'Deposits & credits', count: totals.credits.length, sign: '+', value: usd(totals.creditsTotal) },
        { label: 'Withdrawals & debits', count: totals.debits.length, sign: '−', value: usd(totals.debitsTotal) },
        { label: 'Checks paid', count: totals.checks.length, sign: '−', value: usd(totals.checksTotal) },
        { label: 'Fees', sign: '−', value: usd(totals.fees) }
      ];
      rule(330, RIGHT, boxTop, 0.7, NAVY);
      var ry = boxTop;
      rows.forEach(function (r, i) {
        if (i % 2 === 1) band(330, RIGHT, ry, rowH, SHADE);
        var midT = ry + 5;
        if (r.sign) text(r.sign, 336, midT, sans, 8.5, MUTE);
        if (r.count !== undefined) text(String(r.count), 348, midT, sans, 8.5, MUTE);
        text(r.label, 372, midT, sans, 8.5, INK);
        if (r.sub) text(r.sub, 372, midT + 8.5, sans, 6.5, MUTE);
        right(r.value, RIGHT - 4, midT, sans, 8.5, INK);
        ry += r.sub ? rowH + 6 : rowH;
      });
      band(330, RIGHT, ry, rowH + 4, SUMSHADE);
      text('Ending balance', 336, ry + 5, bold, 9, NAVY);
      text(fmtLong(data.periodEnd), 336, ry + 13.5, sans, 6.5, MUTE);
      right(usd(totals.ending), RIGHT - 4, ry + 6, bold, 10, NAVY);
      var summaryBottom = ry + rowH + 4;

      cursor = Math.max(hy, summaryBottom) + 26;

      /* ------------------------------ transaction tables ---------------- */

      var COLS_TX = { date: LEFT, desc: 108, amount: RIGHT - 4 };

      function tableHeader(title, cols, top) {
        text(title, LEFT, top, bold, 10.5, NAVY);
        var htop = top + 15;
        rule(LEFT, RIGHT, htop, 0.7, NAVY);
        cols.forEach(function (c) {
          if (c.right) right(c.label, c.x, htop + 4, bold, 7, MUTE);
          else text(c.label, c.x, htop + 4, bold, 7, MUTE);
        });
        rule(LEFT, RIGHT, htop + 13.5, 0.5, RULE);
        return htop + 13.5; // first row top
      }

      function txTable(title, rowsData, mapper, cols) {
        if (!rowsData.length) return;
        ensure(15 + 13.5 + rowH * 2);
        var rowTop = tableHeader(title, cols, cursor);
        var idx = 0;
        rowsData.forEach(function (r) {
          if (rowTop + rowH + rowH > CONTENT_BOTTOM) {
            continuationHeader();
            rowTop = tableHeader(title + ' (continued)', cols, cursor);
            idx = 0;
          }
          if (idx % 2 === 1) band(LEFT, RIGHT, rowTop, rowH, SHADE);
          mapper(r, rowTop + 5);
          rowTop += rowH;
          idx++;
        });
        return rowTop;
      }

      var txCols = [
        { label: 'DATE', x: COLS_TX.date },
        { label: 'DESCRIPTION', x: COLS_TX.desc },
        { label: 'AMOUNT', x: COLS_TX.amount, right: true }
      ];

      function drawTxRow(r, midT) {
        text(fmtShort(r.date), COLS_TX.date, midT, sans, 8, INK);
        var desc = String(r.description || '');
        while (desc.length > 1 && wOf(desc, sans, 8) > COLS_TX.amount - 70 - COLS_TX.desc) desc = desc.slice(0, -1);
        text(desc, COLS_TX.desc, midT, sans, 8, INK);
        right(usd(toNum(r.amount)), COLS_TX.amount, midT, sans, 8, INK);
      }

      function totalRow(label, value, top) {
        rule(LEFT, RIGHT, top, 0.7, RULE);
        text(label, COLS_TX.desc, top + 5, bold, 8, INK);
        right(value, COLS_TX.amount, top + 5, bold, 8, INK);
        cursor = top + rowH + 18;
      }

      if (totals.credits.length) {
        var b1 = txTable('Deposits & Credits', totals.credits, drawTxRow, txCols);
        totalRow('Total deposits & credits', usd(totals.creditsTotal), b1);
      }
      if (totals.debits.length) {
        var b2 = txTable('Withdrawals & Debits', totals.debits, drawTxRow, txCols);
        totalRow('Total withdrawals & debits', usd(totals.debitsTotal), b2);
      }
      if (totals.checks.length) {
        var checkCols = [
          { label: 'DATE', x: COLS_TX.date },
          { label: 'CHECK NUMBER', x: COLS_TX.desc },
          { label: 'AMOUNT', x: COLS_TX.amount, right: true }
        ];
        var b3 = txTable('Checks Paid', totals.checks, function (r, midT) {
          text(fmtShort(r.date), COLS_TX.date, midT, sans, 8, INK);
          text(String(r.number || ''), COLS_TX.desc, midT, sans, 8, INK);
          right(usd(toNum(r.amount)), COLS_TX.amount, midT, sans, 8, INK);
        }, checkCols);
        totalRow('Total checks paid', usd(totals.checksTotal), b3);
      }

      /* ------------------------------ daily balance --------------------- */

      if (totals.daily.length > 1) {
        var dcols = [
          { label: 'DATE', x: COLS_TX.date },
          { label: 'BALANCE', x: COLS_TX.amount, right: true }
        ];
        txTable('Daily Balance Summary', totals.daily, function (r, midT) {
          text(fmtShort(r.date), COLS_TX.date, midT, sans, 8, INK);
          right(usd(r.balance), COLS_TX.amount, midT, sans, 8, INK);
        }, dcols);
      }

      /* ------------------------------ footers --------------------------- */

      var footNote = data.footerNote || 'This statement was generated for record-keeping purposes.';
      pages.forEach(function (p, i) {
        page = p;
        rule(LEFT, RIGHT, 748, 0.7, RULE);
        text(footNote, LEFT, 754, sans, 7, MUTE);
        right('Page ' + (i + 1) + ' of ' + pages.length, RIGHT, 754, sans, 7, MUTE);
      });

      return doc.save();
    });
  }

  return {
    generate: generate,
    computeTotals: computeTotals,
    format: { usd: usd, money: money, toNum: toNum, longDate: fmtLong }
  };
});
