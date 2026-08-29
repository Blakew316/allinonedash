/**
 * Team Maverick · Calendar sync — Google Apps Script
 * ====================================================================
 * Feeds the Team Maverick calendar from TWO sources through ONE web app:
 *
 *   1. APPOINTMENTS — parsed live from the company appointment board
 *      (this spreadsheet: day tabs → team sections → rep blocks with
 *      BUSINESS / PHONE / TIME / SETTER / ADDRESS / CITY/STATE / ZIP /
 *      CONTACT / NOTES columns). Only Team Maverick rows are returned.
 *
 *   2. MERCHANT VOLUME — pulled once a day from the sales portal report
 *      (sales.wholesalepayments.org/reports/nonprocessing, team=MAVERICK)
 *      by the syncVolumeDaily() trigger, snapshotted into a
 *      "MerchantVolume" tab, and served to the calendar from there. The
 *      calendar turns crossings of $1,000 / $5,000 into 💰 payout events.
 *
 * SETUP — see the step-by-step in the chat / README. Quick version:
 *   1. Open the board spreadsheet → Extensions → Apps Script → paste this.
 *   2. Run setupAll() once (authorize when asked) — it creates the
 *      MerchantVolume tab and the daily 6am volume trigger.
 *   3. Project Settings → Script properties → add PORTAL_COOKIE
 *      (your sales-portal Cookie header — see instructions).
 *   4. Run testPortal() and check the log (View → Logs) to confirm the
 *      portal fetch works; run syncVolumeDaily() once to fill the tab.
 *   5. Deploy → New deployment → Web app (Execute as: Me, Access: Anyone)
 *      → paste the /exec URL into the calendar's Settings.
 */

// ─────────────────────────── CONFIG ───────────────────────────

var SHEET_ID = '1hVZ5jf0mL6LIWbT4-XzLHnKzd4P7AN2uV1Xj6kfJ0eM'; // the appointment board

// Keep only rows whose team column contains this, OR whose rep is on the
// roster below. Set TEAM_FILTER = '' to include every team.
var TEAM_FILTER = 'maverick';
var ROSTER = [
  'Adam Drexler', 'Darrin Faille', 'Gabriel Craft', 'Haley Woodruff',
  'Isaac Jenkins', 'Jabe Schoenrock', 'Jaden Dufek', 'Jared Mack',
  'Jason Coutcher', 'Judah Steelman', 'Justin Woodruff', 'Kyle Pettit',
  'Lloyd Delecruz', 'Max Alperstein', 'Sadie Scoville', 'Seth Manshum',
  'Timothy Constenius', 'Walter Smith',
  // Alternate board spellings kept so those rows still pass the filter;
  // the calendar folds each into the correct roster name on display.
  'Lloyd Cruz', 'Lloyd Delacruz', 'Lloyd Dela Cruz',
  'Jaden Defek', 'Timothy Canstenivs',
];

// The volume snapshot lives in its OWN small spreadsheet (auto-created in
// the Drive of whoever runs this script) — the appointment board itself is
// only ever READ, so Viewer access to the board is all this script needs.
var VOLUME_SHEET = 'MerchantVolume';
var APPT_SHEET = 'ApptCache';   // pre-parsed appointments, refreshed every 15 min
var PORTAL_URL = 'https://sales.wholesalepayments.org/reports/nonprocessing';
var PORTAL_TEAM = 'MAVERICK';

function openBoard() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {
    var who = Session.getEffectiveUser().getEmail();
    throw new Error('This script is running as ' + who + ', and that account cannot open the ' +
      'appointment board. Open the board link in your browser while signed in as ' + who +
      ' — if it will not open, ask the board owner to share it with that account (Viewer is enough), ' +
      'or paste this script into an Apps Script project under an account that can open the board.');
  }
}

/** The volume cache spreadsheet: auto-created on first use, ID remembered. */
function getVolumeSpreadsheet(createIfMissing) {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('VOLUME_SS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  if (!createIfMissing) return null;
  var ss = SpreadsheetApp.create('Maverick Volume Cache');
  ss.getSheets()[0].setName(VOLUME_SHEET);
  props.setProperty('VOLUME_SS_ID', ss.getId());
  return ss;
}

// ─────────────────────────── WEB APP ───────────────────────────

function doGet(e) {
  var params = (e && e.parameter) || {};
  var from = params.from || fmt(addDays(new Date(), -60), 'yyyy-MM-dd');
  var to = params.to || fmt(addDays(new Date(), 90), 'yyyy-MM-dd');

  // Light caching so the calendar's frequent polls stay fast.
  var cacheKey = 'tm_' + from + '_' + to;
  var cache = CacheService.getScriptCache();
  var payload = params.fresh ? null : cache.get(cacheKey);  // &fresh=1 (manual refresh) bypasses the cache
  if (!payload) {
    payload = JSON.stringify({
      ok: true,
      events: readCachedAppointments(from, to),
      merchants: readVolumeSheet(),
    });
    try { if (payload.length < 90000) cache.put(cacheKey, payload, 300); } catch (err) {}
  }

  var cb = params.callback; // JSONP — lets the calendar bypass CORS. Keep this.
  if (cb && /^[\w$.]+$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + payload + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────── 1) APPOINTMENTS from the board ───────────────────

/**
 * Walks every tab whose NAME parses as a date (e.g. "8/19", "Mon 8/19",
 * "8-19-26", "Aug 19") and is inside [from..to], then parses the board
 * layout inside it. Non-date tabs (LIVE BOARD, MerchantVolume, …) are
 * skipped automatically.
 */
function readBoardAppointments(from, to, maxTabs) {
  var ss = openBoard();
  var out = [];
  var parsed = 0;
  ss.getSheets().forEach(function (sheet) {
    if (maxTabs && parsed >= maxTabs) return;
    var d = parseTabDate(sheet.getName());
    if (!d) return;
    var key = fmt(d, 'yyyy-MM-dd');
    if ((from && key < from) || (to && key > to)) return;
    parsed++;
    parseBoardTab(sheet, key, out);
  });
  return out;
}

/**
 * BACKGROUND JOB (every 15 min, created by setupAll): parses the whole board
 * once and snapshots the Maverick appointments into the cache spreadsheet.
 * doGet serves from this cache, so the calendar loads in ~1-2s instead of
 * timing out while dozens of day tabs are read cell-by-cell per request.
 */
function syncAppointments() {
  var t0 = Date.now();
  var from = fmt(addDays(new Date(), -90), 'yyyy-MM-dd');
  var to = fmt(addDays(new Date(), 180), 'yyyy-MM-dd');
  var events = readBoardAppointments(from, to);
  var ss = getVolumeSpreadsheet(true);
  var sheet = ss.getSheetByName(APPT_SHEET) || ss.insertSheet(APPT_SHEET);
  var head = ['date', 'time', 'agent', 'title', 'phone', 'location', 'notes', 'contact', 'setter', 'area', 'status'];
  var out = [head];
  events.forEach(function (e) { out.push(head.map(function (h) { return e[h] || ''; })); });
  sheet.clearContents();
  var range = sheet.getRange(1, 1, out.length, head.length);
  range.setNumberFormat('@');            // keep dates/times as plain text
  range.setValues(out);
  PropertiesService.getScriptProperties().setProperty('APPT_SYNCED_AT', String(Date.now()));
  ensureReminderTrigger();   // self-heal: the text-reminder timer exists even after a fresh paste
  ensureVolumeTrigger();     // self-heal: migrate the old daily-6am volume check to hourly
  Logger.log('Cached %s Maverick appointments in %ss', events.length, Math.round((Date.now() - t0) / 1000));
}

/** Serve appointments from the cache; narrow LIVE parse only before the
 *  first background sync has run, so a fresh install still shows data. */
function readCachedAppointments(from, to) {
  var vs = getVolumeSpreadsheet(false);
  var sheet = vs && vs.getSheetByName(APPT_SHEET);
  if (!sheet || sheet.getLastRow() < 2) {
    var nFrom = fmt(addDays(new Date(), -7), 'yyyy-MM-dd');
    var nTo = fmt(addDays(new Date(), 21), 'yyyy-MM-dd');
    return readBoardAppointments(from > nFrom ? from : nFrom, to < nTo ? to : nTo, 10);
  }
  var head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, head.length).getDisplayValues();
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var o = {};
    for (var c = 0; c < head.length; c++) o[head[c]] = rows[i][c];
    if (!o.date) continue;
    if ((from && o.date < from) || (to && o.date > to)) continue;
    out.push(o);
  }
  return out;
}

