/**
 * PWA runtime.
 *
 * Everything here exists because an installed iOS web app behaves differently
 * from a Safari tab: there is no install prompt, no address bar to fall back
 * on, the process is killed aggressively when backgrounded, and the software
 * keyboard shrinks the visual viewport without telling CSS.
 */
import { el, esc, $ } from './dom.js';
import { icon } from './icons.js';
import { toast } from '../components/overlays.js';

const LS_INSTALL = 'kloser.install.v1';
const LS_RESUME = 'kloser.resume.v1';
const RESUME_WINDOW_MS = 30 * 60 * 1000;

/* ----------------------------------------------------------- environment */
const ua = navigator.userAgent;

export const isIOS =
  /iPad|iPhone|iPod/.test(ua) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isSafari =
  /^((?!chrome|android|crios|fxios|edgios|opios).)*safari/i.test(ua);

export const isStandalone = () =>
  navigator.standalone === true ||
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: fullscreen)').matches;

/* ------------------------------------------------------ service worker -- */
let waitingWorker = null;

async function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  // file:// has no service worker scope and would throw on every load.
  if (location.protocol === 'file:') return;

  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

    // A worker already waiting means an update landed on a previous visit.
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const next = reg.installing;
      if (!next) return;
      next.addEventListener('statechange', () => {
        // `controller` is null on the very first install — that is not an update.
        if (next.state === 'installed' && navigator.serviceWorker.controller) {
          offerUpdate(next);
        }
      });
    });

    // Check for a new build whenever the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch (err) {
    console.warn('[pwa] service worker registration failed', err);
  }
}

function offerUpdate(worker) {
  if (waitingWorker) return;
  waitingWorker = worker;

  const dismiss = toast('A new version is ready', {
    text: 'Reload to pick up the latest build.',
    tone: 'info',
    timeout: 0,
  });

  // Graft a reload action onto the toast we just raised.
  const node = document.querySelector('.toast-host .toast:last-child');
  if (!node) return;
  const action = el(`<button class="btn btn-primary sm" style="align-self:center">Reload</button>`);
  action.addEventListener('click', () => {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
    worker.postMessage({ type: 'SKIP_WAITING' });
    dismiss();
  });
  node.insertBefore(action, node.lastElementChild);
}

/* --------------------------------------------------------- persistence -- */
async function requestPersistence() {
  // iOS evicts script-writable storage for origins that go unused. Persisted
  // storage is exempt from the routine sweep.
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (!(await navigator.storage.persisted())) await navigator.storage.persist();
    }
  } catch { /* not fatal — the app still works, it just may be evicted */ }
}

