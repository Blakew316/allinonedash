import Anthropic from "@anthropic-ai/sdk";
import { friendlyApiError } from "./apiError.js";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const ownerSchema = {
  type: "object",
  properties: {
    first: { type: "string" },
    last: { type: "string" },
    title: { type: "string", description: "Job title / role, e.g. Owner, President" },
    ownershipPct: { type: "string", description: "Ownership percentage, digits only e.g. 100" },
    homeAddress: { type: "string" },
    city: { type: "string" },
    state: { type: "string" },
    zip: { type: "string" },
    phone: { type: "string" },
    email: { type: "string" },
    ssn: { type: "string", description: "Social Security Number from the handwritten application" },
    dob: { type: "string", description: "Date of birth, MM/DD/YYYY" },
    dlNumber: { type: "string", description: "Driver's license number (from the license image if provided)" },
    dlState: { type: "string", description: "Driver's license issuing state" },
    dlExp: { type: "string", description: "Driver's license expiration date" },
  },
};

export const EXTRACTION_TOOL = {
  name: "merchant_application",
  description: "Structured data extracted from a handwritten merchant processing application and its supporting documents.",
  input_schema: {
    type: "object",
    properties: {
      appType: {
        type: "string",
        enum: ["citizens", "merrick", "fd_north", "pbt", "unknown"],
        description:
          "Which application template this is. 'citizens' and 'fd_north' share the same Priority 'Merchant Processing Application and Agreement' 3-page layout (numbered sections 1-10) — tell them apart by the member bank in the footer/confirmation page: 'citizens' mentions Citizens Bank, N.A., Providence RI (form code 59495v1 / PPS2301); 'fd_north' mentions Synovus Bank, Columbus GA (form code PRTH0125WP). 'merrick' = 'Merchant Application and Agreement' mentioning Merrick Bank / Woodbury NY. 'pbt' = the 6-page Priority 'Merchant Processing Application and Agreement' (Page 1 of 6, form code PPS0622v3) with the PB&T Bank logo, mentioning The Pueblo Bank and Trust Company / PB&T Bank, Pueblo CO. 'unknown' if it cannot be determined.",
      },
      appTypeConfidence: { type: "string", enum: ["high", "medium", "low"] },
      documents: {
        type: "object",
        description: "Which supporting documents were present among the uploaded images.",
        properties: {
          hasVoidedCheck: { type: "boolean" },
          hasDriversLicense: { type: "boolean" },
          pageCount: { type: "integer", description: "Number of application pages detected" },
        },
      },
      business: {
        type: "object",
        properties: {
          dba: { type: "string", description: "Doing-Business-As / merchant trade name" },
          legalName: { type: "string", description: "Corporate / legal name" },
          locationAddress: { type: "string" },
          locationCity: { type: "string" },
          locationState: { type: "string" },
          locationZip: { type: "string" },
          corpAddress: { type: "string" },
          corpCity: { type: "string" },
          corpState: { type: "string" },
          corpZip: { type: "string" },
          phone: { type: "string" },
          fax: { type: "string" },
          contactName: { type: "string" },
          contactPhone: { type: "string" },
          customerServicePhone: { type: "string" },
          email: { type: "string" },
          website: { type: "string" },
          federalTaxId: { type: "string" },
          taxType: { type: "string" },
          taxFilingName: { type: "string" },
          dnb: { type: "string", description: "D&B number" },
          businessType: { type: "string" },
          productsSold: { type: "string" },
          organizationType: {
            type: "string",
            description: "One of: Sole Prop, Partnership, LLC, Corporation, C Corp, S Corp, Non-Profit, Government",
          },
          stateIssued: { type: "string", description: "State where the entity is registered" },
          businessStarted: { type: "string" },
          lengthOwnershipYears: { type: "string" },
          lengthOwnershipMonths: { type: "string" },
        },
      },
      owners: { type: "array", items: ownerSchema, maxItems: 2 },
      banking: {
        type: "object",
        description: "Deposit account. Prefer the voided check image for bankName/routing/account when present.",
        properties: {
          bankName: { type: "string" },
          routing: { type: "string", description: "9-digit ABA routing number (from the check MICR line)" },
          account: { type: "string", description: "Bank account / DDA number (from the check MICR line)" },
          bankPhone: { type: "string" },
          accountType: { type: "string", enum: ["checking", "savings", ""] },
        },
      },
      transaction: {
        type: "object",
        properties: {
          monthlyVolume: { type: "string", description: "Requested monthly card volume, digits" },
          avgTicket: { type: "string" },
          highTicket: { type: "string" },
          amexVolume: { type: "string" },
          swipePct: { type: "string" },
          motoPct: { type: "string" },
          internetPct: { type: "string" },
          salesToConsumerPct: { type: "string" },
          salesToBusinessPct: { type: "string" },
          salesToGovPct: { type: "string" },
          previousProcessor: { type: "string" },
          reasonForLeaving: { type: "string" },
          seasonal: { type: "boolean" },
        },
      },
      fees: {
        type: "object",
        description: "Negotiated fees written on the application (digits/amounts only, no $).",
        properties: {
          authVmcda: { type: "string", description: "Visa/MC/Disc/Amex authorization fee" },
          fleet: { type: "string", description: "Fleet card fee" },
          pinDebit: { type: "string", description: "Pin Debit fee" },
          pinDebitPct: { type: "string", description: "Pin Debit percentage" },
          ebt: { type: "string" },
          salesTxn: { type: "string", description: "Sales transaction fee" },
          monthlyService: { type: "string" },
          monthlyMinimum: { type: "string" },
          wireless: { type: "string", description: "Wireless fee" },
          pinDebitMonthly: { type: "string" },
          industryCompliance: { type: "string" },
          chargeback: { type: "string" },
          retrieval: { type: "string" },
          achReject: { type: "string", description: "ACH reject fee" },
          annual: { type: "string", description: "Annual fee" },
          batch: { type: "string", description: "Batch fee" },
          returnTxn: { type: "string", description: "Return transaction fee" },
          electronicAvs: { type: "string", description: "Electronic AVS fee — Merrick only (preprinted $0.05 on Citizens/FD North; ignore there)" },
          voiceAuth: { type: "string", description: "Voice Authorization fee — Merrick only (preprinted on Citizens/FD North; ignore there)" },
          voiceAvs: { type: "string", description: "Voice AVS fee — Merrick only (preprinted on Citizens/FD North; ignore there)" },
          equipmentRental: { type: "string", description: "Equipment monthly rental" },
          monthToBill: { type: "string", description: "Month to bill (the annual fee billing month)" },
          earlyTermination: { type: "string", description: "Early termination fee (ETF)" },
          basilPos: { type: "string", description: "Merrick only" },
          saasFee: { type: "string", description: "Merrick only" },
          inactivityFee: { type: "string", description: "Merrick only" },
          gatewayMonthly: { type: "string", description: "Merrick only" },
          gatewayTxn: { type: "string", description: "Merrick only" },
          monthlyMisc: { type: "string", description: "Merrick: monthly miscellaneous" },
        },
      },
      serviceAcceptance: {
        type: "object",
        description: "The Service Acceptance & Fee Schedule section of the application.",
        properties: {
          cardVisaCredit: { type: "boolean" },
          cardVisaDebit: { type: "boolean" },
          cardMcCredit: { type: "boolean", description: "Mastercard credit" },
          cardMcDebit: { type: "boolean", description: "Mastercard debit" },
          cardDiscover: { type: "boolean" },
          cardAmex: { type: "boolean", description: "Amex credit / American Express" },
          cardPin: { type: "boolean", description: "Pin credit / pin debit card type" },
          cardEbt: { type: "boolean", description: "EBT card type (Merrick)" },
          discountPlan: { type: "string", enum: ["flat", "passthrough", ""], description: "Which discount rate plan is checked" },
          flatCreditPct: { type: "string", description: "Flat rate credit %, digits only" },
          flatDebitPct: { type: "string" },
          flatAmexPct: { type: "string" },
          passCreditPct: { type: "string", description: "Passthrough IC credit %, digits only" },
          passDebitPct: { type: "string" },
          passAmexPct: { type: "string" },
          assessments: { type: "string", enum: ["included", "billed", ""], description: "Assessments & brand fees" },
          paymentMethod: { type: "string", enum: ["daily", "monthly", ""], description: "Requested discount payment method" },
        },
      },
      equipment: {
        type: "array",
        description: "Equipment listed on the application (terminal/software model + quantity). Up to 3.",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            type: { type: "string", description: "e.g. Terminal, Software, Pin Pad, Gateway" },
            model: { type: "string", description: "Model / name" },
            quantity: { type: "string" },
          },
        },
      },
      signatures: {
        type: "object",
        description: "Printed names, titles and dates handwritten on the signature pages (NOT the signature itself). Leave blank if not filled in.",
        properties: {
          printedName: { type: "string", description: "Printed name of the first principal/signer" },
          title: { type: "string", description: "Title of the first signer" },
          date: { type: "string", description: "Date next to the first signer" },
          printedName2: { type: "string", description: "Printed name of the second signer, if any" },
          title2: { type: "string" },
          date2: { type: "string" },
        },
      },
      sales: {
        type: "object",
        properties: {
          salesRep: { type: "string" },
          salesOffice: { type: "string" },
          salesAgentName: { type: "string" },
        },
      },
      notes: { type: "string", description: "Anything written that doesn't fit a field, or legibility caveats." },
    },
    required: ["appType", "business", "owners", "banking"],
  },
};

