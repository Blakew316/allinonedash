/** Activities — every logged visit, call and appointment. */
import { el, esc, $ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data, TODAY } from '../core/store.js';
import { num, parseDate, DAY_MS } from '../core/format.js';
import { pageHeader, statusBadge, personCell, searchField, emptyState, statCard, runCounters } from '../components/ui.js';
import { dataTable, bindTableControls } from '../components/table.js';
import { drawer, toast } from '../components/overlays.js';

const TYPE_ICON = { 'cc appt': 'calendar', visit: 'pin', call: 'phone', email: 'mail', text: 'message', other: 'activity' };

export default {
  title: 'Activities',

  async view({ query }) {
    const acts = await data('activities');
    const node = el('<div class="page"></div>');

    const types = [...new Set(acts.map((a) => a.type))].sort();
    const statuses = [...new Set(acts.map((a) => a.status))].sort();
    const reps = [...new Set(acts.map((a) => a.rep))].sort();

    const scheduled = acts.filter((a) => a.status === 'scheduled').length;
    const completed = acts.filter((a) => a.status === 'completed').length;
    const future = acts.filter((a) => { const d = parseDate(a.date); return d && d > TODAY; }).length;

    node.appendChild(el(pageHeader({
      title: 'Activities',
      lede: 'The audit trail for the field — what was scheduled, what happened, and what the rep wrote down.',
      meta: `<span class="badge accent">${num(194)} total in the window</span>
             <span class="badge outline" title="The original export paginates at 25 rows; this is page one.">${num(acts.length)} of ${num(194)} in this export</span>`,
      actions: `<button class="btn btn-primary sm" id="act-new">${icon('plus', { size: 15 })}Log activity</button>`,
    })));

    node.appendChild(el(`<section class="grid g-4">
      ${statCard({ label: 'Scheduled', value: scheduled, icon: 'calendar', tone: 'var(--wp-blue)', foot: 'awaiting a result' })}
      ${statCard({ label: 'Completed', value: completed, icon: 'checkCircle', tone: 'var(--wp-green)', foot: 'result recorded' })}
      ${statCard({ label: 'Upcoming', value: future, icon: 'clock', tone: 'var(--wp-cyan)', foot: 'dated after today' })}
      ${statCard({ label: 'Overdue', value: 85, icon: 'alert', tone: 'var(--warn)', foot: '61 by 3+ days' })}
    </section>`));

    node.appendChild(el(`
      <div class="toolbar" id="act-toolbar">
        ${searchField({ placeholder: 'Search company, rep, title or notes…', value: query.q || '' })}
        <span class="sep"></span>
        <select class="select sm" data-filter="type" aria-label="Type" style="width:auto">
          <option value="">All types</option>
          ${types.map((t) => `<option${t === query.type ? ' selected' : ''}>${esc(t)}</option>`).join('')}
        </select>
        <select class="select sm" data-filter="status" aria-label="Status" style="width:auto">
          <option value="">All statuses</option>
          ${statuses.map((s) => `<option${s === query.status ? ' selected' : ''}>${esc(s)}</option>`).join('')}
          <option value="overdue"${query.status === 'overdue' ? ' selected' : ''}>Overdue</option>
        </select>
        <select class="select sm" data-filter="rep" aria-label="Rep" style="width:auto">
          <option value="">All reps</option>
          ${reps.map((r) => `<option${r === query.rep ? ' selected' : ''}>${esc(r)}</option>`).join('')}
        </select>
        <select class="select sm" data-filter="when" aria-label="Date range" style="width:auto">
          <option value="">All time</option>
          <option value="future">Upcoming</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="act-count"></span>
      </div>`));

    const table = dataTable({
      rows: acts,
      searchKeys: ['company', 'rep', 'title', 'notes', 'type'],
      pageSize: 25,
      exportName: 'kloser-activities',
      sortKey: 'date', sortDir: 'desc',
      filterFns: {
        // "Overdue" is not a stored status — it is a scheduled activity whose
        // date has passed. Five screens link here with ?status=overdue.
        status: (r, v) => (v === 'overdue'
          ? r.status === 'scheduled' && (parseDate(r.date) ?? TODAY) < TODAY
          : r.status === v),
        when: (r, v) => {
          const d = parseDate(r.date);
          if (!d) return false;
          if (v === 'future') return d > TODAY;
          return (TODAY - d) / DAY_MS <= Number(v) && d <= TODAY;
        },
      },
      columns: [
        {
          key: 'date', label: 'Date', width: '116px',
          value: (r) => parseDate(r.date)?.getTime() ?? 0,
          render: (r) => {
            const d = parseDate(r.date);
            const upcoming = d && d > TODAY;
            return `<div>
              <div class="cell-strong mono" style="font-size:var(--fs-12)">${esc(r.date)}</div>
              ${upcoming ? '<div class="cell-sub">upcoming</div>' : ''}
            </div>`;
          },
        },
        {
          key: 'company', label: 'Company', width: '22%',
          render: (r) => `<span class="cell-strong truncate" style="display:block">${esc(r.company)}</span>`,
        },
        { key: 'rep', label: 'Assigned Rep', hideBelow: 1000, render: (r) => personCell(r.rep) },
        {
          key: 'type', label: 'Type', width: '104px',
          render: (r) => `<span class="badge outline">${icon(TYPE_ICON[r.type] || 'activity', { size: 12 })}${esc(r.type)}</span>`,
        },
        {
          key: 'title', label: 'Title', hideBelow: 1380,
          render: (r) => `<span class="truncate" style="display:block;max-width:260px">${esc(r.title)}</span>`,
        },
        { key: 'status', label: 'Status', width: '112px', render: (r) => statusBadge(r.status) },
        {
          key: 'result', label: 'Result', hideBelow: 1280,
          render: (r) => r.result ? esc(r.result) : '<span class="subtle">—</span>',
        },
        {
          key: 'notes', label: 'Notes', hideBelow: 1440,
          render: (r) => r.notes
            ? `<span class="clamp-2 subtle" style="font-size:var(--fs-12);max-width:340px">${esc(r.notes)}</span>`
            : '<span class="subtle">—</span>',
        },
        {
          key: 'actions', label: 'Actions', sortable: false, width: '92px',
          render: (r) => `<div class="row-actions" style="justify-content:flex-end">
            <button class="btn btn-ghost sm" data-view-act="${esc(r.title)}">${icon('eye', { size: 13 })}View</button>
          </div>`,
        },
      ],
      onRowClick: (row) => openActivity(row),
      empty: emptyState({
        title: 'No activities match',
        text: 'This rep may simply have nothing logged in the window — several on the roster do. Try a different rep, type or date range.',
        iconName: 'activity',
      }),
    });

    node.appendChild(table.node);
    node._table = table;
    node._acts = acts;
    return node;
  },

  mount(root, { query }) {
    runCounters(root);
    const page = root.firstElementChild;
    const table = page._table;
    const toolbar = $('#act-toolbar', root);
    const countEl = $('#act-count', root);
    const syncCount = () => { countEl.textContent = `${num(table.count)} shown`; };

    bindTableControls(toolbar, table);
    toolbar.addEventListener('change', syncCount);
    toolbar.addEventListener('input', () => setTimeout(syncCount, 180));

    if (query.q) table.setSearch(query.q);
    if (query.type) table.setFilter('type', query.type);
    if (query.rep) table.setFilter('rep', query.rep);
    if (query.status) table.setFilter('status', query.status);
    syncCount();

    $('#act-new', root)?.addEventListener('click', () =>
      toast('Log activity', { text: 'Opens the activity sheet in the production build.', tone: 'info' }));

    root.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('[data-view-act]') : null;
      if (!b) return;
      e.stopPropagation();
      const a = page._acts.find((x) => x.title === b.dataset.viewAct);
      if (a) openActivity(a);
    });
  },
};

