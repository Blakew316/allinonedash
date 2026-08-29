/** Toasts, modals, drawers and popover menus. */
import { el, esc, trapFocus, lockScroll, $ } from '../core/dom.js';
import { icon } from '../core/icons.js';

/* ------------------------------------------------------------------ toast */
let toastHost = null;
function ensureToastHost() {
  if (!toastHost) {
    toastHost = el('<div class="toast-host" role="status" aria-live="polite"></div>');
    document.body.appendChild(toastHost);
  }
  return toastHost;
}

const TOAST_ICON = { good: 'checkCircle', bad: 'xCircle', warn: 'alert', info: 'info' };

export function toast(title, { text = '', tone = 'info', timeout = 3600 } = {}) {
  const host = ensureToastHost();
  const node = el(`
    <div class="toast ${tone}">
      ${icon(TOAST_ICON[tone] || 'info', { size: 18 })}
      <div class="grow">
        <div class="toast-title">${esc(title)}</div>
        ${text ? `<div class="toast-text">${esc(text)}</div>` : ''}
      </div>
      <button class="icon-btn" style="width:26px;height:26px" aria-label="Dismiss">${icon('close', { size: 15 })}</button>
    </div>`);
  const close = () => {
    node.classList.add('closing');
    node.addEventListener('animationend', () => node.remove(), { once: true });
  };
  node.querySelector('button').addEventListener('click', close);
  host.appendChild(node);
  if (timeout) setTimeout(close, timeout);
  return close;
}

/* Every open overlay, so a route change can tear them all down. A drawer
   left hanging over a new screen is the most jarring bug in a hash-routed
   app: the URL changed but the sheet on top of it did not. */
const openOverlays = new Set();

/* --------------------------------------------------- overlays and history
   On iOS a sheet that ignores the system Back gesture feels broken, so every
   modal and drawer pushes one history entry at the *same* URL. Back pops it
   and closes the sheet; closing by button or Escape pops the entry itself so
   the two stay in step. Same URL means no hashchange, so the route below the
   sheet is never re-rendered.                                              */
let ovlSeq = 0;
const historyStack = [];   // [{ id, close }] — innermost sheet last
const selfPops = [];       // tokens for popstate events this module caused

/** The route a URL points at, ignoring its query — "#/list?q=x" -> "#/list". */
const routeOf = (href) => String(href).split('#')[1]?.split('?')[0] || '';

function pushHistoryFor(close) {
  const id = ++ovlSeq;
  historyStack.push({ id, close, route: routeOf(location.href) });
  try { history.pushState({ __ovl: id }, '', location.href); } catch { historyStack.pop(); }
  return id;
}

/* history.go() fires exactly one popstate however far it travels, so one
   token per call. The timeout is a leak guard for a traversal the browser
   refuses; tokens are removed by identity so it can never eat a later one. */
function expectSelfPop() {
  const token = {};
  selfPops.push(token);
  setTimeout(() => {
    const i = selfPops.indexOf(token);
    if (i !== -1) selfPops.splice(i, 1);
  }, 800);
}

/* Called when a sheet closes on its own (button, Escape, backdrop): hand its
   history entry back, plus any sheet stacked on top of it. */
function releaseHistoryFor(close) {
  const i = historyStack.findIndex((e) => e.close === close);
  if (i === -1) return;                       // popstate already unwound it
  const owned = historyStack.splice(i);       // this sheet and everything above
  owned.slice(1).forEach((e) => { try { e.close(); } catch { /* already gone */ } });
  expectSelfPop();
  try { history.go(-owned.length); } catch { selfPops.pop(); }
}

