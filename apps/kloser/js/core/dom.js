/** Tiny DOM helpers — enough structure to stay declarative without a framework. */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element from an HTML string (first element node wins). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Create a document fragment from an HTML string. */
export function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content;
}

/** Escape untrusted text for interpolation into HTML. */
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Escape for use inside a double-quoted HTML attribute. */
export const attr = esc;

/** Delegated event binding. */
export function on(root, type, selector, handler, opts) {
  root.addEventListener(type, (e) => {
    const target = e.target instanceof Element ? e.target.closest(selector) : null;
    if (target && root.contains(target)) handler(e, target);
  }, opts);
}

/** Class-list toggle that accepts an explicit boolean. */
export function cls(node, name, force) {
  if (!node) return;
  node.classList.toggle(name, force);
}

/** Reveal-on-scroll: adds .is-visible with a stagger delay. */
let revealObserver = null;
export function observeReveals(root = document) {
  if (!('IntersectionObserver' in window)) {
    $$('.reveal', root).forEach((n) => n.classList.add('is-visible'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  }
  $$('.reveal:not(.is-visible)', root).forEach((n, i) => {
    if (!n.style.getPropertyValue('--reveal-delay')) {
      n.style.setProperty('--reveal-delay', `${Math.min(i, 12) * 45}ms`);
    }
    revealObserver.observe(n);
  });
}

/** Assign --i on children so CSS stagger animations line up. */
export function stagger(root, selector = ':scope > *') {
  $$(selector, root).forEach((n, i) => n.style.setProperty('--i', i));
}

/** Ripple feedback on press. */
export function attachRipples(root = document) {
  root.addEventListener('pointerdown', (e) => {
    const host = e.target instanceof Element
      ? e.target.closest('.btn, .nav-item, .chip, .tabbar-item, .menu-item')
      : null;
    if (!host || host.dataset.noRipple === 'true') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    host.classList.add('ripple-host');
    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.1;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText =
      `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    host.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
  }, { passive: true });
}

/** Focus trap for modals / drawers / palette. Returns a release function. */
export function trapFocus(container) {
  const previous = document.activeElement;
  const selector =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  function keydown(e) {
    if (e.key !== 'Tab') return;
    const items = $$(selector, container).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  container.addEventListener('keydown', keydown);
  const auto = $('[data-autofocus]', container) || $(selector, container);
  if (auto) requestAnimationFrame(() => auto.focus());

  return () => {
    container.removeEventListener('keydown', keydown);
    // Only take focus back if this overlay still has it. One sheet can hand
    // off to another (a template preview opening the composer), and its own
    // teardown must never yank focus out of whatever opened next.
    const active = document.activeElement;
    const stillOurs = !active || active === document.body || container.contains(active);
    if (stillOurs && previous instanceof HTMLElement && previous.isConnected) previous.focus();
  };
}

/**
 * Lock background scrolling while an overlay is open.
 *
 * `body { overflow: hidden }` does not hold in iOS WKWebView — the viewport,
 * not the body box, is the scroller, so the page keeps moving behind the
 * overlay. Pinning the body and restoring the offset on release is the only
 * approach that works on both iOS and everything else.
 *
 * Nested overlays share one lock via a depth counter.
 *
 * The release restores the offset the page was at, which is right when the
 * sheet closes over the same screen and wrong when the screen underneath has
 * been replaced — restoring there drops the user part-way down a view they
 * have never seen. Callers in that situation pass { restore: false }.
 * @returns {(opts?: {restore?: boolean}) => void} release
 */
let lockDepth = 0;
let lockedY = 0;
export function lockScroll() {
  if (lockDepth === 0) {
    lockedY = window.scrollY;
    const b = document.body;
    b.style.position = 'fixed';
    b.style.top = `${-lockedY}px`;
    b.style.left = '0';
    b.style.right = '0';
    b.style.width = '100%';
    b.style.overflow = 'hidden';
  }
  lockDepth += 1;

  let released = false;
  return ({ restore = true } = {}) => {
    if (released) return;
    released = true;
    lockDepth = Math.max(0, lockDepth - 1);
    if (lockDepth > 0) return;
    const b = document.body;
    b.style.position = '';
    b.style.top = '';
    b.style.left = '';
    b.style.right = '';
    b.style.width = '';
    b.style.overflow = '';
    if (restore) window.scrollTo(0, lockedY);
  };
}

/**
 * Bind a toolbar's `change` handler without letting the search field fire it.
 *
 * A text input fires `change` on blur, and the blur happens on the mousedown of
 * the very click the user is making. If that handler repaints the list, the row
 * under the cursor is replaced between mousedown and mouseup and the browser
 * never delivers a click at all — the row simply refuses to open. Search is
 * already covered by the `input` event, so `change` can safely skip it.
 */
export function onToolbarChange(root, fn) {
  root.addEventListener('change', (e) => {
    if (e.target instanceof Element && e.target.hasAttribute('data-search')) return;
    fn(e);
  });
}

/** requestAnimationFrame-throttled callback. */
export function raf(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; fn(...args); });
  };
}

/** Trailing-edge debounce. */
export function debounce(fn, wait = 180) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