/** Parses one board tab. Board layout facts this relies on:
 *  - Repeated header rows containing REP + BUSINESS + TIME mark each block.
 *  - The team name sits one column left of REP; REP/AREA are merged cells,
 *    so their value appears on the block's first row and is carried down.
 *  - A row is an appointment when its BUSINESS cell is non-empty.
 *  - TOTALS rows are skipped.
 */
function parseBoardTab(sheet, dateKey, out) {
  var vals = sheet.getDataRange().getDisplayValues();
  var cols = null, curRep = '', curArea = '', curTeam = '';

  for (var r = 0; r < vals.length; r++) {
    var row = vals[r].map(function (x) { return String(x || '').trim(); });
    var joined = row.join('|').toUpperCase();

    // (Re)detect the header row of each block
    if (joined.indexOf('REP') >= 0 && joined.indexOf('BUSINESS') >= 0 && joined.indexOf('TIME') >= 0) {
      cols = mapBoardColumns(row);
      curRep = ''; curArea = '';
      continue;
    }
    if (!cols) continue;
    if (joined.indexOf('TOTALS') >= 0 || joined.indexOf('TOTAL APPOINTMENTS') >= 0) { curRep = ''; curArea = ''; continue; }

    var team = cols.team >= 0 ? row[cols.team] : '';
    if (team && !/^hide/i.test(team)) curTeam = team;
    var rep = row[cols.rep];
    if (rep && !/^total/i.test(rep)) curRep = rep;
    var area = cols.area >= 0 ? row[cols.area] : '';
    if (area) curArea = area;

    var biz = cols.business >= 0 ? row[cols.business] : '';
    if (!biz) continue;

    // Team Maverick filter: team column matches, or the rep is on the roster
    if (TEAM_FILTER) {
      var teamOk = curTeam && curTeam.toLowerCase().indexOf(TEAM_FILTER) >= 0;
      if (!teamOk && !inRoster(curRep)) continue;
    }

    var loc = [pickCol(row, cols.address), pickCol(row, cols.citystate), pickCol(row, cols.zip)]
      .filter(String).join(', ');

    var timeVal = pickCol(row, cols.time);
    if (/^[A-Z]{2,4}$/i.test(timeVal)) timeVal = ''; // "EST"/"CST" etc. is a zone, not a time

    out.push({
      date: dateKey,
      time: timeVal,
      agent: curRep || 'Unassigned',
      title: biz,
      phone: pickCol(row, cols.phone),
      location: loc,
      notes: pickCol(row, cols.notes),
      contact: pickCol(row, cols.contact),
      setter: pickCol(row, cols.setter),
      area: curArea,
      status: 'Confirmed',
    });
  }
}

function mapBoardColumns(headerRow) {
  var up = headerRow.map(function (h) { return h.toUpperCase(); });
  // EXACT header matches win across all columns before any prefix match is
  // considered — otherwise "TIME" would match the earlier "TIME ZONE" column
  // and appointments would lose their clock time.
  function find(names) {
    var i, j;
    for (j = 0; j < names.length; j++) {
      for (i = 0; i < up.length; i++) if (up[i] === names[j]) return i;
    }
    for (j = 0; j < names.length; j++) {
      for (i = 0; i < up.length; i++) if (up[i].indexOf(names[j]) === 0 && up[i] !== 'TIME ZONE') return i;
    }
    return -1;
  }
  var rep = find(['REP']);
  return {
    rep: rep,
    team: rep > 0 ? rep - 1 : -1,   // team name sits left of REP
    area: find(['AREA']),
    business: find(['BUSINESS']),
    phone: find(['PHONE']),
    time: find(['TIME']),           // matches TIME before TIME ZONE? guard below
    setter: find(['SETTER']),
    address: find(['ADDRESS']),
    citystate: find(['CITY/STATE', 'CITY']),
    zip: find(['ZIP CODE', 'ZIP']),
    contact: find(['CONTACT']),
    notes: find(['NOTES', 'NOTE']),
  };
}
// Defensive: if a timezone-ish value still lands in the time cell, drop it.

function pickCol(row, i) { return i >= 0 && i < row.length ? row[i] : ''; }
function inRoster(name) {
  if (!name) return false;
  var n = name.toLowerCase().replace(/\s+/g, ' ').trim();
  return ROSTER.some(function (r) {
    var rl = r.toLowerCase();
    return n === rl || n.indexOf(rl) >= 0 || rl.indexOf(n) >= 0 ||
           n.split(' ')[0] === rl.split(' ')[0] && n.split(' ').slice(-1)[0] === rl.split(' ').slice(-1)[0];
  });
}