const SYSTEM_PROMPT = `You are an expert at reading photographs of handwritten merchant payment-processing \
applications and the supporting documents that accompany them (a voided check and one or more driver's \
licenses). You convert what is handwritten/printed into accurate structured data.

You will receive several images. They may include:
- one or more pages of a handwritten merchant application (the Citizens/Priority form, the FD North/Synovus form — same Priority layout, Synovus Bank in the footer — the Merrick form, or the 6-page PB&T Bank/Priority form from Pueblo CO),
- a voided check,
- a driver's license for one or more of the owners.

Rules for filling the structured data:
1. Detect which application template it is (appType) from its title, bank name, and layout.
2. Read EVERY handwritten value carefully. Transcribe exactly what is written; do not invent values.
   If a field is blank or unreadable, leave it as an empty string.
3. SOURCING — use the most authoritative source for each field:
   - Owner identity (first/last name, home address, city/state/zip, date of birth, driver's license number,
     license state, license expiration): take from the DRIVER'S LICENSE image when one is provided, matching
     the license to the correct owner by name. Take SSN, title, ownership %, phone and email from the application.
   - Banking (bank name, routing number, account number): take from the VOIDED CHECK when provided. The routing
     number is the 9 digits in the MICR line; the account number follows it. Otherwise use the application.
   - All other fields: from the handwritten application.
4. Normalize: amounts/percentages as digits only (no $ or %). Dates as written.
5. Set documents.hasVoidedCheck / documents.hasDriversLicense based on what you actually saw.
6. FEES: read the "Service Acceptance and Fee Schedule" and "Authorization, Monthly & Miscellaneous Fees"
   sections and fill every fee that has a handwritten amount. On the Citizens/FD North forms, ignore preprinted
   amounts (e.g. Electronic AVS $0.05, Batch Fee $0.20, Voice Auth $1.00) unless the agent wrote a different
   value; on the Merrick form those cells are blank, so capture handwritten Electronic AVS / Voice Authorization /
   Voice AVS / Batch / Return Transaction amounts when present.
7. SERVICE ACCEPTANCE: set the card-type booleans for each box that is checked, the discount plan (flat or
   passthrough) and its credit/debit/amex percentages, the assessments option, and the payment method.
8. EQUIPMENT: list each terminal/software/equipment line with its model and quantity.
9. SIGNATURES: if the signature pages have handwritten PRINTED names, titles or dates, capture them; never
   transcribe the cursive signature itself. Leave blank if the pages are unsigned.

Return your result ONLY by calling the merchant_application tool.`;

