// Field-placement maps for each template form.
//
// Text spec:  { get, page, text, exact?, occ?, region?, place, dx?, dy?, size?, maxWidth?, absX?, absY?, pad? }
//   place 'below'  -> value below the label   (column-header forms: Citizens / Merrick)
//   place 'right'  -> value right of the label / anchored symbol
//   place 'leftOf' -> value right-aligned to end just before the anchor (numbers before a % symbol)
//   absX/absY      -> absolute PDF coordinate (overrides anchor x/y); still needs a found anchor
// Check spec: { on, page, text, exact?, occ?, region?, dx?, dy?, absX?, absY?, mark? }
//
// `get(record)` returns the string to draw; `on(record)` returns a boolean.
// Numbers that sit next to a preprinted $ or % are anchored on that symbol so they
// land cleanly inside the box (no doubled $/%).

import { priceFor, MODELS } from "./pricing.js";

const full = (o) => [o?.first, o?.last].filter(Boolean).join(" ").trim();
const raw = (v) => (v == null ? "" : String(v).trim());
// Team is shown without a trailing color word (e.g. "Maverick Blue" -> "Maverick").
const teamName = (v) => raw(v).replace(/\s*\bblue\b\s*$/i, "").trim();

// Owner #1 signature-block fields, auto-filled from Owner 1 when not entered in
// the Signatures section (so the printed name / title / date appear by the sign).
const sigName = (r) => raw(r.signatures?.printedName) || full(r.owners?.[0]);
const sigTitle = (r) => raw(r.signatures?.title) || raw(r.owners?.[0]?.title);
// Prefer the packet/cover date the user entered (matches the coversheet & PO);
// fall back to a date scraped from the source application's signature page.
const sigDate = (r) => raw(r._date) || raw(r.signatures?.date);
// Free-text organization/ownership type, lowercased for matching to a printed checkbox.
const orgType = (r) => raw(r.business?.organizationType).toLowerCase();

/* ----------------------------- Citizens ----------------------------- */
const citizens = {
  text: [
    // 1. General information
    { get: (r) => r.business.dba, page: 1, text: "Client’s Business Name", place: "below", maxWidth: 275 },
    { get: (r) => r.business.legalName, page: 1, text: "Client’s Corporate/Legal Name", place: "below", maxWidth: 285 },
    { get: (r) => r.business.locationAddress, page: 1, text: "Location Address", occ: 0, place: "below", maxWidth: 275 },
    { get: (r) => r.business.corpAddress, page: 1, text: "Corporate Address (if Different", place: "below", maxWidth: 285 },
    { get: (r) => r.business.locationCity, page: 1, text: "City", region: { yMin: 696, yMax: 704, xMax: 120 }, place: "below", maxWidth: 130 },
    { get: (r) => r.business.locationState, page: 1, text: "State", region: { yMin: 696, yMax: 704, xMin: 140, xMax: 220 }, place: "below", maxWidth: 70 },
    { get: (r) => r.business.locationZip, page: 1, text: "Zip", region: { yMin: 696, yMax: 704, xMin: 220, xMax: 300 }, place: "below", maxWidth: 60 },
    { get: (r) => r.business.corpCity, page: 1, text: "City", region: { yMin: 696, yMax: 704, xMin: 300 }, place: "below", maxWidth: 130 },
    { get: (r) => r.business.corpState, page: 1, text: "State", region: { yMin: 696, yMax: 704, xMin: 430, xMax: 500 }, place: "below", maxWidth: 70 },
    { get: (r) => r.business.corpZip, page: 1, text: "Zip", region: { yMin: 696, yMax: 704, xMin: 510 }, place: "below", maxWidth: 60 },
    { get: (r) => r.business.phone, page: 1, text: "Location Phone", place: "below", maxWidth: 125 },
    { get: (r) => r.business.fax, page: 1, text: "Location Fax", place: "below", maxWidth: 140 },
    { get: (r) => r.business.contactName, page: 1, text: "Contact Name", place: "below", maxWidth: 120 },
    { get: (r) => r.business.contactPhone, page: 1, text: "Contact Phone", place: "below", maxWidth: 130 },
    { get: (r) => r.business.customerServicePhone, page: 1, text: "Customer Service Phone", place: "below", maxWidth: 160 },
    { get: (r) => r.business.email, page: 1, text: "Business Email", place: "below", maxWidth: 150 },
    { get: (r) => r.business.dnb, page: 1, text: "D&B #", place: "below", maxWidth: 70 },
    { get: (r) => r.business.website, page: 1, text: "Business Website Address", place: "below", maxWidth: 270 },
    { get: (r) => r.business.federalTaxId, page: 1, text: "Fed Tax ID", place: "below", maxWidth: 150 },
    { get: (r) => r.business.taxType, page: 1, text: "Tax Type", place: "below", maxWidth: 80 },
    { get: (r) => r.business.taxFilingName, page: 1, text: "Tax Filing Name", place: "below", maxWidth: 270 },
    { get: (r) => r.business.businessStarted, page: 1, text: "Business Started", place: "below", maxWidth: 160 },
    { get: (r) => ownLen(r), page: 1, text: "Length Current Ownership", place: "below", maxWidth: 120 },

    // 2. Owners / officers
    { get: (r) => full(r.owners[0]), page: 1, text: "Owner/Officer 1", place: "below", maxWidth: 125 },
    { get: (r) => r.owners[0].homeAddress, page: 1, text: "Home Address", occ: 0, place: "below", maxWidth: 150 },
    { get: (r) => r.owners[0].phone, page: 1, text: "Telephone", occ: 0, place: "below", maxWidth: 145 },
    { get: (r) => r.owners[0].ssn, page: 1, text: "Social Security #", occ: 0, place: "below", maxWidth: 120 },
    { get: (r) => r.owners[0].title, page: 1, text: "Title", occ: 0, place: "below", maxWidth: 70 },
    { get: (r) => raw(r.owners[0].ownershipPct), page: 1, text: "% Ownership", occ: 0, place: "below", dx: 6, maxWidth: 50 },
    { get: (r) => r.owners[0].city, page: 1, text: "City", region: { yMin: 516, yMax: 524, xMin: 150, xMax: 220 }, place: "below", maxWidth: 70 },
    { get: (r) => r.owners[0].state, page: 1, text: "State", region: { yMin: 516, yMax: 524, xMin: 225, xMax: 260 }, place: "below", maxWidth: 35 },
    { get: (r) => r.owners[0].zip, page: 1, text: "Zip", region: { yMin: 516, yMax: 524, xMin: 260 }, place: "below", maxWidth: 45 },
    { get: (r) => r.owners[0].email, page: 1, text: "Email Address", occ: 0, place: "below", maxWidth: 150 },
    { get: (r) => r.owners[0].dob, page: 1, text: "Birth Date", occ: 0, place: "below", size: 9, maxWidth: 100 },

    { get: (r) => full(r.owners[1]), page: 1, text: "Ownership", exact: true, region: { yMin: 480, yMax: 488, xMax: 55 }, place: "below", maxWidth: 125 },
    { get: (r) => r.owners[1].homeAddress, page: 1, text: "Home Address", occ: 1, place: "below", maxWidth: 150 },
    { get: (r) => r.owners[1].phone, page: 1, text: "Telephone", occ: 1, place: "below", maxWidth: 145 },
    { get: (r) => r.owners[1].ssn, page: 1, text: "Social Security #", occ: 1, place: "below", maxWidth: 120 },
    { get: (r) => r.owners[1].title, page: 1, text: "Title", occ: 1, place: "below", maxWidth: 70 },
    { get: (r) => raw(r.owners[1].ownershipPct), page: 1, text: "% Ownership", occ: 1, place: "below", dx: 6, maxWidth: 50 },
    { get: (r) => r.owners[1].city, page: 1, text: "City", region: { yMin: 457, yMax: 465, xMin: 150, xMax: 220 }, place: "below", maxWidth: 70 },
    { get: (r) => r.owners[1].state, page: 1, text: "State", region: { yMin: 457, yMax: 465, xMin: 225, xMax: 260 }, place: "below", maxWidth: 35 },
    { get: (r) => r.owners[1].zip, page: 1, text: "Zip", region: { yMin: 457, yMax: 465, xMin: 260 }, place: "below", maxWidth: 45 },
    { get: (r) => r.owners[1].email, page: 1, text: "Email Address", occ: 1, place: "below", maxWidth: 150 },
    { get: (r) => r.owners[1].dob, page: 1, text: "Birth Date", occ: 1, place: "below", size: 9, maxWidth: 100 },

    // 3. Transaction info — numbers anchored to the right of the printed "$"
    { get: (r) => raw(r.transaction.monthlyVolume), page: 1, text: "$", region: { yMin: 374, yMax: 382, xMin: 170, xMax: 185 }, place: "right", dx: 3, maxWidth: 120 },
    { get: (r) => raw(r.transaction.avgTicket), page: 1, text: "$", region: { yMin: 357, yMax: 365, xMin: 170, xMax: 185 }, place: "right", dx: 3, maxWidth: 120 },
    { get: (r) => raw(r.transaction.highTicket), page: 1, text: "$", region: { yMin: 340, yMax: 348, xMin: 170, xMax: 185 }, place: "right", dx: 3, maxWidth: 120 },
    { get: (r) => r.transaction.previousProcessor, page: 1, text: "Previous Processor", place: "right", dx: 6, maxWidth: 110 },
    { get: (r) => r.transaction.reasonForLeaving, page: 1, text: "Reason For Leaving", place: "right", dx: 6, maxWidth: 110 },

    // 4. Nature of business
    { get: (r) => r.business.productsSold, page: 1, text: "Describe Product / Services Sold", place: "right", dx: 6, maxWidth: 130 },
    { get: (r) => r.business.businessType, page: 1, text: "Business Type", place: "right", dx: 6, maxWidth: 130 },
    { get: (r) => raw(r.transaction.swipePct), page: 1, text: "SWIPE % :", place: "right", dx: 8, maxWidth: 90 },
    { get: (r) => raw(r.transaction.motoPct), page: 1, text: "MOTO % :", place: "right", dx: 8, maxWidth: 90 },
    { get: (r) => raw(r.transaction.internetPct), page: 1, text: "INTERNET % :", place: "right", dx: 8, maxWidth: 90 },

    // 5. Banking
    { get: (r) => r.banking.bankName, page: 1, text: "Deposit Bank Name", place: "below", dy: -10, maxWidth: 100 },
    { get: (r) => r.banking.routing, page: 1, text: "Routing #", place: "below", dy: -10, maxWidth: 90 },
    { get: (r) => raw(r.banking.account), page: 1, text: "Account #", place: "below", dy: -10, maxWidth: 80 },
    { get: (r) => r.banking.bankPhone, page: 1, text: "Bank Phone", place: "below", dy: -10, maxWidth: 68 },

    // 6. Fee schedule — anchored to the right of each printed "$"
    { get: (r) => raw(r.fees.authVmcda), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 84, xMax: 95 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.monthlyService), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 218, xMax: 230 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.monthlyMinimum), page: 1, text: "$", region: { yMin: 130, yMax: 138, xMin: 225, xMax: 237 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.annual), page: 1, text: "$", region: { yMin: 96, yMax: 104, xMin: 340, xMax: 355 }, place: "right", dx: 3, maxWidth: 55 },
    // 6b. Remaining fee schedule (anchored to each printed "$")
    { get: (r) => raw(r.fees.fleet), page: 1, text: "$", region: { yMin: 130, yMax: 138, xMin: 56, xMax: 67 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.pinDebit), page: 1, text: "$", region: { yMin: 113, yMax: 121, xMin: 54, xMax: 64 }, place: "right", dx: 3, maxWidth: 17 },
    { get: (r) => raw(r.fees.pinDebitPct), page: 1, text: "%", region: { yMin: 114, yMax: 121, xMin: 99, xMax: 112 }, place: "leftOf", pad: 2, maxWidth: 15 },
    { get: (r) => raw(r.fees.ebt), page: 1, text: "$", region: { yMin: 96, yMax: 104, xMin: 38, xMax: 48 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.salesTxn), page: 1, text: "$", region: { yMin: 79, yMax: 87, xMin: 89, xMax: 99 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.wireless), page: 1, text: "$", region: { yMin: 113, yMax: 121, xMin: 208, xMax: 220 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.pinDebitMonthly), page: 1, text: "$", region: { yMin: 96, yMax: 104, xMin: 223, xMax: 235 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.industryCompliance), page: 1, text: "$", region: { yMin: 79, yMax: 87, xMin: 231, xMax: 243 }, place: "right", dx: 3, maxWidth: 55 },
    // maxWidth 28: the blank ends ~29pt in, at the preprinted "(Per Occurrence)"
    { get: (r) => raw(r.fees.chargeback), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 345, xMax: 357 }, place: "right", dx: 3, maxWidth: 28 },
    { get: (r) => raw(r.fees.retrieval), page: 1, text: "$", region: { yMin: 130, yMax: 138, xMin: 336, xMax: 348 }, place: "right", dx: 3, maxWidth: 28 },
    { get: (r) => raw(r.fees.achReject), page: 1, text: "$", region: { yMin: 113, yMax: 121, xMin: 343, xMax: 355 }, place: "right", dx: 3, maxWidth: 28 },
    { get: (r) => raw(r.fees.equipmentRental), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 529, xMax: 540 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.monthToBill), page: 1, text: "Month to Bill:", place: "right", dx: 4, maxWidth: 70 },
    // Early Termination Fee — fills the "$ ____ Early Termination Fee" blank in the recital line.
    { get: (r) => raw(r.fees.earlyTermination), page: 1, text: "Early Termination Fee", absX: 362, absY: 51, place: "right", size: 8, maxWidth: 26 },
    // Service acceptance — discount plan percentages, centered in the blank after each "%:" label
    { get: (r) => raw(r.serviceAcceptance.flatCreditPct), page: 1, text: "%", region: { yMin: 228, yMax: 236, xMin: 235, xMax: 247 }, place: "center", absX: 266, maxWidth: 28 },
    { get: (r) => raw(r.serviceAcceptance.flatDebitPct), page: 1, text: "%", region: { yMin: 228, yMax: 236, xMin: 293, xMax: 305 }, place: "center", absX: 327, maxWidth: 36 },
    { get: (r) => raw(r.serviceAcceptance.passCreditPct), page: 1, text: "%", region: { yMin: 228, yMax: 236, xMin: 430, xMax: 442 }, place: "center", absX: 460, maxWidth: 28 },
    { get: (r) => raw(r.serviceAcceptance.passDebitPct), page: 1, text: "%", region: { yMin: 228, yMax: 236, xMin: 485, xMax: 497 }, place: "center", absX: 516, maxWidth: 28 },
    { get: (r) => raw(r.serviceAcceptance.passAmexPct), page: 1, text: "%", region: { yMin: 228, yMax: 236, xMin: 544, xMax: 556 }, place: "center", absX: 574, maxWidth: 28 },

    // 10. Signatures (page 2) — printed names / titles / dates (signature stays handwritten)
    // Principal/Officer block: left = signer 1, right = signer 2
    { get: sigName, page: 2, text: "Print Name", region: { yMin: 235, yMax: 243, xMax: 200 }, place: "right", dx: 5, dy: -2, maxWidth: 128 },
    { get: sigTitle, page: 2, text: "Title", region: { yMin: 255, yMax: 263, xMax: 280 }, place: "right", dx: 6, maxWidth: 85 },
    { get: sigDate, page: 2, text: "Date:", region: { yMin: 232, yMax: 240, xMax: 280 }, place: "right", dx: 6, maxWidth: 85 },
    { get: (r) => r.signatures.printedName2, page: 2, text: "Print Name", region: { yMin: 235, yMax: 243, xMin: 250 }, place: "right", dx: 5, dy: -2, maxWidth: 128 },
    { get: (r) => r.signatures.title2, page: 2, text: "Title", region: { yMin: 255, yMax: 263, xMin: 400 }, place: "right", dx: 6, maxWidth: 95 },
    { get: (r) => r.signatures.date2, page: 2, text: "Date:", region: { yMin: 232, yMax: 240, xMin: 400 }, place: "right", dx: 6, maxWidth: 95 },
    // Personal Guarantee block (same signers)
    { get: sigName, page: 2, text: "Print Name", region: { yMin: 120, yMax: 128, xMax: 200 }, place: "right", dx: 5, dy: -2, maxWidth: 128 },
    { get: sigTitle, page: 2, text: "Title", region: { yMin: 139, yMax: 147, xMax: 280 }, place: "right", dx: 6, maxWidth: 85 },
    { get: sigDate, page: 2, text: "Date:", region: { yMin: 115, yMax: 123, xMax: 280 }, place: "right", dx: 6, maxWidth: 85 },
    { get: (r) => r.signatures.printedName2, page: 2, text: "Print Name", region: { yMin: 120, yMax: 128, xMin: 250 }, place: "right", dx: 5, dy: -2, maxWidth: 128 },
    { get: (r) => r.signatures.title2, page: 2, text: "Title", region: { yMin: 139, yMax: 147, xMin: 400 }, place: "right", dx: 6, maxWidth: 95 },
    { get: (r) => r.signatures.date2, page: 2, text: "Date:", region: { yMin: 115, yMax: 123, xMin: 400 }, place: "right", dx: 6, maxWidth: 95 },

    // Confirmation page (page 3)
    { get: (r) => r.business.legalName, page: 3, text: "Print Client’s Business Legal Name", place: "right", dx: 14, maxWidth: 260 },
    { get: sigTitle, page: 3, text: "Title:", place: "right", dx: 6, maxWidth: 95 },
    { get: sigDate, page: 3, text: "Date:", place: "right", dx: 6, maxWidth: 100 },
    { get: sigName, page: 3, text: "Print Name of Signer", place: "right", dx: 8, maxWidth: 250 },
  ],
  check: [
    { on: (r) => r.banking.accountType === "checking", page: 1, text: "Checking", dx: -11, dy: 1.2 },
    { on: (r) => r.banking.accountType === "savings", page: 1, text: "Savings", dx: -11, dy: 1.2 },
    // Card types (boxes sit left of each label)
    { on: (r) => r.serviceAcceptance.cardVisaCredit, page: 1, text: "VISA CREDIT", dx: -11.4, dy: 1 },
    { on: (r) => r.serviceAcceptance.cardVisaDebit, page: 1, text: "VISA DEBIT", dx: -11.4, dy: 1 },
    { on: (r) => r.serviceAcceptance.cardMcCredit, page: 1, text: "MASTERCARD CREDIT", dx: -11.2, dy: 1 },
    { on: (r) => r.serviceAcceptance.cardMcDebit, page: 1, text: "MASTERCARD DEBIT", dx: -11.2, dy: 1 },
    { on: (r) => r.serviceAcceptance.cardDiscover, page: 1, text: "DISCOVER", region: { yMin: 244, yMax: 252 }, dx: -11.4, dy: 1 },
    { on: (r) => r.serviceAcceptance.cardAmex, page: 1, text: "AMEX CREDIT", dx: -10.9, dy: 1 },
    { on: (r) => r.serviceAcceptance.cardPin, page: 1, text: "PIN CREDIT", dx: -11.2, dy: 1 },
    // Discount plan + assessments + payment method
    { on: (r) => r.serviceAcceptance.discountPlan === "flat", page: 1, text: "Flat Rate", dx: -12, dy: 1.4 },
    { on: (r) => r.serviceAcceptance.discountPlan === "passthrough", page: 1, text: "Passthrough IC", dx: -12, dy: 1.4 },
    { on: (r) => r.serviceAcceptance.assessments === "included", page: 1, text: "Included", dx: -12, dy: 1.8 },
    { on: (r) => r.serviceAcceptance.assessments === "billed", page: 1, text: "Billed Separately", dx: -12, dy: 1.8 },
    { on: (r) => r.serviceAcceptance.paymentMethod === "daily", page: 1, text: "Daily", dx: -12, dy: 1.8 },
    { on: (r) => r.serviceAcceptance.paymentMethod === "monthly", page: 1, text: "Monthly", region: { yMin: 210, yMax: 220 }, dx: -12, dy: 1.8 },
    // Type of Organization — two printed rows (y≈591 top, y≈582 below). The free-text
    // organizationType is matched to one of the seven options.
    { on: (r) => /sole|individual|propriet/.test(orgType(r)), page: 1, text: "Sole Prop", region: { yMin: 588, yMax: 595 }, center: true, absX: 386.3 },
    { on: (r) => /partner/.test(orgType(r)) && !/ll[cp]|limited liab/.test(orgType(r)), page: 1, text: "Partnership", region: { yMin: 588, yMax: 595 }, center: true, absX: 438 },
    { on: (r) => /ll[cp]|limited liab/.test(orgType(r)), page: 1, text: "LLC/LLP", region: { yMin: 588, yMax: 595 }, center: true, absX: 496.8 },
    { on: (r) => /corp|\binc\b|incorporated/.test(orgType(r)) && !/s[-\s]?corp|ll[cp]|limited liab|non.?profit|501|govern|municip/.test(orgType(r)), page: 1, text: "C CORP", region: { yMin: 588, yMax: 595 }, center: true, absX: 547.8 },
    { on: (r) => /s[-\s]?corp/.test(orgType(r)), page: 1, text: "S CORP", region: { yMin: 579, yMax: 586 }, center: true, absX: 314, dy: 1.4 },
    { on: (r) => /govern|gov't|gov\b|municip/.test(orgType(r)), page: 1, text: "Local/State/Federal", region: { yMin: 579, yMax: 586 }, center: true, absX: 358.3, dy: 1.4 },
    { on: (r) => /non.?profit|501/.test(orgType(r)), page: 1, text: "501c", region: { yMin: 579, yMax: 586 }, center: true, absX: 462.25 },
    // Seasonal merchant — mark "Yes" only when flagged (single review checkbox).
    { on: (r) => r.transaction.seasonal === true, page: 1, text: "Seasonal Merchant", center: true, absX: 376.2 },
  ],
  // Owner #1 "Sign Now" signature spots (x,y = bottom-left in PDF points; image
  // scaled to fit maxW x maxH). Page 2: the Principal/Officer + Personal Guarantee
  // blocks on the left; page 3: the Client's Business Principal's signature line.
  sign: [
    { page: 2, x: 64, y: 252, maxW: 175, maxH: 19 },
    { page: 2, x: 64, y: 132, maxW: 175, maxH: 19 },
    { page: 3, x: 152, y: 54, maxW: 280, maxH: 26 },
  ],
};