/** "8/19", "08-19", "8.19.26", "Mon 8/19", "Aug 19", "8/19/2026" → Date */
function parseTabDate(name) {
  var s = String(name || '').trim();
  var m = s.match(/(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?/);
  var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var mo = -1, day = -1, yr = null;
  if (m) { mo = +m[1] - 1; day = +m[2]; if (m[3]) { yr = +m[3]; if (yr < 100) yr += 2000; } }
  else {
    var mm = s.toUpperCase().match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
    if (!mm) return null;
    mo = months.indexOf(mm[1]); day = +mm[2]; if (mm[3]) yr = +mm[3];
  }
  if (mo < 0 || mo > 11 || day < 1 || day > 31) return null;
  if (yr) return new Date(yr, mo, day);
  // No year on the tab: pick the year that lands closest to today
  var now = new Date();
  var cand = [new Date(now.getFullYear() - 1, mo, day), new Date(now.getFullYear(), mo, day), new Date(now.getFullYear() + 1, mo, day)];
  cand.sort(function (a, b) { return Math.abs(a - now) - Math.abs(b - now); });
  return cand[0];
}

// ─────────────── 2) MERCHANT VOLUME from the sales portal ───────────────

/**
 * Runs daily (trigger created by setupAll). Fetches the non-processing
 * report for Team Maverick, parses the HTML table, and snapshots it into
 * the MerchantVolume tab, which doGet serves to the calendar.
 *
 * AUTH: the portal needs your login. Copy your browser's Cookie header for
 * sales.wholesalepayments.org into a Script property named PORTAL_COOKIE
 * (Project Settings → Script properties). If the portal logs you out, the
 * sync emails you to refresh the cookie.
 */
function syncVolumeDaily() {   // runs once daily at 11am (script timezone)
  var props = PropertiesService.getScriptProperties();
  var res = fetchPortal();
  if (!res.ok) {
    // One alert email a day, not one per hourly failure.
    var lastAlert = Number(props.getProperty('VOL_ALERT_AT') || 0);
    if (Date.now() - lastAlert > 20 * 3600 * 1000) {
      props.setProperty('VOL_ALERT_AT', String(Date.now()));
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
        'Maverick calendar: volume sync needs attention',
        'The merchant-volume sync failed: ' + res.error +
        '\n\nMost often the PORTAL_COOKIE script property has expired — log in to ' +
        PORTAL_URL + ' in your browser, copy the Cookie header again, and update ' +
        'the script property. Then run syncVolumeDaily() once to verify.');
    }
    return;
  }
  var ss = getVolumeSpreadsheet(true);
  var sheet = ss.getSheetByName(VOLUME_SHEET) || ss.insertSheet(VOLUME_SHEET);

  // Previous snapshot: keep recorded milestone dates and last-seen volumes
  var prev = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues().forEach(function (r) {
      if (r[0]) prev[r[0]] = { volume: parseFloat(String(r[2]).replace(/[$,\s]/g, '')) || 0, d1k: r[3] || '', d5k: r[4] || '' };
    });
  }
  // The 11am check sees numbers that batched through the previous business
  // day, so a crossing it discovers is stamped YESTERDAY — the day the
  // merchant actually hit the level and the pay went out.
  var now = new Date();
  var crossDay = fmt(addDays(now, -1), 'yyyy-MM-dd');
  var stamp = fmt(now, 'yyyy-MM-dd HH:mm');
  var out = [['Merchant', 'Agent', 'Volume', 'Date1K', 'Date5K', 'UpdatedAt']];
  var changed = 0;
  res.rows.forEach(function (r) {
    var p = prev[r.merchant];
    var d1k = p ? p.d1k : '', d5k = p ? p.d5k : '';
    if (!d1k && r.volume >= 1000 && p && p.volume < 1000) d1k = crossDay;
    if (!d5k && r.volume >= 5000 && p && p.volume < 5000) d5k = crossDay;
    if (p && p.volume !== r.volume) changed++;
    out.push([r.merchant, r.agent, r.volume, d1k, d5k, stamp]);
  });
  sheet.clearContents();
  var range = sheet.getRange(1, 1, out.length, 6);
  range.setNumberFormat('@');
  range.setValues(out);
  // Record when the sync saw the numbers move — volumeUpdateTimes() reads
  // this back if the schedule ever needs tuning.
  if (changed) {
    var log = [];
    try { log = JSON.parse(props.getProperty('VOL_CHANGE_LOG') || '[]'); } catch (e) {}
    log.push(stamp + ' — ' + changed + ' merchant volume(s) changed');
    props.setProperty('VOL_CHANGE_LOG', JSON.stringify(log.slice(-40)));
  }
}

/** Lists the times the sync observed the portal's numbers changing. */
function volumeUpdateTimes() {
  var log = [];
  try { log = JSON.parse(PropertiesService.getScriptProperties().getProperty('VOL_CHANGE_LOG') || '[]'); } catch (e) {}
  if (!log.length) { Logger.log('No volume changes observed yet — check back after tomorrow\'s 11am sync.'); return; }
  Logger.log('Portal volume changes observed at:\n%s', log.join('\n'));
}

/** The volume check runs daily at 11am (script timezone), when the portal's
 *  overnight numbers are settled. Migrates any older schedule automatically —
 *  runs from the appointment sync so a plain paste is enough, no setup step. */
function ensureVolumeTrigger() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('VOL_TRIG_11AM') === '1') return;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncVolumeDaily') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncVolumeDaily').timeBased().everyDays(1).atHour(11).create();
  props.setProperty('VOL_TRIG_11AM', '1');
  Logger.log('Volume sync now runs daily at 11am (script timezone).');
}

/** One-time correction: move a recorded milestone to the day the pay actually
 *  hit. Example — in the editor, run:
 *    correctMilestoneDate('FILIPINO FUSION', 1000, '2026-08-18')
 *  (merchant name as shown on the calendar, level 1000 or 5000, date as
 *  YYYY-MM-DD). Every calendar moves the payout on its next refresh. */
function correctMilestoneDate(merchantName, level, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) { Logger.log('Date must be YYYY-MM-DD, e.g. 2026-08-18.'); return; }
  var vs = getVolumeSpreadsheet(false);
  var sheet = vs && vs.getSheetByName(VOLUME_SHEET);
  if (!sheet || sheet.getLastRow() < 2) { Logger.log('No volume sheet yet — run syncVolumeDaily first.'); return; }
  var col = Number(level) >= 5000 ? 5 : 4;   // Date1K = column 4, Date5K = column 5
  var names = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  var want = String(merchantName || '').trim().toLowerCase();
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim().toLowerCase() === want) {
      var cell = sheet.getRange(i + 2, col);
      cell.setNumberFormat('@');
      cell.setValue(dateStr);
      Logger.log('Moved the %s $%s milestone to %s. Calendars pick it up on their next refresh (tap ⟳ to see it now).', names[i][0], level, dateStr);
      return;
    }
  }
  Logger.log('Merchant "%s" not found in the volume sheet. Names there: %s', merchantName,
    names.slice(0, 20).map(function (r) { return r[0]; }).join(' | '));
}

/** ONE-CLICK date correction — edit the three lines, then press Run.
 *  Prefilled: FILIPINO FUSION hit $1K on Aug 18, 2026. */
function runDateCorrection() {
  var MERCHANT = 'FILIPINO FUSION';
  var LEVEL = 1000;              // 1000 or 5000
  var DATE = '2026-08-18';       // the day the pay actually hit (YYYY-MM-DD)
  correctMilestoneDate(MERCHANT, LEVEL, DATE);
}

