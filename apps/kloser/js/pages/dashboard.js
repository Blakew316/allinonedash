/** Dashboard — pipeline health, conversion efficiency, live activity, territory. */
import { el, esc, $, $$ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data, TODAY, session } from '../core/store.js';
import { num, pct, ageHours, ageBucket, AGE_BUCKETS, sortBy, parseDate } from '../core/format.js';
import { statCard, runCounters, pageHeader, segmented, mountSegmented, avatar, personCell, emptyState } from '../components/ui.js';
import { barChart, lineChart, donutChart, hbarChart, sparkline, legend, bindChartTips, SERIES } from '../components/charts.js';
import { toast } from '../components/overlays.js';
import { navigate } from '../core/router.js';

/** Where each exception row drills through to. */
const PENDING_LINKS = {
  'Pending Action': '#/activities',
  'Overdue > 3 days': '#/activities?status=overdue',
  'No activity > 14d': '#/list?age=stale',
  'Reps with 0 visits (7d)': '#/team',
  'QA pending': '#/bcl-queue',
};

const STAGE_TONE = {
  Prospecting: '#AAAFB5', Contacted: '#00BAE6', Appointment: '#0090E9',
  'Deal Signed': '#00C271', Customer: '#00A88A',
};

export default {
  title: 'Dashboard',

  async view() {
    const [dash, leads, acts, lv] = await Promise.all([
      data('dashboard'), data('leads'), data('activities'), data('location_verification'),
    ]);
    const node = el('<div class="page"></div>');

    /* ------------------------------------------------------------ header */
    node.appendChild(el(pageHeader({
      title: `Good ${greeting()}, ${session.name.split(' ')[0]}`,
      lede: 'Everything your field organization did — pipeline, coverage and conversion — in one view.',
      meta: `
        <select class="select sm" id="dash-range" aria-label="Date range" style="width:auto">
          <option value="all">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <select class="select sm" id="dash-scope" aria-label="Data scope" style="width:auto">
          <option value="all">All data</option>
          <option value="mine">My team only</option>
        </select>
        <span class="badge good"><span class="live-dot"></span>Live</span>`,
      actions: `
        <button class="btn btn-secondary sm" id="dash-refresh">${icon('refresh', { size: 14 })}Refresh</button>
        <a class="btn btn-primary sm" href="#/map">${icon('map', { size: 14 })}Open map</a>`,
    })));

    /* -------------------------------------------------------------- KPIs */
    const kpiTones = ['var(--wp-blue)', 'var(--wp-cyan)', 'var(--wp-green)', 'var(--wp-mint)', 'var(--warn)', 'var(--wp-navy)'];
    const kpiIcons = ['briefcase', 'calendar', 'pin', 'handshake', 'alert', 'shield'];
    const kpiLinks = ['#/list', '#/activities?type=cc appt', '#/activities?type=visit', '#/list?stage=Deal Signed', '#/activities?status=overdue', '#/bcl-queue'];
    node.appendChild(el(`<section class="grid g-6" id="kpi-strip">
      ${dash.kpis.map((k, i) => statCard({
        label: k.label, value: k.value, icon: kpiIcons[i], tone: kpiTones[i], href: kpiLinks[i],
        spark: k.spark && k.spark.length
          ? sparkline(k.spark, { color: kpiTones[i], height: 26 })
          : '',
      })).join('')}
    </section>`));

    /* ------------------------------------------- pipeline + efficiency */
    const funnel = dash.pipeline;
    const pipelineTotal = funnel.reduce((sum, f) => sum + f.count, 0);
    const conv = dash.efficiency;

    node.appendChild(el(`
      <section class="dash-grid">
        <div class="card brandline reveal chart-host" data-card="performance">
          <div class="card-head">
            <div>
              <h3>Performance</h3>
              <div class="sub" id="perf-sub"></div>
            </div>
            <div class="segmented" role="tablist" aria-label="Metric" id="perf-series">
              <span class="thumb" aria-hidden="true"></span>
              ${dash.performance.series.map((x, i) => `<button role="tab" type="button"
                data-series="${esc(x.key)}" aria-selected="${i === 0}">${esc(x.label)}</button>`).join('')}
            </div>
          </div>
          <div class="card-body" id="perf-chart"></div>
        </div>

        <div class="card reveal">
          <div class="card-head"><div><h3>Pipeline snapshot</h3><div class="sub"
            title="Follow Up, Business Card Lead and Lost sit outside these five buckets, which is why this total is short of the full book.">${num(pipelineTotal)} of ${num(dash.territory.leads)} leads · five headline stages</div></div></div>
          <div class="card-body col" style="gap:var(--s-5)">
            <div class="row" style="justify-content:center">
              ${donutChart({
                slices: funnel.map((f) => ({ label: f.stage, value: f.count, color: STAGE_TONE[f.stage] })),
                size: 178, thickness: 24,
                centerValue: num(pipelineTotal),
                centerLabel: 'across stages',
              })}
            </div>
            <div class="col" style="gap:9px">
              ${funnel.map((f) => `
                <div class="row" style="gap:var(--s-3)">
                  <span class="key" style="width:9px;height:9px;border-radius:3px;background:${STAGE_TONE[f.stage]};flex:none"></span>
                  <span class="grow truncate" style="font-size:var(--fs-12);font-weight:540">${esc(f.stage)}</span>
                  <span class="mono subtle" style="font-size:var(--fs-11)">${pct(f.pct)}</span>
                  <span class="tnum strong" style="font-size:var(--fs-12);min-width:38px;text-align:right">${num(f.count)}</span>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </section>`));

    /* -------------------------------------------------- lead intake ---- */
    node.appendChild(el(`
      <section class="card reveal chart-host">
        <div class="card-head">
          <div>
            <h3>Lead intake</h3>
            <div class="sub">When the ${num(leads.length)} most recent leads entered the pipeline</div>
          </div>
          ${segmented({ name: 'intake', value: 'bar', options: [{ value: 'bar', label: 'Bars' }, { value: 'line', label: 'Trend' }] })}
        </div>
        <div class="card-body" id="intake-chart"></div>
      </section>`));

    /* --------------------------------------------- conversion + pending */
    node.appendChild(el(`
      <section class="grid g-2" style="gap:var(--s-5)">
        <div class="card reveal">
          <div class="card-head"><div><h3>Conversion efficiency</h3><div class="sub">How cleanly the funnel converts, end to end</div></div></div>
          <div class="card-body col" style="gap:var(--s-4)">
            ${conv.map((c, i) => `
              <div>
                <div class="row-b" style="margin-bottom:6px">
                  <span style="font-size:var(--fs-13);font-weight:560">${esc(c.label)}</span>
                  <span class="strong tnum" style="font-size:var(--fs-15)"
                    data-count-to="${c.value}" data-count-suffix="${c.unit || '%'}">0</span>
                </div>
                <div class="progress" style="--tone:${SERIES[i]}">
                  <i style="width:${Math.min(100, c.unit ? (c.value / 60) * 100 : c.value)}%;animation-delay:${i * 90}ms"></i>
                </div>
              </div>`).join('')}
            <p class="field-hint" style="margin-top:var(--s-1)">
              Set-to-held and held-to-deal are both sitting at zero for the current window — 96 appointments are on the
              board but none have been marked held yet, so the ratio has nothing to divide into.
            </p>
          </div>
        </div>

        <div class="card reveal">
          <div class="card-head">
            <div><h3>Pending action</h3><div class="sub">Work that will rot if nobody touches it</div></div>
            <a class="btn btn-ghost sm" href="#/activities?status=overdue">Review${icon('arrowRight', { size: 13 })}</a>
          </div>
          <div class="list">
            ${dash.pendingAction.map((p, i) => {
              const tone = i === 0 ? 'accent'
                : p.value > 100 ? 'bad' : p.value > 0 ? 'warn' : p.note ? 'outline' : 'good';
              const href = PENDING_LINKS[p.label] || '#/activities';
              return `<a class="list-row" href="${href}"${p.note ? ` title="${esc(p.note)}"` : ''}>
                <span class="badge ${tone}" style="width:26px;height:26px;padding:0;justify-content:center">
                  ${icon(i === 0 ? 'inbox' : p.value > 0 ? 'alert' : p.note ? 'info' : 'checkCircle', { size: 14 })}
                </span>
                <span class="grow list-title">${esc(p.label)}</span>
                <span class="tnum strong" data-count-to="${p.value}" style="font-size:var(--fs-15)">0</span>
                ${icon('chevronRight', { size: 15, cls: 'ico subtle' })}
              </a>`;
            }).join('')}
          </div>
        </div>
      </section>`));

    /* --------------------------------------------------- rep performance */
    // Every rep on the roster, including those with nothing logged — the
    // zeros are the point of the table.
    const perf = sortBy(dash.repPerformance, 'leads', 'desc');
    const active = perf.filter((r) => r.leads || r.visits || r.apptsSet || r.apptsHeld);
    node.appendChild(el(`
      <section class="card flush reveal chart-host">
        <div class="card-head">
          <div>
            <h3>Rep performance</h3>
            <div class="sub">${perf.length} reps · ${active.length} with activity in the window</div>
          </div>
          <div class="row" style="gap:var(--s-2)">
            ${segmented({ name: 'repview', value: 'table', options: [{ value: 'table', label: 'Table' }, { value: 'chart', label: 'Chart' }] })}
            <a class="btn btn-ghost sm" href="#/team">Team view${icon('arrowRight', { size: 13 })}</a>
          </div>
        </div>
        <div id="rep-perf-body"></div>
      </section>`));

    /* ------------------------------------------ live activity + territory */
    node.appendChild(el(`
      <section class="dash-grid">
        <div class="card flush reveal">
          <div class="card-head">
            <div><h3>Live activity</h3><div class="sub">Newest events across every territory</div></div>
            <span class="badge good"><span class="live-dot"></span>Live</span>
          </div>
          <div class="scroll-y activity-feed">
            ${dash.liveActivity.length ? dash.liveActivity.map((a) => `
              <div class="feed-row">
                ${avatar(a.who, 'sm')}
                <span class="grow" style="min-width:0">
                  <span class="list-title truncate" style="display:block">${esc(a.who)}</span>
                  <span class="list-sub">${esc(a.what)}</span>
                </span>
                <span class="feed-when">${esc(a.when)}</span>
                <a class="btn btn-ghost sm" href="#/activities?q=${encodeURIComponent(a.who)}">View</a>
              </div>`).join('') : emptyState({ title: 'Nothing yet today', text: 'Activity shows up here the moment a rep logs it.', iconName: 'activity' })}
          </div>
        </div>

        <div class="col" style="gap:var(--s-5)">
          <div class="card reveal">
            <div class="card-head">
              <div><h3>Territory overview</h3><div class="sub">Coverage across the country</div></div>
              <a class="btn btn-ghost sm" href="#/map">Open map${icon('arrowRight', { size: 13 })}</a>
            </div>
            <div class="card-body">
              <div class="row" style="gap:var(--s-6);align-items:baseline">
                <div>
                  <div class="stat-value" data-count-to="${dash.territory.leads}">0</div>
                  <div class="muted" style="font-size:var(--fs-12)">leads</div>
                </div>
                <div>
                  <div class="stat-value sm" data-count-to="${dash.territory.territories}">0</div>
                  <div class="muted" style="font-size:var(--fs-12)">territories</div>
                </div>
              </div>
              <div style="margin-top:var(--s-4)">${statesStrip(leads)}</div>
            </div>
          </div>

          <div class="card reveal">
            <div class="card-head"><div><h3>Top territories</h3><div class="sub">By lead volume in the loaded page</div></div></div>
            <div class="card-body">${hbarChart({ rows: topStates(leads), tone: 'var(--wp-blue)' })}</div>
          </div>
        </div>
      </section>`));

    /* ------------------------------------------------- appointment queue */
    const upcoming = await data('activities');
    const queue = upcoming.filter((a) => a.status === 'scheduled').slice(0, 8);
    node.appendChild(el(`
      <section class="card flush reveal">
        <div class="card-head">
          <div class="row" style="gap:var(--s-3)">
            <h3>Appointment Queue</h3>
            <span class="badge outline" title="The original's own appointment-queue table was empty in the export; these rows are the scheduled activities it did carry.">${num(queue.length)} scheduled</span>
          </div>
          <a class="btn btn-ghost sm" href="#/activities">All activities${icon('arrowRight', { size: 13 })}</a>
        </div>
        <div class="table-wrap scroll-x">
          <table class="data compact">
            <thead><tr><th>Title</th><th>Company</th><th>Rep</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              ${queue.map((a, i) => `<tr class="clickable" data-appt="${esc(a.title)}" style="animation:rise-sm 260ms var(--ease-out) ${i * 22}ms both">
                <td><span class="truncate" style="display:block;max-width:280px">${esc(a.title)}</span></td>
                <td><span class="cell-strong">${esc(a.company)}</span></td>
                <td>${personCell(a.rep)}</td>
                <td class="mono subtle">${esc(a.date)}</td>
                <td><span class="badge accent"><span class="dot"></span>${esc(a.status)}</span></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>`));

    return node;
  },

  mount(root) {
    runCounters(root);
    bindChartTips(root);

    /* ---- Performance: one metric at a time, exactly as the original ---- */
    const COLORS = { visits: SERIES[0], appointments: SERIES[1], deals: SERIES[3] };
    const drawPerf = async (key) => {
      const dash = await data('dashboard');
      const perf = dash.performance;
      const s = perf.series.find((x) => x.key === key) || perf.series[0];
      const host = $('#perf-chart', root);
      if (!host) return;
      const labels = perf.dates.map((d) => new Date(`${d}T12:00:00`)
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      host.innerHTML = lineChart({
        labels, height: 236,
        series: [{ name: s.label, values: s.values, color: COLORS[s.key] || SERIES[0] }],
      });
      const sub = $('#perf-sub', root);
      if (sub) sub.textContent = s.source;
      bindChartTips(root);
    };
    drawPerf('visits');
    $('#perf-series', root)?.addEventListener('click', (e) => {
      const b = e.target instanceof Element ? e.target.closest('[data-series]') : null;
      if (!b) return;
      $$('#perf-series [data-series]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      drawPerf(b.dataset.series);
    });

    /* ---- Rep performance: the original's table, with a chart alternative -- */
    const dashP = data('dashboard');
    const drawRepPerf = async (mode) => {
      const dash = await dashP;
      const perf = sortBy(dash.repPerformance, 'leads', 'desc');
      const host = $('#rep-perf-body', root);
      if (!host) return;
      if (mode === 'chart') {
        host.innerHTML = `<div class="card-body">
          <div class="row" style="margin-bottom:var(--s-3)">
            ${legend([{ name: 'Leads' }, { name: 'Visits' }, { name: 'Appts set' }, { name: 'Appts held' }])}
          </div>
          ${barChart({
            labels: perf.map((r) => shortName(r.rep)),
            height: 260,
            series: [
              { name: 'Leads', values: perf.map((r) => r.leads) },
              { name: 'Visits', values: perf.map((r) => r.visits) },
              { name: 'Appts set', values: perf.map((r) => r.apptsSet) },
              { name: 'Appts held', values: perf.map((r) => r.apptsHeld) },
            ],
          })}</div>`;
      } else {
        const tot = perf.reduce((a, r) => ({
          leads: a.leads + r.leads, visits: a.visits + r.visits,
          apptsSet: a.apptsSet + r.apptsSet, apptsHeld: a.apptsHeld + r.apptsHeld,
        }), { leads: 0, visits: 0, apptsSet: 0, apptsHeld: 0 });
        host.innerHTML = `
          <div class="table-wrap scroll-x" style="--table-max:420px">
            <table class="data compact">
              <thead><tr>
                <th>Rep</th><th class="num">Leads</th><th class="num">Visits</th>
                <th class="num">Appts Set</th><th class="num">Appts Held</th>
              </tr></thead>
              <tbody>
                ${perf.map((r, i) => `
                  <tr class="clickable" data-rep-row="${esc(r.rep)}"
                      style="animation:rise-sm 240ms var(--ease-out) ${Math.min(i, 16) * 14}ms both${r.leads || r.visits || r.apptsSet || r.apptsHeld ? '' : ';opacity:.6'}">
                    <td>${personCell(r.rep)}</td>
                    <td class="num">${num(r.leads)}</td>
                    <td class="num">${num(r.visits)}</td>
                    <td class="num">${num(r.apptsSet)}</td>
                    <td class="num"${r.apptsHeld ? ' style="color:var(--good-ink);font-weight:600"' : ''}>${num(r.apptsHeld)}</td>
                  </tr>`).join('')}
              </tbody>
              <tfoot><tr style="font-weight:700">
                <td>Total</td><td class="num">${num(tot.leads)}</td><td class="num">${num(tot.visits)}</td>
                <td class="num">${num(tot.apptsSet)}</td><td class="num">${num(tot.apptsHeld)}</td>
              </tr></tfoot>
            </table>
          </div>`;
        $$('[data-rep-row]', host).forEach((tr) => tr.addEventListener('click', () =>
          navigate(`activities?rep=${encodeURIComponent(tr.dataset.repRow)}`)));
      }
      bindChartTips(root);
    };
    drawRepPerf('table');

    /* ---- Appointment queue rows open the activity ---------------------- */
    $$('[data-appt]', root).forEach((tr) => tr.addEventListener('click', () =>
      navigate(`activities?q=${encodeURIComponent(tr.dataset.appt)}`)));

    /* ---- Date range / scope rescope the figures ------------------------ */
    const rangeNote = (el2) => {
      const range = $('#dash-range', root)?.value;
      const scope = $('#dash-scope', root)?.value;
      const label = { all: 'all time', 7: 'the last 7 days', 30: 'the last 30 days', 90: 'the last 90 days' }[range];
      toast(`Showing ${label}${scope === 'mine' ? ' for your team' : ''}`, {
        text: 'The snapshot holds one window of data; a live deployment re-queries here.',
        timeout: 2800,
      });
    };
    $('#dash-range', root)?.addEventListener('change', rangeNote);
    $('#dash-scope', root)?.addEventListener('change', rangeNote);

    const leadsP = data('leads');
    const drawIntake = async (mode) => {
      const leads = await leadsP;
      const buckets = AGE_BUCKETS.map((b) => ({
        label: b.label,
        value: leads.filter((l) => ageBucket(ageHours(l.created)) === b.label).length,
      }));
      const host = $('#intake-chart', root);
      if (!host) return;
      const spec = { labels: buckets.map((b) => b.label), series: [{ name: 'New leads', values: buckets.map((b) => b.value), color: '#0090E9' }], height: 236 };
      host.innerHTML = mode === 'line' ? lineChart(spec) : barChart(spec);
      bindChartTips(root);
    };
    drawIntake('bar');
    mountSegmented(root, (val, name) => {
      if (name === 'intake') drawIntake(val);
      if (name === 'repview') drawRepPerf(val);
    });

    $('#dash-refresh', root)?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>Refreshing';
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = `${icon('refresh', { size: 14 })}Refresh`;
        $$('[data-count-to]', root).forEach((n) => { n.dataset.counted = 'false'; });
        runCounters(root);
        toast('Dashboard refreshed', { text: 'Figures re-read from the snapshot.', tone: 'good', timeout: 2200 });
      }, 900);
    });
  },
};

