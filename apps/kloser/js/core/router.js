/**
 * Hash router with animated view transitions.
 * Routes render into a host element and may return a cleanup function.
 */
import { observeReveals } from './dom.js';

const routes = new Map();
let host = null;
let current = null;
let cleanup = null;
let firstRender = true;
let renderSeq = 0;
const afterRender = [];
const beforeRender = [];

export function route(path, def) { routes.set(path, def); }
export function onNavigate(fn) { afterRender.push(fn); }
/** Runs before the outgoing view is torn down — teardown that must not touch
    the incoming screen belongs here, not in onNavigate. */
export function onBeforeNavigate(fn) { beforeRender.push(fn); }
export const getRoutes = () => routes;

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const path = (pathPart || '').replace(/\/+$/, '');
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  return { path, query };
}

export function navigate(path, opts = {}) {
  const target = path.startsWith('#') ? path : `#/${path.replace(/^\/+/, '')}`;
  if (location.hash === target) { if (opts.force) render(); return; }
  if (opts.replace) history.replaceState(null, '', target);
  else location.hash = target;
}

/** Update the query string without re-rendering the whole view. */
export function setQuery(patch, { replace = true } = {}) {
  const { path, query } = parseHash();
  const merged = { ...query, ...patch };
  Object.keys(merged).forEach((k) => {
    if (merged[k] === '' || merged[k] === null || merged[k] === undefined) delete merged[k];
  });
  const qs = new URLSearchParams(merged).toString();
  const url = `#/${path}${qs ? `?${qs}` : ''}`;
  // Safari rate-limits history writes, and a filter mirrored on every keystroke
  // can get close to that ceiling. A no-op write is never worth spending.
  if (url === location.hash) return;
  if (replace) history.replaceState(null, '', url);
  else location.hash = url;
}

function resolve(path) {
  if (routes.has(path)) return { def: routes.get(path), params: {} };
  // Single dynamic segment support: "leads/:id"
  for (const [pattern, def] of routes) {
    if (!pattern.includes(':')) continue;
    const pp = pattern.split('/');
    const ap = path.split('/');
    if (pp.length !== ap.length) continue;
    const params = {};
    const ok = pp.every((seg, i) => {
      if (seg.startsWith(':')) { params[seg.slice(1)] = decodeURIComponent(ap[i]); return true; }
      return seg === ap[i];
    });
    if (ok) return { def, params };
  }
  return null;
}

const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

async function render() {
  // render() awaits twice (the leave animation and the view itself) and is the
  // hashchange handler, so a second navigation can overtake the first. Only the
  // newest render is allowed to finish.
  const mine = ++renderSeq;
  const stale = () => renderSeq !== mine;
  const { path, query } = parseHash();
  // No silent fallback to the dashboard: an unknown hash is a 404, and the
  // 404 view names the path that failed. It renders through the same pipeline
  // as every other route — view() is async, so it cannot be appended directly.
  const match = resolve(path) || { def: routes.get('404'), params: {} };
  const { def, params } = match;
  const key = `${path}`;
  const isSameView = current === def;
  current = def;

  // Teardown for the screen we are leaving, before the next one exists. This
  // cannot live in afterRender: those run after def.mount(), so they would
  // destroy anything the incoming screen opened for itself (a page reached as
  // "…?compose=1" opens its composer during mount).
  beforeRender.forEach((fn) => { try { fn({ path, def, query, params }); } catch { /* noop */ } });

  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* noop */ } }
  cleanup = null;

  // Leave animation, then swap.
  if (host.firstElementChild && !prefersReduced() && !isSameView) {
    host.firstElementChild.classList.add('view-leave');
    await new Promise((r) => setTimeout(r, 130));
    if (stale()) return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'view' + (prefersReduced() ? '' : ' view-enter');
  // Namespaced: a bare data-route collides with the Routes screen's own row
  // attribute, so any closest('[data-route]') would match this wrapper.
  wrap.dataset.viewRoute = key;

  host.replaceChildren(wrap);
  window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });

  const ctx = { query, params, path, host: wrap };
  try {
    const result = await def.view(ctx);
    if (stale()) return;
    if (result instanceof Node) wrap.appendChild(result);
    else if (typeof result === 'string') wrap.innerHTML = result;
    if (typeof def.mount === 'function') cleanup = def.mount(wrap, ctx) || null;
  } catch (err) {
    if (stale()) return;
    console.error('[router] view failed', err);
    const offline = !navigator.onLine || /Could not load|Failed to fetch|NetworkError/i.test(err && err.message || '');
    wrap.innerHTML = `
      <div class="empty">
        <div class="empty-art">${offline ? '&#9888;' : '!'}</div>
        <h3>${offline ? 'This screen needs data it has not cached yet' : 'Something went sideways'}</h3>
        <p class="muted">${offline
          ? 'Open it once while you have a connection and it will work offline from then on.'
          : (err && err.message ? err.message : 'This view could not be rendered.')}</p>
        <div class="row" style="gap:var(--s-2);margin-top:var(--s-2)">
          <button class="btn btn-primary sm" onclick="location.reload()">Try again</button>
          <a class="btn btn-secondary sm" href="#/">Back to dashboard</a>
        </div>
      </div>`;
  }

  document.title = `${def.title || 'Kloser CRM'} — Kloser CRM`;
  observeReveals(wrap);
  announce(def.title || 'Kloser CRM');

  /* Keyboard and screen-reader users would otherwise stay parked on the nav
     link they just activated, tabbing back through the whole rail to reach the
     screen they asked for. Park them at the top of the new view instead. The
     first render is exempt: nothing has focus yet, and stealing it on boot
     scrolls Safari's address bar around for no reason. */
  if (!firstRender && host) {
    const active = document.activeElement;
    const insideOverlay = active && active.closest && active.closest('.overlay, .drawer-host, .menu');
    if (!insideOverlay) host.focus({ preventScroll: true });
  }
  firstRender = false;

  afterRender.forEach((fn) => fn({ path, def, query, params }));
}

/* A polite live region so the route change is spoken. Focusing the main
   region moves the reading cursor but does not reliably name the screen. */
let liveRegion = null;
function announce(text) {
  if (!liveRegion) {
    liveRegion = document.createElement('p');
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.id = 'route-live';
    document.body.appendChild(liveRegion);
  }
  liveRegion.textContent = `${text} screen`;
}

/** Move focus to the view host without routing (used by the skip link). */
export function focusView() {
  if (!host) return;
  host.focus({ preventScroll: false });
  host.scrollIntoView({ block: 'start', behavior: prefersReduced() ? 'auto' : 'smooth' });
}

export function startRouter(mountPoint) {
  host = mountPoint;
  window.addEventListener('hashchange', render);
  if (!location.hash) history.replaceState(null, '', '#/');
  // Returned so the caller can hold the boot splash until the first view has
  // actually painted, rather than dropping it one frame after modules parse.
  return render();
}

export const rerender = render;