function openActivity(a) {
  drawer({
    title: a.title,
    subtitle: `${a.date} · ${a.rep}`,
    body: `
      <div class="col" style="gap:var(--s-5)">
        <div class="row wrap" style="gap:var(--s-2)">
          ${statusBadge(a.status)}
          <span class="badge outline">${icon(TYPE_ICON[a.type] || 'activity', { size: 12 })}${esc(a.type)}</span>
          <span class="badge outline">${icon('calendar', { size: 12 })}${esc(a.date)}</span>
        </div>

        <dl class="dl">
          <dt>Company</dt><dd class="strong">${esc(a.company)}</dd>
          <dt>Assigned rep</dt><dd>${esc(a.rep)}</dd>
          <dt>Type</dt><dd>${esc(a.type)}</dd>
          <dt>Status</dt><dd>${esc(a.status)}</dd>
          <dt>Result</dt><dd>${esc(a.result || 'Not yet recorded')}</dd>
        </dl>

        <div>
          <div class="eyebrow" style="margin-bottom:var(--s-2)">Setter notes</div>
          <div class="card pad-sm" style="background:var(--bg-sunken);font-size:var(--fs-13);line-height:var(--lh-loose);white-space:pre-wrap">${esc(a.notes || 'No notes were left on this activity.')}</div>
        </div>
      </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
             <button class="btn btn-primary grow" id="act-complete">${icon('check', { size: 15 })}Mark complete</button>`,
  });
  $('#act-complete')?.addEventListener('click', () => {
    toast('Marked complete', { text: a.company, tone: 'good' });
    document.querySelector('.drawer-host [data-close]')?.click();
  });
}
