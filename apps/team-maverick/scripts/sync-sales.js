const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

var _rawUrl = (process.env.SALES_URL || 'https://sales.wholesalepayments.org').trim();
if (!/^https?:\/\//i.test(_rawUrl)) _rawUrl = 'https://' + _rawUrl;
const SALES_URL = _rawUrl;
const SALES_COOKIE = (process.env.SALES_COOKIE || '').replace(/[\r\n]+/g, '').trim();
const TEAM = (process.env.SALES_TEAM || 'MAVERICK').trim();
const INDEX_PATH = path.join(__dirname, '..', 'index.html');

const SUPA_URL = 'https://xeevmevxjuawskugedds.supabase.co';
// Backend writes prefer the service_role key, supplied as a GitHub Actions
// secret (SUPABASE_SERVICE_KEY) so it never ships to the browser. This lets
// the database deny WRITES from the public anon key — only this trusted job
// and authenticated dashboard actions can change data. Falls back to the
// public anon key when the secret isn't set, so the sync keeps working
// during the transition.
const SUPA_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlZXZtZXZ4anVhd3NrdWdlZGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODU1NzQsImV4cCI6MjA5NzU2MTU3NH0.-it_zqeDlzybZ1GL4swcWTL_MmhGnNG971i_x_burIw').trim();

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ── Fetch a page (authenticated via SALES_COOKIE) ──────────────────
async function fetchPage(url, opts) {
  opts = opts || {};
  if (!opts.quiet) console.log('Fetching', url);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  if (SALES_COOKIE) headers['Cookie'] = SALES_COOKIE;
  // Abort a hung connection so one stuck request can't stall the whole job.
  const ac = new AbortController();
  const timer = setTimeout(function () { ac.abort(); }, opts.timeout || 15000);
  try {
    const res = await fetch(url, { headers: headers, redirect: 'follow', signal: ac.signal });
    if (!res.ok) {
      const err = new Error('Fetch failed: ' + res.status + ' ' + res.statusText);
      err.isFetchError = true;
      throw err;
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Only http/https/mailto/tel hrefs may survive scraping → DOM ────
// Blocks javascript:/data:/vbscript: schemes at the source so they can
// never be persisted and later rendered into an <a href> (stored XSS).
function safeScrapedHref(href, origin) {
  if (!href) return null;
  let abs;
  try { abs = new URL(href, origin).href; } catch (e) { return null; }
  return /^(https?:|mailto:|tel:)/i.test(abs) ? abs : null;
}

// ── Is this the login page (auth failed / cookie expired)? ─────────
function isLoginPage($) {
  return /^log\s*in$/i.test($('title').text().trim()) ||
    /Welcome back/i.test($('h2').first().text());
}

// ── Normalise a header label to a lookup key ───────────────────────
function hkey(s) {
  return (s || '').trim().toLowerCase().replace(/[\s_]+/g, '');
}

// ── Parse the MAVERICK rep table from RankingsByRep ────────────────
// Columns: Rank | Rep | Team | Deals | Volume | Approved | Processing
//          | NotProcessing | ProcessingRatio
function parseTeamReps(html) {
  const $ = cheerio.load(html);
  const reps = [];

  $('table').each(function () {
    // Headers from the FIRST header row only (the table also has a
    // totals row inside thead which we must not fold into the keys).
    let headerRow = $(this).find('thead tr').first();
    if (!headerRow.length) headerRow = $(this).find('tr').first();
    const headers = [];
    headerRow.find('th, td').each(function () { headers.push(hkey($(this).text())); });
    const hj = headers.join('|');
    if (!/rep/.test(hj) || !/approved/.test(hj)) return; // not the rep table

    $(this).find('tbody tr').each(function () {
      const cells = [];
      $(this).find('td').each(function () { cells.push($(this).text().trim()); });
      if (!cells.length) return;

      const row = {};
      headers.forEach(function (h, i) { row[h] = cells[i] || ''; });

      const rep = (row['rep'] || '').trim();
      if (!rep || /^total$/i.test((cells[0] || '').trim())) return;      // totals/blank row
      if (row['team'] && !new RegExp(TEAM, 'i').test(row['team'])) return; // safety filter

      const num = function (v) { return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0; };
      const approved = num(row['approved']);
      const proc = num(row['processing']);
      let notProc = row['notprocessing'] !== '' ? num(row['notprocessing']) : (approved - proc);
      if (approved === 0 && proc === 0 && notProc === 0) return;          // empty rep

      const ratioNum = approved > 0 ? Math.round((proc / approved) * 1000) / 10 : 0;
      reps.push({ rep: titleCaseRep(rep), approved: approved, proc: proc, not: notProc, ratioNum: ratioNum });
    });
  });

  // The dashboard ranks reps by approved deals (desc), stable on ties.
  reps.sort(function (a, b) { return b.approved - a.approved; });

  return reps.map(function (r, i) {
    const cat = r.ratioNum >= 100 ? 'Fully Processing'
      : (r.ratioNum > 0 ? 'Partially Processing' : 'Not Processing');
    const catColor = r.ratioNum >= 100 ? 'green' : (r.ratioNum > 0 ? 'yellow' : 'red');
    let priority = r.approved >= 5 ? 'High' : (r.approved >= 3 ? 'Medium' : 'Low');
    if (r.ratioNum >= 100) priority = 'None';
    return {
      rank: i + 1,
      rep: r.rep,
      approved: r.approved,
      proc: r.proc,
      not: r.not,
      ratio: r.ratioNum.toFixed(1) + '%',
      ratioNum: r.ratioNum,
      cat: cat,
      catColor: catColor,
      priority: priority,
    };
  });
}

// ── Totals are the column sums across the team's reps ──────────────
function computeTotals(reps) {
  let approved = 0, proc = 0;
  reps.forEach(function (r) { approved += r.approved; proc += r.proc; });
  const not = approved - proc;
  const ratio = approved > 0 ? Math.round((proc / approved) * 1000) / 10 : 0;
  return { approved: approved, proc: proc, not: not, ratio: ratio };
}

// ── Team rank from the /Rankings "Top Managers" table ──────────────
function parseTeamRank(html, teamName) {
  const $ = cheerio.load(html);
  let result = null;

  $('table').each(function () {
    const headers = [];
    $(this).find('thead tr').first().find('th, td').each(function () { headers.push(hkey($(this).text())); });
    const teamIdx = headers.findIndex(function (h) { return /team/.test(h); });
    const rankIdx = headers.findIndex(function (h) { return /rank/.test(h); });
    if (teamIdx < 0 || rankIdx < 0) return; // not the team-ranking table

    const rows = $(this).find('tbody tr');
    let found = null;
    rows.each(function () {
      const cells = [];
      $(this).find('td').each(function () { cells.push($(this).text().trim()); });
      const team = (cells[teamIdx] || '').trim();
      if (new RegExp('^' + teamName + '$', 'i').test(team)) {
        found = parseInt(String(cells[rankIdx] || '').replace(/[^0-9]/g, ''), 10) || null;
      }
    });
    if (found) result = { rank: found, of: rows.length };
  });

  return result;
}

// ── Read existing DATA from index.html ─────────────────────────────
function readExistingData() {
  const content = fs.readFileSync(INDEX_PATH, 'utf8');
  const match = content.match(/var DATA = (\{[\s\S]*?\});\s*\n/);
  if (!match) throw new Error('Could not locate DATA object in index.html');
  const pendedMatch = content.match(/var PENDED_DEALS = (\[[\s\S]*?\]);\s*\n/);
  const pended = pendedMatch ? JSON.parse(pendedMatch[1]) : [];
  return { content: content, data: JSON.parse(match[1]), raw: match[0], pended: pended, pendedRaw: pendedMatch ? pendedMatch[0] : null };
}

// ── Merge: update reps/totals/teamRank for the month, keep the rest ─
function mergeData(existing, incoming) {
  const merged = JSON.parse(JSON.stringify(existing));
  for (const month of Object.keys(incoming)) {
    if (!merged[month]) { merged[month] = incoming[month]; continue; }

    if (incoming[month].reps && incoming[month].reps.length) {
      const newReps = incoming[month].reps;
      const haveName = {};
      newReps.forEach(function (r) { haveName[r.rep.toLowerCase()] = true; });
      // Preserve any manually-added reps the source doesn't know about.
      const extras = (merged[month].reps || []).filter(function (r) {
        return !haveName[(r.rep || '').toLowerCase()];
      });
      merged[month].reps = newReps.concat(extras);
    }
    if (incoming[month].totals) merged[month].totals = incoming[month].totals;
    if (incoming[month].teamRank) merged[month].teamRank = incoming[month].teamRank;
  }
  return merged;
}

// ── Build the "Data synced …" stamp in US Central time ─────────────
// e.g. "Data synced Jun 24, 2026 · 7:56 AM CT". The runner clock is UTC,
// so format explicitly in America/Chicago regardless of where this runs.
function currentStamp() {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const p = {};
  fmt.formatToParts(new Date()).forEach(function (part) { p[part.type] = part.value; });
  return 'Data synced ' + p.month + ' ' + p.day + ', ' + p.year +
    ' · ' + p.hour + ':' + p.minute + ' ' + p.dayPeriod + ' CT';
}

// ── Write updated DATA back into index.html ────────────────────────
function writeUpdatedData(content, rawMatch, merged, pendedDeals, pendedRaw) {
  const replacement = 'var DATA = ' + JSON.stringify(merged) + ';\n';
  let updated = content.replace(rawMatch, replacement);
  if (pendedDeals && pendedRaw) {
    updated = updated.replace(pendedRaw, 'var PENDED_DEALS = ' + JSON.stringify(pendedDeals) + ';\n');
  }
  updated = updated.replace(
    /(<span id="synced-stamp"[^>]*>)[^<]*(<\/span>)/,
    '$1' + currentStamp() + '$2'
  );
  fs.writeFileSync(INDEX_PATH, updated, 'utf8');
}

// ── Merchant name normaliser for matching across data sources ──────
function normName(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

// ── Title-case a rep name so deals match the rankings convention ────
// The volume report returns rep names in UPPERCASE ("JADEN DUFEK") while
// the rankings report uses Title Case ("Jaden Dufek"). Storing both the
// same way keeps the dashboard's rep→volume matching exact and the UI
// consistent.
const REP_ALIASES = {
  'TIMOTHY CANSTENIVS': 'Timothy Constenius',
};

function titleCaseRep(s) {
  const upper = String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (REP_ALIASES[upper]) return REP_ALIASES[upper];
  return String(s || '').toLowerCase()
    .replace(/\b([a-z])/g, function (m, c) { return c.toUpperCase(); })
    .replace(/\s+/g, ' ').trim();
}

// ── Tier from volume + transaction count (mirrors the dashboard) ───
function assignTier(volN, txn) {
  if (txn >= 11 && volN >= 5000) return 'White';
  if (txn >= 6 && volN >= 1000) return 'Green';
  if (txn >= 1 || volN > 0) return 'Yellow';
  return 'Red';
}

// ── Parse the team Volume report's Merchants table ──────────────────
// /reports/volumeavg?dt=YYYY-MM&team=TEAM&proc=ALL has a per-merchant
// table with columns: Rep | MID | Merchant | Volume | Txn Count.
// Returns { normalizedName → {name, rep, mid, volN, txn} } so callers
// can both update existing deals AND create new ones.
function parseTeamMerchantVolumes(html) {
  const $ = cheerio.load(html);
  const map = {};

  $('table').each(function () {
    const headers = [];
    let headerRow = $(this).find('thead tr').first();
    if (!headerRow.length) headerRow = $(this).find('tr').first();
    headerRow.find('th, td').each(function () { headers.push(hkey($(this).text())); });

    const merchIdx = headers.findIndex(function (h) { return /merchant/.test(h); });
    const volIdx = headers.findIndex(function (h) { return /volume/.test(h); });
    const txnIdx = headers.findIndex(function (h) { return /txn|count|trans/.test(h); });
    const repIdx = headers.findIndex(function (h) { return h === 'rep'; });
    const midIdx = headers.findIndex(function (h) { return h === 'mid'; });
    if (merchIdx < 0 || volIdx < 0) return;

    $(this).find('tbody tr').each(function () {
      const cells = [];
      $(this).find('td').each(function () { cells.push($(this).text().trim()); });
      const name = (cells[merchIdx] || '').trim();
      if (!name || /^total$/i.test(name)) return;
      const volN = parseInt(String(cells[volIdx] || '').replace(/[^0-9]/g, ''), 10) || 0;
      const txn = txnIdx >= 0 ? (parseInt(String(cells[txnIdx] || '').replace(/[^0-9]/g, ''), 10) || 0) : 0;
      const rep = repIdx >= 0 ? titleCaseRep(cells[repIdx] || '') : '';
      const mid = midIdx >= 0 ? (cells[midIdx] || '').trim() : '';
      map[normName(name)] = { name: name, rep: rep, mid: mid, volN: volN, txn: txn };
    });
  });

  return map;
}

// ── Update vol/volN/txn on existing deals AND add new merchants ─────
async function updateDealsVolume(origin, monthData, dt) {
  if (!monthData) return 0;
  if (!Array.isArray(monthData.deals)) monthData.deals = [];

  let html;
  try {
    html = await fetchPage(origin + '/reports/volumeavg?dt=' + dt + '&team=' + encodeURIComponent(TEAM) + '&proc=ALL');
  } catch (e) {
    console.log('  Could not fetch team volume report:', e.message || e);
    return 0;
  }
  const vols = parseTeamMerchantVolumes(html);
  if (!Object.keys(vols).length) {
    console.log('  No merchant volumes parsed from the volume report — keeping curated values.');
    return 0;
  }

  // Index existing deals by normalised name for fast lookup.
  const dealByName = {};
  monthData.deals.forEach(function (d) { dealByName[normName(d.name)] = d; });

  let updated = 0, added = 0;

  // Update every existing deal that has a match in the report.
  for (const deal of monthData.deals) {
    const v = vols[normName(deal.name)];
    if (!v) continue;
    if (v.volN <= 0 && v.txn <= 0) continue;

    const vol = '$' + v.volN.toLocaleString('en-US');
    if (deal.volN !== v.volN || deal.txn !== v.txn || deal.vol !== vol) {
      updated++;
      console.log('    ✎ ' + deal.name + ': ' + (deal.vol || '$0') + '/' + (deal.txn || 0) +
        ' → ' + vol + '/' + v.txn);
    }
    deal.volN = v.volN;
    deal.vol = vol;
    deal.txn = v.txn;
    if (v.rep) deal.rep = v.rep;
    if (v.mid && !deal.mid) deal.mid = v.mid;
    deal.proc = 'Yes';
    deal.status = 'Processing';
    deal.tier = assignTier(v.volN, v.txn);
  }

  // Add merchants from the report that aren't already in the deals list.
  for (const nk of Object.keys(vols)) {
    if (dealByName[nk]) continue;
    const v = vols[nk];
    const vol = '$' + v.volN.toLocaleString('en-US');
    const isProc = v.volN > 0 || v.txn > 0;
    const newDeal = {
      rep: v.rep || 'Unknown',
      name: v.name,
      vip: '',
      vol: vol,
      volN: v.volN,
      txn: v.txn,
      mid: v.mid || '',
      proc: isProc ? 'Yes' : 'No',
      status: isProc ? 'Processing' : 'Approved',
      tier: assignTier(v.volN, v.txn),
    };
    monthData.deals.push(newDeal);
    added++;
    console.log('    + ' + v.name + ' (rep: ' + (v.rep || '?') + ', vol: ' + vol + ', txn: ' + v.txn + ')');
  }

  // Recompute tier breakdown.
  const tiers = { White: 0, Green: 0, Yellow: 0, Red: 0 };
  monthData.deals.forEach(function (d) { if (tiers.hasOwnProperty(d.tier)) tiers[d.tier]++; });
  monthData.tiers = tiers;
  return updated + added;
}

// ── Parse the all-merchants report (/reports/nonprocessing) ───────
// This report lists EVERY merchant for the date range — approved,
// delivered, processing, and not-processing — so it's the authoritative
// source for the full deals list.  The volume report only covers
// merchants that have transaction volume.
function parseAllMerchants(html) {
  const $ = cheerio.load(html);
  const merchants = [];

  $('table').each(function () {
    let headerRow = $(this).find('thead tr').first();
    if (!headerRow.length) headerRow = $(this).find('tr').first();
    const headers = [];
    headerRow.find('th, td').each(function () { headers.push(hkey($(this).text())); });

    const nameIdx  = headers.findIndex(function (h) { return h === 'name' || /merchant|dba/.test(h); });
    const repIdx   = headers.findIndex(function (h) { return h === 'rep'; });
    const midIdx   = headers.findIndex(function (h) { return h === 'mid'; });
    const volIdx   = headers.findIndex(function (h) { return /volume/.test(h); });
    const txnIdx   = headers.findIndex(function (h) { return /txn|count|trans/.test(h); });
    const procIdx  = headers.findIndex(function (h) { return /processing/.test(h); });
    const ownerIdx = headers.findIndex(function (h) { return /owner|principal|contact/.test(h); });
    const phoneIdx = headers.findIndex(function (h) { return /phone/.test(h); });
    const emailIdx = headers.findIndex(function (h) { return /email/.test(h); });
    const equipIdx = headers.findIndex(function (h) { return /equip/.test(h); });
    if (nameIdx < 0 || repIdx < 0) return;

    $(this).find('tbody tr').each(function () {
      const cells = [];
      $(this).find('td').each(function () { cells.push($(this).text().trim()); });
      const name = (cells[nameIdx] || '').trim();
      if (!name || /^total$/i.test(name)) return;

      const num = function (v) { return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0; };
      const rep   = titleCaseRep(cells[repIdx] || '');
      const mid   = midIdx >= 0 ? (cells[midIdx] || '').trim() : '';
      const volN  = volIdx >= 0 ? num(cells[volIdx]) : 0;
      const txn   = txnIdx >= 0 ? num(cells[txnIdx]) : 0;
      const procRaw = procIdx >= 0 ? (cells[procIdx] || '').trim() : '';
      const isProc  = /yes/i.test(procRaw);
      const owner = ownerIdx >= 0 ? (cells[ownerIdx] || '').trim() : '';
      const phone = phoneIdx >= 0 ? (cells[phoneIdx] || '').trim() : '';
      const email = emailIdx >= 0 ? (cells[emailIdx] || '').trim() : '';
      const equip = equipIdx >= 0 ? (cells[equipIdx] || '').trim() : '';

      merchants.push({ rep: rep, name: name, mid: mid, volN: volN, txn: txn, isProc: isProc,
        owner: owner, phone: phone, email: email, equip: equip });
    });
  });

  return merchants;
}

// ── Fetch all merchants and sync into the deals list ──────────────
// Corrects rep assignments and merchant names from the portal, and
// adds any new merchants that weren't in the curated list.
async function syncAllMerchants(origin, monthData, dt) {
  if (!monthData) return 0;
  if (!Array.isArray(monthData.deals)) monthData.deals = [];

  let html;
  try {
    html = await fetchPage(origin + '/reports/nonprocessing?dtFrom=' + dt + '&dtTo=' + dt +
      '&appFrom=&appTo=&team=' + encodeURIComponent(TEAM) + '&p=ALL&proc=ALL');
  } catch (e) {
    console.log('  Could not fetch all-merchants report:', e.message || e);
    return 0;
  }
  if (isLoginPage(cheerio.load(html))) return 0;

  const merchants = parseAllMerchants(html);
  if (!merchants.length) {
    console.log('  No merchants parsed from all-merchants report.');
    return 0;
  }

  const dealByName = {};
  const dealByMid = {};
  monthData.deals.forEach(function (d) {
    dealByName[normName(d.name)] = d;
    if (d.mid) dealByMid[String(d.mid)] = d;
  });

  let updated = 0, added = 0;

  for (const m of merchants) {
    const nk = normName(m.name);
    // Match by MID first so a re-spelled / re-cased name can't create a
    // duplicate row for a merchant that already exists.
    const existing = (m.mid && dealByMid[String(m.mid)]) || dealByName[nk];

    if (existing) {
      let changed = false;
      if (m.rep && existing.rep !== m.rep) {
        console.log('    ⟳ ' + existing.name + ': rep ' + existing.rep + ' → ' + m.rep);
        existing.rep = m.rep;
        changed = true;
      }
      if (existing.name !== m.name) {
        console.log('    ⟳ name "' + existing.name + '" → "' + m.name + '"');
        existing.name = m.name;
        changed = true;
      }
      if (m.mid && !existing.mid) existing.mid = m.mid;
      if (m.owner && !existing.owner) existing.owner = m.owner;
      if (m.phone && !existing.phone) existing.phone = m.phone;
      if (m.email && !existing.email) existing.email = m.email;
      if (m.equip && !existing.equip) existing.equip = m.equip;
      // Keep both indexes pointing at this deal after any rename/MID fill.
      if (existing.mid) dealByMid[String(existing.mid)] = existing;
      dealByName[normName(existing.name)] = existing;
      if (changed) updated++;
    } else {
      const vol = '$' + m.volN.toLocaleString('en-US');
      const newDeal = {
        rep: m.rep || 'Unknown',
        name: m.name,
        mid: m.mid || '',
        vip: '',
        vol: vol,
        volN: m.volN,
        txn: m.txn,
        proc: m.isProc ? 'Yes' : 'No',
        status: m.isProc ? 'Processing' : 'Approved',
        tier: assignTier(m.volN, m.txn),
      };
      if (m.owner) newDeal.owner = m.owner;
      if (m.phone) newDeal.phone = m.phone;
      if (m.email) newDeal.email = m.email;
      if (m.equip) newDeal.equip = m.equip;
      monthData.deals.push(newDeal);
      dealByName[nk] = newDeal;
      if (newDeal.mid) dealByMid[String(newDeal.mid)] = newDeal;
      added++;
      console.log('    + ' + m.name + ' (rep: ' + (m.rep || '?') + ')');
    }
  }

  return updated + added;
}

// ── Collapse duplicate deals within a month ────────────────────────
// Two rows for the same merchant (same MID, or same normalized name when
// no MID) get merged into the best one — processing beats not-processing,
// then higher volume. Tiers are recomputed so per-month counts stay honest.
function collapseDuplicateDeals(monthData) {
  if (!monthData || !Array.isArray(monthData.deals)) return 0;
  const best = {};
  const order = [];
  let removed = 0;
  monthData.deals.forEach(function (d) {
    const key = d.mid ? ('MID:' + String(d.mid)) : ('NM:' + normName(d.name));
    const cur = best[key];
    if (!cur) { best[key] = d; order.push(key); return; }
    const dProc = d.proc === 'Yes', cProc = cur.proc === 'Yes';
    const better = (dProc && !cProc) || (dProc === cProc && (d.volN || 0) > (cur.volN || 0));
    if (better) best[key] = d;
    removed++;
  });
  if (removed > 0) {
    monthData.deals = order.map(function (k) { return best[k]; });
    const tiers = { White: 0, Green: 0, Yellow: 0, Red: 0 };
    monthData.deals.forEach(function (d) { if (tiers.hasOwnProperty(d.tier)) tiers[d.tier]++; });
    monthData.tiers = tiers;
  }
  return removed;
}

// ── Build a list of {dt, monthKey} from START through current month ──
function monthRange() {
  const START_YEAR = 2026;
  const START_MONTH = 3; // March — earliest month requested
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const months = [];
  let y = START_YEAR, m = START_MONTH;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({
      dt: y + '-' + String(m).padStart(2, '0'),
      monthKey: MONTH_NAMES[m - 1] + ' ' + y,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ── Publish merged rankings to Supabase app_settings ──────────────
async function publishToSupabase(data) {
  const body = JSON.stringify({
    key: 'rankings_data',
    value: data,
    updated_at: new Date().toISOString(),
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(SUPA_URL + '/rest/v1/app_settings', {
        method: 'POST',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: body,
      });
      if (res.ok) {
        console.log('✓ Published rankings_data to Supabase');
        return;
      }
      const text = await res.text();
      console.log('⚠ Supabase publish attempt ' + attempt + '/3 failed (' + res.status + '):', text);
    } catch (e) {
      console.log('⚠ Supabase publish attempt ' + attempt + '/3 error:', e.message || e);
    }
    if (attempt < 3) await new Promise(function (r) { setTimeout(r, attempt * 2000); });
  }
  console.log('⚠ Supabase publish failed after 3 attempts — data saved to index.html only');
}

// ── Generic table parser for the detail handler fragments ──────────
// Deposits / Authorizations / Statements come back as Tabler tables. We
// don't hard-code their columns — we capture whatever headers + rows the
// fragment returns, plus any per-row links (statement downloads), so the
// dashboard can render them faithfully without knowing the exact markup.
function parseAllTables($, origin) {
  const out = [];
  $('table').each(function () {
    const $t = $(this);
    const headers = [];
    let hr = $t.find('thead tr').first();
    if (!hr.length) hr = $t.find('tr').first();
    hr.find('th, td').each(function () { headers.push($(this).text().replace(/\s+/g, ' ').trim()); });

    const rows = [];
    const cellLinks = [];
    let bodyRows = $t.find('tbody tr');
    if (!bodyRows.length) bodyRows = $t.find('tr').slice(1); // no thead — skip header row
    bodyRows.each(function () {
      const cells = [];
      const links = [];
      $(this).find('td, th').each(function () {
        cells.push($(this).text().replace(/\s+/g, ' ').trim());
        // First SAFE link in THIS cell, kept positionally aligned to the
        // cell index so the client never has to text-match links to cells.
        const a = $(this).find('a[href]').first();
        links.push(a.length ? safeScrapedHref(a.attr('href'), origin) : null);
      });
      if (!cells.some(function (c) { return c; })) return; // blank row
      rows.push(cells);
      cellLinks.push(links);
    });
    if (headers.length || rows.length) out.push({ headers: headers, rows: rows, cellLinks: cellLinks });
  });
  return out;
}

// ── Fetch one of the detail tabs (Deposits/Authorizations/Statements) ─
async function fetchMerchantHandler(origin, mid, handler) {
  try {
    const html = await fetchPage(origin + '/merchants/detail/' + encodeURIComponent(mid) + '?handler=' + handler, { quiet: true });
    const $ = cheerio.load(html);
    if (isLoginPage($)) return null; // cookie expired — don't store a login form as "data"
    let label = '';
    const h = $('h1, h2, h3, h4').first().text().trim();
    if (h) label = h.replace(/\s+/g, ' ');
    return { label: label, tables: parseAllTables($, origin) };
  } catch (e) {
    return null; // tab unavailable for this merchant — render falls back gracefully
  }
}

// ── Fetch a merchant's full detail (metrics + contact + 3 tabs) ────
async function fetchMerchantDetail(origin, mid, name) {
  const html = await fetchPage(origin + '/merchants/detail/' + encodeURIComponent(mid), { quiet: true });
  const $ = cheerio.load(html);
  if (isLoginPage($)) { const e = new Error('login page (cookie expired)'); e.isLogin = true; throw e; }

  // Metrics JSON is embedded on the page — reliable, powers the cards + charts
  let metrics = null;
  const rawMetrics = $('#merchant-metrics').attr('data-metrics');
  if (rawMetrics) {
    try { metrics = JSON.parse(rawMetrics); }
    catch (e) { console.log('  ⚠ ' + mid + ': data-metrics present but unparseable — portal format may have changed'); }
  }

  // Join an element's child text with spaces so adjacent inline spans
  // (e.g. a status badge + its date) don't run together ("Approved6/17/26").
  const nodeText = function (el) {
    const parts = [];
    $(el).contents().each(function () {
      const t = this.type === 'text' ? this.data : $(this).text();
      if (t && t.trim()) parts.push(t.trim());
    });
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };

  // Scope all contact/info parsing to the left detail card so the metric
  // cards (.col-md-4) and the deposits/tabs card (.col-lg-8) — which also
  // contain .col-6 / .mb-2 / links — can't pollute these fields.
  let $card = $('.col-lg-4 .card-body').first();
  if (!$card.length) $card = $.root();

  // Info card: label/value pairs (MID, Processor, SIC/MCC, Status…)
  const info = {};
  $card.find('.col-6').each(function () {
    const label = $(this).find('.text-muted.small').first().text().trim();
    const valEl = $(this).find('.fw-medium').first();
    const value = valEl.length ? nodeText(valEl) : '';
    if (label && value) info[label] = value;
  });

  // Contact: email + address come from links; owner + phone are text rows.
  // Exclude .card-title so the "Contact"/"Sales Team" headings aren't read
  // as the owner name.
  const email = $card.find('a[href^="mailto:"]').first().text().trim();
  const address = $card.find('a[href*="maps"]').first().text().replace(/\s+/g, ' ').trim();
  let owner = '', phone = '';
  $card.find('.mb-2').each(function () {
    if ($(this).hasClass('card-title')) return;      // skip section headings
    if ($(this).find('a').length) return;            // skip email/address rows
    const txt = $(this).text().replace(/\s+/g, ' ').trim();
    if (!txt) return;
    if (!phone && /\d[\d\s().-]{6,}/.test(txt)) phone = txt;
    else if (!owner && /[a-z]/i.test(txt)) owner = txt;
  });

  // Sales team: GM / SM / Rep label-value rows
  const salesTeam = {};
  $card.find('.mb-1').each(function () {
    const k = $(this).find('.text-muted.small').first().text().trim();
    const v = $(this).find('.ms-2').first().text().replace(/\s+/g, ' ').trim();
    if (k && v) salesTeam[k] = v;
  });

  const contact = { owner: owner, phone: phone, email: email, address: address, info: info };

  const tabs = await Promise.all([
    fetchMerchantHandler(origin, mid, 'Deposits'),
    fetchMerchantHandler(origin, mid, 'Authorizations'),
    fetchMerchantHandler(origin, mid, 'Statements'),
  ]);

  return {
    mid: mid,
    name: name || $('.page-title').first().text().trim() || null,
    metrics: metrics,
    contact: contact,
    sales_team: salesTeam,
    deposits: tabs[0],
    authorizations: tabs[1],
    statements: tabs[2],
  };
}

// ── Upsert one merchant's detail row to Supabase ───────────────────
async function upsertMerchantDetail(row) {
  const body = JSON.stringify({
    mid: row.mid,
    name: row.name,
    metrics: row.metrics,
    contact: row.contact,
    sales_team: row.sales_team,
    deposits: row.deposits,
    authorizations: row.authorizations,
    statements: row.statements,
    updated_at: new Date().toISOString(),
  });
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(SUPA_URL + '/rest/v1/merchant_details', {
        method: 'POST',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': 'Bearer ' + SUPA_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: body,
      });
      if (res.ok) return true;
      const text = await res.text();
      if (attempt === 2) console.log('  ⚠ detail upsert ' + row.mid + ' failed (' + res.status + '): ' + text.slice(0, 120));
    } catch (e) {
      if (attempt === 2) console.log('  ⚠ detail upsert ' + row.mid + ' error: ' + (e.message || e));
    }
    await new Promise(function (r) { setTimeout(r, 1000); });
  }
  return false;
}

// ── Backfill merchant_overrides with scraped contact info ─────────
// For every merchant_details row that has contact data, ensure the
// merchant_overrides table has at least the scraped owner/phone/email.
// Uses "ignoreDuplicates" so it never overwrites manually-entered data.
async function backfillMerchantOverrides() {
  let detailRows;
  try {
    const res = await fetch(SUPA_URL + '/rest/v1/merchant_details?select=mid,name,contact', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
    });
    if (!res.ok) return;
    detailRows = await res.json();
  } catch (e) { return; }

  const inserts = [];
  for (const r of detailRows) {
    const c = r.contact || {};
    if (!c.owner && !c.phone && !c.email) continue;
    inserts.push({
      merchant_name: r.name || '',
      owner_name: c.owner || '',
      owner_phone: c.phone || '',
      owner_email: c.email || '',
      mid: r.mid || '',
      updated_at: new Date().toISOString(),
    });
  }
  if (!inserts.length) return;

  try {
    const res = await fetch(SUPA_URL + '/rest/v1/merchant_overrides', {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(inserts),
    });
    if (res.ok) console.log('  Backfilled ' + inserts.length + ' merchant override(s) from scraped contact data');
    else console.log('  ⚠ Override backfill failed: ' + res.status);
  } catch (e) {
    console.log('  ⚠ Override backfill error: ' + (e.message || e));
  }
}

// ── Embed contact data from merchant_overrides directly into deals ──
// The browser-side Supabase fetch can be blocked by ad blockers, network
// issues, etc.  By baking the contact info into the DATA object at sync
// time, every merchant renders owner/phone/email/equipment even when
// the browser can't reach Supabase.  Manual edits made between syncs
// still overlay via the live Supabase fetch on the frontend.
async function embedContactData(merged) {
  let overrides;
  try {
    const res = await fetch(SUPA_URL + '/rest/v1/merchant_overrides?select=merchant_name,mid,owner_name,owner_phone,owner_email,equipment,notes', {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
    });
    if (!res.ok) { console.log('  ⚠ Could not fetch merchant_overrides for embedding: ' + res.status); return; }
    overrides = await res.json();
  } catch (e) { console.log('  ⚠ Could not fetch merchant_overrides for embedding: ' + (e.message || e)); return; }

  if (!overrides || !overrides.length) return;

  const byMid = {};
  const byName = {};
  for (const r of overrides) {
    const rec = {
      ownerName: r.owner_name || '',
      ownerPhone: r.owner_phone || '',
      ownerEmail: r.owner_email || '',
      equipment: r.equipment || '',
      notes: r.notes || '',
    };
    if (r.mid) byMid[String(r.mid)] = rec;
    byName[normName(r.merchant_name)] = rec;
  }

  let count = 0;
  for (const monthKey of Object.keys(merged)) {
    const deals = (merged[monthKey] && merged[monthKey].deals) || [];
    for (const d of deals) {
      const ov = (d.mid && byMid[String(d.mid)]) || byName[normName(d.name)];
      if (!ov) continue;
      if (ov.ownerName) d.ownerName = ov.ownerName;
      if (ov.ownerPhone) d.ownerPhone = ov.ownerPhone;
      if (ov.ownerEmail) d.ownerEmail = ov.ownerEmail;
      if (ov.equipment) d.equipment = ov.equipment;
      if (ov.notes) d.notes = ov.notes;
      count++;
    }
  }
  console.log('  Embedded contact data into ' + count + ' deal(s) from merchant_overrides');
}

// ── Run async work over a list with a fixed concurrency cap ────────
async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async function () {
    while (i < items.length) {
      const idx = i++;
      try { await fn(items[idx], idx); } catch (e) { /* isolated per item */ }
    }
  });
  await Promise.all(workers);
}

// ── Sync detail (metrics + deposits/auths/statements) for EVERY MID ─
async function syncMerchantDetails(origin, merged) {
  const seen = {};
  const mids = [];
  Object.keys(merged).forEach(function (m) {
    ((merged[m] && merged[m].deals) || []).forEach(function (d) {
      const mid = String(d.mid || '').trim();
      if (mid && !seen[mid]) { seen[mid] = true; mids.push({ mid: mid, name: d.name }); }
    });
  });
  if (!mids.length) { console.log('\nNo merchant MIDs found — skipping detail sync.'); return; }

  console.log('\n── Merchant detail: fetching ' + mids.length + ' merchant(s) ──');
  let ok = 0, fail = 0, authExpired = false;
  await mapLimit(mids, 5, async function (entry) {
    if (authExpired) return; // cookie died mid-sync — stop hammering the login page
    try {
      const row = await fetchMerchantDetail(origin, entry.mid, entry.name);
      if (await upsertMerchantDetail(row)) ok++; else fail++;
    } catch (e) {
      fail++;
      if (e && e.isLogin) {
        if (!authExpired) console.log('  ⛔ cookie expired mid-sync — aborting remaining detail fetches');
        authExpired = true;
        return;
      }
      console.log('  ✗ ' + entry.mid + ' (' + entry.name + '): ' + (e.message || e));
    }
  });
  console.log('  Merchant detail synced: ' + ok + ' ok, ' + fail + ' failed' + (authExpired ? ' (aborted early — cookie expired)' : ''));
}

// ── Parse the Pended Deals report ─────────────────────────────────
// /reports/pendingdeals returns a table with columns:
// DBA | GM | Team | Sales Rep | Pend Category | Sub-Category | Comment | Pend Date
function parsePendedDeals(html) {
  const $ = cheerio.load(html);
  if (isLoginPage($)) return null;
  const deals = [];

  $('table').each(function () {
    const headers = [];
    let hr = $(this).find('thead tr').first();
    if (!hr.length) hr = $(this).find('tr').first();
    hr.find('th, td').each(function () { headers.push(hkey($(this).text())); });

    const dbaIdx = headers.findIndex(function (h) { return /dba/.test(h); });
    const gmIdx = headers.findIndex(function (h) { return h === 'gm'; });
    const teamIdx = headers.findIndex(function (h) { return /team/.test(h); });
    const repIdx = headers.findIndex(function (h) { return /salesrep|rep/.test(h); });
    const catIdx = headers.findIndex(function (h) { return /pendcategory|category/.test(h) && !/sub/.test(h); });
    const subIdx = headers.findIndex(function (h) { return /sub/.test(h); });
    const commentIdx = headers.findIndex(function (h) { return /comment/.test(h); });
    const dateIdx = headers.findIndex(function (h) { return /penddate|date/.test(h); });
    if (dbaIdx < 0) return;

    $(this).find('tbody tr').each(function () {
      const cells = [];
      $(this).find('td').each(function () { cells.push($(this).text().replace(/\s+/g, ' ').trim()); });
      const dba = (cells[dbaIdx] || '').trim();
      if (!dba || /^total$/i.test(dba)) return;

      deals.push({
        dba: dba,
        gm: gmIdx >= 0 ? (cells[gmIdx] || '').trim() : '',
        team: teamIdx >= 0 ? (cells[teamIdx] || '').trim() : '',
        rep: repIdx >= 0 ? (cells[repIdx] || '').trim() : '',
        category: catIdx >= 0 ? (cells[catIdx] || '').trim() : '',
        subCategory: subIdx >= 0 ? (cells[subIdx] || '').trim() : '',
        comment: commentIdx >= 0 ? (cells[commentIdx] || '').trim() : '',
        pendDate: dateIdx >= 0 ? (cells[dateIdx] || '').trim() : '',
      });
    });
  });

  return deals;
}

// ── Fetch + parse pended deals, return the array ──────────────────
async function fetchPendedDeals(origin) {
  let html;
  try {
    html = await fetchPage(origin + '/reports/pendingdeals');
  } catch (e) {
    console.log('  Could not fetch pended deals:', e.message || e);
    return null;
  }
  const deals = parsePendedDeals(html);
  if (deals === null) {
    console.log('  Pended deals page returned login page — cookie expired');
    return null;
  }
  console.log('  Parsed ' + deals.length + ' pended deal(s)');
  return deals;
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('Sync started at ' + new Date().toISOString());
  const origin = new URL(SALES_URL).origin;

  if (!SALES_COOKIE) {
    console.log('⚠ No SALES_COOKIE set — cannot authenticate. Set it in repo Settings → Secrets.');
    console.log('  Skipping this run — data unchanged.');
    const { data: existing } = readExistingData();
    await publishToSupabase(existing);
    process.exit(0);
  }

  // Auth check: fetch current month's rep page to validate the cookie
  const months = monthRange();
  const currentDt = months[months.length - 1].dt;
  const authCheckHtml = await fetchPage(origin + '/reports/RankingsByRep?dt=' + currentDt + '&t=' + encodeURIComponent(TEAM));
  if (isLoginPage(cheerio.load(authCheckHtml))) {
    console.log('⚠ Site returned a login page — the SALES_COOKIE is likely expired.');
    console.log('  Log into ' + origin + ' again, copy a fresh Cookie header, and update the SALES_COOKIE secret.');
    console.log('  Skipping this run — data unchanged.');
    const { data: existing } = readExistingData();
    await publishToSupabase(existing);
    process.exit(0);
  }

  // Team rank from the Rankings landing page (live — applies to current month only)
  let teamRank = null;
  try {
    teamRank = parseTeamRank(await fetchPage(origin + '/Rankings'), TEAM);
  } catch (e) {
    console.log('Could not read team rank:', e.message || e);
  }

  const { content, data: existing, raw, pended: existingPended, pendedRaw } = readExistingData();
  let merged = JSON.parse(JSON.stringify(existing));
  let pendedDeals = existingPended;

  console.log('Syncing ' + months.length + ' month(s): ' + months.map(function (m) { return m.monthKey; }).join(', '));

  for (const { dt, monthKey } of months) {
    console.log('\n── ' + monthKey + ' (dt=' + dt + ') ──');

    // 1) Rep rankings → reps + totals
    let repHtml;
    if (dt === currentDt) {
      repHtml = authCheckHtml; // already fetched above
    } else {
      try {
        repHtml = await fetchPage(origin + '/reports/RankingsByRep?dt=' + dt + '&t=' + encodeURIComponent(TEAM));
      } catch (e) {
        console.log('  Could not fetch rep rankings:', e.message || e);
        continue;
      }
    }

    const reps = parseTeamReps(repHtml);
    const totals = computeTotals(reps);

    if (reps.length) {
      const incoming = {};
      const monthObj = { totals: totals, reps: reps };
      if (dt === currentDt && teamRank) monthObj.teamRank = teamRank;
      incoming[monthKey] = monthObj;
      console.log('  ' + reps.length + ' reps, totals: ' + JSON.stringify(totals));
      merged = mergeData(merged, incoming);
    } else {
      console.log('  No ' + TEAM + ' reps found in rankings — will still check volume report.');
      if (!merged[monthKey]) merged[monthKey] = { totals: { approved: 0, proc: 0, not: 0, ratio: 0 }, reps: [], deals: [] };
    }

    // 2) All merchants from the nonprocessing report (authoritative names + reps)
    try {
      const n = await syncAllMerchants(origin, merged[monthKey], dt);
      console.log('  Synced ' + n + ' merchant(s) from all-merchants report');
    } catch (e) {
      console.log('  Could not sync all-merchants report:', e.message || e);
    }

    // 3) Per-merchant volume + transaction count (proc=ALL to get everything)
    try {
      const n = await updateDealsVolume(origin, merged[monthKey], dt);
      console.log('  Updated/added ' + n + ' merchant deal(s) from volume report');
    } catch (e) {
      console.log('  Could not update merchant volume/txn:', e.message || e);
    }

    // 4) Collapse any duplicate rows the reports may have introduced.
    const dups = collapseDuplicateDeals(merged[monthKey]);
    if (dups) console.log('  Collapsed ' + dups + ' duplicate merchant row(s)');
  }

  // Per-merchant detail (deposits/auths/statements/metrics) refreshes
  // daily regardless of whether the deals list changed, so it runs here
  // before the no-change short-circuit. Failures are isolated and never
  // abort the sync.
  try {
    await syncMerchantDetails(origin, merged);
    await backfillMerchantOverrides();
  } catch (e) {
    console.log('Merchant detail sync error (non-fatal):', e.message || e);
  }

  // Embed contact data from Supabase directly into deal objects so the
  // frontend never depends on a browser-side Supabase fetch for basics.
  try {
    console.log('\n── Embedding contact data ──');
    await embedContactData(merged);
  } catch (e) {
    console.log('Contact data embedding error (non-fatal):', e.message || e);
  }

  // Pended deals — refreshes every sync regardless of deal changes.
  try {
    console.log('\n── Pended Deals ──');
    const freshPended = await fetchPendedDeals(origin);
    if (freshPended !== null) pendedDeals = freshPended;
  } catch (e) {
    console.log('Pended deals sync error (non-fatal):', e.message || e);
  }

  if (JSON.stringify(merged) === JSON.stringify(existing) && JSON.stringify(pendedDeals) === JSON.stringify(existingPended)) {
    console.log('\nNo data changes — index.html unchanged');
    await publishToSupabase(merged);
    process.exit(0);
  }

  // ── Data integrity guard: never lose deals ──────────────────────────
  // Count total deals across all months in both old and new data.
  // If the merge would drop more than 30% of deals, abort — something
  // went wrong with the source and we'd rather keep stale data than
  // corrupt what we have.
  const countDeals = function (d) {
    return Object.keys(d).reduce(function (n, m) {
      return n + ((d[m] && d[m].deals) ? d[m].deals.length : 0);
    }, 0);
  };
  const oldCount = countDeals(existing);
  const newCount = countDeals(merged);
  if (oldCount > 0 && newCount < oldCount * 0.7) {
    console.log('\n⛔ SAFETY ABORT: merged data has ' + newCount + ' deals vs ' + oldCount + ' existing.');
    console.log('  This looks like a data-loss scenario (>30% drop). Keeping current index.html.');
    await publishToSupabase(existing);
    process.exit(0);
  }

  // Back up current index.html before overwriting
  const backupPath = INDEX_PATH + '.bak';
  fs.copyFileSync(INDEX_PATH, backupPath);
  console.log('Backed up current index.html → index.html.bak');

  writeUpdatedData(content, raw, merged, pendedDeals, pendedRaw);
  console.log('\n✓ index.html updated for ' + months.length + ' month(s)');

  await publishToSupabase(merged);
}

main().catch(async function (err) {
  if (err && (err.isFetchError || err.name === 'TypeError' ||
      /fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(err.message || ''))) {
    console.log('⚠ Source not reachable (' + (err.message || err) + ') — skipping this run, data unchanged.');
    try {
      const { data: existing } = readExistingData();
      await publishToSupabase(existing);
    } catch (e) {
      console.log('⚠ Could not publish existing data to Supabase:', e.message || e);
    }
    process.exit(0);
  }
  console.error('Sync failed:', err.message || err);
  process.exit(1);
});
