/**
 * Hand-rolled SVG charts.
 * Every chart draws itself in on mount and respects prefers-reduced-motion
 * (the CSS animations collapse to 0ms, so the final frame is what renders).
 */
import { esc } from '../core/dom.js';
import { num, compact } from '../core/format.js';

export const SERIES = ['#0090E9', '#00C271', '#00BAE6', '#4FE778', '#7C5CFF', '#E8A317', '#FF7A45', '#00A88A'];

const uid = (() => { let n = 0; return (p = 'c') => `${p}${++n}`; })();

const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

/** Catmull-Rom → cubic Bézier, for the soft curves the dashboards use. */
function smoothPath(pts, tension = 0.32) {
  if (pts.length < 3) return path(pts);
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) * tension / 3;
    const c1y = p1[1] + (p2[1] - p0[1]) * tension / 3;
    const c2x = p2[0] - (p3[0] - p1[0]) * tension / 3;
    const c2y = p2[1] - (p3[1] - p1[1]) * tension / 3;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

/* --------------------------------------------------------------------------
   Line / area chart
   -------------------------------------------------------------------------- */
/**
 * @param {{labels:string[], series:{name:string, values:number[], color?:string}[]}} spec
 */
export function lineChart({ labels, series, height = 220, area = true, yTicks = 4, valueFmt = num }) {
  const W = 720, H = height;
  const pad = { t: 14, r: 14, b: 26, l: 42 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const xAt = (i) => pad.l + (labels.length <= 1 ? iw / 2 : (i * iw) / (labels.length - 1));
  const yAt = (v) => pad.t + ih - (v / max) * ih;

  const grid = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = (max / yTicks) * i;
    const y = yAt(v);
    return `<line class="grid-line ${i === 0 ? 'base' : ''}" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>
            <text class="axis-label" x="${pad.l - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${compact(v)}</text>`;
  }).join('');

  const body = series.map((s, si) => {
    const color = s.color || SERIES[si % SERIES.length];
    const pts = s.values.map((v, i) => [xAt(i), yAt(v)]);
    const d = smoothPath(pts);
    const gid = uid('g');
    const areaD = `${d} L${xAt(pts.length - 1).toFixed(2)},${(pad.t + ih).toFixed(2)} L${xAt(0).toFixed(2)},${(pad.t + ih).toFixed(2)} Z`;
    const len = Math.round(iw * 1.6);
    return `
      ${area ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".22"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path class="series-area draw-area" d="${areaD}" fill="url(#${gid})"/>` : ''}
      <path class="series-line draw-path" style="--len:${len}" d="${d}" stroke="${color}"
        stroke-dasharray="${len}" stroke-dashoffset="${len}"/>
      ${pts.map((p, i) => `<circle class="dot" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="3.6"
        fill="${color}" data-label="${esc(labels[i])}" data-value="${valueFmt(s.values[i])}" data-series="${esc(s.name)}"/>`).join('')}`;
  }).join('');

  const xLabels = labels.map((l, i) => {
    const every = Math.ceil(labels.length / 8);
    if (i % every !== 0 && i !== labels.length - 1) return '';
    return `<text class="axis-label" x="${xAt(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
      style="height:${H}px" role="img" aria-label="Trend chart">${grid}${body}${xLabels}</svg>`;
}

/* --------------------------------------------------------------------------
   Bar chart (vertical, optionally grouped)
   -------------------------------------------------------------------------- */
export function barChart({ labels, series, height = 220, yTicks = 4, valueFmt = num }) {
  const W = 720, H = height;
  const pad = { t: 14, r: 14, b: 28, l: 42 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const slot = iw / labels.length;
  const groupW = Math.min(slot * 0.68, 44);
  const barW = groupW / series.length;

  const grid = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = (max / yTicks) * i;
    const y = pad.t + ih - (v / max) * ih;
    return `<line class="grid-line ${i === 0 ? 'base' : ''}" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${W - pad.r}" y2="${y.toFixed(1)}"/>
            <text class="axis-label" x="${pad.l - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${compact(v)}</text>`;
  }).join('');

  const bars = labels.map((label, i) => {
    const cx = pad.l + slot * i + slot / 2;
    return series.map((s, si) => {
      const color = s.color || SERIES[si % SERIES.length];
      const v = s.values[i] || 0;
      const h = Math.max(v > 0 ? 2 : 0, (v / max) * ih);
      const x = cx - groupW / 2 + barW * si;
      const y = pad.t + ih - h;
      return `<rect class="bar grow-bar" x="${x.toFixed(2)}" y="${y.toFixed(2)}"
        width="${Math.max(1, barW - 2).toFixed(2)}" height="${h.toFixed(2)}" rx="${Math.min(3, barW / 3).toFixed(1)}"
        fill="${color}" style="animation-delay:${i * 34 + si * 60}ms;transform-origin:center ${(pad.t + ih).toFixed(2)}px"
        data-label="${esc(label)}" data-value="${valueFmt(v)}" data-series="${esc(s.name)}"/>`;
    }).join('');
  }).join('');

  const xLabels = labels.map((l, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const every = Math.ceil(labels.length / 10);
    if (i % every !== 0) return '';
    return `<text class="axis-label" x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
      style="height:${H}px" role="img" aria-label="Bar chart">${grid}${bars}${xLabels}</svg>`;
}

/* --------------------------------------------------------------------------
   Horizontal bars — good for long rep names
   -------------------------------------------------------------------------- */
export function hbarChart({ rows, valueFmt = num, tone }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<div class="col" style="gap:var(--s-3)">
    ${rows.map((r, i) => `
      <div class="hbar-row">
        <div class="row-b" style="gap:var(--s-3);margin-bottom:5px">
          <span class="truncate" style="font-size:var(--fs-12);font-weight:560">${esc(r.label)}</span>
          <span class="mono subtle" style="font-size:var(--fs-11)">${valueFmt(r.value)}</span>
        </div>
        <div class="progress" style="--tone:${tone || r.color || SERIES[i % SERIES.length]}">
          <i style="width:${((r.value / max) * 100).toFixed(1)}%;animation-delay:${i * 45}ms"></i>
        </div>
      </div>`).join('')}
  </div>`;
}

/* --------------------------------------------------------------------------
   Donut
   -------------------------------------------------------------------------- */
export function donutChart({ slices, size = 168, thickness = 22, centerValue, centerLabel }) {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - thickness / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const segs = slices.map((s, i) => {
    const frac = s.value / total;
    const len = frac * circ;
    const color = s.color || SERIES[i % SERIES.length];
    const seg = `<circle class="donut-seg" cx="${c}" cy="${c}" r="${r}" fill="none"
      stroke="${color}" stroke-width="${thickness}" stroke-linecap="butt"
      stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}"
      data-label="${esc(s.label)}" data-value="${num(s.value)}"
      style="animation:fade-in 520ms var(--ease-out) ${i * 90}ms both"></circle>`;
    offset += len;
    return seg;
  }).join('');

  return `<div class="donut-wrap" style="width:${size}px;height:${size}px">
    <svg class="chart" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Distribution">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="${thickness}"
        stroke="color-mix(in srgb, var(--wp-navy) 7%, transparent)"/>
      <g transform="rotate(-90 ${c} ${c})">${segs}</g>
    </svg>
    ${centerValue !== undefined ? `<div class="donut-center">
      <div>
        <div class="dv" data-count-to="${esc(String(centerValue).replace(/[^\d.-]/g, ''))}"
             data-count-suffix="${esc((String(centerValue).match(/[^\d.,\s-]+$/) || [''])[0])}">${esc(centerValue)}</div>
        ${centerLabel ? `<div class="dl">${esc(centerLabel)}</div>` : ''}
      </div>
    </div>` : ''}
  </div>`;
}

/* --------------------------------------------------------------------------
   Progress ring
   -------------------------------------------------------------------------- */
export function ring({ value, max = 100, size = 68, thickness = 6, color = '#0090E9', label }) {
  const r = size / 2 - thickness / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / max));
  return `<div class="donut-wrap" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label || 'progress')}">
      <circle class="ring-track" cx="${c}" cy="${c}" r="${r}" stroke-width="${thickness}"/>
      <circle class="ring-fill draw-path" style="--len:${circ.toFixed(1)}" cx="${c}" cy="${c}" r="${r}"
        stroke="${color}" stroke-width="${thickness}"
        stroke-dasharray="${(circ * frac).toFixed(2)} ${circ.toFixed(2)}"
        stroke-dashoffset="0"/>
    </svg>
    <div class="donut-center"><div class="dv" style="font-size:var(--fs-13)">${Math.round(frac * 100)}%</div></div>
  </div>`;
}

/* --------------------------------------------------------------------------
   Sparkline
   -------------------------------------------------------------------------- */
export function sparkline(values, { color = '#0090E9', height = 34, area = true } = {}) {
  const W = 120, H = height;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / Math.max(1, values.length - 1)) * W,
    H - 3 - ((v - min) / span) * (H - 6),
  ]);
  const d = smoothPath(pts);
  const gid = uid('sp');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    ${area ? `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".26"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path class="sp-area draw-area" d="${d} L${W},${H} L0,${H} Z" fill="url(#${gid})"/>` : ''}
    <path class="sp-line draw-path" style="--len:200" d="${d}" stroke="${color}" stroke-dasharray="200" stroke-dashoffset="200"/>
  </svg>`;
}

