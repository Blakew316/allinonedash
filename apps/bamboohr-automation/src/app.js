// The Express app, shared by the local server (server.js) and the Netlify
// serverless function (netlify/functions/api.mjs).

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BambooClient } from './bamboohr.js';
import { DemoStore } from './demo.js';
import { createMailer } from './mailer.js';
import { PACKET_DOCUMENTS, renderTemplateToPdf, buildTokens } from './packet.js';
import { extractResumeText, extractCandidate } from './resume.js';
import { COMPANY_DOCUMENTS, readDocument } from './documents.js';
import { verifyPaperworkToken, paperworkUrl, buildCompletedDocuments, missingSignatures } from './paperwork.js';
import { readCollection, upsertRecord, deleteRecord, describe as describeStore, COLLECTIONS } from './store.js';

// Note: named moduleDir, not __dirname — Netlify's bundler injects its own
// __dirname shim into ESM files, and a local declaration collides with it.
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ serveStatic = false } = {}) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  if (serveStatic) {
    app.use(express.static(path.join(moduleDir, '..', 'public')));
  }

  const LIVE = Boolean(process.env.BAMBOOHR_SUBDOMAIN && process.env.BAMBOOHR_API_KEY);
  const bamboo = LIVE
    ? new BambooClient({
        subdomain: process.env.BAMBOOHR_SUBDOMAIN,
        apiKey: process.env.BAMBOOHR_API_KEY,
      })
    : null;
  const demo = LIVE ? null : new DemoStore();
  const mailer = createMailer(process.env);

  const company = {
    name: process.env.COMPANY_NAME || 'WPI Inc.',
    address: process.env.COMPANY_ADDRESS || '7602 University Ave, Lubbock, Texas 79423',
    hrName: process.env.HR_CONTACT_NAME || 'WPI Onboarding',
    hrEmail: process.env.HR_CONTACT_EMAIL || 'people@example.com',
    ein: process.env.COMPANY_EIN || '',
  };

  // Where completed paperwork is delivered internally.
  const paperworkInbox = () =>
    process.env.PAPERWORK_INBOX || process.env.MAIL_CC || company.hrEmail;

  const originOf = (req) => {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('x-forwarded-host') || req.get('host');
    return host ? `${proto}://${host}` : '';
  };

  // Optional access gate for public deployments: when APP_PASSWORD is set,
  // every API call must carry it in the x-app-password header. The frontend
  // prompts for it once and remembers it for the session.
  app.use('/api', (req, res, next) => {
    const required = process.env.APP_PASSWORD;
    if (!required) return next();
    // New hires authenticate with their signed link, not the site password —
    // gating these would lock them out of their own paperwork.
    if (req.path.startsWith('/paperwork/')) return next();
    if (req.get('x-app-password') === required) return next();
    res.status(401).json({ error: 'password_required' });
  });

  const wrap = (fn) => (req, res) =>
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error(err);
      res.status(err.status && err.status >= 400 ? 502 : 500).json({
        error: err.message || 'Unexpected server error',
      });
    });

  // ── Status / config ────────────────────────────────────────────────────

  app.get('/api/status', wrap(async (req, res) => {
    res.json({
      mode: LIVE ? 'live' : 'demo',
      subdomain: LIVE ? process.env.BAMBOOHR_SUBDOMAIN : null,
      emailConfigured: mailer.configured,
      storage: await describeStore(),
      company,
    });
  }));

  // ── Saved records ──────────────────────────────────────────────────────
  // Candidates added by resume upload, manual corrections, and completed
  // hires all live server-side so they persist across devices and sessions.

  app.get('/api/saved', wrap(async (req, res) => {
    const [candidates, overrides, sends, hires] = await Promise.all([
      readCollection(COLLECTIONS.candidates),
      readCollection(COLLECTIONS.overrides),
      readCollection(COLLECTIONS.sends),
      readCollection(COLLECTIONS.hires),
    ]);
    res.json({ candidates, overrides, sends, hires, storage: await describeStore() });
  }));

  app.post('/api/saved/candidates', wrap(async (req, res) => {
    const c = req.body?.candidate;
    if (!c || !c.id) return res.status(400).json({ error: 'candidate.id is required' });
    await upsertRecord(COLLECTIONS.candidates, { ...c, savedAt: new Date().toISOString() });
    res.json({ ok: true });
  }));

  app.delete('/api/saved/candidates/:id', wrap(async (req, res) => {
    await deleteRecord(COLLECTIONS.candidates, req.params.id);
    await deleteRecord(COLLECTIONS.overrides, req.params.id);
    res.json({ ok: true });
  }));

  app.post('/api/saved/overrides', wrap(async (req, res) => {
    const { id, details } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (details === null) {
      await deleteRecord(COLLECTIONS.overrides, id);
    } else {
      await upsertRecord(COLLECTIONS.overrides, { id: String(id), ...details, savedAt: new Date().toISOString() });
    }
    res.json({ ok: true });
  }));

  app.get('/api/hires', wrap(async (req, res) => {
    res.json({ hires: await readCollection(COLLECTIONS.hires) });
  }));

  // ── Hiring pipeline (ATS) ──────────────────────────────────────────────

  app.get('/api/jobs', wrap(async (req, res) => {
    const result = LIVE ? await bamboo.getJobs() : demo.getJobs();
    const jobs = Array.isArray(result) ? result : result?.jobs || [];
    res.json({ jobs });
  }));

  app.get('/api/candidates', wrap(async (req, res) => {
    const { jobId, page } = req.query;
    const result = LIVE
      ? await bamboo.getApplications({ jobId, page: page || 1 })
      : demo.getApplications({ jobId });
    res.json(result);
  }));

  app.get('/api/candidates/:id', wrap(async (req, res) => {
    const result = LIVE
      ? await bamboo.getApplication(req.params.id)
      : demo.getApplication(req.params.id);
    if (!result) return res.status(404).json({ error: 'Candidate not found' });
    res.json(result);
  }));

  app.get('/api/statuses', wrap(async (req, res) => {
    const result = LIVE ? await bamboo.getHiringStatuses() : demo.getHiringStatuses();
    const statuses = Array.isArray(result) ? result : result?.hiringStatuses || [];
    res.json({ statuses });
  }));

  app.post('/api/candidates/:id/status', wrap(async (req, res) => {
    const { statusId } = req.body;
    if (!statusId) return res.status(400).json({ error: 'statusId is required' });
    if (LIVE) await bamboo.updateApplicationStatus(req.params.id, statusId);
    else demo.updateApplicationStatus(req.params.id, statusId);
    res.json({ ok: true });
  }));

  // ── Hiring: candidate → employee ───────────────────────────────────────

  app.post('/api/hire', wrap(async (req, res) => {
    const { employee = {}, applicationId, hiredStatusId } = req.body;
    if (!employee.firstName || !employee.lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' });
    }

    const fields = {
      firstName: employee.firstName,
      lastName: employee.lastName,
    };
    if (employee.workEmail) fields.workEmail = employee.workEmail;
    if (employee.jobTitle) fields.jobTitle = employee.jobTitle;
    if (employee.department) fields.department = employee.department;
    if (employee.hireDate) fields.hireDate = employee.hireDate;
    if (employee.location) fields.location = employee.location;
    if (employee.mobilePhone) fields.mobilePhone = employee.mobilePhone;

    const created = LIVE ? await bamboo.addEmployee(fields) : demo.addEmployee(fields);

    // Best-effort: move the ATS application to the "Hired" status too.
    let statusUpdated = false;
    if (applicationId && hiredStatusId) {
      try {
        if (LIVE) await bamboo.updateApplicationStatus(applicationId, hiredStatusId);
        else demo.updateApplicationStatus(applicationId, hiredStatusId);
        statusUpdated = true;
      } catch (err) {
        console.error('Could not update application status after hire:', err.message);
      }
    }

    res.json({ ok: true, employeeId: created.id, statusUpdated });
  }));

  app.get('/api/employees', wrap(async (req, res) => {
    const result = LIVE ? await bamboo.getDirectory() : demo.getDirectory();
    res.json({ employees: result?.employees || [] });
  }));

  // Tests the SMTP login without sending an email, and reports which
  // account the deployed configuration is authenticating as.
  app.post('/api/email/test', wrap(async (req, res) => {
    const result = await mailer.verify();
    res.json({
      ok: result.ok,
      host: mailer.host || '(not set)',
      user: mailer.maskedUser,
      error: result.error,
    });
  }));

  // ── Resume upload ──────────────────────────────────────────────────────

  // Extracts the candidate's name, email, and phone from an uploaded resume
  // (PDF, DOCX, or plain text, sent base64-encoded).
  app.post('/api/resume/parse', wrap(async (req, res) => {
    const { filename, contentBase64 } = req.body;
    if (!filename || !contentBase64) {
      return res.status(400).json({ error: 'filename and contentBase64 are required' });
    }
    const buffer = Buffer.from(contentBase64, 'base64');
    // Base64 inflates by ~33%, and the platform rejects payloads over ~6 MB
    // before this handler ever runs, so the usable file size is lower.
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ error: 'Resume is too large (4 MB max)' });
    }
    let text = '';
    try {
      text = await extractResumeText(filename, buffer);
    } catch (err) {
      console.error('Resume text extraction failed:', err.message);
    }
    const candidate = extractCandidate(text || '');
    const found = ['firstName', 'email', 'phone'].filter((k) => candidate[k]).length;
    res.json({
      ok: true,
      candidate,
      note:
        found === 0
          ? 'No details could be read from this file (it may be a scanned image) — fill them in below.'
          : found < 3
            ? 'Some details could not be found — review and complete them below.'
            : 'Details extracted — review before adding.',
    });
  }));

  // ── New-hire paperwork portal ──────────────────────────────────────────
  // These two routes are used by the hire, not by HR, so they authenticate
  // with the signed link token rather than the site password.

  app.post('/api/paperwork/session', (req, res) => {
    const hire = verifyPaperworkToken(req.body?.token, process.env);
    if (!hire) {
      return res.status(401).json({ ok: false, error: 'This paperwork link is invalid or has been changed.' });
    }
    res.json({
      ok: true,
      hire,
      company: { name: company.name, address: company.address, hrName: company.hrName },
      documents: COMPANY_DOCUMENTS.map(({ key, title, summary }) => ({ key, title, summary })),
    });
  });

  app.post('/api/paperwork/submit', wrap(async (req, res) => {
    const hire = verifyPaperworkToken(req.body?.token, process.env);
    if (!hire) {
      return res.status(401).json({ ok: false, error: 'This paperwork link is invalid or has been changed.' });
    }
    const submission = req.body?.submission || {};
    if (!submission.esignConsent) {
      return res.status(400).json({ ok: false, error: 'Electronic signature consent is required.' });
    }
    if (!submission.legalFirstName || !submission.legalLastName) {
      return res.status(400).json({ ok: false, error: 'Your legal name is required.' });
    }
    const missing = missingSignatures(submission.signatures);
    if (missing.length) {
      return res.status(400).json({
        ok: false,
        error: `We couldn't read ${missing.length === 1 ? 'one of your signatures' : 'some of your signatures'}: ${missing.join(', ')}. Please go back and sign again.`,
      });
    }

    const now = new Date();
    // One timezone for the signing date and the certificate time, so a late
    // evening submission can't stamp two different days on the same document.
    const zone = process.env.COMPANY_TIMEZONE || 'America/Chicago';
    const inZone = (opts) => now.toLocaleString('en-US', { timeZone: zone, ...opts });
    // x-nf-client-connection-ip is set by Netlify's edge; the forwarded-for
    // fallback is client-supplied, so it is labelled as reported rather than
    // presented as verified.
    const edgeIp = (req.get('x-nf-client-connection-ip') || '').trim();
    const reportedIp = (req.get('x-forwarded-for') || '').split(',')[0].trim() || req.ip || '';
    const audit = {
      ip: edgeIp || (reportedIp ? `${reportedIp} (reported)` : ''),
      userAgent: req.get('user-agent') || '',
      time: `${inZone({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} ${zone}`,
      reference: `WP-${now.getTime().toString(36).toUpperCase()}`,
    };
    const enriched = {
      ...submission,
      // Trusted values come from the signed link, not the browser.
      jobTitle: hire.jobTitle || 'Account Executive',
      startDate: hire.startDate || '',
      signedDate: inZone({ month: '2-digit', day: '2-digit', year: 'numeric' }),
    };

    const completed = await buildCompletedDocuments(enriched, company, audit);
    // Every document must build — a partial packet must never be reported as
    // complete, since the hire would believe they had signed everything.
    if (completed.length !== COMPANY_DOCUMENTS.length) {
      const built = new Set(completed.map((d) => d.key));
      const failedDocs = COMPANY_DOCUMENTS.filter((d) => !built.has(d.key)).map((d) => d.title);
      console.error('Paperwork generation incomplete; missing:', failedDocs.join(', '));
      return res.status(500).json({
        ok: false,
        error: `We couldn't finish preparing ${failedDocs.join(' and ')}. Nothing has been submitted — please contact ${company.hrEmail} so we can sort this out.`,
      });
    }

    const steps = [];
    steps.push({
      step: 'Complete documents',
      status: 'done',
      detail: `${completed.length} signed PDFs generated: ${completed.map((d) => d.title).join(', ')}`,
    });

    // Deliver to the company inbox, copying the new hire.
    let emailed = false;
    try {
      const sent = await mailer.sendCompletedPaperwork({
        to: paperworkInbox(),
        // Always the address from the signed link — never a client-supplied
        // one, which would turn this into an open mail relay.
        cc: hire.email,
        hire: { ...hire, ...enriched },
        company,
        documents: completed,
        audit,
      });
      emailed = !sent.simulated;
      steps.push({
        step: 'Deliver paperwork',
        status: sent.simulated ? 'simulated' : 'done',
        detail: sent.simulated
          ? `SMTP not configured — would send ${completed.length} completed PDFs to ${sent.to}`
          : `Sent to ${sent.to} (cc ${sent.cc}) — message id ${sent.messageId}`,
      });
    } catch (err) {
      console.error('Paperwork delivery failed:', err.message);
      steps.push({ step: 'Deliver paperwork', status: 'error', detail: err.message });
    }

    // File on the BambooHR employee record when we know who they are.
    if (LIVE && hire.employeeId) {
      try {
        const categoryId = await bamboo.ensureFileCategory(hire.employeeId, 'Signed Paperwork');
        if (categoryId) {
          for (const doc of completed) {
            await bamboo.uploadEmployeeFile(hire.employeeId, {
              fileName: doc.filename,
              buffer: doc.buffer,
              categoryId,
              share: true,
            });
          }
          steps.push({
            step: 'File in BambooHR',
            status: 'done',
            detail: `${completed.length} signed PDFs filed on employee #${hire.employeeId}`,
          });
        }
      } catch (err) {
        console.error('BambooHR upload failed:', err.message);
        steps.push({ step: 'File in BambooHR', status: 'error', detail: err.message });
      }
    }

    // Keep a durable record of the completed paperwork so there is a lasting
    // history of every hire, independent of anyone's inbox.
    try {
      await upsertRecord(COLLECTIONS.hires, {
        id: audit.reference,
        reference: audit.reference,
        firstName: enriched.legalFirstName || hire.firstName,
        lastName: enriched.legalLastName || hire.lastName,
        email: hire.email,
        phone: enriched.phone || hire.phone,
        jobTitle: enriched.jobTitle,
        startDate: hire.startDate || '',
        employeeId: hire.employeeId || '',
        signedDate: enriched.signedDate,
        signedAt: now.toISOString(),
        documents: completed.map((d) => d.title),
        healthElection: submission.healthElection || '',
        delivered: emailed,
      });
    } catch (err) {
      console.error('Could not save the hire record:', err.message);
    }

    const failed = steps.some((s) => s.status === 'error');
    res.json({
      ok: !failed,
      emailed,
      reference: audit.reference,
      steps,
      documents: completed.map(({ key, title, filename }) => ({ key, title, filename })),
    });
  }));

  // ── Onboarding packet ──────────────────────────────────────────────────

  // The packet is the set of documents the hire completes and signs online.
  app.get('/api/packet/documents', (req, res) => {
    res.json({
      documents: COMPANY_DOCUMENTS.map(({ key, title, summary }) => ({
        key,
        title,
        summary,
        default: true,
        company: true,
      })),
    });
  });

  // Preview a document: the company PDFs as they are, and the generated
  // templates rendered with the current hire's details.
  app.post('/api/packet/preview', wrap(async (req, res) => {
    const { hire = {}, docKey } = req.body;

    if (COMPANY_DOCUMENTS.some((d) => d.key === docKey)) {
      const buffer = readDocument(docKey);
      if (!buffer) return res.status(404).json({ error: `Document unavailable: ${docKey}` });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${docKey}.pdf"`);
      return res.send(buffer);
    }

    if (!PACKET_DOCUMENTS.some((d) => d.key === docKey)) {
      return res.status(400).json({ error: `Unknown document: ${docKey}` });
    }
    const buffer = await renderTemplateToPdf(docKey, buildTokens(hire, company), company);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${docKey}.pdf"`);
    res.send(buffer);
  }));

  // THE button: builds every selected PDF, emails the packet to the new hire,
  // and uploads the documents to their BambooHR file section.
  app.post('/api/onboarding/send', wrap(async (req, res) => {
    const { hire = {}, documents, options = {} } = req.body;
    const steps = [];

    if (!hire.firstName || !hire.email) {
      return res.status(400).json({ error: 'Hire first name and email are required' });
    }
    // Every packet defaults to the standard role unless one was provided.
    if (!hire.jobTitle) hire.jobTitle = 'Account Executive';
    const requested =
      Array.isArray(documents) && documents.length
        ? documents
        : COMPANY_DOCUMENTS.map((d) => d.key);

    // 1. Work out the signing packet. Nothing is attached to this email — the
    // hire reads and signs in the portal, and receives signed copies after.
    const packet = COMPANY_DOCUMENTS.filter((d) => requested.includes(d.key)).map(
      ({ key, title }) => ({ key, title, signable: true })
    );
    if (!packet.length) {
      return res.status(400).json({ error: 'Select at least one document for the packet' });
    }
    steps.push({
      step: 'Prepare packet',
      status: 'done',
      detail: `${packet.length} documents to sign: ${packet.map((p) => p.title).join(', ')}`,
    });

    // The hire completes and signs the company documents through this link.
    const portalLink = paperworkUrl(hire, process.env, originOf(req));

    // 2. Email the packet
    if (options.sendEmail !== false) {
      const cc = options.ccHr && company.hrEmail ? process.env.MAIL_CC || company.hrEmail : undefined;
      const sent = await mailer.sendPacket({ to: hire.email, cc, hire, company, documents: packet, portalLink });
      steps.push(
        sent.simulated
          ? {
              step: 'Email packet',
              status: 'simulated',
              detail: `SMTP not configured — would send the signing invitation to ${sent.to}${cc ? ` (cc ${cc})` : ''} with subject “${sent.subject}”`,
            }
          : {
              step: 'Email packet',
              status: 'done',
              detail: `Sent to ${sent.to}${cc ? ` (cc ${cc})` : ''} — message id ${sent.messageId}`,
            }
      );
    } else {
      steps.push({ step: 'Email packet', status: 'skipped', detail: 'Email disabled for this send' });
    }

    // 3. Record the send so every device sees who has been invited, and the
    //    pipeline counters stay right without a BambooHR round-trip. A storage
    //    failure must not fail a packet that already went out.
    if (options.sendEmail !== false) {
      try {
        await upsertRecord(COLLECTIONS.sends, {
          id: hire.email.trim().toLowerCase(),
          email: hire.email.trim(),
          firstName: hire.firstName || '',
          lastName: hire.lastName || '',
          jobTitle: hire.jobTitle,
          documents: packet.map((p) => p.title),
          sentAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error(`Could not record the packet send to ${hire.email}:`, err.message);
      }
    }

    // 4. Signed copies are produced when the hire submits, so nothing is
    //    filed yet — say so rather than leaving a silent gap.
    steps.push({
      step: 'Awaiting signatures',
      status: 'skipped',
      detail: hire.employeeId
        ? `Signed PDFs will be emailed to you and filed on employee #${hire.employeeId} as soon as ${hire.firstName} completes the paperwork.`
        : `Signed PDFs will be emailed to you as soon as ${hire.firstName} completes the paperwork.`,
    });

    const failed = steps.some((s) => s.status === 'error');
    res.json({
      ok: !failed,
      steps,
      portalLink,
      documents: packet.map(({ key, title }) => ({ key, title })),
    });
  }));

  if (serveStatic) {
    // On Netlify these are handled by redirects in netlify.toml; locally the
    // Express server resolves them here.
    app.get('/paperwork', (req, res) => {
      res.sendFile(path.join(moduleDir, '..', 'public', 'paperwork.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(moduleDir, '..', 'public', 'index.html'));
    });
  }

  return app;
}
