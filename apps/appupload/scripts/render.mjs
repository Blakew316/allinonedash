// Render PDF pages to PNG for visual verification.
// Usage: node scripts/render.mjs <pdf> <outPrefix> [scale]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);
const stdFonts = pathToFileURL(path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts/")).href;

const [, , file, outPrefix = "out", scaleArg] = process.argv;
const scale = Number(scaleArg) || 2;
if (!file) {
  console.error("usage: node scripts/render.mjs <pdf> <outPrefix> [scale]");
  process.exit(1);
}

const data = new Uint8Array(fs.readFileSync(file));
const doc = await getDocument({ data, useSystemFonts: true, standardFontDataUrl: stdFonts }).promise;
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport, canvasFactory: doc.canvasFactory }).promise;
  const out = `${outPrefix}-p${p}.png`;
  fs.writeFileSync(out, canvas.toBuffer("image/png"));
  console.log("wrote", out);
}
