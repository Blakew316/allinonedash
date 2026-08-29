// Build step: for each template PDF, render page backgrounds to PNG and extract
// label coordinates to JSON. pdfjs can read the (encrypted) templates; pdf-lib
// cannot, so at runtime we composite the PNG background + text overlay instead.
//
// Outputs:
//   assets/rendered/<form>-p<n>.png   page background images
//   assets/anchors/<form>.json        { pages: [{ width, height, items:[{str,x,y,w,h}] }] }
//
// Run: npm run build:templates
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const TEMPLATE_DIR = path.join(root, "assets", "templates");
const RENDER_DIR = path.join(root, "assets", "rendered");
const ANCHOR_DIR = path.join(root, "assets", "anchors");
const SCALE = 2.5; // ~180 DPI: crisp form text, reasonable file size

const FORMS = {
  citizens: "citizens.pdf",
  merrick: "merrick.pdf",
  coversheet: "coversheet.pdf",
};

fs.mkdirSync(RENDER_DIR, { recursive: true });
fs.mkdirSync(ANCHOR_DIR, { recursive: true });

for (const [form, fileName] of Object.entries(FORMS)) {
  const data = new Uint8Array(fs.readFileSync(path.join(TEMPLATE_DIR, fileName)));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pagesMeta = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport1 = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: SCALE });

    // Render background
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport, canvasFactory: doc.canvasFactory }).promise;
    const pngPath = path.join(RENDER_DIR, `${form}-p${p}.png`);
    fs.writeFileSync(pngPath, canvas.toBuffer("image/png"));

    // Extract anchors in PDF points (origin bottom-left, matches pdf-lib)
    const content = await page.getTextContent();
    const items = content.items
      .filter((it) => it.str && it.str.trim() !== "")
      .map((it) => ({
        str: it.str.replace(/\s+/g, " ").trim(),
        x: round(it.transform[4]),
        y: round(it.transform[5]),
        w: round(it.width),
        h: round(it.height || Math.abs(it.transform[3]) || 9),
      }));

    pagesMeta.push({ width: round(viewport1.width), height: round(viewport1.height), items });
    console.log(`${form} p${p}: ${items.length} text items, bg ${path.basename(pngPath)}`);
  }

  fs.writeFileSync(path.join(ANCHOR_DIR, `${form}.json`), JSON.stringify({ pages: pagesMeta }));
}

function round(n) {
  return Math.round(n * 100) / 100;
}
console.log("build-templates done");
