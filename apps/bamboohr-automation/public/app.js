/* Hiring HQ frontend — talks to the local API, which proxies BambooHR. */

const state = {
  statuses: [],
  candidates: [],
  localCandidates: [],
  overrides: {},
  storage: null,
  documents: [],
  hiredStatusId: null,
  hiredThisSession: new Set(),
  sends: {},
  completedHires: [],
  synced: false,
};

const $ = (sel) => document.querySelector(sel);

const ICONS = {
  mail: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m22 7-10 6L2 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 2v4M8 2v4M3 10h18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flask: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  skip: '<svg viewBox="0 0 24 24"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 8h.01M12 12v4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ── Saved records ────────────────────────────────────────────────────────────
// Uploaded candidates and manual corrections are stored on the server so they
// persist across sessions and devices. The browser keeps a copy purely as an
// offline cache, so the pipeline still renders if a request fails.

const LOCAL_CANDIDATES_KEY = 'hhqLocalCandidates';
const OVERRIDES_KEY = 'hhqCandidateOverrides';

function cacheGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function cacheSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

function loadLocalCandidates() {
  return cacheGet(LOCAL_CANDIDATES_KEY, []) || [];
}
function saveLocalCandidates() {
  cacheSet(LOCAL_CANDIDATES_KEY, state.localCandidates);
}
function allCandidates() {
  return [...state.localCandidates, ...state.candidates];
}

// Pulls the saved records from the server; the cache covers a failed request.
async function loadSaved() {
  try {
    const res = await api('/api/saved');
    state.localCandidates = Array.isArray(res.candidates) ? res.candidates : [];
    state.overrides = {};
    for (const o of res.overrides || []) {
      const { id, savedAt, ...details } = o;
      void savedAt;
      state.overrides[String(id)] = details;
    }
    state.sends = {};
    for (const send of res.sends || []) {
      const key = emailKey(send.email || send.id);
      if (key) state.sends[key] = send;
    }
    state.completedHires = Array.isArray(res.hires) ? res.hires : [];
    state.storage = res.storage || null;
    saveLocalCandidates();
    cacheSet(OVERRIDES_KEY, state.overrides);
  } catch (err) {
    state.localCandidates = loadLocalCandidates();
    state.overrides = cacheGet(OVERRIDES_KEY, {}) || {};
    console.warn('Using cached records:', err.message);
  }
}

// Packets are addressed by email, so that is the key that ties a candidate to
// the packet they were sent and the paperwork they signed.
function emailKey(value) {
  return String(value || '').trim().toLowerCase();
}

function shortDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Where each candidate has got to: sent a packet, signed it, or neither.
function progressOf(c) {
  const key = emailKey(applicantOf(c).email);
  if (!key) return {};
  const signed = state.completedHires.find((h) => emailKey(h.email) === key);
  return { sentAt: state.sends[key]?.sentAt, signedAt: signed?.signedAt };
}

// Records the send locally the moment it succeeds, so the tiles and cards move
// without waiting for the next round-trip. The server stores it durably too.
function noteSend(email) {
  const key = emailKey(email);
  if (!key) return;
  state.sends[key] = { ...(state.sends[key] || {}), email, sentAt: new Date().toISOString() };
  renderStats();
  renderBoard();
}

function loadOverrides() {
  return state.overrides || {};
}

async function saveOverride(id, data) {
  if (data) state.overrides[String(id)] = data;
  else delete state.overrides[String(id)];
  cacheSet(OVERRIDES_KEY, state.overrides);
  try {
    await api('/api/saved/overrides', { method: 'POST', body: { id: String(id), details: data || null } });
  } catch (err) {
    toast(`Saved on this device only — ${err.message}`, true);
  }
}

function hasOverride(id) {
  return Boolean(loadOverrides()[String(id)]);
}

// The candidate's contact details with any manual edits applied.
function applicantOf(c) {
  const a = c.applicant || {};
  const o = loadOverrides()[String(c.id)];
  return o ? { ...a, ...o } : a;
}

// Optional access gate: if the server has APP_PASSWORD set, it answers 401
// until the password arrives in the x-app-password header. Ask once, keep it
// for the browser session.
function authHeaders() {
  const pw = sessionStorage.getItem('appPassword');
  return pw ? { 'x-app-password': pw } : {};
}

async function rawFetch(path, opts = {}, retried = false) {
  let res;
  try {
    res = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) },
    });
  } catch {
    // A dropped connection reads as "Failed to fetch", which tells nobody
    // anything. Say what actually happened.
    throw new Error(
      navigator.onLine
        ? 'Could not reach the server — try again in a moment'
        : "You're offline — reconnect to load the latest"
    );
  }
  if (res.status === 401 && !retried) {
    const pw = prompt('This site is password-protected. Enter the access password:');
    if (pw) {
      sessionStorage.setItem('appPassword', pw);
      return rawFetch(path, opts, true);
    }
  }
  return res;
}

