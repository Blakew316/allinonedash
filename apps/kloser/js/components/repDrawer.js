/**
 * The rep sheet — one place that answers "who is this person?" from every
 * screen that names them.
 *
 * The exports name reps three different ways: the schedule abbreviates
 * ("ANDREW C."), the rep board spells them out in caps ("ANDREW CARRILLO"),
 * and the activity and lead exports use title case ("Harrison Gurash"). All
 * three are matched on first name plus last initial, which is the most the
 * abbreviated form gives us.
 */
import { el, esc, $ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data } from '../core/store.js';
import { num, pct } from '../core/format.js';
import { avatar, statusBadge } from './ui.js';
import { drawer } from './overlays.js';

const DOW = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

/** first-name + last-initial, lowercased — the widest key all exports share. */
export function repKey(name) {
  const parts = String(name || '').trim().toLowerCase().replace(/[.,]/g, '').split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return `${first}|${last.charAt(0)}`;
}

const titleCase = (s) => String(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Whole name, comparable across exports that differ only in case and punctuation. */
const norm = (s) => String(s || '').trim().toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');

/**
 * Match on the full name when we have one, and only fall back to the
 * abbreviated key when we do not.
 *
 * The key is first-name + last-initial because that is all the schedule's
 * "ANDREW C." gives us — but 44 keys are shared by 92 of the 925 reps, so
 * trusting it blindly shows one Amber's record under the other Amber's name.
 * Exact first, key second, and say so when the key alone cannot decide.
 */
function match(rows, get, wanted, key) {
  const exact = rows.filter((r) => norm(get(r)) === wanted);
  if (exact.length) return { rows: exact, exact: true, ambiguous: false };
  const byKey = rows.filter((r) => repKey(get(r)) === key);
  return { rows: byKey, exact: false, ambiguous: byKey.length > 1 };
}

/** The board stores these as "ON"/"OFF"; shouting them in a badge reads badly. */
const onOff = (v) => statusBadge(String(v).toUpperCase() === 'ON' ? 'On' : 'Off');

/** null, not 0 — "0.0% of visits" for a rep with no visits is a made-up figure. */
const ratio = (a, b) => (b ? (a / b) * 100 : null);
const asPct = (v, unit) => (v === null ? '<span class="subtle">no ' + unit + ' recorded</span>' : pct(v, 1) + ' of ' + unit);

export async function openRepDrawer(name) {
  const key = repKey(name);
  const sheet = drawer({
    title: /[a-z]/.test(name) ? name : titleCase(name),
    subtitle: 'Loading this rep…',
    body: '<div class="col" style="gap:var(--s-3)">'
      + '<div class="skeleton" style="height:74px"></div>'
      + '<div class="skeleton" style="height:120px"></div>'
      + '<div class="skeleton" style="height:160px"></div></div>',
  });

  let board = [];
  let sched = { header: [], rows: [] };
  let dash = {};
  let acts = [];
  let leads = [];
  let lv = { summary: [] };
  try {
    [board, sched, dash, acts, leads, lv] = await Promise.all([
      data('reps_board'), data('rep_schedule'), data('dashboard'),
      data('activities'), data('leads'), data('location_verification'),
    ]);
  } catch {
    // Offline and not yet cached — the sheet still shows what we were given.
  }
  if (!sheet.node.isConnected) return sheet;   // closed while we were loading

  const wanted = norm(name);
  const boardM = match(board, (r) => r.name, wanted, key);
  const schedM = match(sched.rows || [], (r) => r.rep, wanted, key);
  const perfM = match(dash.repPerformance || [], (r) => r.rep, wanted, key);
  const verifyM = match(lv.summary || [], (r) => r.rep, wanted, key);

  const boardRow = boardM.rows[0] || null;
  const schedRow = schedM.rows[0] || null;
  const perf = perfM.rows[0] || null;
  const verify = verifyM.rows[0] || null;

  // When the board cannot tell two same-key reps apart, neither can the lead and
  // activity exports, so those counts cover both people and must say so.
  const shared = boardM.ambiguous;
  const belongs = (v) => (boardM.exact ? norm(v) === wanted : repKey(v) === key);
  const myActs = acts.filter((a) => belongs(a.rep));
  const myLeads = leads.filter((l) => belongs(l.owner));

  /* Prefer a spelling that already carries capitals: the board shouts in caps,
     so title-casing it turns MCCAIN into Mccain, while the lead and activity
     exports store the name the way it is actually written. */
  const display = [name, myActs[0] && myActs[0].rep, myLeads[0] && myLeads[0].owner]
    .find((v) => v && /[a-z]/.test(v) && /[A-Z]/.test(v))
    || (boardRow ? titleCase(boardRow.name) : titleCase(name));
  const days = sched.header && sched.header.length > 1 ? sched.header.slice(1) : DOW;
  const load = schedRow ? schedRow.days.reduce((a, b) => a + b, 0) : 0;

  /* Each export spells the name its own way, so link with the spelling the
     destination actually filters on — otherwise the link lands on an empty
     table and looks broken. */
  const linkAs = (fallback, ...candidates) => encodeURIComponent(candidates.find(Boolean) || fallback);
  const actLink = linkAs(display, myActs[0] && myActs[0].rep);
  const leadLink = linkAs(display, myLeads[0] && myLeads[0].owner);
  const verifyLink = linkAs(display, verify && verify.rep);

  const body = el(`<div class="col" style="gap:var(--s-5)">
    <div class="row" style="gap:var(--s-3)">
      ${avatar(display)}
      <div style="min-width:0">
        <div class="strong" style="font-size:var(--fs-16)">${esc(display)}</div>
        <div class="row wrap" style="gap:var(--s-2);margin-top:4px">
          ${schedRow ? statusBadge(schedRow.status) : '<span class="badge outline">Not on this week’s board</span>'}
          ${boardRow && boardRow.city ? `<span class="badge outline">${icon('pin', { size: 11 })}${esc(titleCase(boardRow.city))}</span>` : ''}
        </div>
      </div>
    </div>

    ${schedRow ? `
    <section>
      <div class="eyebrow" style="margin-bottom:var(--s-2)">This week · ${load} appointment${load === 1 ? '' : 's'} booked</div>
      <div class="grid" style="grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">
        ${schedRow.days.map((d, i) => `
          <div class="card pad-sm" style="text-align:center;padding:8px 4px${d ? '' : ';opacity:.6'}">
            <div class="subtle" style="font-size:10px;line-height:1.2">${esc(String(days[i] || '').split(' ')[0])}</div>
            <div class="tnum ${d ? 'strong' : 'subtle'}" style="font-size:var(--fs-16);margin-top:2px">${d}</div>
          </div>`).join('')}
      </div>
    </section>` : ''}

    ${perf ? `
    <section>
      <div class="eyebrow" style="margin-bottom:var(--s-2)">Jul 23 – Aug 22, 2026</div>
      <div class="grid g-4" style="gap:var(--s-2)">
        ${[['Leads', perf.leads], ['Visits', perf.visits], ['Appts set', perf.apptsSet], ['Appts held', perf.apptsHeld]]
          .map(([l, v]) => `<div class="card pad-sm">
            <div class="tnum strong" style="font-size:var(--fs-20)">${num(v)}</div>
            <div class="subtle" style="font-size:var(--fs-11)">${l}</div>
          </div>`).join('')}
      </div>
      <dl class="dl" style="margin-top:var(--s-3)">
        <dt>Set rate</dt><dd>${asPct(ratio(perf.apptsSet, perf.visits), 'visits')}</dd>
        <dt>Held rate</dt><dd>${asPct(ratio(perf.apptsHeld, perf.apptsSet), 'appointments set')}</dd>
      </dl>
    </section>` : ''}

    <section>
      <div class="eyebrow" style="margin-bottom:var(--s-2)">In this export${shared ? ' · both reps with this name' : ''}</div>
      <dl class="dl">
        <dt>Leads owned</dt><dd class="strong tnum">${num(myLeads.length)}</dd>
        <dt>Activities</dt><dd class="strong tnum">${num(myActs.length)}</dd>
        ${verify ? `<dt>GPS verified</dt><dd class="strong tnum">${verify.rate}% <span class="subtle" style="font-weight:400">(${verify.verified} of ${verify.total}, avg ${esc(verify.avgDist)})</span></dd>` : ''}
      </dl>
    </section>

    ${shared ? `
    <div class="banner warn">
      ${icon('alert', { size: 16 })}
      <div class="grow">
        <div class="banner-title">${boardM.rows.length} reps share this name on the board</div>
        <div class="banner-text">The availability board abbreviates to “${esc(name)}”, which cannot tell them apart.
          Pick the one you meant to see their contact details and coverage.</div>
        <div class="row wrap" style="gap:6px;margin-top:var(--s-2)">
          ${boardM.rows.map((r) => `<button type="button" class="btn btn-secondary sm"
            data-rep-open="${esc(titleCase(r.name))}">${esc(titleCase(r.name))}</button>`).join('')}
        </div>
      </div>
    </div>` : boardRow ? `
    <section>
      <div class="eyebrow" style="margin-bottom:var(--s-2)">Contact and coverage</div>
      <dl class="dl">
        <dt>Email</dt><dd><a href="mailto:${esc(boardRow.email)}">${esc(boardRow.email)}</a></dd>
        <dt>ZIP codes</dt><dd>${boardRow.zips && boardRow.zips.length
          ? boardRow.zips.map((z) => `<span class="badge outline mono" style="margin:0 4px 4px 0">${esc(z)}</span>`).join('')
          : '<span class="subtle">None assigned</span>'}</dd>
        <dt>Telemarketing</dt><dd>${onOff(boardRow.telemarketing)}</dd>
        <dt>Hot leads</dt><dd>${onOff(boardRow.hotLeads)}</dd>
        <dt>Call center</dt><dd>${esc(boardRow.callCenter || '—')}</dd>
      </dl>
    </section>` : `
    <div class="banner">
      ${icon('info', { size: 16 })}
      <div class="grow">
        <div class="banner-title">No rep-board record</div>
        <div class="banner-text">The board keys on full names and this screen only had “${esc(name)}”.</div>
      </div>
    </div>`}

    <section>
      <div class="eyebrow" style="margin-bottom:var(--s-2)">Open elsewhere</div>
      <div class="col" style="gap:6px">
        <a class="list-row" href="#/activities?rep=${actLink}">
          <span class="stat-icon" style="--tone:var(--wp-blue);width:30px;height:30px">${icon('activity', { size: 15 })}</span>
          <span class="grow" style="text-align:left"><span class="list-title" style="display:block">Their activities</span>
          <span class="list-sub" style="display:block">${num(myActs.length)} in this export</span></span>
          ${icon('chevronRight', { size: 16, cls: 'ico subtle' })}</a>
        <a class="list-row" href="#/list?owner=${leadLink}">
          <span class="stat-icon" style="--tone:var(--wp-green);width:30px;height:30px">${icon('list', { size: 15 })}</span>
          <span class="grow" style="text-align:left"><span class="list-title" style="display:block">Leads they own</span>
          <span class="list-sub" style="display:block">${num(myLeads.length)} in this export</span></span>
          ${icon('chevronRight', { size: 16, cls: 'ico subtle' })}</a>
        <a class="list-row" href="#/location-verify?rep=${verifyLink}">
          <span class="stat-icon" style="--tone:var(--wp-cyan);width:30px;height:30px">${icon('shield', { size: 15 })}</span>
          <span class="grow" style="text-align:left"><span class="list-title" style="display:block">Location verification</span>
          <span class="list-sub" style="display:block">${verify ? `${verify.rate}% verified` : 'No records'}</span></span>
          ${icon('chevronRight', { size: 16, cls: 'ico subtle' })}</a>
        <a class="list-row" href="#/rep-schedule?q=${encodeURIComponent(schedRow ? schedRow.rep : display.split(' ')[0])}">
          <span class="stat-icon" style="--tone:var(--wp-mint);width:30px;height:30px">${icon('calendar', { size: 15 })}</span>
          <span class="grow" style="text-align:left"><span class="list-title" style="display:block">Availability board</span>
          <span class="list-sub" style="display:block">${schedRow ? `${schedRow.status} this week` : 'Not on this week’s board'}</span></span>
          ${icon('chevronRight', { size: 16, cls: 'ico subtle' })}</a>
      </div>
    </section>
  </div>`);

  const host = $('.drawer-body', sheet.node);
  host.replaceChildren(body);
  const sub = $('.drawer-head p', sheet.node);
  if (sub) {
    sub.textContent = boardRow && boardRow.city
      ? `${titleCase(boardRow.city)} · ${boardRow.zips.length} ZIP${boardRow.zips.length === 1 ? '' : 's'}`
      : 'Sales rep';
  }
  return sheet;
}

/**
 * One capture-phase listener for every `data-rep-open` control on the page.
 * Capture, because rows that carry their own click handler sit above these
 * buttons in the tree and would otherwise navigate out from under the sheet.
 */
export function wireRepOpeners(scope = document) {
  scope.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target.closest('[data-rep-open]') : null;
    if (!t) return;
    const name = t.getAttribute('data-rep-open');
    if (!name || name === '—') return;
    e.preventDefault();
    e.stopPropagation();
    openRepDrawer(name);
  }, true);
}
