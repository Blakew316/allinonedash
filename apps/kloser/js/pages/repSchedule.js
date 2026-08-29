/** Rep Schedule — weekly availability and booking load across all 925 reps. */
import { el, esc, $, $$, debounce, onToolbarChange } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data, TODAY } from '../core/store.js';
import { num, sortBy, parseDate } from '../core/format.js';
import { pageHeader, statCard, runCounters, searchField, emptyState, avatar, segmented, mountSegmented, tabs, mountTabs, statusBadge } from '../components/ui.js';
import { monthCalendar, sameDay } from '../components/calendar.js';
import { toast, drawer } from '../components/overlays.js';
import { setQuery } from '../core/router.js';
import { personCell } from '../components/ui.js';
import { connectGoogle, explainGoogleError } from '../components/googleAuth.js';
import {
  calendarSyncState, listCalendars, setCalendarId, autoSync, setAutoSync,
  syncMonth, cachedMonth, normalizeEvent, repIndexFrom, mergeEvents,
  pushEvent, removePushedEvent, pushedRecord, agoLabel,
} from '../components/googleCalendar.js';
import { subscribe } from '../core/store.js';

// The original renders every rep at once, and so does this.
const PAGE = 200;

export default {
  title: 'Rep Schedule',

  async view({ query }) {
    const [sched, acts, lv] = await Promise.all([
      data('rep_schedule'), data('activities'), data('location_verification'),
    ]);
    const node = el('<div class="page"></div>');
    const rows = sched.rows;
    const header = sched.header;

    const available = rows.filter((r) => r.status === 'Available').length;
    const limited = rows.filter((r) => r.status === 'Limited').length;
    const unavailable = rows.filter((r) => r.status === 'Unavailable').length;
    const booked = rows.filter((r) => r.days.some((d) => d > 0)).length;
    const busy = rows.filter((r) => r.days.some((d) => d >= 2)).length;

    node.appendChild(el(pageHeader({
      title: 'Rep Schedule',
      lede: 'Availability and how booked each rep is per day, in Central time. “Busy” means two or more appointments that day — it is a heads-up, not a block. You can still request any rep. Tap a name to open that rep’s sheet.',
      meta: `<span class="badge accent">${num(rows.length)} reps</span>
             <span class="badge good">${num(available)} available</span>
             ${limited ? `<span class="badge warn">${num(limited)} limited</span>` : ''}
             ${unavailable ? `<span class="badge outline">${num(unavailable)} unavailable</span>` : ''}
             <span class="badge outline">${esc(header[1])} – ${esc(header[header.length - 1])}</span>`,
      actions: `
        <div class="row" style="gap:4px">
          <button class="btn btn-secondary sm icon-only" id="wk-prev" aria-label="Previous week">${icon('chevronLeft', { size: 15 })}</button>
          <button class="btn btn-secondary sm" id="wk-now" title="Jump to this week" aria-label="Jump to this week">Aug 22 – Aug 28</button>
          <button class="btn btn-secondary sm icon-only" id="wk-next" aria-label="Next week">${icon('chevronRight', { size: 15 })}</button>
        </div>
        <button class="btn btn-ghost sm" id="rs-refresh">${icon('refresh', { size: 14 })}Refresh</button>`,
    })));

    node.appendChild(el(`<section class="grid g-4">
      ${statCard({ label: 'Reps on the board', value: rows.length, icon: 'users', tone: 'var(--wp-blue)', foot: 'all territories' })}
      ${statCard({ label: 'Available this week', value: available, icon: 'checkCircle', tone: 'var(--wp-green)', foot: `${num(limited)} limited · ${num(unavailable)} unavailable` })}
      ${statCard({ label: 'With bookings', value: booked, icon: 'calendar', tone: 'var(--wp-cyan)', foot: 'at least one appointment' })}
      ${statCard({ label: 'Busy days', value: busy, icon: 'alert', tone: 'var(--warn)', foot: '2+ appointments in a day' })}
    </section>`));

    node.appendChild(el(tabs({
      name: 'rsView', value: query.view || 'calendar',
      items: [
        { value: 'calendar', label: 'Calendar' },
        { value: 'board', label: 'Availability board', count: rows.length },
      ],
    })));

    node.appendChild(el(`
      <section id="rs-calendar" class="col" style="gap:var(--s-4)"></section>`));

    node.appendChild(el(`
      <div class="toolbar" id="rs-toolbar">
        ${searchField({ placeholder: 'Find a rep…', value: query.q || '' })}
        <span class="sep"></span>
        <select class="select sm" id="rs-status" aria-label="Availability" style="width:auto">
          <option value="">All reps</option>
          <option value="Available">Available only</option>
          <option value="Limited">Limited only</option>
          <option value="Unavailable">Unavailable only</option>
        </select>
        <select class="select sm" id="rs-load" aria-label="Load" style="width:auto">
          <option value="">Any load</option>
          <option value="open">Fully open this week</option>
          <option value="booked">Has bookings</option>
          <option value="busy">Busy (2+ in a day)</option>
        </select>
        ${segmented({ name: 'rsSort', value: 'name', options: [{ value: 'name', label: 'A–Z' }, { value: 'load', label: 'Most booked' }] })}
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="rs-count"></span>
      </div>`));

    node.appendChild(el(`
      <div class="matrix-wrap reveal">
        <table class="matrix">
          <thead><tr>
            <th>Rep</th>
            ${header.slice(1).map((h) => {
              const [dow, ...rest] = h.split(' ');
              return `<th><div style="font-weight:640">${esc(dow)}</div><div class="subtle" style="font-weight:500">${esc(rest.join(' '))}</div></th>`;
            }).join('')}
            <th>Week</th>
          </tr></thead>
          <tbody id="rs-body"></tbody>
        </table>
      </div>`));

    node.appendChild(el(`
      <div class="row-b" id="rs-more" style="gap:var(--s-3)">
        <span class="muted" style="font-size:var(--fs-12)" id="rs-shown"></span>
        <button class="btn btn-secondary sm" id="rs-load-more" hidden>Show more reps</button>
      </div>`));

    node._sched = sched;
    node._events = buildEvents(acts, lv);
    return node;
  },

  mount(root, { query }) {
    runCounters(root);
    const page = root.firstElementChild;
    const sched = page._sched;
    const events = page._events;

    /* ------------------------------------------------------------ calendar */
    const calHost = $('#rs-calendar', root);
    calHost.innerHTML = `
      <div class="cal-toolbar toolbar" id="rs-cal-toolbar">
        ${searchField({ placeholder: 'Filter the calendar by rep…' })}
        <span class="sep"></span>
        <select class="select sm" id="rs-cal-type" aria-label="Type" style="width:auto">
          <option value="">All types</option>
          ${[...new Set(events.map((e) => e.type))].sort().map((t) => `<option>${esc(t)}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="rs-cal-count"></span>
      </div>
      <div class="gcal-strip" id="rs-gcal"></div>
      <div class="cal-split">
        <div id="rs-cal-mount"></div>
        <aside class="cal-day-panel" id="rs-day-panel"></aside>
      </div>`;

    const calMount = $('#rs-cal-mount', calHost);
    const dayPanel = $('#rs-day-panel', calHost);

    /* Google's events sit alongside the CRM's in one stream. */
    // The availability board abbreviates ("Aaron M."), the activity log does not.
    // Both spellings are worth matching against what Google puts on an invitation.
    const repIndex = repIndexFrom([
      ...sched.rows.map((r) => r.rep),
      ...events.map((e) => e.rep),
    ]);
    let gEvents = [];
    const allEvents = () => (gEvents.length ? mergeEvents(events, gEvents) : events);

    function calFiltered() {
      const q = ($('[data-search]', calHost)?.value || '').trim().toLowerCase();
      const type = $('#rs-cal-type', calHost)?.value || '';
      return allEvents().filter((e) => {
        if (type && e.type !== type) return false;
        if (!q) return true;
        return `${e.rep} ${e.company}`.toLowerCase().includes(q);
      });
    }

    const cal = monthCalendar(calMount, {
      month: TODAY,
      today: TODAY,
      selected: TODAY,
      events: calFiltered(),
      onSelect: (d) => paintDay(d),
      onMonth: () => { paintDay(cal.selected); if (typeof loadMonth === 'function') loadMonth(); },
    });

    function paintDay(d) {
      const list = d ? calFiltered().filter((e) => sameDay(e.date, d)) : [];
      const label = d
        ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : 'No day selected';

      if (!d) {
        dayPanel.innerHTML = `<div class="cal-day-head"><h3>Pick a day</h3></div>
          <div class="cal-day-empty">${emptyState({
            title: 'Nothing selected', text: 'Choose a day in the calendar to see who is out and what is booked.',
            iconName: 'calendar',
          })}</div>`;
        return;
      }

      // Availability only covers the week the export carried.
      const weekDay = weekIndexFor(d, sched.header);
      const avail = weekDay === -1 ? null : availabilityFor(sched.rows, weekDay);

      dayPanel.innerHTML = `
        <div class="cal-day-head">
          <div>
            <h3>${esc(label)}</h3>
            <div class="sub">${num(list.length)} scheduled${sameDay(d, TODAY) ? ' · today' : ''}</div>
          </div>
        </div>
        ${avail ? `<div class="cal-avail">
          <span class="badge good">${num(avail.available)} available</span>
          ${avail.limited ? `<span class="badge warn">${num(avail.limited)} limited</span>` : ''}
          ${avail.unavailable ? `<span class="badge outline">${num(avail.unavailable)} unavailable</span>` : ''}
        </div>` : `<div class="cal-avail subtle" style="font-size:var(--fs-11)">
          Availability in this export covers ${esc(sched.header[1])} – ${esc(sched.header[sched.header.length - 1])} only.
        </div>`}
        <div class="cal-day-list">
          ${list.length
            ? list.map((e, i) => `
              <button class="list-row" data-ev="${i}">
                <span class="stat-icon" style="--tone:${e.tone};width:30px;height:30px">${icon(e.icon, { size: 15 })}</span>
                <span class="grow" style="min-width:0;text-align:left">
                  <span class="list-title truncate" style="display:block">${esc(e.company)}</span>
                  <span class="list-sub truncate" style="display:block">${esc(e.time || '')}${e.time ? ' · ' : ''}${esc(e.rep)}</span>
                </span>
                ${e.source === 'google' ? '<span class="badge outline sm">Google</span>' : ''}
                ${e.status ? statusBadge(e.status) : ''}
              </button>`).join('')
            : emptyState({
                title: 'Nothing booked',
                text: 'No appointment, visit or logged activity falls on this day.',
                iconName: 'calendar',
              })}
        </div>`;

      $$('[data-ev]', dayPanel).forEach((b) => b.addEventListener('click', () => {
        const e = list[Number(b.dataset.ev)];
        if (e) showEvent(e, { onPush: pushToGoogle, onUnpush: unpushFromGoogle });
      }));
    }

    /* The type filter gains "Google Calendar" the moment Google supplies one. */
    function syncTypeOptions() {
      const sel = $('#rs-cal-type', calHost);
      if (!sel) return;
      const want = [...new Set(allEvents().map((e) => e.type))].sort();
      const have = [...sel.options].slice(1).map((o) => o.value);
      if (want.join('|') === have.join('|')) return;
      const keep = sel.value;
      sel.innerHTML = `<option value="">All types</option>${
        want.map((t) => `<option>${esc(t)}</option>`).join('')}`;
      sel.value = want.includes(keep) ? keep : '';
    }

    const repaintCal = () => {
      syncTypeOptions();
      const total = allEvents().length;
      const list = calFiltered();
      cal.setEvents(list);
      const c = $('#rs-cal-count', calHost);
      if (c) {
        c.textContent = `${num(list.length)} of ${num(total)} events`
          + (gEvents.length ? ` · ${num(gEvents.length)} from Google` : '');
      }
      paintDay(cal.selected);
    };
    $('#rs-cal-toolbar', calHost).addEventListener('input', debounce(repaintCal, 160));
    onToolbarChange($('#rs-cal-toolbar', calHost), repaintCal);
    repaintCal();

    /* ------------------------------------------------- Google Calendar sync */
    const gcalHost = $('#rs-gcal', calHost);
    let syncing = false;
    let gError = '';
    let calendars = null;
    let alive = true;

    const applyItems = (items) => {
      const s = calendarSyncState();
      gEvents = (items || [])
        .map((g) => normalizeEvent(g, { repIndex, accountName: s.name || s.email }))
        .filter(Boolean);
      repaintCal();
    };

    /** Draw whatever was last pulled for this month, without touching the network. */
    function showCachedMonth() {
      const hit = cachedMonth(cal.month);
      if (hit) applyItems(hit);
      else if (gEvents.length) { gEvents = []; repaintCal(); }
    }

    async function syncGoogle({ force = false, quiet = true } = {}) {
      const s = calendarSyncState();
      if (!s.canSync || syncing) return;
      syncing = true;
      gError = '';
      paintGcal();
      try {
        const { items } = await syncMonth(cal.month, { force });
        if (!alive) return;
        applyItems(items);
        if (!quiet) {
          toast('Google Calendar synced', {
            text: `${num(gEvents.length)} event${gEvents.length === 1 ? '' : 's'} for ${
              cal.month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
            tone: 'good', timeout: 2600,
          });
        }
      } catch (err) {
        if (!alive) return;
        gError = explainGoogleError(err && err.message);
        if (!quiet) toast('Google Calendar', { text: gError, tone: 'warn', timeout: 6000 });
      } finally {
        syncing = false;
        if (alive) paintGcal();
      }
    }

    /** Called whenever the visible month changes: cache first, then the network. */
    function loadMonth() {
      showCachedMonth();
      if (autoSync() && calendarSyncState().canSync) syncGoogle({ quiet: true });
    }

    async function pushToGoogle(e) {
      const s = calendarSyncState();
      if (!s.canSync) {
        toast('Not connected', { text: 'Connect a Google account first, on this screen or in Settings.', tone: 'warn' });
        return false;
      }
      try {
        await pushEvent(e);
        toast('Added to Google Calendar', {
          text: `${e.company} on ${e.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
          tone: 'good', timeout: 2800,
        });
        await syncGoogle({ force: true, quiet: true });
        return true;
      } catch (err) {
        toast('Could not add it', { text: explainGoogleError(err && err.message), tone: 'bad', timeout: 6000 });
        return false;
      }
    }

    async function unpushFromGoogle(e) {
      try {
        await removePushedEvent(e);
        toast('Removed from Google Calendar', { timeout: 2400 });
        await syncGoogle({ force: true, quiet: true });
        return true;
      } catch (err) {
        toast('Could not remove it', { text: explainGoogleError(err && err.message), tone: 'bad', timeout: 6000 });
        return false;
      }
    }

    function paintGcal() {
      const s = calendarSyncState();

      if (!s.hasClientId) {
        gcalHost.innerHTML = `<span class="gcal-line subtle">
          ${icon('google', { size: 13, stroke: 0 })}
          Google Calendar sync turns on once a client ID is set —
          <a href="#/settings?section=communication">Settings → Communication</a>.</span>`;
        return;
      }

      if (!s.canSync) {
        gcalHost.innerHTML = `<span class="gcal-line">
            ${icon('google', { size: 13, stroke: 0 })}
            <span>Pull appointments straight from Google Calendar.</span>
          </span>
          <button class="btn btn-secondary sm" id="gcal-connect">
            ${icon('google', { size: 14, stroke: 0 })}Connect Google Calendar</button>
          ${gError ? `<span class="gcal-err">${esc(gError)}</span>` : ''}`;

        $('#gcal-connect', gcalHost)?.addEventListener('click', async (ev) => {
          const btn = ev.currentTarget;
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>Waiting for Google';
          try {
            await connectGoogle();
            gError = '';
            calendars = null;
            paintGcal();
            syncGoogle({ force: true, quiet: false });
          } catch (err) {
            gError = explainGoogleError(err && err.message);
            paintGcal();
          }
        });
        return;
      }

      const opts = (calendars || [{ id: s.calendarId, summary: 'Primary calendar' }]);
      gcalHost.innerHTML = `
        <span class="gcal-line">
          ${icon('google', { size: 13, stroke: 0 })}
          <span class="badge good"><span class="dot"></span>Google Calendar</span>
          <span class="truncate subtle" style="max-width:180px">${esc(s.email || s.name || '')}</span>
        </span>
        <select class="select sm" id="gcal-pick" aria-label="Which Google calendar" style="width:auto;max-width:200px">
          ${opts.map((c) => `<option value="${esc(c.id)}"${c.id === s.calendarId ? ' selected' : ''}>${esc(c.summary)}</option>`).join('')}
        </select>
        <label class="row gcal-auto" style="gap:6px;font-size:var(--fs-12);color:var(--text-muted)">
          <input type="checkbox" id="gcal-auto"${s.auto ? ' checked' : ''}> Sync on open
        </label>
        <button class="btn btn-secondary sm" id="gcal-sync"${syncing ? ' disabled' : ''}>
          ${syncing ? '<span class="spinner" style="width:14px;height:14px"></span>Syncing'
            : `${icon('refresh', { size: 14 })}Sync now`}</button>
        <span class="spacer"></span>
        <span class="subtle" style="font-size:var(--fs-11)">
          ${gError ? `<span class="gcal-err">${esc(gError)}</span>`
            : `Updated ${esc(agoLabel(s.lastSyncAt))}`}</span>`;

      $('#gcal-sync', gcalHost)?.addEventListener('click', () => syncGoogle({ force: true, quiet: false }));
      $('#gcal-auto', gcalHost)?.addEventListener('change', (ev) => {
        setAutoSync(ev.currentTarget.checked);
        if (ev.currentTarget.checked) syncGoogle({ quiet: true });
      });
      $('#gcal-pick', gcalHost)?.addEventListener('change', (ev) => {
        setCalendarId(ev.currentTarget.value);
        gEvents = [];
        syncGoogle({ force: true, quiet: false });
      });

      // The calendar list needs its own round trip; fetch it once, then redraw.
      if (!calendars) {
        calendars = [];
        listCalendars().then((list) => {
          if (!alive) return;
          calendars = list;
          paintGcal();
        });
      }
    }

    paintGcal();
    loadMonth();
    const offGoogle = subscribe('google', () => { if (alive) { calendars = null; paintGcal(); } });

    /* ------------------------------------------------------ view switching */
    const boardEls = () => [$('#rs-toolbar', root), $('.matrix-wrap', root), $('#rs-more', root)];
    function showView(v) {
      const isCal = v === 'calendar';
      calHost.hidden = !isCal;
      boardEls().forEach((n) => { if (n) n.hidden = isCal; });
      setQuery({ view: isCal ? '' : 'board' });
    }
    mountTabs(root, (val, name) => { if (name === 'rsView') showView(val); });
    showView(query.view || 'calendar');

    const body = $('#rs-body', root);
    const countEl = $('#rs-count', root);
    const shownEl = $('#rs-shown', root);
    const moreBtn = $('#rs-load-more', root);
    let limit = sched.rows.length;
    let sort = 'name';

    function filtered() {
      const q = ($('[data-search]', root)?.value || '').trim().toLowerCase();
      const status = $('#rs-status', root).value;
      const load = $('#rs-load', root).value;
      let list = sched.rows.filter((r) => {
        if (status && r.status !== status) return false;
        const total = r.days.reduce((a, b) => a + b, 0);
        if (load === 'open' && total !== 0) return false;
        if (load === 'booked' && total === 0) return false;
        if (load === 'busy' && !r.days.some((d) => d >= 2)) return false;
        if (!q) return true;
        return r.rep.toLowerCase().includes(q);
      });
      if (sort === 'load') list = sortBy(list, (r) => r.days.reduce((a, b) => a + b, 0), 'desc');
      return list;
    }

    function paint() {
      const list = filtered();
      const slice = list.slice(0, limit);
      countEl.textContent = `${num(list.length)} reps`;
      shownEl.textContent = `Showing ${num(slice.length)} of ${num(list.length)}`;
      moreBtn.hidden = slice.length >= list.length;

      if (!slice.length) {
        body.innerHTML = `<tr><td colspan="9" style="padding:0">${emptyState({ title: 'No reps match', text: 'Try another name or clear the filters.', iconName: 'users' })}</td></tr>`;
        return;
      }

      body.innerHTML = slice.map((r, i) => {
        const total = r.days.reduce((a, b) => a + b, 0);
        return `<tr style="animation:rise-sm 240ms var(--ease-out) ${Math.min(i, 20) * 10}ms both">
          <td>
            <button type="button" class="person-cell" data-rep-open="${esc(r.rep)}" title="Open ${esc(r.rep)}’s sheet">
              ${avatar(r.rep, 'xs')}
              <span style="min-width:0;text-align:left">
                <span class="truncate" style="font-weight:560;font-size:var(--fs-12);display:block">${esc(r.rep)}</span>
                <span class="cell-sub" style="display:block">${
                  r.status === 'Available' ? '<span style="color:var(--good-ink)">Available</span>'
                  : r.status === 'Limited' ? `<span style="color:var(--warn-ink);display:inline-flex;align-items:center;gap:3px">${icon('alert', { size: 11 })}Limited</span>`
                  : '<span class="subtle">Unavailable</span>'}</span>
              </span>
            </button>
          </td>
          ${r.days.map((d) => `<td><span class="day-cell ${loadClass(d, r.status)}"
              title="${d} appointment${d === 1 ? '' : 's'}">${d}</span></td>`).join('')}
          <td><span class="badge ${total ? 'accent' : 'outline'} tnum">${total}</span></td>
        </tr>`;
      }).join('');
    }

    paint();
    if (query.q) { const s = $('[data-search]', root); if (s) { s.value = query.q; paint(); } }

    $('#rs-toolbar', root).addEventListener('input', debounce(paint, 140));
    onToolbarChange($('#rs-toolbar', root), paint);
    mountSegmented(root, (val, name) => { if (name === 'rsSort') { sort = val; paint(); } });
    moreBtn.addEventListener('click', () => { limit += PAGE * 2; paint(); });

    const weekNote = () => toast('Week navigation', {
      text: 'The snapshot covers Aug 22 – Aug 28. Other weeks load from the live API in production.',
      tone: 'info',
    });
    $('#wk-prev', root).addEventListener('click', weekNote);
    $('#wk-next', root).addEventListener('click', weekNote);
    $('#wk-now', root).addEventListener('click', () => toast('Already on this week', { timeout: 1600 }));

    $('#rs-refresh', root).addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>Refreshing';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = `${icon('refresh', { size: 14 })}Refresh`;
        paint();
        toast('Availability refreshed', { text: 'Bookings re-read for Aug 22 – Aug 28.', tone: 'good', timeout: 2200 });
      }, 700);
    });

    return () => {
      alive = false;
      if (typeof offGoogle === 'function') offGoogle();
    };
  },
};

function loadClass(d, status) {
  if (status === 'Unavailable') return 'off';
  if (status === 'Limited' && d === 0) return 'limited';
  if (d >= 3) return 'load-3';
  if (d === 2) return 'load-2';
  if (d === 1) return 'load-1';
  return '';
}

/* ------------------------------------------------------------------ events */
/**
 * One dated stream from the two datasets that actually carry timestamps: the
 * activity log and the GPS verification records. The weekly matrix has no
 * appointment counts at all — every row is zeroes — so a calendar built from it
 * would be an empty grid.
 */
function buildEvents(acts, lv) {
  const TYPE = {
    'cc appt': { icon: 'calendar', tone: '#0090E9', label: 'Appointment' },
    visit: { icon: 'pin', tone: '#00C271', label: 'Visit' },
    call: { icon: 'phone', tone: '#00BAE6', label: 'Call' },
    email: { icon: 'mail', tone: '#4FE778', label: 'Email' },
    text: { icon: 'message', tone: '#7C5CFF', label: 'Text' },
  };
  const pick = (t) => TYPE[String(t || '').toLowerCase()] || { icon: 'activity', tone: '#AAAFB5', label: 'Other' };
  const out = [];

  (acts || []).forEach((a) => {
    const d = parseDate(a.date);
    if (!d) return;
    const meta = pick(a.type);
    out.push({
      date: d, rep: a.rep, company: a.company, title: a.title, notes: a.notes,
      status: a.status, type: meta.label, icon: meta.icon, tone: meta.tone,
      time: '', source: 'activity',
    });
  });

  ((lv && lv.records) || []).forEach((r) => {
    const d = parseDate(r.when);
    if (!d) return;
    const meta = pick(r.type);
    out.push({
      date: d, rep: r.rep, company: r.company, title: `${r.type} — ${r.company}`,
      status: r.status, type: meta.label, icon: meta.icon, tone: meta.tone,
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      place: r.place, distance: r.distance, source: 'verification',
    });
  });

  return out.sort((a, b) => a.date - b.date);
}

/** Which column of the availability week a date falls in, or -1 if outside it. */
function weekIndexFor(date, header) {
  for (let i = 1; i < header.length; i++) {
    const d = parseDate(`${header[i]}, ${date.getFullYear()}`);
    if (d && d.getMonth() === date.getMonth() && d.getDate() === date.getDate()) return i - 1;
  }
  return -1;
}

function availabilityFor(rows, dayIndex) {
  const out = { available: 0, limited: 0, unavailable: 0 };
  rows.forEach((r) => {
    if (r.status === 'Available') out.available += 1;
    else if (r.status === 'Limited') out.limited += 1;
    else out.unavailable += 1;
  });
  return out;
}

function showEvent(e, { onPush, onUnpush } = {}) {
  const fromGoogle = e.source === 'google';
  const pushed = fromGoogle ? null : pushedRecord(e);
  const canPush = !fromGoogle && calendarSyncState().canSync;

  const sourceBadge = fromGoogle ? 'Google Calendar'
    : e.source === 'verification' ? 'GPS record' : 'Activity log';

  const d = drawer({
    title: e.company,
    subtitle: `${e.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${e.time ? ` · ${e.time}` : ''}`,
    body: `<div class="col" style="gap:var(--s-4)">
      <div class="row wrap" style="gap:var(--s-2)">
        ${fromGoogle ? '' : `<span class="badge outline">${esc(e.type)}</span>`}
        ${e.status ? statusBadge(e.status) : ''}
        <span class="badge ${fromGoogle ? 'accent' : 'outline'}">${esc(sourceBadge)}</span>
        ${pushed ? '<span class="badge good">On Google Calendar</span>' : ''}
      </div>
      <dl class="dl">
        <dt>Rep</dt><dd>${personCell(e.rep)}</dd>
        <dt>Title</dt><dd class="strong">${esc(e.title || '—')}</dd>
        ${e.place ? `<dt>Place</dt><dd>${esc(e.place)}</dd>` : ''}
        ${e.distance ? `<dt>GPS distance</dt><dd>${esc(e.distance)}</dd>` : ''}
        ${e.organizer ? `<dt>Organizer</dt><dd>${esc(e.organizer)}</dd>` : ''}
        ${e.attendees && e.attendees.length
          ? `<dt>Guests</dt><dd>${esc(e.attendees.slice(0, 6).join(', '))}${
              e.attendees.length > 6 ? ` and ${e.attendees.length - 6} more` : ''}</dd>` : ''}
      </dl>
      ${e.notes ? `<div>
        <div class="eyebrow" style="margin-bottom:var(--s-2)">Notes</div>
        <div class="card pad-sm" style="background:var(--bg-sunken);font-size:var(--fs-13);line-height:var(--lh-loose);white-space:pre-wrap">${esc(e.notes)}</div>
      </div>` : ''}
    </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
      ${fromGoogle
        ? (e.link
            ? `<a class="btn btn-primary grow" href="${esc(e.link)}" target="_blank" rel="noopener">Open in Google</a>`
            : `<a class="btn btn-primary grow" href="#/activities?q=${encodeURIComponent(e.company)}">Open in activities</a>`)
        : `${pushed
            ? '<button class="btn btn-secondary grow" data-gcal-remove>Remove from Google</button>'
            : canPush ? '<button class="btn btn-secondary grow" data-gcal-add>Add to Google Calendar</button>' : ''}
           <a class="btn btn-primary grow" href="#/activities?q=${encodeURIComponent(e.company)}">Open in activities</a>`}`,
  });

  const node = d && d.node ? d.node : document;
  const busy = (btn, label) => {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="width:14px;height:14px"></span>${label}`;
  };

  const add = $('[data-gcal-add]', node);
  if (add && typeof onPush === 'function') {
    add.addEventListener('click', async () => {
      busy(add, 'Adding');
      const ok = await onPush(e);
      if (ok && d && d.close) d.close();
      else { add.disabled = false; add.textContent = 'Add to Google Calendar'; }
    });
  }

  const rm = $('[data-gcal-remove]', node);
  if (rm && typeof onUnpush === 'function') {
    rm.addEventListener('click', async () => {
      busy(rm, 'Removing');
      const ok = await onUnpush(e);
      if (ok && d && d.close) d.close();
      else { rm.disabled = false; rm.textContent = 'Remove from Google'; }
    });
  }
}
