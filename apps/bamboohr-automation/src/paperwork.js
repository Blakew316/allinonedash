// New-hire paperwork: signed portal links, filling the real company PDFs
// with the hire's submitted data, and an e-signature audit certificate.

import crypto from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { COMPANY_DOCUMENTS, readDocument } from './documents.js';
import { STAMPS } from './stamp-coords.js';

const NAVY = rgb(0.043, 0.106, 0.369);
const INK = rgb(0.11, 0.14, 0.2);
const MUTED = rgb(0.4, 0.45, 0.54);
const LINE = rgb(0.86, 0.89, 0.93);

// ── Portal links ────────────────────────────────────────────────────────────
// The link itself carries the hire's identity, signed so it cannot be edited.
// No server-side session store is needed, which keeps the serverless function
// stateless and the flow resilient.

let warnedAboutSecret = false;

function secretFor(env) {
  const configured = env.PAPERWORK_SECRET || env.BAMBOOHR_API_KEY || env.SMTP_PASS;
  if (configured) return configured;
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.error(
      'WARNING: no PAPERWORK_SECRET (or BAMBOOHR_API_KEY / SMTP_PASS) is set — ' +
        'paperwork links are being signed with a built-in development key. ' +
        'Set PAPERWORK_SECRET before using this with real hires.'
    );
  }
  return 'wholesale-payments-paperwork-dev-secret';
}

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function createPaperworkToken(hire, env) {
  const payload = {
    f: hire.firstName || '',
    l: hire.lastName || '',
    e: hire.email || '',
    p: hire.phone || '',
    j: hire.jobTitle || '',
    s: hire.startDate || '',
    id: hire.employeeId || '',
    t: Date.now(),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', secretFor(env)).update(body).digest());
  return `${body}.${sig}`;
}

// Links stop working after this long, so a forwarded or leaked link is not a
// permanent credential. Generous enough to cover a delayed start date.
export const TOKEN_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

export function verifyPaperworkToken(token, env) {
  if (typeof token !== 'string' || !token.includes('.') || token.length > 4096) return null;
  const [body, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secretFor(env)).update(body).digest());
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(unb64url(body).toString('utf8'));
    if (!p.t || Date.now() - p.t > TOKEN_MAX_AGE_MS) return null;
    return {
      firstName: p.f,
      lastName: p.l,
      email: p.e,
      phone: p.p,
      jobTitle: p.j,
      startDate: p.s,
      employeeId: p.id,
      issuedAt: p.t,
    };
  } catch {
    return null;
  }
}

export function paperworkUrl(hire, env, origin) {
  const base = (env.SITE_URL || origin || '').replace(/\/+$/, '');
  return `${base}/paperwork?t=${encodeURIComponent(createPaperworkToken(hire, env))}`;
}

// ── Value helpers ───────────────────────────────────────────────────────────

// The standard PDF fonts can only encode WinAnsi (Latin-1). Anything outside
// it — smart quotes, em dashes, accented or non-Latin letters — throws inside
// pdf-lib and would abort the whole document, so text is normalised and
// length-capped before it is ever drawn.
const MAX_FIELD_CHARS = 300;

const SUBSTITUTIONS = [
  [/[‘’‚′]/g, "'"],
  [/[“”„″]/g, '"'],
  [/[‐-―−]/g, '-'],
  [/[…]/g, '...'],
  [/[   ]/g, ' '],
  [/[•]/g, '-'],
];

export function toPdfText(value, maxChars = MAX_FIELD_CHARS) {
  let out = value === undefined || value === null ? '' : String(value);
  for (const [pattern, replacement] of SUBSTITUTIONS) out = out.replace(pattern, replacement);
  // Decompose accents (José → Jose) then drop anything still unencodable.
  out = out.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  out = out.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
  return out.slice(0, maxChars).trim();
}

const s = (v) => toPdfText(v);

