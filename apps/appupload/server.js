import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractFromImages, normalizeRecord } from "./lib/extract.js";
import { buildPacket, fillForm, mergePdfs } from "./lib/fillForm.js";
import { extractMenu, normalizeMenu, buildCloverWorkbook } from "./lib/menu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 15;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed."));
  },
});

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

const filesToImages = (files) =>
  (files || []).map((f) => ({ data: f.buffer.toString("base64"), mediaType: f.mimetype }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    ready: Boolean(process.env.ANTHROPIC_API_KEY) || process.env.TRANSCRIBE_MOCK === "1",
    mock: process.env.TRANSCRIBE_MOCK === "1",
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
  });
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
    const { record: raw, form: formOverride, date, kind = "combined" } = req.body || {};
    if (!raw || typeof raw !== "object") return res.status(400).json({ error: "Missing record." });
    const record = normalizeRecord(raw);
    const form =
      formOverride && ["citizens", "merrick"].includes(formOverride)
        ? formOverride
        : record.appType === "merrick"
        ? "merrick"
        : record.appType === "citizens"
        ? "citizens"
        : null;

    const { applicationPdf, coversheetPdf } = await buildPacket(record, { form, date });

    let bytes;
    let name;
    if (kind === "coversheet") {
      bytes = coversheetPdf;
      name = "coversheet";
    } else if (kind === "application") {
      if (!applicationPdf) return res.status(400).json({ error: "Application type is unknown — pick Citizens or Merrick." });
      bytes = applicationPdf;
      name = `${form}-application`;
    } else {
      bytes = await mergePdfs([coversheetPdf, applicationPdf].filter(Boolean));
      name = `${form || "application"}-packet`;
    }

    const safe = (record.business.dba || name).replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safe}-${name}.pdf"`);
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