/* ----------------------------- Merrick ----------------------------- */
const merrick = {
  text: [
    { get: (r) => r.business.dba, page: 1, text: "MERCHANT NAME", place: "below", maxWidth: 230 },
    { get: (r) => r.business.legalName, page: 1, text: "CORPORATE / LEGAL NAME", place: "below", maxWidth: 230 },
    { get: (r) => r.business.locationAddress, page: 1, text: "LOCATION ADDRESS", place: "below", maxWidth: 230 },
    { get: (r) => r.business.corpAddress, page: 1, text: "CORPORATE ADDRESS", place: "below", maxWidth: 230 },
    { get: (r) => r.business.locationCity, page: 1, text: "CITY", region: { yMin: 665, yMax: 673, xMax: 120 }, place: "below", maxWidth: 130 },
    { get: (r) => r.business.locationState, page: 1, text: "STATE", region: { yMin: 665, yMax: 673, xMin: 160, xMax: 220 }, place: "below", maxWidth: 40 },
    { get: (r) => r.business.locationZip, page: 1, text: "ZIP", region: { yMin: 665, yMax: 673, xMin: 220, xMax: 300 }, place: "below", maxWidth: 55 },
    { get: (r) => r.business.corpCity, page: 1, text: "CITY", region: { yMin: 665, yMax: 673, xMin: 300 }, place: "below", maxWidth: 130 },
    { get: (r) => r.business.corpState, page: 1, text: "STATE", region: { yMin: 665, yMax: 673, xMin: 450, xMax: 510 }, place: "below", maxWidth: 40 },
    { get: (r) => r.business.corpZip, page: 1, text: "ZIP", region: { yMin: 665, yMax: 673, xMin: 510 }, place: "below", maxWidth: 55 },
    { get: (r) => r.business.phone, page: 1, text: "PHONE NUMBER", place: "below", maxWidth: 150 },
    { get: (r) => r.business.fax, page: 1, text: "FAX NUMBER", place: "below", maxWidth: 120 },
    { get: (r) => r.business.contactName, page: 1, text: "CONTACT NAME", place: "below", maxWidth: 110 },
    { get: (r) => r.business.contactPhone, page: 1, text: "CONTACT PHONE", place: "below", maxWidth: 120 },
    { get: (r) => r.business.email, page: 1, text: "BUSINESS EMAIL", place: "below", maxWidth: 160 },
    { get: (r) => r.business.website, page: 1, text: "WEBSITE", place: "below", maxWidth: 120 },
    { get: (r) => r.business.federalTaxId, page: 1, text: "FEDERAL TAX ID", place: "below", maxWidth: 130 },
    { get: (r) => r.business.stateIssued, page: 1, text: "STATE ISSUED", place: "below", maxWidth: 45 },
    // Length of ownership: years / months placed just before each preprinted word
    { get: (r) => raw(r.business.lengthOwnershipYears), page: 1, text: "YEARS", place: "center", absX: 466, maxWidth: 30 },
    { get: (r) => raw(r.business.lengthOwnershipMonths), page: 1, text: "MONTHS", place: "center", absX: 531, maxWidth: 34 },

    // Owner 1
    { get: (r) => r.owners[0].first, page: 1, text: "FIRST", occ: 0, place: "below", maxWidth: 90 },
    { get: (r) => r.owners[0].last, page: 1, text: "LAST", occ: 0, place: "below", maxWidth: 90 },
    { get: (r) => r.owners[0].homeAddress, page: 1, text: "HOME ADDRESS", occ: 0, place: "below", maxWidth: 170 },
    { get: (r) => r.owners[0].city, page: 1, text: "CITY", region: { yMin: 566, yMax: 574, xMin: 400, xMax: 500 }, place: "below", maxWidth: 90 },
    { get: (r) => r.owners[0].state, page: 1, text: "STATE", region: { yMin: 566, yMax: 574, xMin: 500, xMax: 545 }, place: "below", maxWidth: 40 },
    { get: (r) => r.owners[0].zip, page: 1, text: "ZIP", region: { yMin: 566, yMax: 574, xMin: 545 }, place: "below", maxWidth: 50 },
    { get: (r) => r.owners[0].title, page: 1, text: "TITLE", occ: 0, place: "below", maxWidth: 80 },
    { get: (r) => raw(r.owners[0].ownershipPct), page: 1, text: "OWNERSHIP", exact: true, occ: 0, place: "below", maxWidth: 80 },
    { get: (r) => r.owners[0].phone, page: 1, text: "TELEPHONE", occ: 0, place: "below", maxWidth: 170 },
    { get: (r) => r.owners[0].email, page: 1, text: "EMAIL", exact: true, occ: 0, place: "below", maxWidth: 170 },
    { get: (r) => r.owners[0].ssn, page: 1, text: "SOCIAL", occ: 0, place: "below", maxWidth: 180 },
    { get: (r) => r.owners[0].dob, page: 1, text: "DATE OF BIRTH", occ: 0, place: "below", size: 9, maxWidth: 130 },
    { get: (r) => r.owners[0].dlNumber, page: 1, text: "DRIVERS LICENSE", occ: 0, place: "below", maxWidth: 80 },
    { get: (r) => r.owners[0].dlState, page: 1, text: "DRIVERS LICENSE", occ: 0, absX: 505, place: "below", size: 9, maxWidth: 35 },
    { get: (r) => r.owners[0].dlExp, page: 1, text: "EXP", occ: 0, absX: 543, place: "below", size: 8, maxWidth: 62 },

    // Owner 2
    { get: (r) => r.owners[1].first, page: 1, text: "FIRST", occ: 1, place: "below", maxWidth: 90 },
    { get: (r) => r.owners[1].last, page: 1, text: "LAST", occ: 1, place: "below", maxWidth: 90 },
    { get: (r) => r.owners[1].homeAddress, page: 1, text: "HOME ADDRESS", occ: 1, place: "below", maxWidth: 170 },
    { get: (r) => r.owners[1].city, page: 1, text: "CITY", region: { yMin: 500, yMax: 508, xMin: 400, xMax: 500 }, place: "below", maxWidth: 90 },
    { get: (r) => r.owners[1].state, page: 1, text: "STATE", region: { yMin: 500, yMax: 508, xMin: 500, xMax: 545 }, place: "below", maxWidth: 40 },
    { get: (r) => r.owners[1].zip, page: 1, text: "ZIP", region: { yMin: 500, yMax: 508, xMin: 545 }, place: "below", maxWidth: 50 },
    { get: (r) => r.owners[1].title, page: 1, text: "TITLE", occ: 1, place: "below", maxWidth: 80 },
    { get: (r) => raw(r.owners[1].ownershipPct), page: 1, text: "OWNERSHIP", exact: true, occ: 1, place: "below", maxWidth: 80 },
    { get: (r) => r.owners[1].phone, page: 1, text: "TELEPHONE", occ: 1, place: "below", maxWidth: 170 },
    { get: (r) => r.owners[1].email, page: 1, text: "EMAIL", exact: true, occ: 1, place: "below", maxWidth: 170 },
    { get: (r) => r.owners[1].ssn, page: 1, text: "SOCIAL", occ: 1, place: "below", maxWidth: 180 },
    { get: (r) => r.owners[1].dob, page: 1, text: "DATE OF BIRTH", occ: 1, place: "below", size: 9, maxWidth: 130 },
    { get: (r) => r.owners[1].dlNumber, page: 1, text: "DRIVERS LICENSE", occ: 1, place: "below", maxWidth: 80 },
    { get: (r) => r.owners[1].dlState, page: 1, text: "DRIVERS LICENSE", occ: 1, absX: 505, place: "below", size: 9, maxWidth: 35 },
    { get: (r) => r.owners[1].dlExp, page: 1, text: "EXP", occ: 1, absX: 543, place: "below", size: 8, maxWidth: 62 },

    // Banking
    { get: (r) => r.banking.bankName, page: 1, text: "BANK NAME", place: "below", maxWidth: 112 },
    { get: (r) => r.banking.routing, page: 1, text: "TRANSIT", place: "below", maxWidth: 150 },
    { get: (r) => raw(r.banking.account), page: 1, text: "ACCOUNT(DDA)", place: "below", maxWidth: 130 },
    { get: (r) => r.banking.bankPhone, page: 1, text: "PHONE", region: { yMin: 415, yMax: 430 }, place: "below", maxWidth: 70 },

    // Transaction — numbers right of "$"
    { get: (r) => r.business.businessType, page: 1, text: "BUSINESS TYPE", place: "right", dx: 6, maxWidth: 88 },
    { get: (r) => r.transaction.reasonForLeaving, page: 1, text: "REASON FOR LEAVING:", place: "right", dx: 6, maxWidth: 175 },
    { get: (r) => r.business.productsSold, page: 1, text: "PRODUCT/SERVICES SOLD", place: "center", absX: 284, maxWidth: 74 },
    { get: (r) => raw(r.transaction.monthlyVolume), page: 1, text: "$", region: { yMin: 356, yMax: 364, xMin: 169, xMax: 180 }, place: "right", dx: 3, maxWidth: 90 },
    { get: (r) => raw(r.transaction.amexVolume), page: 1, text: "$", region: { yMin: 341, yMax: 349, xMin: 169, xMax: 180 }, place: "right", dx: 3, maxWidth: 90 },
    { get: (r) => raw(r.transaction.avgTicket), page: 1, text: "$", region: { yMin: 326, yMax: 334, xMin: 169, xMax: 180 }, place: "right", dx: 3, maxWidth: 90 },
    { get: (r) => raw(r.transaction.highTicket), page: 1, text: "$", region: { yMin: 311, yMax: 319, xMin: 169, xMax: 180 }, place: "right", dx: 3, maxWidth: 90 },

    // Nature of business — numbers just before each "%"
    { get: (r) => raw(r.transaction.swipePct), page: 1, text: "%", region: { yMin: 371, yMax: 379, xMin: 438, xMax: 450 }, place: "leftOf", pad: 2, maxWidth: 30 },
    { get: (r) => raw(r.transaction.motoPct), page: 1, text: "%", region: { yMin: 356, yMax: 364, xMin: 438, xMax: 450 }, place: "leftOf", pad: 2, maxWidth: 30 },
    { get: (r) => raw(r.transaction.internetPct), page: 1, text: "%", region: { yMin: 341, yMax: 349, xMin: 438, xMax: 450 }, place: "leftOf", pad: 2, maxWidth: 30 },
    { get: (r) => raw(r.transaction.salesToConsumerPct), page: 1, text: "%", region: { yMin: 371, yMax: 379, xMin: 570, xMax: 582 }, place: "leftOf", pad: 2, maxWidth: 30 },
    { get: (r) => raw(r.transaction.salesToBusinessPct), page: 1, text: "%", region: { yMin: 356, yMax: 364, xMin: 570, xMax: 582 }, place: "leftOf", pad: 2, maxWidth: 30 },
    { get: (r) => raw(r.transaction.salesToGovPct), page: 1, text: "%", region: { yMin: 341, yMax: 349, xMin: 570, xMax: 582 }, place: "leftOf", pad: 2, maxWidth: 30 },

    // Fee schedule — numbers anchored to each printed "$"
    { get: (r) => raw(r.fees.authVmcda), page: 1, text: "$", region: { yMin: 162, yMax: 170, xMin: 120, xMax: 132 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.fleet), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 120, xMax: 132 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.pinDebit), page: 1, text: "$", region: { yMin: 132, yMax: 140, xMin: 120, xMax: 132 }, place: "right", dx: 3, maxWidth: 40 },
    { get: (r) => raw(r.fees.pinDebitPct), page: 1, text: "%", region: { yMin: 132, yMax: 140, xMin: 175, xMax: 187 }, place: "leftOf", pad: 2, maxWidth: 26 },
    { get: (r) => raw(r.fees.ebt), page: 1, text: "$", region: { yMin: 117, yMax: 125, xMin: 120, xMax: 132 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.electronicAvs), page: 1, text: "$", region: { yMin: 102, yMax: 110, xMin: 120, xMax: 132 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.voiceAuth), page: 1, text: "$", region: { yMin: 87, yMax: 95, xMin: 120, xMax: 132 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.voiceAvs), page: 1, text: "$", region: { yMin: 72, yMax: 80, xMin: 120, xMax: 132 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.monthlyService), page: 1, text: "$", region: { yMin: 162, yMax: 170, xMin: 261, xMax: 272 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.monthlyMinimum), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 261, xMax: 272 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.pinDebitMonthly), page: 1, text: "$", region: { yMin: 132, yMax: 140, xMin: 261, xMax: 272 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.wireless), page: 1, text: "$", region: { yMin: 117, yMax: 125, xMin: 261, xMax: 272 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.industryCompliance), page: 1, text: "$", region: { yMin: 102, yMax: 110, xMin: 261, xMax: 272 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.basilPos), page: 1, text: "$", region: { yMin: 162, yMax: 170, xMin: 389, xMax: 400 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.saasFee), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 389, xMax: 400 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.inactivityFee), page: 1, text: "$", region: { yMin: 132, yMax: 140, xMin: 389, xMax: 400 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.gatewayMonthly), page: 1, text: "$", region: { yMin: 117, yMax: 125, xMin: 389, xMax: 400 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.monthlyMisc), page: 1, text: "$", region: { yMin: 102, yMax: 110, xMin: 389, xMax: 400 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.batch), page: 1, text: "$", region: { yMin: 87, yMax: 95, xMin: 389, xMax: 400 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.chargeback), page: 1, text: "$", region: { yMin: 162, yMax: 170, xMin: 527, xMax: 538 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.retrieval), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 527, xMax: 538 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.achReject), page: 1, text: "$", region: { yMin: 132, yMax: 140, xMin: 527, xMax: 538 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.gatewayTxn), page: 1, text: "$", region: { yMin: 117, yMax: 125, xMin: 527, xMax: 538 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.salesTxn), page: 1, text: "$", region: { yMin: 102, yMax: 110, xMin: 527, xMax: 538 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.returnTxn), page: 1, text: "$", region: { yMin: 87, yMax: 95, xMin: 527, xMax: 538 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.annual), page: 1, text: "$", region: { yMin: 72, yMax: 80, xMin: 390, xMax: 400 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => r.fees.monthToBill, page: 1, text: "Month to Bill:", place: "right", dx: 4, maxWidth: 60 },
    // Early Termination Fee — fills the "early termination fee of $____" blank in the recital line.
    { get: (r) => raw(r.fees.earlyTermination), page: 1, text: "early termination fee of", absX: 303, absY: 58, place: "right", size: 7, maxWidth: 18 },
    // Discount plan percentages (numbers before each "%")
    // Numbers go in the cell to the right of each printed "%", centered.
    { get: (r) => raw(r.serviceAcceptance.flatDebitPct), page: 1, text: "%", region: { yMin: 221, yMax: 229, xMin: 221, xMax: 233 }, place: "center", absX: 262, maxWidth: 55 },
    { get: (r) => raw(r.serviceAcceptance.flatCreditPct), page: 1, text: "%", region: { yMin: 221, yMax: 229, xMin: 364, xMax: 376 }, place: "center", absX: 405, maxWidth: 55 },
    { get: (r) => raw(r.serviceAcceptance.flatAmexPct), page: 1, text: "%", region: { yMin: 221, yMax: 229, xMin: 508, xMax: 520 }, place: "center", absX: 549, maxWidth: 60 },
    { get: (r) => raw(r.serviceAcceptance.passDebitPct), page: 1, text: "%", region: { yMin: 236, yMax: 244, xMin: 221, xMax: 233 }, place: "center", absX: 262, maxWidth: 55 },
    { get: (r) => raw(r.serviceAcceptance.passCreditPct), page: 1, text: "%", region: { yMin: 236, yMax: 244, xMin: 364, xMax: 376 }, place: "center", absX: 405, maxWidth: 55 },
    { get: (r) => raw(r.serviceAcceptance.passAmexPct), page: 1, text: "%", region: { yMin: 236, yMax: 244, xMin: 508, xMax: 520 }, place: "center", absX: 549, maxWidth: 60 },
    // Owner #1 printed name / title / date next to each signature (page 2, last page).
    // Guaranty block (Principal #1 line y≈549; print name + date y≈520).
    { get: sigName, page: 2, text: "Print Name:", region: { yMin: 516, yMax: 523, xMax: 120 }, place: "right", dx: 4, maxWidth: 170 },
    { get: sigTitle, page: 2, text: "Title:", region: { yMin: 546, yMax: 552, xMin: 230, xMax: 300 }, place: "right", dx: 4, maxWidth: 55 },
    { get: sigDate, page: 2, text: "Date:", region: { yMin: 516, yMax: 523, xMin: 230, xMax: 300 }, place: "right", dx: 4, maxWidth: 55 },
    // Acceptance block (Principal #1 line y≈248; print name + date y≈219).
    { get: sigName, page: 2, text: "Print Name:", region: { yMin: 216, yMax: 222, xMax: 120 }, place: "right", dx: 4, maxWidth: 170 },
    { get: sigTitle, page: 2, text: "Title:", region: { yMin: 245, yMax: 252, xMin: 230, xMax: 300 }, place: "right", dx: 4, maxWidth: 55 },
    { get: sigDate, page: 2, text: "Date:", region: { yMin: 216, yMax: 222, xMin: 230, xMax: 300 }, place: "right", dx: 4, maxWidth: 55 },
  ],
  check: [
    // The printed box glyph sits at x≈515.3-520.3 (center 517.8) for both rows.
    { on: (r) => r.banking.accountType === "checking", page: 1, text: "CHECKING", center: true, absX: 517.8 },
    { on: (r) => r.banking.accountType === "savings", page: 1, text: "SAVINGS", center: true, absX: 517.8 },
    { on: (r) => r.serviceAcceptance.discountPlan === "flat", page: 1, text: "Flat Rate", center: true, absX: 31 },
    { on: (r) => r.serviceAcceptance.discountPlan === "passthrough", page: 1, text: "Passthrough IC", center: true, absX: 31 },
    { on: (r) => r.serviceAcceptance.assessments === "included", page: 1, text: "INCLUDED", dx: -12 },
    { on: (r) => r.serviceAcceptance.assessments === "billed", page: 1, text: "BILLED SEPERATELY", dx: -12 },
    { on: (r) => r.serviceAcceptance.paymentMethod === "daily", page: 1, text: "DAILY", dx: -12 },
    { on: (r) => r.serviceAcceptance.paymentMethod === "monthly", page: 1, text: "MONTHLY", region: { yMin: 205, yMax: 215 }, dx: -12 },
    // Requested card types (boxes left of each label on the y≈270 row, centered)
    { on: (r) => r.serviceAcceptance.cardVisaCredit, page: 1, text: "VISA CREDIT", region: { yMin: 268, yMax: 273 }, center: true, absX: 106 },
    { on: (r) => r.serviceAcceptance.cardVisaDebit, page: 1, text: "VISA DEBIT", region: { yMin: 268, yMax: 273 }, center: true, absX: 157.5 },
    { on: (r) => r.serviceAcceptance.cardMcCredit, page: 1, text: "MASTERCARD CREDIT", region: { yMin: 268, yMax: 273 }, center: true, absX: 206 },
    { on: (r) => r.serviceAcceptance.cardMcDebit, page: 1, text: "MASTERCARD DEBIT", region: { yMin: 268, yMax: 273 }, center: true, absX: 282 },
    { on: (r) => r.serviceAcceptance.cardDiscover, page: 1, text: "DISCOVER", region: { yMin: 268, yMax: 273 }, center: true, absX: 354 },
    { on: (r) => r.serviceAcceptance.cardAmex, page: 1, text: "AMERICAN EXPRESS", region: { yMin: 268, yMax: 273 }, center: true, absX: 400 },
    { on: (r) => r.serviceAcceptance.cardPin, page: 1, text: "PIN DEBIT", region: { yMin: 268, yMax: 273 }, center: true, absX: 472 },
    { on: (r) => r.serviceAcceptance.cardEbt, page: 1, text: "EBT", region: { yMin: 268, yMax: 273 }, center: true, absX: 516.5 },
    // Type of Organization — boxes sit left of each label (one row, y≈592.7). The
    // free-text organizationType is matched to one of the six printed options.
    { on: (r) => /sole|individual|propriet/.test(orgType(r)), page: 1, text: "Sole Prop", region: { yMin: 589, yMax: 596 }, center: true, absX: 30.7 },
    { on: (r) => /partner/.test(orgType(r)) && !/ll[cp]|limited liab/.test(orgType(r)), page: 1, text: "Partnership", region: { yMin: 589, yMax: 596 }, center: true, absX: 96.6 },
    { on: (r) => /corp|\binc\b|incorporated/.test(orgType(r)) && !/ll[cp]|limited liab|non.?profit|501|govern|municip/.test(orgType(r)), page: 1, text: "Corporation", region: { yMin: 589, yMax: 596 }, center: true, absX: 139.9 },
    { on: (r) => /ll[cp]|limited liab/.test(orgType(r)), page: 1, text: "LLC", region: { yMin: 589, yMax: 596 }, center: true, absX: 184.8 },
    { on: (r) => /non.?profit|501/.test(orgType(r)), page: 1, text: "Non-Profit", region: { yMin: 589, yMax: 596 }, center: true, absX: 206.7 },
    { on: (r) => /govern|municip/.test(orgType(r)), page: 1, text: "Government", region: { yMin: 589, yMax: 596 }, center: true, absX: 302 },
    // Seasonal merchant — mark "Yes" only when flagged (single review checkbox).
    { on: (r) => r.transaction.seasonal === true, page: 1, text: "SEASONAL MERCHANT", center: true, absX: 101.2 },
  ],
  // Owner #1 "Sign Now" signature spots — both on page 2 (last page), left side:
  // the Guaranty "Principal #1" line and the Acceptance "Principal #1" line.
  sign: [
    { page: 2, x: 64, y: 537, maxW: 210, maxH: 19 },
    { page: 2, x: 66, y: 239, maxW: 205, maxH: 19 },
  ],
};

