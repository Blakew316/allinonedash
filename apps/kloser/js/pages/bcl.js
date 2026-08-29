/** BCL Queue — business card leads waiting on the call center. */
import { el, esc, $, $$, onToolbarChange } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data, TODAY } from '../core/store.js';
import { num, phoneFmt, telHref, parseAddress } from '../core/format.js';
import { pageHeader, statCard, runCounters, tabs, mountTabs, searchField, emptyState, avatar } from '../components/ui.js';
import { drawer, toast, modal } from '../components/overlays.js';

const INTEREST_RANK = { '🔥 High': 3, '🙂 Medium': 2, '😐 Low': 1 };

const STATUS_TABS = [
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qa', label: 'Submitted to QA' },
  { value: 'scheduled', label: 'Scheduled' },
];

export default {
  title: 'BCL Queue',

  async view() {
    const rows = await data('bcl_queue');
    const node = el('<div class="page"></div>');

    const onsite = rows.filter((r) => /on-site/i.test(r.gps)).length;
    const teams = new Set(rows.map((r) => r.team));
    const reps = [...new Set(rows.map((r) => r.rep))];

    node.appendChild(el(pageHeader({
      title: 'BCL Queue',
      lede: 'Business card leads awaiting call-center follow-up. Every card is GPS-stamped where the rep collected it.',
      meta: `<span class="badge accent">${num(rows.length)} in queue</span>
             <span class="badge good">${num(onsite)} collected on-site</span>`,
      actions: `<button class="btn btn-secondary sm" id="bcl-assign">${icon('users', { size: 14 })}Bulk assign</button>
                <button class="btn btn-primary sm" id="bcl-new">${icon('plus', { size: 15 })}Add card</button>`,
    })));

    node.appendChild(el(`<section class="grid g-4">
      ${statCard({ label: 'Awaiting follow-up', value: rows.length, icon: 'card', tone: 'var(--wp-blue)', foot: 'handed to the call center' })}
      ${statCard({ label: 'GPS verified on-site', value: onsite, icon: 'shield', tone: 'var(--wp-green)', foot: `${num(rows.length - onsite)} need a check` })}
      ${statCard({ label: 'Submitting reps', value: reps.length, icon: 'users', tone: 'var(--wp-cyan)', foot: [...teams].join(', ') })}
      ${statCard({ label: 'Pending QA', value: rows.filter((r) => r.qa === 'Pending').length, icon: 'clock', tone: 'var(--warn)', foot: 'not yet reviewed' })}
    </section>`));

    node.appendChild(el(tabs({
      name: 'bcl', value: 'new',
      items: STATUS_TABS.map((t) => ({ ...t, count: t.value === 'new' ? rows.length : 0 })),
    })));

    node.appendChild(el(`
      <div class="toolbar" id="bcl-toolbar">
        ${searchField({ placeholder: 'Search business, contact or address…' })}
        <span class="sep"></span>
        <select class="select sm" id="bcl-interest" aria-label="Interest" style="width:auto">
          <option value="">All interest</option>
          ${[...new Set(rows.map((r) => r.interest))].map((i) => `<option>${esc(i)}</option>`).join('')}
        </select>
        <select class="select sm" id="bcl-rep" aria-label="Submitted by" style="width:auto">
          <option value="">Submitted by: any rep</option>
          ${reps.map((r) => `<option>${esc(r)}</option>`).join('')}
        </select>
        <select class="select sm" id="bcl-status" aria-label="Status" style="width:auto">
          <option value="">All statuses</option>
          ${[...new Set(rows.map((r) => r.qa))].sort().map((q) => `<option value="${esc(q)}">QA ${esc(q)}</option>`).join('')}
          ${[...new Set(rows.map((r) => r.sent))].sort().map((q) => `<option value="sent:${esc(q)}">${esc(q)}</option>`).join('')}
        </select>
        <select class="select sm" id="bcl-gps" aria-label="Verification source" style="width:auto">
          <option value="">All GPS</option>
          <option value="onsite">On-site</option>
          <option value="fallback">Ping fallback</option>
          <option value="none">No GPS</option>
        </select>
        <span class="segmented" role="group" aria-label="Flagged" id="bcl-flagged">
          <button type="button" data-flag="" aria-selected="true">All</button>
          <button type="button" data-flag="flagged" aria-selected="false">Flagged</button>
          <button type="button" data-flag="not" aria-selected="false">Not flagged</button>
        </span>
        <span class="sep"></span>
        <select class="select sm" id="bcl-date-preset" aria-label="Date range" style="width:auto">
          <option value="">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="custom">Custom range</option>
        </select>
        <span class="row" id="bcl-date-custom" hidden style="gap:6px">
          <input class="input sm" type="date" id="bcl-from" aria-label="Submitted from" style="width:auto">
          <span class="subtle" style="font-size:var(--fs-12)">to</span>
          <input class="input sm" type="date" id="bcl-to" aria-label="Submitted to" style="width:auto">
        </span>
        <select class="select sm" id="bcl-sort" aria-label="Sort" style="width:auto">
          <option value="interest">Default (interest)</option>
          <option value="date">Newest first</option>
          <option value="distance">Closest GPS first</option>
          <option value="name">Business A–Z</option>
        </select>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="bcl-count"></span>
      </div>`));

    node.appendChild(el(`
      <div class="toolbar" id="bcl-selectbar">
        <button class="checkbox" role="checkbox" id="bcl-select-all" aria-checked="false" aria-label="Select all matching"></button>
        <label for="bcl-select-all" style="font-size:var(--fs-12);font-weight:560;cursor:pointer">Select all matching</label>
        <span class="sel-note muted" style="font-size:var(--fs-12)"></span>
        <span class="spacer"></span>
        <select class="select sm" id="bcl-rows" aria-label="Rows per page" style="width:auto">
          <option value="20" selected>20 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
        </select>
        <span class="row" id="bcl-pager" style="gap:4px"></span>
      </div>`));

    node.appendChild(el('<section class="grid g-3" id="bcl-grid"></section>'));
    node._rows = rows;
    return node;
  },

  mount(root) {
    runCounters(root);
    const rows = root.firstElementChild._rows;
    const grid = $('#bcl-grid', root);
    const countEl = $('#bcl-count', root);
    let activeTab = 'new';
    let page = 1;
    const selected = new Set();

    /** Everything the current filters return, in sort order. */
    function visibleList() {
      if (activeTab !== 'new') return [];
      const q = ($('[data-search]', root)?.value || '').trim().toLowerCase();
      const interest = $('#bcl-interest', root).value;
      const rep = $('#bcl-rep', root).value;
      const gps = $('#bcl-gps', root).value;
      const sort = $('#bcl-sort', root).value;
      const flag = $('#bcl-flagged [aria-selected="true"]', root)?.dataset.flag || '';
      const from = $('#bcl-from', root)?.value;
      const to = $('#bcl-to', root)?.value;
      const preset = $('#bcl-date-preset', root).value;
      const status = $('#bcl-status', root).value;

      const list = rows.filter((r) => {
        if (status.startsWith('sent:')) { if (r.sent !== status.slice(5)) return false; }
        else if (status && r.qa !== status) return false;
        if (interest && r.interest !== interest) return false;
        if (rep && r.rep !== rep) return false;
        if (gps === 'onsite' && !/on-site/i.test(r.gps)) return false;
        if (gps === 'fallback' && !/ping/i.test(r.gps)) return false;
        if (gps === 'none' && !/no gps/i.test(r.gps)) return false;
        // "Flagged" means the GPS fix did not put the rep at the business.
        const flagged = isFlagged(r);
        if (flag === 'flagged' && !flagged) return false;
        if (flag === 'not' && flagged) return false;
        if (!inDateRange(r, preset, from, to)) return false;
        if (!q) return true;
        return [r.business, r.contact, r.address, r.phone, r.rep, r.team]
          .some((v) => String(v || '').toLowerCase().includes(q));
      });

      return [...list].sort((a, b) => {
        if (sort === 'name') return a.business.localeCompare(b.business);
        if (sort === 'date') return new Date(b.date) - new Date(a.date);
        if (sort === 'distance') return (gpsFeet(a.gps) ?? 1e9) - (gpsFeet(b.gps) ?? 1e9);
        return (INTEREST_RANK[b.interest] || 0) - (INTEREST_RANK[a.interest] || 0);
      });
    }

    function paint() {
      if (activeTab !== 'new') {
        countEl.textContent = '0 shown';
        $('#bcl-selectbar', root).hidden = true;
        grid.style.display = 'block';
        grid.innerHTML = emptyState({
          title: `Nothing in “${STATUS_TABS.find((t) => t.value === activeTab).label}”`,
          text: 'Cards move through this queue as the call center works them. All six are still at the New stage.',
          iconName: 'inbox',
        });
        return;
      }
      grid.style.display = '';
      $('#bcl-selectbar', root).hidden = false;

      const list = visibleList();
      const per = Number($('#bcl-rows', root).value) || 20;
      const pages = Math.max(1, Math.ceil(list.length / per));
      if (page > pages) page = pages;
      const slice = list.slice((page - 1) * per, page * per);

      countEl.textContent = `${num(list.length)} shown`;
      grid.innerHTML = slice.length
        ? slice.map((r, i) => card(r, i, selected.has(r.business))).join('')
        : `<div style="grid-column:1/-1">${emptyState({ title: 'No cards match', text: 'Clear a filter to see the rest of the queue.', iconName: 'card' })}</div>`;

      $$('[data-bcl]', grid).forEach((c) => c.addEventListener('click', (e) => {
        if (e.target.closest('a,button')) return;
        const r = rows.find((x) => x.business === c.dataset.bcl);
        if (r) openCard(r);
      }));
      $$('[data-bcl-select]', grid).forEach((cb) => cb.addEventListener('click', (e) => {
        e.stopPropagation();
        const k = cb.dataset.bclSelect;
        if (selected.has(k)) selected.delete(k); else selected.add(k);
        paint();
      }));

      paintSelectBar(list);
      paintPager(list.length, pages, per);
    }

    function paintSelectBar(list) {
      const all = $('#bcl-select-all', root);
      const keys = list.map((r) => r.business);
      const every = keys.length > 0 && keys.every((k) => selected.has(k));
      const some = keys.some((k) => selected.has(k));
      all.setAttribute('aria-checked', every ? 'true' : some ? 'mixed' : 'false');
      $('.sel-note', root).textContent = selected.size ? `${num(selected.size)} selected` : '';
      const assign = $('#bcl-assign', root);
      if (assign) assign.disabled = false;
    }

    function paintPager(total, pages, per) {
      const host = $('#bcl-pager', root);
      const from = total === 0 ? 0 : (page - 1) * per + 1;
      const to = Math.min(total, page * per);
      host.innerHTML = `
        <span class="muted" style="font-size:var(--fs-12);margin-right:var(--s-2)">${num(from)}–${num(to)} of ${num(total)} · Page ${page} of ${pages}</span>
        <button class="page-btn" data-page="prev" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">${icon('chevronLeft', { size: 15 })}</button>
        ${Array.from({ length: pages }, (_, i) => `<button class="page-btn" data-page="${i + 1}" ${i + 1 === page ? 'aria-current="true"' : ''}>${i + 1}</button>`).join('')}
        <button class="page-btn" data-page="next" ${page === pages ? 'disabled' : ''} aria-label="Next page">${icon('chevronRight', { size: 15 })}</button>`;
      $$('[data-page]', host).forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.page;
        if (v === 'prev') page = Math.max(1, page - 1);
        else if (v === 'next') page = Math.min(pages, page + 1);
        else page = Number(v);
        paint();
      }));
    }

    paint();
    mountTabs(root, (val, name) => { if (name === 'bcl') { activeTab = val; page = 1; paint(); } });
    $('#bcl-toolbar', root).addEventListener('input', () => { page = 1; paint(); });
    onToolbarChange($('#bcl-toolbar', root), () => { page = 1; paint(); });
    $('#bcl-rows', root).addEventListener('change', () => { page = 1; paint(); });

    // Flagged / not flagged.
    $('#bcl-flagged', root).addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('[data-flag]') : null;
      if (!b) return;
      $$('#bcl-flagged [data-flag]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      page = 1;
      paint();
    });

    // The custom from/to inputs only matter for the custom preset.
    $('#bcl-date-preset', root).addEventListener('change', (e) => {
      $('#bcl-date-custom', root).hidden = e.target.value !== 'custom';
      page = 1;
      paint();
    });

    // Select all matching — everything the filters return, not just this page.
    $('#bcl-select-all', root).addEventListener('click', () => {
      const keys = visibleList().map((r) => r.business);
      const every = keys.length > 0 && keys.every((k) => selected.has(k));
      if (every) keys.forEach((k) => selected.delete(k));
      else keys.forEach((k) => selected.add(k));
      paint();
    });

    $('#bcl-assign', root)?.addEventListener('click', () => {
      const dlg = modal({
        title: 'Bulk assign',
        subtitle: 'Hand these cards to a call-center agent',
        body: `<div class="col" style="gap:var(--s-4)">
          <div class="field">
            <label class="field-label" for="bcl-agent">Agent</label>
            <select class="select" id="bcl-agent">
              ${['Laura Ioerger', 'Chelsea', 'Sandy', 'Unassigned'].map((a) => `<option>${esc(a)}</option>`).join('')}
            </select>
          </div>
          <p class="field-hint">${selected.size
            ? `The ${selected.size} selected card${selected.size === 1 ? '' : 's'} will be assigned.`
            : `All ${rows.length} cards currently at the New stage will be assigned.`}</p>
        </div>`,
        footer: `<button class="btn btn-secondary" data-close>Cancel</button>
                 <button class="btn btn-primary" id="bcl-assign-go">Assign ${selected.size || rows.length} card${(selected.size || rows.length) === 1 ? '' : 's'}</button>`,
      });
      $('#bcl-assign-go', dlg.node)?.addEventListener('click', () => {
        dlg.close();
        const n = selected.size || rows.length;
        selected.clear();
        paint();
        toast('Cards assigned', { text: `${n} card${n === 1 ? '' : 's'} handed to the agent.`, tone: 'good' });
      });
    });

    $('#bcl-new', root)?.addEventListener('click', () =>
      toast('Add card', { text: 'Reps capture business cards from the mobile app.', tone: 'info' }));
  },
};

