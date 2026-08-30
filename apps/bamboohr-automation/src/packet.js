// Renders the markdown-ish templates in /templates into branded PDF documents.
// Supported template syntax: # / ## headings, - bullets, [ ] checkboxes,
// > callouts, 1. numbered items, --- rules, **bold** inline, {{tokens}},
// and [signature] which renders signature/date lines.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

// Resolve the templates directory in both environments: locally it sits next
// to src/, and in the Netlify function bundle it's included at the zip root.
const TEMPLATE_DIR = [
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates'),
  path.resolve(process.cwd(), 'templates'),
  '/var/task/templates',
].find((p) => fs.existsSync(p));

export const PACKET_DOCUMENTS = [
  { key: 'welcome-letter', title: 'Welcome Letter', default: true },
  { key: 'offer-letter', title: 'Offer Letter', default: true },
  { key: 'first-day-checklist', title: 'First-Day Checklist', default: true },
  { key: 'benefits-overview', title: 'Benefits Overview', default: true },
  { key: 'it-equipment', title: 'IT & Equipment Setup', default: true },
  { key: 'payroll-forms', title: 'Payroll & Required Forms', default: true },
  { key: 'handbook-acknowledgment', title: 'Handbook Acknowledgment', default: true },
];

const INK = '#1c2433';
const ACCENT = '#0b1b5e';
const MUTED = '#66738a';

export function buildTokens(hire, company) {
  const fullName = `${hire.firstName || ''} ${hire.lastName || ''}`.trim();
  return {
    firstName: hire.firstName || 'there',
    lastName: hire.lastName || '',
    fullName: fullName || 'New Hire',
    email: hire.email || 'on file',
    phone: hire.phone || 'on file',
    jobTitle: hire.jobTitle || 'your new role',
    department: hire.department || 'your',
    startDate: hire.startDate || 'your start date',
    manager: hire.manager || 'your manager',
    salary: hire.salary || 'as discussed in your offer conversation',
    employmentType: hire.employmentType || 'Full-Time',
    workLocation: hire.workLocation || 'your work location',
    companyName: company.name,
    companyAddress: company.address,
    hrContactName: company.hrName,
    hrContactEmail: company.hrEmail,
    today: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };
}

function interpolate(text, tokens) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    tokens[key] !== undefined ? String(tokens[key]) : `{{${key}}}`
  );
}

// Writes a line that may contain **bold** spans.
function writeInline(doc, text, opts = {}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '');
  parts.forEach((part, i) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(bold ? part.slice(2, -2) : part, {
        ...opts,
        continued: i < parts.length - 1,
      });
  });
}

function renderSignatureBlock(doc) {
  doc.moveDown(2.5);
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const lineWidth = width * 0.55;
  const y = doc.y;
  doc.moveTo(x, y).lineTo(x + lineWidth, y).lineWidth(0.8).strokeColor(INK).stroke();
  doc.moveTo(x + lineWidth + 24, y).lineTo(x + width, y).stroke();
  doc.fontSize(9).fillColor(MUTED).font('Helvetica');
  doc.text('Signature', x, y + 5, { width: lineWidth });
  doc.text('Date', x + lineWidth + 24, y + 5, { width: width - lineWidth - 24 });
  doc.x = x;
  doc.moveDown(2);
}

