// Visual verification: draw the REAL computed placements onto each template's
// background image (using @napi-rs/canvas), so we can eyeball positioning.
// Usage: node scripts/verify-overlay.mjs <form> <outPrefix>
import fs from "node:fs";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { loadAnchors, renderedPagePath } from "../lib/anchors.js";
import { computePlacements } from "../lib/fillForm.js";
import { normalizeRecord } from "../lib/extract.js";

process.env.TRANSCRIBE_MOCK = "1";
const { extractFromImages } = await import("../lib/extract.js");

const form = process.argv[2] || "citizens";
const outPrefix = process.argv[3] || `/tmp/verify-${form}`;

let record = await extractFromImages([{ data: "x", mediaType: "image/png" }]);
if (form === "merrick") record = normalizeRecord({ ...record, appType: "merrick" });
if (form === "coversheet") {
  record = { ...record, _date: "06/27/2026", _appLabel: "Application: Citizens Bank (Priority Payment Systems)", _bankShort: "Citizens" };
}

const anchors = loadAnchors(form);
// canvas measure that mirrors Helvetica metrics closely enough for fit decisions
const tmp = createCanvas(10, 10).getContext("2d");
const measure = (text, size) => {
  tmp.font = `${size}px Helvetica, Arial, sans-serif`;
  return tmp.measureText(text).width;
};
const placements = computePlacements(form, record, measure);

for (let p = 0; p < anchors.pages.length; p++) {
  const { width, height } = anchors.pages[p];
  const bg = await loadImage(renderedPagePath(form, p + 1));
  const scale = bg.width / width;
  const canvas = createCanvas(bg.width, bg.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bg, 0, 0);
  ctx.fillStyle = "rgb(13,26,115)";
  for (const it of placements.filter((i) => i.page === p + 1)) {
    ctx.font = `${it.bold ? "bold " : ""}${it.size * scale}px Helvetica, Arial, sans-serif`;
    const cx = it.x * scale;
    const cy = (height - it.y) * scale; // PDF bottom-origin -> canvas top-origin
    ctx.fillText(it.text, cx, cy);
  }
  const out = `${outPrefix}-p${p + 1}.png`;
  fs.writeFileSync(out, canvas.toBuffer("image/png"));
  console.log("wrote", out, `(${placements.filter((i) => i.page === p + 1).length} fields)`);
}
