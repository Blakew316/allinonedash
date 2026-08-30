/* =========================================================
   Resume reader — extracts name, email, and phone number
   from a PDF resume using pdf.js (vendored, works offline).
   Heuristics: the name is usually the largest text near the
   top of page 1; email/phone are matched by pattern anywhere
   on the first two pages. Extracted values are always shown
   for confirmation before saving.
   ========================================================= */

const WPQResume = (() => {
  const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const PHONE_RE = /(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}(?!\d)/;

  const NON_NAME_WORDS = /\b(resume|curriculum|vitae|objective|summary|profile|experience|education|skills|references|address|street|ave|avenue|blvd|suite|linkedin|github|www|http)\b/i;

  function configureWorker() {
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js";
    }
  }

  /** Groups positioned text items into visual lines (top-to-bottom). */
  function itemsToLines(textContent) {
    const rows = [];
    for (const item of textContent.items) {
      const str = (item.str || "").trim();
      if (!str) continue;
      const y = item.transform[5];
      const size = Math.hypot(item.transform[0], item.transform[1]) || 0;
      let row = rows.find((r) => Math.abs(r.y - y) < 4);
      if (!row) {
        row = { y, parts: [], size: 0 };
        rows.push(row);
      }
      row.parts.push({ x: item.transform[4], str });
      row.size = Math.max(row.size, size);
    }
    rows.sort((a, b) => b.y - a.y); // PDF y-axis points up
    return rows.map((r) => ({
      text: r.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" ").replace(/\s+/g, " ").trim(),
      size: r.size,
    }));
  }

  function looksLikeName(text) {
    if (!text || text.length > 44) return false;
    if (/[@\d]/.test(text)) return false;
    if (NON_NAME_WORDS.test(text)) return false;
    const words = text.replace(/[,.]/g, "").split(/\s+/);
    if (words.length < 2 || words.length > 5) return false;
    return words.every((w) => /^[A-ZÀ-Ž][A-Za-zÀ-ž'’.\-]*$/.test(w) || /^[A-Z]{2,}$/.test(w));
  }

  function titleCase(s) {
    return s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function pickName(lines) {
    const top = lines.slice(0, 12);
    const candidates = top.filter((l) => looksLikeName(l.text));
    if (!candidates.length) return "";
    // prefer the largest-font candidate (resume headers are big)
    candidates.sort((a, b) => b.size - a.size);
    const name = candidates[0].text.replace(/[,.]+$/, "");
    return /^[A-Z\s'.\-]+$/.test(name) ? titleCase(name) : name;
  }

  function formatPhone(raw) {
    const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return raw.trim();
  }

  /**
   * Parses a resume PDF File and resolves {name, email, phone}.
   * Missing fields come back as "" — never rejects for missing
   * data, only for unreadable files.
   */
  async function parse(file) {
    if (!window.pdfjsLib) {
      throw new Error("PDF reader isn't loaded yet — check your connection and try again.");
    }
    configureWorker();

    const data = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;

    let lines = [];
    let fullText = "";
    const pageCount = Math.min(pdf.numPages, 2);
    for (let p = 1; p <= pageCount; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const pageLines = itemsToLines(content);
      if (p === 1) lines = pageLines;
      fullText += pageLines.map((l) => l.text).join("\n") + "\n";
    }

    const emailMatch = fullText.match(EMAIL_RE);
    const phoneMatch = fullText.match(PHONE_RE);
    let name = pickName(lines);

    // fallback: derive a readable name from the email's local part
    if (!name && emailMatch) {
      const local = emailMatch[0].split("@")[0].replace(/\d+/g, "");
      const parts = local.split(/[._\-]+/).filter(Boolean);
      if (parts.length) name = titleCase(parts.join(" "));
    }

    return {
      name: name || "",
      email: emailMatch ? emailMatch[0] : "",
      phone: phoneMatch ? formatPhone(phoneMatch[0]) : "",
    };
  }

  return { parse };
})();
