"use strict";

const MAX_FILES = 15;
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

const el = (id) => document.getElementById(id);
const statusBanner = el("statusBanner");

function showBanner(kind, msg) {
  statusBanner.className = `banner ${kind}`;
  statusBanner.textContent = msg;
  statusBanner.classList.remove("hidden");
  statusBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
const hideBanner = () => statusBanner.classList.add("hidden");

/* ---------------- shared image handling ---------------- */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve({ dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), blob }) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/** Wire a dropzone + file input + thumbnail list into a small uploader. */
function makeUploader({ dropzone, input, browseBtn, thumbs, onChange }) {
  const pages = [];
  let nextId = 1;

  async function add(fileList) {
    const files = Array.from(fileList).filter((f) => /^image\//.test(f.type));
    for (const file of files) {
      if (pages.length >= MAX_FILES) {
        showBanner("warn", `Up to ${MAX_FILES} images.`);
        break;
      }
      try {
        const { dataUrl, blob } = await resizeImage(file);
        pages.push({ id: nextId++, dataUrl, blob });
      } catch {
        showBanner("error", `Could not read "${file.name}".`);
      }
    }
    render();
  }
  function remove(id) {
    const i = pages.findIndex((p) => p.id === id);
    if (i >= 0) pages.splice(i, 1);
    render();
  }
  function clear() {
    pages.length = 0;
    render();
  }
  function render() {
    thumbs.innerHTML = "";
    pages.forEach((p, idx) => {
      const li = document.createElement("li");
      li.className = "thumb";
      li.innerHTML = `<span class="page-badge">${idx + 1}</span><button class="remove-thumb" aria-label="Remove">×</button><img alt="upload ${idx + 1}" />`;
      li.querySelector("img").src = p.dataUrl;
      li.querySelector(".remove-thumb").addEventListener("click", () => remove(p.id));
      thumbs.appendChild(li);
    });
    onChange(pages.length);
  }

  browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    input.click();
  });
  dropzone.addEventListener("click", () => input.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", (e) => {
    add(e.target.files);
    input.value = "";
  });
  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === "dragleave" && dropzone.contains(e.relatedTarget)) return;
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => e.dataTransfer?.files?.length && add(e.dataTransfer.files));

  return { pages, clear };
}

/* ---------------- record path helpers ---------------- */
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null) o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

/* ---------------- review form schema ---------------- */
const REVIEW_SECTIONS = [
  {
    title: "Business",
    open: true,
    fields: [
      ["business.dba", "DBA / Trade name"],
      ["business.legalName", "Legal / corporate name"],
      ["business.locationAddress", "Location address"],
      ["business.locationCity", "City"],
      ["business.locationState", "State"],
      ["business.locationZip", "ZIP"],
      ["business.corpAddress", "Corporate address"],
      ["business.corpCity", "Corp city"],
      ["business.corpState", "Corp state"],
      ["business.corpZip", "Corp ZIP"],
      ["business.phone", "Phone"],
      ["business.fax", "Fax"],
      ["business.contactName", "Contact name"],
      ["business.contactPhone", "Contact phone"],
      ["business.customerServicePhone", "Customer service phone"],
      ["business.email", "Business email"],
      ["business.website", "Website"],
      ["business.federalTaxId", "Federal Tax ID"],
      ["business.taxType", "Tax type"],
      ["business.taxFilingName", "Tax filing name"],
      ["business.businessType", "Business type"],
      ["business.productsSold", "Products / services sold"],
      ["business.organizationType", "Organization type"],
      ["business.stateIssued", "State issued"],
      ["business.businessStarted", "Business started"],
      ["business.lengthOwnershipYears", "Ownership (years)"],
      ["business.lengthOwnershipMonths", "Ownership (months)"],
    ],
  },
  { title: "Banking (from voided check)", owner: null, fields: [
    ["banking.bankName", "Bank name"],
    ["banking.routing", "Routing #"],
    ["banking.account", "Account #"],
    ["banking.bankPhone", "Bank phone"],
    ["banking.accountType", "Account type", "select", ["", "checking", "savings"]],
  ]},
  { title: "Transaction", fields: [
    ["transaction.monthlyVolume", "Monthly volume ($)"],
    ["transaction.avgTicket", "Average ticket ($)"],
    ["transaction.highTicket", "High ticket ($)"],
    ["transaction.amexVolume", "Amex volume ($)"],
    ["transaction.swipePct", "Swipe %"],
    ["transaction.motoPct", "MO/TO %"],
    ["transaction.internetPct", "Internet %"],
    ["transaction.salesToConsumerPct", "Sales to consumer %"],
    ["transaction.salesToBusinessPct", "Sales to business %"],
    ["transaction.salesToGovPct", "Sales to government %"],
    ["transaction.previousProcessor", "Previous processor"],
    ["transaction.reasonForLeaving", "Reason for leaving"],
  ]},
  { title: "Fees", fields: [
    ["fees.authVmcda", "Auth Visa/MC/Disc/Amex ($)"],
    ["fees.monthlyService", "Monthly service ($)"],
    ["fees.monthlyMinimum", "Monthly minimum ($)"],
    ["fees.annual", "Annual fee ($)"],
    ["fees.chargeback", "Chargeback ($)"],
    ["fees.earlyTermination", "Early termination ($)"],
  ]},
  { title: "Sales / coversheet", fields: [
    ["sales.salesAgentName", "Sales agent / partner name"],
    ["sales.salesOffice", "Sales office / territory"],
    ["sales.salesRep", "Sales rep"],
  ]},
];

