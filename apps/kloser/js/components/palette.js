/**
 * ⌘K command palette — the fastest path between any two points in the app.
 * Searches pages, leads, reps, activities and a set of verbs.
 */
import { el, esc, $, $$, trapFocus, lockScroll, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { data, prefs, savePrefs, applyTheme } from '../core/store.js';
import { toast } from './overlays.js';

let host = null;
let index = null;

/** Build (once) a flat, searchable index across every dataset. */
async function buildIndex() {
  if (index) return index;
  const { FLAT_NAV } = await import('./shell.js');

  const entries = FLAT_NAV.map((n) => ({
    kind: 'Pages', title: n.label, sub: n.desc, icon: n.icon, go: () => navigate(n.path),
  }));

  entries.push(
    { kind: 'Actions', title: 'Toggle theme', sub: 'System, light or dark', icon: 'sun', go: () => {
      const order = ['system', 'light', 'dark'];
      const next = order[(order.indexOf(prefs.theme) + 1) % order.length];
      savePrefs({ theme: next }); applyTheme(next);
      toast(`Theme: ${next}`, { timeout: 1500 });
    } },
    { kind: 'Actions', title: 'Collapse sidebar', sub: 'More room for the table', icon: 'chevronsLeft', go: () => {
      const app = document.getElementById('app');
      const collapsed = app.dataset.rail !== 'collapsed';
      app.dataset.rail = collapsed ? 'collapsed' : 'expanded';
      savePrefs({ railCollapsed: collapsed });
    } },
    { kind: 'Actions', title: 'Overdue activities', sub: '61 past due by 3+ days', icon: 'alert', go: () => navigate('activities?status=overdue') },
    { kind: 'Actions', title: 'Reps below verification target', sub: '5 reps under 70%', icon: 'shield', go: () => navigate('location-verify') },
  );

  try {
    const [leads, reps, acts] = await Promise.all([data('leads'), data('reps_board'), data('activities')]);
    leads.forEach((l) => entries.push({
      kind: 'Leads', title: l.name, sub: `${l.stage} · ${l.address}`, icon: 'building',
      go: () => navigate(`list?q=${encodeURIComponent(l.name)}`),
    }));
    // The whole roster, not a slice — 925 plain objects cost nothing to hold,
    // and a palette that silently stops at rep 400 is worse than no palette.
    reps.forEach((r) => entries.push({
      kind: 'Reps', title: r.name, sub: r.city || r.email, icon: 'user',
      go: () => navigate(`appointment-board?q=${encodeURIComponent(r.name)}`),
    }));
    acts.forEach((a) => entries.push({
      kind: 'Activities', title: a.title, sub: `${a.date} · ${a.rep}`, icon: 'activity',
      go: () => navigate(`activities?q=${encodeURIComponent(a.company)}`),
    }));
  } catch { /* pages + actions still work offline */ }

  index = entries;
  return index;
}

function score(entry, q) {
  const t = entry.title.toLowerCase();
  const s = (entry.sub || '').toLowerCase();
  if (t === q) return 0;
  if (t.startsWith(q)) return 1;
  const ti = t.indexOf(q);
  if (ti === 0) return 2;
  if (ti > 0) return 3 + ti / 100;
  const si = s.indexOf(q);
  if (si >= 0) return 20 + si / 100;
  return Infinity;
}

const KIND_ORDER = ['Pages', 'Actions', 'Leads', 'Reps', 'Activities'];

function search(entries, q) {
  const query = q.trim().toLowerCase();
  if (!query) {
    return entries.filter((e) => e.kind === 'Pages' || e.kind === 'Actions').slice(0, 12);
  }
  return entries
    .map((e) => ({ e, s: score(e, query) }))
    .filter((x) => x.s !== Infinity)
    .sort((a, b) => a.s - b.s || KIND_ORDER.indexOf(a.e.kind) - KIND_ORDER.indexOf(b.e.kind))
    .slice(0, 24)
    .map((x) => x.e);
}

export async function openPalette() {
  if (host) return;

  host = el(`
    <div class="palette-host" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="palette">
        <div class="palette-input-row">
          ${icon('search', { size: 18 })}
          <input class="palette-input" type="text" placeholder="Search leads, reps, activities or jump to a page…"
            aria-label="Search" data-autofocus autocomplete="off" spellcheck="false">
          <span class="kbd">esc</span>
        </div>
        <div class="palette-results" role="listbox"></div>
        <div class="palette-foot">
          <span class="row">${icon('chevronUp', { size: 11 })}${icon('chevronDown', { size: 11 })} navigate</span>
          <span class="row"><span class="kbd">↵</span> open</span>
          <span class="row"><span class="kbd">esc</span> dismiss</span>
          <span class="spacer"></span>
          <span class="row" id="palette-count"></span>
        </div>
      </div>
    </div>`);

  document.body.appendChild(host);
  const unlock = lockScroll();
  const release = trapFocus(host);

  const input = $('.palette-input', host);
  const results = $('.palette-results', host);
  const counter = $('#palette-count', host);
  let items = [];
  let active = 0;

  results.innerHTML = `<div class="row" style="padding:var(--s-5);gap:var(--s-3)"><span class="spinner"></span><span class="muted">Indexing…</span></div>`;
  const entries = await buildIndex();

  function paint() {
    items = search(entries, input.value);
    active = 0;
    counter.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;

    if (!items.length) {
      results.innerHTML = `<div class="empty" style="padding:var(--s-7)">
        ${icon('search', { size: 26 })}
        <h3 style="margin-top:var(--s-2)">No matches</h3>
        <p class="muted">Nothing matched “${esc(input.value)}”.</p>
      </div>`;
      return;
    }

    let html = '';
    let lastKind = null;
    items.forEach((it, i) => {
      if (it.kind !== lastKind) { html += `<div class="palette-group-label">${esc(it.kind)}</div>`; lastKind = it.kind; }
      html += `<button class="palette-item" role="option" data-i="${i}" data-active="${i === 0}">
        ${icon(it.icon || 'arrowRight', { size: 17 })}
        <span class="grow" style="min-width:0">
          <span class="pi-title truncate" style="display:block">${esc(it.title)}</span>
          ${it.sub ? `<span class="pi-sub truncate" style="display:block">${esc(it.sub)}</span>` : ''}
        </span>
        ${icon('arrowRight', { size: 14 })}
      </button>`;
    });
    results.innerHTML = html;
  }

  function setActive(next) {
    const nodes = $$('.palette-item', results);
    if (!nodes.length) return;
    active = (next + nodes.length) % nodes.length;
    nodes.forEach((n, i) => n.dataset.active = String(i === active));
    nodes[active].scrollIntoView({ block: 'nearest' });
  }

  function choose(i = active) {
    const it = items[i];
    if (!it) return;
    // Release the lock synchronously: close() only unlocks on animationend,
    // and navigating first leaves the body pinned on the new screen.
    unlock();
    close();
    it.go();
  }

  function close() {
    if (!host) return;
    const node = host;
    host = null;
    node.classList.add('closing');
    node.addEventListener('animationend', () => {
      node.remove(); release(); unlock();
    }, { once: true });
    // Belt and braces: if the animation never fires, do not strand the page.
    setTimeout(() => { node.remove(); release(); unlock(); }, 400);
  }

  input.addEventListener('input', debounce(paint, 90));
  host.addEventListener('keydown', (e) => {
    // Stop here: a document-level handler closes the top sheet on Escape, and
    // the palette can be opened over one.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(); }
  });
  results.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.palette-item') : null;
    if (btn) choose(Number(btn.dataset.i));
  });
  results.addEventListener('pointermove', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('.palette-item') : null;
    if (btn) setActive(Number(btn.dataset.i));
  });
  host.addEventListener('click', (e) => { if (e.target === host) close(); });

  paint();
}