export function renderTemplateToPdf(templateKey, tokens, company) {
  const raw = fs.readFileSync(
    path.join(TEMPLATE_DIR, `${templateKey}.md`),
    'utf8'
  );
  const content = interpolate(raw, tokens);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 64, bottom: 64, left: 72, right: 72 } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Brand header band
    doc.rect(0, 0, doc.page.width, 6).fill(ACCENT);
    doc
      .fontSize(9)
      .fillColor(MUTED)
      .font('Helvetica')
      .text(company.name.toUpperCase(), doc.page.margins.left, 28, {
        width,
        characterSpacing: 1.5,
      });
    doc.y = 64;

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trimEnd();

      if (line === '') {
        doc.moveDown(0.5);
        continue;
      }
      if (line === '---') {
        doc.moveDown(0.4);
        const y = doc.y;
        doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + width, y)
          .lineWidth(0.5).strokeColor('#dde3ec').stroke();
        doc.moveDown(0.6);
        continue;
      }
      if (line === '[signature]') {
        renderSignatureBlock(doc);
        continue;
      }
      if (line.startsWith('# ')) {
        doc.fontSize(22).fillColor(INK).font('Helvetica-Bold')
          .text(line.slice(2), { width });
        doc.moveDown(0.6);
        continue;
      }
      if (line.startsWith('## ')) {
        doc.moveDown(0.4);
        doc.fontSize(13).fillColor(ACCENT).font('Helvetica-Bold')
          .text(line.slice(3), { width });
        doc.moveDown(0.3);
        continue;
      }
      if (line.startsWith('> ')) {
        doc.moveDown(0.2);
        const y0 = doc.y;
        doc.fontSize(10.5).fillColor(MUTED).font('Helvetica-Oblique');
        writeInline(doc, line.slice(2), {
          width: width - 16,
          indent: 0,
        });
        doc.x = doc.page.margins.left;
        doc.rect(doc.page.margins.left - 12, y0 - 2, 3, doc.y - y0 + 4).fill(ACCENT);
        doc.moveDown(0.4);
        continue;
      }
      if (line.startsWith('[ ] ')) {
        const y = doc.y + 1.5;
        doc.rect(doc.page.margins.left, y, 9, 9).lineWidth(0.9).strokeColor(ACCENT).stroke();
        doc.fontSize(11).fillColor(INK);
        doc.x = doc.page.margins.left + 18;
        writeInline(doc, line.slice(4), { width: width - 18 });
        doc.x = doc.page.margins.left;
        doc.moveDown(0.35);
        continue;
      }
      if (line.startsWith('- ')) {
        doc.fontSize(11).fillColor(ACCENT).font('Helvetica-Bold')
          .text('•', doc.page.margins.left + 4, doc.y, { continued: false, lineBreak: false });
        doc.fontSize(11).fillColor(INK);
        doc.x = doc.page.margins.left + 18;
        writeInline(doc, line.slice(2), { width: width - 18 });
        doc.x = doc.page.margins.left;
        doc.moveDown(0.25);
        continue;
      }
      const numbered = line.match(/^(\d+)\. (.*)$/);
      if (numbered) {
        doc.fontSize(11).fillColor(ACCENT).font('Helvetica-Bold')
          .text(`${numbered[1]}.`, doc.page.margins.left + 2, doc.y, { lineBreak: false });
        doc.fontSize(11).fillColor(INK);
        doc.x = doc.page.margins.left + 20;
        writeInline(doc, numbered[2], { width: width - 20 });
        doc.x = doc.page.margins.left;
        doc.moveDown(0.25);
        continue;
      }

      doc.fontSize(11).fillColor(INK);
      writeInline(doc, line, { width, lineGap: 2 });
      doc.moveDown(0.2);
    }

    // Footer (final page). Zero the bottom margin while writing so pdfkit
    // doesn't auto-paginate onto a blank page.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fontSize(8.5)
      .fillColor(MUTED)
      .font('Helvetica')
      .text(
        `${company.name} — ${company.address}`,
        doc.page.margins.left,
        doc.page.height - 46,
        { width, align: 'center', lineBreak: false }
      );
    doc.page.margins.bottom = bottomMargin;

    doc.end();
  });
}

// Builds every selected document; returns [{key, title, filename, buffer}]
export async function buildPacket(hire, company, documentKeys) {
  const tokens = buildTokens(hire, company);
  const selected = PACKET_DOCUMENTS.filter((d) => documentKeys.includes(d.key));
  const lastName = (hire.lastName || 'NewHire').replace(/[^\w-]/g, '');
  const out = [];
  for (const docDef of selected) {
    const buffer = await renderTemplateToPdf(docDef.key, tokens, company);
    out.push({
      key: docDef.key,
      title: docDef.title,
      filename: `${lastName}-${docDef.key}.pdf`,
      buffer,
    });
  }
  return out;
}
