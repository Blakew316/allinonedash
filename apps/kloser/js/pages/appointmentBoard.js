/** Appointment Board — which reps are bookable, where, and through which channel. */
import { el, esc, $ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data } from '../core/store.js';
import { num } from '../core/format.js';
import { pageHeader, statCard, runCounters, searchField, emptyState, avatar } from '../components/ui.js';
import { dataTable, bindTableControls } from '../components/table.js';
import { drawer } from '../components/overlays.js';

export default {
  title: 'Appointment Board',

  async view({ query }) {
    const reps = await data('reps_board');
    const node = el('<div class="page"></div>');

    const on = reps.filter((r) => r.telemarketing === 'ON').length;
    const hot = reps.filter((r) => r.hotLeads === 'ON').length;
    const assigned = reps.filter((r) => r.callCenter && r.callCenter !== 'Unassigned').length;
    const zipped = reps.filter((r) => r.zips.length).length;
    const centers = [...new Set(reps.map((r) => r.callCenter).filter(Boolean))].sort();

    node.appendChild(el(pageHeader({
      title: 'Appointment Board',
      lede: 'Active reps and their bookability. View only — flip a rep on or off from their profile.',
      meta: `<span class="badge accent">${num(reps.length)} reps</span>
             <span class="badge good">${num(on)} telemarketing ON</span>
             <a class="badge outline" href="#/appointment-board?center=${encodeURIComponent(centers.find((c) => c !== 'Unassigned') || '')}"
                style="text-decoration:none">${num(centers.length)} call centers</a>`,
      actions: `<a class="btn btn-secondary sm" href="#/rep-schedule">${icon('calendarClock', { size: 14 })}Availability</a>`,
    })));

    node.appendChild(el(`<section class="grid g-4">
      ${statCard({ label: 'Bookable via telemarketing', value: on, icon: 'phone', tone: 'var(--wp-blue)', foot: `${num(reps.length - on)} switched off` })}
      ${statCard({ label: 'Hot leads enabled', value: hot, icon: 'zap', tone: 'var(--warn)', foot: 'will receive WPI hot leads' })}
      ${statCard({ label: 'Assigned to a call center', value: assigned, icon: 'building', tone: 'var(--wp-green)', foot: `${num(reps.length - assigned)} unassigned` })}
      ${statCard({ label: 'With pull-lead ZIPs', value: zipped, icon: 'pin', tone: 'var(--wp-cyan)', foot: 'territory configured' })}
    </section>`));

    node.appendChild(el(`
      <div class="toolbar" id="ab-toolbar">
        ${searchField({ placeholder: 'Search rep, email, city or ZIP…', value: query.q || '' })}
        <span class="sep"></span>
        <select class="select sm" data-filter="telemarketing" aria-label="Telemarketing" style="width:auto">
          <option value="">Telemarketing: any</option>
          <option value="ON">ON</option><option value="OFF">OFF</option>
        </select>
        <select class="select sm" data-filter="hotLeads" aria-label="Hot leads" style="width:auto">
          <option value="">Hot leads: any</option>
          <option value="ON">ON</option><option value="OFF">OFF</option>
        </select>
        <select class="select sm" data-filter="callCenter" aria-label="Call center" style="width:auto">
          <option value="">All call centers</option>
          ${centers.map((c) => `<option${c === query.center ? ' selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <select class="select sm" data-filter="territory" aria-label="Territory" style="width:auto">
          <option value="">Any territory</option>
          <option value="has">Has ZIPs</option>
          <option value="none">No ZIPs set</option>
        </select>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="ab-count"></span>
      </div>`));

    const table = dataTable({
      rows: reps,
      searchKeys: ['name', 'email', 'city'],
      pageSize: 25,
      exportName: 'kloser-appointment-board',
      sortKey: 'name', sortDir: 'asc',
      filterFns: {
        territory: (r, v) => (v === 'has' ? r.zips.length > 0 : r.zips.length === 0),
        zipMatch: (r, v) => r.zips.some((z) => z.startsWith(v)),
      },
      columns: [
        {
          key: 'name', label: 'Rep', width: '26%',
          render: (r) => `<div class="row" style="gap:var(--s-3);min-width:0">
            ${avatar(r.name, 'sm')}
            <div style="min-width:0">
              <div class="cell-strong truncate">${esc(r.name)}</div>
              <div class="cell-sub truncate">${esc(r.email)}</div>
            </div>
          </div>`,
        },
        {
          key: 'zips', label: 'Pull-lead ZIPs', sortable: false, hideBelow: 1100,
          render: (r) => r.zips.length
            ? `<div class="zip-pills">${r.zips.slice(0, 6).map((z) => `<span class="zip-pill">${esc(z)}</span>`).join('')}
               ${r.zips.length > 6 ? `<span class="zip-pill" style="background:var(--neutral-tint);color:var(--text-subtle)">+${r.zips.length - 6}</span>` : ''}</div>`
            : '<span class="subtle">—</span>',
        },
        {
          key: 'city', label: 'City / State', hideBelow: 860,
          render: (r) => r.city ? esc(r.city) : '<span class="subtle">—</span>',
        },
        { key: 'telemarketing', label: 'Telemarketing', width: '132px', render: (r) => toggleBadge(r.telemarketing) },
        { key: 'hotLeads', label: 'Hot leads', width: '112px', render: (r) => toggleBadge(r.hotLeads) },
        {
          key: 'callCenter', label: 'Call center', width: '132px',
          render: (r) => r.callCenter === 'Unassigned'
            ? '<span class="badge outline">Unassigned</span>'
            : `<span class="badge info"><span class="dot"></span>${esc(r.callCenter)}</span>`,
        },
      ],
      onRowClick: (row) => openRep(row),
      empty: emptyState({ title: 'No reps match', text: 'Widen the search or clear a filter.', iconName: 'users' }),
    });

    node.appendChild(table.node);
    node._table = table;
    node._reps = reps;
    return node;
  },

  mount(root, { query }) {
    runCounters(root);
    const page = root.firstElementChild;
    const table = page._table;
    const toolbar = $('#ab-toolbar', root);
    const countEl = $('#ab-count', root);
    const syncCount = () => { countEl.textContent = `${num(table.count)} shown`; };

    bindTableControls(toolbar, table);
    toolbar.addEventListener('change', syncCount);
    toolbar.addEventListener('input', () => setTimeout(syncCount, 180));

    // ZIP search: fall back to a filter when the query looks like a ZIP.
    const search = $('[data-search]', toolbar);
    search.addEventListener('input', () => {
      const v = search.value.trim();
      table.setFilter('zipMatch', /^\d{3,5}$/.test(v) ? v : '');
      setTimeout(syncCount, 180);
    });

    if (query.q) { search.value = query.q; table.setSearch(query.q); }
    if (query.center) table.setFilter('callCenter', query.center);
    syncCount();
  },
};

function toggleBadge(v) {
  return v === 'ON'
    ? '<span class="badge good"><span class="dot"></span>ON</span>'
    : '<span class="badge outline"><span class="dot"></span>OFF</span>';
}

function openRep(r) {
  drawer({
    title: r.name,
    subtitle: r.email,
    body: `
      <div class="col" style="gap:var(--s-5)">
        <div class="row" style="gap:var(--s-3)">
          ${avatar(r.name, 'lg')}
          <div style="min-width:0">
            <div style="font-size:var(--fs-16);font-weight:640;letter-spacing:var(--tr-title)">${esc(r.name)}</div>
            <div class="muted mono" style="font-size:var(--fs-12)">${esc(r.email)}</div>
          </div>
        </div>

        <div class="row wrap" style="gap:var(--s-2)">
          ${toggleBadge(r.telemarketing)} <span class="subtle" style="font-size:var(--fs-12)">telemarketing</span>
          ${toggleBadge(r.hotLeads)} <span class="subtle" style="font-size:var(--fs-12)">hot leads</span>
        </div>

        <dl class="dl">
          <dt>City / State</dt><dd>${esc(r.city || 'Not set')}</dd>
          <dt>Call center</dt><dd>${esc(r.callCenter)}</dd>
          <dt>Telemarketing</dt><dd>${esc(r.telemarketing)}</dd>
          <dt>Hot leads</dt><dd>${esc(r.hotLeads)}</dd>
          <dt>Pull-lead ZIPs</dt><dd>${r.zips.length ? esc(r.zips.join(', ')) : 'None configured'}</dd>
        </dl>

        ${r.zips.length ? `<div>
          <div class="eyebrow" style="margin-bottom:var(--s-3)">Territory</div>
          <div class="zip-pills" style="max-width:none">${r.zips.map((z) => `<span class="zip-pill">${esc(z)}</span>`).join('')}</div>
        </div>` : ''}
      </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
             <a class="btn btn-primary grow" href="#/rep-schedule?q=${encodeURIComponent(r.name.split(' ')[0])}">${icon('calendarClock', { size: 15 })}Check availability</a>`,
  });
}
