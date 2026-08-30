import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFromImages, normalizeRecord } from "./lib/extract.js";
import { fillForm, mergePdfs, prepareRecord, resolveForm, hasCloverEquipment } from "./lib/fillForm.js";
import { extractMenu, normalizeMenu, buildCloverWorkbook } from "./lib/menu.js";
import { MODELS } from "./lib/pricing.js";
import { listMerchants } from "./lib/merchants.js";
import { dbEnabled, listSubmissions, listAllSubmissions, getSubmission, upsertSubmission, deleteSubmission } from "./lib/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 15;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) || file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only images (JPEG, PNG, WebP, GIF) or PDF files are allowed."));
  },
});

app.use(express.json({ limit: "8mb" }));
app.use(
  express.static(path.join(__dirname, "public"), {
    // Videos are immutable uploads — let browsers keep them for a week so the
    // backdrop rotation replays from local cache instead of re-downloading.
    setHeaders(res, filePath) {
      if (/\.(mp4|png)$/i.test(filePath)) res.setHeader("Cache-Control", "public, max-age=604800");
    },
  })
);

// Each uploaded file becomes a media item; the extractor sends images as image
// blocks and PDFs as native document blocks (Claude reads typed + scanned PDFs).
const filesToImages = (files) =>
  (files || []).map((f) => ({ data: f.buffer.toString("base64"), mediaType: f.mimetype }));

// Supabase rows use uuid ids; validate before querying so a malformed id is a clean
// 404 instead of a Postgres 22P02 → 500. `str` bounds free-text history fields.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v, max = 255) => (typeof v === "string" ? v.slice(0, max) : "");

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ready: Boolean(process.env.ANTHROPIC_API_KEY) || process.env.TRANSCRIBE_MOCK === "1",
    mock: process.env.TRANSCRIBE_MOCK === "1",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    historyBackend: dbEnabled ? "supabase" : "local",
  });
});

// Equipment model list (from the pricing matrix) for the PO equipment dropdown.
app.get("/api/equipment", (_req, res) => res.json({ models: MODELS }));

// Maverick merchant directory for the review form's merchant lookup.
app.get("/api/merchants", async (_req, res) => res.json({ merchants: await listMerchants() }));

/* ---------- Submission history (Supabase, shared across devices) ---------- */
app.get("/api/history", async (_req, res) => {
  if (!dbEnabled) return res.json({ backend: "local", items: [] });
  try {
    res.json({ backend: "supabase", items: await listSubmissions() });
  } catch (e) {
    console.error("History list failed:", e.message);
    res.status(500).json({ error: "Could not load history." });
  }
});

// Full export of all saved submissions (including data) for download.
app.get("/api/history/export", async (_req, res) => {
  if (!dbEnabled) return res.json({ backend: "local", items: [] });
  try {
    res.json({ backend: "supabase", items: await listAllSubmissions() });
  } catch (e) {
    console.error("History export failed:", e.message);
    res.status(500).json({ error: "Could not export history." });
  }
});

app.get("/api/history/:id", async (req, res) => {
  if (!dbEnabled) return res.status(404).json({ error: "History backend not configured." });
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: "Not found." });
  try {
    const record = await getSubmission(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found." });
    res.json({ record });
  } catch (e) {
    console.error("History fetch failed:", e.message);
    res.status(500).json({ error: "Could not load submission." });
  }
});

app.post("/api/history", async (req, res) => {
  if (!dbEnabled) return res.status(503).json({ error: "History backend not configured." });
  try {
    const { id, dba, appType, rep, data } = req.body || {};
    if (!data || typeof data !== "object" || Array.isArray(data)) return res.status(400).json({ error: "Missing data." });
    const savedId = await upsertSubmission({
      id: typeof id === "string" && UUID_RE.test(id) ? id : undefined,
      dba: str(dba), appType: str(appType, 32), rep: str(rep), data,
    });
    res.json({ id: savedId });
  } catch (e) {
    console.error("History save failed:", e.message);
    res.status(500).json({ error: "Could not save submission." });
  }
});

app.delete("/api/history/:id", async (req, res) => {
  if (!dbEnabled) return res.status(503).json({ error: "History backend not configured." });
  if (!UUID_RE.test(req.params.id)) return res.json({ ok: true }); // nothing to delete
  try {
    await deleteSubmission(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error("History delete failed:", e.message);
    res.status(500).json({ error: "Could not delete submission." });
  }
});

/* ---------- Merchant application: extract + fill ---------- */

// Upload the handwritten application pages + voided check + driver's license(s).
app.post("/api/extract", (req, res) => {
  upload.array("images", MAX_FILES)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const images = filesToImages(req.files);
      if (images.length === 0) return res.status(400).json({ error: "Please upload at least one image." });
      const record = await extractFromImages(images);
      res.json({ record });
    } catch (e) {
      const status = e.statusCode || 500;
      console.error("Extraction failed:", e.message);
      res.status(status).json({ error: e.message || "Extraction failed." });
    }
  });
});