/* ----------------------------- Coversheet ----------------------------- */
// Header value lines start at x=380; merchant-info lines start at x=60.
const cs = (r) => r.coversheet || {};
// Only equipment items flagged "Add to Cover Sheet" appear here, packed into the
// coversheet's three equipment rows in order.
const csEquip = (r) => (r.equipment || []).filter((e) => e && e.onCoversheet && (e.model || e.type));
const coversheet = {
  text: [
    // Header
    { get: (r) => r.sales.salesAgentName || r.sales.salesRep, page: 1, text: "Sales Partner Name:", place: "right", absX: 384, maxWidth: 200 },
    { get: (r) => cs(r).territoryManager, page: 1, text: "Territory Manager:", place: "right", absX: 384, maxWidth: 200 },
    { get: (r) => teamName(cs(r).teamColor), page: 1, text: "Team Color:", place: "right", absX: 384, maxWidth: 200 },
    { get: (r) => r._date, page: 1, text: "Date:", region: { xMin: 260 }, place: "right", absX: 384, maxWidth: 200 },
    // Merchant info
    { get: (r) => r.business.dba, page: 1, text: "DBA:", place: "right", absX: 62, maxWidth: 200 },
    { get: (r) => r.business.email, page: 1, text: "Email:", region: { xMax: 120 }, place: "right", absX: 62, maxWidth: 200 },
    { get: (r) => r.business.federalTaxId, page: 1, text: "Tax ID:", place: "right", absX: 62, maxWidth: 200 },
    { get: (r) => r.owners[0].ssn, page: 1, text: "SSN:", region: { xMax: 120 }, place: "right", absX: 62, maxWidth: 200 },
    // Boarding ($ amounts, anchored to each printed "$")
    { get: (r) => raw(cs(r).etf), page: 1, text: "$", region: { yMin: 511, yMax: 519, xMin: 160, xMax: 172 }, place: "right", dx: 3, maxWidth: 80 },
    { get: (r) => raw(cs(r).annualFee), page: 1, text: "$", region: { yMin: 497, yMax: 505, xMin: 160, xMax: 172 }, place: "right", dx: 3, maxWidth: 80 },
    { get: (r) => raw(cs(r).monthlyMin), page: 1, text: "$", region: { yMin: 482, yMax: 490, xMin: 160, xMax: 172 }, place: "right", dx: 3, maxWidth: 80 },
    { get: (r) => raw(cs(r).svcFee), page: 1, text: "$", region: { yMin: 468, yMax: 476, xMin: 160, xMax: 172 }, place: "right", dx: 3, maxWidth: 80 },
    { get: (r) => cs(r).cashDiscountTerminalRate, page: 1, text: "Cash Discount Terminal Rate", place: "center", absX: 205, maxWidth: 120 },
    // Equipment rows (model + quantity) — only items checked "Add to Cover Sheet",
    // packed in order. Row 1 is the top row (y≈378).
    { get: (r) => (csEquip(r)[0] || {}).model || "", page: 1, text: "Model:", region: { yMin: 374, yMax: 382 }, place: "right", dx: 5, maxWidth: 195 },
    { get: (r) => (csEquip(r)[0] || {}).quantity || "", page: 1, text: "Quantity:", region: { yMin: 374, yMax: 382 }, place: "right", dx: 5, maxWidth: 55 },
    { get: (r) => (csEquip(r)[1] || {}).model || "", page: 1, text: "Model:", region: { yMin: 331, yMax: 339 }, place: "right", dx: 5, maxWidth: 195 },
    { get: (r) => (csEquip(r)[1] || {}).quantity || "", page: 1, text: "Quantity:", region: { yMin: 331, yMax: 339 }, place: "right", dx: 5, maxWidth: 55 },
    { get: (r) => (csEquip(r)[2] || {}).model || "", page: 1, text: "Model:", region: { yMin: 286, yMax: 294 }, place: "right", dx: 5, maxWidth: 195 },
    { get: (r) => (csEquip(r)[2] || {}).quantity || "", page: 1, text: "Quantity:", region: { yMin: 286, yMax: 294 }, place: "right", dx: 5, maxWidth: 55 },
    // File build / enablements / special prompts (text bits)
    { get: (r) => cs(r).fnsNumber, page: 1, text: "FNS #:", place: "right", dx: 6, maxWidth: 110 },
    { get: (r) => cs(r).autoCloseTime, page: 1, text: "Time:", region: { yMin: 224, yMax: 232, xMin: 480 }, place: "center", absX: 538, maxWidth: 80 },
    // "Other:" fill-ins (disambiguated by region)
    { get: (r) => cs(r).platformOther, page: 1, text: "Other:", region: { yMin: 561, yMax: 569, xMin: 430 }, place: "center", absX: 498, maxWidth: 70 },
    { get: (r) => cs(r).shippingOther, page: 1, text: "Other:", region: { yMin: 482, yMax: 490, xMin: 270, xMax: 330 }, place: "right", dx: 6, maxWidth: 110 },
    { get: (r) => cs(r).specialOther, page: 1, text: "Other:", region: { yMin: 181, yMax: 189, xMin: 480 }, place: "right", dx: 6, maxWidth: 90 },
    // Notes and Special Instructions (user-entered, on the blank line below the header)
    { get: (r) => cs(r).notes, page: 1, text: "Notes and Special Instructions:", absX: 24, absY: 112, place: "right", maxWidth: 540 },
  ],
  check: [
    // All boxes centered on the detected box mid-points (center: true).
    // Document checklist (boxes x≈412)
    { on: (r) => r.documents.hasVoidedCheck, page: 1, text: "Voided Check", center: true, absX: 412, dy: 1.2 },
    { on: (r) => r.documents.hasDriversLicense, page: 1, text: "Drivers License", center: true, absX: 412, dy: 1 },
    { on: (r) => cs(r).docPictures, page: 1, text: "Pictures Inside", center: true, absX: 412, dy: 1.2 },
    { on: (r) => cs(r).docStatements, page: 1, text: "Statements", center: true, absX: 412, dy: 1 },
    // Telemarketing / Re-Board (Yes x≈170.5 / No x≈219)
    { on: (r) => cs(r).telemarketing, page: 1, text: "Telemarketing Lead", center: true, absX: 170.5 },
    { on: (r) => !cs(r).telemarketing, page: 1, text: "Telemarketing Lead", center: true, absX: 219 },
    { on: (r) => cs(r).reBoard, page: 1, text: "Re-Board", center: true, absX: 170.5 },
    { on: (r) => !cs(r).reBoard, page: 1, text: "Re-Board", center: true, absX: 219 },
    // Requested platform (boxes far right x≈568)
    { on: (r) => cs(r).platform === "tsys", page: 1, text: "TSYS", center: true, absX: 568, dy: 1.7 },
    { on: (r) => cs(r).platform === "fdomaha", page: 1, text: "FD Omaha", center: true, absX: 568 },
    { on: (r) => cs(r).platform === "fdnorth", page: 1, text: "FD North", center: true, absX: 568, dy: 1.4 },
    { on: (r) => cs(r).platform === "other", page: 1, text: "Other:", region: { yMin: 561, yMax: 569, xMin: 430 }, center: true, absX: 568, dy: 2.2 },
    // Boarding Yes/No
    { on: (r) => cs(r).cashDiscount, page: 1, text: "Cash Discount:", region: { yMin: 453, yMax: 461 }, center: true, absX: 102.5 },
    { on: (r) => !cs(r).cashDiscount, page: 1, text: "Cash Discount:", region: { yMin: 453, yMax: 461 }, center: true, absX: 149.5 },
    { on: (r) => cs(r).bypassFee, page: 1, text: "Bypass Fee", center: true, absX: 125.5, dy: 1.4 },
    { on: (r) => !cs(r).bypassFee, page: 1, text: "Bypass Fee", center: true, absX: 173, dy: 1.4 },
    // Shipping (boxes x≈416)
    { on: (r) => cs(r).shipping === "dba", page: 1, text: "DBA Address", center: true, absX: 416, dy: 1.2 },
    { on: (r) => cs(r).shipping === "agent", page: 1, text: "Sales Agent Address", center: true, absX: 416, dy: 1.8 },
    { on: (r) => cs(r).shipping === "other", page: 1, text: "Other:", region: { yMin: 482, yMax: 490, xMin: 270, xMax: 330 }, center: true, absX: 416 },
    // Value added services (boxes far right x≈568)
    { on: (r) => cs(r).vasGiftCards, page: 1, text: "Gift Cards", center: true, absX: 568 },
    { on: (r) => cs(r).vasCheckServices, page: 1, text: "Check Services", center: true, absX: 568 },
    { on: (r) => cs(r).vasWpiRewards, page: 1, text: "WPI Rewards", center: true, absX: 568, dy: 1.6 },
    { on: (r) => cs(r).vasCustomerConnect, page: 1, text: "Customer Connect", center: true, absX: 568, dy: 2.6 },
    // File build — application type (boxes x≈470) + connection type (x≈568)
    { on: (r) => cs(r).fbAppType === "retail", page: 1, text: "Retail", center: true, absX: 470, dy: 1.8 },
    { on: (r) => cs(r).fbAppType === "restaurant", page: 1, text: "Restaurant", center: true, absX: 470, dy: 1 },
    { on: (r) => cs(r).fbAppType === "ecommerce", page: 1, text: "E-Commerce", center: true, absX: 470, dy: 1.8 },
    { on: (r) => cs(r).fbAppType === "moto", page: 1, text: "Moto", center: true, absX: 470 },
    { on: (r) => cs(r).fbConnection === "ethernet", page: 1, text: "Ethernet", center: true, absX: 568, dy: 1.8 },
    { on: (r) => cs(r).fbConnection === "dial", page: 1, text: "Dial", center: true, absX: 568, dy: 1.2 },
    { on: (r) => cs(r).fbConnection === "wifi", page: 1, text: "Wifi", center: true, absX: 568, dy: 1.6 },
    { on: (r) => cs(r).fbConnection === "wireless", page: 1, text: "Wireless 3g/4g", center: true, absX: 568 },
    // Enablements (boxes far right x≈568)
    { on: (r) => cs(r).enPinDebit, page: 1, text: "Pin Debit", region: { yMin: 300, yMax: 308 }, center: true, absX: 568, dy: 1.6 },
    { on: (r) => cs(r).enEbt, page: 1, text: "EBT", region: { yMin: 286, yMax: 294 }, center: true, absX: 568 },
    { on: (r) => cs(r).enWex, page: 1, text: "Wex/Voyager", center: true, absX: 568 },
    // Special prompts — auto close / server / avs / invoice (boxes x≈459)
    { on: (r) => cs(r).autoClose, page: 1, text: "Auto Close", center: true, absX: 459 },
    { on: (r) => cs(r).timezone === "pst", page: 1, text: "PST", center: true, absX: 435.5 },
    { on: (r) => cs(r).timezone === "mst", page: 1, text: "MST", center: true, absX: 468.5 },
    { on: (r) => cs(r).timezone === "cst", page: 1, text: "CST", center: true, absX: 507.5 },
    { on: (r) => cs(r).timezone === "est", page: 1, text: "EST", exact: true, center: true, absX: 541.5 },
    { on: (r) => cs(r).tips === "none", page: 1, text: "None", center: true, absX: 431 },
    { on: (r) => cs(r).tips === "tipline", page: 1, text: "Tip Line", center: true, absX: 472.5 },
    { on: (r) => cs(r).tips === "tipprompt", page: 1, text: "Tip Prompt", center: true, absX: 519.5 },
    { on: (r) => cs(r).serverNumbers, page: 1, text: "Server #", center: true, absX: 459 },
    { on: (r) => cs(r).avsCvv, page: 1, text: "AVS/CVV", center: true, absX: 459 },
    { on: (r) => cs(r).invoiceNumber, page: 1, text: "Invoice #", center: true, absX: 459 },
    // Equipment acquisition per row — ☐ Free ☐ Existing ☐ PO ☐ Rental ☐ Lease.
    // Box centers are fixed (column-aligned); each row is picked by its y-band.
    ...[359.3, 314.9, 270.5].flatMap((rowY, i) => {
      const region = { yMin: rowY - 4, yMax: rowY + 4 };
      return [["free", "Free", 31.5], ["existing", "Existing", 69.5], ["po", "PO", 123.5], ["rental", "Rental", 195.5], ["lease", "Lease", 286.5]]
        .map(([val, label, bx]) => ({
          on: (r) => (csEquip(r)[i] || {}).acquisition === val,
          page: 1, text: label, region, center: true, absX: bx, absY: rowY,
        }));
    }),
  ],
};

