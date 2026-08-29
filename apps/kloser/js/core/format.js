/** Formatting + derived-value helpers shared by every page. */

const nf = new Intl.NumberFormat('en-US');
const nf1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export const num = (v) => nf.format(Number(v) || 0);
export const num1 = (v) => nf1.format(Number(v) || 0);
export const pct = (v, d = 0) => `${Number(v || 0).toFixed(d)}%`;

export function compact(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `${nf1.format(n / 1e6)}M`;
  if (Math.abs(n) >= 1e4) return `${nf1.format(n / 1e3)}k`;
  return nf.format(n);
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic avatar gradient derived from the name — stable across reloads. */
const AVATAR_PAIRS = [
  ['#0090E9', '#001160'], ['#00BAE6', '#0067B8'], ['#00C271', '#005E52'],
  ['#4FE778', '#009A5B'], ['#7C5CFF', '#2A1B8C'], ['#FF7A45', '#9E3410'],
  ['#00A88A', '#00453C'], ['#E8A317', '#7A4E00'], ['#3E7BFA', '#12276E'],
  ['#12B9C9', '#064953'],
];
export function hashCode(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function avatarStyle(name) {
  const [a, b] = AVATAR_PAIRS[hashCode(name) % AVATAR_PAIRS.length];
  return `--av-a:${a};--av-b:${b}`;
}

/** Turn "Appointment Set" into "appointment-set" for the stage color classes. */
export const slug = (s = '') =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Parse the app's relative age strings ("16h ago", "31d ago", "1mo ago") into hours. */
export function ageHours(rel = '') {
  const m = /^(\d+)\s*(mo|m|h|d|w)/i.exec(String(rel).trim());
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  return { m: n / 60, h: n, d: n * 24, w: n * 168, mo: n * 730 }[unit] ?? null;
}

/** Bucket an age (in hours) into the labels the dashboard charts use. */
export const AGE_BUCKETS = [
  { label: 'Today', max: 24 },
  { label: 'This week', max: 168 },
  { label: '2 weeks', max: 336 },
  { label: '3 weeks', max: 504 },
  { label: '1 month', max: 760 },
  { label: '2 months+', max: Infinity },
];
export function ageBucket(hours) {
  if (hours === null || hours === undefined) return null;
  return (AGE_BUCKETS.find((b) => hours <= b.max) || AGE_BUCKETS[AGE_BUCKETS.length - 1]).label;
}

/** Distance strings ("1332 ft", "14.5 mi") to feet, for sorting + thresholds. */
export function distanceFeet(s = '') {
  const m = /^([\d.]+)\s*(ft|mi)$/i.exec(String(s).trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === 'mi' ? n * 5280 : n;
}

export function phoneFmt(raw = '') {
  const d = String(raw).replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (ten.length !== 10) return raw || '—';
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}
export const telHref = (raw = '') => `tel:+${String(raw).replace(/\D/g, '').replace(/^(?!1)/, '1')}`;

/** "6401 Antelope Road, Citrus Heights, CA 95621" -> { city, state, zip } */
export function parseAddress(address = '') {
  const m = /,\s*([^,]+),\s*([A-Z]{2})[, ]+(\d{5})/.exec(address);
  if (m) return { city: m[1].trim(), state: m[2], zip: m[3] };
  const m2 = /,\s*([A-Z]{2})\s*(\d{5})?/.exec(address);
  return { city: '', state: m2 ? m2[1] : '', zip: m2 && m2[2] ? m2[2] : '' };
}

export function parseDate(s) {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

export const DAY_MS = 86400000;

export function relativeFrom(date, now = new Date()) {
  if (!date) return '—';
  const diff = date.getTime() - now.getTime();
  const days = Math.round(diff / DAY_MS);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(days) < 1) return 'today';
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return rtf.format(Math.round(days / 30), 'month');
}

export function sortBy(arr, key, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...arr].sort((a, b) => {
    const av = typeof key === 'function' ? key(a) : a[key];
    const bv = typeof key === 'function' ? key(b) : b[key];
    if (av === bv) return 0;
    if (av === null || av === undefined || av === '') return 1;
    if (bv === null || bv === undefined || bv === '') return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sign;
    return String(av).localeCompare(String(bv), 'en', { numeric: true, sensitivity: 'base' }) * sign;
  });
}

export function groupBy(arr, keyFn) {
  const out = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Deterministic pseudo-random in [0,1) — keeps generated layouts stable. */
export function seeded(seed) {
  let s = typeof seed === 'string' ? hashCode(seed) : seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
