// Builds every home-screen and browser icon from public/logo.png, so the set
// can be regenerated whenever the brand asset or the wording changes.
//
//   node scripts/make-icons.mjs
//
// The icons pair the bar mark with the app's name. The mark is cropped out of
// the full logo rather than redrawn, so its gradients stay exactly on brand.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Kept out of package.json so a browser driver never ships in the Netlify
// build. Install it wherever you like and point PLAYWRIGHT_MODULE at it, or
// run `npm i --no-save playwright-core` first.
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core').catch(() => {
  console.error(
    'playwright-core is not installed. Run "npm i --no-save playwright-core",\n' +
      'or set PLAYWRIGHT_MODULE to an existing copy, then run this again.'
  );
  process.exit(1);
});
// The package is CommonJS, so a path import lands its exports on .default.
const chromium = pw.chromium || pw.default?.chromium;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logoPath = path.join(root, 'public', 'logo.png');

// The bar mark's pixel box inside logo.png, measured from the alpha channel:
// three bars ending at x=127, with a 23px gap before the "wholesale" wordmark.
const LOGO = { w: 760, h: 189 };
const MARK = { x: 1, y: 1, w: 126, h: 188 };

const WORDING = 'WPI Hire';
const NAVY = '#0b1b5e';
const GROUND = '#ffffff';

// Inter is a webfont the sandbox cannot fetch; these are the closest faces
// installed locally and are only needed while the PNGs are being baked.
const STACK = "'Nimbus Sans', 'Liberation Sans', 'DejaVu Sans', Helvetica, Arial, sans-serif";

const logoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;

/**
 * @param size    canvas edge in px
 * @param inset   fraction of the canvas kept clear around the content. Maskable
 *                icons get a large inset so nothing lands outside the circle
 *                Android and iOS may crop to.
 */
function page(size, inset) {
  const s = (n) => (n * size) / 512;

  // Content is laid out at 512 and scaled, so every size stays identical.
  const markH = s(146);
  const markW = (markH * MARK.w) / MARK.h;
  const gap = s(26);

  // Widest the wording may run before it crowds the edge.
  const textMax = size * (1 - inset * 2);

  return `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; padding: 0; }
  body { width: ${size}px; height: ${size}px; background: ${GROUND}; }
  .icon {
    width: ${size}px; height: ${size}px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: ${gap}px;
    background: ${GROUND};
    /* The wording has no descenders, so its line box leaves dead space below
       the caps; nudge the lockup down so it reads as centred. */
    padding-top: ${s(14)}px;
    box-sizing: border-box;
  }
  .mark {
    width: ${markW}px; height: ${markH}px;
    background-image: url("${logoDataUri}");
    background-repeat: no-repeat;
    background-size: ${(LOGO.w * markW) / MARK.w}px ${(LOGO.h * markH) / MARK.h}px;
    background-position: ${(-MARK.x * markW) / MARK.w}px ${(-MARK.y * markH) / MARK.h}px;
  }
  .word {
    font-family: ${STACK};
    font-weight: 700;
    font-size: ${s(86)}px;
    line-height: 1;
    letter-spacing: ${s(-1.6)}px;
    color: ${NAVY};
    white-space: nowrap;
  }
</style>
<div class="icon">
  <div class="mark"></div>
  <div class="word" id="word">${WORDING}</div>
</div>
<script>
  // Set the wording to exactly the safe width, so it is as large as it can be
  // at the sizes that matter — a 60pt home-screen icon and a 46pt Spotlight
  // result — without ever touching the edges.
  const el = document.getElementById('word');
  const max = ${textMax};
  const widthAt = (px) => {
    el.style.fontSize = px + 'px';
    return el.getBoundingClientRect().width;
  };
  let lo = 4, hi = ${size};
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (widthAt(mid) > max) hi = mid; else lo = mid;
  }
  widthAt(lo);
  window.__fit = { fontSize: Math.round(lo * 100) / 100, width: el.getBoundingClientRect().width };
</script>`;
}

const TARGETS = [
  // Masked by iOS and Android into a squircle, so a modest inset is enough.
  { file: 'icon-512.png', size: 512, inset: 0.11 },
  { file: 'icon-192.png', size: 192, inset: 0.11 },
  { file: 'apple-touch-icon.png', size: 180, inset: 0.11 },
  // Maskable art can be cropped to a circle of 80% of the canvas.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.23 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });

for (const t of TARGETS) {
  const p = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
  await p.setContent(page(t.size, t.inset), { waitUntil: 'load' });
  await p.waitForTimeout(120);
  const fit = await p.evaluate(() => window.__fit);
  const out = path.join(root, 'public', t.file);
  await p.screenshot({ path: out, omitBackground: false });
  console.log(
    `${t.file.padEnd(24)} ${String(t.size).padStart(3)}px  wording ${fit.fontSize}px / ${Math.round(fit.width)}px wide  ${(fs.statSync(out).size / 1024).toFixed(1)}KB`
  );
  await p.close();
}

await browser.close();