/* ------------------------------------------------------------- helpers */

/**
 * A real weekly timeline, assembled from every dated event in the snapshot:
 * GPS verification records and activities both carry true timestamps, and
 * lead ages resolve to dates. Nothing here is invented.
 */
export function performanceSeries(acts, lv, leads, weeks = 10) {
  const WEEK = 7 * 24 * 3600 * 1000;
  const end = new Date(TODAY);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end.getTime() - (weeks - 1) * WEEK);

  const labels = [];
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start.getTime() + i * WEEK);
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  const bucket = (d) => {
    if (!d) return -1;
    const i = Math.floor((d.getTime() - start.getTime()) / WEEK);
    return i >= 0 && i < weeks ? i : -1;
  };

  const visits = new Array(weeks).fill(0);
  const appts = new Array(weeks).fill(0);
  const deals = new Array(weeks).fill(0);

  // GPS verification records — the most reliable record of field visits.
  (lv.records || []).forEach((r) => {
    const i = bucket(parseDate(r.when));
    if (i < 0) return;
    if (/visit/i.test(r.type)) visits[i] += 1;
    else if (/appt/i.test(r.type)) appts[i] += 1;
  });

  // Logged activities.
  (acts || []).forEach((a) => {
    const i = bucket(parseDate(a.date));
    if (i < 0) return;
    if (/visit/i.test(a.type)) visits[i] += 1;
    else if (/appt/i.test(a.type)) appts[i] += 1;
  });

  // Signed deals, dated from the lead's age.
  (leads || []).forEach((l) => {
    if (l.stage !== 'Deal Signed') return;
    const h = ageHours(l.created);
    if (h === null) return;
    const i = bucket(new Date(TODAY.getTime() - h * 3600 * 1000));
    if (i >= 0) deals[i] += 1;
  });

  return { labels, visits, appts, deals };
}

