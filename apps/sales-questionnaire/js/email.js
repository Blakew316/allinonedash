/* =========================================================
   Email module.
   - Results are sent to the HIRING MANAGER (never shown to
     the candidate). The manager's address resolves from:
     the invite link (?mgr=...), the address saved on the
     dashboard, then js/config.js — in that order.
   - Invites carry the assessment link with the manager's
     address embedded so remote completions route back.
   Primary path: EmailJS (js/config.js). Fallback: mailto.
   ========================================================= */

const WPQEmail = (() => {
  const cfg = (window.WPQ_CONFIG && window.WPQ_CONFIG.emailjs) || {};
  const configEmail = (window.WPQ_CONFIG && window.WPQ_CONFIG.hiringManagerEmail) || "";
  const companyName = (window.WPQ_CONFIG && window.WPQ_CONFIG.companyName) || "Wholesale Payments";

  const SETTINGS_KEY = "wpq-settings-v1";

  /* ---------------- manager email resolution ---------------- */

  function savedManagerEmail() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return s.managerEmail || "";
    } catch (_) {
      return "";
    }
  }

  function saveManagerEmail(email) {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      s.managerEmail = email;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (_) {}
  }

  function urlManagerEmail() {
    try {
      const raw = new URLSearchParams(window.location.search).get("mgr");
      if (!raw) return "";
      const decoded = atob(raw);
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(decoded) ? decoded : "";
    } catch (_) {
      return "";
    }
  }

  /** Where completed results should be emailed. "" = nowhere configured. */
  function managerEmail() {
    return urlManagerEmail() || savedManagerEmail() || configEmail;
  }

  /* base64 helpers that survive accented names */
  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64decode(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  /**
   * The link candidates receive — opens straight into the assessment.
   * When a candidate is passed, their identity rides along in the `c`
   * parameter so they're never asked to type their own details.
   */
  function assessmentLink(candidate) {
    // the assessment lives on its own page, beside whichever page is open
    const dir = window.location.pathname.replace(/[^/]*$/, "");
    const params = [];
    const mgr = savedManagerEmail() || configEmail;
    if (mgr) params.push("mgr=" + encodeURIComponent(btoa(mgr)));
    if (candidate && candidate.email) {
      const payload = { n: candidate.name || "", e: candidate.email, p: candidate.phone || "" };
      params.push("c=" + encodeURIComponent(b64encode(JSON.stringify(payload))));
    }
    return (
      window.location.origin + dir + "assessment.html" +
      (params.length ? "?" + params.join("&") : "")
    );
  }

  /** Candidate identity embedded in the current URL, or null. */
  function urlCandidate() {
    try {
      const raw = new URLSearchParams(window.location.search).get("c");
      if (!raw) return null;
      const data = JSON.parse(b64decode(raw));
      if (!data.e || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.e)) return null;
      return { name: data.n || "", email: data.e, phone: data.p || "" };
    } catch (_) {
      return null;
    }
  }

  function emailjsReady(templateId) {
    return Boolean(cfg.publicKey && cfg.serviceId && templateId && window.emailjs);
  }

  /* ---------------- results (to the manager) ---------------- */

  function breakdownText(result) {
    return result.categories
      .map((c) => `  • ${c.name}: ${c.score}/${c.max}  (${c.pct}%)`)
      .join("\n");
  }

  function candidateLabel(result) {
    return result.name || result.email || "Unidentified candidate";
  }

  /** 254 → "4m 14s"; 3671 → "1h 01m". */
  function formatDuration(sec) {
    if (!sec && sec !== 0) return "";
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;
    return `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}m`;
  }

  function buildSummary(result) {
    return [
      `${companyName} — Sales Talent Questionnaire`,
      `Completed: ${result.date}`,
      ``,
      `Candidate: ${candidateLabel(result)}`,
      result.role ? `Position: ${result.role}` : null,
      result.email ? `Email: ${result.email}` : null,
      result.phone ? `Phone: ${result.phone}` : null,
      result.durationSec ? `Time to complete: ${formatDuration(result.durationSec)}` : null,
      ``,
      `OVERALL SCORE: ${result.score}/100 — ${result.tier.label}`,
      ``,
      `${result.tier.blurb}`,
      ``,
      `Competency breakdown:`,
      breakdownText(result),
    ]
      .filter((l) => l !== null)
      .join("\n");
  }

  /**
   * Emails the scored results to the hiring manager.
   * Resolves to "sent" (EmailJS), "mailto" (mail client opened),
   * or "unconfigured" (no manager email known anywhere).
   */
  async function sendResults(result) {
    const to = managerEmail();
    if (!to) return "unconfigured";

    if (emailjsReady(cfg.templateId)) {
      window.emailjs.init({ publicKey: cfg.publicKey });
      await window.emailjs.send(cfg.serviceId, cfg.templateId, {
        to_email: to,
        candidate_name: candidateLabel(result),
        candidate_email: result.email,
        candidate_phone: result.phone || "",
        candidate_role: result.role || "Not specified",
        score: String(result.score),
        tier: result.tier.label,
        tier_blurb: result.tier.blurb,
        breakdown_text: breakdownText(result),
        completed_date: result.date,
        duration: result.durationSec ? formatDuration(result.durationSec) : "Not recorded",
        company_name: companyName,
      });
      return "sent";
    }

    const subject = `Assessment result — ${candidateLabel(result)}: ${result.score}/100 (${result.tier.label})`;
    window.location.href =
      `mailto:${encodeURIComponent(to)}?` +
      `subject=${encodeURIComponent(subject)}&` +
      `body=${encodeURIComponent(buildSummary(result))}`;
    return "mailto";
  }

  /* ---------------- questionnaire invites ---------------- */

  function buildInviteBody(candidate) {
    const greeting = candidate ? `Hi ${candidate.name.split(" ")[0]},` : "Hi,";
    return [
      greeting,
      ``,
      `Thanks for your interest in joining the ${companyName} sales team!`,
      ``,
      `As the next step in our hiring process, please complete our short`,
      `Sales Talent Questionnaire — 10 quick questions, about 5 minutes:`,
      ``,
      `${assessmentLink(candidate)}`,
      ``,
      `Answer honestly and go with your instincts. Your responses are sent`,
      `directly to our hiring team, and we'll reach out about next steps.`,
      ``,
      `Best regards,`,
      `${companyName} Hiring Team`,
    ].join("\n");
  }

  const INVITE_SUBJECT = () => `${companyName} — Sales Talent Questionnaire (next step)`;

  async function emailjsInvite(candidate) {
    window.emailjs.init({ publicKey: cfg.publicKey });
    await window.emailjs.send(cfg.serviceId, cfg.inviteTemplateId, {
      to_email: candidate.email,
      candidate_name: candidate.name,
      candidate_phone: candidate.phone || "",
      form_link: assessmentLink(candidate),
      manager_email: managerEmail(),
      company_name: companyName,
    });
  }

  /**
   * Emails the questionnaire link to one candidate.
   * Resolves to "sent" or "mailto".
   */
  async function sendInvite(candidate) {
    if (emailjsReady(cfg.inviteTemplateId)) {
      await emailjsInvite(candidate);
      return "sent";
    }
    window.location.href =
      `mailto:${encodeURIComponent(candidate.email)}?` +
      `subject=${encodeURIComponent(INVITE_SUBJECT())}&` +
      `body=${encodeURIComponent(buildInviteBody(candidate))}`;
    return "mailto";
  }

  /**
   * Emails the questionnaire to several candidates at once.
   * EmailJS: personalized email per candidate; resolves
   * {mode:"sent", sent, failed}. Fallback: one mail-app compose
   * BCC'd to everyone; resolves {mode:"mailto", sent, failed:0}.
   */
  async function sendInviteBatch(candidates) {
    if (!candidates.length) return { mode: "none", sent: 0, failed: 0 };

    if (emailjsReady(cfg.inviteTemplateId)) {
      let sent = 0, failed = 0;
      for (const cand of candidates) {
        try {
          await emailjsInvite(cand);
          sent++;
        } catch (err) {
          console.error("Invite failed for", cand.email, err);
          failed++;
        }
      }
      return { mode: "sent", sent, failed };
    }

    if (candidates.length === 1) {
      // single recipient — personalize so their link carries their identity
      await sendInvite(candidates[0]);
      return { mode: "mailto", sent: 1, failed: 0 };
    }
    const bcc = candidates.map((c) => c.email).join(",");
    window.location.href =
      `mailto:?bcc=${encodeURIComponent(bcc)}&` +
      `subject=${encodeURIComponent(INVITE_SUBJECT())}&` +
      `body=${encodeURIComponent(buildInviteBody(null))}`;
    return { mode: "mailto", sent: candidates.length, failed: 0 };
  }

  return {
    sendResults,
    sendInvite,
    sendInviteBatch,
    buildSummary,
    managerEmail,
    savedManagerEmail,
    saveManagerEmail,
    assessmentLink,
    urlCandidate,
    formatDuration,
  };
})();
