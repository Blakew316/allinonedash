/** Location Verify — GPS verification of every field activity. */
import { el, esc, $, $$, onToolbarChange } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data } from '../core/store.js';
import { num, distanceFeet, sortBy } from '../core/format.js';
import { pageHeader, statCard, runCounters, searchField, emptyState, avatar, tabs, mountTabs } from '../components/ui.js';
import { donutChart, bindChartTips } from '../components/charts.js';
import { drawer, toast } from '../components/overlays.js';

const NEAR_FT = 500;

/**
 * Reporting hierarchy. The verification report scopes by GM team then team;
 * the memberships below are the ones the snapshot's own data supports.
 */
const GM_TEAMS = [
  { name: 'GM — West', teams: ['Team Maverick'], reps: ['Lloyd Dela Cruz', 'Gabriel Craft', 'Seth manshym', 'Jaden Dufek'] },
  { name: 'GM — Mountain', teams: ['Team Summit'], reps: ['Timothy Karl Oscar Constenius', 'Judah Steelman'] },
  { name: 'GM — East', teams: ['Team Atlantic'], reps: ['Musco Adams', 'Kyle Pettit', 'Jabe Schoenrock', 'walter smith'] },
];
const repTeam = (rep) => {
  const g = GM_TEAMS.find((x) => x.reps.includes(rep));
  return g ? { gm: g.name, team: g.teams[0] } : { gm: '', team: '' };
};

