import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ANCHOR_DIR = path.join(ROOT, "assets", "anchors");
const RENDER_DIR = path.join(ROOT, "assets", "rendered");
const TEMPLATE_DIR = path.join(ROOT, "assets", "templates");

export const TEMPLATES = {
  citizens: { file: "citizens.pdf", pages: 3, label: "Citizens Bank — Merchant Processing Application" },
  merrick: { file: "merrick.pdf", pages: 2, label: "Merrick Bank — Merchant Application" },
  coversheet: { file: "coversheet.pdf", pages: 1, label: "Wholesale Payments — Required Set Up Form" },
};

const cache = new Map(); // form -> { pages: [{ width, height, items }] }

export function templatePath(form) {
  const t = TEMPLATES[form];
  if (!t) throw new Error(`Unknown template: ${form}`);
  return path.join(TEMPLATE_DIR, t.file);
}
export function templateBytes(form) {
  return fs.readFileSync(templatePath(form));
}

export function renderedPagePath(form, page) {
  return path.join(RENDER_DIR, `${form}-p${page}.png`);
}
export function renderedPageBytes(form, page) {
  return fs.readFileSync(renderedPagePath(form, page));
}

/** Load prebuilt anchor data (see scripts/build-templates.mjs). */
export function loadAnchors(form) {
  if (cache.has(form)) return cache.get(form);
  const file = path.join(ANCHOR_DIR, `${form}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing anchor data for "${form}". Run: npm run build:templates`);
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  cache.set(form, data);
  return data;
}

const norm = (s) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Find a label on a page.
 * @returns {{x,y,w,h,x2}|null}
 */
export function findLabel(anchors, q) {
  const page = anchors.pages[(q.page || 1) - 1];
  if (!page) return null;
  const needle = norm(q.text);
  const matches = page.items.filter((it) => {
    const s = norm(it.str);
    const hit = q.exact ? s === needle : s.includes(needle);
    if (!hit) return false;
    if (q.region) {
      const r = q.region;
      if (r.xMin != null && it.x < r.xMin) return false;
      if (r.xMax != null && it.x > r.xMax) return false;
      if (r.yMin != null && it.y < r.yMin) return false;
      if (r.yMax != null && it.y > r.yMax) return false;
    }
    return true;
  });
  matches.sort((a, b) => b.y - a.y || a.x - b.x); // reading order: top first, then left
  const m = matches[q.occ || 0];
  if (!m) return null;
  return { x: m.x, y: m.y, w: m.w, h: m.h, x2: m.x + m.w };
}
