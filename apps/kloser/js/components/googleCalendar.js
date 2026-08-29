/**
 * Google Calendar, wired into the Rep Schedule calendar.
 *
 * The month grid is built from the CRM's own datasets. This pulls the connected
 * Google account's events for whatever month is on screen and merges them into
 * the same stream, so an appointment booked in Google shows up here without
 * anyone re-typing it — and an appointment that lives here can be pushed the
 * other way.
 *
 * There is no server in this app, so there is no background sync and no webhook:
 * it fetches when the calendar opens, when the month changes, and when someone
 * presses Sync. What it fetched last is cached in this browser so the calendar
 * still shows Google's events on a cold, offline start.
 *
 * Events pushed from here carry a private extended property with the CRM key, so
 * pulling them back does not draw the same appointment twice.
 */
import { googleFetch, googleState, hasScope, SCOPE_CALENDAR } from './googleAuth.js';
import { prefs, savePrefs } from '../core/store.js';

const API = 'https://www.googleapis.com/calendar/v3';
const LS_CACHE = 'kloser.gcal.cache.v1';
const LS_PUSHED = 'kloser.gcal.pushed.v1';
const CACHE_MONTHS = 12;      // keep a year of months, then drop the oldest
const PAGE_LIMIT = 10;        // 10 × 250 events is far more than a month holds

/* --------------------------------------------------------------- settings */

export const calendarId = () => prefs.gcalId || 'primary';
export const setCalendarId = (id) => savePrefs({ gcalId: (id || 'primary').trim() });

/** Sync on open and on month change, rather than only when asked. Default on. */
export const autoSync = () => prefs.gcalAuto !== false;
export const setAutoSync = (on) => savePrefs({ gcalAuto: Boolean(on) });

export const lastSyncAt = () => Number(prefs.gcalLastSync || 0);

/** Everything the UI needs to decide what to draw. */
export function calendarSyncState() {
  const g = googleState();
  return {
    ...g,
    // A token issued before the calendar scope existed is connected but useless here.
    canSync: g.connected && hasScope(SCOPE_CALENDAR),
    calendarId: calendarId(),
    auto: autoSync(),
    lastSyncAt: lastSyncAt(),
  };
}

/* ------------------------------------------------------------------ cache */

function readCache() {
  try { return JSON.parse(localStorage.getItem(LS_CACHE) || '{}') || {}; } catch { return {}; }
}
function writeCache(obj) {
  try { localStorage.setItem(LS_CACHE, JSON.stringify(obj)); } catch { /* private mode */ }
}

export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const cacheKey = (cal, d) => `${cal}|${monthKey(d)}`;

/** What was fetched for this month last time, still in Google's own shape. */
export function cachedMonth(d, cal = calendarId()) {
  const entry = readCache()[cacheKey(cal, d)];
  return entry && Array.isArray(entry.items) ? entry.items : null;
}

function cacheMonth(d, items, cal = calendarId()) {
  const all = readCache();
  all[cacheKey(cal, d)] = { at: Date.now(), items };
  const keys = Object.keys(all);
  if (keys.length > CACHE_MONTHS) {
    keys.sort((a, b) => (all[a].at || 0) - (all[b].at || 0))
      .slice(0, keys.length - CACHE_MONTHS)
      .forEach((k) => delete all[k]);
  }
  writeCache(all);
}

/** Forget everything pulled from Google. Used when the account is disconnected. */
export function clearCalendarCache() {
  try { localStorage.removeItem(LS_CACHE); } catch { /* private mode */ }
}

/* ------------------------------------------------------------- calendars */

/**
 * The calendars this account can see. The list endpoint needs its own scope, so
 * if Google refuses, fall back to the primary calendar — which the events scope
 * always covers.
 */
export async function listCalendars() {
  const fallback = [{ id: 'primary', summary: 'Primary calendar', primary: true }];
  try {
    const json = await googleFetch(`${API}/users/me/calendarList?minAccessRole=reader&maxResults=100`);
    const items = (json && json.items) || [];
    if (!items.length) return fallback;
    const mapped = items.map((c) => ({
      id: c.id,
      summary: c.summaryOverride || c.summary || c.id,
      primary: Boolean(c.primary),
      writable: c.accessRole === 'owner' || c.accessRole === 'writer',
    }));
    // Primary first, then alphabetical — the order the account list is read in.
    mapped.sort((a, b) => (b.primary - a.primary) || a.summary.localeCompare(b.summary));
    if (!mapped.some((c) => c.primary)) mapped.unshift(fallback[0]);
    return mapped;
  } catch {
    return fallback;
  }
}

