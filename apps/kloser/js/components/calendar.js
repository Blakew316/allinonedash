/**
 * A month calendar you can actually work in.
 *
 * Renders a real month grid, marks the days that carry events, lets one be
 * selected, and moves between months. It owns no data of its own — the caller
 * hands it events with a date and gets back a day when one is chosen.
 */
import { el, esc, $, $$ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { num } from '../core/format.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * @param {HTMLElement} host
 * @param {{
 *   month: Date,                       // any date inside the month to show
 *   today: Date,
 *   selected?: Date|null,
 *   events: Array<{date: Date, tone?: string}>,
 *   onSelect?: (d: Date) => void,
 *   onMonth?: (d: Date) => void,
 * }} opts
 */
export function monthCalendar(host, opts) {
  const state = {
    month: new Date(opts.month.getFullYear(), opts.month.getMonth(), 1),
    selected: opts.selected || null,
    events: opts.events || [],
    today: opts.today,
  };

  host.classList.add('cal');
  host.innerHTML = `
    <div class="cal-head">
      <div class="row" style="gap:var(--s-2)">
        <button class="icon-btn" data-mv="-1" aria-label="Previous month">${icon('chevronLeft', { size: 16 })}</button>
        <h3 class="cal-title" id="cal-title" aria-live="polite"></h3>
        <button class="icon-btn" data-mv="1" aria-label="Next month">${icon('chevronRight', { size: 16 })}</button>
      </div>
      <div class="row" style="gap:var(--s-2)">
        <span class="muted" id="cal-count" style="font-size:var(--fs-12)"></span>
        <button class="btn btn-secondary sm" data-today>Today</button>
      </div>
    </div>
    <div class="cal-dow" aria-hidden="true">${DOW.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid" id="cal-grid" role="grid" aria-label="Month"></div>`;

  const grid = $('#cal-grid', host);
  const title = $('#cal-title', host);
  const count = $('#cal-count', host);

  function byDay() {
    const map = new Map();
    state.events.forEach((e) => {
      if (!e.date) return;
      const k = dayKey(e.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    });
    return map;
  }

  function paint() {
    const y = state.month.getFullYear();
    const m = state.month.getMonth();
    title.textContent = `${MONTHS[m]} ${y}`;

    const first = new Date(y, m, 1);
    const days = new Date(y, m + 1, 0).getDate();
    const pad = first.getDay();
    const map = byDay();

    const inMonth = state.events.filter((e) => e.date && e.date.getFullYear() === y && e.date.getMonth() === m);
    count.textContent = inMonth.length
      ? `${num(inMonth.length)} this month`
      : 'nothing this month';

    const cells = [];
    // Trailing days of the previous month, so the grid never starts ragged.
    const prevDays = new Date(y, m, 0).getDate();
    for (let i = pad - 1; i >= 0; i--) {
      cells.push(`<div class="cal-day is-outside" role="gridcell" aria-disabled="true">
        <span class="cal-num">${prevDays - i}</span></div>`);
    }
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, m, d);
      const list = map.get(dayKey(date)) || [];
      const isToday = sameDay(date, state.today);
      const isSel = sameDay(date, state.selected);
      const tones = [...new Set(list.map((e) => e.tone).filter(Boolean))].slice(0, 4);
      cells.push(`
        <button class="cal-day${isToday ? ' is-today' : ''}${isSel ? ' is-selected' : ''}${list.length ? ' has-events' : ''}"
          role="gridcell" data-day="${d}"
          aria-label="${MONTHS[m]} ${d}, ${list.length} scheduled${isToday ? ', today' : ''}"
          aria-selected="${isSel}">
          <span class="cal-num">${d}</span>
          ${list.length ? `<span class="cal-count">${num(list.length)}</span>` : ''}
          ${tones.length ? `<span class="cal-dots">${tones.map((t) => `<i style="background:${t}"></i>`).join('')}</span>` : ''}
        </button>`);
    }
    // Lead days of the next month, to square the last row off.
    while (cells.length % 7) {
      const n = cells.length - pad - days + 1;
      cells.push(`<div class="cal-day is-outside" role="gridcell" aria-disabled="true">
        <span class="cal-num">${n}</span></div>`);
    }
    grid.innerHTML = cells.join('');

    $$('[data-day]', grid).forEach((b) => b.addEventListener('click', () => {
      const d = new Date(y, m, Number(b.dataset.day));
      state.selected = sameDay(d, state.selected) ? null : d;
      paint();
      if (typeof opts.onSelect === 'function') opts.onSelect(state.selected);
    }));
  }

  function move(delta) {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + delta, 1);
    paint();
    if (typeof opts.onMonth === 'function') opts.onMonth(state.month);
  }

  $$('[data-mv]', host).forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.mv))));
  $('[data-today]', host).addEventListener('click', () => {
    state.month = new Date(state.today.getFullYear(), state.today.getMonth(), 1);
    state.selected = new Date(state.today);
    paint();
    if (typeof opts.onMonth === 'function') opts.onMonth(state.month);
    if (typeof opts.onSelect === 'function') opts.onSelect(state.selected);
  });

  // Arrow keys walk the grid, because a calendar is a grid.
  host.addEventListener('keydown', (e) => {
    if (!e.target.matches || !e.target.matches('[data-day]')) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const cells = $$('[data-day]', grid);
    const i = cells.indexOf(e.target);
    const next = cells[i + step];
    if (next) next.focus();
    else move(step < 0 ? -1 : 1);
  });

  paint();

  return {
    host,
    get month() { return new Date(state.month); },
    get selected() { return state.selected ? new Date(state.selected) : null; },
    setEvents(list) { state.events = list || []; paint(); },
    setMonth(d) { state.month = new Date(d.getFullYear(), d.getMonth(), 1); paint(); },
    select(d) { state.selected = d ? new Date(d) : null; paint(); },
    redraw: paint,
  };
}