function ownLen(r) {
  const y = r.business.lengthOwnershipYears;
  const m = r.business.lengthOwnershipMonths;
  if (y && m) return `${y} yr ${m} mo`;
  if (y) return `${y} yr`;
  return r.business.businessStarted || "";
}

/* ----------------------------- Purchase Order ----------------------------- */
const po = (r) => r.po || {};
const eqItem = (r, i) => (r.equipment || [])[i] || {};
const eqHas = (r, i) => Boolean(eqItem(r, i).model || eqItem(r, i).type);
const eqName = (r, i) => {
  const e = eqItem(r, i);
  return [e.model, e.type && e.type !== e.model ? `(${e.type})` : ""].filter(Boolean).join(" ").trim();
};
function poSubtotal(r) {
  let s = 0;
  for (let i = 0; i < (r.equipment || []).length; i++) {
    if (!eqHas(r, i)) continue;
    const p = priceFor(eqItem(r, i).model || eqItem(r, i).type);
    // An explicit quantity of 0 zeroes the line; blank/garbage defaults to 1.
    const q = parseFloat(eqItem(r, i).quantity);
    s += (p ? p.price : 0) * (Number.isFinite(q) ? q : 1);
  }
  return s;
}
// User-entered dollar amounts may carry "$", commas, or spaces ("$1,250.50");
// strip them so the printed line and the computed total always agree.
const numOf = (v) => parseFloat(String(v ?? "").replace(/[$,\s]/g, ""));
const poTotal = (r) => poSubtotal(r) + (numOf(po(r).shCost) || 0) + (numOf(po(r).salesTax) || 0);
// Currency: round to cents and drop a trailing ".00" so totals never show binary
// float noise (e.g. 850 + 0.1 + 0.2 -> "850.30", not "850.3000000000001").
const money = (n) => { const r = Math.round((Number(n) || 0) * 100) / 100; return Number.isInteger(r) ? String(r) : r.toFixed(2); };
// Print a cleaned dollar figure next to the template's preprinted "$" (no doubled
// symbols); non-numeric entries print as typed and add nothing to the total.
const moneyStr = (v) => { const n = numOf(v); return Number.isFinite(n) ? money(n) : raw(v); };
const poAddress = (r) => {
  const b = r.business;
  return [b.locationAddress, [b.locationCity, b.locationState].filter(Boolean).join(", "), b.locationZip].filter(Boolean).join("  ");
};
const ROWY = [556, 538, 520, 502];

const purchase_order = {
  text: [
    { get: (r) => po(r).mid, page: 1, text: "Merchant MID:", place: "right", dx: 4, maxWidth: 160 },
    { get: (r) => r._date, page: 1, text: "Date:", region: { yMin: 678, yMax: 686 }, place: "right", dx: 4, maxWidth: 55 },
    { get: (r) => teamName(po(r).team || cs(r).teamColor), page: 1, text: "Team:", place: "right", dx: 4, maxWidth: 120 },
    { get: (r) => r.business.dba, page: 1, text: "Merchant DBA:", place: "right", dx: 4, maxWidth: 198 },
    { get: (r) => r.sales.salesAgentName || r.sales.salesRep, page: 1, text: "Sales Rep:", place: "right", dx: 4, maxWidth: 200 },
    { get: (r) => r.business.phone, page: 1, text: "Phone Number:", place: "right", dx: 4, maxWidth: 200 },
    { get: (r) => po(r).salesManager || cs(r).territoryManager, page: 1, text: "Sales Manager:", place: "right", dx: 4, maxWidth: 200 },
    { get: (r) => poAddress(r), page: 1, text: "Address:", place: "right", dx: 4, maxWidth: 470 },
    // Equipment line items (model | bill to | qty | price)
    ...ROWY.flatMap((y, i) => [
      { get: (r) => (eqHas(r, i) ? eqName(r, i) : ""), page: 1, text: "Equipment Type", absX: 145, absY: y, place: "center", maxWidth: 180 },
      { get: (r) => (eqHas(r, i) ? po(r).billTo || "Merchant" : ""), page: 1, text: "Bill To", absX: 248, absY: y, place: "right", maxWidth: 80 },
      { get: (r) => (eqHas(r, i) ? eqItem(r, i).quantity || "1" : ""), page: 1, text: "Quantity", absX: 362, absY: y, place: "right", maxWidth: 55 },
      { get: (r) => { if (!eqHas(r, i)) return ""; const p = priceFor(eqItem(r, i).model || eqItem(r, i).type); return p ? `$${p.price}` : ""; }, page: 1, text: "Price", absX: 450, absY: y, place: "right", maxWidth: 90 },
    ]),
    { get: (r) => (poSubtotal(r) ? money(poSubtotal(r)) : ""), page: 1, text: "Sub Total: $", place: "right", dx: 4, maxWidth: 90 },
    // Shipping
    { get: (r) => po(r).shAttention || r.business.contactName || r.business.dba, page: 1, text: "Attention To:", place: "right", dx: 4, maxWidth: 106 },
    { get: (r) => po(r).shipStreet || r.business.locationAddress, page: 1, text: "Street Address:", place: "right", dx: 4, maxWidth: 400 },
    { get: (r) => po(r).shipCity || r.business.locationCity, page: 1, text: "City:", region: { yMin: 358, yMax: 366 }, place: "right", dx: 4, maxWidth: 170 },
    { get: (r) => po(r).shipState || r.business.locationState, page: 1, text: "State:", region: { yMin: 341, yMax: 349 }, place: "right", dx: 4, maxWidth: 170 },
    { get: (r) => po(r).shipZip || r.business.locationZip, page: 1, text: "Zip:", region: { yMin: 323, yMax: 331 }, place: "right", dx: 4, maxWidth: 170 },
    // Billing (ACH from the voided check) — suppressed when paying by Credit Card.
    { get: (r) => (po(r).billingType === "cc" ? "" : r.banking.routing), page: 1, text: "Routing:", place: "right", dx: 4, maxWidth: 170 },
    { get: (r) => (po(r).billingType === "cc" ? "" : raw(r.banking.account)), page: 1, text: "Account #:", place: "right", dx: 4, maxWidth: 170 },
    { get: (r) => (po(r).billingType === "cc" ? "" : r.business.legalName || r.business.dba), page: 1, text: "Name on Account:", place: "right", dx: 4, maxWidth: 170 },
    { get: (r) => (po(r).billingType === "cc" ? "" : r.banking.bankName), page: 1, text: "Name of Bank:", place: "right", dx: 4, maxWidth: 170 },
    { get: (r) => (raw(po(r).shCost) ? moneyStr(po(r).shCost) : ""), page: 1, text: "S&H Cost: $", place: "right", dx: 4, maxWidth: 90 },
    { get: (r) => (raw(po(r).salesTax) ? moneyStr(po(r).salesTax) : ""), page: 1, text: "Sales Tax: $", place: "right", dx: 4, maxWidth: 90 },
    { get: (r) => (poTotal(r) ? money(poTotal(r)) : ""), page: 1, text: "Total Amount", absX: 432, absY: 76, place: "right", maxWidth: 110 },
  ],
  check: [
    // All boxes centered on detected box mid-points; dy raises the mark to the box's vertical center.
    { on: (r) => po(r).payPlan === "3pay", page: 1, text: "3 Pay*", center: true, absX: 98.5, dy: 2.5 },
    { on: (r) => po(r).payPlan === "4pay", page: 1, text: "4 Pay*", center: true, absX: 154.5, dy: 2.5 },
    { on: (r) => (po(r).shipTo || "dba") === "dba", page: 1, text: "Merchant DBA", region: { yMin: 391, yMax: 403 }, center: true, absX: 291, dy: 1.5 },
    { on: (r) => po(r).shipTo === "rep", page: 1, text: "Sales Rep", region: { yMin: 391, yMax: 403 }, center: true, absX: 389, dy: 1.5 },
    { on: (r) => po(r).shipTo === "other", page: 1, text: "Other", region: { yMin: 391, yMax: 403 }, center: true, absX: 479.5, dy: 2.5 },
    { on: (r) => (po(r).shippingMethod || "ground") === "ground", page: 1, text: "Ground:", center: true, absX: 242.5, dy: 2.5 },
    { on: (r) => po(r).shippingMethod === "2day", page: 1, text: "2 Day:", center: true, absX: 242.5, dy: 2.5 },
    { on: (r) => po(r).shippingMethod === "overnight", page: 1, text: "Overnight:", center: true, absX: 242.5, dy: 2.5 },
    { on: (r) => po(r).billingType === "cc", page: 1, text: "Credit Card", center: true, absX: 65.5, dy: 1.1 },
    { on: (r) => (po(r).billingType || "ach") === "ach", page: 1, text: "ACH", region: { yMin: 219, yMax: 227 }, center: true, absX: 297.5, dy: 1.1 },
  ],
  // Owner #1 "Sign Now" signature — the merchant's "Authorizing Signature" line.
  // (The "2nd Authorizing Signature" and "WPI Authorized Signature" lines are left blank.)
  sign: [
    { page: 1, x: 166, y: 96, maxW: 175, maxH: 22 },
  ],
};

/* ----------------------------- Clover Addendum ----------------------------- */
const clover_addendum = {
  text: [
    { get: (r) => r.business.legalName || r.business.dba, page: 1, text: "Business Legal Name", absX: 150, absY: 204, place: "right", maxWidth: 100 },
    { get: (r) => po(r).mid, page: 1, text: "Frontend Platform:", absX: 382, absY: 184, place: "right", maxWidth: 190 },
    { get: sigName, page: 1, text: "Name:", region: { yMin: 146, yMax: 154 }, absX: 78, absY: 150, place: "right", maxWidth: 170 },
    { get: sigTitle, page: 1, text: "Title:", absX: 72, absY: 123, place: "right", maxWidth: 170 },
    { get: sigDate, page: 1, text: "Date:", region: { yMin: 93, yMax: 101 }, absX: 72, absY: 97, place: "right", maxWidth: 170 },
    { get: (r) => r.business.email, page: 1, text: "Email:", region: { yMin: 201, yMax: 209 }, absX: 410, absY: 207, place: "right", maxWidth: 150 },
  ],
  check: [
    // No printed checkbox on this row — mark an "X" hugging the chosen platform word.
    { on: (r) => (po(r).frontendPlatform || "omaha") === "omaha", page: 1, text: "Omaha", region: { yMin: 154, yMax: 162 }, dx: -9 },
    { on: (r) => po(r).frontendPlatform === "nashville", page: 1, text: "Nashville", region: { yMin: 154, yMax: 162 }, dx: -9 },
  ],
  // Owner #1 "Sign Now" signature — the "Signature:" line above Name/Title/Date.
  sign: [
    { page: 1, x: 90, y: 168, maxW: 250, maxH: 26 },
  ],
};

/* ----------------------- Bank Account Change Request ----------------------- */
const bc = (r) => r.bankChange || {};
const bcAddress = (r) => {
  const b = r.business;
  return [b.locationAddress, [b.locationCity, b.locationState].filter(Boolean).join(", "), b.locationZip].filter(Boolean).join("  ");
};
const bank_change = {
  text: [
    // Merchant account information (reuses the application's merchant data)
    { get: (r) => r._date, page: 1, text: "DATE:", region: { yMin: 679, yMax: 687 }, place: "right", dx: 4, maxWidth: 130 },
    { get: (r) => bc(r).merchantId || po(r).mid, page: 1, text: "MERCHANT ID NUMBER:", place: "right", dx: 4, maxWidth: 165 },
    { get: (r) => full(r.owners[0]), page: 1, text: "ACCOUNT OWNER", place: "right", dx: 4, maxWidth: 320 },
    { get: (r) => r.business.legalName || r.business.dba, page: 1, text: "BUSINESS NAME:", place: "right", dx: 4, maxWidth: 360 },
    { get: (r) => bcAddress(r), page: 1, text: "BUSINESS ADDRESS:", place: "right", dx: 4, maxWidth: 340 },
    { get: (r) => r.business.phone, page: 1, text: "PHONE NUMBER:", place: "right", dx: 4, maxWidth: 360 },
    // Funding account (left column) vs Billing account (right column) — same labels,
    // disambiguated by x-region.
    { get: (r) => bc(r).fundBankName, page: 1, text: "BANK NAME:", region: { xMax: 300, yMin: 515, yMax: 523 }, place: "right", dx: 4, maxWidth: 150 },
    { get: (r) => bc(r).fundRouting, page: 1, text: "ROUTING NUMBER:", region: { xMax: 300, yMin: 492, yMax: 500 }, place: "right", dx: 4, maxWidth: 115 },
    { get: (r) => bc(r).fundAccount, page: 1, text: "ACCOUNT NUMBER:", region: { xMax: 300, yMin: 469, yMax: 477 }, place: "right", dx: 4, maxWidth: 115 },
    { get: (r) => bc(r).billBankName, page: 1, text: "BANK NAME:", region: { xMin: 305, yMin: 515, yMax: 523 }, place: "right", dx: 4, maxWidth: 150 },
    { get: (r) => bc(r).billRouting, page: 1, text: "ROUTING NUMBER:", region: { xMin: 305, yMin: 492, yMax: 500 }, place: "right", dx: 4, maxWidth: 115 },
    { get: (r) => bc(r).billAccount, page: 1, text: "ACCOUNT NUMBER:", region: { xMin: 305, yMin: 469, yMax: 477 }, place: "right", dx: 4, maxWidth: 115 },
  ],
  check: [
    // Business-address checkboxes (one row, y≈612)
    { on: (r) => bc(r).addrMatchesFile, page: 1, text: "Matches what is on file", center: true, absX: 205, absY: 611.2 },
    { on: (r) => bc(r).addrChangeLegal, page: 1, text: "Legal Entity address", center: true, absX: 362.2, absY: 611.2 },
    { on: (r) => bc(r).addrChangeDba, page: 1, text: "address on file, check here", center: true, absX: 527.8, absY: 611.2 },
    // TSYS-only: settle chargebacks/reversals to the funding account
    { on: (r) => bc(r).settleChargebacksToFunding, page: 1, text: "By selecting here", center: true, absX: 82, absY: 447 },
    // Validation documents provided (y≈409)
    { on: (r) => bc(r).docVoidedCheck, page: 1, text: "VOIDED CHECK", center: true, absX: 83, absY: 404 },
    { on: (r) => bc(r).docBankLetter, page: 1, text: "BANK LETTER", region: { yMin: 398, yMax: 406 }, center: true, absX: 239, absY: 404 },
    { on: (r) => bc(r).docBankStatement, page: 1, text: "BANK STATEMENT", region: { yMin: 398, yMax: 406 }, center: true, absX: 395, absY: 404 },
  ],
  // Owner #1 "Sign Now" signature — the "Merchant Owner's Signature:" line.
  sign: [
    { page: 1, x: 256, y: 117, maxW: 260, maxH: 26 },
  ],
};

// FD North (Priority / Synovus Bank) uses a template that is layout-identical to the
// Citizens application across all three pages, so it reuses the Citizens field map
// verbatim (verified: every Citizens anchor resolves at the same coordinates on FD North).
// NOTE for future audits: the FD North PDF'S TEXT LAYER contains invisible amounts in
// several fee cells (Chargeback "25", Retrieval "10", ACH Reject "30", Annual "95",
// ETF "295", TIN "$49") — leftover artifacts that do NOT rasterize; the cells are
// visually blank on the rendered template, so filling them is correct. A text-layer
// overlap there is a false positive, not an overprint.
const fd_north = citizens;