export default {
  title: 'Location Verify',

  async view({ query }) {
    const lv = await data('location_verification');
    const node = el('<div class="page"></div>');

    const verified = lv.records.filter((r) => r.status === 'Verified').length;
    /* Every rep this screen can name, not just the ones on page one of the
       records table: the summary lists 10 and 5 are flagged, but only 4 appear
       in the 25 records the original exported. Building the filter from the
       records alone left most rows pointing at an option that did not exist. */
    const reps = [...new Set([
      ...lv.records.map((r) => r.rep),
      ...(lv.summary || []).map((r) => r.rep),
      ...(lv.flagged || []).map((r) => r.rep),
    ])].sort();
    const types = [...new Set(lv.records.map((r) => r.type))].sort();

    node.appendChild(el(pageHeader({
      title: 'Location Verify',
      lede: 'Rep field-activity verification. A visit counts as verified when the phone’s GPS put the rep at the business when they logged it.',
      meta: `<span class="badge accent">${num(66)} activities checked</span>
             <span class="badge outline" title="The original export paginates the record list; this is page one.">${num(lv.records.length)} of ${num(66)} records in this export</span>
             <span class="badge bad">${num(lv.flagged.length)} reps flagged</span>
             <span class="badge outline">70% target</span>`,
      actions: `<button class="btn btn-secondary sm" id="lv-export">${icon('download', { size: 14 })}Export report</button>`,
    })));

    node.appendChild(el(`<section class="grid g-4">
      ${statCard({ label: 'Total activities', value: 66, icon: 'activity', tone: 'var(--wp-blue)', foot: 'in the reporting window' })}
      ${statCard({ label: 'Verification rate', value: '36%', icon: 'shield', tone: 'var(--warn)', foot: '34 points under target' })}
      ${statCard({ label: 'Active reps', value: 10, icon: 'users', tone: 'var(--wp-cyan)', foot: 'logged at least one activity' })}
      ${statCard({ label: 'Flagged reps', value: 5, icon: 'alert', tone: 'var(--bad)', foot: 'below the 70% threshold' })}
    </section>`));

    /* ------------------------------------------------------------ filters */
    node.appendChild(el(`
      <div class="toolbar" id="lv-toolbar">
        <select class="select sm" id="lv-gm" aria-label="GM team" style="width:auto">
          <option value="">All GM teams</option>
          ${GM_TEAMS.map((g) => `<option>${esc(g.name)}</option>`).join('')}
        </select>
        <select class="select sm" id="lv-team" aria-label="Team" style="width:auto">
          <option value="">All teams</option>
          ${[...new Set(GM_TEAMS.flatMap((g) => g.teams))].map((t) => `<option>${esc(t)}</option>`).join('')}
        </select>
        <select class="select sm" id="lv-rep" aria-label="Rep" style="width:auto">
          <option value="">All reps</option>
          ${reps.map((r) => `<option${r === query.rep ? ' selected' : ''}>${esc(r)}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        <span class="badge outline">${icon('info', { size: 12 })}Verified = within ${NEAR_FT} ft</span>
      </div>`));

    /* ------------------------------------------------ flagged + breakdown */
    node.appendChild(el(`
      <section class="dash-grid">
        <div class="card flush reveal">
          <div class="card-head">
            <div><h3>Reps below the 70% verification rate</h3><div class="sub">Worth a conversation before it becomes a pattern</div></div>
            <span class="badge bad">${lv.flagged.length} flagged</span>
          </div>
          <div class="list">
            ${lv.flagged.map((f, i) => `
              <button class="list-row" data-rep="${esc(f.rep)}" style="text-align:left">
                ${avatar(f.rep, 'sm')}
                <span class="grow" style="min-width:0">
                  <span class="list-title truncate" style="display:block">${esc(f.rep)}</span>
                  <span class="list-sub">${esc(f.detail)}</span>
                </span>
                <span style="width:110px">
                  <div class="progress thin" style="--tone:${f.rate >= 50 ? 'var(--warn)' : 'var(--bad)'}">
                    <i style="width:${Math.max(3, f.rate)}%;animation-delay:${i * 60}ms"></i>
                  </div>
                </span>
                <span class="badge ${f.rate >= 50 ? 'warn' : 'bad'} tnum" style="min-width:48px;justify-content:center">${f.rate}%</span>
              </button>`).join('')}
          </div>
        </div>

        <div class="card reveal">
          <div class="card-head"><div><h3>Overall</h3><div class="sub">Verified vs unverified across the window</div></div></div>
          <div class="card-body col" style="gap:var(--s-4);align-items:center">
            ${donutChart({
              slices: [
                { label: 'Verified', value: 24, color: '#00C271' },
                { label: 'Unverified', value: 42, color: '#D3DBE8' },
              ],
              size: 168, thickness: 22, centerValue: '36%', centerLabel: 'verified',
            })}
            <div class="row" style="gap:var(--s-5)">
              <div class="legend-item"><span class="key" style="background:#00C271"></span>Verified <b class="tnum">24</b></div>
              <div class="legend-item"><span class="key" style="background:#D3DBE8"></span>Unverified <b class="tnum">42</b></div>
            </div>
          </div>
        </div>
      </section>`));

    /* -------------------------------------------------------- rep summary */
    const summary = sortBy(lv.summary, 'rate', 'desc');
    node.appendChild(el(`
      <section class="card flush reveal">
        <div class="card-head">
          <div><h3>Rep summary</h3><div class="sub">${num(summary.length)} reps with verification records</div></div>
        </div>
        <div class="table-wrap scroll-x">
          <table class="data compact">
            <thead><tr>
              <th>Rep</th><th class="num">Total</th><th class="num">Verified</th>
              <th class="num">Unverified</th><th style="width:150px">Rate</th><th>Avg distance</th>
            </tr></thead>
            <tbody>
              ${summary.map((s, i) => `
                <tr class="clickable" data-rep="${esc(s.rep)}" style="animation:rise-sm 240ms var(--ease-out) ${i * 18}ms both">
                  <td><div class="row" style="gap:var(--s-2)">${avatar(s.rep, 'xs')}<span class="truncate">${esc(s.rep)}</span></div></td>
                  <td class="num">${num(s.total)}</td>
                  <td class="num" style="color:var(--good-ink);font-weight:600">${num(s.verified)}</td>
                  <td class="num" style="color:${s.unverified ? 'var(--bad-ink)' : 'inherit'}">${num(s.unverified)}</td>
                  <td>
                    <div class="meter-row">
                      <div class="progress thin" style="--tone:${toneFor(s.rate)}">
                        <i style="width:${Math.max(2, s.rate)}%;animation-delay:${i * 40}ms"></i>
                      </div>
                      <span class="meter-val">${s.rate}%</span>
                    </div>
                  </td>
                  <td><span class="dist-badge ${distClass(s.avgDist)}">${esc(s.avgDist)}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>`));

    /* ----------------------------------------------------------- records */
    node.appendChild(el(tabs({
      name: 'lv', value: 'all',
      items: [
        { value: 'all', label: 'All records', count: lv.records.length },
        { value: 'Verified', label: 'Verified', count: verified },
        { value: 'Unverified', label: 'Unverified', count: lv.records.length - verified },
      ],
    })));

    node.appendChild(el(`
      <div class="toolbar" id="lv-rec-toolbar">
        ${searchField({ placeholder: 'Search business, rep or city…' })}
        <span class="sep"></span>
        <select class="select sm" id="lv-type" aria-label="Type" style="width:auto">
          <option value="">All types</option>
          ${types.map((t) => `<option>${esc(t)}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="lv-count"></span>
      </div>`));

    node.appendChild(el(`
      <section class="card flush reveal">
        <div class="list" id="lv-records"></div>
        <div class="pager" id="lv-pager"></div>
      </section>`));

    node._lv = lv;
    return node;
  },

  mount(root, { query }) {
    runCounters(root);
    bindChartTips(root);
    const lv = root.firstElementChild._lv;
    const host = $('#lv-records', root);
    const countEl = $('#lv-count', root);
    let statusTab = 'all';
    let page = 1;

    function paint() {
      const q = ($('[data-search]', root)?.value || '').trim().toLowerCase();
      const type = $('#lv-type', root).value;
      const rep = $('#lv-rep', root).value;
      const gm = $('#lv-gm', root).value;
      const team = $('#lv-team', root).value;
      const list = lv.records.filter((r) => {
        if (statusTab !== 'all' && r.status !== statusTab) return false;
        if (type && r.type !== type) return false;
        if (rep && r.rep !== rep) return false;
        const t = repTeam(r.rep);
        if (gm && t.gm !== gm) return false;
        if (team && t.team !== team) return false;
        if (!q) return true;
        return [r.company, r.rep, r.place].some((v) => String(v || '').toLowerCase().includes(q));
      });
      countEl.textContent = `${num(list.length)} shown`;

      const per = 10;
      const pages = Math.max(1, Math.ceil(list.length / per));
      if (page > pages) page = pages;
      const slice = list.slice((page - 1) * per, page * per);

      host.innerHTML = slice.length ? slice.map((r, i) => `
        <button class="verify-row" data-rec="${i}" style="width:100%;text-align:left;animation:rise-sm 240ms var(--ease-out) ${Math.min(i, 16) * 16}ms both">
          <span class="stat-icon" style="--tone:${r.status === 'Verified' ? 'var(--wp-green)' : 'var(--bad)'};width:32px;height:32px">
            ${icon(r.status === 'Verified' ? 'checkCircle' : 'alert', { size: 15 })}
          </span>
          <span class="grow" style="min-width:0">
            <span class="list-title truncate" style="display:block">${esc(r.company)}</span>
            <span class="list-sub truncate" style="display:block">${esc(r.rep)} · ${esc(r.when)} · ${esc(r.place)}</span>
          </span>
          <span class="badge outline">${esc(r.type)}</span>
          <span class="dist-badge ${distClass(r.distance)}">${esc(r.distance)}</span>
          <span class="badge ${r.status === 'Verified' ? 'good' : 'bad'}"><span class="dot"></span>${esc(r.status)}</span>
        </button>`).join('')
        : emptyState({ title: 'No records match', text: 'Try another rep, type or search term.', iconName: 'shield' });

      $$('[data-rec]', host).forEach((b) => b.addEventListener('click', () => openRecord(slice[Number(b.dataset.rec)])));

      const pager = $('#lv-pager', root);
      const from = list.length === 0 ? 0 : (page - 1) * per + 1;
      pager.innerHTML = `
        <span>${num(from)}–${num(Math.min(list.length, page * per))} of <b class="strong">${num(list.length)}</b></span>
        <div class="pager-btns">
          <button class="page-btn" data-lvpage="prev" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">${icon('chevronLeft', { size: 15 })}</button>
          ${Array.from({ length: pages }, (_, i) => `<button class="page-btn" data-lvpage="${i + 1}" ${i + 1 === page ? 'aria-current="true"' : ''}>${i + 1}</button>`).join('')}
          <button class="page-btn" data-lvpage="next" ${page === pages ? 'disabled' : ''} aria-label="Next page">${icon('chevronRight', { size: 15 })}</button>
        </div>`;
      $$('[data-lvpage]', pager).forEach((b) => b.addEventListener('click', () => {
        const v = b.dataset.lvpage;
        if (v === 'prev') page = Math.max(1, page - 1);
        else if (v === 'next') page = Math.min(pages, page + 1);
        else page = Number(v);
        paint();
      }));
    }

    paint();
    if (query.rep) { selectRep($('#lv-rep', root), query.rep); paint(); }

    mountTabs(root, (val, name) => { if (name === 'lv') { statusTab = val; page = 1; paint(); } });
    $('#lv-rec-toolbar', root).addEventListener('input', () => { page = 1; paint(); });
    onToolbarChange($('#lv-rec-toolbar', root), () => { page = 1; paint(); });
    onToolbarChange($('#lv-toolbar', root), () => { page = 1; paint(); });

    root.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('[data-rep]') : null;
      if (!b) return;
      selectRep($('#lv-rep', root), b.dataset.rep);
      page = 1;
      paint();
      // Keep the two scope selects consistent with the rep just picked.
      const t = repTeam(b.dataset.rep);
      if (t.gm) { $('#lv-gm', root).value = t.gm; $('#lv-team', root).value = t.team; }
      $('#lv-rec-toolbar', root).scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast(`Filtered to ${b.dataset.rep}`, { timeout: 2000 });
    });

    $('#lv-export', root)?.addEventListener('click', () =>
      toast('Report queued', { text: 'The verification CSV will land in your inbox.', tone: 'good' }));
  },
};

function toneFor(rate) {
  if (rate >= 70) return 'var(--wp-green)';
  if (rate >= 40) return 'var(--warn)';
  return 'var(--bad)';
}

function distClass(d) {
  const ft = distanceFeet(d);
  if (ft === null) return '';
  return ft <= NEAR_FT ? 'near' : 'far';
}

function openRecord(r) {
  if (!r) return;
  const ft = distanceFeet(r.distance);
  drawer({
    title: r.company,
    subtitle: `${r.rep} · ${r.when}`,
    body: `
      <div class="col" style="gap:var(--s-5)">
        <div class="row wrap" style="gap:var(--s-2)">
          <span class="badge ${r.status === 'Verified' ? 'good' : 'bad'}"><span class="dot"></span>${esc(r.status)}</span>
          <span class="badge outline">${esc(r.type)}</span>
          <span class="dist-badge ${distClass(r.distance)}">${esc(r.distance)} from the business</span>
        </div>

        <div class="card pad-sm" style="background:var(--bg-sunken)">
          <div class="eyebrow" style="margin-bottom:var(--s-2)">What the GPS says</div>
          <p style="font-size:var(--fs-13);line-height:var(--lh-loose);color:var(--text-muted)">
            ${r.status === 'Verified'
              ? `The phone reported a position ${esc(r.distance)} from the recorded business address when this activity was logged — comfortably inside the ${NEAR_FT} ft threshold.`
              : `The phone reported a position ${esc(r.distance)} from the recorded business address. That is outside the ${NEAR_FT} ft threshold, so the activity is not counted as an on-site visit. Common causes: the lead’s address is wrong, the rep logged it after driving away, or location was off.`}
          </p>
        </div>

        <dl class="dl">
          <dt>Company</dt><dd class="strong">${esc(r.company)}</dd>
          <dt>Rep</dt><dd>${esc(r.rep)}</dd>
          <dt>Activity type</dt><dd>${esc(r.type)}</dd>
          <dt>Logged at</dt><dd>${esc(r.when)}</dd>
          <dt>Location</dt><dd>${esc(r.place)}</dd>
          <dt>Distance</dt><dd>${esc(r.distance)}${ft !== null ? ` (${num(Math.round(ft))} ft)` : ''}</dd>
          <dt>Result</dt><dd>${esc(r.status)}</dd>
        </dl>
      </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
             <a class="btn btn-primary grow" href="#/activities?q=${encodeURIComponent(r.company)}">Open activity</a>`,
  });
}

/**
 * Point a rep <select> at a name, adding the option when it is missing.
 *
 * Assigning a value a <select> does not carry silently resets it to the first
 * option — here "All reps" — so the filter would clear itself while the toast
 * still claimed it had been applied. An empty result is the honest answer.
 */
function selectRep(sel, name) {
  if (!sel || !name) return;
  if (![...sel.options].some((o) => o.value === name)) sel.add(new Option(name, name));
  sel.value = name;
}