const OWNER_FIELDS = [
  ["first", "First name"],
  ["last", "Last name"],
  ["title", "Title"],
  ["ownershipPct", "Ownership %"],
  ["homeAddress", "Home address"],
  ["city", "City"],
  ["state", "State"],
  ["zip", "ZIP"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["ssn", "SSN"],
  ["dob", "Date of birth"],
  ["dlNumber", "Driver's license #"],
  ["dlState", "License state"],
  ["dlExp", "License expiration"],
];

let workingRecord = null;

function renderReviewForm(record) {
  const container = el("reviewForm");
  container.innerHTML = "";

  const makeField = (path, label, type, options) => {
    const value = getPath(record, path) ?? "";
    const wrap = document.createElement("label");
    wrap.className = "field" + (value === "" ? " empty" : "");
    const span = document.createElement("span");
    span.textContent = label;
    wrap.appendChild(span);
    let inputEl;
    if (type === "select") {
      inputEl = document.createElement("select");
      options.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = o === "" ? "—" : o;
        if (o === value) opt.selected = true;
        inputEl.appendChild(opt);
      });
    } else {
      inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.value = value;
    }
    inputEl.dataset.path = path;
    inputEl.addEventListener("input", () => wrap.classList.toggle("empty", inputEl.value === ""));
    wrap.appendChild(inputEl);
    return wrap;
  };

  const addSection = (title, fields, open) => {
    const det = document.createElement("details");
    det.className = "review-section";
    if (open) det.open = true;
    const sum = document.createElement("summary");
    sum.textContent = title;
    det.appendChild(sum);
    const body = document.createElement("div");
    body.className = "section-body";
    const row = document.createElement("div");
    row.className = "field-row";
    fields.forEach(([path, label, type, options]) => row.appendChild(makeField(path, label, type, options)));
    body.appendChild(row);
    det.appendChild(body);
    container.appendChild(det);
  };

  REVIEW_SECTIONS.forEach((s, i) => {
    if (s.title === "Banking (from voided check)") {
      // Insert owners before banking.
      [0, 1].forEach((oi) =>
        addSection(`Owner / Principal ${oi + 1}`, OWNER_FIELDS.map(([k, l]) => [`owners.${oi}.${k}`, l]), false)
      );
    }
    addSection(s.title, s.fields, s.open);
  });

  // Documents present (drive coversheet checklist).
  const det = document.createElement("details");
  det.className = "review-section";
  det.innerHTML = `<summary>Documents provided</summary>`;
  const body = document.createElement("div");
  body.className = "section-body";
  [["documents.hasVoidedCheck", "Voided check included"], ["documents.hasDriversLicense", "Driver's license included"], ["transaction.seasonal", "Seasonal merchant"]].forEach(([path, label]) => {
    const lab = document.createElement("label");
    lab.className = "field checkfield";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = Boolean(getPath(record, path));
    cb.dataset.path = path;
    cb.dataset.type = "checkbox";
    lab.appendChild(cb);
    const span = document.createElement("span");
    span.textContent = label;
    lab.appendChild(span);
    body.appendChild(lab);
  });
  det.appendChild(body);
  container.appendChild(det);
}