const api = async (path, opts = {}) => {
  const res = await rawFetch(path, {
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error === 'password_required' ? 'Incorrect or missing password' : data.error || `Request failed (${res.status})`
    );
  }
  return data;
};

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast${isError ? ' error' : ''}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 4200);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}
// For use inside double-quoted HTML attributes (input values).
function escAttr(s) {
  return esc(s).replaceAll('"', '&quot;');
}

const AVATAR_COLORS = ['#0b1b5e', '#0a8fe0', '#0aa065', '#0f7691', '#4a5d94', '#6437a8', '#5b6673'];
function avatar(name, cls = 'avatar') {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return `<span class="${cls}" style="background:${color}">${esc(initials)}</span>`;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function showTab(name) {
  document.querySelectorAll('.nav-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${name}`));
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('.nav-tab').forEach((t) =>
  t.addEventListener('click', () => showTab(t.dataset.tab))
);

// ── Status / header ──────────────────────────────────────────────────────────

async function loadStatus() {
  const s = await api('/api/status');
  // Surface a badge only when something needs attention.
  const badge = $('#email-badge');
  const warning =
    s.storage && !s.storage.persistent
      ? 'Records not saving'
      : s.storage && !s.storage.sharedAcrossDevices
        ? 'Records: this device only'
        : s.mode !== 'live'
          ? 'Demo data'
          : !s.emailConfigured
            ? 'Email simulated'
            : '';
  if (warning) {
    badge.textContent = warning;
    badge.hidden = false;
  }
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

function chipClass(label) {
  const l = (label || '').toLowerCase();
  if (/(not a fit|reject|decline|disqualif)/.test(l)) return 'chip-red';
  if (/hire/.test(l)) return 'chip-green';
  if (/offer/.test(l)) return 'chip-violet';
  if (/interview/.test(l)) return 'chip-amber';
  if (/(phone|screen)/.test(l)) return 'chip-teal';
  if (/review/.test(l)) return 'chip-blue';
  return 'chip-gray';
}

// The BambooHR hiring stages, used to group the board and fill the per-card
// status dropdowns. Candidates themselves are only pulled on Sync.
async function loadStages() {
  const res = await api('/api/statuses');
  state.statuses = res.statuses.map((x) => ({ id: x.id, label: x.label || x.name }));
  const hired = state.statuses.find((x) => /hire/i.test(x.label));
  state.hiredStatusId = hired ? hired.id : null;
}

async function loadCandidates() {
  const res = await api('/api/candidates');
  state.candidates = res.applications || [];
  state.synced = true;
  renderStats();
  renderBoard();
  return state.candidates.length;
}

// The tiles read from the records this app owns — candidates on the board,
// packets it has sent, and paperwork that has come back signed. Nothing here
// needs a BambooHR round-trip, so the numbers move the moment anything changes.
function renderStats() {
  const el = $('#pipeline-stats');
  const all = allCandidates();

  const signed = new Set(state.completedHires.map((h) => emailKey(h.email)).filter(Boolean));
  const sent = new Set(signed); // signing proves a packet went out
  for (const key of Object.keys(state.sends)) if (key) sent.add(key);

  // Phones get the short label so four tiles fit one row and the candidate
  // cards stay above the fold; CSS picks which of the two to show.
  const stats = [
    { value: all.length, label: 'Candidates', short: 'Hires' },
    { value: sent.size, label: 'Packets sent', short: 'Sent' },
    { value: Math.max(0, sent.size - signed.size), label: 'Awaiting signature', short: 'Awaiting' },
    { value: signed.size, label: 'Signed & complete', short: 'Signed' },
  ];
  el.innerHTML = stats
    .map(
      (s) =>
        `<div class="stat"><div class="stat-value">${s.value}</div>` +
        `<div class="stat-label"><span class="label-full">${esc(s.label)}</span>` +
        `<span class="label-short">${esc(s.short)}</span></div></div>`
    )
    .join('');
  el.hidden = false;
}

function candidateCard(c) {
  const a = applicantOf(c);
  const name = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unknown';
  const role = c.job?.title?.label || c.job?.title || '';
  const statusLabel = c.status?.label || c.status?.name || '—';
  const edited = hasOverride(c.id);
  const statusOptions = state.statuses
    .map((s) => `<option value="${s.id}" ${String(s.id) === String(c.status?.id) ? 'selected' : ''}>${esc(s.label)}</option>`)
    .join('');
  const { sentAt, signedAt } = progressOf(c);
  const meta = [
    a.email && `<div class="meta-line">${ICONS.mail}<span>${esc(a.email)}</span></div>`,
    a.phoneNumber && `<div class="meta-line">${ICONS.phone}<span>${esc(a.phoneNumber)}</span></div>`,
    c.resumeName && `<div class="meta-line">${ICONS.file}<span>${esc(c.resumeName)}</span></div>`,
    c.startDate && `<div class="meta-line">${ICONS.calendar}<span>Starts ${esc(c.startDate)}</span></div>`,
    c.appliedDate && `<div class="meta-line">${ICONS.calendar}<span>Added ${esc(c.appliedDate)}</span></div>`,
    signedAt
      ? `<div class="meta-line meta-good">${ICONS.check}<span>Paperwork signed ${esc(shortDate(signedAt))}</span></div>`
      : sentAt && `<div class="meta-line meta-pending">${ICONS.mail}<span>Packet sent ${esc(shortDate(sentAt))} — awaiting signature</span></div>`,
  ].filter(Boolean).join('');

  return `
  <div class="candidate-card" data-id="${c.id}">
    <div class="candidate-head">
      ${avatar(name)}
      <div class="candidate-id">
        <div class="candidate-name">${esc(name)}${edited ? '<span class="tag-edited">Edited</span>' : ''}</div>
        <div class="candidate-role">${esc(role)}</div>
      </div>
      <span class="chip ${c.local ? 'chip-blue' : chipClass(statusLabel)}">${esc(statusLabel)}</span>
      <button class="icon-btn edit-btn" type="button" aria-label="Edit contact details" title="Edit contact details">${ICONS.pencil}</button>
    </div>
    <form class="edit-form" hidden>
      <div class="edit-grid">
        <label class="field">First name<input name="firstName" value="${escAttr(a.firstName || '')}" required /></label>
        <label class="field">Last name<input name="lastName" value="${escAttr(a.lastName || '')}" required /></label>
        <label class="field span-2">Email<input name="email" type="email" value="${escAttr(a.email || '')}" /></label>
        <label class="field span-2">Phone<input name="phoneNumber" type="tel" value="${escAttr(a.phoneNumber || '')}" /></label>
      </div>
      <div class="edit-actions">
        <button type="submit" class="btn btn-primary btn-sm">Save</button>
        <button type="button" class="btn btn-ghost btn-sm cancel-edit">Cancel</button>
        ${edited ? '<button type="button" class="btn btn-ghost btn-sm reset-edit">Reset to BambooHR</button>' : ''}
      </div>
    </form>
    ${meta ? `<div class="candidate-meta">${meta}</div>` : ''}
    <div class="candidate-actions">
      ${c.local
        ? `<button class="btn btn-primary btn-sm hire-btn" style="flex:1">Hire</button>
           <button class="btn btn-ghost btn-sm remove-local">Remove</button>`
        : `<select class="select status-select" aria-label="Move to stage">${statusOptions}</select>
           <button class="btn btn-primary btn-sm hire-btn">Hire</button>`}
      <button class="btn btn-ghost btn-sm send-packet-quick" ${a.email ? '' : 'disabled title="No email on file"'}>
        <svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Send onboarding packet
      </button>
    </div>
  </div>`;
}

// One-tap send from a candidate card: the packet is personalized with the
// candidate's name, email, phone, and role, and emailed immediately.
async function quickSendPacket(c, btn) {
  const a = applicantOf(c);
  if (!a.email) return toast('This candidate has no email on file', true);
  const name = `${a.firstName || ''} ${a.lastName || ''}`.trim();

  btn.disabled = true;
  const original = btn.innerHTML;
  btn.textContent = 'Sending…';
  try {
    const hire = {
      firstName: a.firstName || '',
      lastName: a.lastName || '',
      email: a.email,
      phone: a.phoneNumber || '',
      jobTitle: 'Account Executive',
      startDate: c.startDate || '',
    };
    const res = await api('/api/onboarding/send', {
      method: 'POST',
      body: { hire, options: { sendEmail: true, ccHr: true, uploadToBamboo: true } },
    });

    // Mirror the send in the Onboarding tab so the details and results are there.
    const p = $('#packet-form');
    p.firstName.value = hire.firstName;
    p.lastName.value = hire.lastName;
    p.email.value = hire.email;
    p.phone.value = hire.phone;
    p.jobTitle.value = hire.jobTitle;
    if (hire.startDate) p.startDate.value = hire.startDate;
    renderPacketResult(res);
    noteSend(hire.email);

    toast(res.ok ? `Onboarding packet sent to ${name || hire.email}` : 'Sent, but check the Onboarding tab', !res.ok);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function renderBoard() {
  const board = $('#pipeline-board');
  const all = allCandidates();
  if (!all.length) {
    board.innerHTML = state.synced
      ? '<div class="empty-state">No candidates in BambooHR yet.</div>'
      : '<div class="empty-state">No candidates yet — press Sync to pull them from BambooHR.</div>';
    return;
  }

  // Group candidates by stage: uploaded resumes first, then pipeline order.
  const order = state.statuses.map((s) => s.label);
  const OWN_STAGES = ['Added', 'Uploaded'];
  const rank = (label) => (OWN_STAGES.includes(label) ? OWN_STAGES.indexOf(label) - 2 : order.indexOf(label) + 1 || 99);
  const groups = new Map();
  for (const c of all) {
    const label = c.status?.label || 'Other';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(c);
  }
  const sorted = [...groups.entries()].sort((x, y) => rank(x[0]) - rank(y[0]));

  board.innerHTML = sorted
    .map(
      ([label, cands]) => `
      <section class="stage">
        <div class="stage-head">
          <span class="stage-name">${esc(label)}</span>
          <span class="stage-count">${cands.length}</span>
          <span class="stage-rule"></span>
        </div>
        <div class="candidate-grid">${cands.map(candidateCard).join('')}</div>
      </section>`
    )
    .join('');

  board.querySelectorAll('.status-select').forEach((sel) =>
    sel.addEventListener('change', async (e) => {
      const card = e.target.closest('.candidate-card');
      try {
        await api(`/api/candidates/${card.dataset.id}/status`, {
          method: 'POST',
          body: { statusId: Number(e.target.value) },
        });
        const label = state.statuses.find((s) => String(s.id) === e.target.value)?.label;
        const c = state.candidates.find((x) => String(x.id) === String(card.dataset.id));
        if (c) c.status = { id: Number(e.target.value), label };
        toast(`Moved to ${label}`);
        renderStats();
        renderBoard();
      } catch (err) {
        toast(err.message, true);
      }
    })
  );

  const findCandidate = (id) => allCandidates().find((x) => String(x.id) === String(id));

  board.querySelectorAll('.hire-btn').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const c = findCandidate(e.target.closest('.candidate-card').dataset.id);
      prefillHireForm(c);
      showTab('hire');
    })
  );

  board.querySelectorAll('.send-packet-quick').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const c = findCandidate(e.target.closest('.candidate-card').dataset.id);
      quickSendPacket(c, btn);
    })
  );

  board.querySelectorAll('.remove-local').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('.candidate-card').dataset.id;
      const c = findCandidate(id);
      const a = applicantOf(c);
      if (!confirm(`Remove ${a.firstName} ${a.lastName} from the pipeline?`)) return;
      state.localCandidates = state.localCandidates.filter((x) => String(x.id) !== String(id));
      saveLocalCandidates();
      delete state.overrides[String(id)];
      cacheSet(OVERRIDES_KEY, state.overrides);
      api(`/api/saved/candidates/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
      renderStats();
      renderBoard();
      toast('Candidate removed');
    })
  );

  board.querySelectorAll('.edit-btn').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const form = e.target.closest('.candidate-card').querySelector('.edit-form');
      form.hidden = !form.hidden;
    })
  );

  board.querySelectorAll('.cancel-edit').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.target.closest('.edit-form').hidden = true;
    })
  );

  board.querySelectorAll('.reset-edit').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const card = e.target.closest('.candidate-card');
      saveOverride(card.dataset.id, null);
      renderBoard();
      toast('Restored details from BambooHR');
    })
  );

  board.querySelectorAll('.edit-form').forEach((form) =>
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const card = e.target.closest('.candidate-card');
      const f = e.target;
      const details = {
        firstName: f.firstName.value.trim(),
        lastName: f.lastName.value.trim(),
        email: f.email.value.trim(),
        phoneNumber: f.phoneNumber.value.trim(),
      };
      const c = findCandidate(card.dataset.id);
      if (c?.local) {
        // Uploaded candidates are stored as records, so update in place.
        c.applicant = { ...c.applicant, ...details };
        saveLocalCandidates();
        api('/api/saved/candidates', { method: 'POST', body: { candidate: c } }).catch((err) =>
          toast(`Saved on this device only — ${err.message}`, true)
        );
      } else {
        saveOverride(card.dataset.id, details);
      }
      renderBoard();
      toast('Details saved — packets will use the updated info');
    })
  );
}

// ── Add a hire by hand ───────────────────────────────────────────────────────
// The same record shape the resume upload produces, so an added hire behaves
// exactly like an uploaded one: it persists, it can be edited, and its packet
// can be sent straight from the card.

const addHirePanel = $('#add-hire-panel');
const addHireForm = $('#add-hire-form');

function toggleAddHire(show) {
  addHirePanel.hidden = show === undefined ? !addHirePanel.hidden : !show;
  if (!addHirePanel.hidden) {
    $('#upload-panel').hidden = true;
    addHirePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    addHireForm.firstName.focus();
  }
}

$('#add-hire-btn').addEventListener('click', () => toggleAddHire());
$('#add-hire-cancel').addEventListener('click', () => {
  addHireForm.reset();
  toggleAddHire(false);
});

addHireForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const email = f.email.value.trim();

  // One record per person: adding someone already on the board would leave two
  // cards fighting over the same packet.
  const existing = allCandidates().find((c) => emailKey(applicantOf(c).email) === emailKey(email));
  if (existing) {
    const a = applicantOf(existing);
    return toast(`${a.firstName || ''} ${a.lastName || ''}`.trim() + ` is already in the pipeline with that email`, true);
  }

  const candidate = {
    id: `hire-${Date.now()}`,
    local: true,
    appliedDate: new Date().toISOString().slice(0, 10),
    startDate: f.startDate.value || '',
    applicant: {
      firstName: f.firstName.value.trim(),
      lastName: f.lastName.value.trim(),
      email,
      phoneNumber: f.phone.value.trim(),
    },
    job: { title: { label: f.jobTitle.value.trim() || 'Account Executive' } },
    status: { id: 'local', label: 'Added' },
  };

  state.localCandidates.unshift(candidate);
  saveLocalCandidates();
  api('/api/saved/candidates', { method: 'POST', body: { candidate } }).catch((err) =>
    toast(`Saved on this device only — ${err.message}`, true)
  );

  f.reset();
  f.jobTitle.value = 'Account Executive';
  toggleAddHire(false);
  renderStats();
  renderBoard();
  toast(`${candidate.applicant.firstName} ${candidate.applicant.lastName} added — ready to send their packet`);
  document.querySelector(`.candidate-card[data-id="${candidate.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ── Resume upload ────────────────────────────────────────────────────────────

const uploadPanel = $('#upload-panel');
const dropzone = $('#dropzone');
const resumeFile = $('#resume-file');
const uploadReview = $('#upload-review');
const uploadStatus = $('#upload-status');
let pendingResumeName = '';

$('#upload-resume-btn').addEventListener('click', () => {
  uploadPanel.hidden = !uploadPanel.hidden;
  if (!uploadPanel.hidden) {
    addHirePanel.hidden = true;
    uploadPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

$('#upload-cancel').addEventListener('click', () => {
  uploadReview.hidden = true;
  uploadPanel.hidden = true;
});

dropzone.addEventListener('click', () => resumeFile.click());
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  const file = e.dataTransfer.files?.[0];
  if (file) handleResumeFile(file);
});
resumeFile.addEventListener('change', () => {
  if (resumeFile.files?.[0]) handleResumeFile(resumeFile.files[0]);
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });
}

async function handleResumeFile(file) {
  if (file.size > 4 * 1024 * 1024) return toast("Resume is too large (4 MB max)", true);
  pendingResumeName = file.name;
  uploadStatus.hidden = false;
  uploadStatus.textContent = `Reading ${file.name}…`;
  uploadReview.hidden = true;
  const f = uploadReview;
  try {
    const contentBase64 = await fileToBase64(file);
    const res = await api('/api/resume/parse', {
      method: 'POST',
      body: { filename: file.name, contentBase64 },
    });
    f.firstName.value = res.candidate.firstName || '';
    f.lastName.value = res.candidate.lastName || '';
    f.email.value = res.candidate.email || '';
    f.phone.value = res.candidate.phone || '';
    $('#upload-note').textContent = res.note || '';
  } catch (err) {
    // Never dead-end the upload: open the form empty so the details can be
    // typed in even when parsing is unavailable.
    f.firstName.value = '';
    f.lastName.value = '';
    f.email.value = '';
    f.phone.value = '';
    $('#upload-note').textContent = `Couldn't read the resume automatically (${err.message}) — enter the details below and the candidate will still be added.`;
    toast(err.message, true);
  } finally {
    uploadStatus.hidden = true;
    uploadReview.hidden = false;
    resumeFile.value = '';
  }
}

uploadReview.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const candidate = {
    id: `local-${Date.now()}`,
    local: true,
    resumeName: pendingResumeName,
    appliedDate: new Date().toISOString().slice(0, 10),
    applicant: {
      firstName: f.firstName.value.trim(),
      lastName: f.lastName.value.trim(),
      email: f.email.value.trim(),
      phoneNumber: f.phone.value.trim(),
    },
    job: { title: { label: f.jobTitle.value.trim() || 'Uploaded resume' } },
    status: { id: 'local', label: 'Uploaded' },
  };
  state.localCandidates.unshift(candidate);
  saveLocalCandidates();
  api('/api/saved/candidates', { method: 'POST', body: { candidate } }).catch((err) =>
    toast(`Saved on this device only — ${err.message}`, true)
  );
  f.reset();
  uploadReview.hidden = true;
  uploadPanel.hidden = true;
  renderStats();
  renderBoard();
  toast(`${candidate.applicant.firstName} ${candidate.applicant.lastName} added — ready to send their packet`);
  document.querySelector('.candidate-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ── Hire ─────────────────────────────────────────────────────────────────────

function prefillHireForm(c) {
  const f = $('#hire-form');
  const a = applicantOf(c);
  f.firstName.value = a.firstName || '';
  f.lastName.value = a.lastName || '';
  f.workEmail.value = a.email || '';
  f.mobilePhone.value = a.phoneNumber || '';
  f.jobTitle.value = c.job?.title?.label || c.job?.title || '';
  if (c.startDate) f.hireDate.value = c.startDate;
  f.department.value = '';
  f.applicationId.value = c.local ? '' : c.id;
  const banner = $('#hire-context');
  banner.innerHTML = `${avatar(`${a.firstName || ''} ${a.lastName || ''}`.trim(), 'avatar')}<span>Hiring <strong>${esc(a.firstName)} ${esc(a.lastName)}</strong> from the pipeline — their application will be marked Hired.</span>`;
  banner.hidden = false;
}

$('#hire-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = f.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const res = await api('/api/hire', {
      method: 'POST',
      body: {
        employee: {
          firstName: f.firstName.value.trim(),
          lastName: f.lastName.value.trim(),
          workEmail: f.workEmail.value.trim(),
          mobilePhone: f.mobilePhone.value.trim(),
          jobTitle: f.jobTitle.value.trim(),
          department: f.department.value.trim(),
          hireDate: f.hireDate.value,
          location: f.location.value.trim(),
        },
        applicationId: f.applicationId.value || undefined,
        hiredStatusId: state.hiredStatusId || undefined,
      },
    });
    toast(`Employee #${res.employeeId} created${res.statusUpdated ? ' — application marked Hired' : ''}`);
    state.hiredThisSession.add(String(res.employeeId));

    // Hand off to onboarding, prefilled.
    const p = $('#packet-form');
    p.firstName.value = f.firstName.value;
    p.lastName.value = f.lastName.value;
    p.email.value = f.workEmail.value;
    p.phone.value = f.mobilePhone.value;
    p.jobTitle.value = 'Account Executive';
    p.department.value = f.department.value;
    p.startDate.value = f.hireDate.value;
    p.employeeId.value = res.employeeId || '';
    p.workLocation.value = f.location.value;
    $('#hire-context').hidden = true;
    f.reset();
    showTab('onboarding');
    loadStages();
    loadDirectory();
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ── Onboarding packet ────────────────────────────────────────────────────────

async function loadDocuments() {
  const res = await api('/api/packet/documents');
  state.documents = res.documents;
  $('#doc-list').innerHTML = state.documents
    .map(
      (d) => `
      <label class="doc-item">
        <input type="checkbox" value="${d.key}" ${d.default ? 'checked' : ''} />
        <span class="doc-check"></span>
        <span class="doc-title">${esc(d.title)}</span>
        <a href="#" class="doc-preview" data-key="${d.key}">Preview</a>
      </label>`
    )
    .join('');

  document.querySelectorAll('.doc-preview').forEach((a) =>
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await rawFetch('/api/packet/preview', {
          method: 'POST',
          body: JSON.stringify({ docKey: e.target.dataset.key, hire: readHireForm() }),
        });
        if (!res.ok) throw new Error('Preview failed');
        const blob = await res.blob();
        window.open(URL.createObjectURL(blob), '_blank');
      } catch (err) {
        toast(err.message, true);
      }
    })
  );
}

