/* =========================================================
   Manager dashboard — candidate roster, resume upload,
   manager-email setting, and batch questionnaire sending.
   Candidates are stored locally on this device.
   ========================================================= */

const WPQRoster = (() => {
  "use strict";

  const STORAGE_KEY = "wpq-candidates-v1";
  const REPORTS_KEY = "wpq-reports-v1";

  const $ = (sel) => document.querySelector(sel);
  const listEl = $("#roster-list");
  const emptyEl = $("#roster-empty");
  const countEl = $("#cand-count");
  const tileUpload = $("#tile-upload");
  const tileAdd = $("#tile-add");
  const uploadStatus = $("#upload-status");
  const fileInput = $("#resume-input");
  const sendbar = $("#sendbar");
  const sendAllBtn = $("#btn-send-all");
  const sendAllLabel = $("#btn-send-all-label");
  const sendbarNote = $("#sendbar-note");
  const managerInput = $("#manager-email");
  const managerCheck = $("#manager-email-check");
  const backdrop = $("#sheet-backdrop");
  const sheetForm = $("#sheet-form");
  const sheetTitle = $("#sheet-title");
  const sheetSub = $("#sheet-sub");
  const sheetName = $("#sheet-name");
  const sheetEmail = $("#sheet-email");
  const sheetPhone = $("#sheet-phone");

  let candidates = load();
  let editingId = null;
  let statusTimer = null;
  let noteTimer = null;

  /* ---------------- storage ---------------- */

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
    } catch (_) {}
  }

  /* ---------------- team picker + manager email setting ---------------- */

  const SETTINGS_KEY = "wpq-settings-v1";
  const teamSelect = $("#team-select");
  const TEAMS = (window.WPQ_CONFIG && window.WPQ_CONFIG.teams) || [];

  TEAMS.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = t.name;
    teamSelect.appendChild(opt);
  });

  function readSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveTeam(name) {
    try {
      const settings = readSettings();
      settings.team = name;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  managerInput.value = WPQEmail.savedManagerEmail();

  // restore the saved team — by name, or by matching the saved email
  {
    const savedTeam = readSettings().team;
    const savedEmail = managerInput.value.toLowerCase();
    const match =
      TEAMS.find((t) => t.name === savedTeam) ||
      TEAMS.find((t) => t.email.toLowerCase() === savedEmail);
    if (match) teamSelect.value = match.name;
  }

  teamSelect.addEventListener("change", () => {
    const team = TEAMS.find((t) => t.name === teamSelect.value);
    if (!team) return;
    managerInput.value = team.email;
    saveTeam(team.name);
    commitManagerEmail();
  });

  function commitManagerEmail() {
    const val = managerInput.value.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val);
    if (val && !valid) {
      managerCheck.textContent = "";
      managerCheck.classList.remove("show");
      return;
    }
    WPQEmail.saveManagerEmail(val);
    if (val) {
      managerCheck.textContent = "Saved ✓";
      managerCheck.classList.add("show");
      window.clearTimeout(commitManagerEmail._t);
      commitManagerEmail._t = window.setTimeout(
        () => managerCheck.classList.remove("show"),
        2200
      );
    }
  }
  managerInput.addEventListener("change", commitManagerEmail);
  managerInput.addEventListener("blur", commitManagerEmail);
  managerInput.addEventListener("input", () => {
    const team = TEAMS.find((t) => t.name === teamSelect.value);
    if (team && managerInput.value.trim().toLowerCase() !== team.email.toLowerCase()) {
      teamSelect.value = "";
      saveTeam("");
    }
  });

  /* ---------------- rendering ---------------- */

  const STATUS_LABELS = {
    added: "Not sent",
    invited: "Sent",
    completed: "Completed",
  };

  function initials(name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  function pendingCandidates() {
    return candidates.filter((c) => (c.status || "added") === "added");
  }

  function render() {
    listEl.innerHTML = "";
    emptyEl.hidden = candidates.length > 0;
    countEl.hidden = candidates.length === 0;
    countEl.textContent = String(candidates.length);

    candidates.forEach((c) => {
      const statusKey = c.status || "added";
      const statusText =
        statusKey === "completed" && typeof c.score === "number"
          ? `${STATUS_LABELS.completed} · ${c.score}/100`
          : STATUS_LABELS[statusKey] || STATUS_LABELS.added;
      const meta = [c.email, c.phone].filter(Boolean).join("  ·  ");
      const safeName = escapeHtml(c.name);

      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div class="avatar">${initials(c.name) || "?"}</div>
        <div class="row-info">
          <div class="row-name">
            <span>${safeName}</span>
            <span class="status-chip status-${statusKey}">${statusText}</span>
          </div>
          <div class="row-meta">${escapeHtml(meta)}</div>
        </div>
        <div class="row-actions">
          <button class="icon-btn" data-act="invite" title="Email the questionnaire to ${safeName}" aria-label="Email the questionnaire to ${safeName}">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
          <button class="icon-btn" data-act="start" title="Run the assessment on this device for ${safeName}" aria-label="Run the assessment on this device for ${safeName}">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          </button>
          <button class="icon-btn" data-act="edit" title="Edit details" aria-label="Edit details for ${safeName}">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
          </button>
          <button class="icon-btn danger" data-act="remove" title="Remove candidate" aria-label="Remove ${safeName}">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>`;

      row.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", () => handleAction(btn.dataset.act, c.id));
      });
      listEl.appendChild(row);
    });

    renderSendbar();
  }

  function renderSendbar() {
    const pending = pendingCandidates();
    sendbar.hidden = pending.length === 0;
    if (pending.length > 0) {
      sendAllLabel.textContent =
        pending.length === 1
          ? `Send questionnaire to ${pending[0].name.split(" ")[0]}`
          : `Send questionnaire to ${pending.length} new hires`;
    }
  }

  /* ---------------- completion reports ---------------- */

  const reportList = $("#report-list");
  const reportEmpty = $("#report-empty");
  const reportCount = $("#report-count");

  function loadReports() {
    try {
      const arr = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function renderReports() {
    const reports = loadReports();
    reportList.innerHTML = "";
    reportEmpty.hidden = reports.length > 0;
    reportCount.hidden = reports.length === 0;
    reportCount.textContent = String(reports.length);

    reports.forEach((r) => {
      const name = r.name || r.email || "Unidentified candidate";
      const when = r.completedAt
        ? new Date(r.completedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
        : "";
      const dur = r.durationSec ? WPQEmail.formatDuration(r.durationSec) : "—";

      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div class="avatar">${initials(name) || "?"}</div>
        <div class="row-info">
          <div class="row-name">
            <span>${escapeHtml(name)}</span>
            <span class="status-chip tier-${r.tierKey || "develop"}">${escapeHtml(r.tier || "")}</span>
          </div>
          <div class="row-meta">
            ${escapeHtml(when)}
            &nbsp;&middot;&nbsp;
            <svg class="meta-icon" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${escapeHtml(dur)}
          </div>
        </div>
        <div class="report-score">
          <span class="report-score-num">${Number(r.score) || 0}</span>
          <span class="report-score-max">/100</span>
        </div>
        <div class="row-actions">
          <button class="icon-btn danger" data-del title="Remove report" aria-label="Remove report for ${escapeHtml(name)}">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>`;

      row.querySelector("[data-del]").addEventListener("click", () => {
        if (!window.confirm(`Remove ${name}'s report?`)) return;
        const remaining = loadReports().filter((x) => x.id !== r.id);
        try {
          localStorage.setItem(REPORTS_KEY, JSON.stringify(remaining));
        } catch (_) {}
        renderReports();
      });
      reportList.appendChild(row);
    });
  }

  function setStatus(kind, msg, sticky = false) {
    uploadStatus.className = "panel-status" + (kind ? " " + kind : "");
    uploadStatus.textContent = msg;
    window.clearTimeout(statusTimer);
    if (msg && !sticky) {
      statusTimer = window.setTimeout(() => {
        uploadStatus.textContent = "";
        uploadStatus.className = "panel-status";
      }, 6000);
    }
  }

  function setNote(kind, msg) {
    sendbarNote.className = "sendbar-note" + (kind ? " " + kind : "");
    sendbarNote.textContent = msg;
    window.clearTimeout(noteTimer);
    if (msg) {
      noteTimer = window.setTimeout(() => {
        sendbarNote.textContent = "";
        sendbarNote.className = "sendbar-note";
      }, 7000);
    }
  }

  /* ---------------- row actions ---------------- */

  async function handleAction(act, id) {
    const cand = candidates.find((c) => c.id === id);
    if (!cand) return;

    if (act === "remove") {
      if (!window.confirm(`Remove ${cand.name} from the list?`)) return;
      candidates = candidates.filter((c) => c.id !== id);
      save();
      render();
    } else if (act === "edit") {
      openSheet({ candidate: cand });
    } else if (act === "start") {
      // the assessment is a separate page — open it with this candidate's
      // identity in the link, same as their emailed invite
      window.location.href = WPQEmail.assessmentLink(cand);
    } else if (act === "invite") {
      try {
        const mode = await WPQEmail.sendInvite(cand);
        if (cand.status !== "completed") cand.status = "invited";
        save();
        render();
        setNote("ok", mode === "sent"
          ? `Questionnaire emailed to ${cand.email} ✓`
          : "Your mail app has opened with the invite — just hit send.");
      } catch (err) {
        console.error("Invite failed:", err);
        setNote("error", "Couldn't send the invite — check your email settings and try again.");
      }
    }
  }

  /* ---------------- batch send ---------------- */

  sendAllBtn.addEventListener("click", async () => {
    const pending = pendingCandidates();
    if (!pending.length) return;
    sendAllBtn.disabled = true;
    setNote("", pending.length > 1 ? `Sending ${pending.length} invites…` : "Sending invite…");
    try {
      const res = await WPQEmail.sendInviteBatch(pending);
      pending.forEach((c) => {
        if (res.mode === "sent" || res.mode === "mailto") c.status = "invited";
      });
      save();
      render();
      if (res.mode === "sent") {
        setNote(res.failed ? "error" : "ok",
          res.failed
            ? `Sent ${res.sent} of ${res.sent + res.failed} — retry the failed ones from their rows.`
            : `Questionnaire sent to ${res.sent} candidate${res.sent === 1 ? "" : "s"} ✓`);
      } else {
        setNote("ok", "Your mail app has opened with everyone added — just hit send.");
      }
    } catch (err) {
      console.error("Batch send failed:", err);
      setNote("error", "Couldn't send the invites — check your email settings and try again.");
    } finally {
      sendAllBtn.disabled = false;
    }
  });

  /* ---------------- add/edit sheet ---------------- */

  function openSheet({ candidate = null, prefill = null, fromResume = false } = {}) {
    editingId = candidate ? candidate.id : null;
    const src = candidate || prefill || { name: "", email: "", phone: "" };
    sheetName.value = src.name || "";
    sheetEmail.value = src.email || "";
    sheetPhone.value = src.phone || "";
    sheetTitle.textContent = candidate ? "Edit candidate" : "New hire";
    sheetSub.innerHTML = fromResume
      ? '<span class="from-resume">Read from the résumé ✓</span> — double-check the details, then save.'
      : "Enter the candidate's contact details.";
    sheetForm.querySelectorAll(".field").forEach((f) => f.classList.remove("invalid"));
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => sheetName.focus(), 60);
  }

  function closeSheet() {
    backdrop.hidden = true;
    document.body.style.overflow = "";
    editingId = null;
  }

  sheetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = sheetName.value.trim();
    const email = sheetEmail.value.trim();
    const phone = sheetPhone.value.trim();

    const nameOk = name.length >= 2;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    sheetName.closest(".field").classList.toggle("invalid", !nameOk);
    sheetEmail.closest(".field").classList.toggle("invalid", !emailOk);
    if (!nameOk || !emailOk) return;

    if (editingId) {
      const cand = candidates.find((c) => c.id === editingId);
      if (cand) Object.assign(cand, { name, email, phone });
    } else {
      candidates.unshift({
        id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name,
        email,
        phone,
        status: "added",
        added: new Date().toISOString(),
      });
    }
    save();
    render();
    closeSheet();
  });

  $("#sheet-cancel").addEventListener("click", closeSheet);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeSheet();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.hidden) closeSheet();
  });
  [sheetName, sheetEmail].forEach((el) =>
    el.addEventListener("input", () => el.closest(".field").classList.remove("invalid"))
  );

  tileAdd.addEventListener("click", () => openSheet());

  /* ---------------- resume upload ---------------- */

  async function handleResumeFile(file) {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setStatus("error", "Please upload a PDF file.");
      return;
    }
    tileUpload.classList.add("busy");
    setStatus("reading", `Reading ${file.name}…`, true);
    try {
      const extracted = await WPQResume.parse(file);
      setStatus("", "");
      if (!extracted.name && !extracted.email && !extracted.phone) {
        setStatus("error", "Couldn't find contact details in that PDF — add them manually.");
        openSheet({ fromResume: false });
      } else {
        openSheet({ prefill: extracted, fromResume: true });
      }
    } catch (err) {
      console.error("Resume parse failed:", err);
      setStatus("error", "Couldn't read that PDF — try another file or add the candidate manually.");
    } finally {
      tileUpload.classList.remove("busy");
      fileInput.value = "";
    }
  }

  tileUpload.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleResumeFile(fileInput.files[0]));

  ["dragover", "dragenter"].forEach((ev) =>
    tileUpload.addEventListener(ev, (e) => {
      e.preventDefault();
      tileUpload.classList.add("dragover");
    })
  );
  ["dragleave", "dragend"].forEach((ev) =>
    tileUpload.addEventListener(ev, () => tileUpload.classList.remove("dragover"))
  );
  tileUpload.addEventListener("drop", (e) => {
    e.preventDefault();
    tileUpload.classList.remove("dragover");
    handleResumeFile(e.dataTransfer.files[0]);
  });

  /* ---------------- public API ---------------- */

  /** Called by the quiz when an assessment finishes, to sync status. */
  function markCompleted(email, score) {
    const cand = candidates.find(
      (c) => c.email.toLowerCase() === String(email).toLowerCase()
    );
    if (cand) {
      cand.status = "completed";
      cand.score = score;
      save();
      render();
    }
  }

  render();
  renderReports();
  return { markCompleted };
})();