function readVolumeSheet() {
  try {
    var vs = getVolumeSpreadsheet(false);
    if (!vs) return [];
    var sheet = vs.getSheetByName(VOLUME_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return [];
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues();
    return rows.filter(function (r) { return r[0]; }).map(function (r) {
      return {
        merchant: String(r[0]),
        agent: String(r[1] || 'Unassigned'),
        volume: parseFloat(String(r[2]).replace(/[$,\s]/g, '')) || 0,
        date1k: String(r[3] || ''),
        date5k: String(r[4] || ''),
      };
    });
  } catch (e) { return []; }
}

function fetchPortal(dtTo) {
  var cookie = PropertiesService.getScriptProperties().getProperty('PORTAL_COOKIE');
  if (!cookie) return { ok: false, error: 'PORTAL_COOKIE script property is not set.' };
  var now = new Date();
  var url = PORTAL_URL +
    '?dtFrom=' + now.getFullYear() + '-01' +
    '&dtTo=' + (dtTo || fmt(now, 'yyyy-MM')) +
    '&apprFrom=&apprTo=&team=' + PORTAL_TEAM + '&p=ALL&proc=ALL';
  var res;
  try {
    res = UrlFetchApp.fetch(url, {
      headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      muteHttpExceptions: true, followRedirects: true,
    });
  } catch (e) { return { ok: false, error: 'Fetch failed: ' + e }; }
  var code = res.getResponseCode(), body = res.getContentText();
  if (code !== 200) return { ok: false, error: 'Portal returned HTTP ' + code };
  if (/login|sign\s*in|password/i.test(body.slice(0, 3000)) && !/logout|sign\s*out/i.test(body.slice(0, 6000))) {
    return { ok: false, error: 'Portal returned the login page (session cookie expired).' };
  }
  // Path 1: a plain HTML table with merchant + volume columns
  var table = pickDataTable(body);
  var tableErr = '';
  if (table && table.length > 1) {
    var mapped = mapTableRows(table);
    if (mapped.ok) return { ok: true, rows: mapped.rows };
    tableErr = mapped.error;
  }
  // Path 2: the merchants grid is often rendered by JS with the data shipped
  // as JSON inside the page — extract and map it.
  var jsonRows = extractJsonRows(body);
  if (jsonRows && jsonRows.length) return { ok: true, rows: jsonRows };

  return { ok: false, error: (tableErr || 'No merchant data table found in the page HTML') +
    ' — the merchants grid probably loads from a JSON endpoint. Run testPortalDeep() and send the whole log.' };
}

function titleCase(s) {
  return String(s || '').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

function mapTableRows(table) {
  var head = table[0].map(function (h) { return h.toLowerCase(); });
  function col(re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; }
  var cM = col(/dba|merchant|business|account\s*name|^name/);
  var cA = col(/^rep|agent|owner|salesman/);
  var cV = col(/volume|vtd|mtd/);
  if (cM < 0 || cV < 0) {
    return { ok: false, error: 'Could not identify merchant/volume columns. Headers were: ' + table[0].join(' | ') };
  }
  var rows = [];
  for (var i = 1; i < table.length; i++) {
    var r = table[i];
    var merchant = (r[cM] || '').trim();
    if (!merchant || /^total/i.test(merchant)) continue;
    rows.push({
      merchant: merchant,
      agent: titleCase(cA >= 0 ? r[cA] : ''),   // "ADAM DREXLER" -> "Adam Drexler" (matches the roster)
      volume: parseFloat(String(r[cV] || '0').replace(/[$,\s]/g, '')) || 0,
    });
  }
  return { ok: true, rows: rows };
}

/**
 * Finds JSON arrays embedded in the page (script tags / initial state) and
 * maps objects that carry merchant + volume fields. Handles strings and
 * escapes correctly while balancing brackets.
 */
function extractJsonRows(html) {
  var idx = 0, tries = 0;
  while ((idx = html.indexOf('[{', idx)) !== -1 && tries < 60) {
    tries++;
    var depth = 0, inStr = false, esc = false, end = -1;
    var limit = Math.min(html.length, idx + 500000);
    for (var i = idx; i < limit; i++) {
      var ch = html.charAt(i);
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > idx) {
      try {
        var arr = JSON.parse(html.slice(idx, end + 1));
        if (Array.isArray(arr) && arr.length && typeof arr[0] === 'object') {
          var rows = mapJsonObjects(arr);
          if (rows.length) return rows;
        }
      } catch (e) {}
      idx = end + 1;
    } else {
      idx += 2;
    }
  }
  return null;
}

function mapJsonObjects(arr) {
  var rows = [];
  arr.forEach(function (o) {
    if (!o || typeof o !== 'object') return;
    var low = {};
    for (var k in o) low[String(k).toLowerCase().replace(/[\s_]/g, '')] = o[k];
    var merchant = low.name || low.dba || low.dbaname || low.merchant || low.merchantname || low.business || low.legalname;
    var volRaw = low.volume || low.vol || low.totalvolume || low.vtd || low.mtdvolume;
    if (!merchant || volRaw == null) return;
    var vol = typeof volRaw === 'number' ? volRaw : parseFloat(String(volRaw).replace(/[$,\s]/g, ''));
    if (!isFinite(vol)) return;
    rows.push({
      merchant: String(merchant).trim(),
      agent: titleCase(low.rep || low.repname || low.agent || low.agentname || low.owner || ''),
      volume: vol,
    });
  });
  return rows;
}

/** All <table> elements in the page, each as a 2D array of cell text. */
function tablesFromHtml(html) {
  var out = [];
  (html.match(/<table[\s\S]*?<\/table>/gi) || []).forEach(function (t) {
    var rows = [];
    (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).forEach(function (tr) {
      var cells = [];
      (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).forEach(function (td) {
        var text = td.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
          .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
        cells.push(text);
      });
      if (cells.length) rows.push(cells);
    });
    if (rows.length) out.push(rows);
  });
  return out;
}

/**
 * Picks the table that carries per-merchant volume data: headers mentioning
 * a volume column score highest, then merchant/DBA columns, then row count.
 * (The report page also has a per-rep summary table — this skips past it.)
 */
function pickDataTable(html) {
  var best = null, bestScore = -1;
  tablesFromHtml(html).forEach(function (rows) {
    if (rows.length < 2) return;
    var head = rows[0].join(' ').toLowerCase();
    var score = Math.min(rows.length, 50);
    if (/volume|vtd|mtd/.test(head)) score += 200;
    if (/dba|merchant|business|account/.test(head)) score += 100;
    if (score > bestScore) { bestScore = score; best = rows; }
  });
  return best;
}

/** Extracts the largest <table> in the page as a 2D array of cell text. */
function parseBiggestHtmlTable(html) {
  var best = null;
  var tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  tables.forEach(function (t) {
    var rows = [];
    (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).forEach(function (tr) {
      var cells = [];
      (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).forEach(function (td) {
        var text = td.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
          .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
        cells.push(text);
      });
      if (cells.length) rows.push(cells);
    });
    if (rows.length > 1 && (!best || rows.length > best.length)) best = rows;
  });
  return best;
}

/**
 * ONE-TIME BACKFILL: reconstructs WHEN each merchant actually crossed
 * $1K / $5K by querying the portal report month by month (Jan -> now) and
 * watching each merchant's cumulative volume. Past crossings land on the
 * last day of the month they happened in (the report filters by month, so
 * that's the finest history it can give); crossings in the current month
 * land on today, and from now on the daily sync stamps the exact day.
 *
 * SAFE TO RE-RUN: dates already recorded in the sheet — including manual
 * corrections via runDateCorrection() and day-accurate stamps from the
 * daily sync — are always kept; the backfill only FILLS IN missing dates
 * and adds merchants the sheet doesn't have yet.
 */
function backfillMilestones() {
  var now = new Date();
  var months = [];
  for (var m = 0; m <= now.getMonth(); m++) {
    months.push(now.getFullYear() + '-' + ('0' + (m + 1)).slice(-2));
  }
  var d1 = {}, d5 = {}, agents = {}, vols = {};
  for (var i = 0; i < months.length; i++) {
    var res = fetchPortal(months[i]);
    if (!res.ok) { Logger.log('Backfill stopped at %s: %s', months[i], res.error); return; }
    var isCurrent = i === months.length - 1;
    var dateFor = isCurrent ? fmt(now, 'yyyy-MM-dd') : lastDayOfMonth(months[i]);
    res.rows.forEach(function (r) {
      if (r.agent) agents[r.merchant] = r.agent;
      vols[r.merchant] = r.volume;
      if (!d1[r.merchant] && r.volume >= 1000) d1[r.merchant] = dateFor;
      if (!d5[r.merchant] && r.volume >= 5000) d5[r.merchant] = dateFor;
    });
    Logger.log('%s: %s merchants, cumulative', months[i], res.rows.length);
    Utilities.sleep(500);
  }
  var ss = getVolumeSpreadsheet(true);
  var sheet = ss.getSheetByName(VOLUME_SHEET) || ss.insertSheet(VOLUME_SHEET);
  // Existing recorded dates always win over backfill approximations.
  var prev = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getDisplayValues().forEach(function (r) {
      if (r[0]) prev[r[0]] = { d1k: r[3] || '', d5k: r[4] || '' };
    });
  }
  var stamp = fmt(now, 'yyyy-MM-dd HH:mm');
  var out = [['Merchant', 'Agent', 'Volume', 'Date1K', 'Date5K', 'UpdatedAt']];
  var n1 = 0, n5 = 0, kept = 0;
  Object.keys(vols).sort().forEach(function (mch) {
    var p = prev[mch] || {};
    var v1 = p.d1k || d1[mch] || '', v5 = p.d5k || d5[mch] || '';
    if (p.d1k || p.d5k) kept++;
    if (v1) n1++; if (v5) n5++;
    out.push([mch, agents[mch] || 'Unassigned', vols[mch], v1, v5, stamp]);
  });
  sheet.clearContents();
  var range = sheet.getRange(1, 1, out.length, 6);
  range.setNumberFormat('@');
  range.setValues(out);
  Logger.log('Backfill complete: %s merchants — %s with $1K dates, %s with $5K dates (%s kept their previously recorded dates).', out.length - 1, n1, n5, kept);
}

/** Lists agent names in the volume sheet that don't match the team roster.
 *  Business names are never used for attribution — rows carrying one show
 *  as Unassigned on the calendar; this report just makes them visible. */
function listVolumeAgents() {
  var rows = readVolumeSheet();
  if (!rows.length) { Logger.log('Volume sheet is empty — run syncVolumeDaily or backfillMilestones first.'); return; }
  var seen = {}, unknown = [];
  rows.forEach(function (r) {
    var a = String(r.agent || '').trim();
    if (!a || seen[a.toLowerCase()]) return;
    seen[a.toLowerCase()] = true;
    if (!inRoster(a)) unknown.push(a + '  (e.g. merchant: ' + r.merchant + ')');
  });
  Logger.log('Distinct agents in the volume sheet: %s', Object.keys(seen).length);
  Logger.log(unknown.length
    ? 'NOT on the roster (likely pay entities to map):\n' + unknown.join('\n')
    : 'All agent names match the roster.');
}

function lastDayOfMonth(ym) {
  var p = ym.split('-');
  return fmt(new Date(+p[0], +p[1], 0), 'yyyy-MM-dd');
}


// ─────────────── MILESTONE DATE IMPORT (2026 nonprocessing workbook) ───────────────
/**
 * Crossing dates derived from the "Team MAVERICK Nonprocessing Report 2026"
 * workbook: each merchant's $1K/$5K crossing is placed inside its real
 * processing window (installed -> last batch), proportional to the volume it
 * accrued. FILIPINO FUSION is pinned to 2026-08-18 per the actual pay stub.
 *
 * Run importMilestoneDates() ONCE. For these merchants the workbook is the
 * authority: their Date1K/Date5K are overwritten, and merchants missing from
 * the volume sheet are added. All other rows are left untouched. Every
 * connected calendar moves its payout events on the next refresh (tap the
 * refresh arrow to see it immediately).
 */
var MILESTONE_IMPORT = [
  {m:"28TH STREET PARTY STORE", a:"Jabe Schoenrock", v:1077, d1:"2026-06-22", d5:""},
  {m:"BALLPARK RV RESORT 2", a:"Haley Woodruff", v:7308, d1:"2026-08-13", d5:"2026-08-16"},
  {m:"BLAINE MOUNTAIN SALSA", a:"Timothy Constenius", v:53981, d1:"2026-06-24", d5:"2026-06-28"},
  {m:"BOTAS EL BANDIDO", a:"Jaden Dufek", v:1014, d1:"2026-08-17", d5:""},
  {m:"Ballpark RV Resort", a:"Haley Woodruff", v:1661, d1:"2026-08-15", d5:""},
  {m:"CAPITAL TRANSMISSIONS SERVICE CENTER", a:"Lloyd Cruz", v:30819, d1:"2026-06-25", d5:"2026-07-02"},
  {m:"CAR Specialists Inc", a:"Judah Steelman", v:35461, d1:"2026-07-11", d5:"2026-07-16"},
  {m:"CHANCY FISH CAMP", a:"Timothy Constenius", v:10812, d1:"2026-08-14", d5:"2026-08-16"},
  {m:"CLEARY'S AUTO", a:"Judah Steelman", v:91054, d1:"2026-06-18", d5:"2026-06-20"},
  {m:"CLUB 307 AMERICAN LEGION", a:"Kyle Pettit", v:7193, d1:"2026-08-09", d5:"2026-08-15"},
  {m:"ELITE AUTO SALES OF MT LLC", a:"Timothy Constenius", v:2294, d1:"2026-08-11", d5:""},
  {m:"EXPRESS TOWING", a:"Sadie Scoville", v:3242, d1:"2026-07-14", d5:""},
  {m:"FALCON METALS", a:"Timothy Constenius", v:1404, d1:"2026-07-25", d5:""},
  {m:"FILIPINO FUSION", a:"Jaden Defek", v:1349, d1:"2026-08-18", d5:""},
  {m:"FIX PHONE ZONE MJ", a:"Sadie Scoville", v:1639, d1:"2026-08-09", d5:""},
  {m:"Fix Phone Zone", a:"Sadie Scoville", v:13289, d1:"2026-06-28", d5:"2026-07-15"},
  {m:"Gettysburg Performance Gym", a:"Isaac Jenkins", v:73954, d1:"2026-06-23", d5:"2026-06-26"},
  {m:"H AND R AUTO REPAIR", a:"Jaden Dufek", v:84084, d1:"2026-06-09", d5:"2026-06-12"},
  {m:"HART JEWELERS LLC", a:"Timothy Constenius", v:40643, d1:"2026-06-25", d5:"2026-07-01"},
  {m:"HELPING HAND AUTO", a:"Jaden Dufek", v:12323, d1:"2026-07-29", d5:"2026-08-05"},
  {m:"HI SLIDERS 2 LLC", a:"Jason Coutcher", v:53706, d1:"2026-07-24", d5:"2026-07-26"},
  {m:"HOUSE OF BOOM", a:"Justin Woodruff", v:16525, d1:"2026-05-31", d5:"2026-06-09"},
  {m:"HOUSE OF BOOM 2", a:"Justin Woodruff", v:5639, d1:"2026-07-10", d5:"2026-07-10"},
  {m:"HOUSE OF INK", a:"Gabriel Craft", v:33112, d1:"2026-06-26", d5:"2026-07-02"},
  {m:"HUBCAP HEAVEN AND WHEELS", a:"Sadie Scoville", v:73368, d1:"2026-07-07", d5:"2026-07-09"},
  {m:"JAIMES AUTO SERVICE", a:"Judah Steelman", v:1012, d1:"2026-08-19", d5:""},
  {m:"JB's Country Store", a:"Walter Smith", v:58023, d1:"2026-06-26", d5:"2026-06-30"},
  {m:"JW TRANSMISSIONS", a:"Judah Steelman", v:1408, d1:"2026-08-10", d5:""},
  {m:"L & J COFFEE CO", a:"Jaden Dufek", v:1099, d1:"2026-08-03", d5:""},
  {m:"LUAU MOTORS", a:"Jason Coutcher", v:9544, d1:"2026-07-23", d5:"2026-08-03"},
  {m:"MALIBU BARBER SHOP", a:"Jaden Dufek", v:20983, d1:"2026-04-29", d5:"2026-05-21"},
  {m:"MALIBU CAR WASH", a:"Jaden Dufek", v:5303, d1:"2026-05-04", d5:"2026-05-04"},
  {m:"MAMA B'S JUBILEE", a:"Timothy Constenius", v:2179, d1:"2026-07-25", d5:""},
  {m:"MAMA JO'S FOOD TRUCK", a:"Timothy Constenius", v:1066, d1:"2026-08-18", d5:""},
  {m:"MARINA AUTO STEREO", a:"Judah Steelman", v:133038, d1:"2026-06-19", d5:"2026-06-21"},
  {m:"MIKES TOWING CA 2", a:"Judah Steelman", v:22615, d1:"2026-08-10", d5:"2026-08-11"},
  {m:"MIKES TOWING CA INC", a:"Judah Steelman", v:6413, d1:"2026-07-19", d5:"2026-08-10"},
  {m:"MISSOULA FIRE EQUIPMENT", a:"Timothy Constenius", v:20009, d1:"2026-07-25", d5:"2026-07-30"},
  {m:"OXNARD CAR REPAIR", a:"Jaden Dufek", v:25677, d1:"2026-05-25", d5:"2026-06-08"},
  {m:"OXNARD TIRES AND WHEELS", a:"Jaden Dufek", v:29687, d1:"2026-06-04", d5:"2026-06-14"},
  {m:"PALETERIA ARCOIRIS", a:"Gabriel Craft", v:65556, d1:"2026-05-19", d5:"2026-05-25"},
  {m:"PRIMOS AUTO INSURANCE SERVICES", a:"Lloyd Cruz", v:33269, d1:"2026-07-10", d5:"2026-07-15"},
  {m:"PRIMOS AUTO INSURANCE SERVICES 2", a:"Lloyd Cruz", v:19127, d1:"2026-07-22", d5:"2026-07-28"},
  {m:"PRIMOS AUTO INSURANCE SERVICES 3", a:"Lloyd Cruz", v:8416, d1:"2026-07-26", d5:"2026-08-08"},
  {m:"RANCHO CORDOVA AUTO DISMANTLING", a:"Lloyd Cruz", v:16525, d1:"2026-07-24", d5:"2026-07-30"},
  {m:"ROYAL TOBACCO", a:"Jaden Dufek", v:26971, d1:"2026-06-21", d5:"2026-06-30"},
  {m:"RUDY'S TIRE", a:"Jaden Dufek", v:3137, d1:"2026-06-21", d5:""},
  {m:"S & O CARIBBEAN GROCERY STORE", a:"Jaden Dufek", v:12454, d1:"2026-07-10", d5:"2026-07-24"},
  {m:"SOLIS AUTOMOTIVE", a:"Judah Steelman", v:16951, d1:"2026-07-11", d5:"2026-07-15"},
  {m:"SOLIS AUTOMOTIVE", a:"Judah Steelman", v:22540, d1:"2026-07-31", d5:"2026-08-03"},
  {m:"TARA INTERNATIONAL MARKET INC", a:"Sadie Scoville", v:4859, d1:"2026-07-08", d5:""},
  {m:"TIRE & WHEEL WORLD", a:"Judah Steelman", v:38812, d1:"2026-07-21", d5:"2026-07-24"},
  {m:"TRIPLE J TRUCK REPAIR & SERVICE", a:"Timothy Constenius", v:1937, d1:"2026-06-19", d5:""},
  {m:"TRUCKANICS SERVICE AND INSPECTIONS", a:"Judah Steelman", v:1328, d1:"2026-08-19", d5:""},
  {m:"WILD GEESE GARDENS", a:"Timothy Canstenivs", v:185492, d1:"2026-06-08", d5:"2026-06-10"},
  {m:"Z AUTO MUFFLER SHOP #1", a:"Gabriel Craft", v:2340, d1:"2026-08-12", d5:""}
];

function importMilestoneDates() {
  var ss = getVolumeSpreadsheet(true);
  var sheet = ss.getSheetByName(VOLUME_SHEET) || ss.insertSheet(VOLUME_SHEET);
  var data = [], byName = {};
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getDisplayValues().forEach(function (r) {
      if (r[0]) { data.push(r.slice()); byName[String(r[0]).trim().toLowerCase()] = data.length - 1; }
    });
  }
  var stamp = fmt(new Date(), 'yyyy-MM-dd HH:mm');
  var updated = 0, added = 0;
  MILESTONE_IMPORT.forEach(function (m) {
    var i = byName[m.m.trim().toLowerCase()];
    if (i != null) {
      if (m.d1) data[i][3] = m.d1;
      if (m.d5) data[i][4] = m.d5;
      data[i][5] = stamp; updated++;
    } else {
      data.push([m.m, m.a, String(m.v), m.d1 || '', m.d5 || '', stamp]); added++;
    }
  });
  var out = [['Merchant', 'Agent', 'Volume', 'Date1K', 'Date5K', 'UpdatedAt']].concat(data);
  sheet.clearContents();
  var range = sheet.getRange(1, 1, out.length, 6);
  range.setNumberFormat('@');
  range.setValues(out);
  Logger.log('Workbook milestone import done: %s merchants updated, %s added. Calendars move the payouts on their next refresh.', updated, added);
}