/* ================= PB&T Bank (Priority PPS0622v3, 6 pages) ================= */
// Priority "Merchant Processing Application and Agreement" for The Pueblo Bank
// and Trust Company (PB&T Bank). Its own 6-page layout — not shared with any
// other template. Labels in this PDF are fragmented into word-pieces, so specs
// anchor on a distinctive fragment plus a tight region.
const own = (r, i) => (r.owners || [])[i] || {};
const csz = (o) => [ [o.city, o.state].filter(Boolean).join(", "), o.zip ].filter(Boolean).join(" ");
const eqCat = (m) => { const p = priceFor(m); if (!p) return ""; const hit = MODELS.find((x) => x.model === p.model); return hit ? hit.category : ""; };
const bizType = (r) => raw(r.business.businessType).toLowerCase();
// PB&T business-type boxes: regex per printed option; unmatched non-empty -> Other.
const BIZ_RULES = [
  [/retail/, "Retail", 101.9, 282.6],
  [/restaurant|cafe|diner/, "Restaurant", 169.1, 282.6],
  [/internet|e-?comm|online|web/, "Internet", 223.9, 282.6],
  [/government|municip/, "Government", 289.5, 282.6],
  [/lodging|hotel|motel/, "Lodging", 353.8, 282.6],
  [/supermarket|grocery/, "Supermarket", 399.6, 282.6],
  [/mail|telephone order|moto/, "Mail/Telephone Order", 494, 282.6],
  [/petroleum|gas|fuel/, "Petroleum", 100.7, 265.6],
  [/utilit/, "Utilities", 167.2, 265.6],
  [/health|medical|clinic|dental/, "Healthcare", 222.2, 265.6],
  [/education|school|tutor/, "Education", 290.1, 265.6],
  [/qsr|quick serve|fast food/, "QSR", 354.6, 265.6],
  [/charity|non.?profit/, "Charity/Non Profit", 399.8, 265.6],
  [/b2b|business to business|wholesale/, "B2B", 495.3, 265.6],
];
const bizMatched = (r) => BIZ_RULES.some(([re]) => re.test(bizType(r)));
const pbtLenOwn = (r) => {
  const y = raw(r.business.lengthOwnershipYears), m = raw(r.business.lengthOwnershipMonths);
  return [y && `${y} yr`, m && `${m} mo`].filter(Boolean).join(" ");
};
const pbt = {
  text: [
    /* ---- p1 header ---- */
    { get: (r) => raw(r.sales.salesAgentName) || raw(r.sales.salesRep), page: 1, text: "Sales Rep Name", place: "right", dx: 8, maxWidth: 115 },
    { get: sigDate, page: 1, text: "Application Date", place: "right", dx: 8, maxWidth: 105 },
    /* ---- p1 sections 1-3 ---- */
    { get: (r) => r.business.dba, page: 1, text: "Client's Business Name", place: "below", dy: -12, dx: 2, maxWidth: 280 },
    { get: (r) => r.business.legalName, page: 1, text: "Client's Corporate/Legal Name", place: "below", dy: -12, dx: 2, maxWidth: 260 },
    { get: (r) => r.business.locationAddress, page: 1, text: "Location", region: { yMin: 669, yMax: 678, xMax: 60 }, place: "below", dy: -12, dx: 2, maxWidth: 280 },
    { get: (r) => r.business.corpAddress, page: 1, text: "Corporate", region: { yMin: 669, yMax: 678, xMin: 315 }, place: "below", dy: -12, dx: 2, maxWidth: 270 },
    { get: (r) => r.business.locationCity, page: 1, text: "City", region: { yMin: 649, yMax: 658, xMax: 50 }, place: "below", dy: -11, dx: 2, maxWidth: 150 },
    { get: (r) => r.business.locationState, page: 1, text: "State", region: { yMin: 649, yMax: 658, xMin: 180, xMax: 212 }, place: "below", dy: -11, dx: 2, maxWidth: 55 },
    { get: (r) => r.business.locationZip, page: 1, text: "Zip", region: { yMin: 649, yMax: 658, xMin: 250, xMax: 275 }, place: "below", dy: -11, dx: 2, maxWidth: 55 },
    { get: (r) => r.business.corpCity, page: 1, text: "City", region: { yMin: 649, yMax: 658, xMin: 315, xMax: 340 }, place: "below", dy: -11, dx: 2, maxWidth: 140 },
    { get: (r) => r.business.corpState, page: 1, text: "State", region: { yMin: 649, yMax: 658, xMin: 465, xMax: 492 }, place: "below", dy: -11, dx: 2, maxWidth: 55 },
    { get: (r) => r.business.corpZip, page: 1, text: "Zip", region: { yMin: 649, yMax: 658, xMin: 530 }, place: "below", dy: -11, dx: 2, maxWidth: 50 },
    { get: (r) => r.business.phone, page: 1, text: "Location", region: { yMin: 629, yMax: 638, xMax: 60 }, place: "below", dy: -10.5, dx: 2, maxWidth: 150 },
    { get: (r) => r.business.fax, page: 1, text: "Location", region: { yMin: 629, yMax: 638, xMin: 180, xMax: 215 }, place: "below", dy: -10.5, dx: 2, maxWidth: 120 },
    { get: (r) => r.business.contactName, page: 1, text: "Contact", region: { yMin: 629, yMax: 638, xMin: 315, xMax: 350 }, place: "below", dy: -10.5, dx: 2, maxWidth: 140 },
    { get: (r) => r.business.contactPhone, page: 1, text: "Contact", region: { yMin: 629, yMax: 638, xMin: 465 }, place: "below", dy: -10.5, dx: 2, maxWidth: 110 },
    { get: (r) => r.business.customerServicePhone, page: 1, text: "Customer", region: { yMin: 610, yMax: 619 }, place: "below", dy: -12, dx: 2, maxWidth: 150 },
    { get: (r) => r.business.email, page: 1, text: "Business", region: { yMin: 610, yMax: 618, xMin: 315, xMax: 355 }, place: "below", dy: -12, dx: 2, maxWidth: 140 },
    { get: (r) => raw(r.business.dnb), page: 1, text: "D&B#", place: "below", dy: -12, dx: 2, maxWidth: 100 },
    { get: (r) => r.business.website, page: 1, text: "Business", region: { yMin: 589, yMax: 597, xMax: 60 }, place: "below", dy: -12, dx: 2, maxWidth: 270 },
    { get: (r) => raw(r.business.federalTaxId), page: 1, text: "Fed", region: { yMin: 589, yMax: 597 }, place: "below", dy: -12, dx: 2, maxWidth: 130 },
    { get: (r) => r.business.taxType, page: 1, text: "Tax Type", region: { yMin: 586, yMax: 595 }, place: "below", dy: -12, dx: 2, maxWidth: 100 },
    { get: (r) => r.business.taxFilingName, page: 1, text: "Tax Filing Name", place: "below", dy: -12, dx: 2, maxWidth: 250 },
    { get: (r) => r.business.businessStarted, page: 1, text: "Date Business Started", place: "below", dy: -12, dx: 2, maxWidth: 130 },
    { get: pbtLenOwn, page: 1, text: "Length Current Ownership", place: "below", dy: -12, dx: 2, maxWidth: 105 },
    { get: (r) => raw(r.business.stateIssued), page: 1, text: "State Filing:", place: "center", absX: 572.5, dy: 0, size: 7, maxWidth: 20 },
    /* ---- p1 section 4: owners ---- */
    { get: (r) => full(own(r, 0)), page: 1, text: "Name", region: { yMin: 447, yMax: 456, xMax: 50 }, place: "below", dy: -11, dx: 2, maxWidth: 175 },
    { get: (r) => full(own(r, 1)), page: 1, text: "Name", region: { yMin: 447, yMax: 456, xMin: 210, xMax: 240 }, place: "below", dy: -11, dx: 2, maxWidth: 175 },
    { get: (r) => own(r, 0).title, page: 1, text: "Title", region: { yMin: 428, yMax: 437, xMax: 45 }, place: "right", dx: 8, maxWidth: 95 },
    { get: (r) => own(r, 1).title, page: 1, text: "Title", region: { yMin: 428, yMax: 437, xMin: 210, xMax: 232 }, place: "right", dx: 8, maxWidth: 95 },
    { get: (r) => raw(own(r, 0).ownershipPct), page: 1, text: "Ownership", region: { yMin: 428, yMax: 437, xMin: 150, xMax: 195 }, place: "below", dy: -8.2, dx: 6, size: 7, maxWidth: 35 },
    { get: (r) => raw(own(r, 1).ownershipPct), page: 1, text: "Ownership", region: { yMin: 428, yMax: 437, xMin: 348, xMax: 392 }, place: "below", dy: -8.2, dx: 6, size: 7, maxWidth: 35 },
    { get: (r) => own(r, 0).homeAddress, page: 1, text: "Home", region: { yMin: 413, yMax: 421, xMax: 50 }, place: "below", dy: -11, dx: 2, maxWidth: 180 },
    { get: (r) => own(r, 1).homeAddress, page: 1, text: "Home", region: { yMin: 413, yMax: 421, xMin: 210, xMax: 237 }, place: "below", dy: -11, dx: 2, maxWidth: 180 },
    { get: (r) => own(r, 0).city, page: 1, text: "City", region: { yMin: 394, yMax: 403, xMax: 45 }, place: "below", dy: -11, dx: 2, maxWidth: 92 },
    { get: (r) => own(r, 0).state, page: 1, text: "State", region: { yMin: 394, yMax: 403, xMin: 120, xMax: 150 }, place: "below", dy: -11, dx: 2, maxWidth: 38 },
    { get: (r) => raw(own(r, 0).zip), page: 1, text: "Zip", region: { yMin: 394, yMax: 403, xMin: 163, xMax: 185 }, place: "below", dy: -11, dx: 2, maxWidth: 42 },
    { get: (r) => own(r, 1).city, page: 1, text: "City", region: { yMin: 394, yMax: 403, xMin: 210, xMax: 230 }, place: "below", dy: -11, dx: 2, maxWidth: 92 },
    { get: (r) => own(r, 1).state, page: 1, text: "State", region: { yMin: 394, yMax: 403, xMin: 328, xMax: 352 }, place: "below", dy: -11, dx: 2, maxWidth: 30 },
    { get: (r) => raw(own(r, 1).zip), page: 1, text: "Zip", region: { yMin: 394, yMax: 403, xMin: 358, xMax: 378 }, place: "below", dy: -11, dx: 2, maxWidth: 40 },
    { get: (r) => own(r, 0).phone, page: 1, text: "Telephone", region: { yMin: 374, yMax: 383, xMax: 65 }, place: "below", dy: -11, dx: 2, size: 8, maxWidth: 64 },
    { get: (r) => own(r, 1).phone, page: 1, text: "Telephone", region: { yMin: 374, yMax: 383, xMin: 210, xMax: 250 }, place: "below", dy: -11, dx: 2, size: 8, maxWidth: 64 },
    { get: (r) => raw(own(r, 0).dlNumber), page: 1, text: "DL/ID#", region: { yMin: 374, yMax: 383, xMax: 125 }, place: "below", dy: -11, dx: 0, size: 7, maxWidth: 34 },
    { get: (r) => raw(own(r, 1).dlNumber), page: 1, text: "DL/ID#", region: { yMin: 374, yMax: 383, xMin: 279, xMax: 308 }, place: "below", dy: -11, dx: 0, size: 7, maxWidth: 34 },
    { get: (r) => own(r, 0).dlState, page: 1, text: "Issued State", region: { yMin: 374, yMax: 383, xMax: 200 }, place: "below", dy: -11, dx: 0, size: 7, maxWidth: 42 },
    { get: (r) => own(r, 1).dlState, page: 1, text: "Issued State", region: { yMin: 374, yMax: 383, xMin: 315, xMax: 362 }, place: "below", dy: -11, dx: 0, size: 7, maxWidth: 42 },
    { get: (r) => own(r, 0).dlExp, page: 1, text: "Exp Date", region: { yMin: 374, yMax: 383, xMax: 210 }, place: "below", dy: -11, dx: 0, size: 7, maxWidth: 33 },
    { get: (r) => own(r, 1).dlExp, page: 1, text: "Exp Date", region: { yMin: 374, yMax: 383, xMin: 360, xMax: 397 }, place: "below", dy: -11, dx: 0, size: 7, maxWidth: 33 },
    { get: (r) => raw(own(r, 0).ssn), page: 1, text: "Social", region: { yMin: 355, yMax: 364, xMax: 50 }, place: "below", dy: -11, dx: 2, maxWidth: 120 },
    { get: (r) => raw(own(r, 1).ssn), page: 1, text: "Social", region: { yMin: 355, yMax: 364, xMin: 210, xMax: 236 }, place: "below", dy: -11, dx: 2, maxWidth: 120 },
    { get: (r) => own(r, 0).dob, page: 1, text: "Date", region: { yMin: 355, yMax: 364, xMin: 148, xMax: 170 }, place: "below", dy: -11, dx: 2, maxWidth: 58 },
    { get: (r) => own(r, 1).dob, page: 1, text: "Date", region: { yMin: 355, yMax: 364, xMin: 341, xMax: 364 }, place: "below", dy: -11, dx: 2, maxWidth: 55 },
    { get: (r) => own(r, 0).email, page: 1, text: "Email", region: { yMin: 336, yMax: 345, xMax: 50 }, place: "below", dy: -11, dx: 2, maxWidth: 180 },
    { get: (r) => own(r, 1).email, page: 1, text: "Email", region: { yMin: 336, yMax: 345, xMin: 210, xMax: 235 }, place: "below", dy: -11, dx: 2, maxWidth: 180 },
    /* ---- p1 sections 6-7 ---- */
    { get: (r) => raw(r.transaction.monthlyVolume), page: 1, text: "Requested Monthly Payment Card Volume", place: "right", dx: 8, maxWidth: 140 },
    { get: (r) => raw(r.transaction.avgTicket), page: 1, text: "Requested Average Payment Card Ticket", place: "right", dx: 8, maxWidth: 140 },
    { get: (r) => raw(r.transaction.highTicket), page: 1, text: "Requested Highest Payment Card Ticket", place: "right", dx: 8, maxWidth: 140 },
    { get: (r) => raw(r.transaction.swipePct), page: 1, text: "Card Present Swiped", place: "right", dx: 8, maxWidth: 55 },
    { get: (r) => raw(r.transaction.motoPct), page: 1, text: "MOTO", region: { yMin: 205, yMax: 214, xMin: 315 }, place: "right", dx: 8, maxWidth: 55 },
    { get: (r) => raw(r.transaction.internetPct), page: 1, text: "Internet (Ecommerce)", place: "right", dx: 8, maxWidth: 50 },
    { get: (r) => raw(r.transaction.salesToConsumerPct), page: 1, text: "Sales to Consumers", place: "right", dx: 8, maxWidth: 42 },
    { get: (r) => raw(r.transaction.salesToBusinessPct), page: 1, text: "Sales to Business", place: "right", dx: 8, maxWidth: 42 },
    { get: (r) => raw(r.transaction.salesToGovPct), page: 1, text: "Sales to Govt.", place: "right", dx: 8, maxWidth: 42 },
    { get: (r) => r.transaction.previousProcessor, page: 1, text: "Previous Processor", place: "right", dx: 8, maxWidth: 170 },
    { get: (r) => r.transaction.reasonForLeaving, page: 1, text: "Leaving", region: { yMin: 147, yMax: 155 }, place: "right", dx: 6, maxWidth: 185 },
    { get: (r) => r.business.productsSold, page: 1, text: "Description", region: { yMin: 137, yMax: 146 }, place: "below", dy: -13, dx: 2, maxWidth: 545 },
    /* ---- p1 section 8 banking ---- */
    { get: (r) => r.banking.bankName, page: 1, text: "Deposit Bank Name", place: "below", dy: -12, dx: 2, maxWidth: 195 },
    { get: (r) => raw(r.banking.routing), page: 1, text: "Routing#", region: { yMin: 73, yMax: 82, xMin: 230, xMax: 270 }, place: "below", dy: -12, dx: 2, maxWidth: 78 },
    { get: (r) => raw(r.banking.account), page: 1, text: "Account#", region: { yMin: 73, yMax: 82, xMin: 315, xMax: 360 }, place: "below", dy: -12, dx: 2, maxWidth: 115 },
    /* ---- p2 discount plan grid ---- */
    { get: (r) => (r.serviceAcceptance.discountPlan === "flat" ? raw(r.serviceAcceptance.flatCreditPct) : ""), page: 2, text: "Credit Qual", occ: 0, region: { yMin: 596, yMax: 605 }, place: "center", absX: 127, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "flat" ? raw(r.serviceAcceptance.flatCreditPct) : ""), page: 2, text: "Credit Qual", occ: 1, region: { yMin: 596, yMax: 605 }, place: "center", absX: 313, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "flat" ? raw(r.serviceAcceptance.flatCreditPct) : ""), page: 2, text: "Credit Qual", occ: 2, region: { yMin: 596, yMax: 605 }, place: "center", absX: 505, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "flat" ? raw(r.serviceAcceptance.flatDebitPct) : ""), page: 2, text: "CheckCard Qual", occ: 0, place: "center", absX: 127, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "flat" ? raw(r.serviceAcceptance.flatDebitPct) : ""), page: 2, text: "CheckCard Qual", occ: 1, place: "center", absX: 313, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "flat" ? raw(r.serviceAcceptance.flatDebitPct) : ""), page: 2, text: "CheckCard Qual", occ: 2, place: "center", absX: 505, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "passthrough" ? raw(r.serviceAcceptance.passCreditPct) : ""), page: 2, text: "Credit Pass Through IC", occ: 0, region: { yMin: 500, yMax: 515 }, place: "center", absX: 127, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "passthrough" ? raw(r.serviceAcceptance.passCreditPct) : ""), page: 2, text: "Credit Pass Through IC", occ: 1, region: { yMin: 500, yMax: 515 }, place: "center", absX: 313, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "passthrough" ? raw(r.serviceAcceptance.passCreditPct) : ""), page: 2, text: "Credit Pass Through IC", occ: 2, region: { yMin: 500, yMax: 515 }, place: "center", absX: 505, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "passthrough" ? raw(r.serviceAcceptance.passDebitPct) : ""), page: 2, text: "CheckCard Pass", occ: 0, place: "center", absX: 127, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "passthrough" ? raw(r.serviceAcceptance.passDebitPct) : ""), page: 2, text: "CheckCard Pass", occ: 1, place: "center", absX: 313, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "passthrough" ? raw(r.serviceAcceptance.passDebitPct) : ""), page: 2, text: "CheckCard Pass", occ: 2, place: "center", absX: 505, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "flat" ? raw(r.serviceAcceptance.flatAmexPct) : ""), page: 2, text: "Credit Qual", region: { yMin: 370, yMax: 380 }, place: "center", absX: 127, maxWidth: 40 },
    { get: (r) => (r.serviceAcceptance.discountPlan === "passthrough" ? raw(r.serviceAcceptance.passAmexPct) : ""), page: 2, text: "Credit Pass Through IC", region: { yMin: 316, yMax: 326 }, place: "center", absX: 127, maxWidth: 40 },
    { get: (r) => raw(r.fees.pinDebitPct), page: 2, text: "%", region: { yMin: 651, yMax: 659, xMin: 235, xMax: 255 }, place: "leftOf", pad: 3, maxWidth: 22 },
    { get: (r) => raw(r.transaction.amexVolume), page: 2, text: "ard Volume", place: "center", absX: 350, maxWidth: 100 },
    /* ---- p2 authorization fees ---- */
    { get: (r) => raw(r.fees.authVmcda), page: 2, text: "Visa/MC/Discover Network", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.fleet), page: 2, text: "Amex/Fleet/Other", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.pinDebit), page: 2, text: "Pin Debit Authorization", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.ebt), page: 2, text: "EBT Authorization", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.electronicAvs), page: 2, text: "Electronic AVS", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.voiceAuth), page: 2, text: "Voice Authorization", place: "right", dx: 10, maxWidth: 50 },
    { get: (r) => raw(r.fees.voiceAvs), page: 2, text: "Voice AVS", region: { yMin: 147, yMax: 156, xMin: 175 }, place: "right", dx: 10, maxWidth: 55 },
    /* ---- p2 monthly fees ---- */
    { get: (r) => raw(r.fees.monthlyMinimum), page: 2, text: "Monthly Minimum", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.wireless), page: 2, text: "Wireless Fee", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.pinDebitMonthly), page: 2, text: "PIN Debit Fee", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.industryCompliance), page: 2, text: "Industry Compliance", place: "right", dx: 10, maxWidth: 48 },
    { get: (r) => raw(r.fees.monthlyService), page: 2, text: "Monthly Service Fee", place: "right", dx: 10, maxWidth: 45 },
    { get: (r) => raw(r.fees.monthlyMisc), page: 2, text: "Misc Monthly Fee", place: "right", dx: 10, maxWidth: 48 },
    /* ---- p2 miscellaneous fees ---- */
    { get: (r) => raw(r.fees.salesTxn), page: 2, text: "Sales Transaction Fee", place: "right", dx: 10, maxWidth: 60 },
    { get: (r) => raw(r.fees.retrieval), page: 2, text: "(All card types)", region: { yMin: 82, yMax: 91 }, place: "right", dx: 8, maxWidth: 58 },
    { get: (r) => raw(r.fees.batch), page: 2, text: "Batch Fee", region: { yMin: 69, yMax: 78 }, place: "right", dx: 10, maxWidth: 95 },
    { get: (r) => raw(r.fees.achReject), page: 2, text: "ACH Reject", place: "right", dx: 10, maxWidth: 95 },
    { get: (r) => raw(r.fees.chargeback), page: 2, text: "Chargeback Fee", place: "right", dx: 10, maxWidth: 48 },
    { get: (r) => raw(r.fees.returnTxn), page: 2, text: "Return Transaction Fee", place: "right", dx: 10, maxWidth: 38 },
    { get: (r) => raw(r.fees.annual), page: 2, text: "Annual Fee", region: { yMin: 68, yMax: 76, xMin: 210 }, place: "right", dx: 10, maxWidth: 70 },
    { get: (r) => raw(r.fees.monthToBill), page: 2, text: "Annual Fee Bill Month", place: "right", dx: 10, maxWidth: 55 },
    { get: (r) => raw(r.fees.earlyTermination), page: 2, text: "early", region: { yMin: 37, yMax: 46, xMin: 285, xMax: 305 }, place: "center", absX: 278.5, size: 7, maxWidth: 18 },
    /* ---- p3 equipment ---- */
    { get: (r) => cs(r).autoCloseTime, page: 3, text: "If yes, time?", place: "right", dx: 6, maxWidth: 70 },
    { get: (r) => eqItem(r, 0).model || eqItem(r, 0).type || "", page: 3, text: "Terminal", occ: 0, region: { yMin: 519, yMax: 528 }, place: "center", absX: 248, size: 7.5, maxWidth: 100 },
    { get: (r) => eqItem(r, 1).model || eqItem(r, 1).type || "", page: 3, text: "Terminal", occ: 0, region: { yMin: 507, yMax: 516 }, place: "center", absX: 248, size: 7.5, maxWidth: 100 },
    { get: (r) => eqItem(r, 2).model || eqItem(r, 2).type || "", page: 3, text: "Terminal", occ: 0, region: { yMin: 495, yMax: 504 }, place: "center", absX: 248, size: 7.5, maxWidth: 100 },
    { get: (r) => eqItem(r, 3).model || eqItem(r, 3).type || "", page: 3, text: "Terminal", occ: 0, region: { yMin: 483, yMax: 492 }, place: "center", absX: 248, size: 7.5, maxWidth: 100 },
    { get: (r) => (eqHas(r, 0) ? raw(eqItem(r, 0).quantity) || "1" : ""), page: 3, text: "Terminal", occ: 0, region: { yMin: 519, yMax: 528 }, place: "center", absX: 327, size: 7.5, maxWidth: 40 },
    { get: (r) => (eqHas(r, 1) ? raw(eqItem(r, 1).quantity) || "1" : ""), page: 3, text: "Terminal", occ: 0, region: { yMin: 507, yMax: 516 }, place: "center", absX: 327, size: 7.5, maxWidth: 40 },
    { get: (r) => (eqHas(r, 2) ? raw(eqItem(r, 2).quantity) || "1" : ""), page: 3, text: "Terminal", occ: 0, region: { yMin: 495, yMax: 504 }, place: "center", absX: 327, size: 7.5, maxWidth: 40 },
    { get: (r) => (eqHas(r, 3) ? raw(eqItem(r, 3).quantity) || "1" : ""), page: 3, text: "Terminal", occ: 0, region: { yMin: 483, yMax: 492 }, place: "center", absX: 327, size: 7.5, maxWidth: 40 },
    /* ---- p4 signatures ---- */
    { get: (r) => raw(r.sales.salesAgentName) || raw(r.sales.salesRep), page: 4, text: "Sales Agent Name (printed)", place: "right", dx: 10, maxWidth: 190 },
    { get: sigTitle, page: 4, text: "Title", region: { yMin: 317, yMax: 326 }, place: "right", dx: 8, maxWidth: 130 },
    { get: sigName, page: 4, text: "Print", region: { yMin: 295, yMax: 304, xMax: 45 }, place: "right", dx: 62, maxWidth: 235 },
    { get: sigDate, page: 4, text: "Date", region: { yMin: 295, yMax: 304, xMin: 350 }, place: "right", dx: 8, maxWidth: 120 },
    { get: (r) => raw(r.signatures.title2) || raw(own(r, 1).title), page: 4, text: "Title", region: { yMin: 272, yMax: 281 }, place: "right", dx: 8, maxWidth: 130 },
    { get: (r) => raw(r.signatures.printedName2) || full(own(r, 1)), page: 4, text: "Print", region: { yMin: 250, yMax: 259, xMax: 45 }, place: "right", dx: 62, maxWidth: 235 },
    { get: (r) => (raw(r.signatures.printedName2) || full(own(r, 1)) ? raw(r.signatures.date2) || sigDate(r) : ""), page: 4, text: "Date", region: { yMin: 250, yMax: 259, xMin: 350 }, place: "right", dx: 8, maxWidth: 120 },
    { get: sigName, page: 4, text: "Print Name:", region: { yMin: 158, yMax: 167 }, place: "right", dx: 6, maxWidth: 125 },
    { get: sigDate, page: 4, text: "Date", region: { yMin: 158, yMax: 167, xMin: 430 }, place: "right", dx: 6, maxWidth: 95 },
    { get: (r) => raw(r.signatures.printedName2) || full(own(r, 1)), page: 4, text: "Print Name:", region: { yMin: 122, yMax: 131 }, place: "right", dx: 6, maxWidth: 125 },
    { get: (r) => (raw(r.signatures.printedName2) || full(own(r, 1)) ? raw(r.signatures.date2) || sigDate(r) : ""), page: 4, text: "Date", region: { yMin: 122, yMax: 131, xMin: 430 }, place: "right", dx: 6, maxWidth: 95 },
    /* ---- p5 confirmation ---- */
    { get: (r) => r.business.legalName || r.business.dba, page: 5, text: "Legal Name:", place: "right", dx: 8, maxWidth: 220 },
    { get: sigName, page: 5, text: "Please", region: { yMin: 122, yMax: 131 }, place: "right", absX: 40, absY: 140.5, maxWidth: 175 },
    { get: sigTitle, page: 5, text: "Please", region: { yMin: 122, yMax: 131 }, place: "right", absX: 225, absY: 140.5, maxWidth: 115 },
    { get: sigDate, page: 5, text: "Please", region: { yMin: 122, yMax: 131 }, place: "right", absX: 356, absY: 140.5, maxWidth: 90 },
    /* ---- p6 beneficial ownership ---- */
    { get: sigDate, page: 6, text: "Date Application Signed", place: "right", dx: 6, maxWidth: 95 },
    { get: (r) => r.business.legalName || r.business.dba, page: 6, text: "Merchant Legal Name:", place: "right", dx: 4, size: 7, maxWidth: 102 },
    { get: (r) => raw(r.business.federalTaxId), page: 6, text: "Merchant Federal Tax ID", place: "right", dx: 4, size: 7, maxWidth: 46 },
    { get: (r) => [r.business.locationAddress, csz({ city: r.business.locationCity, state: r.business.locationState, zip: r.business.locationZip })].filter(Boolean).join(", "), page: 6, text: "Address:", region: { yMin: 605, yMax: 613, xMax: 90 }, place: "right", dx: 4, maxWidth: 330 },
    { get: (r) => raw(r.business.organizationType), page: 6, text: "Merchant Entity Type", place: "right", dx: 4, size: 7, maxWidth: 88 },
    // owner block 1 (owners[0]) — labels y: name 535.3 / addr 516.4 / ssn 495.7 / id 475.0
    { get: (r) => full(own(r, 0)), page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 36, absY: 524, size: 8, maxWidth: 235 },
    { get: (r) => own(r, 0).title, page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 283, absY: 524, size: 8, maxWidth: 200 },
    { get: (r) => raw(own(r, 0).ownershipPct), page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "center", absX: 540, absY: 526, size: 7, maxWidth: 16 },
    { get: (r) => own(r, 0).homeAddress, page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 36, absY: 505, size: 8, maxWidth: 235 },
    { get: (r) => csz(own(r, 0)), page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 283, absY: 505, size: 8, maxWidth: 205 },
    { get: (r) => own(r, 0).dob, page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 499, absY: 505, size: 8, maxWidth: 85 },
    { get: (r) => raw(own(r, 0).ssn), page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 283, absY: 484, size: 8, maxWidth: 200 },
    { get: (r) => own(r, 0).dlState, page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 283, absY: 464, size: 8, maxWidth: 88 },
    { get: (r) => own(r, 0).dlExp, page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 431, absY: 464, size: 7, maxWidth: 60 },
    { get: (r) => raw(own(r, 0).dlNumber), page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 499, absY: 464, size: 7, maxWidth: 85 },
    // owner block 2 (owners[1]) — labels y: name 453.9 / addr 434.9 / ssn 415.7 / id 393.5
    { get: (r) => full(own(r, 1)), page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 36, absY: 442.5, size: 8, maxWidth: 235 },
    { get: (r) => own(r, 1).title, page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 283, absY: 442.5, size: 8, maxWidth: 200 },
    { get: (r) => raw(own(r, 1).ownershipPct), page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "center", absX: 540, absY: 444.5, size: 7, maxWidth: 16 },
    { get: (r) => own(r, 1).homeAddress, page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 36, absY: 423.5, size: 8, maxWidth: 235 },
    { get: (r) => csz(own(r, 1)), page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 283, absY: 423.5, size: 8, maxWidth: 205 },
    { get: (r) => own(r, 1).dob, page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 499, absY: 423.5, size: 8, maxWidth: 85 },
    { get: (r) => raw(own(r, 1).ssn), page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 283, absY: 404, size: 8, maxWidth: 200 },
    { get: (r) => own(r, 1).dlState, page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 283, absY: 382, size: 8, maxWidth: 88 },
    { get: (r) => own(r, 1).dlExp, page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 431, absY: 382, size: 7, maxWidth: 60 },
    { get: (r) => raw(own(r, 1).dlNumber), page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, place: "right", absX: 499, absY: 382, size: 7, maxWidth: 85 },
    // bottom certification
    { get: sigDate, page: 6, text: "Signed", region: { yMin: 24, yMax: 32, xMax: 175 }, place: "right", absX: 137, absY: 39.5, size: 7, maxWidth: 45 },
    { get: sigName, page: 6, text: "Printed", region: { yMin: 24, yMax: 32, xMax: 275 }, place: "right", absX: 186, absY: 39.5, size: 7, maxWidth: 100 },
  ],
  check: [
    /* p1 org type (boxes ~11pt left of labels, measured from template) */
    { on: (r) => /sole|individual|propriet/.test(orgType(r)), page: 1, text: "Sole Prop", center: true, absX: 37.3, dy: 0 },
    { on: (r) => /partner/.test(orgType(r)) && !/ll[cp]|limited liab/.test(orgType(r)), page: 1, text: "Partnership", region: { yMin: 508, yMax: 516 }, center: true, absX: 102.3 },
    { on: (r) => /ll[cp]|limited liab/.test(orgType(r)), page: 1, text: "LLC/LLP", center: true, absX: 174 },
    { on: (r) => /corp|\binc\b|incorporated/.test(orgType(r)) && !/s[-\s]?corp|ll[cp]|limited liab|non.?profit|501|govern|municip/.test(orgType(r)), page: 1, text: "C Corp", center: true, absX: 242 },
    { on: (r) => /s[-\s]?corp/.test(orgType(r)), page: 1, text: "S Corp", region: { yMin: 508, yMax: 516 }, center: true, absX: 294.5 },
    { on: (r) => /govern|gov't|gov\b|municip/.test(orgType(r)), page: 1, text: "Govt.", region: { yMin: 508, yMax: 516 }, center: true, absX: 348.4 },
    { on: (r) => /non.?profit|501/.test(orgType(r)), page: 1, text: "501c/Tax Ex.", center: true, absX: 450.5 },
    /* p1 seasonal + business type */
    { on: (r) => r.transaction.seasonal === true, page: 1, text: "Seasonal Merchant?", center: true, absX: 128, absY: 192 },
    /* p1 business-type row is generated below via BIZ_RULES */
    /* p2 card types (boxes left of labels; dy tuned per measured box center) */
    { on: (r) => r.serviceAcceptance.cardVisaCredit, page: 2, text: "Visa Credit", center: true, absX: 36, dy: 1.8 },
    { on: (r) => r.serviceAcceptance.cardVisaDebit, page: 2, text: "Visa Non-PIN Debit", center: true, absX: 94, dy: 1.7 },
    { on: (r) => r.serviceAcceptance.cardMcCredit, page: 2, text: "MasterCard Credit", center: true, absX: 183.3, dy: 2.4 },
    { on: (r) => r.serviceAcceptance.cardMcDebit, page: 2, text: "MasterCard Non-PIN Debit", center: true, absX: 268.9, dy: 2.3 },
    { on: (r) => r.serviceAcceptance.cardDiscover, page: 2, text: "Discover Network", region: { yMin: 723, yMax: 731 }, center: true, absX: 365.8, dy: 3.2 },
    { on: (r) => r.serviceAcceptance.cardAmex, page: 2, text: "American Express", region: { yMin: 723, yMax: 731 }, center: true, absX: 442, dy: 2.7 },
    { on: (r) => r.serviceAcceptance.cardPin, page: 2, text: "PIN Debit", region: { yMin: 723, yMax: 731 }, center: true, absX: 540.5, dy: 2.7 },
    /* p2 discount plan + payment method + assessments */
    { on: (r) => r.serviceAcceptance.discountPlan === "flat", page: 2, text: "Flat Rate", region: { yMin: 695, yMax: 704 }, center: true, absX: 186.4, dy: 3.4 },
    { on: (r) => r.serviceAcceptance.discountPlan === "passthrough", page: 2, text: "Pass Through I/C", region: { yMin: 677, yMax: 686 }, center: true, absX: 76.7, dy: 3.9 },
    { on: (r) => r.serviceAcceptance.paymentMethod === "daily", page: 2, text: "Daily", center: true, absX: 450, dy: 0 },
    { on: (r) => r.serviceAcceptance.paymentMethod === "monthly", page: 2, text: "Monthly", region: { yMin: 706, yMax: 714 }, center: true, absX: 495.5 },
    { on: (r) => r.serviceAcceptance.assessments === "included", page: 2, text: "Included", region: { yMin: 689, yMax: 698 }, center: true, absX: 458 },
    { on: (r) => r.serviceAcceptance.assessments === "billed", page: 2, text: "Bill Separately", region: { yMin: 689, yMax: 698 }, center: true, absX: 514 },
    /* p3 other card types + processing */
    { on: (r) => r.serviceAcceptance.cardEbt, page: 3, text: "Accept EBT", region: { yMin: 740, yMax: 748 }, center: true, absX: 142.6, absY: 746.7 },
    { on: (r) => cs(r).enWex, page: 3, text: "Order Wright Express", center: true, absX: 319.8, absY: 733.1 },
    { on: (r) => cs(r).vasCheckServices, page: 3, text: "ACH/Check Services", center: true, absX: 530.4, absY: 746.7 },
    { on: (r) => cs(r).vasGiftCards, page: 3, text: "Gift Card", center: true, absX: 529.6, absY: 719.2 },
    { on: (r) => cs(r).fbAppType === "retail", page: 3, text: "Application Type", center: true, absX: 151.8, absY: 660.8 },
    { on: (r) => cs(r).fbAppType === "moto", page: 3, text: "Application Type", center: true, absX: 265.8, absY: 660.3 },
    { on: (r) => cs(r).fbAppType === "restaurant", page: 3, text: "Application Type", center: true, absX: 350.2, absY: 660.5 },
    { on: (r) => cs(r).avsCvv, page: 3, text: "AVS + CVV2", center: true, absX: 151.8, absY: 622.4 },
    { on: (r) => cs(r).serverNumbers, page: 3, text: "Server/Clerk #", center: true, absX: 290, absY: 622.4 },
    { on: (r) => cs(r).invoiceNumber, page: 3, text: "Invoice/Purchase Order #", center: true, absX: 476.2, absY: 634.4 },
    { on: (r) => cs(r).autoClose, page: 3, text: "Auto Close", center: true, absX: 422, absY: 622.4 },
    { on: (r) => cs(r).fbConnection === "ethernet", page: 3, text: "IP Connection?", center: true, absX: 110, absY: 605.1 },
    { on: (r) => cs(r).fbConnection === "wifi" || cs(r).fbConnection === "wireless", page: 3, text: "Wireless?", center: true, absX: 109, absY: 587 },
    /* p6 SSN-question Yes + Driver's License ID type per owner block */
    { on: (r) => Boolean(raw(own(r, 0).ssn)), page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, center: true, absX: 143.6, absY: 486.5 },
    { on: (r) => Boolean(raw(own(r, 0).dlNumber)), page: 6, text: "Beneficial", occ: 0, region: { yMin: 280, yMax: 545, xMax: 40 }, center: true, absX: 72, absY: 474.3 },
    { on: (r) => Boolean(raw(own(r, 1).ssn)), page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, center: true, absX: 143.6, absY: 406.3 },
    { on: (r) => Boolean(raw(own(r, 1).dlNumber)), page: 6, text: "Beneficial", occ: 1, region: { yMin: 280, yMax: 545, xMax: 40 }, center: true, absX: 71.8, absY: 393.9 },
  ],
  sign: [
    { page: 4, x: 76, y: 318, maxW: 250, maxH: 20 },
    { page: 4, x: 76, y: 159, maxW: 165, maxH: 18 },
    { page: 5, x: 58, y: 157, maxW: 230, maxH: 22 },
    { page: 6, x: 32, y: 34, maxW: 95, maxH: 15 },
  ],
};
// Business-type boxes (p1 section 6): one check per printed option + Other fallback.
for (const [re, label, cx, cy] of BIZ_RULES) {
  pbt.check.push({ on: (r) => re.test(bizType(r)), page: 1, text: "Business Type:", center: true, absX: cx, absY: cy, _biz: label });
}
pbt.check.push({ on: (r) => Boolean(bizType(r)) && !bizMatched(r), page: 1, text: "Business Type:", center: true, absX: 532.3, absY: 265.6, _biz: "Other" });
// PB&T p3 equipment rows: type boxes (from the pricing category), deployment boxes.
{
  const ROWS = [523.7, 511.7, 499.7, 487.7];
  ROWS.forEach((ry, i) => {
    const m = (r) => eqItem(r, i).model || eqItem(r, i).type || "";
    pbt.check.push(
      { on: (r) => /terminal/i.test(eqCat(m(r))) || /terminal/i.test(raw(eqItem(r, i).type)), page: 3, text: "Terminal", occ: 0, region: { yMin: ry - 5, yMax: ry + 5 }, center: true, absX: 68, absY: ry },
      { on: (r) => /pin pads/i.test(eqCat(m(r))) || /pin ?pad/i.test(raw(eqItem(r, i).type)), page: 3, text: "Pinpad", occ: 0, region: { yMin: ry - 5, yMax: ry + 5 }, center: true, absX: 116.5, absY: ry },
      { on: (r) => /printer/i.test(m(r)) || /printer/i.test(raw(eqItem(r, i).type)), page: 3, text: "Printer", occ: 0, region: { yMin: ry - 5, yMax: ry + 5 }, center: true, absX: 163.6, absY: ry },
      { on: (r) => eqHas(r, i) && eqItem(r, i).acquisition === "existing", page: 3, text: "Existing", occ: 0, region: { yMin: ry - 5, yMax: ry + 5 }, center: true, absX: 397.7, absY: ry },
      { on: (r) => eqHas(r, i) && eqItem(r, i).acquisition !== "existing", page: 3, text: "Existing", occ: 0, region: { yMin: ry - 5, yMax: ry + 5 }, center: true, absX: 571.5, absY: ry },
    );
  });
}


