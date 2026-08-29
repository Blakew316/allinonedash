// Headless UI smoke test: load the page, drive both flows in demo mode, capture
// console errors and screenshots.
import { chromium } from "playwright-core";

const EXEC = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = process.env.BASE || "http://localhost:3200";
const OUT = process.argv[2] || "/tmp/smoke";

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

await page.goto(BASE, { waitUntil: "networkidle" });

// A tiny 1x1 png as a fake upload for both flows.
const pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
const png = { name: "doc.png", mimeType: "image/png", buffer: Buffer.from(pngB64, "base64") };

// --- Application flow ---
await page.setInputFiles("#appFileInput", png);
await page.waitForFunction(() => !document.getElementById("extractBtn").disabled);
await page.click("#extractBtn");
await page.waitForSelector("#appReview:not(.hidden)", { timeout: 15000 });
const detected = await page.textContent("#detectBadge");
const dbaVal = await page.inputValue('[data-path="business.dba"]');
const ownerDl = await page.inputValue('[data-path="owners.0.dlNumber"]');
await page.screenshot({ path: `${OUT}-app-review.png`, fullPage: true });

// --- Menu flow ---
await page.click("#tabMenu");
await page.setInputFiles("#menuFileInput", png);
await page.waitForFunction(() => !document.getElementById("menuExtractBtn").disabled);
await page.click("#menuExtractBtn");
await page.waitForSelector("#menuReview:not(.hidden)", { timeout: 15000 });
const rowCount = await page.locator("#menuTable tbody tr").count();
await page.screenshot({ path: `${OUT}-menu-review.png`, fullPage: true });

await browser.close();
console.log("detected:", detected.trim());
console.log("dba field:", dbaVal, "| owner1 DL field:", ownerDl);
console.log("menu rows:", rowCount);
console.log("console errors:", errors.length ? errors : "none");
if (errors.length) process.exit(1);
