/*
 * Render the PWA icons from the logo's own mark geometry.
 *
 *     node tools/make-icons.js
 *
 * The icons used to be three equal bars sitting on one baseline - a generic
 * bar chart, not this logo. The real mark is asymmetric and that asymmetry is
 * the whole of its character: a narrow left bar hung from the top, a wide
 * middle bar banded blue into green into mint, and a narrow right bar standing
 * on the bottom. The rectangles below are the artwork's measured geometry,
 * identical to App.mark in assets/js/app.js and to assets/img/favicon.svg.
 *
 * Rasterised through headless Chromium rather than shipped as SVG, because
 * Android and iOS both want PNGs in the manifest.
 */

const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'img');

const NAVY = '#00125e';

/* [id, from, to] - the mark's own gradients, top to bottom. */
const BANDS = [
  ['b1', '#0192e5', '#008de5'],
  ['bl', '#01a2e6', '#009be8'],
  ['gr', '#00cb7c', '#04be6a'],
  ['mi', '#4ee572', '#4de56e'],
  ['b3', '#50e77c', '#4de777'],
];

/* The mark at its measured geometry, in its own 145x218 space. */
function mark() {
  return `
    <defs>${BANDS.map(([id, a, b]) => `
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
      </linearGradient>`).join('')}
    </defs>
    <rect fill="url(#b1)" x="2"   y="2"   width="22" height="167" rx="3"/>
    <rect fill="url(#bl)" x="42"  y="2"   width="62" height="50"  rx="3"/>
    <rect fill="url(#gr)" x="42"  y="50"  width="62" height="121"/>
    <rect fill="url(#mi)" x="42"  y="169" width="62" height="48"  rx="3"/>
    <rect fill="url(#b3)" x="122" y="50"  width="23" height="166" rx="3"/>`;
}

/*
 * opts.safe   fraction of the square the artwork may occupy. A maskable icon
 *             is cropped to a circle by the launcher, so it keeps to 80%.
 * opts.round  corner radius as a fraction; 0 for maskable, which must bleed.
 */
function icon(size, opts) {
  const safe = opts.safe;
  const inset = size * (1 - safe) / 2;
  const box = size * safe;

  /* Mark above, wordmark below, and the pair centred as one lockup rather than
     hung from the top - otherwise the type ends up with more air beneath it
     than the mark has above, and the whole thing reads as sitting high.
     The mark is 0.665 as wide as it is tall and keeps that proportion. */
  const markH = box * 0.64;
  const markW = markH * (145 / 218);
  const markX = (size - markW) / 2;

  const gap = box * 0.075;
  const fontSize = box * 0.152;
  const capHeight = fontSize * 0.72;          // Liberation Sans cap height

  const lockup = markH + gap + capHeight;
  const markY = (size - lockup) / 2;
  const baseline = markY + markH + gap + capHeight;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * opts.round}" fill="${NAVY}"/>
  <svg x="${markX}" y="${markY}" width="${markW}" height="${markH}" viewBox="0 0 145 218">${mark()}</svg>
  <text x="${size / 2}" y="${baseline}"
        text-anchor="middle"
        font-family="Liberation Sans, Arial, DejaVu Sans, sans-serif"
        font-weight="700"
        font-size="${fontSize}"
        letter-spacing="${fontSize * 0.02}"
        fill="#ffffff">WPI Learn</text>
</svg>`;
}

const TARGETS = [
  { file: 'icon-192.png',      size: 192, safe: 0.80, round: 0.225 },
  { file: 'icon-512.png',      size: 512, safe: 0.80, round: 0.225 },
  /* A launcher may crop a maskable icon to a circle of 80% diameter. The
     lockup is taller than it is wide, so what has to fit is its diagonal:
     at 0.70 that lands inside the circle with room to spare. */
  { file: 'icon-maskable.png', size: 512, safe: 0.70, round: 0 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();

  for (const t of TARGETS) {
    const svg = icon(t.size, t);
    await page.setViewportSize({ width: t.size, height: t.size });
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:transparent}</style>${svg}`,
      { waitUntil: 'load' });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, t.file), omitBackground: true });
    console.log(`wrote assets/img/${t.file}  ${t.size}x${t.size}`);
  }
  await browser.close();
})();
