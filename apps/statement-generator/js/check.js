/*
 * Voided check engine.
 *
 * Renders a clean, neutral business/personal check in a house style — payer
 * block, bank name, PAY TO THE ORDER OF line, amount box, written-amount line,
 * date, memo, signature line and a MICR line (routing / account / check
 * number). It is NOT a reproduction of any real bank's check stock: no real
 * bank logo, security tint, or trade dress. A prominent VOID marking makes the
 * output non-negotiable — its purpose is account verification (direct deposit /
 * ACH enrolment), not payment.
 *
 * Runs in the browser (window.CheckPDF) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CheckPDF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Check geometry, in PDF points (1pt = 1/72"). A standard personal/business
  // check is 6" x 2.75"; a small margin around it makes the preview read as a
  // physical check on a page.
  var CHECK_W = 432;   // 6"
  var CHECK_H = 198;   // 2.75"
  var MARGIN = 14;
  var PAGE_W = CHECK_W + MARGIN * 2;
  var PAGE_H = CHECK_H + MARGIN * 2;

  // The voided check renders in black ink only: every piece of text and the
  // bank logo are drawn pure black. Rules, borders and the amount box use a
  // neutral (hue-free) grey so nothing on the check carries any colour.
  var BLACK = { r: 0, g: 0, b: 0 };
  var INK = BLACK;                            // all primary text
  var MUTE = BLACK;                           // all secondary / label text
  var RULE = { r: 0.66, g: 0.66, b: 0.66 };   // neutral grey rules / borders
  var VOIDCOL = BLACK;                        // VOID stamp (black, low opacity)
  var ACCENT = BLACK;                         // bank name / marks
  var TINT = { r: 0.965, g: 0.965, b: 0.965 };// neutral amount-box fill

  /* ------------------------------ helpers ------------------------------ */

  function round2(n) {
    var v = Number(n) || 0;
    var s = v < 0 ? -1 : 1;
    return s * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
  }
  function toNum(v) {
    if (v === null || v === undefined) return 0;
    var n = Number(String(v).replace(/[$,\s]/g, ''));
    return isFinite(n) ? n : 0;
  }
  function hasValue(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }

  function money(n) {
    var v = round2(Math.abs(toNum(n)));
    var parts = v.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // Keep drawn text inside the range the PDF fonts can encode.
  function clean(str) {
    return String(str == null ? '' : str)
      .replace(/[\u2018\u2019\u201A\u201B\u2032\uFF07]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      .replace(/[\u0080-\u009F\uE000-\uF8FF]/g, '')
      .replace(/[^\t\n\r\u0020-\u00FF]/g, '');
  }

  // 1234.56 -> "One Thousand Two Hundred Thirty-Four and 56/100"
  var ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
    'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
    'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy',
    'Eighty', 'Ninety'];
  var SCALE = ['', ' Thousand', ' Million', ' Billion', ' Trillion', ' Quadrillion'];

  function threeDigits(n) {
    var out = '';
    if (n >= 100) { out += ONES[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n) out += ' '; }
    if (n >= 20) { out += TENS[Math.floor(n / 10)]; if (n % 10) out += '-' + ONES[n % 10]; }
    else if (n > 0) out += ONES[n];
    return out;
  }

  function amountInWords(value) {
    var v = round2(Math.abs(toNum(value)));
    var dollars = Math.floor(v);
    var cents = Math.round((v - dollars) * 100);
    var words = '';
    if (dollars === 0) words = 'Zero';
    else {
      var groups = [];
      var d = dollars;
      while (d > 0) { groups.push(d % 1000); d = Math.floor(d / 1000); }
      for (var i = groups.length - 1; i >= 0; i--) {
        if (groups[i] === 0) continue;
        words += (words ? ' ' : '') + threeDigits(groups[i]) + (SCALE[i] || '');
      }
    }
    var centStr = (cents < 10 ? '0' + cents : String(cents)) + '/100';
    return words + ' and ' + centStr;
  }

  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return String(iso || '');
    return m[2] + '/' + m[3] + '/' + m[1];
  }

  /* ------------------------------ generation ---------------------------- */

  function generate(data, env) {
    var PDFLib = env.pdfLib;
    var doc, sans, bold, micr, logoImage;

    return PDFLib.PDFDocument.create().then(function (d) {
      doc = d;
      doc.registerFontkit(env.fontkit);
      return Promise.all([
        doc.embedFont(env.fonts.sans, { subset: true }),
        doc.embedFont(env.fonts.sansBold, { subset: true }),
        doc.embedFont(PDFLib.StandardFonts.Courier),
        env.logo
          ? (env.logo.mime === 'image/jpeg' ? doc.embedJpg(env.logo.bytes)
            : doc.embedPng(env.logo.bytes))
          : Promise.resolve(null)
      ]);
    }).then(function (loaded) {
      sans = loaded[0]; bold = loaded[1]; micr = loaded[2]; logoImage = loaded[3];
      var rgb = PDFLib.rgb;
      var page = doc.addPage([PAGE_W, PAGE_H]);

      function col(c) { return rgb(c.r, c.g, c.b); }
      function descent(font) {
        var fk = font.embedder && font.embedder.font;
        return fk && fk.descent && fk.unitsPerEm ? fk.descent / fk.unitsPerEm : -0.21;
      }
      // top-origin text: y measured from the top of the page
      function text(str, x, top, font, size, c, opts) {
        str = clean(str);
        if (!str) return;
        var o = {
          x: x, y: PAGE_H - top - size * (1 + descent(font)),
          size: size, font: font, color: col(c || INK)
        };
        if (opts && opts.rotate !== undefined) o.rotate = PDFLib.degrees(opts.rotate);
        if (opts && opts.opacity !== undefined) o.opacity = opts.opacity;
        page.drawText(str, o);
      }
      function wOf(str, font, size) { return font.widthOfTextAtSize(clean(str), size); }
      function right(str, edge, top, font, size, c) {
        text(str, edge - wOf(str, font, size), top, font, size, c);
      }
      function center(str, cx, top, font, size, c) {
        text(str, cx - wOf(str, font, size) / 2, top, font, size, c);
      }
      // top-origin horizontal rule
      function rule(x0, x1, top, thick, c) {
        page.drawLine({
          start: { x: x0, y: PAGE_H - top }, end: { x: x1, y: PAGE_H - top },
          thickness: thick || 0.7, color: col(c || RULE)
        });
      }
      // labels sit just under a signing/entry line
      function underLabel(str, cx, top, size) {
        center(str, cx, top, sans, size || 5.2, MUTE);
      }
      // draw text shrinking the font size down (never up) so a long value fits
      // within maxW instead of overrunning the fixed check bounds
      function fitText(str, x, top, font, size, maxW, c) {
        str = String(str == null ? '' : str);
        if (!str) return;
        var w = wOf(str, font, size);
        text(str, x, top, font, (w > maxW && w > 0) ? size * maxW / w : size, c);
      }

      var L = MARGIN;          // check left edge
      var Rt = MARGIN + CHECK_W; // check right edge
      var T = MARGIN;          // check top edge

      // ---- check body + border ----
      page.drawRectangle({
        x: L, y: MARGIN, width: CHECK_W, height: CHECK_H,
        color: col({ r: 1, g: 1, b: 1 })
      });
      page.drawRectangle({
        x: L, y: MARGIN, width: CHECK_W, height: CHECK_H,
        borderColor: col(RULE), borderWidth: 0.8
      });

      // ---- payer block (top-left) ----
      var px = L + 16, py = T + 20;
      fitText(data.payerName, px, py, bold, 9.5, 296, INK);
      var addr = [data.payerAddress1, data.payerAddress2, data.payerAddress3]
        .filter(hasValue);
      var ay = py + 11;
      addr.forEach(function (line) { text(line, px, ay, sans, 7, MUTE); ay += 8.6; });

      // ---- check number + fraction (top-right) ----
      var num = String(data.checkNumber || '').replace(/[^0-9]/g, '');
      right(num || '0000', Rt - 16, T + 16, bold, 13, INK);
      if (hasValue(data.fraction)) right(String(data.fraction), Rt - 16, T + 31, sans, 7, MUTE);

      // ---- date (upper-right, above a short line) ----
      var dateLineX0 = Rt - 118, dateLineX1 = Rt - 40, dateTop = T + 50;
      if (hasValue(data.date)) center(fmtDate(data.date), (dateLineX0 + dateLineX1) / 2, dateTop - 2, sans, 8, INK);
      rule(dateLineX0, dateLineX1, dateTop, 0.7);
      right('DATE', dateLineX1, dateTop + 8, sans, 5.6, MUTE);

      // ---- bank name (mid-left) ----
      var bankTop = T + 58;
      if (logoImage) {
        var boxW = 96, boxH = 26;
        var sc = Math.min(boxW / logoImage.width, boxH / logoImage.height);
        page.drawImage(logoImage, {
          x: px, y: PAGE_H - (bankTop + boxH) + (boxH - logoImage.height * sc) / 2,
          width: logoImage.width * sc, height: logoImage.height * sc
        });
      } else if (hasValue(data.bankName)) {
        fitText(data.bankName, px, bankTop + 14, bold, 12, 300, ACCENT);
      }

      // ---- PAY TO THE ORDER OF ----
      var payTop = T + 92;
      text('PAY TO THE', px, payTop - 9, sans, 5.6, MUTE);
      text('ORDER OF', px, payTop - 2, sans, 5.6, MUTE);
      var payX0 = px + 46, payX1 = Rt - 92;
      if (hasValue(data.payTo)) fitText(data.payTo, payX0 + 4, payTop - 8, sans, 10, payX1 - payX0 - 8, INK);
      rule(payX0, payX1, payTop + 2, 0.8);
      // amount box
      var boxX = Rt - 80, boxY = payTop - 12, bxW = 64, bxH = 17;
      var boxMid = boxY + bxH / 2;               // box vertical centre (top-origin)
      page.drawRectangle({
        x: boxX, y: PAGE_H - (boxY + bxH), width: bxW, height: bxH,
        borderColor: col(RULE), borderWidth: 0.8, color: col(TINT)
      });
      // "$" sits just left of the box, vertically centred and level with it
      text('$', boxX - 11, boxMid - 11 * 0.43, bold, 11, INK);
      if (toNum(data.amount) > 0) right(money(data.amount), boxX + bxW - 5, boxMid - 10 * 0.43, bold, 10, INK);

      // ---- written amount ----
      var wordsTop = T + 116;
      var words = toNum(data.amount) > 0 ? amountInWords(data.amount) : '';
      if (words) fitText(words, px, wordsTop - 7, sans, 9, (Rt - 60) - px - 4, INK);
      rule(px, Rt - 60, wordsTop + 2, 0.8);
      right('DOLLARS', Rt - 16, wordsTop, bold, 7.5, MUTE);

      // ---- memo (FOR) + signature ----
      var sigTop = T + 160;
      // "FOR" label with its line running to the right of it (on the same row)
      text('FOR', px, sigTop - 4, sans, 6, MUTE);
      var forX0 = px + wOf('FOR', sans, 6) + 8, forX1 = px + 168;
      if (hasValue(data.memo)) fitText(data.memo, forX0 + 4, sigTop - 5, sans, 8, forX1 - forX0 - 8, INK);
      rule(forX0, forX1, sigTop + 2, 0.7);

      var sigX0 = Rt - 150, sigX1 = Rt - 16;
      rule(sigX0, sigX1, sigTop + 2, 0.7);
      underLabel('AUTHORIZED SIGNATURE', (sigX0 + sigX1) / 2, sigTop + 9, 5.2);

      // ---- MICR line (routing / account / check) ----
      // Rendered in a monospace face at the check foot. Transit/on-us symbols are
      // approximated with characters the standard fonts can draw.
      var routing = String(data.routingNumber || '').replace(/[^0-9]/g, '');
      var account = String(data.accountNumber || '').replace(/[^0-9]/g, '');
      var micrParts = [];
      if (routing) micrParts.push('C' + routing + 'C');
      if (account) micrParts.push(account + 'C');
      if (num) micrParts.push(num);
      var micrLine = micrParts.join('  ');
      if (micrLine) center(micrLine, L + CHECK_W / 2, T + CHECK_H - 14, micr, 11, INK);

      // ---- VOID overlay (non-negotiable) — horizontal, centred ----
      if (data.voided !== false) {
        var vSize = 62;
        var vW = wOf('VOID', bold, vSize);
        text('VOID', L + CHECK_W / 2 - vW / 2, T + CHECK_H / 2 - vSize * 0.43,
          bold, vSize, VOIDCOL, { opacity: 0.16 });
      }

      return doc.save();
    });
  }

  return { generate: generate, amountInWords: amountInWords };
});
