/**
 * Connecting a Google account, for real.
 *
 * The button used to show a toast that said "Opening Google…" and then open
 * nothing. This uses Google Identity Services, which is the current way a
 * browser-only app asks for a token: it opens Google's own consent screen, and
 * what comes back is a real access token for the scopes the Settings screen
 * claims — Calendar events and sending Gmail.
 *
 * A client ID is required and belongs to whoever owns the Google project, so it
 * sits in config.js next to the Maps key rather than in the source. There is no
 * server here, so the token lives in this browser and expires the way Google
 * issued it; nothing is refreshed behind the user's back.
 */
import { GOOGLE_CLIENT_ID as CONFIG_CLIENT_ID } from '../../config.js';
import { prefs, savePrefs, emit } from '../core/store.js';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const LS_TOKEN = 'kloser.google.token.v1';
const LOAD_TIMEOUT = 12000;

export const SCOPE_CALENDAR = 'https://www.googleapis.com/auth/calendar.events';
export const SCOPE_CALENDAR_LIST = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
export const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.send';

export const SCOPES = [
  'openid',
  'email',
  'profile',
  SCOPE_CALENDAR,
  SCOPE_CALENDAR_LIST,
  SCOPE_GMAIL,
].join(' ');

export const getClientId = () => (prefs.googleClientId || CONFIG_CLIENT_ID || '').trim();
export const setClientId = (id) => savePrefs({ googleClientId: (id || '').trim() });

function readToken() {
  try {
    const t = JSON.parse(localStorage.getItem(LS_TOKEN) || 'null');
    if (!t || !t.access_token) return null;
    if (t.expires_at && Date.now() > t.expires_at) return null;   // expired, treat as gone
    return t;
  } catch { return null; }
}
function writeToken(t) {
  try {
    if (t) localStorage.setItem(LS_TOKEN, JSON.stringify(t));
    else localStorage.removeItem(LS_TOKEN);
  } catch { /* private mode */ }
  emit('google', t);
}

/** What Settings needs to know: connected, who, and until when. */
export function googleState() {
  const t = readToken();
  return {
    connected: Boolean(t),
    email: t && t.email,
    name: t && t.name,
    picture: t && t.picture,
    expiresAt: t && t.expires_at,
    hasClientId: Boolean(getClientId()),
  };
}

let gisLoading = null;
function loadGIS() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    return Promise.resolve(window.google.accounts.oauth2);
  }
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { gisLoading = null; reject(new Error('timeout')); }, LOAD_TIMEOUT);
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener('load', () => {
      clearTimeout(timer);
      if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        resolve(window.google.accounts.oauth2);
      } else {
        gisLoading = null;
        reject(new Error('missing'));
      }
    });
    s.addEventListener('error', () => { clearTimeout(timer); gisLoading = null; reject(new Error('network')); });
    document.head.appendChild(s);
  });
  return gisLoading;
}

/**
 * Open Google's consent screen and keep the token that comes back.
 * Rejects with a short reason the caller can put in front of the user.
 */
export async function connectGoogle() {
  const clientId = getClientId();
  if (!clientId) throw new Error('no-client-id');

  const oauth2 = await loadGIS();

  const token = await new Promise((resolve, reject) => {
    let settled = false;
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (res) => {
        settled = true;
        if (res && res.access_token) resolve(res);
        else reject(new Error(res && res.error ? res.error : 'denied'));
      },
      error_callback: (err) => {
        settled = true;
        // popup_closed / access_denied are the user saying no, not a fault.
        reject(new Error(err && err.type ? err.type : 'denied'));
      },
    });
    client.requestAccessToken({ prompt: '' });
    // If the popup is blocked, nothing ever calls back.
    setTimeout(() => { if (!settled) reject(new Error('no-response')); }, 120000);
  });

  const record = {
    access_token: token.access_token,
    scope: token.scope,
    expires_at: Date.now() + (Number(token.expires_in || 3600) - 60) * 1000,
  };

  // Ask who it is, so Settings can show the account rather than just "connected".
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${record.access_token}` },
    });
    if (res.ok) {
      const me = await res.json();
      record.email = me.email;
      record.name = me.name;
      record.picture = me.picture;
    }
  } catch { /* the token is still good even if this call is blocked */ }

  writeToken(record);
  return googleState();
}

/** The raw bearer token, or null when there isn't a live one. */
export const accessToken = () => {
  const t = readToken();
  return t ? t.access_token : null;
};

/** Did the token Google actually issued include this scope? */
export function hasScope(scope) {
  const t = readToken();
  if (!t) return false;
  return String(t.scope || '').split(/\s+/).includes(scope);
}

/** Drop the token without calling Google — used when Google itself rejects it. */
export const forgetToken = () => writeToken(null);

/**
 * A fetch that carries the Google token and turns Google's failures into short
 * reasons the caller can show someone. A 401 means the token is dead, so it is
 * thrown away here rather than left to fail again on the next call.
 */
export async function googleFetch(url, opts = {}) {
  const token = accessToken();
  if (!token) throw new Error('not-connected');

  const headers = { Authorization: `Bearer ${token}`, ...(opts.headers || {}) };
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch {
    throw new Error('network');
  }

  if (res.status === 401) { forgetToken(); throw new Error('expired'); }
  if (res.status === 403) throw new Error('forbidden');
  if (res.status === 404) throw new Error('not-found');
  if (res.status === 429) throw new Error('rate-limit');
  if (!res.ok) throw new Error(`http-${res.status}`);
  if (res.status === 204) return null;
  try { return await res.json(); } catch { return null; }
}

/** Hand the token back to Google and forget it here. */
export async function disconnectGoogle() {
  const t = readToken();
  writeToken(null);
  if (t && window.google && window.google.accounts && window.google.accounts.oauth2) {
    try { window.google.accounts.oauth2.revoke(t.access_token, () => {}); } catch { /* already gone */ }
  }
  return googleState();
}

/** Plain-English reason, for putting in front of someone. */
export function explainGoogleError(message) {
  return {
    'no-client-id': 'No Google client ID is set. Add one in config.js (GOOGLE_CLIENT_ID) to enable this.',
    network: 'Google’s sign-in script could not be reached from this network.',
    timeout: 'Google’s sign-in script did not load in time.',
    missing: 'Google’s sign-in script loaded but did not provide OAuth.',
    popup_failed_to_open: 'The browser blocked the Google popup. Allow popups for this site and try again.',
    popup_closed: 'The Google window was closed before finishing.',
    access_denied: 'Google access was declined.',
    denied: 'Google did not grant access.',
    'no-response': 'Google never came back. The popup was probably blocked.',
    'not-connected': 'No Google account is connected. Connect one in Settings first.',
    expired: 'The Google session expired. Connect the account again.',
    forbidden: 'Google refused the request. The Calendar API may not be enabled on this project, or the account did not grant calendar access.',
    'not-found': 'Google could not find that calendar.',
    'rate-limit': 'Google is rate-limiting this account. Try again shortly.',
  }[message] || 'Google sign-in did not complete.';
}