/* ---------------------------------------------------------------- fetching */

const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1);

/**
 * Every event in the given window, expanded so a weekly recurrence arrives as
 * the individual days a month grid can actually draw.
 */
export async function fetchRange({ from, to, calendar = calendarId(), signal } = {}) {
  const out = [];
  let pageToken = '';

  for (let page = 0; page < PAGE_LIMIT; page++) {
    const params = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      showDeleted: 'false',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const json = await googleFetch(
      `${API}/calendars/${encodeURIComponent(calendar)}/events?${params.toString()}`,
      signal ? { signal } : {},
    );
    ((json && json.items) || []).forEach((i) => out.push(i));
    pageToken = (json && json.nextPageToken) || '';
    if (!pageToken) break;
  }
  return out;
}

/**
 * One month, plus the days either side that the grid shows from the neighboring
 * months, so nothing in the first or last row is missing.
 */
export async function syncMonth(month, { calendar = calendarId(), force = false } = {}) {
  if (!force) {
    const hit = cachedMonth(month, calendar);
    if (hit) return { items: hit, fromCache: true };
  }
  const from = new Date(monthStart(month).getTime() - 7 * 86400000);
  const to = new Date(monthEnd(month).getTime() + 7 * 86400000);
  const items = await fetchRange({ from, to, calendar });
  cacheMonth(month, items, calendar);
  savePrefs({ gcalLastSync: Date.now() });
  return { items, fromCache: false };
}

/* ------------------------------------------------------------ normalizing */

/** Google writes all-day events as a bare date; read it in local time, not UTC. */
function localDay(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0);   // midday, so a DST edge can't shunt it
}

const STATUS = { confirmed: 'Confirmed', tentative: 'Tentative', cancelled: 'Canceled' };

/**
 * A Google event in the shape the Rep Schedule calendar already speaks.
 * `repNames` is the rep roster; when a rep's name appears in the title, the
 * description or the guest list, the event is attributed to them.
 */
export function normalizeEvent(g, { repIndex, accountName } = {}) {
  if (!g || !g.start) return null;
  const allDay = !g.start.dateTime;
  const date = allDay ? localDay(g.start.date) : new Date(g.start.dateTime);
  if (!date || Number.isNaN(date.getTime())) return null;

  const rep = matchRep(g, repIndex) || accountName || 'Google Calendar';
  const kloserId = (g.extendedProperties && g.extendedProperties.private
    && g.extendedProperties.private.kloserId) || '';

  return {
    date,
    rep,
    company: g.summary || '(no title)',
    title: g.summary || '(no title)',
    notes: g.description || '',
    status: STATUS[g.status] || '',
    type: 'Google Calendar',
    icon: 'google',
    tone: '#4285F4',
    time: allDay ? 'All day' : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    place: g.location || '',
    source: 'google',
    allDay,
    link: g.htmlLink || '',
    organizer: (g.organizer && (g.organizer.displayName || g.organizer.email)) || '',
    attendees: (g.attendees || []).map((a) => a.displayName || a.email).filter(Boolean),
    kloserId,
    googleId: g.id || '',
  };
}

/** A lookup of lowercase rep name → the rep's name as the roster spells it. */
export function repIndexFrom(names) {
  const map = new Map();
  (names || []).forEach((n) => {
    const key = String(n || '').trim().toLowerCase();
    if (key.length > 3) map.set(key, n);
  });
  return map;
}