/* ================= Change Request Form (CRF, MX-FD0915, 1 page) ================= */
// Standalone change-request document. Header fields fall back to the record's
// business/owner data; every change row's checkbox marks itself when its value
// is filled (toggle-only rows have explicit booleans). Row checkbox centers
// measured from the template pixels (x=67.2; sub-boxes 186.6 / 263.8).
const crfR = (r) => r.crf || {};
const crf = {
  text: [
    /* header */
    { get: sigDate, page: 1, text: "DATE:", region: { yMin: 689, yMax: 698 }, place: "right", dx: 8, maxWidth: 180 },
    { get: (r) => raw(crfR(r).merchantId) || raw(po(r).mid), page: 1, text: "MERCHANT ID NUMBER:", place: "right", dx: 8, maxWidth: 130 },
    { get: (r) => raw(crfR(r).ownerName) || full((r.owners || [])[0]), page: 1, text: "S NAME:", region: { yMin: 665, yMax: 674 }, place: "right", dx: 8, maxWidth: 340 },
    { get: (r) => raw(crfR(r).dba) || r.business.dba, page: 1, text: "BUSINESS NAME (DBA):", place: "right", dx: 8, maxWidth: 340 },
    { get: (r) => raw(crfR(r).legalName) || r.business.legalName || r.business.dba, page: 1, text: "CURRENT LEGAL NAME:", place: "right", dx: 8, maxWidth: 340 },
    /* DBA change rows — value right of the label, inside the left column (divider ~x358) */
    { get: (r) => crfR(r).dbaName, page: 1, text: "DBA NAME:", place: "right", dx: 8, maxWidth: 224 },
    { get: (r) => crfR(r).legalAddress, page: 1, text: "LEGAL ADDRESS:", place: "right", dx: 8, maxWidth: 208 },
    { get: (r) => crfR(r).dbaAddress, page: 1, text: "DBA ADDRESS:", place: "right", dx: 8, maxWidth: 214 },
    { get: (r) => crfR(r).emailAddress, page: 1, text: "EMAIL ADDRESS:", place: "right", dx: 8, maxWidth: 208 },
    { get: (r) => crfR(r).dbaPhone, page: 1, text: "DBA PHONE NUMBER:", place: "right", dx: 8, maxWidth: 188 },
    { get: (r) => crfR(r).dbaFax, page: 1, text: "DBA FAX NUMBER:", place: "right", dx: 8, maxWidth: 202 },
    { get: (r) => crfR(r).website, page: 1, text: "WEBSITE ADDRESS:", place: "right", dx: 8, maxWidth: 200 },
    /* pricing rows */
    { get: (r) => raw(crfR(r).amexOptBlueRate), page: 1, text: "RATE:", region: { yMin: 354, yMax: 363 }, place: "right", dx: 8, maxWidth: 150 },
    { get: (r) => raw(crfR(r).amexDirectSe), page: 1, text: "AMEX DIRECT SE#", place: "right", dx: 10, maxWidth: 200 },
    { get: (r) => raw(crfR(r).pinDebitRate), page: 1, text: "RATE:", region: { yMin: 309, yMax: 318 }, place: "right", dx: 8, maxWidth: 150 },
    { get: (r) => raw(crfR(r).ebtFns), page: 1, text: "FNS#", place: "right", dx: 8, maxWidth: 112 },
    { get: (r) => raw(crfR(r).ebtFee), page: 1, text: "TRANSACTION FEE:", place: "right", dx: 8, maxWidth: 105 },
    { get: (r) => raw(crfR(r).myMerchantBenefitsRate), page: 1, text: "RATE:", region: { yMin: 264, yMax: 273 }, place: "right", dx: 8, maxWidth: 150 },
    { get: (r) => raw(crfR(r).vmdNewRate), page: 1, text: "NEW RATE:", place: "right", dx: 8, maxWidth: 135 },
    { get: (r) => raw(crfR(r).checkCardRate), page: 1, text: "RATE:", region: { yMin: 234, yMax: 243 }, place: "right", dx: 8, maxWidth: 150 },
    { get: (r) => crfR(r).other1, page: 1, text: "OTHER:", occ: 0, region: { yMin: 204, yMax: 228 }, place: "right", dx: 8, maxWidth: 250 },
    { get: (r) => raw(crfR(r).other1Rate), page: 1, text: "RATE:", region: { yMin: 219, yMax: 228 }, place: "right", dx: 8, maxWidth: 150 },
    { get: (r) => crfR(r).other2, page: 1, text: "OTHER:", occ: 1, region: { yMin: 204, yMax: 228 }, place: "right", dx: 8, maxWidth: 250 },
    { get: (r) => raw(crfR(r).other2Rate), page: 1, text: "RATE:", region: { yMin: 204, yMax: 213 }, place: "right", dx: 8, maxWidth: 150 },
    /* notes + signature date */
    { get: (r) => crfR(r).notes, page: 1, text: "NOTES", place: "right", absX: 70, absY: 170, maxWidth: 470 },
    { get: sigDate, page: 1, text: "DATE: _", region: { yMin: 82, yMax: 91 }, place: "right", absX: 414, absY: 88.5, maxWidth: 95 },
  ],
  check: [
    { on: (r) => Boolean(raw(crfR(r).dbaName)), page: 1, text: "DBA NAME:", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => Boolean(raw(crfR(r).legalAddress)), page: 1, text: "LEGAL ADDRESS:", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => Boolean(raw(crfR(r).dbaAddress)), page: 1, text: "DBA ADDRESS:", center: true, absX: 69.5, dy: 0.7 },
    { on: (r) => Boolean(raw(crfR(r).emailAddress)), page: 1, text: "EMAIL ADDRESS:", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => Boolean(raw(crfR(r).dbaPhone)), page: 1, text: "DBA PHONE NUMBER:", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => Boolean(raw(crfR(r).dbaFax)), page: 1, text: "DBA FAX NUMBER:", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => Boolean(raw(crfR(r).website)), page: 1, text: "WEBSITE ADDRESS:", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => Boolean(crfR(r).amexOptBluePlan) || Boolean(raw(crfR(r).amexOptBlueRate)), page: 1, text: "AMEX OPT BLUE", center: true, absX: 69.5, dy: 0.3 },
    { on: (r) => crfR(r).amexOptBluePlan === "interchange", page: 1, text: "INTERCHANGE", center: true, absX: 186.6, dy: 1, size: 6 },
    { on: (r) => crfR(r).amexOptBluePlan === "tiered", page: 1, text: "TIERED", center: true, absX: 263.8, dy: 1, size: 6 },
    { on: (r) => Boolean(raw(crfR(r).amexDirectSe)), page: 1, text: "AMEX DIRECT SE#", center: true, absX: 69.5, dy: 0.7 },
    { on: (r) => crfR(r).addDiscover, page: 1, text: "ADD DISCOVER", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => crfR(r).pinDebitDiscount || Boolean(raw(crfR(r).pinDebitRate)), page: 1, text: "PIN DEBIT DISCOUNT", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => Boolean(raw(crfR(r).ebtFns)) || Boolean(raw(crfR(r).ebtFee)), page: 1, text: "EBT", exact: true, center: true, absX: 69.5, dy: 0.3 },
    { on: (r) => crfR(r).addCashBenefits, page: 1, text: "ADD CASH BENEFITS", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => crfR(r).myMerchantBenefits || Boolean(raw(crfR(r).myMerchantBenefitsRate)), page: 1, text: "ADD MY MERCHANT BENEFITS", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => crfR(r).vmdDiscount || Boolean(raw(crfR(r).vmdNewRate)), page: 1, text: "VISA/MASTERCARD/DISCOVER DISCOUNT", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => crfR(r).checkCardDiscount || Boolean(raw(crfR(r).checkCardRate)), page: 1, text: "CHECK CARD DISCOUNT", center: true, absX: 69.5, dy: 1.5 },
    { on: (r) => Boolean(raw(crfR(r).other1)) || Boolean(raw(crfR(r).other1Rate)), page: 1, text: "OTHER:", occ: 0, region: { yMin: 204, yMax: 228 }, center: true, absX: 69.5, dy: 0.7 },
    { on: (r) => Boolean(raw(crfR(r).other2)) || Boolean(raw(crfR(r).other2Rate)), page: 1, text: "OTHER:", occ: 1, region: { yMin: 204, yMax: 228 }, center: true, absX: 69.5, dy: 0.3 },
  ],
  sign: [{ page: 1, x: 172, y: 83, maxW: 165, maxH: 20 }],
};


