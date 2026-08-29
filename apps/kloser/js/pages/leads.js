/** Leads — the full pipeline list with stage filters, search and a detail drawer. */
import { el, esc, $, $$, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data } from '../core/store.js';
import { num, phoneFmt, telHref, parseAddress, ageHours, slug } from '../core/format.js';
import { pageHeader, stageBadge, avatar, searchField, emptyState, mountSegmented } from '../components/ui.js';
import { dataTable, bindTableControls } from '../components/table.js';
import { drawer, toast, modal, menu } from '../components/overlays.js';
import { setQuery, navigate } from '../core/router.js';

/** Fallback ladder, used only if the metadata fails to load. */
const STAGE_FALLBACK = [{ key: 'all', label: 'All', full: 'All', total: 0 }];

export default {
  title: 'Leads',

  async view({ query }) {
    const [leads, dash] = await Promise.all([data('leads'), data('dashboard')]);
    const ladder = dash.stageLadder || { total: leads.length, stages: STAGE_FALLBACK };
    const STAGES = ladder.stages;
    const node = el('<div class="page"></div>');

    const owners = [...new Set(leads.map((l) => l.owner).filter(Boolean))].sort();
    const states = [...new Set(leads.map((l) => parseAddress(l.address).state).filter(Boolean))].sort();

    node.appendChild(el(pageHeader({
      title: 'Leads',
      lede: 'Every business in the book, from first knock to signed deal.',
      meta: `<span class="badge accent">${num(ladder.total)} in pipeline</span>
             <span class="badge outline" title="${esc(`The original export paginates at 200 rows; this is page one. ${ladder.note || ''}`.trim())}">${num(leads.length)} of ${num(ladder.total)} in this export</span>`,
      actions: `
        <div class="segmented" role="tablist" aria-label="View">
          <span class="thumb" aria-hidden="true"></span>
          <button role="tab" type="button" aria-selected="true" data-view="list">${icon('list', { size: 13 })}List</button>
          <button role="tab" type="button" aria-selected="false" data-view="pipeline">${icon('funnel', { size: 13 })}Pipeline</button>
        </div>
        <button class="btn btn-secondary sm icon-only" id="leads-biz-search" title="Biz Search" aria-label="Biz Search">${icon('building', { size: 15 })}</button>
        <button class="btn btn-secondary sm icon-only" id="leads-columns" title="Columns" aria-label="Choose columns" aria-haspopup="menu">${icon('grid', { size: 15 })}</button>
        <button class="btn btn-secondary sm" id="leads-map">${icon('map', { size: 14 })}On map</button>
        <button class="btn btn-primary sm" id="leads-new">${icon('plus', { size: 15 })}New lead</button>`,
    })));

    /* --------------------------------------------------------- stage rail */
    node.appendChild(el(`
      <div class="row wrap" style="gap:var(--s-2)" id="stage-chips">
        ${STAGES.map((s) => {
          const live = s.key === 'all' ? leads.length : leads.filter((l) => l.stage === s.full).length;
          return `<button class="chip stage stage-${slug(s.full)}" data-stage="${esc(s.key)}"
            aria-pressed="${(query.stage || 'all') === s.key}" title="${esc(s.full)} — ${num(s.total)} in the full book">
            ${s.key === 'all' ? '' : '<span class="dot" style="width:7px;height:7px;border-radius:50%;background:var(--st)"></span>'}
            ${esc(s.label)}<span class="count">${num(live)}</span>
          </button>`;
        }).join('')}
      </div>`));

    /* ------------------------------------------------------------ toolbar */
    node.appendChild(el(`
      <div class="toolbar" id="leads-toolbar">
        ${searchField({ placeholder: 'Search business, contact, address or phone…', value: query.q || '' })}
        <span class="sep"></span>
        <select class="select sm" data-filter="owner" aria-label="Owner" style="width:auto">
          <option value="">All owners</option>
          ${owners.map((o) => `<option${o === query.owner ? ' selected' : ''}>${esc(o)}</option>`).join('')}
        </select>
        <select class="select sm" data-filter="state" aria-label="State" style="width:auto">
          <option value="">All states</option>
          ${states.map((s) => `<option${s === query.state ? ' selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
        <button class="chip" id="leads-date" aria-haspopup="menu" aria-pressed="false">
          ${icon('calendar', { size: 13 })}<span id="leads-date-label">Date</span>
        </button>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="leads-count"></span>
      </div>`));

    /* -------------------------------------------------------------- table */
    const table = dataTable({
      rows: leads,
      searchKeys: ['name', 'customer', 'address', 'phone', 'owner', 'role', 'notes'],
      pageSize: 200,
      exportName: 'kloser-leads',
      sortKey: 'created', sortDir: 'asc',
      selectable: true,
      // Position, not name — two businesses in the book can share a name.
      rowKey: (r, i) => `lead-${i}`,
      rowLabel: (r) => r.name,
      bulkActions: [
        { label: 'Assign rep', icon: 'users', run: (picked, done) => {
          toast('Assign rep', { text: `${picked.length} lead${picked.length === 1 ? '' : 's'} ready to reassign.`, tone: 'info' });
          done();
        } },
        { label: 'Add to route', icon: 'route', run: (picked, done) => {
          toast('Added to route', { text: `${picked.length} stop${picked.length === 1 ? '' : 's'} queued for today.`, tone: 'good' });
          done();
        } },
        { label: 'Export selected', icon: 'download', run: (picked, done) => {
          exportRows(picked);
          done();
        } },
      ],
      filterFns: {
        stage: (r, v) => v === 'all' || r.stage === STAGES.find((s) => s.key === v)?.full,
        state: (r, v) => parseAddress(r.address).state === v,
        owner: (r, v) => r.owner === v,
        age: (r, v) => {
          const h = ageHours(r.created);
          if (h === null) return false;
          return v === 'stale' ? h > 336 : h <= Number(v);
        },
      },
      columns: [
        {
          key: 'name', label: 'Business', width: '24%',
          render: (r) => `<div class="row" style="gap:var(--s-3);min-width:0">
            ${avatar(r.name, 'sm')}
            <div style="min-width:0">
              <div class="cell-strong truncate">${esc(r.name)}</div>
              <div class="cell-sub truncate">${esc(parseAddress(r.address).city || r.address)}</div>
            </div>
          </div>`,
        },
        { key: 'owner', label: 'Owner', hideBelow: 1500,
          render: (r) => r.owner
            ? `<button type="button" class="person-cell" data-rep-open="${esc(r.owner)}" title="Open ${esc(r.owner)}’s sheet"><span class="truncate" style="display:block;max-width:130px">${esc(r.owner)}</span></button>`
            : '<span class="subtle">—</span>' },
        { key: 'stage', label: 'Stage', render: (r) => stageBadge(r.stage) },
        {
          key: 'customer', label: 'Customer', hideBelow: 1100,
          render: (r) => r.customer
            ? `<span class="truncate" style="display:block;font-weight:540;max-width:150px">${esc(r.customer)}</span>`
            : '<span class="subtle">—</span>',
        },
        {
          key: 'role', label: 'Contact Role', hideBelow: 1300,
          render: (r) => r.role ? `<span class="badge outline">${esc(r.role)}</span>` : '<span class="subtle">—</span>',
        },
        {
          key: 'phone', label: 'Phone', hideBelow: 900,
          render: (r) => r.phone && r.phone !== '—'
            ? `<a class="mono" href="${telHref(r.phone)}" style="font-size:var(--fs-12);white-space:nowrap">${esc(phoneFmt(r.phone))}</a>`
            : '<span class="subtle">—</span>',
        },
        {
          key: 'address', label: 'Address', hideBelow: 1640,
          render: (r) => `<span class="truncate subtle" style="display:block;max-width:260px;font-size:var(--fs-12)">${esc(r.address)}</span>`,
        },
        {
          key: 'notes', label: 'Notes', hideBelow: 1720,
          render: (r) => r.notes
            ? `<span class="clamp-2 subtle" style="font-size:var(--fs-12);max-width:240px">${esc(r.notes)}</span>`
            : '<span class="subtle">—</span>',
        },
        {
          key: 'created', label: 'Added', num: true, hideBelow: 700,
          value: (r) => ageHours(r.created) ?? 1e9,
          render: (r) => `<span class="mono subtle" style="font-size:var(--fs-12)">${esc(r.created)}</span>`,
        },
        {
          key: 'actions', label: '', sortable: false, width: '110px',
          render: (r) => `<div class="row-actions" style="justify-content:flex-end">
            ${r.phone && r.phone !== '—' ? `<a class="btn btn-ghost sm icon-only" href="${telHref(r.phone)}" title="Call" aria-label="Call ${esc(r.name)}">${icon('phone', { size: 14 })}</a>` : ''}
            <button class="btn btn-ghost sm icon-only" data-visit="${esc(r.name)}" title="Log visit" aria-label="Log a visit">${icon('pin', { size: 14 })}</button>
            <button class="btn btn-ghost sm icon-only" data-open="${esc(r.name)}" title="Open" aria-label="Open ${esc(r.name)}">${icon('chevronRight', { size: 15 })}</button>
          </div>`,
        },
      ],
      onRowClick: (row) => openLead(row),
      empty: emptyState({
        title: 'No leads match', text: 'Clear a filter or widen the search to see more of the book.', iconName: 'list',
      }),
    });

    node.appendChild(table.node);
    node._table = table;
    node._leads = leads;
    return node;
  },

  mount(root, { query }) {
    const table = root.querySelector('.page')?._table || root.firstElementChild._table;
    const toolbar = $('#leads-toolbar', root);
    const countEl = $('#leads-count', root);

    const syncCount = () => { if (countEl) countEl.textContent = `${num(table.count)} shown`; };

    bindTableControls(toolbar, table);

    /* Keep the URL honest about what is on screen. Every other entry point
       into this list (the palette, the pipeline, a rep sheet) arrives with
       filters in the hash, so a filter set here has to end up there too —
       otherwise reload, share and Back all show a different list. */
    const mirrorURL = () => setQuery({
      q: ($('[data-search]', toolbar)?.value || '').trim(),
      owner: $('[data-filter="owner"]', toolbar)?.value || '',
      state: $('[data-filter="state"]', toolbar)?.value || '',
    });

    toolbar.addEventListener('change', () => { syncCount(); mirrorURL(); });
    toolbar.addEventListener('input', debounce(() => { syncCount(); mirrorURL(); }, 320));

    if (query.q) table.setSearch(query.q);
    if (query.owner) table.setFilter('owner', query.owner);
    if (query.state) table.setFilter('state', query.state);
    if (query.age) {
      const chip = $('#leads-date', root);
      const opt = [
        { value: '24', label: 'Added today' }, { value: '168', label: 'Added this week' },
        { value: '720', label: 'Added this month' }, { value: 'stale', label: 'No touch in 14+ days' },
      ].find((o) => o.value === query.age);
      if (opt && chip) {
        chip.dataset.value = opt.value;
        chip.setAttribute('aria-pressed', 'true');
        $('#leads-date-label', root).textContent = opt.label;
        table.setFilter('age', opt.value);
      }
    }
    table.setFilter('stage', query.stage || 'all');
    syncCount();

    $('#stage-chips', root).addEventListener('click', (e) => {
      const chip = e.target instanceof Element ? e.target.closest('[data-stage]') : null;
      if (!chip) return;
      $$('[data-stage]', root).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      table.setFilter('stage', chip.dataset.stage);
      setQuery({ stage: chip.dataset.stage === 'all' ? '' : chip.dataset.stage });
      syncCount();
    });

    root.addEventListener('click', (e) => {
      const openBtn = e.target instanceof Element ? e.target.closest('[data-open]') : null;
      const visitBtn = e.target instanceof Element ? e.target.closest('[data-visit]') : null;
      const leads = root.firstElementChild._leads || [];
      if (openBtn) {
        e.stopPropagation();
        const lead = leads.find((l) => l.name === openBtn.dataset.open);
        if (lead) openLead(lead);
      }
      if (visitBtn) {
        e.stopPropagation();
        toast('Visit logged', { text: `${visitBtn.dataset.visit} — GPS-stamped at your current location.`, tone: 'good' });
      }
    });

    $('#leads-new', root)?.addEventListener('click', () =>
      toast('New lead', { text: 'Opens the create-lead sheet in the production build.', tone: 'info' }));
    $('#leads-map', root)?.addEventListener('click', () => {
      const q = $('[data-search]', root)?.value || '';
      navigate(`map${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    });

    // List | Pipeline — two views of the same book, switchable in place.
    mountSegmented(root, () => {});
    $$('[data-view]', root).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.view !== 'pipeline') return;
      const params = new URLSearchParams();
      const q = $('[data-search]', root)?.value || '';
      const owner = $('[data-filter="owner"]', root)?.value || '';
      if (q) params.set('q', q);
      if (owner) params.set('rep', owner);
      navigate(`pipeline${params.toString() ? `?${params}` : ''}`);
    }));

    // Biz Search — look up a business to add as a lead.
    $('#leads-biz-search', root)?.addEventListener('click', bizSearch);

    // "Date" behaves as a filter pill with a popover, matching the original.
    const DATE_OPTS = [
      { value: '', label: 'Any date' },
      { value: '24', label: 'Added today' },
      { value: '168', label: 'Added this week' },
      { value: '720', label: 'Added this month' },
      { value: 'stale', label: 'No touch in 14+ days' },
    ];
    $('#leads-date', root)?.addEventListener('click', (e) => {
      const chip = e.currentTarget;
      menu(chip, DATE_OPTS.map((o) => ({
        label: o.label,
        checked: (chip.dataset.value || '') === o.value,
        onSelect: () => {
          chip.dataset.value = o.value;
          chip.setAttribute('aria-pressed', String(Boolean(o.value)));
          $('#leads-date-label', root).textContent = o.value ? o.label : 'Date';
          table.setFilter('age', o.value);
          setQuery({ age: o.value });
          syncCount();
        },
      })), { align: 'left', width: 210 });
    });

    // Column visibility.
    $('#leads-columns', root)?.addEventListener('click', (e) => {
      menu(e.currentTarget, [
        { heading: 'Columns' },
        ...table.columns
          .filter((c) => c.key !== 'actions')
          .map((c) => ({
            label: c.label || c.key, checked: c.visible, icon: c.visible ? 'eye' : 'slash',
            onSelect: () => { table.toggleColumn(c.key); syncCount(); },
          })),
      ], { width: 200 });
    });
  },
};