// "2026-09-08" → "09/08/2026"; anything else passes through unchanged.
function usDate(value) {
  const t = s(value);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[2]}/${iso[3]}/${iso[1]}` : t;
}

export function computeValues(sub, company) {
  const first = s(sub.legalFirstName);
  const middle = s(sub.middleInitial);
  const last = s(sub.legalLastName);
  const fullName = [first, middle && `${middle.replace(/\.$/, '')}.`, last].filter(Boolean).join(' ');
  const cityStateZip = [s(sub.city), [s(sub.state), s(sub.zip)].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  const election =
    sub.healthElection === 'interested'
      ? 'Election: I am interested in enrolling — please send me enrollment details.'
      : sub.healthElection === 'declined'
        ? 'Election: I decline to participate at this time.'
        : '';

  return {
    firstAndMiddle: [first, middle].filter(Boolean).join(' '),
    lastName: last,
    fullName,
    ssn: s(sub.ssn),
    address: s(sub.address),
    cityStateZip,
    fullAddress: [s(sub.address), cityStateZip].filter(Boolean).join(', '),
    healthElectionLabel: election,
    businessNameOrBlank: s(sub.businessName),
    businessAddress: s(sub.businessAddress),
    businessCity: s(sub.businessCity),
    businessState: s(sub.businessState),
    businessZip: s(sub.businessZip),
    city: s(sub.city),
    state: s(sub.state),
    zip: s(sub.zip),
    phone: s(sub.phone),
    email: s(sub.email),
    businessName: s(sub.businessName) || 'N/A',
    dba: s(sub.businessName) || 'N/A',
    driversLicense: s(sub.driversLicense),
    licenseState: s(sub.licenseState),
    signerTitle: s(sub.signerTitle) || 'Owner',
    signedDate: sub.signedDate,
    companyName: s(company.name),
    companyAddress: s(company.address),
    companyNameAddress: `${s(company.name)}\n${s(company.address)}`,
    // The employer strip on the W-4 sits beside a MM/DD/YYYY signature date,
    // so an ISO start date is reformatted to match.
    startDate: usDate(sub.startDate),
    ein: s(company.ein),
    // W-4 numbers
    w4Dependents: s(sub.w4QualifyingChildren),
    w4OtherDependents: s(sub.w4OtherDependents),
    w4DependentTotal: s(sub.w4DependentTotal),
    w4OtherIncome: s(sub.w4OtherIncome),
    w4Deductions: s(sub.w4Deductions),
    w4Extra: s(sub.w4ExtraWithholding),
  };
}

// ── Signature rendering ─────────────────────────────────────────────────────

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

// A truncated or malformed PNG makes pdf-lib's decoder spin forever — and it
// blocks the event loop, so no timeout can rescue it. Every byte is therefore
// structurally validated before it is handed over.
function isValidPng(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 57 || buf.length > MAX_SIGNATURE_BYTES) return false;
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) return false;

  // First chunk must be a well-formed IHDR with sane dimensions.
  if (buf.readUInt32BE(8) !== 13 || buf.toString('latin1', 12, 16) !== 'IHDR') return false;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 4000 || height > 4000) return false;
  // A small compressed file can still decode to gigabytes of RGBA, which would
  // exhaust the function's memory, so bound the pixel count too.
  if (width * height > 4_000_000) return false;

  // Walk every chunk; the file must land exactly on IEND with nothing after it.
  let offset = 8;
  let sawIend = false;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    if (length > buf.length) return false;
    const type = buf.toString('latin1', offset + 4, offset + 8);
    if (!/^[a-zA-Z]{4}$/.test(type)) return false;
    const next = offset + 12 + length; // length + type + data + CRC
    if (next > buf.length) return false;
    if (type === 'IEND') {
      sawIend = true;
      offset = next;
      break;
    }
    offset = next;
  }
  return sawIend && offset === buf.length;
}

// True when a submitted signature value is usable: either a valid PNG data URL
// or non-empty typed text.
export function isUsableSignature(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (!value.startsWith('data:')) return true;
  if (!value.startsWith('data:image/png;base64,')) return false;
  const b64 = value.slice('data:image/png;base64,'.length);
  if (!b64 || b64.length > MAX_SIGNATURE_BYTES * 1.4 || /[^A-Za-z0-9+/=]/.test(b64)) return false;
  try {
    return isValidPng(Buffer.from(b64, 'base64'));
  } catch {
    return false;
  }
}

// Signature ids that must be present and valid for a submission to be accepted.
export const REQUIRED_SIGNATURES = [
  ['exclusivityInitials', 'initials for the exclusivity clause'],
  ['nonSolicitInitials', 'initials for the non-solicitation clause'],
  ['agentAgreementSignature', 'your signature on the Agent Agreement'],
  ['scheduleASignature', 'your signature on Schedule A'],
  ['emailPolicySignature', 'your signature on the Email Policy'],
  ['healthSharingSignature', 'your signature on the Health Sharing acknowledgment'],
];

export function missingSignatures(signatures = {}) {
  return REQUIRED_SIGNATURES.filter(([id]) => !isUsableSignature(signatures[id])).map(([, label]) => label);
}

async function embedSignature(pdfDoc, value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/png;base64,')) return null;
  const b64 = value.slice('data:image/png;base64,'.length);
  if (!b64 || b64.length > MAX_SIGNATURE_BYTES * 1.4 || /[^A-Za-z0-9+/=]/.test(b64)) return null;

  let bytes;
  try {
    bytes = Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
  if (!isValidPng(bytes)) {
    console.error('Rejected a signature image that failed PNG validation.');
    return null;
  }
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

// Draws a signature: an embedded drawing if provided, otherwise script-style text.
async function drawSignature(pdfDoc, page, value, { x, y, maxWidth = 200, height = 26, font }) {
  const img = await embedSignature(pdfDoc, value);
  if (img) {
    const scale = Math.min(maxWidth / img.width, height / img.height);
    page.drawImage(img, {
      x,
      y: y - 2,
      width: img.width * scale,
      height: img.height * scale,
    });
    return;
  }
  // A data URL that failed validation must never be printed as literal text.
  const text = s(value);
  if (!text || text.startsWith('data:')) return;
  let size = 14;
  while (size > 7 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  page.drawText(text, { x, y, size, font, color: NAVY });
}

function drawText(page, text, { x, y, maxWidth = 300, size = 10, font, color = INK }) {
  const t = s(text);
  if (!t) return;
  let fs = size;
  while (fs > 5.5 && font.widthOfTextAtSize(t, fs) > maxWidth) fs -= 0.25;
  page.drawText(t, { x, y, size: fs, font, color });
}

// ── W-4 ─────────────────────────────────────────────────────────────────────

const W4 = 'topmostSubform[0].Page1[0]';

async function buildW4(sub, values, company) {
  const bytes = readDocument('w4');
  if (!bytes) return null;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();

  const setText = (name, value) => {
    const v = s(value);
    if (!v) return;
    try {
      form.getTextField(name).setText(v);
    } catch {
      /* field absent in this revision — skip */
    }
  };
  const check = (name) => {
    try {
      form.getCheckBox(name).check();
    } catch {
      /* ignore */
    }
  };

  setText(`${W4}.Step1a[0].f1_01[0]`, values.firstAndMiddle);
  setText(`${W4}.Step1a[0].f1_02[0]`, values.lastName);
  setText(`${W4}.Step1a[0].f1_03[0]`, values.address);
  setText(`${W4}.Step1a[0].f1_04[0]`, values.cityStateZip);
  setText(`${W4}.f1_05[0]`, values.ssn);

  const status = s(sub.w4FilingStatus);
  if (status === 'single') check(`${W4}.c1_1[0]`);
  else if (status === 'married') check(`${W4}.c1_1[1]`);
  else if (status === 'head') check(`${W4}.c1_1[2]`);

  if (sub.w4MultipleJobs) check(`${W4}.c1_2[0]`);

  setText(`${W4}.Step3_ReadOrder[0].f1_06[0]`, values.w4Dependents);
  setText(`${W4}.Step3_ReadOrder[0].f1_07[0]`, values.w4OtherDependents);
  setText(`${W4}.f1_08[0]`, values.w4DependentTotal);
  setText(`${W4}.f1_09[0]`, values.w4OtherIncome);
  setText(`${W4}.f1_10[0]`, values.w4Deductions);
  setText(`${W4}.f1_11[0]`, values.w4Extra);

  // Employer strip — filled by the company, never by the hire.
  setText(`${W4}.f1_12[0]`, values.companyNameAddress);
  setText(`${W4}.f1_13[0]`, values.startDate);
  setText(`${W4}.f1_14[0]`, values.ein);

  const page = doc.getPages()[0];
  const script = await doc.embedFont(StandardFonts.HelveticaOblique);
  const helv = await doc.embedFont(StandardFonts.Helvetica);

  // Step 5 signature line (not an AcroForm field on the IRS PDF).
  await drawSignature(doc, page, sub.signatures?.w4Signature, {
    x: 115,
    y: 92,
    maxWidth: 300,
    height: 24,
    font: script,
  });
  drawText(page, values.signedDate, { x: 470, y: 92, size: 10, font: helv, color: NAVY });

  form.flatten();
  return doc;
}

// ── Generic stamping for the non-fillable documents ─────────────────────────

async function buildStamped(key, sub, values) {
  const bytes = readDocument(key);
  if (!bytes) return null;
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const script = await doc.embedFont(StandardFonts.HelveticaOblique);

  for (const stamp of STAMPS[key] || []) {
    const page = pages[stamp.page - 1];
    if (!page) continue;

    if (stamp.kind === 'signature' || stamp.kind === 'initials') {
      await drawSignature(doc, page, sub.signatures?.[stamp.id], {
        x: stamp.x,
        y: stamp.y,
        maxWidth: stamp.maxWidth || (stamp.kind === 'initials' ? 60 : 200),
        height: stamp.kind === 'initials' ? 20 : 26,
        font: script,
      });
      continue;
    }

    if (stamp.kind === 'paragraph') {
      const text = toPdfText(stamp.text || '', 2000);
      const size = stamp.size || 10;
      const words = text.split(/\s+/);
      let line = '';
      let y = stamp.y;
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (helv.widthOfTextAtSize(test, size) > stamp.maxWidth && line) {
          page.drawText(line, { x: stamp.x, y, size, font: helv, color: INK });
          y -= size * 1.45;
          line = w;
        } else {
          line = test;
        }
      }
      if (line) page.drawText(line, { x: stamp.x, y, size, font: helv, color: INK });
      continue;
    }

    const value = stamp.value !== undefined ? stamp.value : values[stamp.source];
    drawText(page, value, {
      x: stamp.x,
      y: stamp.y,
      maxWidth: stamp.maxWidth || 260,
      size: stamp.size || 10,
      font: stamp.bold ? bold : helv,
      color: stamp.kind === 'date' ? NAVY : INK,
    });
  }

  return doc;
}

// ── E-signature certificate ─────────────────────────────────────────────────

async function appendCertificate(doc, { documentTitle, sub, values, audit, company }) {
  const page = doc.addPage([612, 792]);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const M = 64;
  const W = 612 - M * 2;
  let y = 720;

  page.drawRectangle({ x: 0, y: 786, width: 612, height: 6, color: NAVY });
  page.drawText(s(company.name).toUpperCase(), {
    x: M, y, size: 9, font: bold, color: MUTED,
  });
  y -= 34;
  page.drawText('Electronic Signature Certificate', { x: M, y, size: 19, font: bold, color: NAVY });
  y -= 22;
  page.drawText(s(documentTitle), { x: M, y, size: 11, font: helv, color: MUTED });
  y -= 26;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1, color: LINE });
  y -= 28;

  const rows = [
    ['Signed by', values.fullName],
    ['Email', values.email],
    ['Phone', values.phone],
    ['Role', s(sub.jobTitle) || 'Account Executive'],
    ['Date signed', `${values.signedDate}${audit.time ? ` at ${audit.time}` : ''}`],
    ['Signature method', sub.signatures && Object.values(sub.signatures).some((v) => String(v).startsWith('data:')) ? 'Drawn on device' : 'Typed'],
    ['IP address', audit.ip || 'not recorded'],
    ['Browser', (audit.userAgent || 'not recorded').slice(0, 64)],
    ['Consent', 'Signer consented to sign electronically (ESIGN / UETA)'],
    ['Reference', audit.reference || ''],
  ];

  for (const [label, value] of rows) {
    if (!s(value)) continue;
    page.drawText(label.toUpperCase(), { x: M, y, size: 7.5, font: bold, color: MUTED });
    const text = s(value);
    let size = 10.5;
    while (size > 5.5 && helv.widthOfTextAtSize(text, size) > W - 152) size -= 0.25;
    page.drawText(text, { x: M + 150, y, size, font: helv, color: INK });
    y -= 12;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: M + W, y: y + 4 }, thickness: 0.5, color: LINE });
    y -= 12;
  }

  y -= 10;
  const note =
    'This certificate records an electronic signature applied to the document above. ' +
    'The signer confirmed their identity by accessing a unique link sent to the email address shown, ' +
    'consented to do business electronically, and reviewed the document before signing.';
  let line = '';
  for (const w of note.split(' ')) {
    const test = line ? `${line} ${w}` : w;
    if (helv.widthOfTextAtSize(test, 9) > W) {
      page.drawText(line, { x: M, y, size: 9, font: helv, color: MUTED });
      y -= 13;
      line = w;
    } else line = test;
  }
  if (line) page.drawText(line, { x: M, y, size: 9, font: helv, color: MUTED });

  page.drawText(`${s(company.name)} - ${s(company.address)}`, {
    x: M, y: 46, size: 8, font: helv, color: MUTED,
  });
}

// ── Public entry point ──────────────────────────────────────────────────────

export async function buildCompletedDocuments(sub, company, audit = {}) {
  const values = computeValues(sub, company);
  const lastName = (s(sub.legalLastName) || 'NewHire').replace(/[^\w-]/g, '');
  const out = [];

  for (const def of COMPANY_DOCUMENTS) {
    let doc = null;
    try {
      doc = def.key === 'w4' ? await buildW4(sub, values, company) : await buildStamped(def.key, sub, values);
    } catch (err) {
      console.error(`Could not build ${def.key}:`, err.message);
      continue;
    }
    if (!doc) continue;

    try {
      await appendCertificate(doc, {
        documentTitle: def.title,
        sub,
        values,
        audit,
        company,
      });
    } catch (err) {
      console.error(`Certificate failed for ${def.key}:`, err.message);
    }

    out.push({
      key: def.key,
      title: def.title,
      filename: `${lastName}-${def.file.replace(/\.pdf$/i, '')}-COMPLETED.pdf`,
      buffer: Buffer.from(await doc.save()),
    });
  }

  return out;
}