/* ========== Hemp & CBD Disclosure + CBD Amendment (Priority / PPS) ========== */
// Two standalone CBD documents. Both reference the underlying Merchant
// Agreement's date ("dated on or about ____, 20__"): cbd.agreementDate
// (MM/DD/YYYY preferred, free text accepted) falls back to the packet date.
const cbdR2 = (r) => r.cbd || {};
const CBD_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const cbdYn = (v) => {
  const s = raw(v).toLowerCase();
  return s === "yes" || s === "y" || s === "true" ? "Yes" : s === "no" || s === "n" || s === "false" ? "No" : raw(v);
};
const cbdAgmtParts = (r) => {
  const s = raw(cbdR2(r).agreementDate) || raw(r._date);
  if (!s) return { main: "", month: "", day: "", yy: "" };
  const m = s.match(/^\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})\s*$/);
  if (m) {
    const month = CBD_MONTHS[Math.min(12, Math.max(1, parseInt(m[1], 10))) - 1];
    const day = String(parseInt(m[2], 10));
    return { main: `${month} ${day}`, month, day, yy: m[3].slice(-2) };
  }
  const ym = s.match(/(\d{4})\s*\.?\s*$/);
  const main = s.replace(/,?\s*\d{4}\s*\.?\s*$/, "").trim() || s;
  return { main, month: main, day: "", yy: ym ? ym[1].slice(-2) : "" };
};
const cbdLegalAndDba = (r) => {
  const ln = raw(r.business.legalName), db = raw(r.business.dba);
  return ln && db && ln.toLowerCase() !== db.toLowerCase() ? `${ln} / ${db}` : ln || db;
};
const cbdProduct = (r, i) => {
  const list = cbdR2(r).products;
  const arr = Array.isArray(list) ? list : list && typeof list === "object" ? Object.keys(list).sort((a, b) => a - b).map((k) => list[k]) : [];
  return arr[i] || {};
};

const hemp_cbd = {
  text: [
    /* p1 — corporate & licensing info + product/services questions (values centered on the printed blanks) */
    { get: (r) => raw(r.business.legalName) || raw(r.business.dba), page: 1, text: "Business Legal Name:", place: "center", absX: 235.6, dy: 1.5, maxWidth: 135 },
    { get: (r) => raw(cbdR2(r).stateHempLicense), page: 1, text: "Hemp retail license no", place: "center", absX: 302.6, dy: 1.5, maxWidth: 125 },
    { get: (r) => cbdYn(cbdR2(r).growsHemp), page: 1, text: "growing or cultivation of Hemp plants?", place: "center", absX: 360.7, dy: 1.5, maxWidth: 28 },
    { get: (r) => cbdYn(cbdR2(r).manufacturesHemp), page: 1, text: "Hemp plants/CBD?", place: "center", absX: 395.8, dy: 1.5, maxWidth: 28 },
    { get: (r) => cbdYn(cbdR2(r).advertisesHemp), page: 1, text: "market or advertise Hemp or CBD products to the public?", place: "center", absX: 366.6, dy: 1.5, maxWidth: 28 },
    /* p2 — certification: agreement date blanks + signer block */
    { get: (r) => cbdAgmtParts(r).main, page: 2, text: "________________", exact: true, place: "center", absX: 97.6, dy: 1.5, maxWidth: 76 },
    { get: (r) => cbdAgmtParts(r).yy, page: 2, text: "_____", exact: true, place: "center", absX: 172.7, dy: 1.5, maxWidth: 22 },
    { get: cbdLegalAndDba, page: 2, text: "(Merchant Business Legal Name and d/b/a)", place: "right", dx: 10, maxWidth: 320 },
    { get: sigName, page: 2, text: "Name:", region: { yMin: 128, yMax: 137 }, place: "right", dx: 8, maxWidth: 250 },
    { get: sigTitle, page: 2, text: "Title:", region: { yMin: 103, yMax: 112 }, place: "right", dx: 8, maxWidth: 250 },
    { get: sigDate, page: 2, text: "Date:", region: { yMin: 78, yMax: 88 }, place: "right", dx: 8, maxWidth: 120 },
    /* p3 — schedule of Hemp/CBD products: 20 numbered rows x 3 columns. Values are
       left-aligned under each column header; dx normalizes the differing "N." widths. */
    ...Array.from({ length: 20 }, (_, i) => {
      const rowLabel = `${i + 1}.`;
      const dxBase = i < 9 ? 15.1 : 10; // "1."-"9." are 5pt narrower than "10."-"20."
      return [
        { get: (r) => raw(cbdProduct(r, i).name), page: 3, text: rowLabel, exact: true, place: "right", dx: dxBase, maxWidth: 150 },
        { get: (r) => raw(cbdProduct(r, i).distributor), page: 3, text: rowLabel, exact: true, place: "right", dx: dxBase + 157.4, maxWidth: 168 },
        { get: (r) => raw(cbdProduct(r, i).state), page: 3, text: rowLabel, exact: true, place: "right", dx: dxBase + 337.4, maxWidth: 145 },
      ];
    }).flat(),
  ],
  check: [],
  // Owner 1 signs the certification on the open space right of "Signature:".
  sign: [{ page: 2, x: 106, y: 156, maxW: 215, maxH: 20 }],
};

const cbd_amendment = {
  text: [
    /* "dated on or about [month] [day], 20[yy]" blanks */
    { get: (r) => cbdAgmtParts(r).month, page: 1, text: "_____________", exact: true, place: "center", absX: 296.6, dy: 1.5, maxWidth: 68 },
    { get: (r) => cbdAgmtParts(r).day, page: 1, text: "_____", exact: true, region: { yMin: 638, yMax: 648 }, place: "center", absX: 355.6, dy: 1.5, maxWidth: 24 },
    { get: (r) => cbdAgmtParts(r).yy, page: 1, text: "___", exact: true, region: { yMin: 638, yMax: 648 }, place: "center", absX: 396.3, dy: 1.5, maxWidth: 15 },
    /* merchant company name on the blank across from PRIORITY PAYMENT SYSTEMS LLC */
    { get: (r) => raw(r.business.legalName) || raw(r.business.dba), page: 1, text: "________________________________", exact: true, place: "center", absX: 394.2, dy: 1.5, maxWidth: 170 },
    /* right (Merchant) signer column; the left Processor column stays blank */
    { get: sigName, page: 1, text: "Name:", region: { xMin: 300, yMin: 117, yMax: 126 }, dx: 34, dy: 1.5, maxWidth: 138 },
    { get: sigTitle, page: 1, text: "tle:", region: { xMin: 300, yMin: 95, yMax: 104 }, dx: 24, dy: 1.5, maxWidth: 138 },
    { get: sigDate, page: 1, text: "Date:", region: { xMin: 300, yMin: 72, yMax: 81 }, dx: 34, dy: 1.5, maxWidth: 138 },
  ],
  check: [],
  // Owner 1 signs the Merchant "By:" line (right column).
  sign: [{ page: 1, x: 332, y: 146, maxW: 148, maxH: 19 }],
};


