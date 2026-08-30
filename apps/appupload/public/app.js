"use strict";

const MAX_FILES = 15;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
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

/* ---------------- persistent settings / rep / history ---------------- */
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

const CFG = window.AU_CONFIG || {};
let settings = { apiKey: "", model: "", demo: false, ...store.get("au-settings-v1", {}) };
const effApiKey = () => settings.apiKey || CFG.apiKey || "";
const effModel = () => settings.model || CFG.model || "claude-sonnet-4-6";
const saveSettings = () => store.set("au-settings-v1", settings);

let customReps = store.get("au-reps-custom-v1", []);
let currentRep = store.get("au-rep-v1", "");
const allReps = () => [...new Set([...(CFG.reps || []), ...customReps])].sort((a, b) => a.localeCompare(b));

let history = store.get("au-history-v1", []);
const saveHistory = () => store.set("au-history-v1", history.slice(0, 200));

/* ---------------- document kinds (mirrors the server's /api/packet) ---------------- */
const KIND_ORDER = ["coversheet", "application", "po", "clover", "bankchange", "crf", "hempcbd", "cbdamendment", "giftcard"];
const KIND_LABELS = {
  coversheet: "Coversheet", application: "Application", po: "Purchase Order", clover: "Clover Addendum",
  bankchange: "Bank Account Change", crf: "Change Request", hempcbd: "Hemp & CBD Disclosure",
  cbdamendment: "CBD Amendment", giftcard: "Gift Card Setup", combined: "Packet",
};
const KIND_FORM = {
  coversheet: "coversheet", po: "purchase_order", clover: "clover_addendum", bankchange: "bank_change",
  crf: "crf", hempcbd: "hemp_cbd", cbdamendment: "cbd_amendment", giftcard: "gift_card",
};
const APP_FORMS = ["citizens", "merrick", "fd_north", "pbt"];
const APP_NAMES = { citizens: "Citizens", merrick: "Merrick", fd_north: "FD North", pbt: "PB&T" };

function safeDbaName(record) {
  const dba = (record.business.dba || record.business.legalName || "").trim();
  return dba.replace(/[\/\\:*?"<>|\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Application";
}

/* ---------------- shared image / PDF handling ---------------- */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(canvasToPage(img, img.width, img.height));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

function canvasToPage(source, srcW, srcH) {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(srcW, srcH));
  const width = Math.round(srcW * scale);
  const height = Math.round(srcH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { dataUrl };
}

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });

