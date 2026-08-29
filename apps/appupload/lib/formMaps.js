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

const full = (o) => [o?.first, o?.last].filter(Boolean).join(" ").trim();
const raw = (v) => (v == null ? "" : String(v).trim());

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

    { get: (r) => full(r.owners[1]), page: 1, text: "Ownership / Officer 2", place: "below", maxWidth: 125 },
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
    { get: (r) => r.banking.bankPhone, page: 1, text: "Bank Phone", place: "below", dy: -10, maxWidth: 120 },

    // 6. Fee schedule — anchored to the right of each printed "$"
    { get: (r) => raw(r.fees.authVmcda), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 84, xMax: 95 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.monthlyService), page: 1, text: "$", region: { yMin: 147, yMax: 155, xMin: 218, xMax: 230 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.monthlyMinimum), page: 1, text: "$", region: { yMin: 130, yMax: 138, xMin: 225, xMax: 237 }, place: "right", dx: 3, maxWidth: 55 },
    { get: (r) => raw(r.fees.annual), page: 1, text: "$", region: { yMin: 96, yMax: 104, xMin: 340, xMax: 355 }, place: "right", dx: 3, maxWidth: 55 },
  ],
  check: [
    { on: (r) => r.banking.accountType === "checking", page: 1, text: "Checking", dx: -11, dy: 0 },
    { on: (r) => r.banking.accountType === "savings", page: 1, text: "Savings", dx: -11, dy: 0 },
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
    { get: (r) => raw(r.business.lengthOwnershipYears), page: 1, text: "YEARS", place: "leftOf", pad: 4, maxWidth: 30 },
    { get: (r) => raw(r.business.lengthOwnershipMonths), page: 1, text: "MONTHS", place: "leftOf", pad: 4, maxWidth: 30 },

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
    { get: (r) => r.banking.bankName, page: 1, text: "BANK NAME", place: "below", maxWidth: 160 },
    { get: (r) => r.banking.routing, page: 1, text: "TRANSIT", place: "below", maxWidth: 150 },
    { get: (r) => raw(r.banking.account), page: 1, text: "ACCOUNT(DDA)", place: "below", maxWidth: 130 },
    { get: (r) => r.banking.bankPhone, page: 1, text: "PHONE", region: { yMin: 415, yMax: 430 }, place: "below", maxWidth: 70 },

    // Transaction — numbers right of "$"
    { get: (r) => r.business.businessType, page: 1, text: "BUSINESS TYPE", place: "right", dx: 6, maxWidth: 110 },
    { get: (r) => r.business.productsSold, page: 1, text: "PRODUCT/SERVICES SOLD", place: "right", dx: 6, maxWidth: 120 },
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
  ],
  check: [
    { on: (r) => r.banking.accountType === "checking", page: 1, text: "CHECKING", dx: -12, dy: 0 },
    { on: (r) => r.banking.accountType === "savings", page: 1, text: "SAVINGS", dx: -12, dy: 0 },
  ],
};

/* ----------------------------- Coversheet ----------------------------- */
// Header value lines start at x=380; merchant-info lines start at x=60.
const coversheet = {
  text: [
    { get: (r) => r.sales.salesAgentName || r.sales.salesRep, page: 1, text: "Sales Partner Name:", place: "right", absX: 384, maxWidth: 200 },
    { get: (r) => r.sales.salesOffice, page: 1, text: "Territory Manager:", place: "right", absX: 384, maxWidth: 200 },
    { get: (r) => r._date, page: 1, text: "Date:", region: { xMin: 260 }, place: "right", absX: 384, maxWidth: 200 },
    { get: (r) => r.business.dba, page: 1, text: "DBA:", place: "right", absX: 62, maxWidth: 200 },
    { get: (r) => r.business.email, page: 1, text: "Email:", region: { xMax: 120 }, place: "right", absX: 62, maxWidth: 200 },
    { get: (r) => r.business.federalTaxId, page: 1, text: "Tax ID:", place: "right", absX: 62, maxWidth: 200 },
    { get: (r) => r.owners[0].ssn, page: 1, text: "SSN:", region: { xMax: 120 }, place: "right", absX: 62, maxWidth: 200 },
    { get: (r) => r._appLabel, page: 1, text: "Notes and Special Instructions:", place: "right", dx: 12, maxWidth: 360 },
  ],
  check: [
    { on: (r) => r.documents.hasVoidedCheck, page: 1, text: "Voided Check", absX: 405, dy: 0 },
    { on: (r) => r.documents.hasDriversLicense, page: 1, text: "Drivers License", absX: 405, dy: 0 },
  ],
};

function ownLen(r) {
  const y = r.business.lengthOwnershipYears;
  const m = r.business.lengthOwnershipMonths;
  if (y && m) return `${y} yr ${m} mo`;
  if (y) return `${y} yr`;
  return r.business.businessStarted || "";
}

export const FORM_MAPS = { citizens, merrick, coversheet };
