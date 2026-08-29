/* Renders the app icons from tools/icon/icon.template.html.
 *
 * No imaging library exists in this environment, so the icons are rasterised by
 * headless Chromium — which also gives real font rendering for the "WPI CC"
 * wordmark. The 512px source is scaled by deviceScaleFactor so every size is a
 * clean render rather than a resample.
 *
 *   node tools/make_icon.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SRC = 'file://' + path.resolve('tools/icon/icon.template.html');
const OUT = 'assets/img';

// name, pixel size, glyph-only (no wordmark — illegible at tab sizes)
const TARGETS = [
  ['icon-512.png',        512, false],
  ['icon-192.png',        192, false],
  ['apple-touch-icon.png',180, false],
  ['favicon.png',          64, true ],
];

(async () => {
  const browser = await chromium.launch();
  for (const [name, size, glyphOnly] of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: 512, height: 512 },
      deviceScaleFactor: size / 512,
    });
    await page.goto(SRC, { waitUntil: 'load' });
    if (glyphOnly) await page.evaluate(() => document.body.classList.add('glyph-only'));
    await page.waitForTimeout(180);
    const file = path.join(OUT, name);
    await page.screenshot({ path: file, omitBackground: false });
    console.log(`${name.padEnd(22)} ${size}x${size}  ${fs.statSync(file).size} bytes`);
    await page.close();
  }
  await browser.close();
})();
