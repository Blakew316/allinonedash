/* ============================================================
   Team Maverick · Appointments — Wholesale Payments
   Google-Calendar-style client. Zero dependencies.
   ============================================================ */
(function () {
  'use strict';

  /* ---------------- Storage keys ---------------- */
  var APP_VERSION = 'v31';

  var LS = {
    url: 'tm_url', theme: 'tm_theme', demo: 'tm_demo',
    cache: 'tm_cache', hidden: 'tm_hidden', view: 'tm_view',
    lastSync: 'tm_lastsync',
    volUrl: 'tm_vol_url',        // optional separate merchant-volume feed
    transport: 'tm_transport',   // which fetch path worked last ('fetch'|'jsonp')
    volState: 'tm_volstate',     // last seen volume per merchant
    milestones: 'tm_milestones', // recorded $1K/$5K payout crossings
  };

  var SCRIPT_URL_RE = /^https:\/\/script\.google(usercontent)?\.com\//;
  var HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

  // Light hues drawn from the Wholesale Payments logo family only —
  // blues, skies, greens, mints, and blends between them.
  var AGENT_PALETTE = [
    '#1E8FE8', '#2EB875', '#18A0E8', '#43CD9A',
    '#0E76C4', '#1E9E63', '#4FB3F0', '#71DC8B',
    '#3D64D8', '#23B89E', '#7FB4E8', '#2E8F5B',
    '#35C4E0', '#63C96B', '#5A7BEF', '#98E0AC',
  ];

  // Team Maverick roster — always available to filter, even before data loads.
  // Order and colors are stable (color = index into AGENT_PALETTE).
  var ROSTER = [
    'Adam Drexler', 'Darrin Faille', 'Gabriel Craft', 'Haley Woodruff',
    'Isaac Jenkins', 'Jabe Schoenrock', 'Jaden Dufek', 'Jared Mack',
    'Jason Coutcher', 'Judah Steelman', 'Justin Woodruff', 'Kyle Pettit',
    'Lloyd Delecruz', 'Max Alperstein', 'Sadie Scoville', 'Seth Manshum',
    'Timothy Constenius', 'Walter Smith',
  ];

  // Feed spellings that should collapse into one roster agent. Keys are
  // lowercased with spaces squeezed; values are the roster spelling.
  var AGENT_ALIASES = Object.assign(Object.create(null), {
    'lloyd cruz': 'Lloyd Delecruz',
    'lloyd delacruz': 'Lloyd Delecruz',
    'lloyd dela cruz': 'Lloyd Delecruz',
    'lloyd de la cruz': 'Lloyd Delecruz',
    'jaden defek': 'Jaden Dufek',
    'timothy canstenivs': 'Timothy Constenius',
    'tim constenius': 'Timothy Constenius',
  });

  // Business names are NEVER agents. If a feed's rep field carries an entity
  // (LLC/Inc/Corp/…), the row is attributed to no one rather than guessed
  // onto a person.
  var ENTITY_RE = /\b(llc|l\.l\.c\.?|inc|incorporated|corp|corporation|ltd|llp|pllc|holdings|enterprises)\b/i;
  function isBusinessName(name) { return ENTITY_RE.test(String(name == null ? '' : name)); }
  var ROSTER_BY_KEY = Object.create(null);
  ROSTER.forEach(function (n) { ROSTER_BY_KEY[n.toLowerCase().replace(/\s+/g, ' ')] = n; });

  // Snap a feed agent name onto the roster: alias map first, then a
  // case/spacing-insensitive roster match, otherwise pass it through as-is.
  function canonicalAgent(name) {
    var s = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
    if (!s) return s;
    var k = s.toLowerCase();
    return AGENT_ALIASES[k] || ROSTER_BY_KEY[k] || s;
  }

  // Former team members whose rows should be dropped everywhere. Currently
  // empty — misspelled duplicates are handled by AGENT_ALIASES above instead.
  var REMOVED_AGENTS = Object.create(null);
  function isRemovedAgent(name) {
    return !!REMOVED_AGENTS[String(name == null ? '' : name).replace(/\s+/g, ' ').trim().toLowerCase()];
  }

  // Null-prototype so untrusted status strings can't reach Object.prototype.
  var STATUS_COLORS = Object.assign(Object.create(null), {
    confirmed: '#2EB875', completed: '#2EB875', done: '#2EB875', closed: '#2EB875', signed: '#2EB875', won: '#2EB875',
    pending: '#E0932F', tentative: '#E0932F', rescheduled: '#E0932F', hold: '#E0932F',
    followup: '#1E8FE8', 'follow-up': '#1E8FE8', 'follow up': '#1E8FE8', new: '#1E8FE8', scheduled: '#1E8FE8', open: '#1E8FE8',
    cancelled: '#d9544f', canceled: '#d9544f', 'no-show': '#d9544f', noshow: '#d9544f', 'no show': '#d9544f', lost: '#d9544f',
    payout: '#D4A017', paid: '#D4A017', bonus: '#D4A017',
  });

  var HOUR_H = 52;                 // px per hour in time grid
  var DEFAULT_DUR_MIN = 60;

  var state = {
    view: 'day',                   // day | week | month | schedule
    date: new Date(),              // anchor date
    miniAnchor: new Date(),        // month shown in the mini calendar
    hidden: new Set(),             // agent names hidden from view
    query: '',
    events: [],
    agents: [],
    milestones: [],
    loading: false,
    error: null,
    updatedAt: null,
    skipped: 0,
  };

  var reqSeq = 0;                  // guards against out-of-order refresh() results

  /* ---------------- Helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeColor(c) { return (typeof c === 'string' && HEX_RE.test(c)) ? c : '#A7ABB3'; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function sameDay(a, b) { return dateKey(a) === dateKey(b); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { var x = startOfDay(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
  function startOfWeek(d) { return addDays(d, -d.getDay()); } // Sunday-first
  function getStore(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function setStore(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function fmtTime(d) {
    if (!d) return '';
    var h = d.getHours(), m = d.getMinutes();
    var ap = h < 12 ? 'AM' : 'PM'; var h12 = h % 12 || 12;
    return h12 + (m ? ':' + pad2(m) : '') + ' ' + ap;
  }
  function fmtHourLabel(h) {
    if (h === 0) return '12 AM'; if (h === 12) return '12 PM';
    return (h % 12) + (h < 12 ? ' AM' : ' PM');
  }
  function fmtDayLabel(d) {
    var now = new Date(); var o = { weekday: 'long', month: 'long', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString('en-US', o);
  }
  function fmtMonthLabel(d) { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  function initials(name) {
    var p = String(name).trim().split(/\s+/).slice(0, 2);
    return p.map(function (x) { return (x[0] || '').toUpperCase(); }).join('') || '?';
  }

  /* ---------------- Theme ---------------- */
  var mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var urlParams = new URLSearchParams(location.search);

  // Installed PWA (home-screen app)? It always launches on today's Day view.
  var IS_STANDALONE = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  function isNarrow() { return window.innerWidth <= 640; }
  function weekCols() { return isNarrow() ? 3 : 7; }  // phone week = readable 3-day
  function themePref() {
    var p = urlParams.get('theme');
    if (p === 'light' || p === 'dark') return p;
    return getStore(LS.theme) || 'system';
  }
  function resolvedTheme() {
    var p = themePref();
    if (p === 'light' || p === 'dark') return p;
    return (mqDark && mqDark.matches) ? 'dark' : 'light';
  }
  function applyTheme() {
    var t = resolvedTheme();
    document.documentElement.setAttribute('data-theme', t);
    // Dark mode uses the white-wordmark variant of the official logo
    // (appbar logo + the drawer's brand header on phones)
    var logos = document.querySelectorAll('.brand-logo-img');
    var want = t === 'dark' ? 'assets/logo-dark.png' : 'assets/logo.png';
    for (var li = 0; li < logos.length; li++) {
      if (logos[li].getAttribute('src') !== want) logos[li].setAttribute('src', want);
    }
    var color = t === 'dark' ? '#0a0c12' : '#ffffff';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', color);
    var picks = document.querySelectorAll('[data-theme-pick]');
    for (var j = 0; j < picks.length; j++)
      picks[j].classList.toggle('is-active', picks[j].getAttribute('data-theme-pick') === themePref());
  }
  if (mqDark && mqDark.addEventListener)
    mqDark.addEventListener('change', function () { if (themePref() === 'system') applyTheme(); });

  /* ---------------- Normalization ---------------- */
  function firstArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return null;
    var keys = ['events', 'appointments', 'appts', 'tasks', 'data', 'items', 'rows', 'records', 'result', 'results', 'values'];
    for (var i = 0; i < keys.length; i++) if (Array.isArray(payload[keys[i]])) return payload[keys[i]];
    for (var k in payload) {
      if (payload[k] && typeof payload[k] === 'object' && !Array.isArray(payload[k])) {
        var inner = firstArray(payload[k]); if (inner) return inner;
      }
    }
    return null;
  }

  function pick(obj, names) {
    for (var i = 0; i < names.length; i++)
      if (Object.prototype.hasOwnProperty.call(obj, names[i]) && obj[names[i]] != null && obj[names[i]] !== '')
        return obj[names[i]];
    var lower = Object.create(null);
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) lower[k.toLowerCase().replace(/[\s_-]/g, '')] = obj[k];
    for (var j = 0; j < names.length; j++) {
      var key = names[j].toLowerCase().replace(/[\s_-]/g, '');
      if (lower[key] != null && lower[key] !== '') return lower[key];
    }
    return null;
  }

  function hasTZ(s) { return /(?:[zZ])$/.test(s) || /[+\-]\d{2}:?\d{2}$/.test(s); }

  // Convert various numeric encodings to a local-midnight Date, or null.
  function numberToDate(n) {
    if (!isFinite(n)) return null;
    if (n >= 1e12) { var d1 = new Date(n); return isNaN(d1) ? null : startOfDay(d1); }        // epoch ms
    if (n >= 1e9) { var d2 = new Date(n * 1000); return isNaN(d2) ? null : startOfDay(d2); }   // epoch seconds
    if (n >= 1 && n < 1e5) {                                                                    // Google Sheets serial
      var ms = Math.round(n) * 86400000 + Date.UTC(1899, 11, 30, 0, 0, 0);
      var d3 = new Date(ms);
      return isNaN(d3) ? null : new Date(d3.getUTCFullYear(), d3.getUTCMonth(), d3.getUTCDate());
    }
    return null;
  }

  // A "date" field is a wall-date: read calendar digits, ignore any time/offset.
  function parseDateOnly(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : startOfDay(v);
    if (typeof v === 'number') return numberToDate(v);
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) { var y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[1] - 1, +m[2]); }
    var d = new Date(s); return isNaN(d) ? null : startOfDay(d);
  }

  // A "time of day" -> { h, m } or null. Handles AM/PM, 24h, Sheets 1899 sentinel, day fraction.
  function parseTimeOfDay(t) {
    if (t == null || t === '') return null;
    if (t instanceof Date) return { h: t.getHours(), m: t.getMinutes() };
    if (typeof t === 'number') {
      if (t > 0 && t < 1) { var mins = Math.round(t * 1440); return { h: Math.floor(mins / 60), m: mins % 60 }; }
      return null;
    }
    var s = String(t).trim();
    if (/^18(99|00)|^1900/.test(s)) { var d = new Date(s); if (!isNaN(d)) return { h: d.getUTCHours(), m: d.getUTCMinutes() }; }
    var m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AaPp])?\.?[Mm]?\.?$/);
    if (m) {
      var h = parseInt(m[1], 10), mm = m[2] ? parseInt(m[2], 10) : 0, ap = m[3] ? m[3].toLowerCase() : null;
      if (ap === 'p' && h < 12) h += 12;
      if (ap === 'a' && h === 12) h = 0;
      if (h >= 0 && h < 24 && mm >= 0 && mm < 60) return { h: h, m: mm };
    }
    return null;
  }

  // Resolve a single datetime value into a local Date + whether it carries a time.
  function parseDateTime(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : { date: v, hasTime: true };
    if (typeof v === 'number') { var nd = numberToDate(v); return nd ? { date: nd, hasTime: false } : null; }
    var s = String(v).trim();
    // date only
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) {
      var d0 = parseDateOnly(s); return d0 ? { date: d0, hasTime: false } : null;
    }
    // has explicit timezone -> absolute instant, convert to local
    if (hasTZ(s)) { var da = new Date(s); return isNaN(da) ? null : { date: da, hasTime: true }; }
    // naive datetime: read digits as local wall-clock
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
    if (m) return { date: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]), hasTime: true };
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})[T ,]+(\d{1,2}):(\d{2})\s*([AaPp])?/);
    if (m) {
      var y = +m[3]; if (y < 100) y += 2000;
      var hh = +m[4]; var ap = m[6] ? m[6].toLowerCase() : null;
      if (ap === 'p' && hh < 12) hh += 12; if (ap === 'a' && hh === 12) hh = 0;
      return { date: new Date(y, +m[1] - 1, +m[2], hh, +m[5]), hasTime: true };
    }
    var dg = new Date(s); return isNaN(dg) ? null : { date: dg, hasTime: true };
  }

  // Field aliases the normalizer maps into named event properties. Anything
  // ELSE the Apps Script sends is preserved verbatim in event.extra so the
  // detail panel can show every column that comes in.
  var ALIASES = {
    agent: ['agent', 'agentName', 'agent_name', 'rep', 'salesRep', 'sales_rep', 'owner', 'assignedTo', 'assigned_to', 'employee', 'teamMember', 'user', 'name'],
    title: ['title', 'task', 'subject', 'summary', 'appointment', 'merchant', 'business', 'client', 'customer', 'company', 'description'],
    notes: ['notes', 'note', 'details', 'comments', 'comment'],
    location: ['location', 'address', 'place', 'city', 'venue'],
    status: ['status', 'state', 'outcome'],
    // 'contact' is NOT a phone alias: the board's CONTACT column is a person's
    // name ("ask for Maria") and belongs in the details, not behind a tel: link.
    phone: ['phone', 'phoneNumber', 'phone_number', 'tel', 'telephone', 'mobile', 'cell', 'contactNumber', 'contact_number'],
    start: ['start', 'startTime', 'start_time', 'startDateTime', 'start_datetime', 'when', 'datetime', 'dateTime', 'timestamp'],
    date: ['date', 'day', 'apptDate', 'appointmentDate', 'appt_date'],
    time: ['time', 'apptTime', 'appointmentTime', 'appt_time', 'hour'],
    end: ['end', 'endTime', 'end_time', 'endDateTime', 'end_datetime'],
    ignore: ['id', 'rowid', 'row_id', '_i', 'ok', 'uid', 'guid'],
  };
  var KNOWN_KEYS = Object.create(null);
  (function () {
    for (var g in ALIASES) {
      ALIASES[g].forEach(function (a) { KNOWN_KEYS[a.toLowerCase().replace(/[\s_-]/g, '')] = true; });
    }
  })();

  function prettyLabel(k) {
    return String(k)
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // Collect every field the feed sent that we didn't map to a named property.
  function extraFields(raw) {
    var out = [];
    for (var k in raw) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      if (KNOWN_KEYS[k.toLowerCase().replace(/[\s_-]/g, '')]) continue;
      var v = raw[k];
      if (v == null || v === '') continue;
      if (typeof v === 'object') { try { v = JSON.stringify(v); } catch (e) { continue; } }
      v = String(v).trim();
      if (!v) continue;
      out.push([prettyLabel(k), v.length > 300 ? v.slice(0, 300) + '…' : v]);
      if (out.length >= 20) break;
    }
    return out;
  }

  function normalizeOne(raw, idx) {
    if (!raw || typeof raw !== 'object') return null;

    var agent = pick(raw, ALIASES.agent);
    if (isRemovedAgent(agent)) return null;
    var title = pick(raw, ALIASES.title);
    var notes = pick(raw, ALIASES.notes);
    if (notes === title) notes = null;
    if (!title) { title = notes || 'Appointment'; if (notes === title) notes = null; }
    var location = pick(raw, ALIASES.location);
    var status = pick(raw, ALIASES.status);
    var phone = pick(raw, ALIASES.phone);
    var startRaw = pick(raw, ALIASES.start);
    var dateRaw = pick(raw, ALIASES.date);
    var timeRaw = pick(raw, ALIASES.time);
    var endRaw = pick(raw, ALIASES.end);

    var day = null, start = null, hasTime = false;

    if (dateRaw != null && dateRaw !== '') {
      // Explicit wall-date wins; time comes from an explicit time field or naive start digits.
      day = parseDateOnly(dateRaw);
      if (!day) return null;
      var tp = parseTimeOfDay(timeRaw);
      if (!tp && typeof startRaw === 'string' && !hasTZ(startRaw)) {
        var mt = startRaw.match(/[T ](\d{1,2}):(\d{2})/);
        if (mt) tp = { h: +mt[1], m: +mt[2] };
      }
      if (tp) { start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), tp.h, tp.m); hasTime = true; }
    } else if (startRaw != null && startRaw !== '') {
      var dt = parseDateTime(startRaw);
      if (!dt) return null;
      day = startOfDay(dt.date);
      if (dt.hasTime) { start = dt.date; hasTime = true; }
    } else {
      return null;
    }

    var end = null;
    if (start) {
      var tpe = parseTimeOfDay(endRaw);
      if (tpe) end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), tpe.h, tpe.m);
      else if (endRaw != null && endRaw !== '') {
        var de = parseDateTime(endRaw);
        if (de && de.hasTime) end = de.date;
      }
      if (end && end <= start) end = null;
    }

    // A "phone" that isn't dialable (fewer than 7 digits) is not a phone.
    if (phone && String(phone).replace(/\D/g, '').length < 7) phone = null;

    return {
      id: 'ev' + idx,
      agent: canonicalAgent(agent) || 'Unassigned',
      title: String(title).trim(),
      notes: notes ? String(notes).trim() : '',
      location: location ? String(location).trim() : '',
      status: status ? String(status).trim() : '',
      phone: phone ? String(phone).trim() : '',
      extra: extraFields(raw),
      day: day, key: dateKey(day),
      start: start, end: end, allDay: !hasTime,
    };
  }

  function normalize(payload) {
    var arr = firstArray(payload);
    state.skipped = 0;
    if (!arr) return [];
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var ev = normalizeOne(arr[i], i);
      if (ev) out.push(ev); else if (arr[i] != null) state.skipped++;
    }
    out.sort(function (a, b) {
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      var ta = a.start ? a.start.getTime() : 0, tb = b.start ? b.start.getTime() : 0;
      return ta - tb || a.agent.localeCompare(b.agent);
    });
    return out;
  }

  /* ============================================================
     MERCHANT VOLUME MILESTONES — $1K / $5K payout events
     ============================================================ */
  var MILESTONE_LEVELS = [1000, 5000];

  function milestoneLabel(level) { return level >= 5000 ? '$5K' : '$1K'; }

  // Find a merchants array inside a payload (object key or, for the dedicated
  // volume feed, a bare array of merchant rows).
  function extractMerchants(payload, bareArrayIsMerchants) {
    if (Array.isArray(payload)) return bareArrayIsMerchants ? payload : null;
    if (!payload || typeof payload !== 'object') return null;
    var keys = ['merchants', 'merchantVolume', 'merchant_volume', 'volumes', 'volume', 'accounts'];
    for (var i = 0; i < keys.length; i++) {
      if (Array.isArray(payload[keys[i]])) return payload[keys[i]];
    }
    return null;
  }

  function parseMoney(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = parseFloat(String(v).replace(/[$,\s]/g, ''));
    return isFinite(n) ? n : null;
  }

  function normalizeMerchant(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var merchant = pick(raw, ['merchant', 'merchantName', 'business', 'dba', 'company', 'client', 'account', 'name']);
    if (!merchant) return null;
    var agent = pick(raw, ['agent', 'agentName', 'rep', 'salesRep', 'owner', 'assignedTo', 'employee']);
    if (isRemovedAgent(agent)) return null;
    if (isBusinessName(agent)) agent = null;   // entity in the rep field → Unassigned, never a person
    var volume = parseMoney(pick(raw, ['volume', 'totalVolume', 'total_volume', 'monthlyVolume', 'mtdVolume', 'processed', 'amount', 'sales']));
    var d1 = parseDateOnly(pick(raw, ['date1k', 'date1000', 'crossed1k', 'crossed1000', 'hit1k', 'hit1000']));
    var d5 = parseDateOnly(pick(raw, ['date5k', 'date5000', 'crossed5k', 'crossed5000', 'hit5k', 'hit5000']));
    if (volume == null && !d1 && !d5) return null;
    var dates = {}; dates[1000] = d1; dates[5000] = d5;
    return {
      merchant: String(merchant).trim(),
      agent: canonicalAgent(agent) || 'Unassigned',
      volume: volume,
      dates: dates,
    };
  }

  function loadMilestones() {
    try {
      var l = JSON.parse(getStore(LS.milestones) || '[]');
      return Array.isArray(l) ? l : [];
    } catch (e) { return []; }
  }

  // Detect $1K/$5K crossings and persist them as payout milestones.
  // Rules: an explicit DateNK column from the feed always wins (stable across
  // devices). Otherwise, the first-ever sync only baselines volumes (no
  // invented dates); after that, a merchant seen crossing a level — or a new
  // merchant arriving already over it — is stamped on the day it was observed.
  function processMerchants(rows) {
    if (!rows || !rows.length) return;
    var normd = [];
    for (var i = 0; i < rows.length; i++) {
      var m = normalizeMerchant(rows[i]);
      if (m) normd.push(m);
    }
    if (!normd.length) return;

    var stones = Object.create(null);
    loadMilestones().forEach(function (s) { stones[s.merchant + '|' + s.level] = s; });

    var volState = null;
    try { volState = JSON.parse(getStore(LS.volState) || 'null'); } catch (e) {}
    var firstSync = !volState;
    volState = volState || {};

    normd.forEach(function (r) {
      var prev = Object.prototype.hasOwnProperty.call(volState, r.merchant) ? volState[r.merchant] : null;
      MILESTONE_LEVELS.forEach(function (level) {
        var k = r.merchant + '|' + level;
        // A date from the feed is AUTHORITATIVE: it creates the milestone on
        // that exact day and corrects one recorded earlier on the wrong
        // (first-observed) day.
        if (r.dates[level]) {
          var fk = dateKey(startOfDay(r.dates[level]));
          if (stones[k]) {
            stones[k].key = fk;
            if (r.agent && r.agent !== 'Unassigned') stones[k].agent = r.agent;
          } else {
            stones[k] = { merchant: r.merchant, agent: r.agent, level: level, key: fk };
          }
          return;
        }
        if (stones[k]) return;                                   // already recorded
        var when = null;
        if (r.volume != null && r.volume >= level) {
          if (firstSync) return;                                 // baseline pass: don't invent history
          if (prev != null && prev >= level) return;             // was already over before tracking caught it
          when = new Date();                                     // crossed since the last sync
        }
        if (!when) return;
        stones[k] = { merchant: r.merchant, agent: r.agent, level: level, key: dateKey(startOfDay(when)) };
      });
      if (r.volume != null) volState[r.merchant] = r.volume;
    });

    var list = Object.keys(stones).map(function (k) { return stones[k]; });
    setStore(LS.volState, JSON.stringify(volState));
    setStore(LS.milestones, JSON.stringify(list));
    state.milestones = list;
  }

  function milestoneEventObjects() {
    return (state.milestones || []).map(function (m, i) {
      if (isRemovedAgent(m.agent)) return null;
      var kp = String(m.key || '').split('-');
      if (kp.length !== 3) return null;
      var day = new Date(+kp[0], +kp[1] - 1, +kp[2]);
      if (isNaN(day)) return null;
      return {
        id: 'ms' + i,
        agent: canonicalAgent(m.agent) || 'Unassigned',  // stones saved under an old spelling follow the rename
        title: '💰 ' + m.merchant + ' hit ' + milestoneLabel(m.level),
        notes: m.merchant + ' crossed $' + Number(m.level).toLocaleString('en-US') + ' in volume — ' + (m.agent || 'the agent') + ' is getting paid!',
        location: '', status: 'Payout', phone: '',
        extra: [['Merchant', m.merchant], ['Milestone', '$' + Number(m.level).toLocaleString('en-US') + ' in volume']],
        day: day, key: dateKey(day), start: null, end: null, allDay: true,
        milestone: m.level,
      };
    }).filter(Boolean);
  }

  // Rebuild state.events from an appointments payload + recorded milestones.
  function applyData(payload) {
    var evs = normalize(payload).concat(milestoneEventObjects());
    evs.sort(function (a, b) {
      if (a.key !== b.key) return a.key < b.key ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      var ta = a.start ? a.start.getTime() : 0, tb = b.start ? b.start.getTime() : 0;
      return ta - tb || a.agent.localeCompare(b.agent);
    });
    state.events = evs;
    rebuildAgents(); refreshAgentColorMap();
  }

  function isPayout(e) {
    if (e.milestone) return true;
    var st = (e.status || '').toLowerCase();
    return st === 'payout' || st === 'paid' || st === 'bonus';
  }

  function rebuildAgents() {
    var names = [], seen = Object.create(null);
    // Roster first — fixed order, always shown so every agent is filterable.
    for (var r = 0; r < ROSTER.length; r++) {
      if (!seen[ROSTER[r]]) { seen[ROSTER[r]] = true; names.push(ROSTER[r]); }
    }
    // Then any agents that appear in the data but aren't on the roster (sorted).
    var extra = [];
    for (var i = 0; i < state.events.length; i++) {
      var n = state.events[i].agent;
      if (!seen[n]) { seen[n] = true; extra.push(n); }
    }
    extra.sort(function (a, b) { return a.localeCompare(b); });
    names = names.concat(extra);

    state.agents = names.map(function (n, i) {
      return { name: n, color: AGENT_PALETTE[i % AGENT_PALETTE.length], initials: initials(n) };
    });
    // drop hidden entries for agents that no longer exist
    var live = new Set(names);
    state.hidden.forEach(function (h) { if (!live.has(h)) state.hidden.delete(h); });
  }
  var _agentColor = Object.create(null);
  function agentColor(name) {
    return _agentColor[name] || '#A7ABB3';
  }
  function refreshAgentColorMap() {
    _agentColor = Object.create(null);
    state.agents.forEach(function (a) { _agentColor[a.name] = a.color; });
  }

  /* ---------------- Filtering ---------------- */
  function visibleEvents() {
    var q = state.query.trim().toLowerCase();
    return state.events.filter(function (e) {
      if (state.hidden.has(e.agent)) return false;
      if (q) {
        var hay = (e.title + ' ' + e.agent + ' ' + e.location + ' ' + e.notes + ' ' + e.status).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function eventsForDay(list, d) {
    var k = dateKey(d);
    return list.filter(function (e) { return e.key === k; });
  }

  /* ---------------- Demo data ---------------- */
  function demoEvents() {
    var agents = ROSTER;
    var merchants = ["Joe's Diner", 'Lube Express', 'Taqueria El Sol', 'Ace Hardware', 'Bella Nails',
      'Summit Coffee', 'Maverick BBQ', 'West Texas Tire', 'The Corner Store', 'Golden Dragon',
      'Cactus Flower Boutique', 'Permian Auto Glass', 'Sunrise Donuts', 'Big Sky Vape', 'Rustic Roots Salon'];
    var kinds = ['Demo', 'Statement review', 'Install', 'Follow-up', 'Signing', 'Service call', 'Drop-in'];
    var statuses = ['Confirmed', 'Confirmed', 'Pending', 'Confirmed', 'Follow-up', 'Confirmed', 'Pending'];
    var locations = ['Odessa, TX', 'Midland, TX', 'Lubbock, TX', 'Abilene, TX', 'San Angelo, TX', 'Big Spring, TX'];
    var seed = 42; function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    var out = [], base = new Date(), first = new Date(base.getFullYear(), base.getMonth() - 1, 1), idx = 0;
    for (var d = 0; d < 92; d++) {
      var day = addDays(first, d), dow = day.getDay();
      for (var a = 0; a < agents.length; a++) {
        var n = rnd();
        var count = dow === 0 ? 0 : dow === 6 ? (n > 0.78 ? 1 : 0) : n > 0.84 ? 3 : n > 0.52 ? 2 : n > 0.24 ? 1 : 0;
        for (var c = 0; c < count; c++) {
          var h = 8 + Math.floor(rnd() * 9), m = [0, 15, 30, 45][Math.floor(rnd() * 4)], dur = [30, 45, 60, 90][Math.floor(rnd() * 4)];
          var endMin = h * 60 + m + dur;
          out.push({
            agent: agents[a], title: kinds[Math.floor(rnd() * kinds.length)] + ' — ' + merchants[Math.floor(rnd() * merchants.length)],
            date: dateKey(day), time: pad2(h) + ':' + pad2(m), end: pad2(Math.floor(endMin / 60)) + ':' + pad2(endMin % 60),
            status: statuses[Math.floor(rnd() * statuses.length)], location: locations[Math.floor(rnd() * locations.length)],
            phone: '(432) 555-0' + (100 + Math.floor(rnd() * 899)),
            mid: 'WP-' + (100000 + Math.floor(rnd() * 899999)),
            equipment: rnd() > 0.6 ? 'Clover Flex' : 'Dejavoo QD3',
            notes: rnd() > 0.82 ? 'Bring updated rate sheet.' : '', _i: idx++,
          });
        }
      }
    }
    // Demo payout milestones so the feature is visible without a live feed
    var payoutDemos = [
      { m: 'Summit Coffee', a: 'Kyle Pettit', lvl: '$1K', off: -3 },
      { m: 'Maverick BBQ', a: 'Haley Woodruff', lvl: '$1K', off: 0 },
      { m: 'Golden Dragon', a: 'Justin Woodruff', lvl: '$5K', off: 0 },
      { m: 'Ace Hardware', a: 'Jaden Dufek', lvl: '$5K', off: 4 },
    ];
    payoutDemos.forEach(function (p) {
      out.push({
        agent: p.a, title: '💰 ' + p.m + ' hit ' + p.lvl, date: dateKey(addDays(base, p.off)), status: 'Payout',
        notes: p.m + ' crossed ' + (p.lvl === '$5K' ? '$5,000' : '$1,000') + ' in volume — ' + p.a + ' is getting paid!',
      });
    });
    return out;
  }

  /* ---------------- Data loading ---------------- */
  // Baked-in team feed: when set, every visitor (and every installed copy of
  // the app) connects to this Apps Script web app with zero setup. A URL saved
  // in Settings still overrides it on that device.
  var DEFAULT_FEED_URL = '';

  function scriptUrl() {
    var u = (getStore(LS.url) || '').trim();
    if (SCRIPT_URL_RE.test(u)) return u;     // re-validate on every read
    return SCRIPT_URL_RE.test(DEFAULT_FEED_URL) ? DEFAULT_FEED_URL : '';
  }
  function volumeUrl() {
    var u = (getStore(LS.volUrl) || '').trim();
    return SCRIPT_URL_RE.test(u) ? u : '';
  }
  function demoOn() { return getStore(LS.demo) === '1'; }

  function loadFromCache() {
    try {
      var c = JSON.parse(getStore(LS.cache) || 'null');
      if (c && c.raw) {
        applyData(c.raw);
        state.updatedAt = c.at ? new Date(c.at) : null;
        return true;
      }
    } catch (e) {}
    return false;
  }

  var freshFlag = false; // set during manual refresh / Save & Test: bypasses the server-side cache

  function buildUrl(url, extra) {
    var range = 'from=' + dateKey(addMonths(state.date, -2)) + '&to=' + dateKey(addDays(addMonths(state.date, 3), -1));
    // Cache-buster defeats any intermediary caching of the /exec response.
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + range + '&t=' + Date.now() + (freshFlag ? '&fresh=1' : '') + (extra || '');
  }

  var ACCESS_HINT = 'Couldn’t reach the web app. In your Apps Script deployment, set “Who has access” to “Anyone”, deploy a NEW version, and use the URL ending in /exec.';

  // Primary path: a normal CORS fetch. Works when the web app is public and
  // returns JSON with CORS headers (the usual case).
  function fetchViaFetch(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 25000) : null;
    return fetch(buildUrl(url), { method: 'GET', redirect: 'follow', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) { var e = new Error('The Apps Script responded with HTTP ' + res.status + '.'); e.http = true; throw e; }
        return res.text();
      })
      .then(function (text) {
        try { return JSON.parse(text); }
        catch (e) {
          if (/<html|<!doctype/i.test(text)) { var e2 = new Error('The URL returned a Google sign-in page — set the web app access to “Anyone”.'); e2.http = true; throw e2; }
          var e3 = new Error('The response was not JSON. Check that the URL is the /exec web app URL.'); e3.http = true; throw e3;
        }
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        if (err && err.name === 'AbortError') { var e = new Error('Request timed out after 25s.'); e.http = true; throw e; }
        // A bare TypeError with no HTTP status = the browser blocked the read
        // (CORS / cross-origin login redirect). Mark it so we can try JSONP.
        if (!err.http) { err.network = true; }
        throw err;
      });
  }

  // Fallback path: JSONP via <script>. Bypasses CORS completely. Works when the
  // web app is public and echoes a ?callback= (the reference Code.gs does).
  var jsonpN = 0;
  function fetchViaJsonp(url) {
    return new Promise(function (resolve, reject) {
      var cb = '__tmcb' + (++jsonpN) + '_' + (jsonpN * 2654435761 % 1000000);
      var s = document.createElement('script');
      var done = false;
      var timer = setTimeout(function () { if (!done) { cleanup(); reject(new Error('timeout')); } }, 25000);
      function cleanup() {
        done = true; clearTimeout(timer);
        try { delete window[cb]; } catch (e) { window[cb] = undefined; }
        if (s.parentNode) s.parentNode.removeChild(s);
      }
      window[cb] = function (data) { cleanup(); resolve(data); };
      s.onerror = function () { if (!done) { cleanup(); reject(new Error('script error')); } };
      s.src = buildUrl(url, '&callback=' + cb);
      document.head.appendChild(s);
    });
  }

  // Apps Script round trips are the slow part of loading (cold starts can take
  // 10-30s). Two speedups: remember which transport worked last time and use
  // it directly, and when the transport is unknown, race fetch and JSONP in
  // parallel and take the first success (doGet is a read, so this is safe).
  function tagTransport(name) {
    return function (data) { setStore(LS.transport, name); return data; };
  }

  function fetchAppointments(url) {
    if (!SCRIPT_URL_RE.test(url)) return Promise.reject(new Error('Invalid Apps Script URL.'));
    var pref = getStore(LS.transport);

    if (pref === 'jsonp') {
      return fetchViaJsonp(url).then(tagTransport('jsonp')).catch(function () {
        return fetchViaFetch(url).then(tagTransport('fetch'));
      });
    }
    if (pref === 'fetch') {
      return fetchViaFetch(url).then(tagTransport('fetch')).catch(function (err) {
        if (err && err.network) {
          return fetchViaJsonp(url).then(tagTransport('jsonp')).catch(function () { throw new Error(ACCESS_HINT); });
        }
        throw err;
      });
    }

    // Transport unknown (first connect): race both, first success wins.
    return new Promise(function (resolve, reject) {
      var fails = 0, bestErr = null, done = false;
      function win(name) { return function (data) { if (done) return; done = true; setStore(LS.transport, name); resolve(data); }; }
      function lose(err) {
        if (err && err.http && (!bestErr || !bestErr.http)) bestErr = err;
        else if (!bestErr) bestErr = err;
        if (++fails === 2 && !done) { done = true; reject(bestErr && bestErr.http ? bestErr : new Error(ACCESS_HINT)); }
      }
      fetchViaFetch(url).then(win('fetch'), lose);
      fetchViaJsonp(url).then(win('jsonp'), lose);
    });
  }

  function recordSync(info) {
    info.at = Date.now();
    setStore(LS.lastSync, JSON.stringify(info));
  }

  function refresh(interactive) {
    var url = scriptUrl();
    // A real connection always wins: if a URL is configured, live data is
    // fetched and demo mode is switched off. Demo only applies with no URL.
    if (!url) {
      if (demoOn()) { state.events = normalize(demoEvents()); state.updatedAt = new Date(); rebuildAgents(); refreshAgentColorMap(); }
      state.loading = false; state.error = null; renderAll();
      return Promise.resolve();
    }
    if (demoOn()) { setStore(LS.demo, ''); state.events = []; }

    var seq = ++reqSeq;                      // race guard
    freshFlag = !!interactive;               // manual refresh skips the server cache
    state.loading = state.events.length === 0;
    state.error = null;
    if (interactive) $('btn-refresh').classList.add('spinning');
    renderAll();

    var volNote = '';
    var t0 = Date.now();

    // Fire the appointments and volume feeds in PARALLEL — the volume feed
    // failing is non-fatal and must never delay or block appointments.
    var pVol = volumeUrl()
      ? fetchAppointments(volumeUrl()).catch(function (e2) {
          volNote = 'volume feed failed: ' + ((e2 && e2.message) || 'unreachable');
          return null;
        })
      : Promise.resolve(null);

    return fetchAppointments(url)
      .then(function (payload) {
        if (seq !== reqSeq) return;          // a newer refresh already won
        // Paint appointments IMMEDIATELY — don't wait for the volume feed.
        processMerchants(extractMerchants(payload, false) || []);
        applyData(payload);
        state.updatedAt = new Date(); state.error = null;
        setStore(LS.cache, JSON.stringify({ at: Date.now(), raw: payload }));
        state.loading = false; renderAll();
        return pVol.then(function (p2) {
          if (seq !== reqSeq) return;
          if (p2) { processMerchants(extractMerchants(p2, true) || []); applyData(payload); }
          recordSync({ ok: true, rows: state.events.length, skipped: state.skipped, ms: Date.now() - t0, note: volNote || undefined });
        });
      })
      .catch(function (err) {
        if (seq === reqSeq) {
          state.error = (err && err.message) || 'Could not reach your Apps Script.';
          recordSync({ ok: false, err: state.error });
        }
      })
      .then(function () {
        freshFlag = false;
        if (seq !== reqSeq) return;
        state.loading = false; $('btn-refresh').classList.remove('spinning'); renderAll();
      });
  }

  /* ============================================================
     RENDER
     ============================================================ */
  /* ---------------- Live ticker: today's itinerary + payouts ---------------- */
  var tickerSig = null;      // rebuild only when content changes, so the scroll never restarts mid-glide
  var tickerEvents = [];     // items by index, for click → detail panel

  function tickerItems() {
    var today = eventsForDay(visibleEvents(), new Date());
    var payouts = [], allday = [], timed = [];
    today.forEach(function (e) {
      if (isPayout(e)) payouts.push(e);
      else if (e.allDay || !e.start) allday.push(e);
      else timed.push(e);
    });
    timed.sort(function (a, b) { return a.start - b.start; });
    return payouts.concat(allday, timed);
  }

  function renderTicker() {
    var track = $('ticker-track');
    if (!track) return;
    var items = tickerItems();
    var sig = state.loading && !items.length ? '~loading' : items.map(function (e) {
      return (e.allDay ? 'AD' : +e.start) + '|' + e.title + '|' + e.agent;
    }).join(';');
    if (sig === tickerSig) return;
    tickerSig = sig;
    tickerEvents = items;

    var seq = el('div', 'tick-seq');
    if (!items.length) {
      var msg = el('span', 'tick-msg');
      msg.textContent = state.loading ? 'Loading today’s board…' : 'No appointments on today’s board — check back soon';
      seq.appendChild(msg);
    } else {
      items.forEach(function (e, i) {
        var it = el('button', 'tick-item' + (isPayout(e) ? ' is-payout' : ''));
        it.setAttribute('data-i', String(i));
        it.setAttribute('tabindex', '-1'); // strip is decorative; the calendar carries the accessible copy
        it.style.setProperty('--agent-c', agentColor(e.agent));
        var when = isPayout(e) ? '💰' : (e.allDay || !e.start ? 'All day' : fmtTime(e.start));
        var title = isPayout(e) ? e.title.replace(/^💰\s*/, '') : e.title; // the badge already carries the moneybag
        it.innerHTML = '<span class="tick-dot"></span><span class="tick-time">' + esc(when) + '</span>' +
          '<span class="tick-title">' + esc(title) + '</span><span class="tick-agent">' + esc(e.agent) + '</span>';
        seq.appendChild(it);
        var sp = el('span', 'tick-sep'); sp.textContent = '◆'; seq.appendChild(sp);
      });
    }

    track.style.animation = 'none';        // reset the loop for the new content
    track.innerHTML = '';
    track.appendChild(seq);

    // Fill the viewport with repeats, then append one full copy: sliding by
    // exactly one sequence width loops seamlessly.
    var viewport = track.parentNode;
    var baseHTML = seq.innerHTML, guard = 0;
    while (seq.offsetWidth < (viewport.offsetWidth || 0) && guard++ < 20)
      seq.insertAdjacentHTML('beforeend', baseHTML);
    var w = seq.offsetWidth;
    track.appendChild(seq.cloneNode(true));
    track.style.setProperty('--tick-shift', '-' + w + 'px');
    track.style.setProperty('--tick-dur', Math.max(16, Math.round(w / 65)) + 's');
    track.style.animation = '';
  }

  function renderAll() {
    // view switcher state
    var vs = document.querySelectorAll('.vs-btn');
    for (var i = 0; i < vs.length; i++) {
      var on = vs[i].getAttribute('data-view') === state.view;
      vs[i].classList.toggle('is-active', on); vs[i].setAttribute('aria-checked', String(on));
    }
    var bn = document.querySelectorAll('.bn-btn');
    for (var b = 0; b < bn.length; b++) bn[b].classList.toggle('is-active', bn[b].getAttribute('data-view') === state.view);

    $('current-label').textContent = headerLabel();
    renderMini(); renderAgents(); renderSideStats(); renderBanner();
    renderTicker();

    var host = $('view-host');
    if (state.loading) { host.innerHTML = ''; host.appendChild(skeleton()); return; }
    host.innerHTML = '';
    if (state.view === 'month') host.appendChild(renderMonth());
    else if (state.view === 'week') host.appendChild(renderTimeGrid(weekCols()));
    else if (state.view === 'day') host.appendChild(renderTimeGrid(1));
    else host.appendChild(renderSchedule());
    renderFooterMeta();
  }

  function headerLabel() {
    var narrow = isNarrow();
    if (state.view === 'month' || state.view === 'schedule') {
      return narrow
        ? state.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : fmtMonthLabel(state.date);
    }
    if (state.view === 'day') {
      return narrow
        ? state.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : fmtDayLabel(state.date);
    }
    var span = weekCols();
    var ws = span === 7 ? startOfWeek(state.date) : startOfDay(state.date), we = addDays(ws, span - 1);
    if (narrow) {
      var a = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return a + ' – ' + (ws.getMonth() === we.getMonth()
        ? we.getDate()
        : we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
    if (ws.getMonth() === we.getMonth())
      return ws.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' – ' + we.getDate() + ', ' + we.getFullYear();
    if (ws.getFullYear() === we.getFullYear())
      return ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' + we.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + we.getFullYear();
    return ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' – ' + we.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function skeleton() {
    var w = el('div', 'skeleton-wrap');
    var s = el('div', 'skeleton'); s.style.flex = '1';
    w.appendChild(s); return w;
  }

  /* ----- Mini calendar ----- */
  function renderMini() {
    $('mini-label').textContent = fmtMonthLabel(state.miniAnchor);
    var host = $('mini-grid'); host.innerHTML = '';
    var dows = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    dows.forEach(function (d) { var c = el('div', 'mini-dow'); c.textContent = d; host.appendChild(c); });
    var y = state.miniAnchor.getFullYear(), m = state.miniAnchor.getMonth();
    var first = new Date(y, m, 1), gridStart = addDays(first, -first.getDay());
    var vis = visibleEvents();
    var withEv = Object.create(null);
    vis.forEach(function (e) { withEv[e.key] = true; });
    var todayK = dateKey(new Date()), selK = dateKey(state.date);
    for (var i = 0; i < 42; i++) {
      var d = addDays(gridStart, i), k = dateKey(d);
      var btn = el('button', 'mini-day');
      if (d.getMonth() !== m) btn.classList.add('is-out');
      if (withEv[k]) btn.classList.add('has-ev');
      if (k === todayK) btn.classList.add('is-today');
      if (k === selK) btn.classList.add('is-sel');
      btn.textContent = d.getDate();
      btn.setAttribute('aria-label', fmtDayLabel(d));
      (function (dd) { btn.addEventListener('click', function () { selectDate(dd); }); })(d);
      host.appendChild(btn);
    }
  }

  /* ----- Agents (My calendars) ----- */
  function updateAgentsAllLabel() {
    var b = $('agents-all');
    if (b) b.textContent = state.hidden.size ? 'Select all' : 'Hide all';
  }

  function renderAgents() {
    updateAgentsAllLabel();
    var host = $('agent-list'); host.innerHTML = '';
    if (!state.agents.length) { host.innerHTML = '<div class="agent-cnt" style="padding:6px 8px">No agents yet</div>'; return; }
    // Per-agent badge = appointments in the CURRENT calendar month only
    // (payout milestones excluded — they aren't deals)
    var now = new Date();
    var counts = Object.create(null);
    state.events.forEach(function (e) {
      if (isPayout(e)) return;
      if (e.day.getFullYear() !== now.getFullYear() || e.day.getMonth() !== now.getMonth()) return;
      counts[e.agent] = (counts[e.agent] || 0) + 1;
    });
    state.agents.forEach(function (a) {
      var on = !state.hidden.has(a.name);
      var btn = el('button', 'agent-toggle');
      btn.setAttribute('aria-pressed', String(on));
      btn.style.setProperty('--agent-c', a.color);
      var chk = el('span', 'agent-check');
      chk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var nm = el('span', 'agent-name'); nm.textContent = a.name;
      var cn = el('span', 'agent-cnt'); cn.textContent = counts[a.name] || 0; cn.title = 'Appointments this month';
      btn.appendChild(chk); btn.appendChild(nm); btn.appendChild(cn);
      btn.addEventListener('click', function () {
        if (state.hidden.has(a.name)) state.hidden.delete(a.name); else state.hidden.add(a.name);
        persistHidden(); renderAll();
      });
      host.appendChild(btn);
    });
  }
  function persistHidden() {
    var arr = [];
    state.hidden.forEach(function (h) { arr.push(h); });
    setStore(LS.hidden, JSON.stringify(arr));
  }

  /* ----- Side stats: follow the SELECTED day, not just today ----- */
  function renderSideStats() {
    var host = $('side-stats'); host.innerHTML = '';
    var day = startOfDay(state.date);
    var list = eventsForDay(visibleEvents(), day);
    var agentsBooked = Object.create(null), payouts = 0, appts = 0;
    list.forEach(function (e) {
      if (isPayout(e)) { payouts++; return; }
      appts++;
      agentsBooked[e.agent] = true;
    });
    var title = $('glance-title');
    if (title) {
      title.textContent = dateKey(day) === dateKey(new Date())
        ? 'Today at a glance'
        : day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at a glance';
    }
    var rows = [
      { n: appts, l: appts === 1 ? 'Appointment' : 'Appointments', c: '#1E8FE8', kind: 'appts' },
      { n: Object.keys(agentsBooked).length, l: 'Agents booked', c: '#2EB875', kind: 'agents' },
      { n: payouts, l: payouts === 1 ? 'Payout' : 'Payouts', c: '#D4A017', kind: 'payouts' },
    ];
    rows.forEach(function (r) {
      var s = el('button', 'side-stat'); s.style.setProperty('--ss-c', r.c);
      s.setAttribute('aria-label', r.n + ' ' + r.l + ' — view breakdown');
      var num = el('span', 'ss-num'); num.textContent = r.n;
      var lab = el('span', 'ss-label'); lab.textContent = r.l;
      var chev = el('span', 'ss-chev'); chev.textContent = '›';
      s.appendChild(num); s.appendChild(lab); s.appendChild(chev);
      s.addEventListener('click', function () { openGlancePanel(r.kind); });
      host.appendChild(s);
    });
  }

  /* ----- Glance tile breakdown panel ----- */
  function openGlancePanel(kind) {
    closePopover();
    popOpen = true;
    var layer = $('popover-layer'); layer.style.pointerEvents = 'auto';
    var scrim = el('div', 'pop-scrim'); scrim.addEventListener('click', closePopover);
    layer.appendChild(scrim);

    var day = startOfDay(state.date);
    var list = eventsForDay(visibleEvents(), day);
    var appts = list.filter(function (e) { return !isPayout(e); });
    var pays = list.filter(isPayout);

    var conf = {
      appts: { title: 'Appointments', c: '#1E8FE8' },
      agents: { title: 'Agents booked', c: '#2EB875' },
      payouts: { title: 'Payouts', c: '#D4A017' },
    }[kind] || { title: 'Details', c: '#1E8FE8' };

    var pop = el('aside', 'detail-panel glance-panel');
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'true');
    pop.style.setProperty('--agent-c', conf.c);
    pop.innerHTML = '<div class="pop-accent"></div>' +
      '<button class="icon-btn small pop-close" aria-label="Close"><svg viewBox="0 0 24 24" class="ic"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      '<div class="pop-title">' + conf.title + '</div>' +
      '<div class="glance-sub">' + esc(fmtDayLabel(day)) + '</div>';

    var body = el('div', 'glance-list');
    function addEmpty(msg) { var d = el('div', 'glance-empty'); d.textContent = msg; body.appendChild(d); }

    if (kind === 'appts') {
      if (!appts.length) addEmpty('No appointments on this day.');
      appts.forEach(function (e) { body.appendChild(scheduleItem(e)); });
    } else if (kind === 'payouts') {
      if (!pays.length) addEmpty('No payout milestones on this day.');
      pays.forEach(function (e) { body.appendChild(scheduleItem(e)); });
    } else {
      var byAgent = Object.create(null), order = [];
      appts.forEach(function (e) {
        if (!byAgent[e.agent]) { byAgent[e.agent] = []; order.push(e.agent); }
        byAgent[e.agent].push(e);
      });
      order.sort(function (a, b) { return a.localeCompare(b); });
      if (!order.length) addEmpty('No agents booked on this day.');
      order.forEach(function (name) {
        var h = el('div', 'gl-agent-head');
        h.innerHTML = '<span class="ev-dot" style="background:' + safeColor(agentColor(name)) + '"></span>' +
          '<b>' + esc(name) + '</b>' +
          '<span class="gl-cnt">' + byAgent[name].length + ' appt' + (byAgent[name].length === 1 ? '' : 's') + '</span>';
        body.appendChild(h);
        byAgent[name].forEach(function (e) { body.appendChild(scheduleItem(e)); });
      });
    }
    pop.appendChild(body);
    pop.appendChild(closeBar());
    layer.appendChild(pop);
    pop.querySelector('.pop-close').addEventListener('click', closePopover);
  }

  function renderBanner() {
    var b = $('banner');
    if (state.error) {
      b.hidden = false; b.className = 'banner warn';
      b.innerHTML = '<span>⚠️ ' + esc(state.error) + '</span><button class="link-btn" data-act="retry">Try again</button><button class="link-btn" data-act="settings">Settings</button>';
      return;
    }
    if (demoOn() && !scriptUrl()) {
      b.hidden = false; b.className = 'banner';
      b.innerHTML = '<span><strong>Demo data.</strong> Connect your Google Apps Script to see Team Maverick’s live appointments.</span><button class="link-btn" data-act="settings">Open Settings</button>';
      return;
    }
    if (!scriptUrl()) {
      b.hidden = false; b.className = 'banner';
      b.innerHTML = '<span><strong>Welcome!</strong> Paste your Apps Script web app URL to load your team’s appointments.</span><button class="link-btn" data-act="settings">Connect</button><button class="link-btn" data-act="demo">Preview with demo data</button>';
      return;
    }
    b.hidden = true; b.innerHTML = '';
  }

  function renderFooterMeta() {
    // reflected into the sidebar "today" section title tooltip; keep lightweight
  }

  /* ============================================================
     MONTH
     ============================================================ */
  function renderMonth() {
    var wrap = el('div', 'view');
    var month = el('div', 'month');
    var dow = el('div', 'month-dow');
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) { var s = el('span'); s.textContent = d; dow.appendChild(s); });
    month.appendChild(dow);

    var grid = el('div', 'month-grid');
    var y = state.date.getFullYear(), m = state.date.getMonth();
    var first = new Date(y, m, 1), gridStart = addDays(first, -first.getDay());
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var rows = Math.ceil((first.getDay() + daysInMonth) / 7);

    var vis = visibleEvents();
    var byKey = Object.create(null);
    vis.forEach(function (e) { (byKey[e.key] || (byKey[e.key] = [])).push(e); });
    var todayK = dateKey(new Date());

    for (var i = 0; i < rows * 7; i++) {
      var d = addDays(gridStart, i), k = dateKey(d), evs = byKey[k] || [];
      var cell = el('div', 'mday');
      cell.setAttribute('data-day', k);
      if (d.getMonth() !== m) cell.classList.add('is-out');
      if (k === todayK) cell.classList.add('is-today');
      // The whole cell opens that day (chips stopPropagation to open details)
      (function (dd) {
        cell.addEventListener('click', function () {
          state.date = dd; state.view = 'day'; setStore(LS.view, 'day'); syncMini(); renderAll();
        });
      })(d);
      cell.style.cursor = 'pointer';

      var num = el('button', 'mnum'); num.textContent = d.getDate();
      num.setAttribute('aria-label', fmtDayLabel(d) + ', ' + evs.length + ' appointments');
      (function (dd) { num.addEventListener('click', function (e) { e.stopPropagation(); state.date = dd; state.view = 'day'; setStore(LS.view, 'day'); syncMini(); renderAll(); }); })(d);
      cell.appendChild(num);

      var evBox = el('div', 'mday-events');
      var maxChips = 3;
      for (var c = 0; c < Math.min(evs.length, maxChips); c++) evBox.appendChild(monthChip(evs[c]));
      if (evs.length > maxChips) {
        var more = el('button', 'mmore'); more.textContent = '+' + (evs.length - maxChips) + ' more';
        (function (dd) { more.addEventListener('click', function (e) { e.stopPropagation(); state.date = dd; state.view = 'day'; setStore(LS.view, 'day'); syncMini(); renderAll(); }); })(d);
        evBox.appendChild(more);
      }
      cell.appendChild(evBox);

      if (evs.length) {
        var dots = el('div', 'mday-dots');
        for (var dd2 = 0; dd2 < Math.min(evs.length, 6); dd2++) { var i2 = el('i'); i2.style.setProperty('--agent-c', agentColor(evs[dd2].agent)); dots.appendChild(i2); }
        cell.appendChild(dots);
      }
      grid.appendChild(cell);
    }
    month.appendChild(grid);
    wrap.appendChild(month);
    return wrap;
  }

  function monthChip(e) {
    var chip = el('button', 'mev' + (isCancelled(e) ? ' is-cancelled' : '') + (isPayout(e) ? ' is-payout' : ''));
    chip.style.setProperty('--agent-c', agentColor(e.agent));
    var inner = '';
    if (!e.allDay && e.start) inner += '<span class="mev-t">' + esc(shortTime(e.start)) + '</span>';
    else inner += '<span class="ev-dot" style="background:' + safeColor(agentColor(e.agent)) + '"></span>';
    inner += '<span class="mev-title">' + esc(e.title) + '</span>';
    chip.innerHTML = inner;
    chip.addEventListener('click', function (ev) { ev.stopPropagation(); openPopover(e, chip); });
    return chip;
  }

  function shortTime(d) { var h = d.getHours() % 12 || 12, m = d.getMinutes(); return h + (m ? ':' + pad2(m) : '') + (d.getHours() < 12 ? 'a' : 'p'); }
  function isCancelled(e) { return /cancel|no-?\s?show/.test(e.status.toLowerCase()); }

  /* ============================================================
     TIME GRID (Day = 1 col, Week = 7 cols)
     ============================================================ */
  function renderTimeGrid(cols) {
    var wrap = el('div', 'view');
    var grid = el('div', 'timegrid');
    var startDay = cols === 7 ? startOfWeek(state.date) : startOfDay(state.date);
    var days = [];
    for (var i = 0; i < cols; i++) days.push(addDays(startDay, i));
    var vis = visibleEvents();
    var todayK = dateKey(new Date());
    var axisW = '52px';
    var colTemplate = axisW + ' repeat(' + cols + ', minmax(0, 1fr))';

    // header — skipped for single-day phone view, where the appbar label
    // already says "Wed, Aug 19" and the band just eats vertical space
    if (cols > 1 || !isNarrow()) {
      var head = el('div', 'tg-head'); head.style.gridTemplateColumns = colTemplate;
      head.appendChild(el('div', 'tg-corner'));
      days.forEach(function (d) {
        var h = el('div', 'tg-daycol-head');
        if (dateKey(d) === todayK) h.classList.add('is-today');
        var dow = el('div', 'tg-dow'); dow.textContent = d.toLocaleDateString('en-US', { weekday: 'short' });
        var num = el('span', 'tg-dnum'); num.textContent = d.getDate();
        h.appendChild(dow); h.appendChild(num);
        if (cols > 1) { h.style.cursor = 'pointer'; (function (dd) { h.addEventListener('click', function () { state.date = dd; state.view = 'day'; setStore(LS.view, 'day'); syncMini(); renderAll(); }); })(d); }
        head.appendChild(h);
      });
      grid.appendChild(head);
    }

    // all-day row
    var alldayByDay = days.map(function (d) { return eventsForDay(vis, d).filter(function (e) { return e.allDay; }); });
    if (alldayByDay.some(function (a) { return a.length; })) {
      var ad = el('div', 'tg-allday' + (cols === 1 ? ' is-day' : ''));
      ad.style.gridTemplateColumns = colTemplate;
      var corner = el('div', 'tg-corner'); corner.innerHTML = 'All<br>day'; ad.appendChild(corner);
      alldayByDay.forEach(function (list) {
        var cell = el('div', 'tg-allday-cell');
        list.forEach(function (e) {
          var chip = el('button', 'allday-chip' + (isCancelled(e) ? ' is-cancelled' : '') + (isPayout(e) ? ' is-payout' : ''));
          chip.style.setProperty('--agent-c', agentColor(e.agent));
          if (cols === 1) {
            // Day view: roomy card with agent + location subtitle
            var sub = esc(e.agent) + (e.location ? ' · ' + esc(e.location) : '');
            chip.innerHTML = '<span class="ev-dot" style="background:' + safeColor(agentColor(e.agent)) + ';margin-top:5px"></span>' +
              '<span class="adc-main"><span class="adc-title">' + esc(e.title) + '</span><span class="adc-sub">' + sub + '</span></span>';
          } else {
            chip.innerHTML = '<span class="ev-dot" style="background:' + safeColor(agentColor(e.agent)) + '"></span><span style="overflow:hidden;text-overflow:ellipsis">' + esc(e.title) + '</span>';
          }
          chip.addEventListener('click', function (ev) { ev.stopPropagation(); openPopover(e, chip); });
          cell.appendChild(chip);
        });
        ad.appendChild(cell);
      });
      grid.appendChild(ad);
    }

    // scrollable body
    var scroll = el('div', 'tg-scroll');
    var body = el('div', 'tg-body'); body.style.gridTemplateColumns = colTemplate;

    var axis = el('div', 'tg-axis');
    for (var hh = 0; hh < 24; hh++) {
      var hr = el('div', 'tg-hour'); hr.style.height = HOUR_H + 'px';
      if (hh > 0) { var lb = el('div', 'tg-hour-label'); lb.textContent = fmtHourLabel(hh); hr.appendChild(lb); }
      axis.appendChild(hr);
    }
    body.appendChild(axis);

    var earliest = 8;
    days.forEach(function (d) {
      var col = el('div', 'tg-col');
      if (dateKey(d) === todayK) col.classList.add('is-today');
      col.style.height = (24 * HOUR_H) + 'px';
      for (var line = 0; line < 24; line++) { var ln = el('div', 'tg-line'); ln.style.top = (line * HOUR_H) + 'px'; col.appendChild(ln); }

      var timed = eventsForDay(vis, d).filter(function (e) { return !e.allDay && e.start; });
      timed.forEach(function (e) { var mins = e.start.getHours() * 60 + e.start.getMinutes(); if (mins / 60 < earliest) earliest = Math.max(0, Math.floor(mins / 60)); });
      layoutColumns(timed).forEach(function (info) {
        col.appendChild(timeEvent(info, cols));
      });

      // now-line
      if (dateKey(d) === todayK) {
        var now = new Date(); var top = (now.getHours() + now.getMinutes() / 60) * HOUR_H;
        var nl = el('div', 'tg-now'); nl.style.top = top + 'px'; col.appendChild(nl);
      }
      body.appendChild(col);
    });

    scroll.appendChild(body);
    grid.appendChild(scroll);
    wrap.appendChild(grid);
    // scroll to earliest event (or 7am)
    setTimeout(function () { scroll.scrollTop = Math.max(0, (Math.min(earliest, 8) - 0.5) * HOUR_H); }, 0);
    return wrap;
  }

  // Greedy column layout for overlapping events within one day.
  function layoutColumns(events) {
    var items = events.map(function (e) { return { e: e, s: startMs(e), end: endOf(e), col: 0, total: 1 }; });
    items.sort(function (a, b) { return a.s - b.s || (b.end - b.s) - (a.end - a.s); });
    var out = [], cluster = [], clusterEnd = -1;
    function flush() {
      if (!cluster.length) return;
      var colEnds = [];
      cluster.forEach(function (item) {
        var placed = false;
        for (var c = 0; c < colEnds.length; c++) {
          if (colEnds[c] <= item.s) { colEnds[c] = item.end; item.col = c; placed = true; break; }
        }
        if (!placed) { item.col = colEnds.length; colEnds.push(item.end); }
      });
      var total = colEnds.length;
      cluster.forEach(function (item) { item.total = total; out.push(item); });
      cluster = []; clusterEnd = -1;
    }
    items.forEach(function (item) {
      if (cluster.length && item.s >= clusterEnd) flush();
      cluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    });
    flush();
    return out;
  }
  function startMs(e) { return e.start.getHours() * 60 + e.start.getMinutes(); }
  function endOf(e) { if (e.end) { var em = e.end.getHours() * 60 + e.end.getMinutes(); return Math.max(em, startMs(e) + 20); } return startMs(e) + DEFAULT_DUR_MIN; }

  function timeEvent(info, cols) {
    var e = info.e;
    var top = (info.s / 60) * HOUR_H;
    var height = Math.max(22, ((info.end - info.s) / 60) * HOUR_H - 2);
    var widthPct = 100 / info.total;
    var node = el('button', 'tev' + (isCancelled(e) ? ' is-cancelled' : '') + (isPayout(e) ? ' is-payout' : '') + (height < 40 ? ' compact' : ''));
    node.style.setProperty('--agent-c', agentColor(e.agent));
    node.style.top = top + 'px'; node.style.height = height + 'px';
    node.style.left = 'calc(' + (info.col * widthPct) + '% + 3px)';
    node.style.width = 'calc(' + widthPct + '% - 6px)';
    var html = '<div class="tev-title">' + esc(e.title) + '</div>';
    if (height >= 40) {
      var timeTxt = esc(fmtTime(e.start)) + (e.end ? ' – ' + esc(fmtTime(e.end)) : '');
      if (cols === 1 && height >= 58) {
        html += '<div class="tev-time">' + timeTxt + '</div><div class="tev-agent">' + esc(e.agent) + '</div>';
      } else if (cols === 1) {
        // Not enough height for a third line — the agent rides with the time
        html += '<div class="tev-time">' + timeTxt + ' · <span class="tev-agent-inline">' + esc(e.agent) + '</span></div>';
      } else {
        html += '<div class="tev-time">' + timeTxt + '</div>';
      }
    }
    node.innerHTML = html;
    node.addEventListener('click', function (ev) { ev.stopPropagation(); openPopover(e, node); });
    return node;
  }

  /* ============================================================
     SCHEDULE (agenda)
     ============================================================ */
  function renderSchedule() {
    var wrap = el('div', 'view');
    var list = el('div', 'schedule');
    var vis = visibleEvents();
    // Show from the 1st of the anchor month through loaded range; group by day.
    var from = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
    var to = addDays(addMonths(from, 2), -1);
    var byKey = Object.create(null), keys = [];
    vis.forEach(function (e) {
      if (e.day < from || e.day > to) return;
      if (!byKey[e.key]) { byKey[e.key] = []; keys.push(e.key); }
      byKey[e.key].push(e);
    });
    keys.sort();

    if (!keys.length) {
      list.appendChild(emptyState('🗓️', 'No appointments' + (state.query ? ' match “' + state.query + '”' : ''), state.query ? 'Try a different search.' : 'Nothing scheduled in this range.'));
      wrap.appendChild(list); return wrap;
    }
    var todayK = dateKey(new Date());
    keys.forEach(function (k) {
      var parts = k.split('-'); var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      var row = el('div', 'sch-day');
      var dateCol = el('div', 'sch-date' + (k === todayK ? ' is-today' : ''));
      dateCol.innerHTML = '<div class="sd-dow">' + d.toLocaleDateString('en-US', { weekday: 'short' }) + '</div>' +
        '<div class="sd-num">' + d.getDate() + '</div>' +
        '<div class="sd-mon">' + d.toLocaleDateString('en-US', { month: 'short' }) + '</div>';
      var items = el('div', 'sch-items');
      byKey[k].forEach(function (e) { items.appendChild(scheduleItem(e)); });
      row.appendChild(dateCol); row.appendChild(items); list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function scheduleItem(e) {
    var node = el('button', 'sch-ev' + (isCancelled(e) ? ' is-cancelled' : '') + (isPayout(e) ? ' is-payout' : ''));
    node.style.setProperty('--agent-c', agentColor(e.agent));
    var timeHtml = e.allDay ? '<div class="st1">All day</div>'
      : '<div class="st1">' + esc(fmtTime(e.start)) + '</div>' + (e.end ? '<div class="st2">to ' + esc(fmtTime(e.end)) + '</div>' : '');
    var meta = ['<span class="ag">' + esc(e.agent) + '</span>'];
    if (e.location) meta.push('<span>📍 ' + esc(e.location) + '</span>');
    node.innerHTML =
      '<div class="sch-time">' + timeHtml + '</div>' +
      '<div class="sch-main">' +
        '<div class="sch-title">' + esc(e.title) + (e.status ? statusPill(e.status) : '') + '</div>' +
        '<div class="sch-meta">' + meta.join('<span class="sep">·</span>') + '</div>' +
        (e.notes ? '<div class="sch-notes">' + esc(e.notes) + '</div>' : '') +
      '</div>';
    node.addEventListener('click', function (ev) { ev.stopPropagation(); openPopover(e, node); });
    return node;
  }

  function statusPill(status) {
    var st = status.toLowerCase().replace(/\s+/g, ' ').trim();
    var c = STATUS_COLORS[st] || STATUS_COLORS[st.replace(/[\s-]/g, '')] || '#A7ABB3';
    return '<span class="status-pill" style="--st-c:' + safeColor(c) + '">' + esc(status) + '</span>';
  }

  function emptyState(emoji, title, sub) {
    var e = el('div', 'empty');
    e.innerHTML = '<div class="empty-emoji">' + emoji + '</div><div class="empty-title">' + esc(title) + '</div><p>' + esc(sub) + '</p>';
    return e;
  }

  /* ============================================================
     EVENT POPOVER
     ============================================================ */
  var popOpen = false;
  function openPopover(e /*, anchor (unused: panel is docked right) */) {
    closePopover();
    popOpen = true;
    var layer = $('popover-layer'); layer.style.pointerEvents = 'auto';
    var scrim = el('div', 'pop-scrim'); scrim.addEventListener('click', closePopover);
    layer.appendChild(scrim);

    var pop = el('aside', 'detail-panel'); pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'true');
    pop.style.setProperty('--agent-c', agentColor(e.agent));

    var rows = '';
    rows += popRow('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      e.allDay ? 'All day · ' + fmtDayLabel(e.day) : fmtDayLabel(e.day) + ' · <b>' + esc(fmtTime(e.start)) + (e.end ? ' – ' + esc(fmtTime(e.end)) : '') + '</b>');
    rows += popRow('<circle cx="12" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
      '<span class="ev-dot" style="background:' + safeColor(agentColor(e.agent)) + ';margin-right:6px"></span><b>' + esc(e.agent) + '</b>');
    if (e.location) {
      rows += popRow('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/>',
        '<a class="detail-link" target="_blank" rel="noopener" href="https://maps.google.com/?q=' + encodeURIComponent(e.location) + '">' + esc(e.location) + '</a>');
    }
    if (e.phone) {
      rows += popRow('<path d="M6.6 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.9 5.9l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
        '<a class="detail-link" href="tel:' + esc(String(e.phone).replace(/[^\d+]/g, '')) + '">' + esc(e.phone) + '</a>');
    }
    if (e.status) rows += popRow('<path d="M5 12l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>', statusPill(e.status));
    if (e.notes) rows += popRow('<path d="M5 5h14v11l-4 4H5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 9h6M9 12.5h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>', esc(e.notes));

    // Everything else the Apps Script sent for this row
    var extraHtml = '';
    if (e.extra && e.extra.length) {
      extraHtml = '<div class="detail-sec">Details</div><dl class="detail-extra">';
      e.extra.forEach(function (pair) {
        extraHtml += '<div><dt>' + esc(pair[0]) + '</dt><dd>' + esc(pair[1]) + '</dd></div>';
      });
      extraHtml += '</dl>';
    }

    pop.innerHTML = '<div class="pop-accent"></div>' +
      '<button class="icon-btn small pop-close" aria-label="Close"><svg viewBox="0 0 24 24" class="ic"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      '<div class="pop-title' + (isPayout(e) ? ' is-payout-title' : '') + '">' + esc(e.title) + '</div>' +
      '<div class="detail-body">' + rows + extraHtml + '</div>';
    pop.appendChild(closeBar());
    layer.appendChild(pop);
    pop.querySelector('.pop-close').addEventListener('click', closePopover);
  }
  // Bottom "Close" pill for phones, where the top-right ✕ is out of reach.
  function closeBar() {
    var bar = el('div', 'dp-close-bar');
    var btn = el('button'); btn.type = 'button'; btn.textContent = 'Close';
    btn.addEventListener('click', closePopover);
    bar.appendChild(btn);
    return bar;
  }
  function popRow(svg, html) {
    return '<div class="pop-row"><svg viewBox="0 0 24 24" class="pic">' + svg + '</svg><div>' + html + '</div></div>';
  }
  function closePopover() {
    popOpen = false;
    var layer = $('popover-layer'); layer.innerHTML = ''; layer.style.pointerEvents = 'none';
  }

  /* ============================================================
     Navigation
     ============================================================ */
  function go(delta) {
    if (state.view === 'day' || state.view === 'schedule') state.date = state.view === 'schedule' ? addMonths(state.date, delta) : addDays(state.date, delta);
    else if (state.view === 'week') state.date = addDays(state.date, delta * weekCols());
    else state.date = clampToToday(addMonths(state.date, delta));
    syncMini(); closePopover(); renderAll();
  }
  function clampToToday(d) {
    var t = new Date();
    return (d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth()) ? t : d;
  }
  function goToday() { state.date = new Date(); syncMini(); closePopover(); renderAll(); }
  function selectDate(d) {
    state.date = d;
    if (state.view === 'month' || state.view === 'schedule') { state.view = 'day'; setStore(LS.view, 'day'); }
    syncMini(); closePopover(); renderAll();
    if (window.innerWidth <= 860) closeSidebar();
  }
  function syncMini() { state.miniAnchor = new Date(state.date.getFullYear(), state.date.getMonth(), 1); }
  function setView(v) {
    if (state.view === v) return;
    state.view = v; setStore(LS.view, v); closePopover(); renderAll();
  }

  /* ============================================================
     Sidebar (mobile)
     ============================================================ */
  function openSidebar() { $('sidebar').classList.add('open'); $('sidebar-scrim').hidden = false; }
  function closeSidebar() { $('sidebar').classList.remove('open'); $('sidebar-scrim').hidden = true; }

  /* ============================================================
     Settings
     ============================================================ */
  function openSettings() {
    $('url-input').value = (getStore(LS.url) || '').trim();
    $('vol-input').value = (getStore(LS.volUrl) || '').trim();
    $('demo-toggle').setAttribute('aria-checked', demoOn() ? 'true' : 'false');
    $('settings-status').textContent = ''; $('settings-status').className = 'settings-status';
    renderConnStatus();
    applyTheme();
    $('settings-backdrop').hidden = false; document.body.style.overflow = 'hidden';
  }

  // Last-sync diagnostics shown in Settings, so "nothing synced" is never silent.
  function renderConnStatus() {
    var el = $('conn-status');
    if (!el) return;
    var bits = ['Build ' + APP_VERSION];
    try {
      var s = JSON.parse(getStore(LS.lastSync) || 'null');
      if (s && s.at) {
        var when = new Date(s.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        if (s.ok) {
          bits.push('last sync ' + when + (s.ms ? ' (' + (s.ms / 1000).toFixed(1) + 's)' : '') + ' · ' + s.rows + ' appointments' + (s.skipped ? ' · ' + s.skipped + ' rows skipped (no date)' : '') + (s.note ? ' · ⚠ ' + s.note : ''));
          if (state.milestones && state.milestones.length) bits.push(state.milestones.length + ' payout milestones tracked');
        } else {
          bits.push('last sync attempt ' + when + ' failed: ' + (s.err || 'unknown error'));
        }
      } else if (scriptUrl()) {
        bits.push('no sync attempted yet');
      } else {
        bits.push('no Apps Script connected');
      }
    } catch (e) {}
    el.textContent = bits.join(' — ');
  }
  function closeSettings() { $('settings-backdrop').hidden = true; document.body.style.overflow = ''; }

  function saveSettings() {
    var url = $('url-input').value.trim();
    var volUrl = $('vol-input').value.trim();
    var status = $('settings-status'), btn = $('settings-save');
    if (url && !SCRIPT_URL_RE.test(url)) {
      status.textContent = 'That doesn’t look like an Apps Script URL (expected https://script.google.com/…/exec).';
      status.className = 'settings-status err'; return;
    }
    if (volUrl && !SCRIPT_URL_RE.test(volUrl)) {
      status.textContent = 'The volume feed should also be an Apps Script /exec URL (it reads the sales portal server-side).';
      status.className = 'settings-status err'; return;
    }
    if (url !== (getStore(LS.url) || '').trim()) setStore(LS.transport, ''); // new deployment may need a different transport
    setStore(LS.url, url);
    setStore(LS.volUrl, volUrl);
    if (!url) { status.textContent = 'Saved.'; status.className = 'settings-status ok'; renderAll(); return; }
    setStore(LS.demo, ''); $('demo-toggle').setAttribute('aria-checked', 'false');
    btn.disabled = true; status.textContent = 'Testing connection…'; status.className = 'settings-status';
    freshFlag = true;                        // Save & Test always fetches fresh
    var seq = ++reqSeq;
    var summary = [];
    fetchAppointments(url).then(function (payload) {
      var evs = normalize(payload);
      summary.push(evs.length + ' appointments');
      processMerchants(extractMerchants(payload, false) || []);
      recordSync({ ok: true, rows: evs.length, skipped: state.skipped });
      if (seq === reqSeq) {
        setStore(LS.cache, JSON.stringify({ at: Date.now(), raw: payload }));
        applyData(payload);
        state.updatedAt = new Date(); state.error = null;
        renderAll();
      }
      if (!volUrl) return;
      status.textContent = 'Appointments OK — testing volume feed…';
      return fetchAppointments(volUrl).then(function (p2) {
        var rows = extractMerchants(p2, true) || [];
        processMerchants(rows);
        summary.push(rows.length + ' merchants in volume feed');
        if (seq === reqSeq && state.milestones.length) summary.push(state.milestones.length + ' payout milestones');
        if (seq === reqSeq) { applyData(payload); renderAll(); }
      });
    }).then(function () {
      status.textContent = '✓ Connected — ' + summary.join(' · ') + '.';
      status.className = 'settings-status ok';
    }).catch(function (err) {
      status.textContent = err.message || 'Could not connect.'; status.className = 'settings-status err';
      recordSync({ ok: false, err: err.message || 'Could not connect.' });
    }).then(function () { freshFlag = false; btn.disabled = false; renderConnStatus(); });
  }

  /* ============================================================
     Init
     ============================================================ */
  function init() {
    // Setup link: ?feed=<web-app-url>(&vol=<url>) connects this browser to the
    // live Team Maverick feed, then disappears from the address bar. Lets one
    // person configure everyone by sharing a single link (Settings → Copy link).
    var feedParam = (urlParams.get('feed') || '').trim();
    if (SCRIPT_URL_RE.test(feedParam)) {
      if (feedParam !== (getStore(LS.url) || '').trim()) setStore(LS.transport, '');
      setStore(LS.url, feedParam);
      var volParam = (urlParams.get('vol') || '').trim();
      if (SCRIPT_URL_RE.test(volParam)) setStore(LS.volUrl, volParam);
      setStore(LS.demo, '');
      try {
        var keepView = urlParams.get('view');
        history.replaceState(null, '', location.pathname + (keepView ? '?view=' + encodeURIComponent(keepView) : ''));
      } catch (e) {}
    }

    // One-time cleanup: earlier builds switched demo data on automatically for
    // new visitors, which reads like someone else's live appointments. Clear
    // any lingering flag; demo is opt-in from Settings from here on.
    if (getStore('tm_migr_demo') !== '1') { setStore(LS.demo, ''); setStore('tm_migr_demo', '1'); }

    // restore prefs
    var storedView = getStore(LS.view);
    if (['day', 'week', 'month', 'schedule'].indexOf(storedView) >= 0) state.view = storedView;
    if (urlParams.get('view') && ['day', 'week', 'month', 'schedule'].indexOf(urlParams.get('view')) >= 0) state.view = urlParams.get('view');
    if (IS_STANDALONE && !urlParams.get('view')) { state.view = 'day'; state.date = new Date(); }
    var dp = urlParams.get('date');
    if (dp && /^\d{4}-\d{2}-\d{2}$/.test(dp)) { var dpp = dp.split('-'); state.date = new Date(+dpp[0], +dpp[1] - 1, +dpp[2]); }
    try { var h = JSON.parse(getStore(LS.hidden) || '[]'); if (Array.isArray(h)) state.hidden = new Set(h); } catch (e) {}
    state.milestones = loadMilestones();
    syncMini();
    applyTheme();

    // logo fallback
    var logo = $('brand-logo');
    function noLogo() { document.querySelector('.appbar').classList.add('no-logo'); }
    logo.addEventListener('error', noLogo);
    if (logo.complete && logo.naturalWidth === 0) noLogo();

    // view switcher + bottom nav
    document.querySelectorAll('.vs-btn').forEach(function (b) { b.addEventListener('click', function () { setView(b.getAttribute('data-view')); }); });
    buildBottomNav();

    $('nav-prev').addEventListener('click', function () { go(-1); });
    $('nav-next').addEventListener('click', function () { go(1); });
    $('nav-today').addEventListener('click', goToday);
    $('mini-prev').addEventListener('click', function () { state.miniAnchor = addMonths(state.miniAnchor, -1); renderMini(); });
    $('mini-next').addEventListener('click', function () { state.miniAnchor = addMonths(state.miniAnchor, 1); renderMini(); });
    $('btn-refresh').addEventListener('click', function () { refresh(true); });
    $('ticker-track').addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.tick-item') : null;
      if (!btn) return;
      var e = tickerEvents[+btn.getAttribute('data-i')];
      if (e) openPopover(e, btn);
    });
    $('btn-theme').addEventListener('click', function () { setStore(LS.theme, resolvedTheme() === 'dark' ? 'light' : 'dark'); applyTheme(); });
    $('btn-settings').addEventListener('click', openSettings);
    $('settings-close').addEventListener('click', closeSettings);
    $('settings-close-m').addEventListener('click', closeSettings);
    $('settings-save').addEventListener('click', saveSettings);
    $('settings-backdrop').addEventListener('click', function (ev) { if (ev.target === this) closeSettings(); });
    $('url-input').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') saveSettings(); });
    $('btn-menu').addEventListener('click', openSidebar);
    $('sidebar-scrim').addEventListener('click', closeSidebar);
    $('shortcuts-close').addEventListener('click', function () { $('shortcuts-backdrop').hidden = true; });
    $('shortcuts-backdrop').addEventListener('click', function (ev) { if (ev.target === this) this.hidden = true; });

    $('agents-all').addEventListener('click', function () {
      if (state.hidden.size) state.hidden.clear();
      else state.agents.forEach(function (a) { state.hidden.add(a.name); });
      persistHidden(); renderAll();
    });
    // keep the button's label honest: "Select all" vs "Hide all"
    updateAgentsAllLabel();

    $('copy-setup').addEventListener('click', function () {
      var status = $('settings-status');
      var url = (getStore(LS.url) || '').trim();
      if (!SCRIPT_URL_RE.test(url)) {
        status.textContent = 'Save your web app URL first, then copy the link.';
        status.className = 'settings-status';
        return;
      }
      var link = location.origin + location.pathname + '?feed=' + encodeURIComponent(url);
      var vol = (getStore(LS.volUrl) || '').trim();
      if (SCRIPT_URL_RE.test(vol)) link += '&vol=' + encodeURIComponent(vol);
      function done(copied) {
        status.textContent = copied
          ? 'Setup link copied — text it to the team. Opening it connects their device to the live calendar.'
          : link; // clipboard unavailable: show the link so it can be copied by hand
        status.className = 'settings-status' + (copied ? ' ok' : '');
      }
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(link).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });

    $('demo-toggle').addEventListener('click', function () {
      var on = this.getAttribute('aria-checked') === 'true';
      var next = !on;
      this.setAttribute('aria-checked', String(next));
      setStore(LS.demo, next ? '1' : '');
      state.events = []; state.error = null;   // clear either way
      reqSeq++;                                // invalidate any in-flight fetch
      refresh(false);
    });

    document.querySelectorAll('[data-theme-pick]').forEach(function (p) {
      p.addEventListener('click', function () { setStore(LS.theme, p.getAttribute('data-theme-pick')); applyTheme(); });
    });

    // search
    var search = $('search');
    search.addEventListener('input', function () {
      state.query = search.value; $('search-clear').hidden = !search.value;
      renderAll();
    });
    $('search-clear').addEventListener('click', function () { search.value = ''; state.query = ''; $('search-clear').hidden = true; renderAll(); search.focus(); });

    $('banner').addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-act]'); if (!btn) return;
      var act = btn.getAttribute('data-act');
      if (act === 'settings') openSettings();
      else if (act === 'retry') refresh(true);
      else if (act === 'demo') { setStore(LS.demo, '1'); state.events = []; refresh(false); }
    });

    // keyboard
    document.addEventListener('keydown', function (ev) {
      // Escape / ? always work, even from inputs
      if (ev.key === 'Escape') {
        if (popOpen) { closePopover(); return; }
        if (!$('settings-backdrop').hidden) { closeSettings(); return; }
        if (!$('shortcuts-backdrop').hidden) { $('shortcuts-backdrop').hidden = true; return; }
        if ($('sidebar').classList.contains('open')) { closeSidebar(); return; }
        if (document.activeElement === search && search.value) { search.value = ''; state.query = ''; $('search-clear').hidden = true; renderAll(); return; }
        return;
      }
      var typing = /^(input|textarea|select)$/i.test((ev.target.tagName || ''));
      if (typing) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (!$('settings-backdrop').hidden || !$('shortcuts-backdrop').hidden) return;
      switch (ev.key) {
        case 'ArrowLeft': go(-1); break;
        case 'ArrowRight': go(1); break;
        case 't': case 'T': goToday(); break;
        case 'd': case 'D': setView('day'); break;
        case 'w': case 'W': setView('week'); break;
        case 'm': case 'M': setView('month'); break;
        case 'a': case 'A': setView('schedule'); break;
        case 'r': case 'R': refresh(true); break;
        case '/': ev.preventDefault(); search.focus(); break;
        case '?': $('shortcuts-backdrop').hidden = false; break;
      }
    });

    // swipe navigation on the view host
    var tx = null, ty = null, host = $('view-host');
    host.addEventListener('touchstart', function (ev) { if (ev.touches.length !== 1) { tx = null; return; } tx = ev.touches[0].clientX; ty = ev.touches[0].clientY; }, { passive: true });
    host.addEventListener('touchend', function (ev) {
      if (tx == null) return;
      var dx = ev.changedTouches[0].clientX - tx, dy = ev.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.7) go(dx < 0 ? 1 : -1);
      tx = null;
    }, { passive: true });

    window.addEventListener('resize', function () { if (popOpen) closePopover(); });

    // re-render when crossing the phone/desktop breakpoint (rotation, resize)
    var wasNarrow = isNarrow();
    window.addEventListener('resize', function () {
      if (isNarrow() !== wasNarrow) { wasNarrow = isNarrow(); renderAll(); }
    });

    // first paint — no auto-demo: an unconfigured browser shows the Connect
    // banner (demo stays available as an explicit choice), never fake data
    // that could be mistaken for another team's live appointments.
    loadFromCache();
    refresh(false);

    setInterval(function () { if (document.visibilityState === 'visible') refresh(false); }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && state.updatedAt && Date.now() - state.updatedAt.getTime() > 60 * 1000) refresh(false);
    });
  }

  function buildBottomNav() {
    var nav = el('div', 'bottom-nav');
    var items = [
      { v: 'day', label: 'Day', icon: '<rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 9h16M8 3v3M16 3v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' },
      { v: 'week', label: 'Week', icon: '<rect x="3" y="6" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 6v13M15 6v13" stroke="currentColor" stroke-width="1.5"/>' },
      { v: 'month', label: 'Month', icon: '<rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9.5h17M9 5v15M15 5v15M3.5 14.5h17" stroke="currentColor" stroke-width="1.3"/>' },
      { v: 'schedule', label: 'Schedule', icon: '<path d="M4 6h4M4 12h4M4 18h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M11 6h9M11 12h9M11 18h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' },
    ];
    items.forEach(function (it) {
      var b = el('button', 'bn-btn'); b.setAttribute('data-view', it.v);
      b.innerHTML = '<svg viewBox="0 0 24 24" class="ic">' + it.icon + '</svg><span>' + it.label + '</span>';
      b.addEventListener('click', function () { setView(it.v); });
      nav.appendChild(b);
    });
    document.body.appendChild(nav);
  }

  // Minimal test surface for automated checks (harmless in production).
  window.TM = { normalize: normalize, normalizeOne: normalizeOne, parseDateTime: parseDateTime, parseDateOnly: parseDateOnly, fetchViaJsonp: fetchViaJsonp, processMerchants: processMerchants, extractMerchants: extractMerchants, applyData: applyData, get state() { return state; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
