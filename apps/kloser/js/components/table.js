/**
 * Data table: sortable, searchable, paginated, CSV-exportable.
 * Built to stay smooth on the 925-row rep datasets by rendering only a page
 * of rows at a time and re-using a single <tbody> swap per update.
 */
import { esc, el, $, $$, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { num, sortBy } from '../core/format.js';
import { emptyState } from './ui.js';
import { toast } from './overlays.js';

/**
 * @param {Object} spec
 * @param {Array<Object>} spec.rows
 * @param {Array<{key:string,label:string,num?:boolean,sortable?:boolean,
 *                render?:(row:Object)=>string, value?:(row:Object)=>any,
 *                width?:string, hideBelow?:number}>} spec.columns
 * @param {string[]} [spec.searchKeys]
 * @param {number} [spec.pageSize]
 * @param {string} [spec.sortKey]
 * @param {'asc'|'desc'} [spec.sortDir]
 * @param {(row:Object)=>void} [spec.onRowClick]
 * @param {string} [spec.empty]
 * @param {string} [spec.exportName]
 */
export function dataTable(spec) {
  const {
    rows, columns, searchKeys = [], pageSize = 25,
    onRowClick, empty, exportName, maxHeight, compact: isCompact,
    // Row selection, matching the original app's "Select all matching".
    selectable = false, rowKey = (r, i) => String(i), bulkActions = [],
    // Column visibility, matching the original's columns toggle.
    columnToggle = false,
  } = spec;

  const state = {
    sortKey: spec.sortKey || null,
    sortDir: spec.sortDir || 'asc',
    page: 1,
    q: '',
    filters: {},
    pageSize,
    selected: new Set(),
    hidden: new Set(),
  };

  // Identity by position, resolved through a map so it stays O(1) and is
  // immune to duplicate field values (two leads can share a business name).
  const rowIndex = new Map(rows.map((r, i) => [r, i]));
  const keyOf = (row) => rowKey(row, rowIndex.get(row));
  const shown = () => columns.filter((c) => !state.hidden.has(c.key));

  const node = el(`
    <div class="table-shell col" style="gap:var(--s-3)">
      <div class="table-toolbar toolbar" hidden></div>
      <div class="selection-bar" hidden>
        <span class="sel-count"></span>
        <button class="btn btn-ghost sm" data-sel-clear>Clear</button>
        <span class="spacer"></span>
        <span class="sel-actions"></span>
      </div>
      <div class="card flush reveal">
        <div class="table-wrap scroll-x"${maxHeight ? ` style="--table-max:${maxHeight}"` : ''}>
          <table class="data${isCompact ? ' compact' : ''}">
            <thead><tr></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="pager"></div>
      </div>
    </div>`);

  const thead = $('thead tr', node);
  const tbody = $('tbody', node);
  const pager = $('.pager', node);

  /* -------------------------------------------------------------- header */
  function paintHead() {
    thead.innerHTML =
      (selectable ? `<th class="col-select"><button class="checkbox" role="checkbox"
          data-select-all aria-checked="false" aria-label="Select all matching"></button></th>` : '') +
      shown().map((c) => `
      <th class="${c.num ? 'num' : ''} ${c.sortable === false ? '' : 'sortable'}"
          data-key="${esc(c.key)}"${c.width ? ` style="width:${c.width}"` : ''}
          ${c.hideBelow ? `data-hide-below="${c.hideBelow}"` : ''}>
        ${esc(c.label)}${c.sortable === false ? '' : `<span class="sort-ind">${icon('chevronUp', { size: 11 })}</span>`}
      </th>`).join('');
  }
  paintHead();

  thead.addEventListener('click', (e) => {
    const all = e.target instanceof Element ? e.target.closest('[data-select-all]') : null;
    if (all) {
      const list = visible();
      const keys = list.map(keyOf);
      const every = keys.length > 0 && keys.every((k) => state.selected.has(k));
      if (every) keys.forEach((k) => state.selected.delete(k));
      else keys.forEach((k) => state.selected.add(k));
      update();
      return;
    }
    const th = e.target instanceof Element ? e.target.closest('th.sortable') : null;
    if (!th) return;
    const key = th.dataset.key;
    if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortKey = key; state.sortDir = columns.find((c) => c.key === key)?.num ? 'desc' : 'asc'; }
    state.page = 1;
    update();
  });

  /* -------------------------------------------------------------- compute */
  function visible() {
    let out = rows;

    const q = state.q.trim().toLowerCase();
    if (q && searchKeys.length) {
      out = out.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
    }
    for (const [key, val] of Object.entries(state.filters)) {
      if (!val) continue;
      const f = spec.filterFns?.[key];
      out = f ? out.filter((r) => f(r, val)) : out.filter((r) => String(r[key] ?? '') === val);
    }
    if (state.sortKey) {
      const col = columns.find((c) => c.key === state.sortKey);
      const accessor = col?.value || ((r) => r[state.sortKey]);
      out = sortBy(out, accessor, state.sortDir);
    }
    return out;
  }

  /* --------------------------------------------------------------- render */
  function update() {
    const list = visible();
    const pages = Math.max(1, Math.ceil(list.length / state.pageSize));
    state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize;
    const slice = list.slice(start, start + state.pageSize);

    $$('th[data-key]', thead).forEach((th) => {
      if (th.dataset.key === state.sortKey) {
        th.setAttribute('aria-sort', state.sortDir === 'asc' ? 'ascending' : 'descending');
      } else th.removeAttribute('aria-sort');
    });

    const cols = shown();
    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="${cols.length + (selectable ? 1 : 0)}" style="padding:0">
        ${empty || emptyState({ title: 'Nothing matches those filters', text: 'Try widening the search or clearing a filter.', iconName: 'filter' })}
      </td></tr>`;
    } else {
      tbody.innerHTML = slice.map((row, i) => {
        const k = keyOf(row);
        const on = state.selected.has(k);
        return `
        <tr class="${onRowClick ? 'clickable' : ''}${on ? ' is-selected' : ''}" data-index="${start + i}"
            style="animation:rise-sm 280ms var(--ease-out) ${Math.min(i, 18) * 14}ms both">
          ${selectable ? `<td class="col-select"><button class="checkbox" role="checkbox"
              data-select-row="${esc(k)}" aria-checked="${on}"
              aria-label="Select ${esc(spec.rowLabel ? spec.rowLabel(row) : k)}"></button></td>` : ''}
          ${cols.map((c) => `<td class="${c.num ? 'num' : ''}"${c.hideBelow ? ` data-hide-below="${c.hideBelow}"` : ''}>${
            c.render ? c.render(row) : esc(row[c.key] ?? '—')
          }</td>`).join('')}
        </tr>`;
      }).join('');

      if (onRowClick) {
        $$('tbody tr', node).forEach((tr) => {
          tr.addEventListener('click', (e) => {
            if (e.target instanceof Element && e.target.closest('a,button')) return;
            const idx = Number(tr.dataset.index);
            onRowClick(list[idx], idx);
          });
        });
      }

      if (selectable) {
        $$('[data-select-row]', tbody).forEach((cb) => cb.addEventListener('click', (e) => {
          e.stopPropagation();
          const k = cb.dataset.selectRow;
          if (state.selected.has(k)) state.selected.delete(k); else state.selected.add(k);
          update();
        }));
      }
    }

    if (selectable) paintSelection(list);

    renderPager(list.length, pages);
    applyResponsive();
  }

  function paintSelection(list) {
    const bar = $('.selection-bar', node);
    const all = $('[data-select-all]', thead);
    const n = state.selected.size;

    bar.hidden = n === 0;
    $('.sel-count', bar).innerHTML =
      `<b class="strong tnum">${num(n)}</b> selected`;
    $('.sel-actions', bar).innerHTML = bulkActions.map((a, i) =>
      `<button class="btn ${a.tone || 'btn-secondary'} sm" data-bulk="${i}">${a.icon ? icon(a.icon, { size: 14 }) : ''}${esc(a.label)}</button>`).join('');
    $$('[data-bulk]', bar).forEach((b) => b.addEventListener('click', () => {
      const action = bulkActions[Number(b.dataset.bulk)];
      const picked = rows.filter((r) => state.selected.has(keyOf(r)));
      action.run(picked, () => { state.selected.clear(); update(); });
    }));

    if (all) {
      // "Select all matching" covers everything the filters return, not just
      // the visible page — that is what the original app does.
      const keys = list.map(keyOf);
      const every = keys.length > 0 && keys.every((k) => state.selected.has(k));
      const some = keys.some((k) => state.selected.has(k));
      all.setAttribute('aria-checked', every ? 'true' : some ? 'mixed' : 'false');
    }
  }

  function renderPager(total, pages) {
    const from = total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const to = Math.min(total, state.page * state.pageSize);
    const win = [];
    const push = (p) => win.push(p);
    if (pages <= 7) for (let p = 1; p <= pages; p++) push(p);
    else {
      push(1);
      if (state.page > 3) push('…');
      for (let p = Math.max(2, state.page - 1); p <= Math.min(pages - 1, state.page + 1); p++) push(p);
      if (state.page < pages - 2) push('…');
      push(pages);
    }

    pager.innerHTML = `
      <div class="row" style="gap:var(--s-3)">
        <span>${num(from)}–${num(to)} of <b class="strong">${num(total)}</b></span>
        <select class="select sm" data-pagesize aria-label="Rows per page" style="width:auto">
          ${[25, 50, 100, 200].map((n) => `<option value="${n}"${n === state.pageSize ? ' selected' : ''}>${n} / page</option>`).join('')}
        </select>
        ${exportName ? `<button class="btn btn-ghost sm" data-export>${icon('download', { size: 14 })}Export</button>` : ''}
      </div>
      <div class="pager-btns">
        <button class="page-btn" data-page="prev" ${state.page === 1 ? 'disabled' : ''} aria-label="Previous page">${icon('chevronLeft', { size: 15 })}</button>
        ${win.map((p) => p === '…'
          ? '<span class="page-btn" aria-hidden="true">…</span>'
          : `<button class="page-btn" data-page="${p}" ${p === state.page ? 'aria-current="true"' : ''}>${p}</button>`).join('')}
        <button class="page-btn" data-page="next" ${state.page === pages ? 'disabled' : ''} aria-label="Next page">${icon('chevronRight', { size: 15 })}</button>
      </div>`;

    $$('[data-page]', pager).forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.page;
      if (v === 'prev') state.page = Math.max(1, state.page - 1);
      else if (v === 'next') state.page = Math.min(pages, state.page + 1);
      else state.page = Number(v);
      update();
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));

    $('[data-pagesize]', pager)?.addEventListener('change', (e) => {
      state.pageSize = Number(e.target.value);
      state.page = 1;
      update();
    });

    $('[data-export]', pager)?.addEventListener('click', () => exportCSV(visible()));
  }

  /* ---------------------------------------------------------- responsive */
  function applyResponsive() {
    const w = window.innerWidth;
    $$('[data-hide-below]', node).forEach((cell) => {
      cell.style.display = w < Number(cell.dataset.hideBelow) ? 'none' : '';
    });
  }
  window.addEventListener('resize', debounce(applyResponsive, 140));

  /* --------------------------------------------------------------- export */
  function exportCSV(list) {
    // The actions column has no label and no data — exporting it just adds a
    // blank column to every row of the spreadsheet.
    const cols = columns.filter((c) => c.label);
    const head = cols.map((c) => c.label);
    const body = list.map((r) => cols.map((c) => {
      // c.value is the SORT accessor — for a date column it is an age in hours.
      // Export the underlying field, and fall back to the accessor only for
      // columns that are computed rather than stored.
      const v = c.exportValue ? c.exportValue(r)
        : (c.key in r ? r[c.key] : (c.value ? c.value(r) : ''));
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }));
    const csv = [head.join(','), ...body.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportName || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Export ready', { text: `${num(list.length)} rows written to ${a.download}`, tone: 'good' });
  }

  /* ------------------------------------------------------------- controls */
  /** Controls bound by bindTableControls, so programmatic filtering can move
      the UI that represents it instead of silently diverging from it. */
  const bound = new Map();

  const api = {
    node,
    bindControl(key, elm) { bound.set(key, elm); },
    setSearch(q) {
      state.q = q; state.page = 1;
      const c = bound.get('__search');
      if (c && c.value !== q) c.value = q;
      update();
    },
    setFilter(key, val) {
      state.filters[key] = val; state.page = 1;
      const c = bound.get(key);
      if (c && c.value !== val) {
        // A programmatic value with no matching <option> would silently reset
        // the select to its first entry, so add it rather than lose it.
        if (c.tagName === 'SELECT' && val && ![...c.options].some((o) => o.value === val)) {
          c.add(new Option(val, val));
        }
        c.value = val;
      }
      update();
    },
    setPageSize(n) { state.pageSize = n; state.page = 1; update(); },
    get count() { return visible().length; },
    get selection() { return rows.filter((r) => state.selected.has(keyOf(r))); },
    clearSelection() { state.selected.clear(); update(); },
    /** Column visibility, for the original's columns toggle. */
    get columns() { return columns.map((c) => ({ key: c.key, label: c.label, visible: !state.hidden.has(c.key) })); },
    toggleColumn(key) {
      if (state.hidden.has(key)) state.hidden.delete(key); else state.hidden.add(key);
      paintHead();
      update();
    },
    refresh: update,
  };

  $('[data-sel-clear]', node)?.addEventListener('click', () => {
    state.selected.clear();
    update();
  });

  update();
  return api;
}

/**
 * Wires a toolbar's [data-search] / [data-filter] controls to a table API.
 */
export function bindTableControls(root, table) {
  const search = $('[data-search]', root);
  if (search) {
    table.bindControl('__search', search);
    search.addEventListener('input', debounce((e) => table.setSearch(e.target.value), 140));
  }
  $$('[data-filter]', root).forEach((sel) => {
    table.bindControl(sel.dataset.filter, sel);
    sel.addEventListener('change', (e) => table.setFilter(sel.dataset.filter, e.target.value));
  });
}