/* ------------------------------------------------------------ biz search */
function bizSearch() {
  const dlg = modal({
    title: 'Biz Search',
    subtitle: 'Find a business and add it to the book',
    body: `
      <div class="col" style="gap:var(--s-4)">
        <div class="field">
          <label class="field-label" for="bz-q">Business name</label>
          <div class="input-icon">
            ${icon('building', { size: 16 })}
            <input class="input" id="bz-q" placeholder="e.g. Fosters Tire and Automotive" data-autofocus>
          </div>
        </div>
        <div class="grid g-2">
          <div class="field">
            <label class="field-label" for="bz-where">Near</label>
            <input class="input" id="bz-where" placeholder="ZIP, city or address">
          </div>
          <div class="field">
            <label class="field-label" for="bz-radius">Radius</label>
            <select class="select" id="bz-radius">
              <option>1 mile</option><option selected>5 miles</option>
              <option>10 miles</option><option>25 miles</option>
            </select>
          </div>
        </div>
        <p class="field-hint">
          Results exclude anything on your franchise block list and anything already in the book,
          so you never knock a door twice.
        </p>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="bz-go">${icon('search', { size: 15 })}Search</button>`,
  });
  $('#bz-go', dlg.node)?.addEventListener('click', () => {
    dlg.close();
    toast('Searching nearby businesses', { text: 'Matches are added to the book as prospects.', tone: 'info' });
  });
}