function collectReview() {
  el("reviewForm")
    .querySelectorAll("[data-path]")
    .forEach((inp) => {
      const path = inp.dataset.path;
      const value = inp.dataset.type === "checkbox" ? inp.checked : inp.value;
      setPath(workingRecord, path, value);
    });
  workingRecord.appType = el("appTypeSelect").value;
}

/* ---------------- application flow ---------------- */
let appUploader;

async function extractApplication() {
  if (appUploader.pages.length === 0) return;
  showSection("app", "processing");
  const form = new FormData();
  appUploader.pages.forEach((p, i) => form.append("images", p.blob, `img-${i + 1}.jpg`));
  try {
    const res = await fetch("/api/extract", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Extraction failed (${res.status}).`);
    workingRecord = data.record;
    showReview(workingRecord);
  } catch (e) {
    showSection("app", "upload");
    showBanner("error", e.message);
  }
}

function showReview(record) {
  el("appTypeSelect").value = record.appType || "unknown";
  const badge = el("detectBadge");
  const type = record.appType || "unknown";
  const conf = record.appTypeConfidence || "";
  badge.className = `detect-badge ${type}`;
  badge.textContent =
    type === "unknown" ? "Could not detect form — choose one below" : `Detected: ${type === "citizens" ? "Citizens" : "Merrick"}${conf ? ` (${conf} confidence)` : ""}`;
  renderReviewForm(record);
  showSection("app", "review");
}

async function generate(kind) {
  collectReview();
  const body = { record: workingRecord, form: el("appTypeSelect").value, date: el("coverDate").value.trim(), kind };
  try {
    const res = await fetch("/api/packet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Could not generate PDF.");
    }
    const blob = await res.blob();
    const name = (workingRecord.business?.dba || "application").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);
    triggerDownload(blob, `${name}-${kind}.pdf`);
  } catch (e) {
    showBanner("error", e.message);
  }
}

/* ---------------- menu flow ---------------- */
let menuUploader;
let menuItems = [];

async function extractMenu() {
  if (menuUploader.pages.length === 0) return;
  showSection("menu", "processing");
  const form = new FormData();
  menuUploader.pages.forEach((p, i) => form.append("images", p.blob, `menu-${i + 1}.jpg`));
  try {
    const res = await fetch("/api/menu/extract", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Menu extraction failed (${res.status}).`);
    menuItems = data.menu.items || [];
    el("restaurantName").value = data.menu.restaurantName || "";
    renderMenuTable();
    showSection("menu", "review");
  } catch (e) {
    showSection("menu", "upload");
    showBanner("error", e.message);
  }
}

