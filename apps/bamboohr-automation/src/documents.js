// Registry of the company's real onboarding documents. These ship with the
// repo in public/documents and are both attached to the packet email and
// completed by the new hire through the paperwork portal.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

// Resolve in both the local checkout and the Netlify function bundle.
export const DOCUMENT_DIR = [
  path.join(moduleDir, '..', 'public', 'documents'),
  path.resolve(process.cwd(), 'public', 'documents'),
  '/var/task/public/documents',
].find((p) => fs.existsSync(p));

export const COMPANY_DOCUMENTS = [
  {
    key: 'agent-agreement',
    title: 'Agent Agreement 2026',
    file: 'Agent-Agreement-2026.pdf',
    // Requires completion in the portal (initials, signatures, profile data).
    completable: true,
    summary: 'Your contract with Wholesale Payments, including Schedule A (commission and residual schedule).',
  },
  {
    key: 'w4',
    title: 'Form W-4 (Federal Withholding)',
    file: 'W-4.pdf',
    completable: true,
    summary: 'Sets how much federal income tax is withheld from your pay.',
  },
  {
    key: 'email-policy',
    title: 'Corporate Email Usage Policy',
    file: 'Email-Policy.pdf',
    completable: true,
    summary: 'How your Wholesale Payments email account may be used.',
  },
  {
    key: 'health-sharing',
    title: 'Impact Health Sharing — Program Overview',
    file: 'Impact-Health-Sharing.pdf',
    completable: true,
    summary: 'An optional healthcare cost-sharing program you may enroll in directly.',
  },
];

export function documentPath(key) {
  const doc = COMPANY_DOCUMENTS.find((d) => d.key === key);
  if (!doc || !DOCUMENT_DIR) return null;
  const p = path.join(DOCUMENT_DIR, doc.file);
  return fs.existsSync(p) ? p : null;
}

export function readDocument(key) {
  const p = documentPath(key);
  return p ? fs.readFileSync(p) : null;
}