/* --------------------------------------------------------------- export */
function exportRows(list) {
  const cols = ['name', 'stage', 'owner', 'customer', 'role', 'phone', 'address', 'notes', 'created'];
  // Same labels the table shows, so a spreadsheet and the screen agree.
  const head = ['Business', 'Stage', 'Owner', 'Customer', 'Contact Role', 'Phone', 'Address', 'Notes', 'Added'];
  const csv = [head.join(',')]
    .concat(list.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'kloser-leads-selected.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Export ready', { text: `${list.length} selected lead${list.length === 1 ? '' : 's'} written.`, tone: 'good' });
}

/* -------------------------------------------------------------- detail */
export function openLead(lead) {
  const addr = parseAddress(lead.address);
  drawer({
    title: lead.name,
    subtitle: `${lead.stage} · added ${lead.created}`,
    body: `
      <div class="col" style="gap:var(--s-5)">
        <div class="row" style="gap:var(--s-3)">
          ${avatar(lead.name, 'lg')}
          <div style="min-width:0">
            <div style="font-size:var(--fs-16);font-weight:640;letter-spacing:var(--tr-title)">${esc(lead.name)}</div>
            <div class="muted" style="font-size:var(--fs-12)">${esc(lead.address)}</div>
          </div>
        </div>

        <div class="row wrap" style="gap:var(--s-2)">
          ${stageBadge(lead.stage)}
          ${addr.state ? `<span class="badge outline">${icon('pin', { size: 12 })}${esc(addr.state)}</span>` : ''}
          ${addr.zip ? `<span class="badge outline mono">${esc(addr.zip)}</span>` : ''}
        </div>

        <div class="card pad-sm">
          <div class="eyebrow" style="margin-bottom:var(--s-3)">Primary contact</div>
          <div class="row" style="gap:var(--s-3)">
            ${avatar(lead.customer || lead.owner || lead.name, 'sm')}
            <div class="grow" style="min-width:0">
              <div style="font-weight:600">${esc(lead.customer || '—')}</div>
              <div class="muted" style="font-size:var(--fs-12)">${esc(lead.role || 'Contact role not recorded')}</div>
            </div>
            ${lead.phone && lead.phone !== '—'
              ? `<a class="btn btn-accent sm" href="${telHref(lead.phone)}">${icon('phone', { size: 14 })}Call</a>` : ''}
          </div>
        </div>

        <dl class="dl">
          <dt>Owner</dt><dd>${esc(lead.owner || '—')}</dd>
          <dt>Contact Role</dt><dd>${esc(lead.role || '—')}</dd>
          <dt>Phone</dt><dd>${lead.phone && lead.phone !== '—' ? `<a class="mono" href="${telHref(lead.phone)}">${esc(phoneFmt(lead.phone))}</a>` : '—'}</dd>
          <dt>Address</dt><dd>${esc(lead.address)}</dd>
          <dt>City</dt><dd>${esc(addr.city || '—')}</dd>
          <dt>State / ZIP</dt><dd>${esc([addr.state, addr.zip].filter(Boolean).join(' ') || '—')}</dd>
          <dt>Added</dt><dd>${esc(lead.created)}</dd>
          <dt>Notes</dt><dd>${esc(lead.notes || 'No notes recorded yet.')}</dd>
        </dl>

        <div>
          <div class="eyebrow" style="margin-bottom:var(--s-3)">Next best actions</div>
          <div class="row wrap" style="gap:var(--s-2)">
            <button class="btn btn-secondary sm" data-act="visit">${icon('pin', { size: 14 })}Log a visit</button>
            <button class="btn btn-secondary sm" data-act="appt">${icon('calendar', { size: 14 })}Set appointment</button>
            <button class="btn btn-secondary sm" data-act="route">${icon('route', { size: 14 })}Add to route</button>
            <button class="btn btn-secondary sm" data-act="email">${icon('mail', { size: 14 })}Email</button>
          </div>
        </div>
      </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
             <a class="btn btn-primary grow" href="#/map?q=${encodeURIComponent(lead.name)}">${icon('navigation', { size: 15 })}Navigate</a>`,
  });

  document.querySelector('.drawer')?.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-act]') : null;
    if (!b) return;
    const labels = { visit: 'Visit logged', appt: 'Appointment sheet opened', route: 'Added to today’s route', email: 'Composer opened' };
    toast(labels[b.dataset.act], { text: lead.name, tone: 'good', timeout: 2400 });
  });
}