export async function extractFromImages(images, opts = {}) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("No images provided.");
  }

  if (process.env.TRANSCRIBE_MOCK === "1") {
    return normalizeRecord(mockRecord());
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment (see .env.example) to enable extraction."
    );
    err.statusCode = 503;
    throw err;
  }

  const client = new Anthropic({ apiKey: apiKey.trim() });
  const model = opts.model || DEFAULT_MODEL;

  const content = [];
  images.forEach((img, i) => {
    if (img.mediaType === "application/pdf") {
      // Claude reads PDFs natively (typed text + scanned pages) — no rendering needed.
      content.push({ type: "text", text: `File ${i + 1} (PDF):` });
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: img.data } });
    } else if (ALLOWED_MEDIA.has(img.mediaType)) {
      content.push({ type: "text", text: `Image ${i + 1}:` });
      content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
    } else {
      const err = new Error(`Unsupported file type: ${img.mediaType}`);
      err.statusCode = 415;
      throw err;
    }
  });
  content.push({
    type: "text",
    text: "Extract the merchant application data from the files above by calling the merchant_application tool.",
  });

  let message;
  try {
    message = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    throw friendlyApiError(e);
  }

  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === EXTRACTION_TOOL.name);
  if (!toolUse) throw new Error("The model did not return structured data.");
  return normalizeRecord(toolUse.input);
}

