// Extension of audit.mjs: statically verify anchors and render the fill
// overlays for the seven forms the base audit does not cover, using a record
// with every relevant section populated.
import fs from "node:fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { loadAnchors, findLabel, renderedPagePath } from "../lib/anchors.js";
import { FORM_MAPS } from "../lib/formMaps.js";
import { computePlacements, prepareRecord } from "../lib/fillForm.js";
import { normalizeRecord } from "../lib/extract.js";

const OUT = process.argv[2] || "/tmp/audit-extra";
fs.mkdirSync(OUT, { recursive: true });
const safe = (v) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
const measureCtx = createCanvas(10, 10).getContext("2d");
const measure = (text, size) => { measureCtx.font = `${size}px Helvetica, Arial, sans-serif`; return measureCtx.measureText(text).width; };

const rec = normalizeRecord({
  appType: "fd_north",
  business: {
    dba: "Sunrise Cafe", legalName: "Sunrise Hospitality LLC",
    locationAddress: "418 Market Street", locationCity: "Springfield", locationState: "IL", locationZip: "62704",
    corpAddress: "418 Market Street", corpCity: "Springfield", corpState: "IL", corpZip: "62704",
    phone: "(217) 555-0148", fax: "(217) 555-0149", contactName: "Maria Alvarez", contactPhone: "(217) 555-0148",
    customerServicePhone: "(217) 555-0148", email: "maria@sunrisecafe.com", website: "www.sunrisecafe.com",
    federalTaxId: "47-1928374", taxType: "EIN", taxFilingName: "Sunrise Hospitality LLC",
    businessType: "Restaurant", productsSold: "Coffee, breakfast & lunch",
    organizationType: "LLC", stateIssued: "IL", businessStarted: "03/2019",
    lengthOwnershipYears: "7", lengthOwnershipMonths: "3",
  },
  owners: [{
    first: "Maria", last: "Alvarez", title: "Owner", ownershipPct: "100",
    homeAddress: "22 Elm Court Apt 4B", city: "Springfield", state: "IL", zip: "62704",
    phone: "(217) 555-0148", email: "maria@sunrisecafe.com", ssn: "123-45-6789", dob: "03/14/1985",
    dlNumber: "A123-4567-8901", dlState: "IL", dlExp: "03/14/2028",
  }],
  banking: { bankName: "First National Bank", routing: "071000013", account: "1234567890", bankPhone: "(800) 555-0199", accountType: "checking" },
  transaction: {
    monthlyVolume: "45000", avgTicket: "28", highTicket: "350", amexVolume: "5000",
    swipePct: "90", motoPct: "5", internetPct: "5", salesToConsumerPct: "95",
    salesToBusinessPct: "5", salesToGovPct: "0", previousProcessor: "Square", reasonForLeaving: "Rates",
  },
  fees: {
    authVmcda: "0.10", monthlyService: "9.95", monthlyMinimum: "25", annual: "99",
    chargeback: "25", earlyTermination: "295", batch: "0.20",
  },
  serviceAcceptance: {
    cardVisaCredit: true, cardVisaDebit: true, cardMcCredit: true, cardMcDebit: true,
    cardDiscover: true, cardAmex: true, discountPlan: "flat",
    flatCreditPct: "2.49", flatDebitPct: "1.49", assessments: "billed", paymentMethod: "daily",
  },
  signatures: { printedName: "Maria Alvarez", title: "Owner", date: "08/30/2026" },
  equipment: [{ type: "Terminal", model: "Clover Flex", quantity: "1", onCoversheet: true }],
  po: {
    mid: "887700123456", team: "Maverick Blue", salesManager: "Jordan Pike", billTo: "Merchant",
    shipTo: "other", shAttention: "Maria Alvarez", shipStreet: "418 Market Street",
    shipCity: "Springfield", shipState: "IL", shipZip: "62704",
    shippingMethod: "ground", payPlan: "4pay", billingType: "ach", shCost: "25", salesTax: "30.50", frontendPlatform: "omaha",
  },
  bankChange: {
    merchantId: "887700123456",
    fundBankName: "First National Bank", fundRouting: "071000013", fundAccount: "1234567890",
    billBankName: "Second State Bank", billRouting: "081000032", billAccount: "9988776655",
    addrMatchesFile: true, settleChargebacksToFunding: true, docVoidedCheck: true, docBankLetter: true,
  },
  crf: {
    merchantId: "887700123456", ownerName: "Maria Alvarez", dba: "Sunrise Cafe", legalName: "Sunrise Hospitality LLC",
    dbaName: "Sunrise Cafe & Bakery", legalAddress: "500 Oak Ave, Springfield, IL 62704",
    dbaAddress: "500 Oak Ave, Springfield, IL 62704", emailAddress: "maria@sunrisecafe.com",
    dbaPhone: "(217) 555-0150", dbaFax: "(217) 555-0151", website: "www.sunrisecafe.com",
    amexOptBluePlan: "OptBlue", amexOptBlueRate: "2.89", amexDirectSe: "1234567890",
    addDiscover: true, pinDebitDiscount: true, pinDebitRate: "0.75", ebtFns: "1234567",
    ebtFee: "0.05", addCashBenefits: true, myMerchantBenefits: true, myMerchantBenefitsRate: "29.95",
    vmdDiscount: true, vmdNewRate: "2.25", checkCardDiscount: true, checkCardRate: "1.15",
    other1: "Gift card program", other1Rate: "0", notes: "Rate review approved by manager.",
  },
  cbd: {
    agreementDate: "08/30/2026", stateHempLicense: "IL-HEMP-00123",
    growsHemp: "no", manufacturesHemp: "no", advertisesHemp: "yes",
    products: [
      { name: "CBD Tincture 500mg", distributor: "Green Fields LLC", state: "IL" },
      { name: "Hemp Balm", distributor: "Prairie Botanicals", state: "IL" },
      { name: "CBD Gummies", distributor: "Green Fields LLC", state: "IL" },
    ],
  },
  giftCard: {
    appKind: "new", tieTo: "Sunrise Group", numLocations: "2",
    eq: [{ qty: "1", terminalType: "Clover", bizType: "Restaurant", model: "Flex", serial: "C045U12345678" }],
    merchantProcessingNum: "887700123456", giftCardMerchantNum: "GC-4455", chain: "SUN01",
    omahaMerchantNum: "OM-778899", mcc: "5812",
    setUpFee: "50", activationFee: "0.35", redemptionFee: "0.35", monthlyFee: "10",
    locations: [{ dba: "Sunrise Cafe North", street: "12 Lake St", city: "Springfield", state: "IL", zip: "62704", phone: "(217) 555-0160", contact: "Maria Alvarez", positionTitle: "Owner", email: "maria@sunrisecafe.com", processingNum: "887700123457" }],
    affBank: "Citizens", affMerchantId: "887700123456", affAltId: "ALT-1", affExistingNum: "GC-1122", affPromoNumber: "PROMO7",
  },
  sales: { salesRep: "Justin Woodruff", salesOffice: "Midwest", salesAgentName: "Justin Woodruff" },
});
const base = prepareRecord(rec, { date: "08/30/2026" });