function renderMenuTable() {
  const tbody = el("menuTable").querySelector("tbody");
  tbody.innerHTML = "";
  menuItems.forEach((it, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input data-k="name" value="${esc(it.name)}" /></td>
      <td class="price-col"><input data-k="price" value="${esc(it.price)}" inputmode="decimal" /></td>
      <td class="cat-col"><input data-k="category" value="${esc(it.category)}" /></td>
      <td><input data-k="description" value="${esc(it.description)}" /></td>
      <td><button class="row-del" title="Remove">×</button></td>`;
    tr.querySelectorAll("input").forEach((inp) =>
      inp.addEventListener("input", () => (menuItems[idx][inp.dataset.k] = inp.value))
    );
    tr.querySelector(".row-del").addEventListener("click", () => {
      menuItems.splice(idx, 1);
      renderMenuTable();
    });
    tbody.appendChild(tr);
  });
}

async function downloadXlsx() {
  const menu = { restaurantName: el("restaurantName").value.trim(), items: menuItems };
  try {
    const res = await fetch("/api/menu/xlsx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menu }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Could not build spreadsheet.");
    }
    const blob = await res.blob();
    const name = (menu.restaurantName || "menu").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);
    triggerDownload(blob, `${name}-clover-import.xlsx`);
  } catch (e) {
    showBanner("error", e.message);
  }
}

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showSection(mode, which) {
  if (mode === "app") {
    el("appUpload").classList.toggle("hidden", which !== "upload");
    el("appProcessing").classList.toggle("hidden", which !== "processing");
    el("appReview").classList.toggle("hidden", which !== "review");
  } else {
    el("menuUpload").classList.toggle("hidden", which !== "upload");
    el("menuProcessing").classList.toggle("hidden", which !== "processing");
    el("menuReview").classList.toggle("hidden", which !== "review");
  }
  if (which !== "review") hideBanner();
}

function switchMode(mode) {
  const isApp = mode === "app";
  el("tabApp").classList.toggle("active", isApp);
  el("tabMenu").classList.toggle("active", !isApp);
  el("tabApp").setAttribute("aria-selected", String(isApp));
  el("tabMenu").setAttribute("aria-selected", String(!isApp));
  el("appMode").classList.toggle("hidden", !isApp);
  el("menuMode").classList.toggle("hidden", isApp);
  hideBanner();
}

async function checkHealth() {
  try {
    const data = await (await fetch("/api/health")).json();
    el("modelInfo").textContent = data.mock ? "Running in demo mode." : `Powered by ${data.model}.`;
    if (!data.ready) showBanner("warn", "Not configured: set ANTHROPIC_API_KEY on the server (or TRANSCRIBE_MOCK=1 for a demo).");
    else if (data.mock) showBanner("info", "Demo mode: uploads return sample data so you can preview the workflow.");
  } catch {}
}

function init() {
  appUploader = makeUploader({
    dropzone: el("appDropzone"),
    input: el("appFileInput"),
    browseBtn: el("appBrowseBtn"),
    thumbs: el("appThumbs"),
    onChange: (n) => {
      el("extractBtn").disabled = n === 0;
      el("appClearBtn").classList.toggle("hidden", n === 0);
      if (n) hideBanner();
    },
  });
  menuUploader = makeUploader({
    dropzone: el("menuDropzone"),
    input: el("menuFileInput"),
    browseBtn: el("menuBrowseBtn"),
    thumbs: el("menuThumbs"),
    onChange: (n) => {
      el("menuExtractBtn").disabled = n === 0;
      el("menuClearBtn").classList.toggle("hidden", n === 0);
      if (n) hideBanner();
    },
  });

  el("tabApp").addEventListener("click", () => switchMode("app"));
  el("tabMenu").addEventListener("click", () => switchMode("menu"));

  el("extractBtn").addEventListener("click", extractApplication);
  el("appClearBtn").addEventListener("click", () => appUploader.clear());
  el("genPacketBtn").addEventListener("click", () => generate("combined"));
  el("genAppBtn").addEventListener("click", () => generate("application"));
  el("genCoverBtn").addEventListener("click", () => generate("coversheet"));
  el("appRestartBtn").addEventListener("click", () => {
    appUploader.clear();
    showSection("app", "upload");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  el("menuExtractBtn").addEventListener("click", extractMenu);
  el("menuClearBtn").addEventListener("click", () => menuUploader.clear());
  el("addItemBtn").addEventListener("click", () => {
    menuItems.push({ name: "", price: "", category: "", description: "" });
    renderMenuTable();
  });
  el("genXlsxBtn").addEventListener("click", downloadXlsx);
  el("menuRestartBtn").addEventListener("click", () => {
    menuUploader.clear();
    menuItems = [];
    showSection("menu", "upload");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  checkHealth();
}

document.addEventListener("DOMContentLoaded", init);