// Generate a filled PDF from a (possibly user-edited) record.
// body: { record, form?, date?, kind: 'combined'|'application'|'coversheet' }
app.post("/api/packet", async (req, res) => {
  try {
    const { record: raw, form: formOverride, date, kind = "combined", kinds, signature } = req.body || {};
    if (!raw || typeof raw !== "object") return res.status(400).json({ error: "Missing record." });
    const record = normalizeRecord(raw);
    const form = resolveForm(record, formOverride);
    const base = prepareRecord(record, { date, signature });

    let bytes;
    let name;
    let labelOverride = null;
    if (Array.isArray(kinds) && kinds.length) {
      // Multi-select: build the chosen documents in a fixed order and merge into one PDF.
      const order = ["coversheet", "application", "po", "clover", "bankchange", "crf", "hempcbd", "cbdamendment", "giftcard"];
      const chosen = order.filter((k) => kinds.includes(k));
      // Never silently drop a requested document: an Application needs a known type.
      if (chosen.includes("application") && !form) {
        return res.status(400).json({ error: "Application type is unknown — pick Citizens, Merrick, FD North, or PB&T above." });
      }
      const parts = [];
      for (const k of chosen) {
        if (k === "coversheet") parts.push(await fillForm("coversheet", base));
        else if (k === "application") { if (form) parts.push(await fillForm(form, base)); }
        else if (k === "po") parts.push(await fillForm("purchase_order", base));
        else if (k === "clover") parts.push(await fillForm("clover_addendum", base));
        else if (k === "bankchange") parts.push(await fillForm("bank_change", base));
        else if (k === "crf") parts.push(await fillForm("crf", base));
        else if (k === "hempcbd") parts.push(await fillForm("hemp_cbd", base));
        else if (k === "cbdamendment") parts.push(await fillForm("cbd_amendment", base));
        else if (k === "giftcard") parts.push(await fillForm("gift_card", base));
      }
      if (!parts.length) {
        return res.status(400).json({ error: "None of the selected documents could be generated. For the Application, choose Citizens, Merrick, FD North, or PB&T above." });
      }
      bytes = parts.length === 1 ? parts[0] : await mergePdfs(parts);
      const labels = { coversheet: "Coversheet", application: "Application", po: "Purchase Order", clover: "Clover Addendum", bankchange: "Bank Account Change", crf: "Change Request", hempcbd: "Hemp & CBD Disclosure", cbdamendment: "CBD Amendment", giftcard: "Gift Card Setup" };
      labelOverride = chosen.length === 1 ? labels[chosen[0]] : "Packet";
      name = chosen.length === 1 ? chosen[0] : "packet";
    } else if (kind === "coversheet") {
      bytes = await fillForm("coversheet", base);
      name = "coversheet";
    } else if (kind === "application") {
      if (!form) return res.status(400).json({ error: "Application type is unknown — pick Citizens, Merrick, FD North, or PB&T." });
      bytes = await fillForm(form, base);
      name = `${form}-application`;
    } else if (kind === "po") {
      bytes = await fillForm("purchase_order", base);
      name = "purchase-order";
    } else if (kind === "clover") {
      bytes = await fillForm("clover_addendum", base);
      name = "clover-addendum";
    } else if (kind === "bankchange") {
      bytes = await fillForm("bank_change", base);
      name = "bank-change";
    } else if (kind === "crf") {
      bytes = await fillForm("crf", base);
      name = "change-request";
    } else if (kind === "hempcbd") {
      bytes = await fillForm("hemp_cbd", base);
      name = "hemp-cbd-disclosure";
    } else if (kind === "cbdamendment") {
      bytes = await fillForm("cbd_amendment", base);
      name = "cbd-amendment";
    } else if (kind === "giftcard") {
      bytes = await fillForm("gift_card", base);
      name = "gift-card-setup";
    } else {
      // combined packet: coversheet + application (+ Clover addendum when Clover equipment is present)
      const parts = [await fillForm("coversheet", base)];
      if (form) parts.push(await fillForm(form, base));
      if (hasCloverEquipment(record)) parts.push(await fillForm("clover_addendum", base));
      bytes = await mergePdfs(parts);
      name = `${form || "application"}-packet`;
    }

    // Lead the file name with the Doing-Business-As name so it's auto-labeled for easy finding.
    const labels = { coversheet: "Coversheet", application: "Application", po: "Purchase Order", clover: "Clover Addendum", bankchange: "Bank Account Change", crf: "Change Request", hempcbd: "Hemp & CBD Disclosure", cbdamendment: "CBD Amendment", giftcard: "Gift Card Setup", combined: "Packet" };
    const dba = (record.business.dba || record.business.legalName || "").trim();
    const safeDba = dba.replace(/[\/\\:*?"<>|\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Application";
    const fileName = `${safeDba} - ${labelOverride || labels[kind] || name}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.end(Buffer.from(bytes));
  } catch (e) {
    console.error("Packet generation failed:", e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message || "Failed to generate PDF." });
  }
});

/* ---------- Menu -> Clover ---------- */

app.post("/api/menu/extract", (req, res) => {
  upload.array("images", MAX_FILES)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const images = filesToImages(req.files);
      if (images.length === 0) return res.status(400).json({ error: "Please upload at least one menu photo." });
      const menu = await extractMenu(images);
      res.json({ menu });
    } catch (e) {
      const status = e.statusCode || 500;
      console.error("Menu extraction failed:", e.message);
      res.status(status).json({ error: e.message || "Menu extraction failed." });
    }
  });
});

app.post("/api/menu/xlsx", async (req, res) => {
  try {
    const menu = normalizeMenu(req.body?.menu || {});
    if (menu.items.length === 0) return res.status(400).json({ error: "No menu items to export." });
    const buffer = await buildCloverWorkbook(menu);
    const safe = (menu.restaurantName || "menu").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safe}-clover-import.xlsx"`);
    res.end(Buffer.from(buffer));
  } catch (e) {
    console.error("Clover workbook failed:", e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message || "Failed to build workbook." });
  }
});

app.listen(PORT, () => {
  console.log(`AppUpload running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY && process.env.TRANSCRIBE_MOCK !== "1") {
    console.warn("⚠  ANTHROPIC_API_KEY not set — set it (or TRANSCRIBE_MOCK=1) to enable extraction.");
  }
});

export { app };