window.addEventListener('popstate', () => {
  if (selfPops.length) { selfPops.shift(); return; }   // our own unwind
  const top = historyStack[historyStack.length - 1];
  // Assigning location.hash fires popstate as well as hashchange, so "a popstate
  // arrived" does not mean "the user pressed Back". A sheet's entry sits at the
  // same route as the screen under it, so only a landing on that same route can
  // be a Back into it; anything else is a forward navigation, and the route
  // change tears the sheet down through closeOverlays() instead.
  if (top && routeOf(location.href) === top.route) {
    historyStack.pop();
    try { top.close(); } catch { /* already gone */ }
  }
  // A sheet torn down by a route change leaves its entry behind. We deliberately
  // do NOT auto-skip it: answering every __ovl popstate with history.back() turns
  // that entry into a one-way trapdoor and kills the Forward button. The cost of
  // leaving it is one redundant Back press after navigating out of a sheet; the
  // cost of skipping it was losing Forward entirely.
});

/* Escape closes the top sheet wherever focus happens to be. Each overlay also
   listens on itself and stops the event there, so this only ever runs when
   focus has drifted outside — which it does whenever one sheet opens another. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !openOverlays.size) return;
  if (openMenu) return;      // a popover over a sheet dismisses first
  const top = [...openOverlays].pop();
  e.preventDefault();
  e.stopPropagation();   // one Escape peels one layer, never two
  top();
});

/* Set while a route change is tearing sheets down: their scroll lock must be
   released immediately (the incoming screen would otherwise render inside a
   still-pinned body) and must not restore the outgoing screen's offset. */
let routeTeardown = false;

export function closeOverlays() {
  // A route change already pushed its own entry on top of any sheet entries,
  // so these close silently; the popstate handler above skips what is left.
  historyStack.length = 0;
  routeTeardown = true;
  try {
    [...openOverlays].forEach((close) => { try { close(); } catch { /* already gone */ } });
  } finally {
    routeTeardown = false;
  }
  openOverlays.clear();
}

/* ------------------------------------------------------------------ modal */
export function modal({ title, subtitle = '', body, footer = '', wide = false, onClose }) {
  const overlay = el(`
    <div class="overlay" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal ${wide ? 'wide' : ''}">
        <div class="modal-head">
          <div>
            <h2 style="font-size:var(--fs-18)">${esc(title)}</h2>
            ${subtitle ? `<p class="muted" style="font-size:var(--fs-12);margin-top:3px">${esc(subtitle)}</p>` : ''}
          </div>
          <button class="icon-btn" data-close aria-label="Close">${icon('close', { size: 18 })}</button>
        </div>
        <div class="modal-body"></div>
        ${footer ? `<div class="modal-foot"></div>` : ''}
      </div>
    </div>`);

  const bodyHost = $('.modal-body', overlay);
  if (body instanceof Node) bodyHost.appendChild(body);
  else bodyHost.innerHTML = body || '';
  if (footer) {
    const f = $('.modal-foot', overlay);
    if (footer instanceof Node) f.appendChild(footer); else f.innerHTML = footer;
  }

  let release = () => {};
  let unlock = () => {};
  const close = () => {
    if (overlay.classList.contains('closing')) return;
    overlay.classList.add('closing');
    openOverlays.delete(close);
    releaseHistoryFor(close);
    // unlock() is idempotent, so releasing early here simply means finish()'s
    // call is a no-op.
    if (routeTeardown) unlock({ restore: false });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      overlay.remove();
      release();
      unlock();
      if (typeof onClose === 'function') onClose();
    };
    overlay.addEventListener('animationend', finish, { once: true });
    // If the close animation never fires the page would stay scroll-locked with
    // a dead node over it, so never depend on the event alone.
    setTimeout(finish, 400);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || (e.target instanceof Element && e.target.closest('[data-close]'))) close();
  });
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });

  document.body.appendChild(overlay);
  unlock = lockScroll();
  release = trapFocus(overlay);
  openOverlays.add(close);
  pushHistoryFor(close);
  return { node: overlay, close };
}

