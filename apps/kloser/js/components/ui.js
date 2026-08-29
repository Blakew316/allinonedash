/** Reusable presentational building blocks. */
import { esc, $$ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { num, initials, avatarStyle, slug } from '../core/format.js';

/* ------------------------------------------------------------- stat cards */
/**
 * @param {{label:string, value:number|string, icon?:string, tone?:string,
 *          foot?:string, delta?:{dir:'up'|'down'|'flat', text:string},
 *          spark?:string, href?:string}} spec
 */
export function statCard(spec) {
  const tone = spec.tone || 'var(--wp-blue)';
  const raw = typeof spec.value === 'number' ? spec.value : null;
  const inner = `
    <div class="stat" style="--tone:${tone}">
      <div class="stat-top">
        <span class="stat-label">${esc(spec.label)}</span>
        ${spec.icon ? `<span class="stat-icon">${icon(spec.icon, { size: 17 })}</span>` : ''}
      </div>
      <div class="stat-value"${raw !== null ? ` data-count-to="${raw}"` : ''}>${raw !== null ? '0' : esc(spec.value)}</div>
      ${spec.spark || ''}
      ${(spec.foot || spec.delta) ? `<div class="stat-foot">
        ${spec.delta ? `<span class="delta ${spec.delta.dir}">${icon(spec.delta.dir === 'down' ? 'arrowDown' : spec.delta.dir === 'up' ? 'arrowUp' : 'minus', { size: 13 })}${esc(spec.delta.text)}</span>` : ''}
        ${spec.foot ? `<span>${esc(spec.foot)}</span>` : ''}
      </div>` : ''}
    </div>`;
  return spec.href
    ? `<a class="card interactive reveal" href="${esc(spec.href)}" style="text-decoration:none">${inner}</a>`
    : `<div class="card reveal">${inner}</div>`;
}

/** Count-up animation for any [data-count-to] inside root. */
export function runCounters(root = document) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $$('[data-count-to]', root).forEach((node) => {
    if (node.dataset.counted === 'true') return;
    node.dataset.counted = 'true';
    const target = parseFloat(node.dataset.countTo);
    if (!Number.isFinite(target)) return;
    const decimals = (node.dataset.countTo.split('.')[1] || '').length;
    const suffix = node.dataset.countSuffix || '';
    const render = (v) => {
      node.textContent = (decimals ? v.toFixed(decimals) : num(Math.round(v))) + suffix;
    };
    if (reduced || target === 0) { render(target); return; }

    const duration = 900 + Math.min(600, Math.abs(target) / 4);
    const start = performance.now();
    const ease = (t) => 1 - (1 - t) ** 3;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      render(target * ease(t));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ---------------------------------------------------------------- avatars */
export function avatar(name, size = '') {
  return `<span class="avatar ${size}" style="${avatarStyle(name)}" title="${esc(name)}" aria-hidden="true">${esc(initials(name))}</span>`;
}

/**
 * A named person. Anywhere a rep is named, that name opens their sheet — the
 * click is handled once, globally, by wireRepOpeners(). Placeholders
 * ("Unassigned", "—") stay inert because there is nobody to open.
 */
export function personCell(name, sub = '') {
  const inner = `${avatar(name, 'sm')}
    <span style="min-width:0;text-align:left">
      <span class="truncate" style="font-weight:560;display:block">${esc(name)}</span>
      ${sub ? `<span class="cell-sub truncate" style="display:block">${esc(sub)}</span>` : ''}
    </span>`;
  const named = name && !['—', '-', 'unassigned', 'none', ''].includes(String(name).trim().toLowerCase());
  return named
    ? `<button type="button" class="person-cell" data-rep-open="${esc(name)}"
         title="Open ${esc(name)}’s sheet">${inner}</button>`
    : `<span class="person-cell is-static">${inner}</span>`;
}

/* ----------------------------------------------------------------- badges */
export function stageBadge(stage) {
  return `<span class="badge stage stage-${slug(stage)}"><span class="dot"></span>${esc(stage)}</span>`;
}

const STATUS_TONE = {
  // "cancelled" is the source app's own spelling; "canceled" is the US form.
  // Accept both so either survives a data change.
  scheduled: 'accent', completed: 'good', cancelled: 'bad', canceled: 'bad', 'no show': 'warn',
  pending: 'warn', sent: 'good', new: 'accent', assigned: 'info',
  contacted: 'info', 'submitted to qa': 'warn', draft: '', active: 'good',
  verified: 'good', unverified: 'bad', on: 'good', off: '',
  available: 'good', unavailable: '',
};
export function statusBadge(status, extra = '') {
  const tone = STATUS_TONE[String(status).toLowerCase()] ?? '';
  return `<span class="badge ${tone} ${extra}"><span class="dot"></span>${esc(status)}</span>`;
}

/* ------------------------------------------------------------------ misc */
export function emptyState({ title, text, iconName = 'inbox', action = '' }) {
  return `<div class="empty">
    <div class="empty-art">${icon(iconName, { size: 28 })}</div>
    <h3>${esc(title)}</h3>
    ${text ? `<p>${esc(text)}</p>` : ''}
    ${action}
  </div>`;
}

export function skeletonTable(rows = 8, cols = 5) {
  return `<div class="card flush">
    <div style="padding:var(--s-4)">
      ${Array.from({ length: rows }, () => `
        <div class="row" style="gap:var(--s-4);padding-block:9px">
          ${Array.from({ length: cols }, (_, c) =>
            `<div class="skeleton skeleton-text" style="flex:${c === 0 ? 2 : 1}"></div>`).join('')}
        </div>`).join('')}
    </div>
  </div>`;
}

export function pageHeader({ title, lede = '', actions = '', meta = '' }) {
  return `<header class="page-head">
    <div style="min-width:0">
      <h2>${esc(title)}</h2>
      ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
      ${meta ? `<div class="row wrap" style="gap:var(--s-2);margin-top:var(--s-3)">${meta}</div>` : ''}
    </div>
    ${actions ? `<div class="row wrap" style="gap:var(--s-2)">${actions}</div>` : ''}
  </header>`;
}

/* --------------------------------------------------------- segmented ctl */
/**
 * Renders a segmented control. Call `mountSegmented` after inserting it.
 * @param {{name:string, options:{value:string,label:string}[], value:string}} spec
 */
export function segmented({ name, options, value }) {
  return `<div class="segmented" role="tablist" data-segmented="${esc(name)}">
    <span class="thumb" aria-hidden="true"></span>
    ${options.map((o) => `<button role="tab" type="button" data-value="${esc(o.value)}"
      aria-selected="${o.value === value}">${esc(o.label)}</button>`).join('')}
  </div>`;
}

export function mountSegmented(root, onChange) {
  $$('.segmented', root).forEach((seg) => {
    const move = () => {
      const active = seg.querySelector('[aria-selected="true"]');
      const thumb = seg.querySelector('.thumb');
      if (!active || !thumb) return;
      thumb.style.left = `${active.offsetLeft}px`;
      thumb.style.width = `${active.offsetWidth}px`;
    };
    requestAnimationFrame(move);
    if (document.fonts?.ready) document.fonts.ready.then(move);
    seg.addEventListener('click', (e) => {
      const btn = e.target instanceof Element ? e.target.closest('[data-value]') : null;
      if (!btn) return;
      seg.querySelectorAll('[data-value]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      move();
      if (typeof onChange === 'function') onChange(btn.dataset.value, seg.dataset.segmented, seg);
    });
    window.addEventListener('resize', move);
  });
}

/* ------------------------------------------------------------------ tabs */
export function tabs({ name, items, value }) {
  return `<div class="tabs" role="tablist" data-tabs="${esc(name)}">
    ${items.map((t) => `<button class="tab" role="tab" type="button" data-value="${esc(t.value)}"
      aria-selected="${t.value === value}">${esc(t.label)}${t.count !== undefined ? ` <span class="subtle tnum">${num(t.count)}</span>` : ''}</button>`).join('')}
    <span class="tab-underline" aria-hidden="true"></span>
  </div>`;
}

export function mountTabs(root, onChange) {
  $$('.tabs', root).forEach((bar) => {
    const line = bar.querySelector('.tab-underline');
    const move = () => {
      const active = bar.querySelector('[aria-selected="true"]');
      if (!active || !line) return;
      line.style.left = `${active.offsetLeft}px`;
      line.style.width = `${active.offsetWidth}px`;
    };
    requestAnimationFrame(move);
    if (document.fonts?.ready) document.fonts.ready.then(move);
    bar.addEventListener('click', (e) => {
      const btn = e.target instanceof Element ? e.target.closest('.tab') : null;
      if (!btn) return;
      bar.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      move();
      if (typeof onChange === 'function') onChange(btn.dataset.value, bar.dataset.tabs);
    });
    window.addEventListener('resize', move);
  });
}

/* --------------------------------------------------------------- switches */
export function switchCtl(id, checked, label) {
  return `<button class="switch" role="switch" id="${esc(id)}" data-switch="${esc(id)}"
    aria-checked="${checked ? 'true' : 'false'}" aria-label="${esc(label || id)}"></button>`;
}

export function mountSwitches(root, onToggle) {
  $$('[data-switch]', root).forEach((sw) => {
    sw.addEventListener('click', () => {
      const next = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(next));
      if (typeof onToggle === 'function') onToggle(sw.dataset.switch, next, sw);
    });
  });
}

/* ------------------------------------------------------------- checkboxes */
export function checkbox(id, checked = false, label = '') {
  return `<button class="checkbox" role="checkbox" data-checkbox="${esc(id)}"
    aria-checked="${checked ? 'true' : 'false'}" aria-label="${esc(label || id)}"></button>`;
}

/* ---------------------------------------------------------------- filters */
export function selectFilter({ name, label, options, value = '' }) {
  return `<select class="select sm" data-filter="${esc(name)}" aria-label="${esc(label)}" style="width:auto;min-width:132px">
    ${options.map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`;
    }).join('')}
  </select>`;
}

export function searchField({ name = 'q', placeholder = 'Search…', value = '' }) {
  return `<div class="input-icon" style="max-width:280px;flex:1 1 200px">
    ${icon('search', { size: 16 })}
    <input class="input sm" type="search" data-search="${esc(name)}" value="${esc(value)}"
      placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off">
  </div>`;
}

/* ---------------------------------------------------------------- banners */
export function banner({ tone = '', title, text = '', action = '', iconName = 'info' }) {
  return `<div class="banner ${tone} reveal">
    ${icon(iconName, { size: 18 })}
    <div class="grow">
      <div class="banner-title">${esc(title)}</div>
      ${text ? `<div class="banner-text">${esc(text)}</div>` : ''}
    </div>
    ${action}
  </div>`;
}