// ─────────────────────── TEXT REMINDERS ───────────────────────
/**
 * Texts you 10 minutes BEFORE and 10 minutes AFTER each appointment, with the
 * business name and the agent, using your carrier's free email-to-text
 * gateway — no SMS service or new accounts needed.
 *
 * TO TURN ON (survives every future re-paste of this file):
 *  1. Project Settings (gear icon) → Script properties → Add script property:
 *       Name:  REMINDER_SMS_EMAIL
 *       Value: your phone's email-to-text address, e.g.
 *         Verizon    5551234567@vtext.com
 *         T-Mobile   5551234567@tmomail.net
 *         Google Fi  5551234567@msg.fi.google.com
 *     TIP: put your normal EMAIL address there first and run reminderStatus()
 *     — if the email arrives, the pipeline works and you can switch the value
 *     to the carrier gateway. If the gateway then never texts, your carrier
 *     has likely retired email-to-text (AT&T has; others are spotty) — keep
 *     the email address instead.
 *  2. Optional: list agents in REMINDER_AGENTS below to only follow those
 *     reps. [] follows the whole team — that can be 50+ texts a day.
 *  3. Run reminderStatus() once — it reports the full setup (address, timer,
 *     timezone, today's readable appointments) and sends a test message.
 *
 * The every-5-minutes timer creates ITSELF within 15 minutes of pasting this
 * file (the appointment sync re-creates it if missing), so no setup run is
 * required. Times fire as written on the board, in this script's timezone
 * (Project Settings → Time zone — set it to your own). Rows without a
 * readable clock time are skipped. Each reminder sends at most once.
 */
