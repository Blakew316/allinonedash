/** Rep Pipeline — the lead book as a stage board. */
import { el, esc, $, $$, onToolbarChange } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data } from '../core/store.js';
import { num, parseAddress, groupBy } from '../core/format.js';
import { pageHeader, searchField, avatar, mountSegmented } from '../components/ui.js';
import { openLead } from './leads.js';
import { toast } from '../components/overlays.js';
import { navigate } from '../core/router.js';

const COLUMNS = [
  { stage: 'Prospecting', tone: '#AAAFB5', book: 505 },
  { stage: 'Follow Up', tone: '#00BAE6', book: 40 },
  { stage: 'Appointment Set', tone: '#0090E9', book: 86 },
  { stage: 'Appointment Held', tone: '#7C5CFF', book: 8 },
  { stage: 'Business Card Lead', tone: '#E8A317', book: 16 },
  { stage: 'WPI Hot Lead', tone: '#FF7A45', book: 0 },
  { stage: 'Giving Payments', tone: '#4FE778', book: 0 },
  { stage: 'Deal Signed', tone: '#00C271', book: 5 },
  { stage: 'Customer', tone: '#00A88A', book: 0 },
  { stage: 'Lost', tone: '#E5484D', book: 5 },
];

export default {
  title: 'Rep Pipeline',

  async view({ query }) {
    const [leads, dash] = await Promise.all([data('leads'), data('dashboard')]);
    const bookTotal = dash.stageLadder?.total ?? leads.length;
    const node = el('<div class="page"></div>');
    const reps = [...new Set(leads.map((l) => l.owner).filter(Boolean))].sort();

    node.appendChild(el(pageHeader({
      title: 'Rep Pipeline',
      lede: 'Drag-free stage board — every lead sits in the column that matches its stage, newest first.',
      meta: `<span class="badge accent">${num(bookTotal)} leads in the book</span>
             <span class="badge outline">${COLUMNS.length} stages</span>`,
      actions: `
        <div class="segmented" role="tablist" aria-label="View">
          <span class="thumb" aria-hidden="true"></span>
          <button role="tab" type="button" aria-selected="false" data-view="list">${icon('list', { size: 13 })}List</button>
          <button role="tab" type="button" aria-selected="true" data-view="pipeline">${icon('funnel', { size: 13 })}Pipeline</button>
        </div>
        <button class="btn btn-primary sm" id="pipe-new">${icon('plus', { size: 15 })}New lead</button>`,
    })));

    node.appendChild(el(`
      <div class="toolbar" id="pipe-toolbar">
        ${searchField({ placeholder: 'Filter the board…', value: query.q || '' })}
        <span class="sep"></span>
        <select class="select sm" id="pipe-rep" aria-label="Rep" style="width:auto">
          <option value="">All reps</option>
          ${reps.map((r) => `<option${r === query.rep ? ' selected' : ''}>${esc(r)}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="pipe-count"></span>
      </div>`));

    node.appendChild(el('<div class="kanban" id="kanban"></div>'));
    node._leads = leads;
    return node;
  },

  mount(root, { query }) {
    const page = root.firstElementChild;
    const leads = page._leads;
    const board = $('#kanban', root);
    const countEl = $('#pipe-count', root);

    function paint() {
      const q = ($('[data-search]', root)?.value || '').trim().toLowerCase();
      const rep = $('#pipe-rep', root)?.value || '';
      const filtered = leads.filter((l) => {
        if (rep && l.owner !== rep) return false;
        if (!q) return true;
        return [l.name, l.customer, l.address, l.owner].some((v) => String(v || '').toLowerCase().includes(q));
      });
      countEl.textContent = `${num(filtered.length)} shown`;

      const byStage = groupBy(filtered, (l) => l.stage);
      board.innerHTML = COLUMNS.map((col) => {
        const items = byStage.get(col.stage) || [];
        return `<section class="kanban-col" style="--tone:${col.tone}">
          <header class="kanban-head">
            <span class="kh-name"><span class="kh-dot"></span>${esc(col.stage)}</span>
            <span class="badge outline tnum">${num(items.length)}${col.book && col.book !== items.length ? ` / ${num(col.book)}` : ''}</span>
          </header>
          <div class="kanban-body">
            ${items.length ? items.slice(0, 60).map((l, i) => {
              const addr = parseAddress(l.address);
              return `<button class="kanban-card" data-lead="${esc(l.name)}" style="--i:${i}">
                <div class="row" style="gap:var(--s-2);min-width:0">
                  ${avatar(l.name, 'xs')}
                  <span class="kc-title truncate grow">${esc(l.name)}</span>
                </div>
                <div class="kc-sub truncate">${esc(l.customer || 'No contact yet')}${l.role ? ` · ${esc(l.role)}` : ''}</div>
                <div class="kc-foot">
                  <span class="badge outline" style="font-size:10px">${icon('pin', { size: 11 })}${esc(addr.state || '—')}</span>
                  <span class="subtle mono" style="font-size:10px">${esc(l.created)}</span>
                </div>
              </button>`;
            }).join('') + (items.length > 60 ? `<div class="subtle" style="font-size:var(--fs-11);text-align:center;padding:var(--s-2)">+${num(items.length - 60)} more — narrow the filter to see them</div>` : '')
              : `<div class="subtle" style="font-size:var(--fs-12);text-align:center;padding:var(--s-5) var(--s-3)">
                   ${col.book ? `Nothing on this page — ${num(col.book)} sit here in the full book.` : 'Empty stage.'}
                 </div>`}
          </div>
        </section>`;
      }).join('');
    }

    paint();
    if (query.q) { const s = $('[data-search]', root); if (s) { s.value = query.q; paint(); } }

    $('#pipe-toolbar', root).addEventListener('input', paint);
    onToolbarChange($('#pipe-toolbar', root), paint);

    board.addEventListener('click', (e) => {
      const card = e.target instanceof Element ? e.target.closest('[data-lead]') : null;
      if (!card) return;
      const lead = leads.find((l) => l.name === card.dataset.lead);
      if (lead) openLead(lead);
    });

    $('#pipe-new', root)?.addEventListener('click', () =>
      toast('New lead', { text: 'Opens the create-lead sheet in the production build.', tone: 'info' }));

    // Same toggle as the list view, so the two are one screen with two shapes.
    mountSegmented(root, () => {});
    $$('[data-view]', root).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.view !== 'list') return;
      // Carry the whole filter set across, so switching shape never loses work.
      const params = new URLSearchParams();
      const q = $('[data-search]', root)?.value || '';
      const rep = $('#pipe-rep', root)?.value || '';
      if (q) params.set('q', q);
      if (rep) params.set('owner', rep);
      navigate(`list${params.toString() ? `?${params}` : ''}`);
    }));
  },
};