/** Thumbnail of a PDF's first page (pdf.js); falls back to a generic tile. */
async function pdfThumbnail(file) {
  try {
    if (!window.pdfjsLib) throw new Error("no pdfjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs.worker.min.js";
    const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const page = await doc.getPage(1);
    let viewport = page.getViewport({ scale: 1 });
    const scale = 300 / Math.max(viewport.width, viewport.height);
    viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    const c = document.createElement("canvas");
    c.width = 160; c.height = 200;
    const x = c.getContext("2d");
    x.fillStyle = "#fffdf8"; x.fillRect(0, 0, 160, 200);
    x.strokeStyle = "#d8d2c2"; x.strokeRect(6, 6, 148, 188);
    x.fillStyle = "#2f5d50"; x.font = "700 26px -apple-system, sans-serif";
    x.textAlign = "center"; x.fillText("PDF", 80, 108);
    return c.toDataURL("image/png");
  }
}

const pagesToApiImages = (pages) => pages.map((p) => ({ data: p.b64, mediaType: p.mediaType }));

/** Wire a dropzone + file input + thumbnail list into a small uploader. */
function makeUploader({ dropzone, input, browseBtn, thumbs, onChange }) {
  const pages = [];
  let nextId = 1;

  async function add(fileList) {
    const files = Array.from(fileList).filter((f) => /^image\//.test(f.type) || f.type === "application/pdf");
    for (const file of files) {
      if (pages.length >= MAX_FILES) {
        showBanner("warn", `Up to ${MAX_FILES} files.`);
        break;
      }
      try {
        if (file.type === "application/pdf") {
          if (file.size > MAX_PDF_BYTES) {
            showBanner("error", `"${file.name}" is over 25 MB — split or compress it.`);
            continue;
          }
          // PDFs go to the model natively (no page rasterizing); pdf.js only draws the thumbnail.
          const dataUrl = await fileToDataUrl(file);
          pages.push({ id: nextId++, dataUrl: await pdfThumbnail(file), b64: dataUrl.split(",")[1], mediaType: "application/pdf", pdf: true });
        } else {
          const { dataUrl } = await resizeImage(file);
          pages.push({ id: nextId++, dataUrl, b64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
        }
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
      li.innerHTML = `<span class="page-badge">${p.pdf ? "PDF" : idx + 1}</span><button class="remove-thumb" aria-label="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button><img alt="upload ${idx + 1}" />`;
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

/* ---------------- review form schema ----------------
   Field entry: [path, label]                      → text input
                [path, label, "select", [[v,l]…]]  → select
                [path, label, "check"]             → checkbox
                ["!", subtitle]                    → sub-heading row               */
const YN = [["", "—"], ["yes", "Yes"], ["no", "No"]];

const OWNER_FIELDS = [
  ["first", "First name"], ["last", "Last name"], ["title", "Title"], ["ownershipPct", "Ownership %"],
  ["homeAddress", "Home address"], ["city", "City"], ["state", "State"], ["zip", "ZIP"],
  ["phone", "Phone"], ["email", "Email"], ["ssn", "SSN"], ["dob", "Date of birth"],
  ["dlNumber", "Driver's license #"], ["dlState", "License state"], ["dlExp", "License expiration"],
];

function equipmentFields() {
  const out = [];
  for (let i = 0; i < 4; i++) {
    out.push(["!", `Line ${i + 1}`]);
    out.push([`equipment.${i}.type`, "Type"]);
    out.push([`equipment.${i}.model`, "Model"]);
    out.push([`equipment.${i}.quantity`, "Qty"]);
    out.push([`equipment.${i}.acquisition`, "Acquisition"]);
    out.push([`equipment.${i}.onCoversheet`, "Show on coversheet", "check"]);
  }
  return out;
}

function cbdProductFields() {
  const out = [];
  for (let i = 0; i < 10; i++) {
    out.push(["!", `Product ${i + 1}`]);
    out.push([`cbd.products.${i}.name`, "Product name"]);
    out.push([`cbd.products.${i}.distributor`, "Distributor"]);
    out.push([`cbd.products.${i}.state`, "State"]);
  }
  return out;
}

function giftCardFields() {
  const out = [
    ["giftCard.appKind", "Application type", "select", [["", "—"], ["new", "New location"], ["outlet", "Additional outlet"], ["entitle", "Entitlement only"]]],
    ["giftCard.tieTo", "Tie to (chain / group)"],
    ["giftCard.resubmission", "Resubmission", "check"],
    ["giftCard.additionalInfo", "Additional info attached", "check"],
    ["giftCard.numLocations", "# locations"],
    ["giftCard.merchantProcessingNum", "Merchant processing #"],
    ["giftCard.giftCardMerchantNum", "Gift card merchant #"],
    ["giftCard.chain", "Chain"],
    ["giftCard.omahaMerchantNum", "Omaha merchant #"],
    ["giftCard.mcc", "MCC"],
    ["!", "Fees"],
    ["giftCard.setUpFee", "Set-up fee ($)"],
    ["giftCard.addlLocFee", "Add'l location fee ($)"],
    ["giftCard.activationFee", "Activation fee ($)"],
    ["giftCard.redemptionFee", "Redemption fee ($)"],
    ["giftCard.reloadFee", "Reload fee ($)"],
    ["giftCard.voidFee", "Void fee ($)"],
    ["giftCard.balanceFee", "Balance inquiry fee ($)"],
    ["giftCard.otherFee", "Other fee ($)"],
    ["giftCard.monthlyMinFee", "Monthly minimum ($)"],
    ["giftCard.monthlyFee", "Monthly fee ($)"],
  ];
  for (let i = 0; i < 3; i++) {
    out.push(["!", `Equipment ${i + 1}`]);
    out.push([`giftCard.eq.${i}.qty`, "Qty"]);
    out.push([`giftCard.eq.${i}.terminalType`, "Terminal type"]);
    out.push([`giftCard.eq.${i}.bizType`, "Business type"]);
    out.push([`giftCard.eq.${i}.model`, "Model"]);
    out.push([`giftCard.eq.${i}.serial`, "Serial #"]);
  }
  for (let i = 0; i < 2; i++) {
    out.push(["!", `Additional location ${i + 1}`]);
    out.push([`giftCard.locations.${i}.dba`, "DBA"]);
    out.push([`giftCard.locations.${i}.street`, "Street"]);
    out.push([`giftCard.locations.${i}.city`, "City"]);
    out.push([`giftCard.locations.${i}.state`, "State"]);
    out.push([`giftCard.locations.${i}.zip`, "ZIP"]);
    out.push([`giftCard.locations.${i}.phone`, "Phone"]);
    out.push([`giftCard.locations.${i}.fax`, "Fax"]);
    out.push([`giftCard.locations.${i}.contact`, "Contact"]);
    out.push([`giftCard.locations.${i}.positionTitle`, "Position / title"]);
    out.push([`giftCard.locations.${i}.email`, "Email"]);
    out.push([`giftCard.locations.${i}.processingNum`, "Processing #"]);
  }
  out.push(["!", "Affiliate / bank"]);
  out.push(["giftCard.affBank", "Bank"]);
  out.push(["giftCard.affMerchantId", "Merchant ID"]);
  out.push(["giftCard.affAltId", "Alternate ID"]);
  out.push(["giftCard.affExistingNum", "Existing gift card #"]);
  out.push(["giftCard.affPromoNumber", "Promo #"]);
  return out;
}

const REVIEW_SECTIONS = [
  {
    key: "business", title: "Business", open: true,
    fields: [
      ["business.dba", "DBA / Trade name"], ["business.legalName", "Legal / corporate name"],
      ["business.locationAddress", "Location address"], ["business.locationCity", "City"],
      ["business.locationState", "State"], ["business.locationZip", "ZIP"],
      ["business.corpAddress", "Corporate address"], ["business.corpCity", "Corp city"],
      ["business.corpState", "Corp state"], ["business.corpZip", "Corp ZIP"],
      ["business.phone", "Phone"], ["business.fax", "Fax"],
      ["business.contactName", "Contact name"], ["business.contactPhone", "Contact phone"],
      ["business.customerServicePhone", "Customer service phone"], ["business.email", "Business email"],
      ["business.website", "Website"], ["business.federalTaxId", "Federal Tax ID"],
      ["business.taxType", "Tax type"], ["business.taxFilingName", "Tax filing name"],
      ["business.dnb", "D&B / DUNS #"], ["business.businessType", "Business type"],
      ["business.productsSold", "Products / services sold"], ["business.organizationType", "Organization type"],
      ["business.stateIssued", "State issued"], ["business.businessStarted", "Business started"],
      ["business.lengthOwnershipYears", "Ownership (years)"], ["business.lengthOwnershipMonths", "Ownership (months)"],
    ],
  },
  { key: "owner1", title: "Owner / Principal 1", fields: OWNER_FIELDS.map(([k, l]) => [`owners.0.${k}`, l]) },
  { key: "owner2", title: "Owner / Principal 2", fields: OWNER_FIELDS.map(([k, l]) => [`owners.1.${k}`, l]) },
  {
    key: "banking", title: "Banking (from voided check)",
    fields: [
      ["banking.bankName", "Bank name"], ["banking.routing", "Routing #"], ["banking.account", "Account #"],
      ["banking.bankPhone", "Bank phone"],
      ["banking.accountType", "Account type", "select", [["", "—"], ["checking", "Checking"], ["savings", "Savings"]]],
    ],
  },
  {
    key: "transaction", title: "Transaction profile",
    fields: [
      ["transaction.monthlyVolume", "Monthly volume ($)"], ["transaction.avgTicket", "Average ticket ($)"],
      ["transaction.highTicket", "High ticket ($)"], ["transaction.amexVolume", "Amex volume ($)"],
      ["transaction.swipePct", "Swipe %"], ["transaction.motoPct", "MO/TO %"], ["transaction.internetPct", "Internet %"],
      ["transaction.salesToConsumerPct", "Sales to consumer %"], ["transaction.salesToBusinessPct", "Sales to business %"],
      ["transaction.salesToGovPct", "Sales to government %"], ["transaction.previousProcessor", "Previous processor"],
      ["transaction.reasonForLeaving", "Reason for leaving"], ["transaction.seasonal", "Seasonal merchant", "check"],
    ],
  },
  {
    key: "serviceAcceptance", title: "Card acceptance & rates",
    fields: [
      ["serviceAcceptance.cardVisaCredit", "Visa credit", "check"], ["serviceAcceptance.cardVisaDebit", "Visa debit", "check"],
      ["serviceAcceptance.cardMcCredit", "Mastercard credit", "check"], ["serviceAcceptance.cardMcDebit", "Mastercard debit", "check"],
      ["serviceAcceptance.cardDiscover", "Discover", "check"], ["serviceAcceptance.cardAmex", "American Express", "check"],
      ["serviceAcceptance.cardPin", "PIN debit", "check"], ["serviceAcceptance.cardEbt", "EBT", "check"],
      ["serviceAcceptance.discountPlan", "Discount plan", "select", [["", "—"], ["flat", "Flat rate"], ["passthrough", "Pass-through"]]],
      ["serviceAcceptance.flatCreditPct", "Flat credit %"], ["serviceAcceptance.flatDebitPct", "Flat debit %"],
      ["serviceAcceptance.flatAmexPct", "Flat Amex %"], ["serviceAcceptance.passCreditPct", "Pass-through credit %"],
      ["serviceAcceptance.passDebitPct", "Pass-through debit %"], ["serviceAcceptance.passAmexPct", "Pass-through Amex %"],
      ["serviceAcceptance.assessments", "Assessments", "select", [["", "—"], ["included", "Included"], ["billed", "Billed"]]],
      ["serviceAcceptance.paymentMethod", "Discount paid", "select", [["", "—"], ["daily", "Daily"], ["monthly", "Monthly"]]],
    ],
  },
  {
    key: "fees", title: "Fee schedule",
    fields: [
      ["!", "Authorization"],
      ["fees.authVmcda", "Auth V/MC/Disc ($)"], ["fees.fleet", "Fleet auth ($)"], ["fees.pinDebit", "PIN debit auth ($)"],
      ["fees.pinDebitPct", "PIN debit %"], ["fees.ebt", "EBT auth ($)"], ["fees.salesTxn", "Sales transaction ($)"],
      ["fees.electronicAvs", "Electronic AVS ($)"], ["fees.voiceAuth", "Voice auth ($)"], ["fees.voiceAvs", "Voice AVS ($)"],
      ["!", "Monthly"],
      ["fees.monthlyService", "Monthly service ($)"], ["fees.monthlyMinimum", "Monthly minimum ($)"],
      ["fees.wireless", "Wireless ($/mo)"], ["fees.pinDebitMonthly", "PIN debit monthly ($)"],
      ["fees.industryCompliance", "Industry compliance ($)"],
      ["!", "Miscellaneous"],
      ["fees.chargeback", "Chargeback ($)"], ["fees.retrieval", "Retrieval ($)"], ["fees.achReject", "ACH reject ($)"],
      ["fees.annual", "Annual fee ($)"], ["fees.batch", "Batch ($)"], ["fees.returnTxn", "Return transaction ($)"],
      ["fees.equipmentRental", "Equipment rental ($/mo)"], ["fees.monthToBill", "Month to bill"],
      ["fees.earlyTermination", "Early termination ($)"],
      ["!", "Merrick only"],
      ["fees.basilPos", "Basil POS ($)"], ["fees.saasFee", "SaaS fee ($)"], ["fees.inactivityFee", "Inactivity fee ($)"],
      ["fees.gatewayMonthly", "Gateway monthly ($)"], ["fees.gatewayTxn", "Gateway per-txn ($)"], ["fees.monthlyMisc", "Monthly misc ($)"],
    ],
  },
  {
    key: "signatures", title: "Signatures",
    fields: [
      ["signatures.printedName", "Printed name"], ["signatures.title", "Title"], ["signatures.date", "Date"],
      ["signatures.printedName2", "Printed name 2"], ["signatures.title2", "Title 2"], ["signatures.date2", "Date 2"],
    ],
  },
  { key: "equipment", title: "Equipment", fields: equipmentFields() },
  {
    key: "coversheet", title: "Coversheet (Required Set Up Form)",
    fields: [
      ["coversheet.territoryManager", "Territory manager"], ["coversheet.teamColor", "Team color"],
      ["coversheet.telemarketing", "Telemarketing", "check"], ["coversheet.reBoard", "Re-board", "check"],
      ["coversheet.docPictures", "Pictures included", "check"], ["coversheet.docStatements", "Statements included", "check"],
      ["coversheet.platform", "Platform", "select", [["", "—"], ["tsys", "TSYS"], ["fdomaha", "FD Omaha"], ["fdnorth", "FD North"], ["other", "Other"]]],
      ["coversheet.platformOther", "Platform (other)"],
      ["coversheet.etf", "ETF ($)"], ["coversheet.annualFee", "Annual fee ($)"],
      ["coversheet.monthlyMin", "Monthly minimum ($)"], ["coversheet.svcFee", "Service fee ($)"],
      ["coversheet.cashDiscount", "Cash discount", "check"], ["coversheet.cashDiscountTerminalRate", "Cash discount terminal %"],
      ["coversheet.bypassFee", "Bypass fee", "check"],
      ["coversheet.shipping", "Ship to", "select", [["", "—"], ["dba", "DBA"], ["agent", "Agent"], ["other", "Other"]]],
      ["coversheet.shippingOther", "Ship to (other)"],
      ["coversheet.vasGiftCards", "VAS: gift cards", "check"], ["coversheet.vasCheckServices", "VAS: check services", "check"],
      ["coversheet.vasWpiRewards", "VAS: WPI rewards", "check"], ["coversheet.vasCustomerConnect", "VAS: customer connect", "check"],
      ["coversheet.fbAppType", "App type", "select", [["", "—"], ["retail", "Retail"], ["restaurant", "Restaurant"], ["ecommerce", "E-commerce"], ["moto", "MO/TO"]]],
      ["coversheet.fbConnection", "Connection", "select", [["", "—"], ["ethernet", "Ethernet"], ["dial", "Dial"], ["wifi", "Wi-Fi"], ["wireless", "Wireless"]]],
      ["coversheet.enPinDebit", "Enable PIN debit", "check"], ["coversheet.enEbt", "Enable EBT", "check"],
      ["coversheet.enWex", "Enable WEX", "check"], ["coversheet.fnsNumber", "FNS #"],
      ["coversheet.autoClose", "Auto close", "check"], ["coversheet.autoCloseTime", "Auto close time"],
      ["coversheet.timezone", "Timezone", "select", [["", "—"], ["pst", "PST"], ["mst", "MST"], ["cst", "CST"], ["est", "EST"]]],
      ["coversheet.tips", "Tips", "select", [["", "—"], ["none", "None"], ["tipline", "Tip line"], ["tipprompt", "Tip prompt"]]],
      ["coversheet.serverNumbers", "Server numbers", "check"], ["coversheet.avsCvv", "AVS / CVV", "check"],
      ["coversheet.invoiceNumber", "Invoice number", "check"], ["coversheet.specialOther", "Special instructions"],
      ["coversheet.notes", "Notes"],
    ],
  },
  {
    key: "po", title: "Purchase Order",
    fields: [
      ["po.mid", "MID"], ["po.team", "Team"], ["po.salesManager", "Sales manager"], ["po.billTo", "Bill to"],
      ["po.shipTo", "Ship to", "select", [["", "—"], ["dba", "DBA"], ["rep", "Rep"], ["other", "Other"]]],
      ["po.shAttention", "Attention"], ["po.shipStreet", "Ship street"], ["po.shipCity", "Ship city"],
      ["po.shipState", "Ship state"], ["po.shipZip", "Ship ZIP"], ["po.shippingMethod", "Shipping method"],
      ["po.payPlan", "Pay plan"], ["po.billingType", "Billing type"], ["po.shCost", "S&H cost ($)"],
      ["po.salesTax", "Sales tax ($)"], ["po.frontendPlatform", "Front-end platform"],
    ],
  },
  {
    key: "bankChange", title: "Bank Account Change",
    fields: [
      ["bankChange.merchantId", "Merchant ID"],
      ["!", "Funding account"],
      ["bankChange.fundBankName", "Bank name"], ["bankChange.fundRouting", "Routing #"], ["bankChange.fundAccount", "Account #"],
      ["!", "Billing account"],
      ["bankChange.billBankName", "Bank name"], ["bankChange.billRouting", "Routing #"], ["bankChange.billAccount", "Account #"],
      ["!", "Address & documents"],
      ["bankChange.addrMatchesFile", "Address matches file", "check"], ["bankChange.addrChangeLegal", "Change legal address", "check"],
      ["bankChange.addrChangeDba", "Change DBA address", "check"], ["bankChange.settleChargebacksToFunding", "Settle chargebacks to funding", "check"],
      ["bankChange.docVoidedCheck", "Voided check attached", "check"], ["bankChange.docBankLetter", "Bank letter attached", "check"],
      ["bankChange.docBankStatement", "Bank statement attached", "check"],
    ],
  },
  {
    key: "crf", title: "Change Request Form",
    fields: [
      ["crf.merchantId", "Merchant ID"], ["crf.ownerName", "Owner name"], ["crf.dba", "DBA"], ["crf.legalName", "Legal name"],
      ["crf.dbaName", "New DBA name"], ["crf.legalAddress", "New legal address"], ["crf.dbaAddress", "New DBA address"],
      ["crf.emailAddress", "New email"], ["crf.dbaPhone", "New phone"], ["crf.dbaFax", "New fax"], ["crf.website", "New website"],
      ["!", "Rate & service changes"],
      ["crf.amexOptBluePlan", "Amex OptBlue plan"], ["crf.amexOptBlueRate", "Amex OptBlue rate"], ["crf.amexDirectSe", "Amex direct SE #"],
      ["crf.addDiscover", "Add Discover", "check"], ["crf.pinDebitDiscount", "PIN debit discount", "check"], ["crf.pinDebitRate", "PIN debit rate"],
      ["crf.ebtFns", "EBT FNS #"], ["crf.ebtFee", "EBT fee"], ["crf.addCashBenefits", "Add cash benefits", "check"],
      ["crf.myMerchantBenefits", "My Merchant Benefits", "check"], ["crf.myMerchantBenefitsRate", "MMB rate"],
      ["crf.vmdDiscount", "V/M/D discount", "check"], ["crf.vmdNewRate", "V/M/D new rate"],
      ["crf.checkCardDiscount", "Check card discount", "check"], ["crf.checkCardRate", "Check card rate"],
      ["crf.other1", "Other change 1"], ["crf.other1Rate", "Rate 1"], ["crf.other2", "Other change 2"], ["crf.other2Rate", "Rate 2"],
      ["crf.notes", "Notes"],
    ],
  },
  {
    key: "cbd", title: "Hemp & CBD Disclosure",
    fields: [
      ["cbd.agreementDate", "Agreement date"], ["cbd.stateHempLicense", "State hemp license #"],
      ["cbd.growsHemp", "Grows hemp", "select", YN], ["cbd.manufacturesHemp", "Manufactures hemp products", "select", YN],
      ["cbd.advertisesHemp", "Advertises hemp products", "select", YN],
      ...cbdProductFields(),
    ],
  },
  { key: "giftCard", title: "Gift Card Setup", fields: giftCardFields() },
  {
    key: "sales", title: "Sales",
    fields: [
      ["sales.salesAgentName", "Sales agent / partner name"], ["sales.salesOffice", "Sales office / territory"],
      ["sales.salesRep", "Sales rep"],
    ],
  },
  {
    key: "documents", title: "Documents provided",
    fields: [
      ["documents.hasVoidedCheck", "Voided check included", "check"],
      ["documents.hasDriversLicense", "Driver's license included", "check"],
    ],
  },
];

/* Merchant-ID fields get the merchant directory datalist. */
const MERCHANT_FIELDS = new Set(["po.mid", "bankChange.merchantId", "crf.merchantId", "giftCard.merchantProcessingNum", "giftCard.affMerchantId"]);

let workingRecord = null;
let signatureData = "";

function renderReviewForm(record) {
  const container = el("reviewForm");
  container.innerHTML = "";

  const makeField = (path, label, type, options) => {
    if (path === "!") {
      const h = document.createElement("div");
      h.className = "sub-head";
      h.textContent = label;
      return h;
    }
    const value = getPath(record, path) ?? "";
    const wrap = document.createElement("label");
    let inputEl;
    if (type === "check") {
      wrap.className = "field checkfield";
      inputEl = document.createElement("input");
      inputEl.type = "checkbox";
      inputEl.checked = Boolean(value);
      inputEl.dataset.type = "checkbox";
      inputEl.dataset.path = path;
      wrap.appendChild(inputEl);
      const span = document.createElement("span");
      span.textContent = label;
      wrap.appendChild(span);
      return wrap;
    }
    wrap.className = "field" + (value === "" ? " empty" : "");
    const span = document.createElement("span");
    span.textContent = label;
    wrap.appendChild(span);
    if (type === "select") {
      inputEl = document.createElement("select");
      options.forEach(([v, l]) => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = l;
        if (v === String(value)) opt.selected = true;
        inputEl.appendChild(opt);
      });
    } else {
      inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.value = value;
      if (MERCHANT_FIELDS.has(path)) inputEl.setAttribute("list", "merchantList");
    }
    inputEl.dataset.path = path;
    inputEl.addEventListener("input", () => wrap.classList.toggle("empty", inputEl.value === ""));
    wrap.appendChild(inputEl);
    return wrap;
  };

  REVIEW_SECTIONS.forEach((s) => {
    const det = document.createElement("details");
    det.className = "review-section";
    det.dataset.sec = s.key;
    if (s.open) det.open = true;
    const sum = document.createElement("summary");
    sum.textContent = s.title;
    det.appendChild(sum);
    const body = document.createElement("div");
    body.className = "section-body";
    const row = document.createElement("div");
    row.className = "field-row";
    s.fields.forEach(([path, label, type, options]) => row.appendChild(makeField(path, label, type, options)));
    body.appendChild(row);
    det.appendChild(body);
    container.appendChild(det);
  });
}

function openSection(key) {
  const det = el("reviewForm").querySelector(`[data-sec="${key}"]`);
  if (det) det.open = true;
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
  applyRep(workingRecord);
}

function applyRep(record) {
  if (!currentRep) return;
  record.sales = record.sales || {};
  if (!record.sales.salesAgentName) record.sales.salesAgentName = currentRep;
  if (!record.sales.salesRep) record.sales.salesRep = currentRep;
}

/* ---------------- kinds checkboxes ---------------- */
const checkedKinds = () =>
  Array.from(document.querySelectorAll("#kindRow input[type=checkbox]:checked")).map((c) => c.value);

function setKinds(kinds) {
  document.querySelectorAll("#kindRow input[type=checkbox]").forEach((c) => {
    c.checked = kinds.includes(c.value);
  });
}

/* ---------------- application flow ---------------- */
let appUploader;

async function extractApplication() {
  if (appUploader.pages.length === 0) return;
  if (!settings.demo && !effApiKey()) {
    showBanner("warn", "Add your Anthropic API key in Settings, or turn on demo mode, to read documents.");
    openSettings();
    return;
  }
  showSection("app", "processing");
  try {
    const record = await AUPipeline.extractFromImages(pagesToApiImages(appUploader.pages), {
      apiKey: effApiKey(),
      model: effModel(),
      mock: settings.demo,
    });
    workingRecord = record;
    applyRep(workingRecord);
    // Default document selection mirrors the server's combined packet.
    const kinds = ["coversheet"];
    if (APP_FORMS.includes(record.appType)) kinds.push("application");
    if (AUPipeline.hasCloverEquipment(record)) kinds.push("clover");
    showReview(workingRecord);
    setKinds(kinds);
  } catch (e) {
    showSection("app", "upload");
    showBanner("error", e.message);
  }
}

function showReview(record) {
  el("appTypeSelect").value = APP_FORMS.includes(record.appType) ? record.appType : "unknown";
  const badge = el("detectBadge");
  const type = record.appType || "unknown";
  const conf = record.appTypeConfidence || "";
  badge.className = `detect-badge ${APP_FORMS.includes(type) ? type : "unknown"}`;
  badge.textContent =
    APP_FORMS.includes(type)
      ? `Detected: ${APP_NAMES[type]}${conf ? ` (${conf} confidence)` : ""}`
      : "Could not detect form — choose one below";
  renderReviewForm(record);
  updateSigButton();
  showSection("app", "review");
}

/** Manual path: open a blank form of the chosen type — no photos needed. */
function openManualForm(choice) {
  if (!choice) return;
  const isApp = APP_FORMS.includes(choice);
  workingRecord = AUPipeline.normalizeRecord({ appType: isApp ? choice : "unknown" });
  applyRep(workingRecord);
  signatureData = "";
  const badge = el("detectBadge");
  badge.className = "detect-badge manual";
  const title = isApp ? `${APP_NAMES[choice]} application` : (AUPipeline.TEMPLATES[choice]?.label || choice);
  badge.textContent = `Manual entry — ${title}`;
  el("appTypeSelect").value = isApp ? choice : "unknown";
  renderReviewForm(workingRecord);
  updateSigButton();

  let kinds = ["coversheet"];
  let section = "business";
  if (isApp) kinds = ["coversheet", "application"];
  else if (choice === "coversheet") { kinds = ["coversheet"]; section = "coversheet"; }
  else {
    const kind = Object.keys(KIND_FORM).find((k) => KIND_FORM[k] === choice);
    if (kind) kinds = [kind];
    section = { purchase_order: "po", clover_addendum: "equipment", bank_change: "bankChange", crf: "crf", hemp_cbd: "cbd", cbd_amendment: "cbd", gift_card: "giftCard" }[choice] || "business";
  }
  setKinds(kinds);
  openSection(section);
  switchMode("app");
  showSection("app", "review");
  el("manualFormSelect").value = "";
}

/** Build one merged PDF for the chosen kinds — same order/rules as the live server. */
async function buildKindsPdf(record, chosen, formChoice, date, signature) {
  const form = AUPipeline.resolveForm(record, formChoice);
  if (chosen.includes("application") && !form) {
    throw new Error("Application type is unknown — pick Citizens, Merrick, FD North, or PB&T above.");
  }
  const base = AUPipeline.prepareRecord(record, { date, signature });
  const parts = [];
  for (const k of chosen) {
    if (k === "application") {
      if (form) parts.push(await AUPipeline.fillForm(form, base));
    } else {
      parts.push(await AUPipeline.fillForm(KIND_FORM[k], base));
    }
  }
  if (!parts.length) {
    throw new Error("None of the selected documents could be generated. For the Application, choose Citizens, Merrick, FD North, or PB&T above.");
  }
  const bytes = parts.length === 1 ? parts[0] : await AUPipeline.mergePdfs(parts);
  return { bytes, form };
}

let generating = false;
async function generate(mode) {
  if (generating || !workingRecord) return;
  collectReview();
  const formChoice = el("appTypeSelect").value;
  const date = el("coverDate").value.trim();
  const record = AUPipeline.normalizeRecord(workingRecord);

  let chosen;
  if (mode === "combined") {
    const form = AUPipeline.resolveForm(record, formChoice);
    chosen = ["coversheet"];
    if (form) chosen.push("application");
    if (AUPipeline.hasCloverEquipment(record)) chosen.push("clover");
  } else {
    chosen = KIND_ORDER.filter((k) => checkedKinds().includes(k));
    if (!chosen.length) {
      showBanner("warn", "Tick at least one document to generate.");
      return;
    }
  }

  generating = true;
  const btns = [el("genSelectedBtn"), el("genPacketBtn")];
  btns.forEach((b) => { b.disabled = true; });
  const orig = el("genSelectedBtn").textContent;
  el("genSelectedBtn").textContent = "Generating…";
  try {
    const { bytes, form } = await buildKindsPdf(record, chosen, formChoice, date, signatureData);
    const label = mode === "combined" ? KIND_LABELS.combined : chosen.length === 1 ? KIND_LABELS[chosen[0]] : "Packet";
    const fileName = `${safeDbaName(record)} - ${label}.pdf`;
    triggerDownload(new Blob([bytes], { type: "application/pdf" }), fileName);
    addHistory({
      type: "packet",
      kinds: chosen,
      form: form || "",
      business: record.business.dba || record.business.legalName || "Untitled application",
      rep: currentRep || record.sales.salesRep || record.sales.salesAgentName || "",
      record,
      date,
      signature: signatureData || "",
      label,
    });
    hideBanner();
  } catch (e) {
    showBanner("error", e.message);
  } finally {
    generating = false;
    btns.forEach((b) => { b.disabled = false; });
    el("genSelectedBtn").textContent = orig;
  }
}

/* ---------------- signature pad ---------------- */
let sigCtx = null;
let sigHasInk = false;

function openSigPad() {
  const modal = el("sigModal");
  modal.classList.remove("hidden");
  const canvas = el("sigCanvas");
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.min(560, canvas.parentElement.clientWidth - 4);
  const cssH = 190;
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  sigCtx = canvas.getContext("2d");
  sigCtx.scale(dpr, dpr);
  sigCtx.lineWidth = 2.4;
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";
  sigCtx.strokeStyle = "#152a6e";
  sigHasInk = false;

  let drawing = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.onpointerdown = (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    const p = pos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(p.x, p.y);
    sigCtx.lineTo(p.x + 0.01, p.y + 0.01);
    sigCtx.stroke();
    sigHasInk = true;
  };
  canvas.onpointermove = (e) => {
    if (!drawing) return;
    const p = pos(e);
    sigCtx.lineTo(p.x, p.y);
    sigCtx.stroke();
  };
  canvas.onpointerup = canvas.onpointercancel = () => { drawing = false; };
}
function closeSigPad() {
  el("sigModal").classList.add("hidden");
}
function clearSigPad() {
  const canvas = el("sigCanvas");
  sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  sigHasInk = false;
}
function saveSigPad() {
  if (!sigHasInk) { closeSigPad(); return; }
  signatureData = el("sigCanvas").toDataURL("image/png");
  updateSigButton();
  closeSigPad();
}
function removeSignature() {
  signatureData = "";
  updateSigButton();
}
function updateSigButton() {
  const btn = el("sigBtn");
  const clr = el("sigClearBtn");
  if (signatureData) {
    btn.textContent = "Signed — change";
    btn.classList.add("signed");
    clr.classList.remove("hidden");
  } else {
    btn.textContent = "Sign now";
    btn.classList.remove("signed");
    clr.classList.add("hidden");
  }
}

/* ---------------- menu flow ---------------- */
let menuUploader;
let menuItems = [];

async function extractMenuFlow() {
  if (menuUploader.pages.length === 0) return;
  if (!settings.demo && !effApiKey()) {
    showBanner("warn", "Add your Anthropic API key in Settings, or turn on demo mode, to read menus.");
    openSettings();
    return;
  }
  showSection("menu", "processing");
  try {
    const menu = await AUPipeline.extractMenu(pagesToApiImages(menuUploader.pages), {
      apiKey: effApiKey(),
      model: effModel(),
      mock: settings.demo,
    });
    menuItems = menu.items || [];
    el("restaurantName").value = menu.restaurantName || "";
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
      <td><button class="row-del" title="Remove" aria-label="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-0.15em"><path d="M5 5l14 14M19 5 5 19"/></svg></button></td>`;
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
  const menu = AUPipeline.normalizeMenu({ restaurantName: el("restaurantName").value.trim(), items: menuItems });
  if (menu.items.length === 0) return showBanner("error", "No menu items to export.");
  try {
    const buffer = await AUPipeline.buildCloverWorkbook(menu);
    const name = (menu.restaurantName || "menu").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);
    triggerDownload(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${name}-clover-import.xlsx`
    );
    addHistory({
      type: "menu",
      business: menu.restaurantName || "Untitled menu",
      rep: currentRep || "",
      menu,
    });
  } catch (e) {
    showBanner("error", e.message);
  }
}

/* ---------------- past uploads & downloads ---------------- */
function addHistory(entry) {
  history.unshift({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), ts: Date.now(), ...entry });
  history = history.slice(0, 200);
  saveHistory();
  renderHistory();
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function historyLabel(h) {
  if (h.type === "menu") return "Menu → Clover";
  const doc = h.label || (Array.isArray(h.kinds) && h.kinds.length === 1 ? KIND_LABELS[h.kinds[0]] : "Packet");
  const formName = APP_NAMES[h.form];
  return formName && (h.kinds || []).includes("application") ? `${formName} · ${doc}` : doc;
}

function renderHistory() {
  const list = el("histList");
  const q = el("histSearch").value.trim().toLowerCase();
  const rep = el("histRep").value;

  const reps = [...new Set(history.map((h) => h.rep).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const sel = el("histRep");
  const cur = sel.value;
  sel.innerHTML = `<option value="">All reps</option>` + reps.map((r) => `<option${r === cur ? " selected" : ""}>${esc2(r)}</option>`).join("");

  const rows = history.filter((h) => {
    if (rep && h.rep !== rep) return false;
    if (q && !(`${h.business} ${historyLabel(h)} ${h.rep}`.toLowerCase().includes(q))) return false;
    return true;
  });

  list.innerHTML = "";
  el("histEmpty").classList.toggle("hidden", rows.length > 0 || history.length > 0);
  el("histNoMatch").classList.toggle("hidden", !(rows.length === 0 && history.length > 0));

  rows.forEach((h) => {
    const li = document.createElement("li");
    li.className = "hist-row";
    li.innerHTML = `
      <button class="hist-main" title="Reopen">
        <span class="hist-name">${esc2(h.business)}</span>
        <span class="hist-meta">${esc2(historyLabel(h))}${h.rep ? " · " + esc2(h.rep) : ""} · ${fmtDate(h.ts)}</span>
      </button>
      <span class="hist-actions">
        <button class="hist-dl" title="Download again" aria-label="Download again"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M4.5 20h15"/></svg></button>
        <button class="hist-del" title="Delete" aria-label="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button>
      </span>`;
    li.querySelector(".hist-main").addEventListener("click", () => reopenHistory(h));
    li.querySelector(".hist-dl").addEventListener("click", () => redownloadHistory(h));
    li.querySelector(".hist-del").addEventListener("click", () => {
      history = history.filter((x) => x.id !== h.id);
      saveHistory();
      renderHistory();
    });
    list.appendChild(li);
  });
}

function reopenHistory(h) {
  if (h.type === "menu") {
    menuItems = (h.menu.items || []).map((it) => ({ ...it }));
    el("restaurantName").value = h.menu.restaurantName || "";
    renderMenuTable();
    switchMode("menu");
    showSection("menu", "review");
  } else {
    workingRecord = AUPipeline.normalizeRecord(JSON.parse(JSON.stringify(h.record)));
    el("coverDate").value = h.date || "";
    signatureData = h.signature || "";
    showReview(workingRecord);
    setKinds(Array.isArray(h.kinds) && h.kinds.length ? h.kinds : ["coversheet"]);
    switchMode("app");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function redownloadHistory(h) {
  try {
    if (h.type === "menu") {
      const buffer = await AUPipeline.buildCloverWorkbook(AUPipeline.normalizeMenu(h.menu));
      const name = (h.menu.restaurantName || "menu").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 50);
      triggerDownload(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}-clover-import.xlsx`);
    } else {
      const record = AUPipeline.normalizeRecord(h.record);
      const chosen = KIND_ORDER.filter((k) => (Array.isArray(h.kinds) && h.kinds.length ? h.kinds : ["coversheet"]).includes(k));
      const { bytes } = await buildKindsPdf(record, chosen, h.form || record.appType, h.date || "", h.signature || "");
      const label = h.label || (chosen.length === 1 ? KIND_LABELS[chosen[0]] : "Packet");
      triggerDownload(new Blob([bytes], { type: "application/pdf" }), `${safeDbaName(record)} - ${label}.pdf`);
    }
  } catch (e) {
    showBanner("error", e.message);
  }
}

function exportHistory() {
  if (history.length === 0) return;
  triggerDownload(new Blob([JSON.stringify(history, null, 2)], { type: "application/json" }), "appupload-history.json");
}

function clearHistory() {
  if (!history.length) return;
  if (!confirm("Clear all past uploads & downloads on this device?")) return;
  history = [];
  saveHistory();
  renderHistory();
}

/* ---------------- sales rep picker ---------------- */
function renderReps() {
  const sel = el("repSelect");
  sel.innerHTML =
    `<option value="">Select rep…</option>` +
    allReps().map((r) => `<option${r === currentRep ? " selected" : ""}>${esc2(r)}</option>`).join("") +
    `<option value="__add">+ Add rep…</option>`;
}

function onRepChange() {
  const v = el("repSelect").value;
  if (v === "__add") {
    const name = (prompt("New rep name:") || "").trim();
    if (name && !allReps().includes(name)) {
      customReps.push(name);
      store.set("au-reps-custom-v1", customReps);
    }
    currentRep = name || currentRep;
  } else {
    currentRep = v;
  }
  store.set("au-rep-v1", currentRep);
  renderReps();
}

/* ---------------- merchant directory ---------------- */
async function loadMerchantList() {
  try {
    const merchants = await AUPipeline.listMerchants();
    const dl = el("merchantList");
    dl.innerHTML = merchants
      .slice(0, 2000)
      .map((m) => `<option value="${esc(m.mid)}">${esc2(m.dba)}</option>`)
      .join("");
  } catch {}
}

/* ---------------- settings ---------------- */
function openSettings() {
  el("setKey").value = settings.apiKey || "";
  el("setModel").value = settings.model || "";
  el("setDemo").checked = Boolean(settings.demo);
  el("settingsModal").classList.remove("hidden");
  el("setKey").focus();
}
function closeSettings() {
  el("settingsModal").classList.add("hidden");
}
function saveSettingsFromModal() {
  settings.apiKey = el("setKey").value.trim();
  settings.model = el("setModel").value.trim();
  settings.demo = el("setDemo").checked;
  saveSettings();
  closeSettings();
  updateStatusLine();
  hideBanner();
}

function updateStatusLine() {
  const info = el("modelInfo");
  if (settings.demo) {
    info.textContent = "Demo mode — uploads return sample data so you can preview the whole workflow.";
  } else if (effApiKey()) {
    info.textContent = `Powered by ${effModel()}. Your key is saved in this browser and never expires.`;
  } else {
    info.textContent = "Add your Anthropic API key in Settings (saved permanently in this browser), or turn on demo mode.";
  }
}

/* ---------------- helpers ---------------- */
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function esc2(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  el("genSelectedBtn").addEventListener("click", () => generate("selected"));
  el("genPacketBtn").addEventListener("click", () => generate("combined"));
  el("appRestartBtn").addEventListener("click", () => {
    appUploader.clear();
    signatureData = "";
    showSection("app", "upload");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  el("menuExtractBtn").addEventListener("click", extractMenuFlow);
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

  /* rep picker, manual form, history, settings, signature */
  renderReps();
  el("repSelect").addEventListener("change", onRepChange);
  el("manualFormSelect").addEventListener("change", (e) => openManualForm(e.target.value));
  el("histSearch").addEventListener("input", renderHistory);
  el("histRep").addEventListener("change", renderHistory);
  el("histExport").addEventListener("click", exportHistory);
  el("histClear").addEventListener("click", clearHistory);
  renderHistory();

  el("settingsBtn").addEventListener("click", openSettings);
  el("setSave").addEventListener("click", saveSettingsFromModal);
  el("setCancel").addEventListener("click", closeSettings);
  el("settingsModal").addEventListener("click", (e) => {
    if (e.target === el("settingsModal")) closeSettings();
  });
  el("setKeyToggle").addEventListener("click", () => {
    const k = el("setKey");
    k.type = k.type === "password" ? "text" : "password";
  });

  el("sigBtn").addEventListener("click", openSigPad);
  el("sigClearBtn").addEventListener("click", removeSignature);
  el("sigSave").addEventListener("click", saveSigPad);
  el("sigClear").addEventListener("click", clearSigPad);
  el("sigCancel").addEventListener("click", closeSigPad);
  el("sigModal").addEventListener("click", (e) => {
    if (e.target === el("sigModal")) closeSigPad();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!el("settingsModal").classList.contains("hidden")) closeSettings();
    if (!el("sigModal").classList.contains("hidden")) closeSigPad();
  });

  loadMerchantList();
  updateStatusLine();
  if (settings.demo) showBanner("info", "Demo mode: uploads return sample data so you can preview the workflow. Turn it off in Settings when your API key is saved.");
}

document.addEventListener("DOMContentLoaded", init);