var REMINDER_AGENTS = [];      // e.g. ['Justin Woodruff', 'Haley Woodruff']; [] = every agent
var REMINDER_BEFORE_MIN = 10;
var REMINDER_AFTER_MIN = 10;

/** The destination address lives in Script Properties so re-pasting this
 *  file never wipes it. */
function reminderAddress() {
  return (PropertiesService.getScriptProperties().getProperty('REMINDER_SMS_EMAIL') || '').trim();
}

/** Self-healing: called by the 15-min appointment sync, so the reminder
 *  timer exists even if setupAll was never re-run after a paste. */
function ensureReminderTrigger() {
  var has = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === 'sendApptReminders';
  });
  if (!has) {
    ScriptApp.newTrigger('sendApptReminders').timeBased().everyMinutes(5).create();
    Logger.log('Created the every-5-minutes text reminder trigger.');
  }
}

function sendApptReminders() {
  var addr = reminderAddress();
  var props = PropertiesService.getScriptProperties();
  var now = new Date();
  props.setProperty('REMINDERS_LAST_RUN', now.toISOString() + (addr ? '' : ' (no address set — idle)'));
  if (!addr) return;
  var today = fmt(now, 'yyyy-MM-dd');
  var sent;
  try { sent = JSON.parse(props.getProperty('REMINDERS_SENT') || '{}'); } catch (e) { sent = {}; }
  if (sent.day !== today) sent = { day: today, keys: {} };

  readCachedAppointments(today, today).forEach(function (a) {
    if (!a.title) return;
    var mins = parseClockTime(a.time);
    if (mins == null) return;
    if (REMINDER_AGENTS.length && !REMINDER_AGENTS.some(function (n) {
      return n.toLowerCase() === String(a.agent || '').trim().toLowerCase();
    })) return;
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, mins);
    [
      ['before', new Date(start.getTime() - REMINDER_BEFORE_MIN * 60000),
        'In ' + REMINDER_BEFORE_MIN + ' min: '],
      ['after', new Date(start.getTime() + REMINDER_AFTER_MIN * 60000),
        'Follow up: ']
    ].forEach(function (slot) {
      var key = slot[0] + '|' + a.time + '|' + a.title + '|' + a.agent;
      if (sent.keys[key]) return;
      var lateMs = now.getTime() - slot[1].getTime();
      // due now (catch up to 15 min if a cycle was missed; never text hours late)
      if (lateMs < 0 || lateMs > 15 * 60000) return;
      MailApp.sendEmail(addr, 'Team Maverick',
        slot[2] + a.title + ' - ' + (a.agent || 'unassigned') + ' (' + a.time + ')');
      sent.keys[key] = 1;
    });
  });
  props.setProperty('REMINDERS_SENT', JSON.stringify(sent));
}

