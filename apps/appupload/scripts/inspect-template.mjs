// Extract text items + positions from a template PDF so we can build field maps.
// Usage: node scripts/inspect-template.mjs assets/templates/coversheet.pdf [page]
import fs from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const file = process.argv[2];
const onlyPage = process.argv[3] ? Number(process.argv[3]) : null;
if (!file) {
  console.error("usage: node scripts/inspect-template.mjs <pdf> [page]");
  process.exit(1);
}

const data = new Uint8Array(fs.readFileSync(file));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
console.log(`# ${file} — ${doc.numPages} page(s)`);

for (let p = 1; p <= doc.numPages; p++) {
  if (onlyPage && p !== onlyPage) continue;
  const page = await doc.getPage(p);
  const viewport = page.getViewport({ scale: 1 });
  console.log(`\n## PAGE ${p}  size=${viewport.width.toFixed(1)}x${viewport.height.toFixed(1)} (PDF points)`);
  const content = await page.getTextContent();
  const items = content.items
    .filter((it) => it.str && it.str.trim() !== "")
    .map((it) => {
      // transform = [a,b,c,d,e,f]; e,f are x,y. pdfjs y-origin is top-left in viewport space.
      const x = it.transform[4];
      const yTop = it.transform[5]; // distance from top in this build
      return { str: it.str.trim(), x: Math.round(x), yTop: Math.round(yTop) };
    })
    .sort((a, b) => a.yTop - b.yTop || a.x - b.x);
  for (const it of items) {
    console.log(`y=${String(it.yTop).padStart(4)} x=${String(it.x).padStart(4)}  ${JSON.stringify(it.str)}`);
  }
}