const FORMS = ["fd_north", "pbt", "bank_change", "crf", "hemp_cbd", "cbd_amendment", "gift_card"];
let totalMissing = 0;

for (const form of FORMS) {
  const anchors = loadAnchors(form);
  const map = FORM_MAPS[form];
  const misses = [];
  let populatedText = 0, populatedCheck = 0;
  for (const spec of map.text || []) {
    const v = safe(spec.get(base));
    if (!v) continue;
    populatedText++;
    if (spec.text == null) continue; // absolute-positioned
    const a = findLabel(anchors, { page: spec.page, text: spec.text, occ: spec.occ, region: spec.region, exact: spec.exact });
    if (!a) misses.push(`TEXT  p${spec.page} "${spec.text}" value="${v.slice(0, 24)}"`);
  }
  for (const spec of map.check || []) {
    if (!spec.on(base)) continue;
    populatedCheck++;
    if (spec.text == null) continue;
    const a = findLabel(anchors, { page: spec.page, text: spec.text, occ: spec.occ, region: spec.region, exact: spec.exact });
    if (!a) misses.push(`CHECK p${spec.page} "${spec.text}"`);
  }

  const placements = computePlacements(form, base, measure);
  const perPage = {};
  for (const it of placements) perPage[it.page] = (perPage[it.page] || 0) + 1;

  for (let p = 0; p < anchors.pages.length; p++) {
    const { width, height } = anchors.pages[p];
    const bg = await loadImage(renderedPagePath(form, p + 1));
    const scale = bg.width / width;
    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bg, 0, 0);
    ctx.fillStyle = "rgb(13,26,115)";
    for (const it of placements.filter((i) => i.page === p + 1)) {
      ctx.font = `${it.bold ? "bold " : ""}${it.size * scale}px Helvetica, Arial, sans-serif`;
      ctx.fillText(it.text, it.x * scale, (height - it.y) * scale);
    }
    fs.writeFileSync(`${OUT}/${form}-p${p + 1}.png`, canvas.toBuffer("image/png"));
  }

  console.log(`=== ${form} ===`);
  console.log(`  pages: ${anchors.pages.length} | populated text: ${populatedText}, checks: ${populatedCheck} | placements drawn: ${placements.length}`);
  console.log(`  placements/page: ${JSON.stringify(perPage)}`);
  if (misses.length) { totalMissing += misses.length; misses.forEach((m) => console.log("  ✗ MISSING " + m)); }
  else console.log("  ✓ every populated field resolved to an anchor");
}
console.log(`\nTOTAL MISSING ANCHORS: ${totalMissing}`);
console.log("images written to " + OUT);