/** Ensure the record has every section/field so downstream code can rely on the shape. */
export function normalizeRecord(raw = {}) {
  const r = raw || {};
  const owners = Array.isArray(r.owners) ? r.owners : [];
  const out = {
    appType: ["citizens", "merrick", "fd_north", "pbt"].includes(r.appType) ? r.appType : "unknown",
    appTypeConfidence: r.appTypeConfidence || "low",
    documents: {
      hasVoidedCheck: Boolean(r.documents?.hasVoidedCheck),
      hasDriversLicense: Boolean(r.documents?.hasDriversLicense),
      pageCount: r.documents?.pageCount || 0,
    },
    business: { ...emptyBusiness(), ...(r.business || {}) },
    owners: [0, 1].map((i) => ({ ...emptyOwner(), ...(owners[i] || {}) })),
    banking: { ...emptyBanking(), ...(r.banking || {}) },
    transaction: { ...emptyTransaction(), ...(r.transaction || {}) },
    fees: { ...emptyFees(), ...(r.fees || {}) },
    serviceAcceptance: { ...emptyServiceAcceptance(), ...(r.serviceAcceptance || {}) },
    signatures: { ...emptySignatures(), ...(r.signatures || {}) },
    equipment: [0, 1, 2, 3].map((i) => ({ ...emptyEquip(), ...((Array.isArray(r.equipment) ? r.equipment : [])[i] || {}) })),
    coversheet: { ...emptyCoversheet(), ...(r.coversheet || {}) },
    po: { ...emptyPo(), ...(r.po || {}) },
    bankChange: { ...emptyBankChange(), ...(r.bankChange || {}) },
    crf: { ...emptyCrf(), ...(r.crf || {}) },
    cbd: { ...emptyCbd(), ...(r.cbd || {}) },
    giftCard: { ...emptyGiftCard(), ...(r.giftCard || {}) },
    sales: { salesRep: "", salesOffice: "", salesAgentName: "", ...(r.sales || {}) },
    notes: r.notes || "",
  };
  // Identity numbers must stay strings — leading zeros (routing/account/SSN/zip/tax
  // ID/MID) are lost if the model returned them as JSON numbers instead of strings.
  const str = (v) => (v == null || v === "" ? "" : String(v));
  out.banking.routing = str(out.banking.routing);
  out.banking.account = str(out.banking.account);
  out.business.federalTaxId = str(out.business.federalTaxId);
  out.business.dnb = str(out.business.dnb);
  out.business.locationZip = str(out.business.locationZip);
  out.business.corpZip = str(out.business.corpZip);
  out.owners.forEach((o) => { o.ssn = str(o.ssn); o.zip = str(o.zip); o.dlNumber = str(o.dlNumber); });
  out.po.mid = str(out.po.mid);
  const bcNum = ["merchantId", "fundRouting", "fundAccount", "billRouting", "billAccount"];
  bcNum.forEach((k) => { out.bankChange[k] = str(out.bankChange[k]); });
  out.crf.merchantId = str(out.crf.merchantId);
  out.crf.ebtFns = str(out.crf.ebtFns);
  const gcArr = (v, n, empty) => {
    const list = Array.isArray(v) ? v : v && typeof v === "object" ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : [];
    return Array.from({ length: n }, (_, i) => {
      const row = { ...empty() };
      for (const k of Object.keys(row)) row[k] = str((list[i] || {})[k]);
      return row;
    });
  };
  out.giftCard.eq = gcArr(out.giftCard.eq, 3, () => ({ qty: "", terminalType: "", bizType: "", model: "", serial: "" }));
  out.giftCard.locations = gcArr(out.giftCard.locations, 2, emptyGiftCardLoc);
  ["numLocations", "merchantProcessingNum", "giftCardMerchantNum", "omahaMerchantNum", "mcc",
   "affMerchantId", "affAltId", "affExistingNum", "affPromoNumber"].forEach((k) => { out.giftCard[k] = str(out.giftCard[k]); });
  out.cbd.stateHempLicense = str(out.cbd.stateHempLicense);
  // The review form writes products via numeric paths, which arrive as an
  // object keyed "0".."9" — accept either shape; keep 10 editable rows (20 max on the form).
  const prodsIn = out.cbd.products;
  const prodList = Array.isArray(prodsIn)
    ? prodsIn
    : prodsIn && typeof prodsIn === "object"
      ? Object.keys(prodsIn).sort((a, b) => a - b).map((k) => prodsIn[k])
      : [];
  out.cbd.products = Array.from({ length: Math.max(10, Math.min(20, prodList.length)) }, (_, i) => ({
    name: str(prodList[i]?.name), distributor: str(prodList[i]?.distributor), state: str(prodList[i]?.state),
  }));
  return out;
}

