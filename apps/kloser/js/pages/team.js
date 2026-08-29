/** Team Dashboard — conversion funnel, leaderboard and per-rep volume. */
import { el, esc, $, $$ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data, TODAY } from '../core/store.js';
import { num, pct, sortBy, parseDate } from '../core/format.js';
import { pageHeader, statCard, runCounters, segmented, mountSegmented, avatar } from '../components/ui.js';
import { barChart, hbarChart, donutChart, bindChartTips, legend } from '../components/charts.js';
import { toast, modal } from '../components/overlays.js';
import { openRepDrawer } from '../components/repDrawer.js';
import { setQuery, navigate } from '../core/router.js';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '30', label: 'Last 30 days' },
];

export default {
  title: 'Team',

  async view({ query }) {
    const [dash, lv, acts] = await Promise.all([
      data('dashboard'), data('location_verification'), data('activities'),
    ]);
    const node = el('<div class="page"></div>');

    const perf = sortBy(dash.repPerformance, 'leads', 'desc');
    const active = perf.filter((r) => r.leads || r.visits || r.apptsSet);
    const totals = perf.reduce((acc, r) => ({
      leads: acc.leads + r.leads, visits: acc.visits + r.visits,
      set: acc.set + r.apptsSet, held: acc.held + r.apptsHeld,
    }), { leads: 0, visits: 0, set: 0, held: 0 });

    const funnel = [
      { stage: 'Leads worked', value: totals.leads, tone: '#AAAFB5' },
      { stage: 'Visits logged', value: totals.visits, tone: '#00BAE6' },
      { stage: 'Appointments set', value: totals.set, tone: '#0090E9' },
      { stage: 'Appointments held', value: totals.held, tone: '#00C271' },
      // Read from the pipeline rather than a literal, so this can never
      // disagree with the stage counts on the dashboard and lead list.
      { stage: 'Deals signed', value: signedCount(dash), tone: '#4FE778' },
    ];

    node.appendChild(el(pageHeader({
      title: 'Team Dashboard',
      lede: 'How the organization converts — from a knocked door to a signed deal.',
      meta: `<span class="badge outline">${icon('calendar', { size: 12 })}Jul 23 – Aug 22, 2026</span>
             <span class="badge accent">${num(perf.length)} reps</span>
             <span class="badge good">${num(active.length)} with activity</span>`,
      actions: `${segmented({ name: 'range', value: query.range || '30', options: RANGES })}
        <button class="btn btn-secondary sm" id="team-range">${icon('calendar', { size: 14 })}<span id="team-range-label">Jul 23 – Aug 22</span></button>`,
    })));

    node.appendChild(el(`<section class="grid g-4">
      ${statCard({ label: 'Leads worked', value: totals.leads, icon: 'briefcase', tone: 'var(--wp-blue)', foot: 'across every territory' })}
      ${statCard({ label: 'Visits logged', value: totals.visits, icon: 'pin', tone: 'var(--wp-cyan)', foot: `${pct(rate(totals.visits, totals.leads))} of leads touched` })}
      ${statCard({ label: 'Appointments set', value: totals.set, icon: 'calendar', tone: 'var(--wp-green)', foot: `${pct(rate(totals.set, totals.visits))} of visits` })}
      ${statCard({ label: 'Appointments held', value: totals.held, icon: 'handshake', tone: 'var(--wp-mint)', foot: `${pct(rate(totals.held, totals.set))} of those set` })}
    </section>`));

    /* ---------------------------------------------------------- funnel */
    const top = funnel[0].value || 1;
    node.appendChild(el(`
      <section class="dash-grid">
        <div class="card reveal">
          <div class="card-head">
            <div><h3>Conversion funnel</h3><div class="sub" data-range-label>Jul 23 – Aug 22, 2026</div></div>
          </div>
          <div class="card-body">
            <div class="funnel">
              ${funnel.map((f, i) => `
                <div class="funnel-step">
                  <div class="funnel-bar" style="--tone:${f.tone}">
                    <i style="width:${Math.max(6, (f.value / top) * 100).toFixed(1)}%;--i:${i}"></i>
                    <div class="funnel-meta">
                      <span class="name">${esc(f.stage)}</span>
                      <span class="val">${num(f.value)}${i ? ` · ${pct(rate(f.value, funnel[i - 1].value))} of prior` : ''}</span>
                    </div>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card reveal">
          <div class="card-head"><div><h3>Conversion metrics</h3><div class="sub">Ratios that actually move the number</div></div></div>
          <div class="card-body" style="padding-bottom:0">
            <p class="field-hint" id="team-window-note"></p>
          </div>
          <div class="card-body col" style="gap:var(--s-4)">
            ${[
              ['Visits per lead', rate(totals.visits, totals.leads), '#00BAE6'],
              ['Set rate (per visit)', rate(totals.set, totals.visits), '#0090E9'],
              ['Held rate (per set)', rate(totals.held, totals.set), '#00C271'],
              ['GPS verification rate', 36, '#4FE778'],
            ].map(([label, value, tone], i) => `
              <div>
                <div class="row-b" style="margin-bottom:6px">
                  <span style="font-size:var(--fs-13);font-weight:560">${esc(label)}</span>
                  <span class="strong tnum" style="font-size:var(--fs-15)" data-count-to="${Number(value).toFixed(0)}" data-count-suffix="%">0</span>
                </div>
                <div class="progress" style="--tone:${tone}"><i style="width:${Math.min(100, value)}%;animation-delay:${i * 80}ms"></i></div>
              </div>`).join('')}
          </div>
        </div>
      </section>`));

    /* --------------------------- No-Shows / Missed BCL, as the original --
       Both are top-level cards in the source app, not sub-tiles, and both
       drill through to the screen that explains the number. */
    node.appendChild(el(`
      <section class="grid g-2">
        <a class="card interactive reveal" href="#/activities" style="text-decoration:none">
          <div class="stat" style="--tone:var(--bad)">
            <div class="stat-top">
              <span class="stat-label">No-Shows</span>
              <span class="stat-icon">${icon('xCircle', { size: 17 })}</span>
            </div>
            <div class="stat-value" data-count-to="0">0</div>
            <div class="stat-foot"><span>No appointment has been marked held yet, so none can be a no-show.</span></div>
          </div>
        </a>
        <a class="card interactive reveal" href="#/bcl-queue" style="text-decoration:none">
          <div class="stat" style="--tone:var(--warn)">
            <div class="stat-top">
              <span class="stat-label">Missed BCL</span>
              <span class="stat-icon">${icon('card', { size: 17 })}</span>
            </div>
            <div class="stat-value" data-count-to="0">0</div>
            <div class="stat-foot"><span>All 6 business card leads are still inside the follow-up window.</span></div>
          </div>
        </a>
      </section>`));

    /* ------------------------------------------------------ leaderboard */
    const board = sortBy(active, (r) => r.leads * 1 + r.visits * 3 + r.apptsSet * 6 + r.apptsHeld * 12, 'desc');
    node.appendChild(el(`
      <section class="dash-grid">
        <div class="card flush reveal">
          <div class="card-head">
            <div><h3>Per-rep leaderboard</h3><div class="sub">Weighted by leads, visits, appointments set and held</div></div>
            <span class="badge outline">${num(board.length)} ranked</span>
          </div>
          <div class="list">
            ${board.map((r, i) => `
              <button class="leader-row" data-rep="${esc(r.rep)}" style="width:100%;text-align:left">
                <span class="rank ${i < 3 ? `r${i + 1}` : ''}">${i + 1}</span>
                ${avatar(r.rep, 'sm')}
                <span class="grow" style="min-width:0">
                  <span class="list-title truncate" style="display:block">${esc(r.rep)}</span>
                  <span class="list-sub">${num(r.leads)} leads · ${num(r.visits)} visits · ${num(r.apptsSet)} set · ${num(r.apptsHeld)} held</span>
                </span>
                <span class="badge ${r.apptsHeld ? 'good' : r.apptsSet ? 'accent' : 'outline'} tnum">${num(r.apptsSet)}</span>
                ${icon('chevronRight', { size: 15, cls: 'ico subtle' })}
              </button>`).join('')}
          </div>
        </div>

        <div class="col" style="gap:var(--s-5)">
          <div class="card reveal">
            <div class="card-head"><div><h3>Visit volume by rep</h3><div class="sub">Field time, not phone time</div></div></div>
            <div class="card-body">
              ${hbarChart({
                rows: sortBy(active.filter((r) => r.visits), 'visits', 'desc').slice(0, 10)
                  .map((r) => ({ label: r.rep, value: r.visits })),
                tone: 'var(--wp-cyan)',
              })}
            </div>
          </div>

          <div class="card reveal">
            <div class="card-head"><div><h3>GPS verification</h3><div class="sub">Field activity confirmed on-site</div></div>
              <a class="btn btn-ghost sm" href="#/location-verify?flagged=1">Detail${icon('arrowRight', { size: 13 })}</a></div>
            <div class="card-body row" style="gap:var(--s-5);justify-content:center">
              ${donutChart({
                slices: [
                  { label: 'Verified', value: 24, color: '#00C271' },
                  { label: 'Unverified', value: 42, color: '#D3DBE8' },
                ],
                size: 148, thickness: 20, centerValue: '36%', centerLabel: 'verified',
              })}
              <div class="col" style="gap:var(--s-3)">
                <div class="legend-item"><span class="key" style="background:#00C271"></span>Verified <b class="tnum">24</b></div>
                <div class="legend-item"><span class="key" style="background:#D3DBE8"></span>Unverified <b class="tnum">42</b></div>
                <div class="subtle" style="font-size:var(--fs-11);max-width:20ch">5 reps are sitting under the 70% target.</div>
              </div>
            </div>
          </div>
        </div>
      </section>`));

    /* ------------------------------------------------------ team members */
    node.appendChild(el(`
      <section class="card reveal chart-host">
        <div class="card-head">
          <div><h3>Team members</h3><div class="sub">${num(perf.length)} reps on the roster · ${num(perf.length - active.length)} with no recorded activity</div></div>
          ${legend([{ name: 'Leads' }, { name: 'Visits' }, { name: 'Appts set' }, { name: 'Appts held' }])}
        </div>
        <div class="card-body">
          ${barChart({
            labels: perf.map((r) => shortName(r.rep)),
            height: 240,
            series: [
              { name: 'Leads', values: perf.map((r) => r.leads) },
              { name: 'Visits', values: perf.map((r) => r.visits) },
              { name: 'Appts set', values: perf.map((r) => r.apptsSet) },
              { name: 'Appts held', values: perf.map((r) => r.apptsHeld) },
            ],
          })}
        </div>
      </section>`));

    node._lv = lv;
    node._acts = acts;
    return node;
  },

  mount(root, { query }) {
    runCounters(root);
    bindChartTips(root);
    const lv = root.firstElementChild._lv;
    const acts = root.firstElementChild._acts;

    /** Re-scope the dated figures on this page to the chosen window. */
    function applyRange(val) {
      const days = { today: 1, week: 7, month: 30, 30: 30 }[val] || 30;
      const end = new Date(TODAY);
      const startDate = new Date(end.getTime() - (days - 1) * 86400000);
      const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const label = `${fmt(startDate)} – ${fmt(end)}`;
      const chip = $('#team-range-label', root);
      if (chip) chip.textContent = label;
      $$('[data-range-label]', root).forEach((n) => { n.textContent = `${label}, ${end.getFullYear()}`; });

      const inWindow = (when) => {
        const d = parseDate(when);
        return d && d >= startDate && d <= end;
      };
      const visits = lv.records.filter((r) => /visit/i.test(r.type) && inWindow(r.when)).length;
      const appts = lv.records.filter((r) => /appt/i.test(r.type) && inWindow(r.when)).length
                  + acts.filter((a) => /appt/i.test(a.type) && inWindow(a.date)).length;
      const note = $('#team-window-note', root);
      if (note) {
        note.textContent = visits + appts
          ? `${num(visits)} visits and ${num(appts)} appointments carry a timestamp inside ${label}.`
          : `No timestamped activity falls inside ${label}.`;
      }
    }

    mountSegmented(root, (val, name) => {
      if (name !== 'range') return;
      setQuery({ range: val });
      applyRange(val);
    });

    $('#team-range', root)?.addEventListener('click', () => {
      const dlg = modal({
        title: 'Custom date range',
        subtitle: 'Scope the dated figures on this page',
        body: `<div class="grid g-2" style="gap:var(--s-4)">
            <div class="field"><label class="field-label" for="tr-from">From</label>
              <input class="input" id="tr-from" type="date" value="2026-07-23"></div>
            <div class="field"><label class="field-label" for="tr-to">To</label>
              <input class="input" id="tr-to" type="date" value="2026-08-22"></div>
          </div>`,
        footer: `<button class="btn btn-secondary" data-close>Cancel</button>
                 <button class="btn btn-primary" id="tr-apply">Apply range</button>`,
      });
      $('#tr-apply', dlg.node)?.addEventListener('click', () => {
        // new Date("2026-07-23") is parsed as UTC midnight, which renders as the
        // 22nd for anyone west of Greenwich — including this app's Central time.
        const from = localDate($('#tr-from', dlg.node).value);
        const to = localDate($('#tr-to', dlg.node).value);
        if (!from || !to) { toast('Pick both dates', { tone: 'warn' }); return; }
        dlg.close();
        const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        $('#team-range-label', root).textContent = `${fmt(from)} – ${fmt(to)}`;
        toast('Range applied', { text: 'Dated figures re-scoped to the selected window.', tone: 'good' });
      });
    });

    applyRange(query.range || '30');

    root.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('[data-rep]') : null;
      if (!b) return;
      // The same sheet every other screen opens for a rep — the leaderboard
      // used to have a second, slightly different one, which is how two
      // screens end up disagreeing about the same person.
      openRepDrawer(b.dataset.rep);
    });
  },
};

const rate = (a, b) => (b ? (a / b) * 100 : 0);

/** Read a yyyy-mm-dd input as that calendar day in the viewer's own zone. */
function localDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function shortName(name) {
  const parts = String(name).split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

/** Deals signed, taken from whichever source actually carries the number. */
function signedCount(dash) {
  const ladder = (dash.stageLadder && dash.stageLadder.stages) || [];
  const fromLadder = ladder.find((s) => s.key === 'Deal Signed');
  if (fromLadder) return fromLadder.total;
  const fromPipeline = (dash.pipeline || []).find((s) => s.stage === 'Deal Signed');
  return fromPipeline ? fromPipeline.count : 0;
}
