import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, "..", "assets", "templates", "clover_menu_template.xlsx");
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const MENU_TOOL = {
  name: "menu_items",
  description: "Structured menu extracted from photos of a restaurant menu, for import into Clover.",
  input_schema: {
    type: "object",
    properties: {
      restaurantName: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Item name as printed" },
            description: { type: "string", description: "Item description, if shown" },
            price: { type: "string", description: "Price, digits only e.g. 12.99 (no $). Empty if market/variable." },
            category: { type: "string", description: "The menu section/category this item appears under" },
            alternateName: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
    required: ["items"],
  },
};

const SYSTEM_PROMPT = `You are an expert at reading restaurant menus from photos and converting them into a \
clean item list for a point-of-sale system (Clover).

Rules:
- Extract EVERY distinct menu item you can see across all images.
- For each item capture: name, price (digits only, no currency symbol), a short description if one is printed,
  and the category/section it appears under (use the menu's own section headers, e.g. Appetizers, Entrees, Drinks).
- Do NOT invent items, prices, or categories. If a price is "market" or missing, leave price empty.
- If the same item has multiple sizes/prices, create one row per size and put the size in the name
  (e.g. "House Salad (Small)", "House Salad (Large)").
- Preserve the menu's spelling.
Return the result ONLY by calling the menu_items tool.`;

export async function extractMenu(images, opts = {}) {
  if (!Array.isArray(images) || images.length === 0) throw new Error("No images provided.");

  if (process.env.TRANSCRIBE_MOCK === "1") return normalizeMenu(mockMenu());

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("ANTHROPIC_API_KEY is not set. Add it to your environment to enable menu extraction.");
    err.statusCode = 503;
    throw err;
  }
  const client = new Anthropic({ apiKey });
  const model = opts.model || DEFAULT_MODEL;

  const content = [];
  images.forEach((img, i) => {
    if (!ALLOWED_MEDIA.has(img.mediaType)) {
      const err = new Error(`Unsupported image type: ${img.mediaType}`);
      err.statusCode = 415;
      throw err;
    }
    content.push({ type: "text", text: `Menu image ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  });
  content.push({ type: "text", text: "Extract the full menu by calling the menu_items tool." });

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [MENU_TOOL],
    tool_choice: { type: "tool", name: MENU_TOOL.name },
    messages: [{ role: "user", content }],
  });
  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === MENU_TOOL.name);
  if (!toolUse) throw new Error("The model did not return menu data.");
  return normalizeMenu(toolUse.input);
}

export function normalizeMenu(raw = {}) {
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    restaurantName: raw.restaurantName || "",
    items: items
      .filter((it) => it && it.name && String(it.name).trim())
      .map((it) => ({
        name: String(it.name).trim(),
        description: (it.description || "").toString().trim(),
        price: cleanPrice(it.price),
        category: (it.category || "").toString().trim(),
        alternateName: (it.alternateName || "").toString().trim(),
      })),
  };
}

function cleanPrice(p) {
  if (p == null) return "";
  const m = String(p).replace(/[^0-9.]/g, "");
  return m;
}

/**
 * Fill the Clover inventory template's Items + Categories sheets and return xlsx bytes.
 * Preserves the rest of the template (instructions, modifier groups, tax rates).
 */
export async function buildCloverWorkbook(menu) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);

  // Map header name -> column index on the Items sheet (robust to column reordering).
  const items = wb.getWorksheet("Items");
  const headerRow = items.getRow(1);
  const col = {};
  headerRow.eachCell({ includeEmpty: true }, (cell, c) => {
    const key = String(cell.value || "").trim();
    if (key && !(key in col)) col[key] = c;
  });

  let r = 2;
  for (const it of menu.items) {
    const row = items.getRow(r++);
    if (col["Name"]) row.getCell(col["Name"]).value = it.name;
    if (col["Alternate Name"] && it.alternateName) row.getCell(col["Alternate Name"]).value = it.alternateName;
    if (col["Description"] && it.description) row.getCell(col["Description"]).value = it.description;
    if (col["Price"] && it.price !== "") {
      const num = Number(it.price);
      row.getCell(col["Price"]).value = Number.isFinite(num) ? num : it.price;
    }
    if (col["Categories"] && it.category) row.getCell(col["Categories"]).value = it.category;
    row.commit();
  }

  // Unique categories -> Categories sheet.
  const catSheet = wb.getWorksheet("Categories");
  if (catSheet) {
    const catHeader = catSheet.getRow(1);
    const catCol = {};
    catHeader.eachCell({ includeEmpty: true }, (cell, c) => {
      const key = String(cell.value || "").trim();
      if (key && !(key in catCol)) catCol[key] = c;
    });
    const cats = [...new Set(menu.items.map((it) => it.category).filter(Boolean))];
    let cr = 2;
    for (const name of cats) {
      const row = catSheet.getRow(cr++);
      if (catCol["Category Name"]) row.getCell(catCol["Category Name"]).value = name;
      row.commit();
    }
  }

  return wb.xlsx.writeBuffer();
}

function mockMenu() {
  return {
    restaurantName: "Sunrise Cafe",
    items: [
      { name: "Avocado Toast", description: "Sourdough, smashed avocado, chili flakes", price: "9.50", category: "Breakfast" },
      { name: "Two Egg Plate", description: "Eggs any style, toast, home fries", price: "8.95", category: "Breakfast" },
      { name: "Cappuccino", description: "", price: "4.25", category: "Drinks" },
      { name: "Cold Brew", description: "16oz", price: "4.75", category: "Drinks" },
      { name: "Turkey Club", description: "Triple decker, fries", price: "12.50", category: "Lunch" },
      { name: "Garden Salad", description: "Mixed greens, house vinaigrette", price: "7.00", category: "Lunch" },
    ],
  };
}