const emptyBusiness = () => ({
  dba: "", legalName: "", locationAddress: "", locationCity: "", locationState: "", locationZip: "",
  corpAddress: "", corpCity: "", corpState: "", corpZip: "", phone: "", fax: "", contactName: "",
  contactPhone: "", customerServicePhone: "", email: "", website: "", federalTaxId: "", taxType: "",
  taxFilingName: "", dnb: "", businessType: "", productsSold: "", organizationType: "", stateIssued: "",
  businessStarted: "", lengthOwnershipYears: "", lengthOwnershipMonths: "",
});
const emptyOwner = () => ({
  first: "", last: "", title: "", ownershipPct: "", homeAddress: "", city: "", state: "", zip: "",
  phone: "", email: "", ssn: "", dob: "", dlNumber: "", dlState: "", dlExp: "",
});
const emptyBanking = () => ({ bankName: "", routing: "", account: "", bankPhone: "", accountType: "" });
const emptyTransaction = () => ({
  monthlyVolume: "", avgTicket: "", highTicket: "", amexVolume: "", swipePct: "", motoPct: "",
  internetPct: "", salesToConsumerPct: "", salesToBusinessPct: "", salesToGovPct: "",
  previousProcessor: "", reasonForLeaving: "", seasonal: false,
});
const emptyFees = () => ({
  // Authorization fees
  authVmcda: "", fleet: "", pinDebit: "", pinDebitPct: "", ebt: "", salesTxn: "", electronicAvs: "", voiceAuth: "", voiceAvs: "",
  // Monthly fees
  monthlyService: "", monthlyMinimum: "", wireless: "", pinDebitMonthly: "", industryCompliance: "",
  // Miscellaneous fees
  chargeback: "", retrieval: "", achReject: "", annual: "", batch: "", returnTxn: "", equipmentRental: "", monthToBill: "",
  earlyTermination: "",
  // Merrick-specific
  basilPos: "", saasFee: "", inactivityFee: "", gatewayMonthly: "", gatewayTxn: "", monthlyMisc: "",
});
const emptyServiceAcceptance = () => ({
  cardVisaCredit: false, cardVisaDebit: false, cardMcCredit: false, cardMcDebit: false,
  cardDiscover: false, cardAmex: false, cardPin: false, cardEbt: false,
  discountPlan: "", // 'flat' | 'passthrough'
  flatCreditPct: "", flatDebitPct: "", flatAmexPct: "",
  passCreditPct: "", passDebitPct: "", passAmexPct: "",
  assessments: "", // 'included' | 'billed'
  paymentMethod: "", // 'daily' | 'monthly'
});
const emptySignatures = () => ({
  printedName: "", title: "", date: "", printedName2: "", title2: "", date2: "",
});
const emptyEquip = () => ({ type: "", model: "", quantity: "", acquisition: "", onCoversheet: false });
// Bank Account Change Request form (manually filled by the rep — not extracted).
const emptyBankChange = () => ({
  merchantId: "",
  fundBankName: "", fundRouting: "", fundAccount: "",
  billBankName: "", billRouting: "", billAccount: "",
  addrMatchesFile: false, addrChangeLegal: false, addrChangeDba: false,
  settleChargebacksToFunding: false,
  docVoidedCheck: false, docBankLetter: false, docBankStatement: false,
});

