/*
 * Statement importer: parses a previously generated statement PDF (either
 * style) back into the form-data shape used by js/app.js, so every value
 * lands in an editable field.
 *
 * Parsing is positional, driven by the same measured template geometry the
 * generators use (docs/template-spec.md, docs/template2-spec.md): text is
 * clustered into rows, and numeric cells are recognized by their column's
 * right edge. Works in the browser (window.StatementImport) and in Node for
 * the round-trip tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StatementImport = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var CATEGORIES = [
    { key: 'transaction', name: 'Transaction Fees' },
    { key: 'cardNetwork', name: 'Card Network Fees' },
    { key: 'otherProcessing', name: 'Other Processing Fees' },
    { key: 'thirdParty', name: 'Third Party Fees' },
    { key: 'recurring', name: 'Recurring Fees' }
  ];

  /* ------------------------------------------------------------------ *
   * pdf.js extraction -> rows of tokens
   * ------------------------------------------------------------------ */

  // Loads every page's text into rows: {y, left, text, tokens:[{text,x,right}]}
  function extractPages(pdf) {
    var pagePromises = [];
    for (var i = 1; i <= pdf.numPages; i++) {
      pagePromises.push(pdf.getPage(i).then(function (page) {
        return page.getTextContent().then(function (tc) {
          var items = tc.items.map(function (it) {
            return {
              str: it.str,
              x: it.transform[4],
              y: it.transform[5],
              right: it.transform[4] + it.width,
              rotated: Math.abs(it.transform[1]) > 0.01 || Math.abs(it.transform[2]) > 0.01
            };
          }).filter(function (it) {
            // drop empties and rotated print-house control lines
            return it.str.trim() !== '' && !it.rotated;
          });
          return { rows: buildRows(items) };
        });
      }));
    }
    return Promise.all(pagePromises);
  }

  function buildRows(items) {
    items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
    var rows = [];
    var current = null;
    items.forEach(function (it) {
      if (!current || Math.abs(current.y - it.y) > 2) {
        current = { y: it.y, items: [] };
        rows.push(current);
      }
      current.items.push(it);
    });
    rows.forEach(function (row) {
      row.items.sort(function (a, b) { return a.x - b.x; });
      // merge fragments (e.g. kerned runs) separated by sub-space gaps
      var tokens = [];
      row.items.forEach(function (it) {
        var last = tokens[tokens.length - 1];
        if (last && it.x - last.right < 1.6) {
          last.text += it.str;
          last.right = Math.max(last.right, it.right);
        } else {
          tokens.push({ text: it.str, x: it.x, right: it.right });
        }
      });
      tokens.forEach(function (t) { t.text = cleanGlyphs(t.text).replace(/\s+/g, ' ').trim(); });
      row.tokens = tokens.filter(function (t) { return t.text !== ''; });
      row.left = row.tokens.length ? row.tokens[0].x : 0;
      row.text = row.tokens.map(function (t) { return t.text; }).join(' ');
      delete row.items;
    });
    return rows.filter(function (r) { return r.tokens.length; });
  }

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  function squash(s) { return String(s).replace(/\s+/g, ''); }

  // Normalise text extracted from a PDF so it stays inside the range the
  // statement fonts can encode. Some processor statements store punctuation
  // (an apostrophe, a dash) as a Private-Use-Area glyph that pdf.js surfaces as
  // an unencodable code point; left in the data it would later crash the PDF
  // renderer ("WinAnsi cannot encode ..."). Map common typographic characters
  // to ASCII and drop anything still outside Latin-1.
  function cleanGlyphs(s) {
    return String(s == null ? '' : s)
      .replace(/[\u2018\u2019\u201A\u201B\u2032\uFF07]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      .replace(/[\u0080-\u009F\uE000-\uF8FF]/g, '')
      .replace(/[^\t\n\r\u0020-\u00FF]/g, '');
  }

  function cell(row, rightEdge, tol) {
    for (var i = 0; i < row.tokens.length; i++) {
      if (Math.abs(row.tokens[i].right - rightEdge) <= (tol || 3.5)) {
        return row.tokens[i].text;
      }
    }
    return '';
  }

  function dashless(v) { return v === '--' ? '' : v; }

  function joinLeft(row, maxX) {
    return row.tokens.filter(function (t) { return t.x < maxX; })
      .map(function (t) { return t.text; }).join(' ');
  }

  // "May 01, 2026" -> "2026-05-01"
  function isoFromLong(s) {
    var m = /([A-Za-z]{3})[a-z]* (\d{1,2}),? (\d{4})/.exec(s);
    if (!m) return '';
    var mi = MONTHS.indexOf(m[1].slice(0, 3));
    if (mi < 0) return '';
    return m[3] + '-' + String(mi + 1).padStart(2, '0') + '-' + m[2].padStart(2, '0');
  }

  // "05/21/2026" or "05/21/26" -> "2026-05-21"
  function isoFromSlash(s) {
    var m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
    if (!m) return '';
    var y = m[3].length === 2 ? '20' + m[3] : m[3];
    return y + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  }

  function monthFieldsFromIso(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(iso || '');
    return m
      ? { month: String(Number(m[2]) - 1), year: m[1], volume: '' }
      : null;
  }

  /* ------------------------------------------------------------------ *
   * Billing statement (template 1)
   * ------------------------------------------------------------------ */

  function parseBilling(pages) {
    var data = {
      template: 'billing',
      remitAddress: [],
      coverNotice: '',
      notices: '',
      billTo: [],
      details: {},
      summaryAuto: false,
      categories: {},
      batches: []
    };
    CATEGORIES.forEach(function (c) {
      data.categories[c.key] = { included: false, items: [] };
    });

    // ---- page 1: remittance block + cover notice
    pages[0].rows.forEach(function (row) {
      if (/^Page:/.test(row.text)) return;
      if (row.left >= 440 && row.left <= 455) {
        data.remitAddress.push(row.text);
      } else if (row.left < 45) {
        data.coverNotice += (data.coverNotice ? ' ' : '') + row.text;
      }
    });

    // ---- flatten content rows (pages 2+)
    var rows = [];
    for (var p = 1; p < pages.length; p++) {
      pages[p].rows.forEach(function (row) {
        if (!/^Page:/.test(row.text)) rows.push(row);
      });
    }

    var i = 0;
    // notices: everything before the "Statement" title
    var noticeText = '';
    while (i < rows.length && rows[i].text !== 'Statement') {
      noticeText += (noticeText ? ' ' : '') + rows[i].text;
      i++;
    }
    if (noticeText) {
      data.notices = noticeText.split('||').map(function (s) {
        return s.trim();
      }).filter(Boolean).join('\n\n');
    }
    i++; // skip title

    // Bill to / Details rows
    if (i < rows.length && /^Bill to/.test(rows[i].text)) i++;
    var valueRows = [];
    while (i < rows.length && !/^Summary for/.test(rows[i].text)) {
      var row = rows[i];
      var bill = joinLeft(row, 255);
      if (bill) data.billTo.push(bill);
      valueRows.push(row.tokens.filter(function (t) { return t.x >= 380; })
        .map(function (t) { return t.text; }).join(' '));
      i++;
    }
    var keys = ['statementNumber', 'issueDate', 'paymentTerms',
      'billingId', 'billingAccountNumber', 'productId'];
    keys.forEach(function (k, idx) { data.details[k] = valueRows[idx] || ''; });

    // Summary period
    if (i < rows.length) {
      var m = /Summary for (.+?) - (.+)$/.exec(rows[i].text);
      if (m) {
        data.periodStart = isoFromLong(m[1]);
        data.periodEnd = isoFromLong(m[2]);
        data.statementMonth = monthFieldsFromIso(data.periodStart);
      }
      i++;
    }

    var currentCategory = null;
    for (; i < rows.length; i++) {
      var r = rows[i];
      var text = r.text;

      if (/^Total Sales/.test(text)) {
        var vals = rows[i + 1];
        if (vals) {
          data.totalSales = joinLeft(vals, 190);
          data.transactionCount = vals.tokens.filter(function (t) {
            return t.x >= 195 && t.x < 280;
          }).map(function (t) { return t.text; }).join('');
          i++;
        }
        continue;
      }
      var mm = /^Subtotal in (\w+):/.exec(text);
      if (mm) { data.currency = mm[1]; continue; }
      mm = /^Tax \(([\d.]+)%\)/.exec(text);
      if (mm) { data.taxRate = mm[1]; continue; }
      if (/^Fees Collected:/.test(text)) {
        var v = cell(r, 559.2, 4) || r.tokens[r.tokens.length - 1].text;
        var mag = v.replace(/[$(),\s]/g, '');
        // The engine prints fmtCurrency(-feesCollected): a positive Fees
        // Collected shows parenthesised "$(50.00)", a negative one as a plain
        // "$50.00". The label itself has no parenthesis, so a "(" anywhere on
        // the row means the stored value was positive; its absence means the
        // value was negative — recover that sign instead of dropping it.
        data.feesCollected = /\(/.test(text) ? mag
          : (parseFloat(mag) > 0 ? '-' + mag : mag);
        continue;
      }

      // fee detail table headers
      var cat = null;
      CATEGORIES.forEach(function (c) {
        if (text.indexOf(c.name) === 0 && /Amount\(\$\)/.test(text)) cat = c;
      });
      if (cat) {
        currentCategory = data.categories[cat.key];
        currentCategory.included = true;
        continue;
      }
      if (currentCategory) {
        // the category footer is a lone "Total ..." in the first column; a fee
        // line-item whose description merely starts with "Total" must not end it
        if (r.tokens[0].text === 'Total' && r.left < 60) { currentCategory = null; continue; }
        if (text === 'Batch Details') { currentCategory = null; }
        else {
          currentCategory.items.push({
            description: r.tokens.filter(function (t) { return t.right < 340; })
              .map(function (t) { return t.text; }).join(' '),
            count: dashless(cell(r, 367.9)),
            volume: dashless(cell(r, 423.5)),
            rate: dashless(cell(r, 466.9)),
            fee: dashless(cell(r, 501.5)),
            amount: dashless(cell(r, 559.2))
          });
          continue;
        }
      }

      // batch rows
      if (/^\d{2}\/\d{2}\/\d{4}\b/.test(text)) {
        data.batches.push({
          date: isoFromSlash(cell(r, 95.2, 4)),
          number: cell(r, 174.5, 4),
          salesCount: cell(r, 228.1, 4),
          salesAmount: cell(r, 301.4, 4),
          refundCount: cell(r, 362.4, 4),
          refundAmount: cell(r, 443.2, 4)
        });
      }
    }
    return data;
  }

  /* ------------------------------------------------------------------ *
   * Card processing statement (template 2)
   * ------------------------------------------------------------------ */

  function parseProcessing(pages) {
    var s2 = {
      processorLine: '', addressee: [], location: [],
      merchantNumber: '', customerService: '', statementSeq: '',
      tinLabel: '', ytdReportable: '', importantInfo: '',
      cardTypes: [], fees: [], thirdParty: [], adjustments: []
    };
    var data = { template: 'processing', style2: s2, batches: [], summaryAuto: false };

    function isAmt(s) { return /^-?\$?\(?-?[\d,]*\.\d{2}\)?$/.test(String(s)); }
    // Parse one card-type data row into a card-type entry, by token structure
    // (which is stable across processor layouts): a name, then a run of money
    // and count columns. Columns are, in order: Average Ticket, Gross Items,
    // Gross Amount, Refund Items, Refund Amount, [Net Items], Net Amount.
    function pushCardRow(row) {
      if (/Card Type|Gross Sales|Average|Total Amount You/i.test(row.text)) return;
      var toks = row.tokens;
      var amts = toks.filter(function (t) { return isAmt(t.text); });
      var ints = toks.filter(function (t) { return /^\d{1,3}(,\d{3})*$/.test(t.text) && !isAmt(t.text); });
      if (amts.length < 3 || !amts[0]) return;
      var name = toks.filter(function (t) { return t.x < amts[0].x && !isAmt(t.text); })
        .map(function (t) { return t.text; }).join(' ').trim();
      if (!name || /^total$/i.test(name)) return;
      // 4 money columns => the first is Average Ticket (skip it); 3 => none
      var gross = amts.length >= 4 ? amts[1].text : amts[0].text;
      var refund = amts.length >= 4 ? amts[2].text : amts[1].text;
      s2.cardTypes.push({
        name: name,
        items: ints[0] ? ints[0].text.replace(/,/g, '') : '0',
        amount: gross.replace(/[$,]/g, ''),
        refundItems: ints[1] ? ints[1].text.replace(/,/g, '') : '0',
        refundAmount: refund.replace(/[$,]/g, '')
      });
    }

    var rows1 = pages[0].rows;
    var mode = '';
    for (var i = 0; i < rows1.length; i++) {
      var r = rows1[i];
      var flat = squash(r.text).toUpperCase();

      if (!s2.processorLine && r.left < 45 &&
          flat.indexOf('CARDPROCESSINGSTATEMENT') === -1 && /,/.test(r.text)) {
        s2.processorLine = r.text;
        continue;
      }
      if (flat.indexOf('CARDPROCESSINGSTATEMENT') !== -1) { mode = 'addressee'; continue; }
      if (/^Location:?$/.test(r.text) || /Location:/.test(r.text)) { mode = 'location'; continue; }
      if (flat.indexOf('IMPORTANTINFORMATION') !== -1) { mode = 'important'; continue; }
      if (flat.indexOf('SUMMARYBYCARDTYPE') !== -1 ||
          flat.indexOf('TOTALGROSSSALESYOUSUBMITTED') !== -1) { mode = 'cards'; continue; }
      if (flat === 'SUMMARY' || flat.indexOf('SUMMARYANOVERVIEW') === 0) { mode = ''; continue; }

      var pm = /Statement\s*Period\s*(\d{2}\/\d{2}\/\d{2,4})\s*-\s*(\d{2}\/\d{2}\/\d{2,4})/.exec(r.text);
      if (pm) {
        data.periodStart = isoFromSlash(pm[1]);
        data.periodEnd = isoFromSlash(pm[2]);
        data.statementMonth = monthFieldsFromIso(data.periodStart);
        continue;
      }
      if (/Merchant\s*Number/i.test(r.text) && !s2.merchantNumber) {
        // keep the printed grouping (e.g. "5544 0205 0091008"); just drop the
        // label and any "Page N of M" that shares the row
        s2.merchantNumber = r.text
          .replace(/^.*Merchant\s*Number\s*/i, '')
          .replace(/\s*Page\s+\d+\s+of\s+\d+.*$/i, '')
          .replace(/\s+/g, ' ').trim();
        continue;
      }
      if (/Customer\s*Service/.test(r.text)) {
        s2.customerService = r.text.replace(/Customer\s*Service/, '').trim();
        continue;
      }
      if (/^Page \d+ of \d+/.test(r.text) || /NOT\s*A\s*BILL/i.test(r.text)) continue;

      // The sequence marker is drawn on its own baseline to the right of the
      // addressee block; pdf.js then emits it as a lone row (left ~205) that
      // never enters the addressee branch below. Capture a standalone 4-7 digit
      // row in that x-band while we are still in the addressee region.
      if (mode === 'addressee' && !s2.statementSeq &&
          r.tokens.length <= 2 && r.left > 195 && r.left < 340 &&
          /^\d{4,7}$/.test(squash(r.text))) {
        s2.statementSeq = squash(r.text);
        continue;
      }
      if (mode === 'addressee' && r.left < 45) {
        // the statement sequence rides on the first addressee row
        var seq = r.tokens.filter(function (t) { return t.x > 195 && t.x < 260; });
        if (seq.length) s2.statementSeq = squash(seq.map(function (t) { return t.text; }).join(''));
        var line = r.tokens.filter(function (t) { return t.x < 195; })
          .map(function (t) { return t.text; }).join(' ');
        // some layouts glue the sequence straight onto the business name in one
        // run (e.g. "BLACKHAWK CREEK GENERAL STORE23352"); split the trailing
        // digit run off so the name and sequence don't overprint each other
        if (!s2.addressee.length) {
          var glued = /^(.*[A-Za-z].*?)\s*(\d{4,7})$/.exec(line.trim());
          if (glued) {
            if (!s2.statementSeq) s2.statementSeq = glued[2];
            line = glued[1].trim();
          }
        }
        // skip the IMb barcode row (originals draw it with a barcode font
        // whose "text" is the A/T/D/F bar coding)
        if (line && !/^[ATDF]{20,}$/.test(squash(line))) s2.addressee.push(line);
        continue;
      }
      if (mode === 'location' && r.left > 340 && r.left < 375) {
        s2.location.push(r.text);
        continue;
      }
      if (mode === 'important' && r.left < 60 && !/^\(/.test(r.text) &&
          flat.indexOf('AMOUNTSSUBMITTED') === -1) {
        // rows inside the info box (skip the summary box on the right)
        if (r.left >= 38 && r.left <= 60) {
          s2.importantInfo += (s2.importantInfo ? ' ' : '') + r.text;
        }
        continue;
      }
      if (mode === 'cards') {
        // the summary row whose first token is exactly "Total" ends the table
        // (header rows also start with "Total Gross Sales…")
        if (r.tokens[0].text === 'Total' && r.left < 60) { mode = ''; continue; }
        pushCardRow(r);
      }
    }

    // ---- pages 2+: funded-by-batch, fees, third party, adjustments, tax
    var section = '';
    var feeGroup = '';
    for (var p = 1; p < pages.length; p++) {
      // a split fee table repeats its banner on the next page; suspend
      // capture until it shows up so header rows can't parse as fees
      if (section === 'fees') section = 'fees-wait';
      for (var j = 0; j < pages[p].rows.length; j++) {
        var row = pages[p].rows[j];
        var f = squash(row.text).toUpperCase();

        if (f.indexOf('SUMMARYBYCARDTYPE') !== -1 ||
            f.indexOf('TOTALGROSSSALESYOUSUBMITTED') !== -1) { section = 'cards'; continue; }
        if (f.indexOf('AMOUNTSFUNDEDBYBATCH') !== -1 || f.indexOf('AMOUNTSSUBMITTEDBYBATCH') !== -1) { section = 'batches'; continue; }
        if (f.indexOf('AMOUNTSSUBMITTED') !== -1 && row.left < 45) { section = ''; continue; }
        if (f.indexOf('THIRDPARTYTRANSACTIONS') !== -1 && row.left < 45) { section = 'thirdparty'; continue; }
        if (f.indexOf('ADJUSTMENTS') !== -1 && row.left < 45 && f.indexOf('CHARGEBACKS') !== -1) { section = 'adjustments'; continue; }
        if (f.indexOf('FEESCHARGED') !== -1 && row.left < 45) { section = 'fees'; continue; }
        if (f.indexOf('TAXGROSSREPORTABLE') !== -1) { section = 'tax'; continue; }
        if (f.indexOf('FEETYPELEGEND') !== -1) { section = ''; continue; }

        if (section === 'cards') {
          // "Summary by card type" can land on a later page in some layouts
          if (row.tokens[0].text === 'Total' && row.left < 60) { section = ''; continue; }
          pushCardRow(row);
          continue;
        }

        if (section === 'batches') {
          var dm = /^(\d{2}\/\d{2}\/\d{2,4})\b/.exec(row.text);
          if (dm && !/Month End/.test(row.text)) {
            // the submitted amount is the fixed Submitted column when present,
            // else the first money token after the batch number (handles layouts
            // whose Submitted column sits elsewhere, e.g. Commerce Control)
            var firstAmt = '';
            for (var bi = 2; bi < row.tokens.length; bi++) {
              if (isAmt(row.tokens[bi].text)) { firstAmt = row.tokens[bi].text; break; }
            }
            var sub = cell(row, 254.3, 4) || firstAmt;
            data.batches.push({
              date: isoFromSlash(dm[1]),
              number: (row.tokens[1] && row.tokens[1].x < 175) ? row.tokens[1].text : '',
              salesCount: '0',
              salesAmount: (sub || '').replace(/\$/g, ''),
              refundCount: '0',
              refundAmount: '0'
            });
          }
          if (/^Total\b/.test(row.text)) section = '';
          continue;
        }

        if (section === 'fees') {
          if (/^Total (Card|Miscellaneous|\(Misc)/i.test(row.text)) continue;
          if (/Description/.test(row.text) && /Volume/.test(row.text)) continue;
          var vol = cell(row, 457.5, 4);
          var rate = cell(row, 515.1, 4);
          var tot = cell(row, 589.1, 4);
          if (tot && !/^-?\$?-?[\d,]+\.\d{2}$/.test(tot)) tot = '';
          if (!vol && !rate && !tot) {
            // group header (single label in the description column)
            if (row.left > 125 && row.left < 145) feeGroup = row.text;
            continue;
          }
          var typeTok = row.tokens.filter(function (t) { return t.x > 90 && t.x < 125; })
            .map(function (t) { return t.text; }).join('');
          var desc = row.tokens.filter(function (t) { return t.x >= 125 && t.right < 420; })
            .map(function (t) { return t.text; }).join(' ');
          var volNum = parseFloat((vol || '').replace(/[$,]/g, ''));
          var rateNum = parseFloat(rate || '');
          var totNum = parseFloat((tot || '').replace(/[$,]/g, ''));
          // keep the printed total unless it derives exactly from
          // -(volume × rate); then leave it blank so it stays live
          var derives = isFinite(volNum) && isFinite(rateNum) && isFinite(totNum) &&
            Math.abs(-(volNum * rateNum) - totNum) < 0.005;
          s2.fees.push({
            group: feeGroup,
            type: typeTok || 'CF',
            description: desc,
            volume: (vol || '').replace(/\$/g, ''),
            rate: rate || '',
            total: derives ? '' : (tot || '').replace(/\$/g, '')
          });
          continue;
        }

        if (section === 'thirdparty' || section === 'adjustments') {
          if (/There are no/i.test(row.text) || /^Total\b/.test(row.text) ||
              (/Description/.test(row.text) && /Amount/.test(row.text))) {
            if (/^Total\b/.test(row.text)) section = '';
            continue;
          }
          var dm2 = /^(\d{2}\/\d{2}\/\d{2,4})\b/.exec(row.text);
          if (dm2) {
            var entry = {
              date: isoFromSlash(dm2[1]),
              description: row.tokens.filter(function (t) { return t.x > 90 && t.right < 500; })
                .map(function (t) { return t.text; }).join(' '),
              amount: (cell(row, 589.2, 4) || '').replace(/\$/g, '')
            };
            (section === 'thirdparty' ? s2.thirdParty : s2.adjustments).push(entry);
          }
          continue;
        }

        if (section === 'tax') {
          var tm = /TIN\s+(\S+)/.exec(row.text);
          if (tm && !s2.tinLabel) s2.tinLabel = tm[1];
          if (/YTD/i.test(row.text)) {
            s2.ytdReportable = (cell(row, 590.1, 5) ||
              row.tokens[row.tokens.length - 1].text).replace(/\$/g, '');
            section = '';
          }
          continue;
        }
      }
    }
    return data;
  }

  /* ------------------------------------------------------------------ *
   * First Data / Fiserv "Merchant Processing Statement" (real-world).
   * Recognized by the PLAN CODES / TRANSACTION CODES legend and a
   * "Processing Month" header. Mapped onto the card-processing template so
   * every value lands in an editable field: the Plan Summary becomes the
   * card-type breakdown, the daily Deposits become batches, and the Fees
   * table becomes fee rows.
   * ------------------------------------------------------------------ */

  var PLAN_NAMES = {
    VS: 'Visa', VL: 'Visa Large Ticket', VD: 'Visa Debit', VB: 'Visa Business', 'V$': 'Visa Cash Advance',
    MC: 'Mastercard', ML: 'Mastercard Large Ticket', MD: 'Mastercard Debit', MB: 'Mastercard Business', 'M$': 'Mastercard Cash Advance',
    DS: 'Discover', DD: 'Discover Debit', DZ: 'Discover Business', DJ: 'Discover JCB', 'D$': 'Discover Cash Advance',
    JC: 'JCB', AM: 'American Express', DB: 'Debit', EC: 'Electronic Check', EB: 'EBT', PP: 'PayPal'
  };

  // strip thousands separators / $ so values store as plain numeric strings
  function numStr(s) { return String(s == null ? '' : s).replace(/[$,\s]/g, ''); }
  function fdNum(s) { var n = parseFloat(numStr(s)); return isFinite(n) ? n : 0; }
  function titleCaseWords(s) {
    return String(s).toLowerCase().replace(/\b([a-z])/g, function (m) { return m.toUpperCase(); });
  }
  // last day of a 1-based month, no Date() edge cases across DST
  function lastDayOfMonth(year, month1) {
    var d = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month1 - 1];
    if (month1 === 2 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) d = 29;
    return d;
  }

  function parseFirstData(pages) {
    var s2 = {
      processorLine: '', addressee: [], location: [],
      merchantNumber: '', customerService: '', statementSeq: '',
      tinLabel: '', ytdReportable: '', importantInfo: '',
      cardTypes: [], fees: [], thirdParty: [], adjustments: []
    };
    var data = { template: 'processing', style2: s2, batches: [], summaryAuto: true };

    var month = '', year = '';        // from "Processing Month  MM-YY"
    var section = '';                 // '', 'plan', 'deposits', 'chargebacks', 'fees'
    var feeGroup = '';
    var addrDone = false, addrStarted = false;

    for (var p = 0; p < pages.length; p++) {
      var rows = pages[p].rows;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var text = r.text;
        var flat = squash(text).toUpperCase();

        // ---- header fields (may share a row with a left-column line) ----
        var pmM = /Processing\s*Month:?\s*(\d{1,2})[-/](\d{2,4})/i.exec(text);
        if (pmM && !month) { month = pad(pmM[1]); year = fourYear(pmM[2]); }
        var mnM = /Merchant\s*Number:?\s*([Xx0-9]{4,})/.exec(text);
        if (mnM && !s2.merchantNumber) s2.merchantNumber = mnM[1];
        var phM = /\(?\d{3}\)?[\s.-]*\d{3}-\d{4}/.exec(text);
        if (phM && /CALL/i.test(text) && !s2.customerService) s2.customerService = phM[0].trim();

        // ---- section headers ----
        if (/^PLANSUMMARY/.test(flat)) { section = 'plan'; continue; }
        if (/^DEPOSITS/.test(flat)) { section = 'deposits'; continue; }
        if (/^CHARGEBACKS/.test(flat)) { section = 'chargebacks'; continue; }
        if (flat === 'FEES') { section = 'fees'; feeGroup = ''; continue; }
        if (/^(PLANCODES|TRANSACTIONCODES)/.test(flat)) { section = ''; continue; }

        // ---- merchant name/address: left column, page 1, before Plan Summary ----
        if (p === 0 && !addrDone) {
          var leftTok = r.tokens.filter(function (t) { return t.x < 250; });
          var leftText = leftTok.map(function (t) { return t.text; }).join(' ').trim();
          var isSupport = /QUESTION|DASHBOARD|SUPPORT|OR CALL|CALL \(/i.test(leftText);
          if (!addrStarted && /CALL/i.test(leftText)) { addrStarted = true; continue; }
          if (section === 'plan') { addrDone = true; }
          else if (addrStarted && leftText && !isSupport &&
              !/Amount Deducted|Processing Month|Merchant Number|Routing|Deposit Account|Association/i.test(leftText) &&
              !/^\$/.test(leftText)) {
            s2.addressee.push(leftText);
          }
        }

        // ---- Plan Summary -> card-type breakdown ----
        if (section === 'plan') {
          var code = r.tokens[0] && r.tokens[0].text;
          if (code === '**' || /TOTAL/i.test(flat)) { section = ''; continue; }
          if (code && PLAN_NAMES[code] && r.tokens.length >= 5) {
            var pItems = fdNum(r.tokens[1].text);
            var pAmount = fdNum(r.tokens[2].text);
            var pRefItems = fdNum(r.tokens[3].text);
            var pRefAmount = fdNum(r.tokens[4].text);
            if (pItems || pAmount || pRefItems || pRefAmount) {
              s2.cardTypes.push({
                name: PLAN_NAMES[code],
                items: String(pItems),
                amount: numStr(r.tokens[2].text),
                refundItems: String(pRefItems),
                refundAmount: numStr(r.tokens[4].text)
              });
              // Per-card-type merchant discount from the Plan Summary's "Disc %"
              // column (a 4-decimal rate such as 2.6000 = 2.6%). Stored as a
              // derived fee (total = -(volume × rate)) so it both mirrors the
              // statement's Discount Due and auto-recalculates when the volume
              // entered at the top changes.
              // Effective rate straight from the printed Discount Due (the last
              // cell) over the gross amount — exact and independent of column
              // position; fall back to the last 4-decimal "Disc %" token.
              var discDue = fdNum((r.tokens[r.tokens.length - 1] || {}).text);
              var rate = (pAmount > 0 && discDue > 0) ? discDue / pAmount : 0;
              if (rate <= 0) {
                var discTok = r.tokens.filter(function (t) { return /^\d[\d,]*\.\d{4}$/.test(t.text); });
                if (discTok.length) rate = fdNum(discTok[discTok.length - 1].text) / 100;
              }
              if (rate > 0 && pAmount > 0) {
                s2.fees.push({
                  group: PLAN_NAMES[code],
                  type: 'CF',
                  description: 'Merchant Discount',
                  volume: numStr(r.tokens[2].text),
                  rate: rate.toFixed(5),
                  total: ''
                });
              }
            }
          }
          continue;
        }

        // ---- Deposits -> batches ----
        if (section === 'deposits') {
          var t0 = r.tokens[0] && r.tokens[0].text;
          var t1 = r.tokens[1] && r.tokens[1].text;
          if (t0 && /^\d{1,2}$/.test(t0) && t1 && /^\d{6,}$/.test(squash(t1)) && month) {
            // numeric columns after day, reference, and the single-letter codes
            var nums = r.tokens.slice(2).filter(function (t) { return !/^[A-Z]$/.test(t.text); });
            if (nums.length >= 3) {
              data.batches.push({
                date: year + '-' + month + '-' + pad(t0),
                number: squash(t1),
                salesCount: String(fdNum(nums[0].text)),
                salesAmount: numStr(nums[1].text),
                refundCount: '0',
                refundAmount: numStr(nums[2].text)
              });
            }
          } else if (/^DEPOSITTOTALS/.test(flat)) {
            section = '';
          }
          continue;
        }

        // ---- Chargebacks -> adjustments (debits to the merchant) ----
        if (section === 'chargebacks') {
          var c0 = r.tokens[0] && r.tokens[0].text;
          var c1 = r.tokens[1] && r.tokens[1].text;
          if (c0 && /^\d{1,2}$/.test(c0) && c1 && /^\d{6,}$/.test(squash(c1)) && month) {
            var cnums = r.tokens.slice(2).filter(function (t) { return !/^[A-Z]$/.test(t.text); });
            var cAmt = cnums.length >= 2 ? fdNum(cnums[1].text) : 0;
            s2.adjustments.push({
              date: year + '-' + month + '-' + pad(c0),
              description: 'Chargeback ' + squash(c1),
              amount: cAmt ? '-' + numStr(cnums[1].text) : ''
            });
          } else if (/^CHARGEBACKTOTALS/.test(flat)) {
            section = '';
          }
          continue;
        }

        // ---- Fees ----
        if (section === 'fees') {
          if (/FEES:?$/.test(flat) && r.left < 130 && /^[A-Z ]+FEES:?$/.test(text.toUpperCase().trim())) {
            feeGroup = titleCaseWords(text.replace(/:/g, '').trim());
            continue;
          }
          if (/^TOTAL/.test(flat)) { if (/TOTALFEESDUE/.test(flat)) section = ''; continue; }
          if (/DESCRIPTION/.test(flat) && /RATE/.test(flat)) continue;
          // a fee line: a description in the middle column and a total on the right
          var totTok = r.tokens[r.tokens.length - 1];
          var total = totTok ? totTok.text : '';
          if (!/^-?\$?[\d,]*\.\d{2}$/.test(total)) continue;
          // description tokens sit right of the rate column (x ~ 235) up to the
          // "Fees Paid" column (x ~ 500)
          var descTok = r.tokens.filter(function (t) { return t.x > 233 && t.right < 505; });
          var desc = descTok.map(function (t) { return t.text; }).join(' ').trim();
          if (!desc) continue;
          // leftmost numeric before the rate column is the count/volume
          var volTok = r.tokens.filter(function (t) { return t.x < 130 && /\d/.test(t.text); });
          var rateTok = r.tokens.filter(function (t) { return t.x >= 130 && t.x < 233 && /\d/.test(t.text); });
          // the last of the left numerics is the count; a dollar amount may precede it
          var vol = volTok.length ? volTok[volTok.length - 1].text : '';
          var rate = rateTok.length ? rateTok[rateTok.length - 1].text : '';
          // Fees are charges to the merchant, so store them negative (they
          // reduce the funded total), matching the derived discount fees above.
          s2.fees.push({
            group: feeGroup,
            type: 'CF',
            description: desc,
            volume: numStr(vol),
            rate: numStr(rate),
            total: total ? (-fdNum(total)).toFixed(2) : ''
          });
          continue;
        }
      }
    }

    if (month && year) {
      data.periodStart = year + '-' + month + '-01';
      data.periodEnd = year + '-' + month + '-' + pad(lastDayOfMonth(Number(year), Number(month)));
      data.statementMonth = { month: String(Number(month) - 1), year: year, volume: '' };
    }
    // only claim a match if we actually recovered the shape of this statement
    if (!data.batches.length && !s2.cardTypes.length) return null;
    return data;
  }

  /* ------------------------------------------------------------------ *
   * Generic bank statement (real-world, layout-agnostic best effort)
   * ------------------------------------------------------------------ */

  function pad(n) { return String(n).padStart(2, '0'); }
  function fourYear(y) {
    y = String(y);
    return y.length === 2 ? (Number(y) > 70 ? '19' + y : '20' + y) : y;
  }
  function normSlashIso(s, fallbackYear) {
    var m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(String(s).trim());
    if (!m) return '';
    var y = m[3] ? fourYear(m[3]) : fallbackYear;
    return y + '-' + pad(m[1]) + '-' + pad(m[2]);
  }
  function isoFromWords(s) {
    var m = /([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
    if (!m) return '';
    var mi = MONTHS.indexOf(m[1].slice(0, 3));
    if (mi < 0) return '';
    return m[3] + '-' + pad(mi + 1) + '-' + pad(m[2]);
  }

  // ---- shared amount / date matchers (real statements vary a lot) ----
  var MON_RE = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
  // a money amount: optional $, optional integer part (".57"), 2 decimals,
  // optional parentheses or trailing minus for negatives
  var AMT_RE = '\\$?\\(?-?(?:\\d[\\d,]*)?\\.\\d{2}\\)?-?';
  var DATE_RE = '\\d{1,2}[\\/\\-]\\d{1,2}(?:[\\/\\-]\\d{2,4})?|' + MON_RE + '\\s+\\d{1,2}(?:,?\\s+\\d{4})?';
  function monthIdx(w) {
    return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      .indexOf(String(w).slice(0, 3).toLowerCase());
  }
  function isBankAmount(s) { return new RegExp('^[-+]?' + AMT_RE + '(?:\\s*(?:CR|DR))?$', 'i').test(String(s).trim()); }
  function bankAmountMag(s) { var n = parseFloat(String(s).replace(/[^\d.]/g, '')); return isFinite(n) ? n : NaN; }
  function bankAmountNeg(s) { s = String(s); return /\(.*\)/.test(s) || /-\s*$/.test(s) || /^\s*-/.test(s) || /\bDR\b/i.test(s); }
  // "MM/DD[/YY]" | "MM-DD[-YY]" | "Mon DD[, YYYY]" -> ISO (fallbackYear for bare)
  function normDate(s, fy) {
    s = String(s).trim();
    var m = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/.exec(s);
    if (m) { var y = m[3] ? fourYear(m[3]) : fy; return (y || '') + '-' + pad(m[1]) + '-' + pad(m[2]); }
    var w = new RegExp('^(' + MON_RE + ')\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?', 'i').exec(s);
    if (w) { var mi = monthIdx(w[1]); if (mi >= 0) { var yy = w[3] || fy; return (yy || '') + '-' + pad(mi + 1) + '-' + pad(w[2]); } }
    return '';
  }

  // Classify a line as a transaction-section header, a stop marker, or nothing.
  // Covers the varied wording of the major US banks (Chase "Deposits and
  // Additions" / "ATM & Debit Card Withdrawals", BofA "Deposits and other
  // additions" / "Withdrawals and other subtractions", etc.).
  function bankSectionOf(text) {
    var u = String(text).trim().toUpperCase().replace(/\bCONTINUED\b/g, '').replace(/[:.\s]+$/, '').trim();
    if (!u) return null;
    if (/OUTSTANDING|DAILY.{0,8}BALANCE|LEDGER BALANCE|IF ANY|OVERDRAFT PROTECTION|IMPORTANT|MESSAGE|DISCLOSURE|YEAR[- ]TO[- ]DATE|TOTAL FOR|HOW TO|BALANCE SUMMARY|BALANCES? BY DATE/.test(u)) return 'stop';
    // a real section header is a short line with no dollar amount / count
    if (/\d[\d,]*\.\d{2}/.test(u) || /# OF|^\+/.test(u) || u.length > 46) return null;
    if (/CHECK/.test(u) && !/DEBIT|WITHDRAWAL/.test(u)) { return /^CHECKS?( PAID)?$|^SUMMARY OF CHECKS/.test(u) ? 'check' : null; }
    var isDep = /DEPOSIT|ADDITION|CREDIT/.test(u);
    var isWd = /WITHDRAWAL|DEBIT|SUBTRACTION|PAYMENT|PURCHASE|\bFEES?\b|CHARGE/.test(u);
    if (isDep && !isWd) return 'credit';
    if (isWd && !isDep) return 'debit';
    return null;
  }

  function parseBankTxLine(text, fallbackYear) {
    var dre = new RegExp('^(' + DATE_RE + ')\\s+(.+)$', 'i');
    var m = dre.exec(String(text).trim());
    if (!m) return null;
    var rest = m[2];
    var am = new RegExp('(' + AMT_RE + ')\\s*(CR|DR)?\\s*$', 'i').exec(rest);
    if (!am) return null;
    var mag = bankAmountMag(am[1]);
    if (!isFinite(mag)) return null;
    var desc = rest.slice(0, am.index).trim();
    var ref = '';
    var rm = /^(\d{3,})\s+(.+)$/.exec(desc);
    if (rm) ref = rm[1];
    var dir = am[2] ? am[2].toUpperCase() : (bankAmountNeg(am[1]) ? 'DR' : '');
    return {
      date: normDate(m[1], fallbackYear),
      description: desc,
      ref: ref,
      amount: mag.toFixed(2),
      dir: dir
    };
  }

  function findAccountNumber(rows) {
    for (var i = 0; i < rows.length; i++) {
      if (!/account\s*(?:number|no\.?|#)/i.test(rows[i].text)) continue;
      var inline = /account\s*(?:number|no\.?|#)[:\s]*([0-9][0-9\- ]{4,}[0-9])/i.exec(rows[i].text);
      if (inline) return inline[1].trim().replace(/\s{2,}/g, ' ');
      // header on its own line — the number is on the next line(s)
      for (var j = i; j < Math.min(i + 3, rows.length); j++) {
        var toks = rows[j].text.trim().split(/\s+/);
        for (var k = 0; k < toks.length; k++) {
          if (/^\d{6,}$/.test(toks[k].replace(/-/g, ''))) return toks[k];
        }
      }
    }
    return '';
  }

  function bankHasVal(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }

  // Grab the balance printed on (or just after) the row that matches `re`.
  // `first` picks the first amount on the row (for a "Beginning ... Ending" row)
  // rather than the last.
  function findBankBalance(rows, re, first) {
    var AMT_G = /-?\$?\(?-?(?:\d[\d,]*)?\.\d{2}\)?/g;
    for (var i = 0; i < rows.length; i++) {
      if (!re.test(rows[i].text)) continue;
      var amts = rows[i].text.match(AMT_G);
      if (amts && amts.length) {
        return (first ? amts[0] : amts[amts.length - 1]).replace(/[$,()\s]/g, '');
      }
      // otherwise it's a standalone amount on one of the next rows
      for (var j = i + 1; j < Math.min(i + 3, rows.length); j++) {
        var nm = /^\$?\(?(-?(?:\d[\d,]*)?\.\d{2})\)?$/.exec(rows[j].text.trim());
        if (nm) return nm[1].replace(/,/g, '');
      }
    }
    return '';
  }

  // The customer name/address block: the first left-column cluster ending in a
  // "CITY ST 12345" line (the bank's own address sits in the right column).
  function bankHolderBlock(pages, bankName) {
    var rows = (pages[0] && pages[0].rows) || [];
    function looksLikeBank(s) {
      return /\b(bank|credit union|financial|n\.a\.|savings assn|federal)\b/i.test(s) ||
        (bankName && s.toUpperCase().indexOf(bankName.toUpperCase()) !== -1) ||
        /p\.?o\.? box/i.test(s);
    }
    // read only the left-column tokens of a row (the bank's own address and the
    // "Questions?" panel sit in the right column and can share the same line)
    function leftToks(r) { return r.tokens.filter(function (t) { return t.x < 250; }); }
    function leftText(r) { return leftToks(r).map(function (t) { return t.text; }).join(' ').trim(); }
    function leftX(r) { var t = leftToks(r); return t.length ? t[0].x : 1e9; }
    function junk(t) { return !/[A-Za-z]/.test(t) || /^[>|_.\-\s¬]+$/.test(t); }
    var stop = /page \d+ of|statement\b|checking|savings|account\b|questions|www\.|\.com|member fdic|thank you|dear |benefits|^for /i;
    for (var i = 0; i < rows.length; i++) {
      var lt = leftText(rows[i]);
      if (!/[A-Za-z]{2}\s+\d{5}(-\d{4})?$/.test(lt)) continue;   // CITY ST 12345 line
      var anchorX = leftX(rows[i]);
      var block = [lt];
      for (var j = i - 1; j >= 0 && block.length < 6; j--) {
        var t = leftText(rows[j]);
        if (!t || junk(t)) continue;                              // skip blanks / ">>>" artifacts
        if (Math.abs(leftX(rows[j]) - anchorX) > 16) break;       // a different column
        if (/[A-Za-z]{2}\s+\d{5}(-\d{4})?$/.test(t)) break;       // a prior address block's CITY ST ZIP
        if (stop.test(t)) break;
        block.unshift(t);
      }
      // skip the bank's own name/address block; keep scanning for the customer
      if (block.length >= 2 && !block.some(looksLikeBank)) {
        return { name: block[0], address: block.slice(1) };
      }
    }
    return { name: '', address: [] };
  }

  function bankNameOf(full) {
    var known = [
      [/wells\s*fargo/i, 'Wells Fargo Bank'],
      [/frost\s*bank|frostbank/i, 'Frost Bank'],
      [/bank of america/i, 'Bank of America'],
      [/central\s*pacific|cpb\.bank/i, 'Central Pacific Bank'],
      [/\bchase\b|jpmorgan/i, 'Chase'],
      [/\bu\.?s\.? bank/i, 'U.S. Bank'],
      [/pnc bank/i, 'PNC Bank'],
      [/truist/i, 'Truist'],
      [/citibank|\bciti\b/i, 'Citibank'],
      [/capital one/i, 'Capital One'],
      [/regions bank/i, 'Regions Bank'],
      [/td bank/i, 'TD Bank']
    ];
    for (var i = 0; i < known.length; i++) {
      if (known[i][0].test(full)) return known[i][1];
    }
    var m = /\b((?:[A-Z][A-Za-z&.]*\s+){1,3}(?:Bank|Credit Union|Financial|N\.A\.))\b/.exec(full);
    return m ? m[1].trim().replace(/\s+N\.A\.$/, '') : '';
  }

  // Wells-Fargo-style single table where credits, debits and the running
  // balance sit in fixed columns; classify each amount by which column header
  // its right edge lines up with. Returns true if it captured any rows.
  function parseColumnarTx(rows, bank, year) {
    var creditR = null, debitR = null, balanceR = null, active = false;
    var found = 0;
    var dre = new RegExp('^(' + DATE_RE + ')\\b', 'i');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var u = r.text.toUpperCase();
      // A header row carries both a deposit and a withdrawal column *label* —
      // it must look like a header (no dollar amounts, few tokens) so a prose
      // disclaimer mentioning "withdrawals ... deposited" can't re-arm it.
      if (/DEPOSIT|ADDITION/.test(u) && /WITHDRAWAL|DEBIT|SUBTRACTION/.test(u) &&
          !/\d[\d,]*\.\d{2}/.test(u) && r.tokens.length <= 10) {
        creditR = debitR = balanceR = null;
        r.tokens.forEach(function (t) {
          var tu = t.text.toUpperCase();
          if (/DEPOSIT|CREDIT|ADDITION/.test(tu)) creditR = t.right;
          else if (/WITHDRAWAL|DEBIT|SUBTRACTION/.test(tu)) debitR = t.right;
          else if (/ENDING|BALANCE/.test(tu)) balanceR = t.right;
        });
        // the balance label often wraps to the next row — look ahead for it
        if (balanceR === null) {
          for (var k = i + 1; k <= i + 2 && k < rows.length; k++) {
            (rows[k].tokens || []).forEach(function (t) {
              if (balanceR === null && /ENDING|BALANCE/.test(t.text.toUpperCase())) balanceR = t.right;
            });
          }
        }
        active = (creditR !== null && debitR !== null);
        continue;
      }
      if (!active) continue;
      // end of the table — note "Overdraft Fee ..." is a transaction, not a stop
      if (/^TOTALS?\b/.test(u) || /SERVICE FEE SUMMARY|TRANSACTION FEES SUMMARY|INTEREST SUMMARY|ENDING BALANCE ON/.test(u)) {
        active = false; continue;
      }
      var dm = dre.exec(r.text.trim());
      if (!dm) continue;
      var date = normDate(dm[1], year);
      var dateTok = r.tokens[0];
      // only tokens sitting in the money columns (>= the credit column) are
      // real amounts; an amount embedded in the description is ignored
      var amtToks = r.tokens.filter(function (t) {
        return isBankAmount(t.text) && t.right >= creditR - 14;
      });
      var descToks = r.tokens.filter(function (t) {
        return t.x > dateTok.right && t.right < creditR - 14 && !isBankAmount(t.text);
      });
      var desc = descToks.map(function (t) { return t.text; }).join(' ').trim();
      // when no balance column is known, the right-most amount on a multi-amount
      // row is the running balance — drop it
      var effToks = amtToks;
      if (balanceR === null && amtToks.length > 1) effToks = amtToks.slice(0, -1);
      effToks.forEach(function (t) {
        var v = bankAmountMag(t.text);
        if (!isFinite(v)) return;
        var dC = Math.abs(t.right - creditR);
        var dD = Math.abs(t.right - debitR);
        var dB = balanceR !== null ? Math.abs(t.right - balanceR) : Infinity;
        if (Math.min(dC, dD, dB) === dB) return;   // running balance column — skip
        var row = { date: date, description: desc, amount: v.toFixed(2) };
        if (dC <= dD) bank.credits.push(row); else bank.debits.push(row);
        found++;
      });
    }
    return found > 0;
  }

  // Third layout: a flat register with a single Amount column plus a running
  // Balance (Ally, Capital One 360, many credit unions). Direction comes from
  // the amount's own sign / CR-DR marker, or, failing that, from whether the
  // running balance rose or fell.
  function parseRegisterTx(rows, bank, year) {
    // find a header naming a single Amount column AND a Balance column, with no
    // separate deposit/withdrawal columns
    var amountR = null, balanceR = null, start = -1;
    for (var i = 0; i < rows.length; i++) {
      var u = rows[i].text.toUpperCase();
      if (/\bAMOUNT\b/.test(u) && /\bBALANCE\b/.test(u) &&
          !/DEPOSIT|WITHDRAWAL|DEBIT|CREDIT/.test(u) && !/\d[\d,]*\.\d{2}/.test(u)) {
        rows[i].tokens.forEach(function (t) {
          var tu = t.text.toUpperCase();
          if (/AMOUNT/.test(tu)) amountR = t.right;
          else if (/BALANCE/.test(tu)) balanceR = t.right;
        });
        if (amountR !== null && balanceR !== null && balanceR > amountR) { start = i + 1; break; }
      }
    }
    if (start < 0) return false;
    var dre = new RegExp('^(' + DATE_RE + ')\\b', 'i');
    // seed the running balance from the beginning balance so the first row's
    // direction (balance rose => credit) is judged correctly
    var seed = bank.beginningBalance !== '' ? parseFloat(String(bank.beginningBalance).replace(/[^\d.-]/g, '')) : null;
    var prevBal = (seed !== null && isFinite(seed)) ? seed : null;
    var found = 0;
    for (var j = start; j < rows.length; j++) {
      var r = rows[j];
      var uu = r.text.toUpperCase();
      if (/^TOTALS?\b|ENDING BALANCE|BEGINNING BALANCE/.test(uu)) break;
      var dm = dre.exec(r.text.trim());
      if (!dm) continue;
      var amts = r.tokens.filter(function (t) { return isBankAmount(t.text); });
      if (!amts.length) continue;
      var balTok = amts[amts.length - 1];
      var amtTok = amts.length > 1 ? amts[amts.length - 2] : amts[0];
      var bal = bankAmountMag(balTok.text) * (bankAmountNeg(balTok.text) ? -1 : 1);
      var mag = bankAmountMag(amtTok.text);
      if (!isFinite(mag)) continue;
      var descToks = r.tokens.filter(function (t) {
        return t.x > r.tokens[0].right && t.right < amountR - 20 && !isBankAmount(t.text);
      });
      var row = { date: normDate(dm[1], year), description: descToks.map(function (t) { return t.text; }).join(' ').trim(), amount: mag.toFixed(2) };
      var credit;
      if (/\bCR\b/i.test(amtTok.text) || /^\+/.test(amtTok.text)) credit = true;
      else if (/\bDR\b/i.test(amtTok.text) || bankAmountNeg(amtTok.text)) credit = false;
      else if (prevBal !== null && isFinite(bal)) credit = (bal >= prevBal);
      else credit = false;
      if (credit) bank.credits.push(row); else bank.debits.push(row);
      if (isFinite(bal)) prevBal = bal;
      found++;
    }
    return found > 0;
  }

  function parseBankGeneric(pages) {
    var rows = [];
    pages.forEach(function (p) { p.rows.forEach(function (r) { rows.push(r); }); });
    var full = rows.map(function (r) { return r.text; }).join('\n');

    var bank = {
      bankName: '', bankAddress: [], bankPhone: '', bankWebsite: '',
      accountType: '', accountNumber: '', holderName: '', holderAddress: [],
      beginningBalance: '', fees: '', credits: [], debits: [], checks: []
    };

    // period + working year for bare MM/DD rows
    var pStart = '', pEnd = '', year = '';
    var rangeRe = new RegExp('(' + DATE_RE + ')\\s*(?:-|to|through|thru|–|—)\\s*(' + DATE_RE + ')', 'i');
    var pm = rangeRe.exec(full);
    if (pm) { pStart = normDate(pm[1], ''); pEnd = normDate(pm[2], ''); }
    if (!pEnd) {
      // a single issue/closing date -> the whole month it names
      var sd = new RegExp('(?:statement (?:issued|date|closing date|period)|closing date|statement ending|as of)\\D{0,14}(' + DATE_RE + ')', 'i').exec(full);
      if (sd) {
        var iso = normDate(sd[1], String(new Date().getFullYear()));
        var mm2 = /^(\d{4})-(\d{2})/.exec(iso);
        if (mm2) {
          pStart = mm2[1] + '-' + mm2[2] + '-01';
          pEnd = mm2[1] + '-' + mm2[2] + '-' + pad(lastDayOfMonth(Number(mm2[1]), Number(mm2[2])));
        }
      }
    }
    var ym = /\b(20\d{2})\b/.exec(full);
    year = (/^\d{4}/.test(pEnd) ? pEnd.slice(0, 4) : (/^\d{4}/.test(pStart) ? pStart.slice(0, 4) : '')) ||
      (ym ? ym[1] : String(new Date().getFullYear()));
    // backfill a missing year on bare period dates
    if (/^-/.test(pStart)) pStart = year + pStart;
    if (/^-/.test(pEnd)) pEnd = year + pEnd;

    bank.beginningBalance = findBankBalance(rows,
      /beginning balance|balance last statement|previous(?: statement)? balance|opening balance|balance forward|brought forward|starting balance/i, true);
    bank.accountNumber = findAccountNumber(rows);
    var acctType = /((?:Business |Personal |Free |Everyday |Premier )?[A-Za-z ]*?(?:Checking|Savings|Money Market)(?: Account)?|[A-Za-z]+ Personal Account)\b/.exec(full);
    if (acctType) bank.accountType = acctType[1].trim().replace(/\s+SM$/i, '');
    // Detect the bank from the letterhead only — a bank name inside a
    // transaction description ("WELLS FARGO AUTO FEE & PMTS ...") must not
    // mis-identify the statement's own issuer. Try the top-of-page masthead
    // first, then all non-transaction (not date-led) rows, so disclosure /
    // footer text ("... at Central Pacific Bank, PO Box ...") still counts
    // while date-stamped transaction lines are excluded.
    var masthead = ((pages[0] && pages[0].rows) || []).slice(0, 24)
      .map(function (r) { return r.text; }).join(' ');
    var letterhead = rows.filter(function (r) {
      return !/^\s*\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/.test(r.text);
    }).map(function (r) { return r.text; }).join(' ');
    bank.bankName = bankNameOf(masthead) || bankNameOf(letterhead);
    var holder = bankHolderBlock(pages, bank.bankName);
    bank.holderName = holder.name;
    bank.holderAddress = holder.address;

    // Transactions, tried in order of specificity:
    //  1. a single columnar table with credit/debit/balance columns (Wells Fargo)
    //  2. a flat register: one Amount column + a running Balance (Ally, Cap One 360)
    //  3. separate DEPOSITS / WITHDRAWALS / CHECKS sections (Chase, BofA, community)
    var got = parseColumnarTx(rows, bank, year);
    if (!got) got = parseRegisterTx(rows, bank, year);
    if (!got) {
      var section = null, lastSection = null;
      rows.forEach(function (r) {
        var sec = bankSectionOf(r.text);
        if (sec === 'stop') { section = null; return; }
        if (sec) { section = sec; lastSection = sec; return; }
        // A "Date ... Amount" column header restarts the current section's data
        // table; if a prose/YTD block reset the section (common on Bank of
        // America multi-page sections), resume the last header so the fee /
        // transaction lines that follow are still captured.
        if (!section && lastSection && /^DATE\b/i.test(r.text.trim()) && /\bAMOUNT\b/i.test(r.text)) {
          section = lastSection;
          return;
        }
        if (!section) return;
        var tx = parseBankTxLine(r.text, year);
        if (!tx) return;
        if (section === 'credit') bank.credits.push({ date: tx.date, description: tx.description, amount: tx.amount });
        else if (section === 'debit') bank.debits.push({ date: tx.date, description: tx.description, amount: tx.amount });
        else if (section === 'check') {
          bank.checks.push({
            date: tx.date,
            number: tx.ref || (/^\d+$/.test(tx.description) ? tx.description : ''),
            amount: tx.amount
          });
        }
      });
    }

    // A fee only counts as a separate scalar when it is not already one of the
    // debit transactions (otherwise it double-hits the balance).
    var feeInTx = bank.debits.some(function (d) { return /\bfee\b/i.test(d.description); });
    if (!feeInTx) {
      // prefer the actually-charged amount ("You paid $X") over a quoted
      // standard fee, so a waived ($0.00) fee is not applied; fall back to a
      // plain summary "Fees $X" line
      var paid = /you paid\s*\$?\(?-?((?:\d[\d,]*)?\.\d{2})/i.exec(full);
      var svc = /(?:monthly service|service|maintenance) fee[^\d$(-]*\$?\(?-?((?:\d[\d,]*)?\.\d{2})/i.exec(full);
      var plain = /\bfees?\b\s*[−–-]?\s*\$?\(?-?((?:\d[\d,]*)?\.\d{2})/i.exec(full);
      var feeStr = paid ? paid[1] : (svc ? svc[1] : (plain ? plain[1] : ''));
      if (feeStr && parseFloat(feeStr.replace(/,/g, '')) > 0) bank.fees = feeStr.replace(/,/g, '');
    }

    // Interest reported only in a summary line (savings / interest checking)
    // becomes a synthetic credit so the statement still reconciles.
    if (!bank.credits.some(function (c) { return /interest/i.test(c.description); })) {
      var intr = /interest (?:paid|earned|credited)[^\d$(-]*\$?\(?((?:\d[\d,]*)?\.\d{2})/i.exec(full);
      if (intr && parseFloat(intr[1].replace(/,/g, '')) > 0) {
        bank.credits.push({ date: pEnd || '', description: 'Interest Paid', amount: parseFloat(intr[1].replace(/,/g, '')).toFixed(2) });
      }
    }

    // Real banks often print checks in a compact "NUMBER DATE AMOUNT" grid
    // (two per line), which the date-first row parser above skips. Sweep the
    // check sections again for that shape.
    section = null;
    rows.forEach(function (r) {
      var sec = bankSectionOf(r.text);
      if (sec === 'stop') { section = null; return; }
      if (sec) { section = sec; return; }
      if (section !== 'check') return;
      if (/^\d{1,2}[\/\-]\d{1,2}\b/.test(r.text.trim())) return; // date-first: already handled
      // "NUMBER[*] DATE AMOUNT" grid (often two per line); tolerate a trailing
      // "*" gap marker and dash dates
      var re = /(\d{1,6})\*?\s+(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\s+\$?((?:\d[\d,]*)?\.\d{2})/g, mm;
      while ((mm = re.exec(r.text)) !== null) {
        bank.checks.push({
          date: normDate(mm[2], year),
          number: mm[1],
          amount: parseFloat(mm[3].replace(/,/g, '')).toFixed(2)
        });
      }
    });

    // Recognize it as a bank statement if we recovered any activity, a balance,
    // or an account number on a page that reads like a bank statement (this
    // keeps zero-activity statements importable instead of erroring out).
    var count = bank.credits.length + bank.debits.length + bank.checks.length;
    var bankLike = /\bstatement\b/i.test(full) &&
      /balance|deposit|withdrawal|account/i.test(full);
    if (!count && !bankHasVal(bank.beginningBalance) &&
        !(bankHasVal(bank.accountNumber) && bankLike)) {
      return null;
    }

    return {
      template: 'bank',
      bank: bank,
      periodStart: pStart,
      periodEnd: pEnd,
      // Bank periods commonly begin on the last day of the prior month
      // ("04/30 - 05/31"); the statement's real month is the period END.
      statementMonth: monthFieldsFromIso(pEnd || pStart)
    };
  }

  /* ------------------------------------------------------------------ *
   * Entry points
   * ------------------------------------------------------------------ */

  function parsePages(pages) {
    var all = pages.map(function (p) {
      return p.rows.map(function (r) { return squash(r.text).toUpperCase(); }).join(' ');
    }).join(' ');
    if (all.indexOf('CARDPROCESSINGSTATEMENT') !== -1) {
      return parseProcessing(pages);
    }
    // First Data / Fiserv merchant processing statement (real-world)
    if (all.indexOf('PLANCODES') !== -1 && all.indexOf('TRANSACTIONCODES') !== -1 &&
        (all.indexOf('PROCESSINGMONTH') !== -1 || all.indexOf('PLANSUMMARY') !== -1)) {
      var fd = parseFirstData(pages);
      if (fd) return fd;
    }
    if (all.indexOf('BILLTO') !== -1 || all.indexOf('SUMMARYFOR') !== -1) {
      return parseBilling(pages);
    }
    // real-world / generic bank statements: best-effort extraction
    var bank = parseBankGeneric(pages);
    if (bank) return bank;
    throw new Error('Unrecognized statement layout');
  }

  // arrayBuffer + a pdf.js instance -> parsed form data
  function parsePdf(buffer, pdfjsLib) {
    return pdfjsLib.getDocument({ data: buffer }).promise.then(function (pdf) {
      return extractPages(pdf).then(function (pages) {
        return parsePages(pages);
      });
    });
  }

  return {
    parsePdf: parsePdf,
    parsePages: parsePages,
    extractPages: extractPages
  };
});
