// Overlay a PDF-coordinate grid on a form page background, optionally cropped to
// a y-band, so we can read exact cell borders. Usage:
//   node scripts/grid.mjs <form> <page> <out> [yMin] [yMax]
import fs from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { loadAnchors, renderedPagePath } from "../lib/anchors.js";

const [, , form = "merrick", pageArg = "1", out = "/tmp/grid.png", yMinA, yMaxA] = process.argv;
const page = Number(pageArg);
const anchors = loadAnchors(form);
const { width, height } = anchors.pages[page - 1];
const bg = await loadImage(renderedPagePath(form, page));
const scale = bg.width / width;
const canvas = createCanvas(bg.width, bg.height);
const ctx = canvas.getContext("2d");
ctx.drawImage(bg, 0, 0);

ctx.lineWidth = 1;
ctx.font = `${10 * scale}px monospace`;
// vertical lines every 20 PDF-units (x), label at top
for (let x = 0; x <= width; x += 20) {
  ctx.strokeStyle = x % 100 === 0 ? "rgba(200,0,0,0.55)" : "rgba(0,120,220,0.30)";
  ctx.beginPath(); ctx.moveTo(x * scale, 0); ctx.lineTo(x * scale, bg.height); ctx.stroke();
  ctx.fillStyle = "rgba(200,0,0,0.9)";
  if (x % 40 === 0) ctx.fillText(String(x), x * scale + 1, 12 * scale);
}
// horizontal lines every 15 PDF-units (y is bottom-origin), label at left
for (let y = 0; y <= height; y += 15) {
  ctx.strokeStyle = y % 75 === 0 ? "rgba(200,0,0,0.45)" : "rgba(0,160,80,0.28)";
  const iy = (height - y) * scale;
  ctx.beginPath(); ctx.moveTo(0, iy); ctx.lineTo(bg.width, iy); ctx.stroke();
  ctx.fillStyle = "rgba(0,110,40,0.95)";
  if (y % 30 === 0) ctx.fillText(String(y), 2, iy - 1);
}

let img = canvas;
if (yMinA != null && yMaxA != null) {
  const yMin = Number(yMinA), yMax = Number(yMaxA);
  const top = (height - yMax) * scale, h = (yMax - yMin) * scale;
  const crop = createCanvas(bg.width, Math.ceil(h));
  crop.getContext("2d").drawImage(canvas, 0, top, bg.width, h, 0, 0, bg.width, h);
  img = crop;
}
fs.writeFileSync(out, img.toBuffer("image/png"));
console.log("wrote", out);
