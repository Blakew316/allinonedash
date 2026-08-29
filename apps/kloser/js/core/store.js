/**
 * App state + data access.
 * Datasets are fetched once and memoized; UI preferences persist to localStorage.
 */

const LS_KEY = 'kloser.prefs.v1';

const defaults = {
  theme: 'system',          // system | light | dark
  railCollapsed: false,
  navApp: 'google',         // google | apple | waze
  timezone: 'America/Chicago',
  density: 'comfortable',
  pushEnabled: true,
  alerts: {
    hotCompletedInApp: true, hotCompletedPush: true,
    hotMissedInApp: true,    hotMissedPush: false,
    franchiseInApp: true,    franchisePush: false,
  },
  missedGrace: '24h',
  dayStarted: false,
  filtersHidden: false,
};

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed, alerts: { ...defaults.alerts, ...(parsed.alerts || {}) } };
  } catch {
    return { ...defaults };
  }
}

export const prefs = load();

export function savePrefs(patch = {}) {
  Object.assign(prefs, patch);
  try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  emit('prefs', prefs);
}

/* ---------------------------------------------------------------- events */
const listeners = new Map();
export function subscribe(topic, fn) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(fn);
  return () => listeners.get(topic).delete(fn);
}
export function emit(topic, payload) {
  (listeners.get(topic) || []).forEach((fn) => fn(payload));
}

/* ------------------------------------------------------------------ user */
export const session = {
  name: 'Justin Woodruff',
  email: 'justin.woodruff@wholesalepayments.com',
  role: 'manager',
  team: 'Team Maverick',
  timezone: 'Central Time (CT)',
  build: 'v7029593 · 2026-08-20 09:56',
};

/** "Today" is pinned to the snapshot date so relative labels stay coherent. */
export const TODAY = new Date('2026-08-22T12:00:00');

/* ------------------------------------------------------------------ data */
const cache = new Map();
const inflight = new Map();

async function fetchJSON(name) {
  // Default caching on purpose: the service worker owns freshness for these
  // (stale-while-revalidate), and `no-cache` would force a revalidation the
  // app cannot satisfy offline.
  const res = await fetch(`./data/${name}.json`);
  if (!res.ok) throw new Error(`Could not load ${name}.json (${res.status})`);
  return res.json();
}

/**
 * Load one dataset. Concurrent callers share a single request.
 * @param {string} name file base name under /data
 */
export function data(name) {
  if (cache.has(name)) return Promise.resolve(cache.get(name));
  if (inflight.has(name)) return inflight.get(name);
  const p = fetchJSON(name)
    .then((json) => { cache.set(name, json); inflight.delete(name); return json; })
    .catch((err) => { inflight.delete(name); throw err; });
  inflight.set(name, p);
  return p;
}

export const dataSync = (name) => cache.get(name);

/** Load several datasets at once. */
export const dataAll = (...names) => Promise.all(names.map(data));

/* ------------------------------------------------------------ derived UI */

/** Counts the rail badges read from, computed once the datasets land. */
export async function navCounts() {
  const bcl = await data('bcl_queue');
  return {
    'bcl-queue': bcl.length,
    // Overdue activities across the whole organization, not just the loaded page.
    activities: 85,
  };
}

/* --------------------------------------------------------------- theming */
const mq = matchMedia('(prefers-color-scheme: dark)');

export function applyTheme(mode = prefs.theme) {
  const resolved = mode === 'system' ? (mq.matches ? 'dark' : 'light') : mode;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = resolved === 'dark' ? '#0B1220' : '#F6F8FC';
  emit('theme', resolved);
  return resolved;
}
mq.addEventListener('change', () => { if (prefs.theme === 'system') applyTheme(); });