/* ----------------------------------------------------------------- drawer */
export function drawer({ title, subtitle = '', body, footer = '', onClose }) {
  const host = el(`
    <div class="drawer-host" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <aside class="drawer">
        <div class="drawer-head">
          <div style="min-width:0">
            <h2 style="font-size:var(--fs-18)">${esc(title)}</h2>
            ${subtitle ? `<p class="muted" style="font-size:var(--fs-12);margin-top:3px">${esc(subtitle)}</p>` : ''}
          </div>
          <button class="icon-btn" data-close aria-label="Close">${icon('close', { size: 18 })}</button>
        </div>
        <div class="drawer-body"></div>
        ${footer ? '<div class="drawer-foot"></div>' : ''}
      </aside>
    </div>`);

  const bodyHost = $('.drawer-body', host);
  if (body instanceof Node) bodyHost.appendChild(body); else bodyHost.innerHTML = body || '';
  if (footer) {
    const f = $('.drawer-foot', host);
    if (footer instanceof Node) f.appendChild(footer); else f.innerHTML = footer;
  }

  let release = () => {};
  let unlock = () => {};
  const close = () => {
    if (host.classList.contains('closing')) return;
    host.classList.add('closing');
    openOverlays.delete(close);
    releaseHistoryFor(close);
    if (routeTeardown) unlock({ restore: false });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      host.remove(); release(); unlock();
      if (typeof onClose === 'function') onClose();
    };
    host.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 400);
  };
  host.addEventListener('click', (e) => {
    if (e.target === host || (e.target instanceof Element && e.target.closest('[data-close]'))) close();
  });
  host.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });

  document.body.appendChild(host);
  unlock = lockScroll();
  release = trapFocus(host);
  openOverlays.add(close);
  pushHistoryFor(close);
  return { node: host, close };
}

/* ------------------------------------------------------------------- menu */
let openMenu = null;

/**
 * @param {HTMLElement} anchor
 * @param {Array<{label?:string,icon?:string,sep?:boolean,heading?:string,danger?:boolean,href?:string,onSelect?:Function,checked?:boolean}>} items
 */
export function menu(anchor, items, { align = 'right', width } = {}) {
  closeMenu();
  const node = el(`<div class="menu" role="menu"></div>`);
  if (width) node.style.minWidth = `${width}px`;

  items.forEach((item) => {
    if (item.sep) { node.appendChild(el('<div class="menu-sep"></div>')); return; }
    if (item.heading) { node.appendChild(el(`<div class="menu-label">${esc(item.heading)}</div>`)); return; }
    const tag = item.href ? 'a' : 'button';
    const row = el(`
      <${tag} class="menu-item ${item.danger ? 'danger' : ''}" role="menuitem"
        ${item.href ? `href="${esc(item.href)}"` : 'type="button"'}>
        ${item.icon ? icon(item.icon, { size: 16 }) : '<span style="width:16px"></span>'}
        <span class="grow truncate">${esc(item.label)}</span>
        ${item.checked ? icon('check', { size: 15, cls: 'ico' }) : ''}
      </${tag}>`);
    row.addEventListener('click', () => {
      closeMenu();
      if (typeof item.onSelect === 'function') item.onSelect();
    });
    node.appendChild(row);
  });

  document.body.appendChild(node);
  const r = anchor.getBoundingClientRect();
  const w = node.offsetWidth;
  const left = align === 'right'
    ? Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))
    : Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
  node.style.left = `${left}px`;
  node.style.top = `${r.bottom + 6}px`;
  node.style.setProperty('--origin', align === 'right' ? 'top right' : 'top left');
  if (r.bottom + node.offsetHeight + 16 > window.innerHeight) {
    node.style.top = `${Math.max(8, r.top - node.offsetHeight - 6)}px`;
    node.style.setProperty('--origin', align === 'right' ? 'bottom right' : 'bottom left');
  }

  openMenu = node;
  anchor.setAttribute('aria-expanded', 'true');
  const dismiss = (e) => {
    if (node.contains(e.target) || anchor.contains(e.target)) return;
    closeMenu();
  };
  const key = (e) => { if (e.key === 'Escape') closeMenu(); };
  setTimeout(() => {
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', key);
  }, 0);
  node._teardown = () => {
    document.removeEventListener('pointerdown', dismiss);
    document.removeEventListener('keydown', key);
    anchor.setAttribute('aria-expanded', 'false');
  };
  return node;
}

export function closeMenu() {
  if (!openMenu) return;
  openMenu._teardown?.();
  openMenu.remove();
  openMenu = null;
}