function readHireForm() {
  const f = $('#packet-form');
  return {
    firstName: f.firstName.value.trim(),
    lastName: f.lastName.value.trim(),
    email: f.email.value.trim(),
    phone: f.phone.value.trim(),
    jobTitle: f.jobTitle.value.trim(),
    department: f.department.value.trim(),
    startDate: f.startDate.value,
    manager: f.manager.value.trim(),
    salary: f.salary.value.trim(),
    employmentType: f.employmentType.value,
    workLocation: f.workLocation.value.trim(),
    employeeId: f.employeeId.value.trim() || undefined,
  };
}

const STEP_STYLE = {
  done: { cls: 'tl-done', icon: ICONS.check },
  simulated: { cls: 'tl-sim', icon: ICONS.flask },
  skipped: { cls: 'tl-skip', icon: ICONS.skip },
  error: { cls: 'tl-err', icon: ICONS.x },
};

function renderPacketResult(res) {
  const card = $('#packet-result');
  card.hidden = false;
  card.innerHTML =
    `<h2 class="result-title">${res.ok ? 'Packet sent' : 'Sent with issues'}</h2>` +
    `<div class="timeline">` +
    res.steps
      .map((s) => {
        const st = STEP_STYLE[s.status] || { cls: 'tl-skip', icon: ICONS.info };
        return `
        <div class="tl-step">
          <span class="tl-dot ${st.cls}">${st.icon}</span>
          <div class="tl-body">
            <div class="tl-name">${esc(s.step)}</div>
            <div class="tl-detail">${esc(s.detail)}</div>
          </div>
        </div>`;
      })
      .join('') +
    `</div>`;
}

