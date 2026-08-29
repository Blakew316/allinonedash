/** My Schedule — today, overdue and upcoming activity for the signed-in user. */
import { el, esc, $, $$, onToolbarChange } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data, TODAY, session } from '../core/store.js';
import { num, parseDate, groupBy } from '../core/format.js';
import { pageHeader, segmented, mountSegmented, tabs, mountTabs, emptyState, statusBadge, runCounters, searchField } from '../components/ui.js';
import { toast, drawer } from '../components/overlays.js';
import { setQuery } from '../core/router.js';

const TYPE_META = {
  'cc appt': { label: 'Appt', icon: 'calendar', tone: 'var(--wp-blue)' },
  visit: { label: 'Visit', icon: 'pin', tone: 'var(--wp-green)' },
  call: { label: 'Call', icon: 'phone', tone: 'var(--wp-cyan)' },
  email: { label: 'Email', icon: 'mail', tone: 'var(--wp-mint)' },
  text: { label: 'Text', icon: 'message', tone: '#7C5CFF' },
  other: { label: 'Other', icon: 'activity', tone: 'var(--wp-gray)' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default {
  title: 'My Schedule',

  async view({ query }) {
    const acts = await data('activities');
    const node = el('<div class="page"></div>');

    const dated = acts.map((a) => ({ ...a, _d: parseDate(a.date) })).filter((a) => a._d);
    const today = dated.filter((a) => sameDay(a._d, TODAY));
    const overdue = dated.filter((a) => a._d < TODAY && !sameDay(a._d, TODAY) && a.status === 'scheduled');
    const upcoming = dated.filter((a) => a._d > TODAY);

    const counts = {
      appt: dated.filter((a) => a.type === 'cc appt').length,
      email: dated.filter((a) => a.type === 'email').length,
      calls: dated.filter((a) => a.type === 'call').length,
      texts: dated.filter((a) => a.type === 'text').length,
      other: dated.filter((a) => !['cc appt', 'email', 'call', 'text'].includes(a.type)).length,
    };

    node.appendChild(el(pageHeader({
      title: 'My Schedule',
      lede: `Everything on ${session.name.split(' ')[0]}’s plate — today first, overdue next, then the week ahead.`,
      meta: `<span class="badge outline">${icon('clock', { size: 12 })}${esc(session.timezone)}</span>
             <span class="badge accent">${num(dated.length)} activities loaded</span>`,
      actions: `
        ${segmented({ name: 'scope', value: query.scope || 'all', options: [{ value: 'mine', label: 'Mine' }, { value: 'all', label: 'All reps' }] })}
        <button class="btn btn-primary sm" id="sched-new">${icon('plus', { size: 15 })}New</button>`,
    })));

    /* ------------------------------------------------------- type summary */
    node.appendChild(el(`<section class="grid g-6">
      ${[
        ['Appointments', counts.appt, 'calendar', 'var(--wp-blue)'],
        ['Emails', counts.email, 'mail', 'var(--wp-cyan)'],
        ['Calls', counts.calls, 'phone', 'var(--wp-green)'],
        ['Texts', counts.texts, 'message', 'var(--wp-mint)'],
        ['Other', counts.other, 'activity', 'var(--wp-gray)'],
        ['Overdue', overdue.length, 'alert', 'var(--warn)'],
      ].map(([label, value, ic, tone]) => `
        <div class="card pad-sm reveal" style="--tone:${tone}">
          <div class="row" style="gap:var(--s-3)">
            <span class="stat-icon">${icon(ic, { size: 16 })}</span>
            <div>
              <div class="strong tnum" style="font-size:var(--fs-20)" data-count-to="${value}">0</div>
              <div class="subtle" style="font-size:var(--fs-11)">${esc(label)}</div>
            </div>
          </div>
        </div>`).join('')}
    </section>`));

    node.appendChild(el(tabs({
      name: 'sched', value: query.tab || 'today',
      items: [
        { value: 'today', label: 'Today', count: today.length },
        { value: 'overdue', label: 'Overdue', count: overdue.length },
        { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
        { value: 'calendar', label: 'Calendar' },
      ],
    })));

    node.appendChild(el(`
      <div class="toolbar" id="sched-toolbar">
        ${searchField({ placeholder: 'Search this schedule…' })}
        <span class="sep"></span>
        <select class="select sm" id="sched-type" aria-label="Type" style="width:auto">
          <option value="">All types</option>
          ${[...new Set(dated.map((a) => a.type))].sort().map((t) => `<option>${esc(t)}</option>`).join('')}
        </select>
        <button class="btn btn-ghost sm" id="sched-refresh">${icon('refresh', { size: 14 })}Refresh</button>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="sched-count"></span>
      </div>`));

    node.appendChild(el('<div id="sched-panel" class="col" style="gap:var(--s-4)"></div>'));
    node._sets = { today, overdue, upcoming, dated };
    return node;
  },

  mount(root, { query }) {
    runCounters(root);
    const sets = root.firstElementChild._sets;
    const panel = $('#sched-panel', root);

    /** Apply the scope switch plus the toolbar's search and type filter. */
    function narrow(list) {
      const q = ($('[data-search]', root)?.value || '').trim().toLowerCase();
      const type = $('#sched-type', root)?.value || '';
      const mine = $('[data-segmented="scope"] [aria-selected="true"]', root)?.dataset.value !== 'all';
      return list.filter((a) => {
        // "Mine" is the signed-in user's own book; "All reps" is everyone's.
        if (mine && a.rep !== session.name) return false;
        if (type && a.type !== type) return false;
        if (!q) return true;
        return [a.company, a.title, a.rep, a.notes].some((v) => String(v || '').toLowerCase().includes(q));
      });
    }

    function agenda(input, emptyCopy) {
      const list = narrow(input);
      const counter = $('#sched-count', root);
      if (counter) counter.textContent = `${list.length} shown`;
      if (!list.length) return emptyCopy;
      const byDate = groupBy(list, (a) => a.date);
      return [...byDate.entries()].map(([date, items]) => `
        <section class="card flush reveal">
          <div class="card-head">
            <div><h3>${esc(date)}</h3><div class="sub">${num(items.length)} activit${items.length === 1 ? 'y' : 'ies'}</div></div>
            <span class="badge outline">${esc(DAY_NAMES[parseDate(date)?.getDay() ?? 0])}</span>
          </div>
          <div class="list">
            ${items.map((a) => {
              const meta = TYPE_META[a.type] || TYPE_META.other;
              return `<button class="list-row" data-act="${esc(a.title)}">
                <span class="stat-icon" style="--tone:${meta.tone};width:30px;height:30px">${icon(meta.icon, { size: 15 })}</span>
                <span class="grow" style="min-width:0;text-align:left">
                  <span class="list-title truncate" style="display:block">${esc(a.company)}</span>
                  <span class="list-sub truncate" style="display:block">${esc(a.title)}</span>
                </span>
                ${statusBadge(a.status)}
                ${icon('chevronRight', { size: 16, cls: 'ico subtle' })}
              </button>`;
            }).join('')}
          </div>
        </section>`).join('');
    }

    let calendarSet = sets.dated;

    function draw(tab) {
      if (tab === 'today') {
        panel.innerHTML = agenda(sets.today, emptyState({
          title: 'Nothing scheduled for today',
          text: 'Your next appointment is on Aug 24. Use Start Day to begin logging visits as you knock.',
          iconName: 'calendar',
          action: '<a class="btn btn-primary sm" href="#/list">Find leads nearby</a>',
        }));
      } else if (tab === 'overdue') {
        panel.innerHTML = agenda(sets.overdue, emptyState({
          title: 'Nothing overdue on this page',
          text: 'Across the whole organization 85 activities are past due, 61 of them by more than three days.',
          iconName: 'checkCircle',
          action: '<a class="btn btn-secondary sm" href="#/activities">Open all activities</a>',
        }));
      } else if (tab === 'upcoming') {
        panel.innerHTML = agenda(sets.upcoming, emptyState({
          title: 'Nothing upcoming', text: 'New appointments show up here as soon as the call center books them.', iconName: 'clock',
        }));
      } else {
        // The month respects the same scope, type and search the agendas do —
        // a calendar that ignores the filters above it is a different dataset.
        calendarSet = narrow(sets.dated);
        const counter = $('#sched-count', root);
        if (counter) counter.textContent = `${calendarSet.length} shown`;
        panel.innerHTML = monthGrid(calendarSet);
      }

      $$('[data-act]', panel).forEach((b) => b.addEventListener('click', () => {
        const a = sets.dated.find((x) => x.title === b.dataset.act);
        if (a) openActivity(a);
      }));
      $$('[data-day]', panel).forEach((b) => b.addEventListener('click', () =>
        openCalendarDay(Number(b.dataset.day), calendarSet)));
    }

    let tab = query.tab || 'today';
    draw(tab);
    mountTabs(root, (val, name) => {
      if (name !== 'sched') return;
      tab = val;
      setQuery({ tab: val });
      draw(val);
    });
    $('#sched-toolbar', root).addEventListener('input', () => draw(tab));
    onToolbarChange($('#sched-toolbar', root), () => draw(tab));
    $('#sched-refresh', root).addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>Refreshing';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = `${icon('refresh', { size: 14 })}Refresh`;
        draw(tab);
        toast('Schedule refreshed', { tone: 'good', timeout: 2000 });
      }, 700);
    });
    mountSegmented(root, (val, name) => {
      if (name !== 'scope') return;
      setQuery({ scope: val });
      draw(tab);
      toast(val === 'all' ? 'Showing every rep' : `Showing ${session.name.split(' ')[0]}’s schedule`, { timeout: 2000 });
    });
    $('#sched-new', root)?.addEventListener('click', () =>
      toast('New activity', { text: 'Opens the scheduling sheet in the production build.', tone: 'info' }));
  },
};

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthGrid(dated) {
  const year = TODAY.getFullYear();
  const month = TODAY.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const pad = first.getDay();
  const byDay = new Map();
  dated.forEach((a) => {
    if (a._d.getFullYear() === year && a._d.getMonth() === month) {
      const k = a._d.getDate();
      byDay.set(k, (byDay.get(k) || 0) + 1);
    }
  });

  const cells = [];
  for (let i = 0; i < pad; i++) cells.push('<div></div>');
  const monthName = first.toLocaleString('en-US', { month: 'long' });
  for (let d = 1; d <= days; d++) {
    const count = byDay.get(d) || 0;
    const isToday = d === TODAY.getDate();
    // Every cell is a button. A day with nothing on it is still a day you can
    // ask about, and a grid where only some squares respond feels broken.
    cells.push(`
      <button type="button" class="cal-cell card pad-sm" data-day="${d}"
        aria-label="${monthName} ${d}${isToday ? ', today' : ''}, ${count} activit${count === 1 ? 'y' : 'ies'}"
        style="min-height:82px;${isToday ? 'border-color:var(--accent);box-shadow:var(--ring)' : ''}${count ? '' : ';opacity:.62'}">
        <span class="row-b">
          <span class="tnum ${isToday ? 'strong' : 'subtle'}" style="font-size:var(--fs-12)">${d}</span>
          ${isToday ? '<span class="badge accent" style="height:18px;font-size:10px">Today</span>' : ''}
        </span>
        ${count ? `<span class="badge accent" style="margin-top:var(--s-2)">${count} activit${count === 1 ? 'y' : 'ies'}</span>` : ''}
      </button>`);
  }

  return `<section class="card pad reveal">
    <div class="row-b" style="margin-bottom:var(--s-4)">
      <h3>${first.toLocaleString('en-US', { month: 'long' })} ${year}</h3>
      <span class="badge outline">${num(dated.length)} activities loaded</span>
    </div>
    <div class="grid" style="grid-template-columns:repeat(7,minmax(0,1fr));gap:var(--s-2)">
      ${DAY_NAMES.map((d) => `<div class="eyebrow" style="text-align:center;padding-bottom:var(--s-1)">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
  </section>`;
}

function openActivity(a) {
  drawer({
    title: a.company,
    subtitle: `${a.date} · ${a.rep}`,
    body: `
      <div class="col" style="gap:var(--s-4)">
        <div class="row wrap" style="gap:var(--s-2)">${statusBadge(a.status)}<span class="badge outline">${esc(a.type)}</span></div>
        <dl class="dl">
          <dt>Title</dt><dd class="strong">${esc(a.title)}</dd>
          <dt>Rep</dt><dd>${esc(a.rep)}</dd>
          <dt>Result</dt><dd>${esc(a.result || 'Not yet recorded')}</dd>
        </dl>
        <div>
          <div class="eyebrow" style="margin-bottom:var(--s-2)">Notes</div>
          <div class="card pad-sm" style="background:var(--bg-sunken);font-size:var(--fs-13);line-height:var(--lh-loose);white-space:pre-wrap">${esc(a.notes || 'No notes.')}</div>
        </div>
      </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
             <a class="btn btn-primary grow" href="#/activities?q=${encodeURIComponent(a.company)}">Open in activities</a>`,
  });
}

/**
 * A calendar square opens the day, not a dead end. Days with activity list
 * them and link straight into the activity view; empty days say so and offer
 * the two things you would want next.
 */
function openCalendarDay(day, dated) {
  const year = TODAY.getFullYear();
  const month = TODAY.getMonth();
  const when = new Date(year, month, day);
  const label = when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const items = dated.filter((a) => a._d.getFullYear() === year && a._d.getMonth() === month && a._d.getDate() === day);
  const isToday = day === TODAY.getDate();

  const body = items.length
    ? `<div class="list">${items.map((a) => {
        const meta = TYPE_META[a.type] || TYPE_META.other;
        return `<button class="list-row" data-day-act="${esc(a.title)}">
          <span class="stat-icon" style="--tone:${meta.tone};width:30px;height:30px">${icon(meta.icon, { size: 15 })}</span>
          <span class="grow" style="min-width:0;text-align:left">
            <span class="list-title truncate" style="display:block">${esc(a.company)}</span>
            <span class="list-sub truncate" style="display:block">${esc(a.rep)} · ${esc(a.title)}</span>
          </span>
          ${statusBadge(a.status)}
          ${icon('chevronRight', { size: 16, cls: 'ico subtle' })}
        </button>`;
      }).join('')}</div>`
    : emptyState({
        title: 'Nothing on this day',
        text: isToday
          ? 'Today is clear. Start a route or pull up the lead list to fill it.'
          : 'No activity in this export fell on this date.',
        iconName: 'calendar',
        action: '<a class="btn btn-secondary sm" href="#/routes">Build a route</a>',
      });

  const sheet = drawer({
    title: label,
    subtitle: `${num(items.length)} activit${items.length === 1 ? 'y' : 'ies'}`,
    body,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
             <a class="btn btn-primary grow" href="#/activities">Open all activities</a>`,
  });

  $$('[data-day-act]', sheet.node).forEach((b) => b.addEventListener('click', () => {
    const a = items.find((x) => x.title === b.dataset.dayAct);
    sheet.close();
    if (a) setTimeout(() => openActivity(a), 220);
  }));
}