// Change Request Form (CRF) — a standalone one-page document; filled manually.
const emptyCrf = () => ({
  merchantId: "", ownerName: "", dba: "", legalName: "",
  dbaName: "", legalAddress: "", dbaAddress: "", emailAddress: "", dbaPhone: "", dbaFax: "", website: "",
  amexOptBluePlan: "", amexOptBlueRate: "", amexDirectSe: "", addDiscover: false,
  pinDebitDiscount: false, pinDebitRate: "", ebtFns: "", ebtFee: "", addCashBenefits: false,
  myMerchantBenefits: false, myMerchantBenefitsRate: "", vmdDiscount: false, vmdNewRate: "",
  checkCardDiscount: false, checkCardRate: "", other1: "", other1Rate: "", other2: "", other2Rate: "",
  notes: "",
});
// Clover/Omaha Gift Card setup packet — standalone document, filled manually.
const emptyGiftCardLoc = () => ({ dba: "", street: "", city: "", state: "", zip: "", phone: "", fax: "", contact: "", positionTitle: "", email: "", processingNum: "" });
const emptyGiftCard = () => ({
  appKind: "", tieTo: "", resubmission: false, additionalInfo: false, numLocations: "", // appKind: 'new' | 'outlet' | 'entitle'
  eq: [], // up to 3 rows: { qty, terminalType, bizType, model, serial }
  merchantProcessingNum: "", giftCardMerchantNum: "", chain: "", omahaMerchantNum: "", mcc: "",
  setUpFee: "", addlLocFee: "", activationFee: "", redemptionFee: "", reloadFee: "", voidFee: "", balanceFee: "", otherFee: "", monthlyMinFee: "", monthlyFee: "",
  locations: [], // up to 2 additional-location blocks
  affBank: "", affMerchantId: "", affAltId: "", affExistingNum: "", affPromoNumber: "",
});
// Hemp/CBD disclosure + CBD amendment — standalone documents, filled manually.
const emptyCbd = () => ({
  agreementDate: "", stateHempLicense: "",
  growsHemp: "", manufacturesHemp: "", advertisesHemp: "", // 'yes' | 'no' | ''
  products: [], // schedule rows: { name, distributor, state }
});
const emptyPo = () => ({
  mid: "", team: "", salesManager: "", billTo: "", shipTo: "", // 'dba'|'rep'|'other'
  shAttention: "", shipStreet: "", shipCity: "", shipState: "", shipZip: "",
  shippingMethod: "", payPlan: "", billingType: "", shCost: "", salesTax: "", frontendPlatform: "",
});
const emptyCoversheet = () => ({
  territoryManager: "", teamColor: "",
  telemarketing: false, reBoard: false,
  docPictures: false, docStatements: false,
  platform: "", platformOther: "", // 'tsys' | 'fdomaha' | 'fdnorth' | 'other'
  etf: "", annualFee: "", monthlyMin: "", svcFee: "", cashDiscount: false, cashDiscountTerminalRate: "", bypassFee: false,
  shipping: "", shippingOther: "", // 'dba' | 'agent' | 'other'
  vasGiftCards: false, vasCheckServices: false, vasWpiRewards: false, vasCustomerConnect: false,
  fbAppType: "", fbConnection: "", // 'retail'|'restaurant'|'ecommerce'|'moto' ; 'ethernet'|'dial'|'wifi'|'wireless'
  enPinDebit: false, enEbt: false, enWex: false, fnsNumber: "",
  autoClose: false, autoCloseTime: "", timezone: "", tips: "", // 'pst'|'mst'|'cst'|'est' ; 'none'|'tipline'|'tipprompt'
  serverNumbers: false, avsCvv: false, invoiceNumber: false, specialOther: "",
  notes: "",
});

