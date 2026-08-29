import Anthropic from "@anthropic-ai/sdk";

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
        enum: ["citizens", "merrick", "unknown"],
        description:
          "Which application template this is. 'citizens' = 'Merchant Processing Application and Agreement' mentioning Citizens Bank / Priority Payment Systems (3-page form with numbered sections 1-10). 'merrick' = 'Merchant Application and Agreement' mentioning Merrick Bank / Woodbury NY. 'unknown' if it cannot be determined.",
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
          monthlyService: { type: "string" },
          monthlyMinimum: { type: "string" },
          annual: { type: "string" },
          chargeback: { type: "string" },
          pinDebit: { type: "string" },
          batch: { type: "string" },
          earlyTermination: { type: "string" },
          discountPlan: { type: "string", enum: ["flat", "passthrough", ""] },
          debitPct: { type: "string" },
          creditPct: { type: "string" },
          amexPct: { type: "string" },
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
- one or more pages of a handwritten merchant application (either the Citizens/Priority form or the Merrick form),
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

  const client = new Anthropic({ apiKey });
  const model = opts.model || DEFAULT_MODEL;

  const content = [];
  images.forEach((img, i) => {
    if (!ALLOWED_MEDIA.has(img.mediaType)) {
      const err = new Error(`Unsupported image type: ${img.mediaType}`);
      err.statusCode = 415;
      throw err;
    }
    content.push({ type: "text", text: `Image ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  });
  content.push({
    type: "text",
    text: "Extract the merchant application data from the images above by calling the merchant_application tool.",
  });

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: EXTRACTION_TOOL.name },
    messages: [{ role: "user", content }],
  });

  const toolUse = message.content.find((b) => b.type === "tool_use" && b.name === EXTRACTION_TOOL.name);
  if (!toolUse) throw new Error("The model did not return structured data.");
  return normalizeRecord(toolUse.input);
}

/** Ensure the record has every section/field so downstream code can rely on the shape. */
export function normalizeRecord(raw = {}) {
  const r = raw || {};
  const owners = Array.isArray(r.owners) ? r.owners : [];
  return {
    appType: ["citizens", "merrick"].includes(r.appType) ? r.appType : "unknown",
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
    sales: { salesRep: "", salesOffice: "", salesAgentName: "", ...(r.sales || {}) },
    notes: r.notes || "",
  };
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
  authVmcda: "", monthlyService: "", monthlyMinimum: "", annual: "", chargeback: "", pinDebit: "",
  batch: "", earlyTermination: "", discountPlan: "", debitPct: "", creditPct: "", amexPct: "",
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
      authVmcda: "0.10", monthlyService: "9.95", monthlyMinimum: "25", annual: "99",
      chargeback: "25", pinDebit: "0.05", batch: "0.20", earlyTermination: "295",
      discountPlan: "flat", debitPct: "0.50", creditPct: "2.49", amexPct: "2.89",
    },
    sales: { salesRep: "T. Nguyen", salesOffice: "Midwest", salesAgentName: "Tom Nguyen" },
    notes: "Bank details read from voided check; owner identity from IL driver's license.",
  };
}