/** A card is flagged when the GPS fix did not put the rep at the business. */
function isFlagged(r) {
  const ft = gpsFeet(r.gps);
  return !/on-site/i.test(r.gps) || ft === null || ft > 500;
}

function inDateRange(r, preset, from, to) {
  if (!preset) return true;
  const d = new Date(r.date);
  if (Number.isNaN(d.getTime())) return true;
  if (preset === 'custom') {
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(`${to}T23:59:59`)) return false;
    return true;
  }
  const days = Number(preset);
  if (!days) return true;
  return (TODAY.getTime() - d.getTime()) / 86400000 <= days;
}

function gpsFeet(gps = '') {
  const m = /([\d.]+)\s*(ft|mi)/i.exec(gps);
  if (!m) return null;
  return m[2].toLowerCase() === 'mi' ? parseFloat(m[1]) * 5280 : parseFloat(m[1]);
}

function card(r, i, selected) {
  const feet = gpsFeet(r.gps);
  const near = feet !== null && feet <= 500;
  const addr = parseAddress(r.address);
  return `<article class="card interactive reveal bcl-card${selected ? ' is-selected' : ''}" data-bcl="${esc(r.business)}" style="--i:${i}">
    <div class="bcl-head">
      <button class="checkbox" role="checkbox" data-bcl-select="${esc(r.business)}"
        aria-checked="${selected}" aria-label="Select ${esc(r.business)}"></button>
      <div style="min-width:0">
        <h3 style="font-size:var(--fs-14)" class="truncate">${esc(r.business)}</h3>
        <div class="subtle truncate" style="font-size:var(--fs-12);margin-top:2px">${esc(addr.city || '')}${addr.state ? `, ${addr.state}` : ''}</div>
      </div>
      <span class="badge outline">${esc(r.interest)}</span>
    </div>

    <div class="bcl-contact">
      ${avatar(r.contact, 'sm')}
      <div class="grow" style="min-width:0">
        <div style="font-weight:600;font-size:var(--fs-13)" class="truncate">${esc(r.contact)}</div>
        <a class="mono subtle" href="${telHref(r.phone)}" style="font-size:var(--fs-11)">${esc(phoneFmt(r.phone))}</a>
      </div>
      <a class="btn btn-accent sm icon-only" href="${telHref(r.phone)}" aria-label="Call ${esc(r.contact)}">${icon('phone', { size: 14 })}</a>
    </div>

    <div class="subtle" style="font-size:var(--fs-11)">${esc(r.address)}</div>

    <div class="bcl-foot">
      <span class="gps-tag ${near ? '' : 'warn'}">${icon('shield', { size: 12 })}${esc(r.gps)}</span>
      <span class="subtle mono" style="font-size:var(--fs-11)">${esc(r.date)}</span>
    </div>

    <div class="bcl-foot">
      <span class="badge ${r.sent === 'Sent' ? 'good' : ''}"><span class="dot"></span>${esc(r.sent)}</span>
      <span class="badge ${r.qa === 'Pending' ? 'warn' : 'good'}"><span class="dot"></span>QA ${esc(r.qa)}</span>
    </div>
  </article>`;
}