function mockRecord() {
  return {
    appType: "citizens",
    appTypeConfidence: "high",
    documents: { hasVoidedCheck: true, hasDriversLicense: true, pageCount: 3 },
    business: {
      dba: "Sunrise Cafe", legalName: "Sunrise Hospitality LLC",
      locationAddress: "418 Market Street", locationCity: "Springfield", locationState: "IL", locationZip: "62704",
      corpAddress: "418 Market Street", corpCity: "Springfield", corpState: "IL", corpZip: "62704",
      phone: "(217) 555-0148", fax: "", contactName: "Maria Alvarez", contactPhone: "(217) 555-0148",
      customerServicePhone: "(217) 555-0148", email: "maria@sunrisecafe.com", website: "www.sunrisecafe.com",
      federalTaxId: "47-1928374", taxType: "EIN", taxFilingName: "Sunrise Hospitality LLC", dnb: "",
      businessType: "Restaurant", productsSold: "Coffee, breakfast & lunch",
      organizationType: "LLC", stateIssued: "IL", businessStarted: "03/2019",
      lengthOwnershipYears: "7", lengthOwnershipMonths: "3",
    },
    owners: [
      {
        first: "Maria", last: "Alvarez", title: "Owner", ownershipPct: "100",
        homeAddress: "22 Elm Court Apt 4B", city: "Springfield", state: "IL", zip: "62704",
        phone: "(217) 555-0148", email: "maria@sunrisecafe.com", ssn: "123-45-6789", dob: "03/14/1985",
        dlNumber: "A123-4567-8901", dlState: "IL", dlExp: "03/14/2028",
      },
      { ...emptyOwner() },
    ],
    banking: {
      bankName: "First National Bank", routing: "071000013", account: "1234567890",
      bankPhone: "(800) 555-0199", accountType: "checking",
    },
    transaction: {
      monthlyVolume: "45000", avgTicket: "28", highTicket: "350", amexVolume: "5000",
      swipePct: "90", motoPct: "5", internetPct: "5", salesToConsumerPct: "95",
      salesToBusinessPct: "5", salesToGovPct: "0", previousProcessor: "Square",
      reasonForLeaving: "Rates", seasonal: false,
    },
    fees: {
      authVmcda: "0.10", fleet: "0.10", pinDebit: "0.05", pinDebitPct: "0.20", ebt: "0.05", salesTxn: "0.05",
      monthlyService: "9.95", monthlyMinimum: "25", wireless: "10", pinDebitMonthly: "5", industryCompliance: "4.95",
      chargeback: "25", retrieval: "15", achReject: "25", annual: "99", batch: "0.20", returnTxn: "0.05",
      equipmentRental: "30", monthToBill: "Jan", earlyTermination: "295",
    },
    serviceAcceptance: {
      cardVisaCredit: true, cardVisaDebit: true, cardMcCredit: true, cardMcDebit: true,
      cardDiscover: true, cardAmex: true, cardPin: false, cardEbt: false,
      discountPlan: "flat", flatCreditPct: "2.49", flatDebitPct: "1.49", flatAmexPct: "2.89",
      passCreditPct: "", passDebitPct: "", passAmexPct: "", assessments: "billed", paymentMethod: "daily",
    },
    signatures: {
      printedName: "Maria Alvarez", title: "Owner", date: "06/27/2026",
      printedName2: "", title2: "", date2: "",
    },
    equipment: [
      { type: "Terminal", model: "Clover Flex", quantity: "1" },
      { type: "Pin Pad", model: "PAX A920", quantity: "1" },
      { type: "", model: "", quantity: "" },
    ],
    coversheet: {
      territoryManager: "Jordan Pike", teamColor: "Maverick Blue",
      telemarketing: false, reBoard: false, docPictures: true, docStatements: true,
      platform: "tsys", platformOther: "",
      etf: "295", annualFee: "99", monthlyMin: "25", svcFee: "9.95",
      cashDiscount: true, cashDiscountTerminalRate: "3.99", bypassFee: false,
      shipping: "dba", shippingOther: "",
      vasGiftCards: true, vasCheckServices: false, vasWpiRewards: true, vasCustomerConnect: false,
      fbAppType: "restaurant", fbConnection: "ethernet",
      enPinDebit: true, enEbt: false, enWex: false, fnsNumber: "",
      autoClose: true, autoCloseTime: "11:00 PM", timezone: "cst", tips: "tipprompt",
      serverNumbers: true, avsCvv: false, invoiceNumber: false, specialOther: "",
      notes: "Rush boarding requested.",
    },
    sales: { salesRep: "T. Nguyen", salesOffice: "Midwest", salesAgentName: "Tom Nguyen" },
    notes: "Bank details read from voided check; owner identity from IL driver's license.",
  };
}