/** '9:30 AM' / '1 PM' / '13:15' → minutes since midnight, or null. */
function parseClockTime(s) {
  var m = String(s || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|A|P)?\.?M?\.?$/i);
  if (!m) return null;
  var h = +m[1], mi = +(m[2] || 0), ap = (m[3] || '').charAt(0).toUpperCase();
  if (ap === 'P' && h < 12) h += 12;
  if (ap === 'A' && h === 12) h = 0;
  // Board convention: a bare 1–6 with no AM/PM is an afternoon appointment.
  if (!ap && h >= 1 && h <= 6) h += 12;
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** ONE-STOP CHECK: logs everything about the reminder setup and sends a test
 *  message. Run this whenever texts aren't arriving. */
function reminderStatus() {
  var props = PropertiesService.getScriptProperties();
  var addr = reminderAddress();
  var trig = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'sendApptReminders';
  }).length;
  Logger.log('Address (REMINDER_SMS_EMAIL script property): %s', addr || 'NOT SET — reminders are OFF. Add it under Project Settings → Script properties.');
  Logger.log('Every-5-min timer: %s', trig ? 'ACTIVE' : 'missing — creating it now.');
  if (!trig) ensureReminderTrigger();
  Logger.log('Script timezone: %s (appointment times fire in this zone — fix under Project Settings if wrong)', Session.getScriptTimeZone());
  Logger.log('Last reminder run: %s', props.getProperty('REMINDERS_LAST_RUN') || 'never (timer may be brand new)');
  var today = fmt(new Date(), 'yyyy-MM-dd');
  var appts = readCachedAppointments(today, today);
  var timed = appts.filter(function (a) { return a.title && parseClockTime(a.time) != null; });
  Logger.log('Today (%s): %s appointments in the cache, %s with a readable time.', today, appts.length, timed.length);
  timed.slice(0, 10).forEach(function (a) { Logger.log('  %s — %s (%s)', a.time, a.title, a.agent); });
  var ledger = props.getProperty('REMINDERS_SENT') || '(none)';
  Logger.log('Sent today so far: %s', ledger.length > 400 ? ledger.slice(0, 400) + '…' : ledger);
  if (addr) {
    MailApp.sendEmail(addr, 'Team Maverick',
      'Test: reminders are working. You will get a text 10 min before and after each appointment.');
    Logger.log('Test message sent to %s — it should arrive within a minute. If it never does, the address (or your carrier\'s email-to-text gateway) is the problem: try your plain email address as the property value.', addr);
  }
}