function openCard(r) {
  const feet = gpsFeet(r.gps);
  drawer({
    title: r.business,
    subtitle: `Collected ${r.date} by ${r.rep}`,
    body: `
      <div class="col" style="gap:var(--s-5)">
        <div class="row wrap" style="gap:var(--s-2)">
          <span class="badge outline">${esc(r.interest)} interest</span>
          <span class="badge ${feet !== null && feet <= 500 ? 'good' : 'warn'}">${icon('shield', { size: 12 })}${esc(r.gps)}</span>
          <span class="badge ${r.sent === 'Sent' ? 'good' : ''}">${esc(r.sent)}</span>
          <span class="badge ${r.qa === 'Pending' ? 'warn' : 'good'}">QA ${esc(r.qa)}</span>
        </div>

        <div class="card pad-sm">
          <div class="eyebrow" style="margin-bottom:var(--s-3)">Contact</div>
          <div class="row" style="gap:var(--s-3)">
            ${avatar(r.contact, 'sm')}
            <div class="grow" style="min-width:0">
              <div style="font-weight:600">${esc(r.contact)}</div>
              <div class="muted mono" style="font-size:var(--fs-12)">${esc(phoneFmt(r.phone))}</div>
            </div>
            <a class="btn btn-accent sm" href="${telHref(r.phone)}">${icon('phone', { size: 14 })}Call</a>
          </div>
        </div>

        <dl class="dl">
          <dt>Address</dt><dd>${esc(r.address)}</dd>
          <dt>Collected</dt><dd>${esc(r.date)}</dd>
          <dt>Submitted by</dt><dd>${esc(r.rep)}</dd>
          <dt>Team</dt><dd>${esc(r.team)}</dd>
          <dt>GPS</dt><dd>${esc(r.gps)}</dd>
          <dt>Hand-off</dt><dd>${esc(r.handoff)} by ${esc(r.by)}</dd>
          <dt>Send status</dt><dd>${esc(r.sent)}</dd>
          <dt>QA</dt><dd>${esc(r.qa)}</dd>
        </dl>
      </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
             <button class="btn btn-primary grow" id="bcl-contacted">${icon('check', { size: 15 })}Mark contacted</button>`,
  });
  $('#bcl-contacted')?.addEventListener('click', () => {
    toast('Marked contacted', { text: r.business, tone: 'good' });
    document.querySelector('.drawer-host [data-close]')?.click();
  });
}
