// Detect where the underline for a field row begins (PDF x), by scanning the
// rendered background for long dark horizontal runs just below the label baseline.
import { loadImage, createCanvas } from "@napi-rs/canvas";
import { loadAnchors, renderedPagePath } from "../lib/anchors.js";

const form = process.argv[2] || "coversheet";
const ys = (process.argv[3] || "722,702,682,663,624,609,594,580").split(",").map(Number);

const anchors = loadAnchors(form);
const { width, height } = anchors.pages[0];
const bg = await loadImage(renderedPagePath(form, 1));
const scale = bg.width / width;
const canvas = createCanvas(bg.width, bg.height);
const ctx = canvas.getContext("2d");
ctx.drawImage(bg, 0, 0);
const img = ctx.getImageData(0, 0, bg.width, bg.height);
const data = img.data;
const W = bg.width;

const dark = (x, y) => {
  const i = (y * W + x) * 4;
  return data[i] < 130 && data[i + 1] < 130 && data[i + 2] < 130;
};

for (const yPt of ys) {
  const base = Math.round((height - yPt) * scale);
  let best = null;
  for (let yc = base + 1; yc <= base + 16; yc++) {
    if (yc < 0 || yc >= bg.height) continue;
    let runStart = -1, x = 0;
    for (x = 0; x < W; x++) {
      if (dark(x, yc)) {
        if (runStart < 0) runStart = x;
      } else {
        if (runStart >= 0 && x - runStart > 60) {
          if (!best || x - runStart > best.len) best = { len: x - runStart, start: runStart, yc };
        }
        runStart = -1;
      }
    }
    if (runStart >= 0 && W - runStart > 60 && (!best || W - runStart > best.len)) best = { len: W - runStart, start: runStart, yc };
  }
  if (best) console.log(`y=${yPt} -> line starts at x=${(best.start / scale).toFixed(0)}pt (len ${(best.len / scale).toFixed(0)}pt)`);
  else console.log(`y=${yPt} -> no line found`);
}