/** Kept for convenience: same test message as reminderStatus() sends. */
function testReminderText() { reminderStatus(); }

// ─────────────────────── SETUP & DIAGNOSTICS ───────────────────────

/** Run ONCE after pasting: creates the MerchantVolume tab + daily trigger. */
function setupAll() {
  var who = Session.getEffectiveUser().getEmail();
  var board;
  try {
    board = openBoard();
  } catch (e) {
    Logger.log('SETUP BLOCKED — ' + e.message);
    return;
  }
  Logger.log('Board access OK: "%s" (running as %s)', board.getName(), who);
  var vs = getVolumeSpreadsheet(true);
  Logger.log('Volume cache spreadsheet ready: %s', vs.getUrl());
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'syncVolumeDaily' || f === 'syncAppointments' || f === 'sendApptReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncVolumeDaily').timeBased().everyDays(1).atHour(11).create();
  PropertiesService.getScriptProperties().setProperty('VOL_TRIG_11AM', '1');
  ScriptApp.newTrigger('syncAppointments').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('sendApptReminders').timeBased().everyMinutes(5).create();
  Logger.log('Triggers scheduled: appointments every 15 min, volume daily at 11am, text reminders every 5 min.');
  if (!reminderAddress()) Logger.log('Text reminders are OFF until you add the REMINDER_SMS_EMAIL script property (see the TEXT REMINDERS section).');
  Logger.log('Running the first appointment sync now (can take a minute)...');
  syncAppointments();
  Logger.log('Setup complete.');
}

/** Check the board parser: logs how many Maverick appointments were found. */
function testBoard() {
  var from = fmt(addDays(new Date(), -30), 'yyyy-MM-dd');
  var to = fmt(addDays(new Date(), 60), 'yyyy-MM-dd');
  var evs = readBoardAppointments(from, to);
  Logger.log('Parsed %s Team Maverick appointments between %s and %s', evs.length, from, to);
  evs.slice(0, 8).forEach(function (e) { Logger.log(JSON.stringify(e)); });
  var tabs = openBoard().getSheets().map(function (s) {
    var d = parseTabDate(s.getName());
    return s.getName() + ' -> ' + (d ? fmt(d, 'yyyy-MM-dd') : 'skipped (not a date)');
  });
  Logger.log('Tabs: \n' + tabs.join('\n'));
}

/**
 * DEEP portal diagnostic: dumps EVERY table on the report page (headers,
 * row counts, first data row) and every link that looks like a report or
 * merchant drill-down. Run this and send the whole log — it tells us where
 * the per-merchant volume data lives so the fetch can be pointed at it.
 */
function testPortalDeep() {
  var cookie = PropertiesService.getScriptProperties().getProperty('PORTAL_COOKIE');
  if (!cookie) { Logger.log('PORTAL_COOKIE script property is not set.'); return; }
  var now = new Date();
  var url = PORTAL_URL + '?dtFrom=' + now.getFullYear() + '-01&dtTo=' + fmt(now, 'yyyy-MM') +
    '&apprFrom=&apprTo=&team=' + PORTAL_TEAM + '&p=ALL&proc=ALL';
  var res = UrlFetchApp.fetch(url, {
    headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    muteHttpExceptions: true, followRedirects: true,
  });
  var html = res.getContentText();
  Logger.log('HTTP %s, %s chars', res.getResponseCode(), html.length);

  var tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  Logger.log('%s <table> elements found', tables.length);
  tables.forEach(function (t, i) {
    var rows = [];
    (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).forEach(function (tr) {
      var cells = [];
      (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).forEach(function (td) {
        cells.push(td.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
      });
      if (cells.length) rows.push(cells);
    });
    if (!rows.length) return;
    Logger.log('--- table %s: %s rows ---', i, rows.length);
    Logger.log('   headers: %s', rows[0].join(' | '));
    if (rows[1]) Logger.log('   row 1:   %s', rows[1].join(' | '));
    if (rows[2]) Logger.log('   row 2:   %s', rows[2].join(' | '));
  });

  var seen = {}, links = [];
  (html.match(/href\s*=\s*"([^"]+)"/gi) || []).forEach(function (h) {
    var u = h.replace(/^href\s*=\s*"/i, '').replace(/"$/, '');
    if (!/report|merchant|volume|detail|export|csv|rep=/i.test(u)) return;
    if (seen[u]) return; seen[u] = true;
    links.push(u);
  });
  Logger.log('%s candidate links:', links.length);
  links.slice(0, 30).forEach(function (u) { Logger.log('   %s', u); });

  // Data often arrives via a JSON/AJAX call instead of the HTML — look for endpoints in scripts
  var apiHits = {};
  (html.match(/["'](\/[A-Za-z0-9_\/.-]*(?:api|json|data|ajax|report)[A-Za-z0-9_\/.?&=-]*)["']/gi) || []).forEach(function (m) {
    var u = m.slice(1, -1);
    if (!apiHits[u]) { apiHits[u] = true; }
  });
  var apis = Object.keys(apiHits);
  Logger.log('%s script-referenced endpoints:', apis.length);
  apis.slice(0, 20).forEach(function (u) { Logger.log('   %s', u); });
}

/** Check the portal fetch: logs status + parsed sample. Send me this log if it fails. */
function testPortal() {
  var res = fetchPortal();
  if (!res.ok) { Logger.log('PORTAL ERROR: ' + res.error); return; }
  Logger.log('Portal OK — %s merchants. First rows:', res.rows.length);
  res.rows.slice(0, 5).forEach(function (r) { Logger.log(JSON.stringify(r)); });
}

// ─────────────────────────── helpers ───────────────────────────
function fmt(d, pattern) { return Utilities.formatDate(d, Session.getScriptTimeZone(), pattern); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