$('#packet-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const btn = $('#send-packet-btn');
  const selectedDocs = [...f.querySelectorAll('.doc-item input:checked')].map((i) => i.value);
  if (!selectedDocs.length) return toast('Select at least one document for the packet', true);

  btn.disabled = true;
  $('#send-packet-label').textContent = 'Sending…';
  try {
    const res = await api('/api/onboarding/send', {
      method: 'POST',
      body: {
        hire: readHireForm(),
        documents: selectedDocs,
        options: {
          sendEmail: f.sendEmail.checked,
          ccHr: f.ccHr.checked,
          uploadToBamboo: f.uploadToBamboo.checked,
        },
      },
    });
    renderPacketResult(res);
    if (f.sendEmail.checked) noteSend(f.email.value);
    $('#packet-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(res.ok ? 'Onboarding packet on its way' : 'Sent, but check the results panel', !res.ok);
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
    $('#send-packet-label').textContent = 'Send onboarding packet';
  }
});

// Tests the deployed SMTP login and reports which account it authenticates as.
$('#test-email-btn').addEventListener('click', async () => {
  const btn = $('#test-email-btn');
  const out = $('#email-test-result');
  btn.disabled = true;
  out.textContent = 'Testing…';
  try {
    const res = await api('/api/email/test', { method: 'POST', body: {} });
    out.textContent = res.ok
      ? `✓ Login OK — sending as ${res.user} via ${res.host}`
      : `✗ ${res.host} rejected login as ${res.user}: ${res.error}`;
    toast(res.ok ? 'Email login works' : 'Email login failed — details shown below the button', !res.ok);
  } catch (err) {
    out.textContent = `✗ ${err.message}`;
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ── Directory ────────────────────────────────────────────────────────────────

function dirValue(v) {
  return v?.label || (typeof v === 'string' ? v : '') || '—';
}

async function loadDirectory() {
  const el = $('#directory-list');
  try {
    const res = await api('/api/employees');
    if (!res.employees.length) {
      el.innerHTML = '<div class="empty-state">No employees yet.</div>';
      return;
    }
    const rows = res.employees.map((emp) => {
      const name = emp.displayName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      const isNew = state.hiredThisSession.has(String(emp.id));
      return { emp, name, isNew };
    });

    el.innerHTML = `
      <table class="dir-table">
        <thead><tr><th>Name</th><th>Title</th><th>Department</th><th>Email</th><th>Location</th></tr></thead>
        <tbody>
          ${rows
            .map(
              ({ emp, name, isNew }) => `
              <tr>
                <td><span class="dir-person">${avatar(name)}<span class="dir-name">${esc(name)}</span>${isNew ? '<span class="tag-new">New</span>' : ''}</span></td>
                <td>${esc(dirValue(emp.jobTitle))}</td>
                <td>${esc(dirValue(emp.department))}</td>
                <td>${esc(emp.workEmail || '—')}</td>
                <td>${esc(dirValue(emp.location))}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
      <div class="dir-cards">
        ${rows
          .map(
            ({ emp, name, isNew }) => `
            <div class="dir-card">
              ${avatar(name)}
              <div class="dir-card-body">
                <div class="dir-card-name">${esc(name)}${isNew ? '<span class="tag-new">New</span>' : ''}</div>
                <div class="dir-card-sub">${esc([dirValue(emp.jobTitle), dirValue(emp.department)].filter((x) => x !== '—').join(' · ') || dirValue(emp.workEmail))}</div>
              </div>
            </div>`
          )
          .join('')}
      </div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state">Could not load directory: ${esc(err.message)}</div>`;
  }
}

$('#refresh-directory').addEventListener('click', loadDirectory);

// ── Sync ─────────────────────────────────────────────────────────────────────
// Pulls candidates and the employee directory from BambooHR, only when asked.

$('#sync-btn').addEventListener('click', async () => {
  const btn = $('#sync-btn');
  const label = btn.querySelector('.sync-label');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.classList.remove('is-done');
  btn.classList.add('is-syncing');
  label.textContent = 'Syncing';
  try {
    await loadSaved();
    await loadStages();
    const pulled = await loadCandidates();
    await loadDirectory();
    btn.classList.remove('is-syncing');
    btn.classList.add('is-done');
    label.textContent = 'Synced';
    toast(pulled === 1 ? '1 candidate synced from BambooHR' : `${pulled} candidates synced from BambooHR`);
    setTimeout(() => {
      btn.classList.remove('is-done');
      label.textContent = 'Sync';
    }, 2200);
  } catch (err) {
    btn.classList.remove('is-syncing');
    label.textContent = 'Sync';
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// A badge beats a failed request the user cannot explain.
function renderConnection() {
  $('#offline-badge').hidden = navigator.onLine;
}
window.addEventListener('online', renderConnection);
window.addEventListener('offline', renderConnection);
renderConnection();

// ── Installed app ────────────────────────────────────────────────────────────

const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isStandalone) document.documentElement.classList.add('standalone');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => {
        // Pick up a new deploy while the app sits in the background, so it is
        // already there the next time it is opened — no surprise reloads.
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) reg.update().catch(() => {});
        });
      },
      () => {}
    );
  });
}