/* --------------------------------------------------------------------------
   Legend + shared hover tooltip
   -------------------------------------------------------------------------- */
export function legend(series) {
  return `<div class="chart-legend">${series.map((s, i) => `
    <span class="legend-item">
      <span class="key" style="background:${s.color || SERIES[i % SERIES.length]}"></span>${esc(s.name)}
    </span>`).join('')}</div>`;
}

/** Wire hover tooltips for any chart inside `root`. */
export function bindChartTips(root) {
  const hosts = root.querySelectorAll('.chart-host');
  hosts.forEach((host) => {
    if (host.dataset.tipsBound === 'true') return;
    host.dataset.tipsBound = 'true';
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.appendChild(tip);

    host.addEventListener('pointermove', (e) => {
      const t = e.target;
      if (!(t instanceof Element) || !t.hasAttribute('data-value')) { tip.dataset.show = 'false'; return; }
      const r = host.getBoundingClientRect();
      const b = t.getBoundingClientRect();
      tip.innerHTML = `${esc(t.getAttribute('data-label') || '')}${t.getAttribute('data-series') ? ` · ${esc(t.getAttribute('data-series'))}` : ''} <span class="tip-val">${esc(t.getAttribute('data-value'))}</span>`;
      tip.style.left = `${b.left + b.width / 2 - r.left}px`;
      tip.style.top = `${b.top - r.top}px`;
      tip.dataset.show = 'true';
    });
    host.addEventListener('pointerleave', () => { tip.dataset.show = 'false'; });

    // A touch fires down/move/up and then the pointer is destroyed —
    // `pointerleave` never comes, so the tooltip would sit there forever.
    const dismissTouch = (e) => {
      if (e.pointerType !== 'mouse') tip.dataset.show = 'false';
    };
    host.addEventListener('pointerup', dismissTouch);
    host.addEventListener('pointercancel', dismissTouch);
  });
}
