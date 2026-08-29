/*
 * Bank verification / comfort letter engine.
 *
 * Renders a clean, neutral bank letter in a house style — letterhead, date,
 * account-holder block, salutation, a verification body paragraph, the account
 * and routing numbers, a contact closing, and a signature block. It is NOT a
 * reproduction of any real bank's letterhead: no real bank logo, seal, or
 * trade dress. Every value is entered by the user and editable.
 *
 * Runs in the browser (window.LetterPDF) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LetterPDF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PAGE_W = 612;   // US Letter
  var PAGE_H = 792;
  var ML = 64;        // left margin
  var MR = PAGE_W - 64; // right edge
  var CW = MR - ML;   // content width

  var INK = { r: 0.102, g: 0.114, b: 0.137 };
  var MUTE = { r: 0.40, g: 0.43, b: 0.48 };
  var RULE = { r: 0.74, g: 0.77, b: 0.81 };
  var ACCENT = { r: 0.13, g: 0.33, b: 0.52 };  // neutral house navy

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

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  // "2025-10-14" -> "October 14, 2025"
  function fmtLongDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return String(iso || '');
    return MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1];
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
      sans = loaded[0]; bold = loaded[1]; logoImage = loaded[2];
      var rgb = PDFLib.rgb;
      var page = doc.addPage([PAGE_W, PAGE_H]);

      function col(c) { return rgb(c.r, c.g, c.b); }
      function descent(font) {
        var fk = font.embedder && font.embedder.font;
        return fk && fk.descent && fk.unitsPerEm ? fk.descent / fk.unitsPerEm : -0.21;
      }
      function wOf(str, font, size) { return font.widthOfTextAtSize(clean(str), size); }
      // top-origin text draw; returns nothing
      function draw(str, x, top, font, size, c) {
        str = clean(str);
        if (!str) return;
        page.drawText(str, {
          x: x, y: PAGE_H - top - size * (1 + descent(font)),
          size: size, font: font, color: col(c || INK)
        });
      }
      function right(str, edge, top, font, size, c) {
        draw(str, edge - wOf(str, font, size), top, font, size, c);
      }
      function rule(x0, x1, top, thick, c) {
        page.drawLine({
          start: { x: x0, y: PAGE_H - top }, end: { x: x1, y: PAGE_H - top },
          thickness: thick || 0.7, color: col(c || RULE)
        });
      }
      // greedy word-wrap into lines that fit `width`
      function wrap(str, font, size, width) {
        var words = clean(str).split(/\s+/).filter(Boolean);
        var lines = [], line = '';
        words.forEach(function (w) {
          var cand = line ? line + ' ' + w : w;
          if (line && wOf(cand, font, size) > width) { lines.push(line); line = w; }
          else line = cand;
        });
        if (line) lines.push(line);
        return lines.length ? lines : [''];
      }
      // draw a wrapped paragraph starting at cursor `top`; returns the new top
      function para(str, top, font, size, lineH, c) {
        wrap(str, font, size, CW).forEach(function (ln) {
          draw(ln, ML, top, font, size, c);
          top += lineH;
        });
        return top;
      }
      // shrink a font size down (never up) so `str` fits within maxW
      function fit(str, font, size, maxW) {
        var w = wOf(str, font, size);
        return (w > maxW && w > 0) ? size * maxW / w : size;
      }
      // continue onto a fresh page when `need` points would run into the footer
      function ensureSpace(need) {
        if (cursor + need > PAGE_H - 76) { page = doc.addPage([PAGE_W, PAGE_H]); cursor = 72; }
      }

      var d = data;
      var cursor;

      // ---- letterhead ----
      if (logoImage) {
        var boxW = 190, boxH = 46;
        var sc = Math.min(boxW / logoImage.width, boxH / logoImage.height);
        page.drawImage(logoImage, {
          x: ML, y: PAGE_H - (56 + logoImage.height * sc),
          width: logoImage.width * sc, height: logoImage.height * sc
        });
        cursor = 56 + boxH + 6;
      } else {
        var bn = d.bankName || 'Bank';
        draw(bn, ML, 58, bold, fit(bn, bold, 20, CW), ACCENT);
        cursor = 84;
      }
      rule(ML, MR, cursor, 1.2, ACCENT);
      cursor += 6;
      var headBits = [d.bankAddress, hasValue(d.bankPhone) ? 'P: ' + d.bankPhone : '']
        .filter(hasValue).join('   |   ');
      if (headBits) { draw(headBits, ML, cursor, sans, 8.5, MUTE); cursor += 14; }

      // ---- date (right) ----
      cursor = Math.max(cursor, 150);
      if (hasValue(d.date)) right(fmtLongDate(d.date), MR, cursor, sans, 10.5, INK);
      cursor += 34;

      // ---- account-holder block ----
      draw(d.holderName || '', ML, cursor, bold, 11, INK); cursor += 15;
      [d.accountLabel, d.holderAddress1, d.holderAddress2].filter(hasValue)
        .forEach(function (ln) { draw(ln, ML, cursor, sans, 10, INK); cursor += 14; });
      cursor += 20;

      // ---- salutation ----
      draw(d.salutation || 'To Whom It May Concern:', ML, cursor, sans, 10.5, INK);
      cursor += 26;

      // ---- body ----
      var holder = hasValue(d.holderName) ? d.holderName : 'the account holder';
      var bank = hasValue(d.bankName) ? d.bankName : 'our bank';
      var sentence = 'This letter is to state that ' + holder + ' is a valued customer of ' +
        bank + '.';
      if (hasValue(d.sinceYear)) sentence += ' They have been banking with our branch since ' +
        String(d.sinceYear).trim() + ',';
      else sentence += ' They maintain an active account with our branch,';
      if (toNum(d.balance) > 0) {
        sentence += ' and currently hold a net balance of $' + money(d.balance) + ' on deposit';
      } else {
        sentence += ' which is in good standing';
      }
      if (hasValue(d.date)) sentence += ' as of ' + fmtLongDate(d.date);
      if (hasValue(d.accountType)) sentence += ', in their ' + String(d.accountType).trim() + ' account';
      sentence += '.';
      if (hasValue(d.thirdParty)) {
        var action = hasValue(d.authAction) ? String(d.authAction).trim() : 'debit and credit';
        sentence += ' ' + d.thirdParty + ' has authorization to ' + action +
          ' the following account:';
      }
      cursor = para(sentence, cursor, sans, 10.5, 16, INK) + 8;

      // ---- account + routing ----
      function labelValue(label, value) {
        draw(label, ML + 6, cursor, bold, 10.5, INK);
        draw(String(value || ''), ML + 6 + wOf(label + ' ', bold, 10.5), cursor, sans, 10.5, INK);
        cursor += 17;
      }
      ensureSpace(46);
      if (hasValue(d.accountNumber)) labelValue('ACCOUNT #:', d.accountNumber);
      if (hasValue(d.routingNumber)) labelValue('ROUTING #:', d.routingNumber);
      cursor += 12;

      // ---- closing ----
      var contact = hasValue(d.contactPhone) ? d.contactPhone
        : (hasValue(d.bankPhone) ? d.bankPhone : '');
      var closing = 'Should you require any further information, please feel free to contact me' +
        (contact ? ' directly at ' + contact : '') + '.';
      ensureSpace(40);
      cursor = para(closing, cursor, sans, 10.5, 16, INK) + 24;

      // ---- signature block ----
      ensureSpace(95);
      draw('Sincerely,', ML, cursor, sans, 10.5, INK);
      cursor += 46;                       // room for a signature
      rule(ML, ML + 200, cursor - 6, 0.6);
      draw(d.signerName || '', ML, cursor, bold, 10.5, INK); cursor += 15;
      if (hasValue(d.signerTitle)) { draw(d.signerTitle, ML, cursor, sans, 10, MUTE); cursor += 14; }
      if (hasValue(d.bankName)) { draw(d.bankName, ML, cursor, sans, 10, MUTE); cursor += 14; }

      // ---- footer ----
      var foot = [d.bankAddress, hasValue(d.bankPhone) ? 'P: ' + d.bankPhone : '']
        .filter(hasValue).join('   |   ');
      if (foot) {
        rule(ML, MR, PAGE_H - 54, 0.6);
        var fw = wOf(foot, sans, 8.5);
        draw(foot, ML + (CW - fw) / 2, PAGE_H - 44, sans, 8.5, MUTE);
      }

      return doc.save();
    });
  }

  return { generate: generate };
});