/* ========= Clover / Omaha Gift Card Program Setup (6-page packet) ========= */
// p1 is the application (anchored text layer). p2 (Additional Location Form) and
// p3 (Bank Affiliation Change) are scanned pages filled by absolute coordinates
// measured from the template pixels; each activates only when its data is present.
// p4-p6 are informational (procedures + fee schedules) and stay untouched.
const gcR = (r) => r.giftCard || {};
const gcList = (v, n) => {
  const arr = Array.isArray(v) ? v : v && typeof v === "object" ? Object.keys(v).sort((a, b) => a - b).map((k) => v[k]) : [];
  return Array.from({ length: n }, (_, i) => arr[i] || {});
};
const gcEq = (r, i) => gcList(gcR(r).eq, 3)[i];
const gcLoc = (r, i) => gcList(gcR(r).locations, 2)[i];
const gcLocActive = (r) => gcList(gcR(r).locations, 2).some((l) => Object.values(l).some((v) => raw(v)));
const gcAffActive = (r) => Boolean(raw(gcR(r).affBank));
const gcDigits = (v) => raw(v).replace(/\D/g, "");
// Per-digit specs across a run of printed digit cells (measured cell centers).
const gcCells = (page, get, centers, absY) =>
  centers.map((cx, i) => ({ get: (r) => gcDigits(get(r)).slice(0, centers.length)[i] || "", page, place: "center", absX: cx, absY, maxWidth: 14 }));
const gcOwnerTitle = (r) => raw(own(r, 0).title).toLowerCase();

const gift_card = {
  text: [
    /* p1 — top "Tie To" lines (fill the row matching the chosen application kind) */
    { get: (r) => (gcR(r).appKind === "outlet" ? raw(gcR(r).tieTo) : ""), page: 1, place: "center", absX: 445, absY: 719, maxWidth: 278 },
    { get: (r) => (gcR(r).appKind === "entitle" ? raw(gcR(r).tieTo) : ""), page: 1, place: "center", absX: 504, absY: 698, maxWidth: 162 },
    /* p1 — client information */
    { get: (r) => raw(r.business.legalName) || raw(r.business.dba), page: 1, text: "(Business Legal Name):", place: "right", dx: 8, dy: 1.5, maxWidth: 460 },
    { get: (r) => raw(r.business.dba), page: 1, text: "DBA / Outlet Name:", place: "right", dx: 8, dy: 1.5, maxWidth: 290 },
    ...gcCells(1, (r) => r.business.federalTaxId, [457.2, 472.8, 488.8, 504.8, 520.4, 536.4, 552.0, 568.0, 583.6], 629.4),
    { get: (r) => raw(r.business.locationAddress), page: 1, text: "Street Address:", region: { yMin: 600, yMax: 609 }, place: "right", dx: 8, dy: 1.5, maxWidth: 495 },
    { get: (r) => raw(r.business.locationCity), page: 1, text: "City:", region: { yMin: 576, yMax: 585 }, place: "right", dx: 8, dy: 1.5, maxWidth: 258 },
    { get: (r) => raw(r.business.locationState), page: 1, text: "State:", region: { yMin: 576, yMax: 585 }, place: "right", dx: 8, dy: 1.5, maxWidth: 45 },
    { get: (r) => raw(r.business.locationZip), page: 1, text: "Zip:", region: { yMin: 576, yMax: 585 }, place: "right", dx: 8, dy: 1.5, maxWidth: 68 },
    { get: (r) => raw(gcR(r).numLocations), page: 1, text: "# of Locations:", place: "right", dx: 6, dy: 1.5, maxWidth: 52 },
    { get: (r) => raw(r.business.contactName), page: 1, text: "Contact Name:", place: "right", dx: 8, dy: 1.5, maxWidth: 225 },
    { get: (r) => raw(r.business.phone), page: 1, text: "Phone:", region: { yMin: 552, yMax: 561 }, place: "right", dx: 8, dy: 1.5, maxWidth: 105 },
    { get: (r) => raw(r.business.fax), page: 1, text: "FAX:", place: "right", dx: 8, dy: 1.5, maxWidth: 110 },
    { get: (r) => raw(r.business.email), page: 1, text: "E-Mail:", place: "right", dx: 8, dy: 1.5, maxWidth: 500 },
    /* p1 — owner block */
    { get: (r) => full(own(r, 0)), page: 1, text: "Officer Name:", place: "right", dx: 8, dy: 1.5, maxWidth: 228 },
    { get: (r) => (/pres|v\.?\s?p|vice|member|owner|partner/.test(gcOwnerTitle(r)) ? "" : raw(own(r, 0).title)), page: 1, place: "center", absX: 465.5, absY: 491.8, maxWidth: 66, size: 7 },
    { get: (r) => raw(own(r, 0).ownershipPct), page: 1, place: "center", absX: 549, absY: 478.5, maxWidth: 60 },
    { get: (r) => raw(own(r, 0).homeAddress), page: 1, text: "Street Address:", region: { yMin: 462, yMax: 471 }, place: "right", dx: 8, dy: 1.5, maxWidth: 345 },
    { get: (r) => raw(own(r, 0).phone), page: 1, text: "Home Phone:", place: "right", dx: 6, dy: 1.5, maxWidth: 88 },
    { get: (r) => raw(own(r, 0).city), page: 1, text: "City:", region: { yMin: 438, yMax: 447 }, place: "right", dx: 8, dy: 1.5, maxWidth: 188 },
    { get: (r) => raw(own(r, 0).state), page: 1, text: "State:", region: { yMin: 438, yMax: 447 }, place: "right", dx: 8, dy: 1.5, maxWidth: 42 },
    { get: (r) => raw(own(r, 0).zip), page: 1, text: "Zip:", region: { yMin: 438, yMax: 447 }, place: "right", dx: 8, dy: 1.5, maxWidth: 115 },
    { get: (r) => raw(own(r, 0).ssn), page: 1, text: "SSN:", place: "right", dx: 8, dy: 1.5, maxWidth: 118 },
    /* p1 — equipment rows (text columns centered in their cells) */
    ...[375.5, 348.5, 321.5].flatMap((ry, i) => [
      { get: (r) => raw(gcEq(r, i).qty), page: 1, place: "center", absX: 92, absY: ry, maxWidth: 44 },
      { get: (r) => raw(gcEq(r, i).terminalType), page: 1, place: "center", absX: 154, absY: ry, maxWidth: 66 },
      { get: (r) => raw(gcEq(r, i).model), page: 1, place: "center", absX: 432, absY: ry, maxWidth: 108 },
      { get: (r) => raw(gcEq(r, i).serial), page: 1, place: "center", absX: 539, absY: ry, maxWidth: 92 },
    ]),
    /* p1 — service-provider section */
    ...gcCells(1, (r) => gcR(r).merchantProcessingNum, [84.0, 100.0, 115.6, 131.6, 147.2, 163.2, 178.8, 194.8, 210.4, 226.2, 242.0, 257.6, 273.6, 289.2, 305.2], 273.2),
    ...gcCells(1, (r) => gcR(r).giftCardMerchantNum, [416.8, 432.8, 448.4, 464.4, 480.0, 496.0, 511.6, 527.6, 543.2, 559.2, 574.8], 273.2),
    { get: (r) => raw(gcR(r).chain), page: 1, text: "CHAIN:", place: "right", dx: 8, dy: 1.5, maxWidth: 150 },
    ...gcCells(1, (r) => gcR(r).omahaMerchantNum, [106.0, 122.0, 137.6, 153.2, 169.2, 184.8, 200.8, 216.4, 232.4, 248.0, 264.0, 279.6, 295.6, 311.2, 327.2, 342.8, 358.6], 225.2),
    ...gcCells(1, (r) => gcR(r).mcc, [437.4, 453.2, 468.8, 484.8], 225.2),
    /* p1 — client authorization */
    { get: sigDate, page: 1, text: "Date:_", place: "center", absX: 546, absY: 100.7, maxWidth: 78 },
    { get: sigName, page: 1, text: "Print Name:", dx: 53, dy: 1.5, maxWidth: 300 },
    { get: sigTitle, page: 1, text: "Title: _", dx: 26, dy: 1.5, maxWidth: 155 },
    /* p2 — Additional Location Form (scanned; active only when a location is entered) */
    { get: (r) => (gcLocActive(r) ? raw(gcR(r).merchantProcessingNum) : ""), page: 2, absX: 110, absY: 719.8, dy: 0, maxWidth: 190 },
    { get: (r) => (gcLocActive(r) ? raw(gcR(r).giftCardMerchantNum) : ""), page: 2, absX: 390, absY: 719.8, dy: 0, maxWidth: 195 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.legalName) : ""), page: 2, absX: 66, absY: 701.8, dy: 0, maxWidth: 230 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.dba) : ""), page: 2, absX: 350, absY: 701.8, dy: 0, maxWidth: 235 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.locationAddress) : ""), page: 2, absX: 78, absY: 679.5, dy: 0, maxWidth: 500 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.locationCity) : ""), page: 2, absX: 38, absY: 659.5, dy: 0, maxWidth: 300 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.locationState) : ""), page: 2, absX: 383, absY: 659.5, dy: 0, maxWidth: 40 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.locationZip) : ""), page: 2, absX: 512, absY: 659.5, dy: 0, maxWidth: 78 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.contactName) : ""), page: 2, absX: 75, absY: 640.6, dy: 0, maxWidth: 130 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.phone) : ""), page: 2, absX: 270, absY: 640.6, dy: 0, maxWidth: 85 },
    { get: (r) => (gcLocActive(r) ? raw(r.business.email) : ""), page: 2, absX: 411, absY: 640.6, dy: 0, maxWidth: 175 },
    ...[["setUpFee", 184.7, 613], ["addlLocFee", 184.7, 601], ["activationFee", 184.7, 588],
        ["redemptionFee", 381.6, 613], ["reloadFee", 381.6, 601], ["voidFee", 381.6, 588], ["balanceFee", 381.6, 574.5],
        ["otherFee", 588.5, 613], ["monthlyMinFee", 588.5, 601], ["monthlyFee", 588.5, 588]]
      .map(([k, cx, cy]) => ({ get: (r) => (gcLocActive(r) ? money(gcR(r)[k]) : ""), page: 2, place: "center", absX: cx, absY: cy, maxWidth: cx > 500 ? 22 : 46, size: 8 })),
    ...[0, 1].flatMap((i) => {
      const dy = i * -94.4;
      const L = (r) => gcLoc(r, i);
      return [
        { get: (r) => raw(L(r).dba), page: 2, absX: 74, absY: 539 + dy, dy: 0, maxWidth: 500 },
        { get: (r) => raw(L(r).street), page: 2, absX: 86, absY: 521.8 + dy, dy: 0, maxWidth: 210 },
        { get: (r) => raw(L(r).city), page: 2, absX: 331, absY: 521.8 + dy, dy: 0, maxWidth: 108 },
        { get: (r) => raw(L(r).state), page: 2, absX: 468, absY: 521.8 + dy, dy: 0, maxWidth: 24 },
        { get: (r) => raw(L(r).zip), page: 2, absX: 554, absY: 521.8 + dy, dy: 0, maxWidth: 40 },
        { get: (r) => raw(L(r).phone), page: 2, absX: 92, absY: 503.4 + dy, dy: 0, maxWidth: 200 },
        { get: (r) => raw(L(r).fax), page: 2, absX: 356, absY: 503.4 + dy, dy: 0, maxWidth: 180 },
        { get: (r) => raw(L(r).contact), page: 2, absX: 91, absY: 485.8 + dy, dy: 0, maxWidth: 205 },
        { get: (r) => raw(L(r).positionTitle), page: 2, absX: 358, absY: 485.8 + dy, dy: 0, maxWidth: 180 },
        { get: (r) => raw(L(r).email), page: 2, absX: 92, absY: 468.2 + dy, dy: 0, maxWidth: 200 },
        { get: (r) => raw(L(r).processingNum), page: 2, absX: 394, absY: 468.2 + dy, dy: 0, maxWidth: 165 },
      ];
    }),
    { get: (r) => (gcLocActive(r) ? raw(r.sales.salesAgentName) : ""), page: 2, absX: 96, absY: 68.5, dy: 0, maxWidth: 105 },
    /* p3 — Bank Affiliation Change (scanned; active only when a new bank is named) */
    { get: (r) => (gcAffActive(r) ? raw(r.business.legalName) || raw(r.business.dba) : ""), page: 3, place: "center", absX: 324, absY: 511, maxWidth: 232 },
    { get: (r) => (gcAffActive(r) ? raw(gcR(r).affBank) : ""), page: 3, place: "center", absX: 432, absY: 478, maxWidth: 66 },
    { get: (r) => (gcAffActive(r) ? raw(r.business.legalName) : ""), page: 3, absX: 237, absY: 444, dy: 0, maxWidth: 298 },
    { get: (r) => (gcAffActive(r) ? raw(r.business.dba) : ""), page: 3, absX: 192, absY: 422, dy: 0, maxWidth: 340 },
    { get: (r) => (gcAffActive(r) ? raw(gcR(r).affMerchantId) || raw(r.po.mid) : ""), page: 3, absX: 190, absY: 396.5, dy: 0, maxWidth: 250 },
    { get: (r) => (gcAffActive(r) ? raw(gcR(r).affAltId) : ""), page: 3, absX: 300, absY: 371.5, dy: 0, maxWidth: 220 },
    { get: (r) => (gcAffActive(r) ? raw(gcR(r).affExistingNum) : ""), page: 3, absX: 262, absY: 348, dy: 0, maxWidth: 258 },
    { get: (r) => (gcAffActive(r) ? raw(gcR(r).affPromoNumber) : ""), page: 3, absX: 193, absY: 326.5, dy: 0, maxWidth: 300 },
    { get: (r) => (gcAffActive(r) ? raw(r.business.email) : ""), page: 3, absX: 251, absY: 302, dy: 0, maxWidth: 258 },
    { get: (r) => (gcAffActive(r) ? sigTitle(r) : ""), page: 3, absX: 132, absY: 149.5, dy: 0, maxWidth: 200 },
    { get: (r) => (gcAffActive(r) ? sigDate(r) : ""), page: 3, absX: 132, absY: 129.5, dy: 0, maxWidth: 95 },
  ],
  check: [
    /* p1 top row + application kind */
    { on: (r) => gcR(r).resubmission, page: 1, center: true, absX: 93.4, absY: 767.7 },
    { on: (r) => gcR(r).additionalInfo, page: 1, center: true, absX: 242.4, absY: 767.7 },
    { on: (r) => gcR(r).appKind === "new", page: 1, center: true, absX: 21.4, absY: 717.7 },
    { on: (r) => gcR(r).appKind === "outlet", page: 1, center: true, absX: 165.4, absY: 717.7 },
    { on: (r) => gcR(r).appKind === "entitle", page: 1, center: true, absX: 165.4, absY: 696.7 },
    /* p1 ownership type (from the shared organizationType) */
    { on: (r) => /sole|individual|propriet/.test(orgType(r)), page: 1, center: true, absX: 21.1, absY: 516.4 },
    { on: (r) => /partner/.test(orgType(r)) && !/ll[cp]|limited liab/.test(orgType(r)), page: 1, center: true, absX: 103.7, absY: 516.4 },
    { on: (r) => /non.?profit|501/.test(orgType(r)), page: 1, center: true, absX: 170.1, absY: 516.4 },
    { on: (r) => /public/.test(orgType(r)) && /corp|\binc\b/.test(orgType(r)), page: 1, center: true, absX: 280.4, absY: 516.4 },
    { on: (r) => /corp|\binc\b|incorporated/.test(orgType(r)) && !/public|non.?profit|501|govern|municip|ll[cp]|limited liab/.test(orgType(r)), page: 1, center: true, absX: 349.8, absY: 516.4 },
    { on: (r) => /ll[cp]|limited liab/.test(orgType(r)), page: 1, center: true, absX: 421.7, absY: 516.4 },
    { on: (r) => /govern|municip/.test(orgType(r)), page: 1, center: true, absX: 466.1, absY: 516.4 },
    /* p1 owner title */
    { on: (r) => /pres/.test(gcOwnerTitle(r)), page: 1, center: true, absX: 336.1, absY: 502.4 },
    { on: (r) => /v\.?\s?p|vice/.test(gcOwnerTitle(r)), page: 1, center: true, absX: 373.3, absY: 502.4 },
    { on: (r) => /member/.test(gcOwnerTitle(r)), page: 1, center: true, absX: 403.5, absY: 502.4 },
    { on: (r) => /owner/.test(gcOwnerTitle(r)), page: 1, center: true, absX: 336.1, absY: 490.4 },
    { on: (r) => /partner/.test(gcOwnerTitle(r)), page: 1, center: true, absX: 378.6, absY: 490.4 },
    { on: (r) => Boolean(gcOwnerTitle(r)) && !/pres|v\.?\s?p|vice|member|owner|partner/.test(gcOwnerTitle(r)), page: 1, center: true, absX: 424.2, absY: 490.4 },
    /* p1 equipment business-type per row (upper option line / lower option line) */
    ...[0, 1, 2].flatMap((i) => {
      const yU = [383.2, 356.2, 329.2][i], yL = [371.2, 344.2, 317.2][i];
      const t = (r) => raw(gcEq(r, i).bizType).toLowerCase();
      return [
        { on: (r) => t(r) === "retail", page: 1, center: true, absX: 198.5, absY: yU },
        { on: (r) => t(r) === "restaurant", page: 1, center: true, absX: 237.9, absY: yU },
        { on: (r) => t(r) === "qsr", page: 1, center: true, absX: 297.3, absY: yU },
        { on: (r) => t(r) === "lodging", page: 1, center: true, absX: 332.3, absY: yU },
        { on: (r) => t(r) === "supermarket", page: 1, center: true, absX: 207.3, absY: yL },
        { on: (r) => t(r) === "carrental", page: 1, center: true, absX: 273.8, absY: yL },
        { on: (r) => t(r) === "moto", page: 1, center: true, absX: 331.7, absY: yL },
      ];
    }),
  ],
  // Owner 1 signs the p1 authorization X line; the p3 principal line only when
  // the bank-affiliation section is in use.
  sign: [
    { page: 1, x: 230, y: 101, maxW: 225, maxH: 20 },
    { page: 3, x: 106, y: 178, maxW: 240, maxH: 22, on: (r) => gcAffActive(r) },
  ],
};

export const FORM_MAPS = { citizens, merrick, coversheet, purchase_order, clover_addendum, bank_change, fd_north, pbt, crf, hemp_cbd, cbd_amendment, gift_card };