function matchRep(g, repIndex) {
  if (!repIndex || !repIndex.size) return null;

  // A guest whose name is exactly a rep's is the strongest signal there is.
  for (const a of g.attendees || []) {
    const hit = repIndex.get(String(a.displayName || '').trim().toLowerCase());
    if (hit) return hit;
  }
  const org = repIndex.get(String((g.organizer && g.organizer.displayName) || '').trim().toLowerCase());
  if (org) return org;

  // Otherwise look for a roster name written into the title or the notes.
  const hay = `${g.summary || ''} ${g.description || ''}`.toLowerCase();
  if (!hay.trim()) return null;
  for (const [key, name] of repIndex) {
    if (hay.includes(key)) return name;
  }
  return null;
}

/* --------------------------------------------------------------- pushing */

/** A stable id for a CRM event, so Google and the CRM agree on what is what. */
export function crmKey(e) {
  const d = e.date;
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `kloser-${day}-${slug(e.rep)}-${slug(e.company)}-${slug(e.title)}`.slice(0, 120);
}

function readPushed() {
  try { return JSON.parse(localStorage.getItem(LS_PUSHED) || '{}') || {}; } catch { return {}; }
}
function writePushed(obj) {
  try { localStorage.setItem(LS_PUSHED, JSON.stringify(obj)); } catch { /* private mode */ }
}

/** Has this CRM event already been sent to Google from this browser? */
export const pushedRecord = (e) => readPushed()[crmKey(e)] || null;

const TZ = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'; }
  catch { return 'America/Chicago'; }
};

/**
 * Put a CRM appointment on the connected Google calendar. An hour long, because
 * the CRM's own records carry a start and no end.
 */
export async function pushEvent(e, { calendar = calendarId(), minutes = 60 } = {}) {
  const start = new Date(e.date);
  const end = new Date(start.getTime() + minutes * 60000);
  const id = crmKey(e);

  const body = {
    summary: e.company ? `${e.company}${e.type ? ` — ${e.type}` : ''}` : (e.title || 'Kloser CRM'),
    description: [
      e.title && e.title !== e.company ? e.title : '',
      e.rep ? `Rep: ${e.rep}` : '',
      e.status ? `Status: ${e.status}` : '',
      e.notes || '',
      'Added from Kloser CRM.',
    ].filter(Boolean).join('\n'),
    start: { dateTime: start.toISOString(), timeZone: TZ() },
    end: { dateTime: end.toISOString(), timeZone: TZ() },
    location: e.place || '',
    extendedProperties: { private: { kloserId: id, kloserSource: e.source || 'crm' } },
  };

  const created = await googleFetch(
    `${API}/calendars/${encodeURIComponent(calendar)}/events`,
    { method: 'POST', body: JSON.stringify(body) },
  );

  const map = readPushed();
  map[id] = { googleId: created && created.id, link: created && created.htmlLink, at: Date.now(), calendar };
  writePushed(map);
  savePrefs({ gcalLastSync: Date.now() });
  return created;
}

/** Take one back off the Google calendar again. */
export async function removePushedEvent(e, { calendar = calendarId() } = {}) {
  const id = crmKey(e);
  const map = readPushed();
  const rec = map[id];
  if (!rec || !rec.googleId) return false;
  try {
    await googleFetch(
      `${API}/calendars/${encodeURIComponent(rec.calendar || calendar)}/events/${encodeURIComponent(rec.googleId)}`,
      { method: 'DELETE' },
    );
  } catch (err) {
    if (String(err.message) !== 'not-found') throw err;   // already gone is fine
  }
  delete map[id];
  writePushed(map);
  return true;
}

/* ---------------------------------------------------------------- merging */

/**
 * CRM events first, then whatever Google adds that the CRM does not already
 * have. An event this app pushed comes back from Google carrying its CRM key,
 * which is how the same appointment avoids being drawn twice.
 */
export function mergeEvents(crmEvents, googleEvents) {
  const seen = new Set((crmEvents || []).map((e) => crmKey(e)));
  const extra = (googleEvents || []).filter((g) => !(g.kloserId && seen.has(g.kloserId)));
  return [...(crmEvents || []), ...extra].sort((a, b) => a.date - b.date);
}

/** How long ago, in words, for a line under a Sync button. */
export function agoLabel(ms) {
  if (!ms) return 'never';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return 'just now';
  if (s < 90) return 'a minute ago';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 7200) return 'an hour ago';
  if (s < 86400) return `${Math.round(s / 3600)} hours ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