/* ------------------------------------------------ keyboard-aware layout -- */
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const sync = () => {
    // iOS shrinks the VISUAL viewport for the keyboard but leaves the layout
    // viewport alone, so fixed elements need this figure to stay reachable.
    const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${Math.round(overlap)}px`);
    document.documentElement.dataset.keyboard = overlap > 80 ? 'open' : 'closed';
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  sync();
}

/* ------------------------------------------------- resume where you were */
function trackRoute() {
  const save = () => {
    try {
      localStorage.setItem(LS_RESUME, JSON.stringify({ hash: location.hash, at: Date.now() }));
    } catch { /* private mode */ }
  };
  // `beforeunload` is unreliable on iOS; these two are not.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('pagehide', save);
}

function restoreRoute() {
  if (!isStandalone()) return false;
  // Only resume a launch that landed on the default route.
  if (location.hash && location.hash !== '#/' && location.hash !== '#') return false;
  try {
    const raw = localStorage.getItem(LS_RESUME);
    if (!raw) return false;
    const { hash, at } = JSON.parse(raw);
    if (!hash || hash === '#/' || !at) return false;
    if (Date.now() - at > RESUME_WINDOW_MS) return false;
    history.replaceState(null, '', hash);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------- badging -- */
export async function setBadge(count) {
  try {
    if (!('setAppBadge' in navigator)) return;
    // Never prompt for notifications just to paint a badge.
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;
    if (count > 0) await navigator.setAppBadge(count);
    else await navigator.clearAppBadge();
  } catch { /* unsupported or not installed */ }
}

/* -------------------------------------------------- connectivity status -- */
function trackConnectivity() {
  const paint = () => {
    document.documentElement.dataset.offline = String(!navigator.onLine);
  };
  window.addEventListener('online', () => {
    paint();
    toast('Back online', { text: 'Syncing the latest data.', tone: 'good', timeout: 2400 });
  });
  window.addEventListener('offline', () => {
    paint();
    toast('You are offline', {
      text: 'Kloser CRM keeps working — everything you log is queued and sent when you reconnect.',
      tone: 'warn',
      timeout: 5000,
    });
  });
  paint();
}

/* ------------------------------------------- iOS add-to-home-screen hint */
function installHint() {
  // WebKit has no beforeinstallprompt, so the only route to installation is
  // teaching the user where the Share button is.
  if (!isIOS || !isSafari || isStandalone()) return;

  let state = {};
  try { state = JSON.parse(localStorage.getItem(LS_INSTALL) || '{}'); } catch { /* ignore */ }
  if (state.dismissed) return;
  // Never on the first visit — the hint waits until the user comes back.
  const visits = (state.visits || 0) + 1;
  try { localStorage.setItem(LS_INSTALL, JSON.stringify({ ...state, visits })); } catch { /* ignore */ }
  if (visits < 2) return;

  const iPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const card = el(`
    <div class="install-hint" role="dialog" aria-label="Install WPI Kloser CRM">
      <button class="install-close" aria-label="Dismiss">${icon('close', { size: 16 })}</button>
      <div class="install-row">
        <img class="install-icon" src="./assets/icons/apple-touch-icon-152.png" alt="" width="52" height="52">
        <div class="install-copy">
          <b>Install WPI Kloser CRM</b>
          <span>Add it to your Home Screen for full-screen, offline access in the field.</span>
        </div>
      </div>
      <ol class="install-steps">
        <li><span class="step-n">1</span> Tap ${icon('share', { size: 15, cls: 'ico share-glyph' })} <b>Share</b> in the ${iPad ? 'toolbar' : 'bar below'}</li>
        <li><span class="step-n">2</span> Choose <b>Add to Home Screen</b></li>
        <li><span class="step-n">3</span> Tap <b>Add</b></li>
      </ol>
      ${iPad ? '' : '<span class="install-arrow" aria-hidden="true"></span>'}
    </div>`);

  card.querySelector('.install-close').addEventListener('click', () => {
    card.classList.add('is-leaving');
    card.addEventListener('animationend', () => card.remove(), { once: true });
    try { localStorage.setItem(LS_INSTALL, JSON.stringify({ dismissed: true, visits })); } catch { /* ignore */ }
  });

  setTimeout(() => document.body.appendChild(card), 2600);
}

/* ------------------------------------------------- status bar behavior -- */
export function syncStatusBar(resolvedTheme) {
  // iOS reads apple-mobile-web-app-status-bar-style at launch, so writing it
  // now is what makes the NEXT cold launch match the user's chosen theme.
  const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (meta) meta.content = resolvedTheme === 'dark' ? 'black' : 'default';
}

/* ------------------------------------------------------------- bootstrap */
export function initPWA() {
  if (isStandalone()) document.documentElement.dataset.standalone = 'true';
  if (isIOS) document.documentElement.dataset.ios = 'true';

  const resumed = restoreRoute();

  registerWorker();
  requestPersistence();
  trackKeyboard();
  trackRoute();
  trackConnectivity();
  installHint();

  if (resumed) {
    setTimeout(() => toast('Resumed where you left off', { tone: 'info', timeout: 2600 }), 900);
  }
  return { resumed };
}