// Reopening the app should show current numbers. Only the app's own saved
// records are re-read — BambooHR is still only ever pulled by pressing Sync.
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) return;
  await loadSaved();
  renderStats();
  renderBoard();
});

// iOS Safari has no install prompt API, so the steps are spelled out instead.
const INSTALL_DISMISSED_KEY = 'hhqInstallHintDismissed';

$('#install-dismiss').addEventListener('click', () => {
  $('#install-hint').hidden = true;
  cacheSet(INSTALL_DISMISSED_KEY, true);
});

function maybeOfferInstall() {
  if (isStandalone || cacheGet(INSTALL_DISMISSED_KEY, false)) return;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Android/.test(ua);
  if (!iOS || !safari) return;
  setTimeout(() => { $('#install-hint').hidden = false; }, 1400);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

// Show cached records immediately, then reconcile with the server.
state.localCandidates = loadLocalCandidates();
state.overrides = cacheGet(OVERRIDES_KEY, {}) || {};

(async () => {
  await loadSaved();
  loadStatus().catch((e) => toast(e.message, true));
  // Stage metadata only — candidates and the directory are pulled from
  // BambooHR when Sync is pressed, never on their own.
  loadStages().then(renderBoard).catch(() => {});
  loadDocuments().catch((e) => toast(e.message, true));
  renderStats();
  renderBoard();
  maybeOfferInstall();
})();
