// Maverick merchant directory (assets/merchants.xlsx) → searchable list for the
// review form's merchant lookup. Parsed once and cached; a missing or broken
// file degrades to an empty list rather than breaking the app.
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.join(__dirname, "..", "assets", "merchants.xlsx");

let cache = null;

const cellText = (cell) => {
  let v = cell.value;
  if (v && typeof v === "object" && v.text !== undefined) v = v.text;       // hyperlink/rich text
  if (v && typeof v === "object" && v.result !== undefined) v = v.result;   // formula
  return v == null ? "" : String(v).trim();
};

export async function listMerchants() {
  if (cache) return cache;
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(XLSX_PATH);
    const ws = wb.worksheets[0];
    // Map the header row so column order in the sheet can change safely.
    const headers = {};
    ws.getRow(1).eachCell((cell, col) => { headers[cellText(cell).toLowerCase()] = col; });
    const col = (name) => headers[name] || 0;
    const out = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (name) => (col(name) ? cellText(row.getCell(col(name))) : "");
      const merchant = get("merchant");
      if (!merchant) continue;
      out.push({
        mid: get("mid"),
        merchant,
        salesRep: get("sales rep"),
        owner: get("owner"),
        phone: get("phone"),
        email: get("email"),
        equipment: get("equipment"),
        status: get("status"),
        volume: get("volume"),
      });
    }
    cache = out;
  } catch (e) {
    console.error("Merchant list unavailable:", e.message);
    cache = [];
  }
  return cache;
}