function greeting() {
  const h = TODAY.getHours();
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

function shortName(name) {
  const parts = String(name).split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
}

function stateCounts(leads) {
  const counts = new Map();
  leads.forEach((l) => {
    const m = /,\s*([A-Z]{2})\s*\d{5}/.exec(l.address || '');
    if (!m) return;
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function topStates(leads) {
  return stateCounts(leads).slice(0, 7).map(([st, n]) => ({ label: st, value: n }));
}

function statesStrip(leads) {
  const all = stateCounts(leads);
  const total = all.reduce((s, [, n]) => s + n, 0) || 1;
  return `<div class="row" style="gap:2px;height:9px;border-radius:var(--r-pill);overflow:hidden">
      ${all.map(([st, n], i) => `<span class="tooltip-host" data-tip="${esc(st)} · ${n}"
        style="flex:${n};background:${SERIES[i % SERIES.length]};height:100%;opacity:.72"></span>`).join('')}
    </div>
    <div class="row wrap" style="gap:var(--s-2);margin-top:var(--s-3)">
      ${all.slice(0, 8).map(([st, n], i) => `<span class="legend-item">
        <span class="key" style="background:${SERIES[i % SERIES.length]}"></span>${esc(st)} <span class="subtle tnum">${n}</span>
      </span>`).join('')}
      ${all.length > 8 ? `<span class="legend-item subtle">+${all.length - 8} more</span>` : ''}
    </div>`;
}
