// Deep audit: for every form, (1) statically verify each populated field
// resolves to a real anchor on the right page, (2) render the real filled PDF
// to PNG, (3) check combined-packet composition.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { loadAnchors, findLabel, renderedPagePath } from "../lib/anchors.js";
import { FORM_MAPS } from "../lib/formMaps.js";
import { fillForm, computePlacements, prepareRecord, resolveForm, hasCloverEquipment, mergePdfs } from "../lib/fillForm.js";
import { normalizeRecord } from "../lib/extract.js";

process.env.TRANSCRIBE_MOCK = "1";
const { extractFromImages } = await import("../lib/extract.js");

const OUT = process.argv[2] || "/tmp/claude-0/-home-user-appupload/c0b67aaa-9174-5d7c-983b-6c815ec096e7/scratchpad/audit";
const safe = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
// Helvetica-ish measure for fit decisions (mirrors pdf-lib metrics closely enough).
const measureCtx = createCanvas(10, 10).getContext("2d");
const measure = (text, size) => { measureCtx.font = `${size}px Helvetica, Arial, sans-serif`; return measureCtx.measureText(text).width; };

// --- realistic, fully-populated record ---
let rec = normalizeRecord(await extractFromImages([{ data: "x", mediaType: "image/png" }]));
rec.po = {
  mid: "887700123456", team: "Maverick Blue", billTo: "Merchant", shipTo: "dba",
  shippingMethod: "ground", billingType: "ach", shCost: "25", salesTax: "30.50",
  payPlan: "4pay", frontendPlatform: "omaha", salesManager: "", shAttention: "",
};
const base = prepareRecord(rec, { date: "06/28/2026" });
const coverBase = { ...base, _appLabel: "Application: Citizens Bank (Priority Payment Systems)", _bankShort: "Citizens" };

const recordFor = (form) => (form === "coversheet" ? coverBase : base);

// Draw the real computed placements onto each page background (reliable text
// rendering, unlike rasterizing pdf-lib base-14 fonts through pdfjs).
async function renderForm(form, record, prefix) {
  const anchors = loadAnchors(form);
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
      ctx.fillText(it.text, it.x * scale, (height - it.y) * scale);
    }
    fs.writeFileSync(`${OUT}/${prefix}-p${p + 1}.png`, canvas.toBuffer("image/png"));
  }
  return anchors.pages.length;
}

const FORMS = ["citizens", "merrick", "coversheet", "purchase_order", "clover_addendum"];
let totalMissing = 0;

for (const form of FORMS) {
  const r = recordFor(form);
  const anchors = loadAnchors(form);
  const map = FORM_MAPS[form];
  const misses = [];
  let populatedText = 0, populatedCheck = 0;

  for (const spec of map.text || []) {
    const v = safe(spec.get(r));
    if (!v) continue;
    populatedText++;
    const a = findLabel(anchors, { page: spec.page, text: spec.text, occ: spec.occ, region: spec.region, exact: spec.exact });
    if (!a) misses.push(`TEXT  p${spec.page} "${spec.text}" value="${v.slice(0, 24)}"`);
  }
  for (const spec of map.check || []) {
    if (!spec.on(r)) continue;
    populatedCheck++;
    const a = findLabel(anchors, { page: spec.page, text: spec.text, occ: spec.occ, region: spec.region, exact: spec.exact });
    if (!a) misses.push(`CHECK p${spec.page} "${spec.text}"`);
  }

  const placements = computePlacements(form, r, measure);
  await fillForm(form, r); // verify the real generator runs without error
  const pages = await renderForm(form, r, form);

  console.log(`\n=== ${form} ===`);
  console.log(`  pages: ${pages} | populated text: ${populatedText}, checks: ${populatedCheck} | placements drawn: ${placements.length}`);
  const perPage = {};
  placements.forEach((p) => (perPage[p.page] = (perPage[p.page] || 0) + 1));
  console.log(`  placements/page: ${JSON.stringify(perPage)}`);
  if (misses.length) {
    totalMissing += misses.length;
    console.log(`  ⚠ MISSING ANCHORS (${misses.length}):`);
    misses.forEach((m) => console.log(`     - ${m}`));
  } else {
    console.log(`  ✓ every populated field resolved to an anchor`);
  }
}

// --- packet composition (count pages via pdf-lib; no font raster needed) ---
console.log(`\n=== packet composition ===`);
const { PDFDocument } = await import("pdf-lib");
const countPages = async (bytes) => (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
const cz = [await fillForm("coversheet", coverBase), await fillForm("citizens", base)];
if (hasCloverEquipment(rec)) cz.push(await fillForm("clover_addendum", base));
console.log(`  citizens packet pages: ${await countPages(await mergePdfs(cz))} (expected 5 = cover 1 + citizens 3 + clover 1)`);

const merBase = prepareRecord(normalizeRecord({ ...rec, appType: "merrick" }), { date: "06/28/2026" });
const mer = [await fillForm("coversheet", coverBase), await fillForm("merrick", merBase)];
if (hasCloverEquipment(rec)) mer.push(await fillForm("clover_addendum", merBase));
console.log(`  merrick packet pages: ${await countPages(await mergePdfs(mer))} (expected 4 = cover 1 + merrick 2 + clover 1)`);

console.log(`\nresolveForm: citizens->${resolveForm({ appType: "citizens" })}, merrick->${resolveForm({ appType: "merrick" })}, unknown->${resolveForm({ appType: "unknown" })}`);
console.log(`hasCloverEquipment(mock): ${hasCloverEquipment(rec)} (mock has Clover Flex)`);
console.log(`\nTOTAL MISSING ANCHORS ACROSS ALL FORMS: ${totalMissing}`);
console.log("images written to", OUT);
