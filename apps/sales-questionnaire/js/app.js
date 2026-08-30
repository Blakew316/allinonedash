/* =========================================================
   Wholesale Payments · Sales Talent Questionnaire
   Assessment engine — runs on assessment.html only, fully
   separate from the hiring dashboard (index.html).
   - Identity comes from the personalized invite link
     (c / mgr parameters); with none the run is anonymous.
   - On completion the candidate sees a thank-you screen only;
     the scored breakdown is emailed to the hiring manager,
     and the dashboard roster on this device (if any) is
     updated through shared localStorage.
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "wpq-progress-v1";
  const ROSTER_KEY = "wpq-candidates-v1";
  const REPORTS_KEY = "wpq-reports-v1";

  const state = {
    screen: null,
    current: 0,
    answers: new Array(QUESTIONS.length).fill(null),
    candidate: { name: "", email: "", phone: "", role: "" },
    startedAt: null,
    result: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const screens = {
    welcome: $("#screen-welcome"),
    quiz: $("#screen-quiz"),
    complete: $("#screen-complete"),
  };

  /* ---------------- screen navigation ---------------- */

  function showScreen(name, direction = "forward") {
    const to = screens[name];
    if (!to || state.screen === name) return;
    Object.values(screens).forEach((s) =>
      s.classList.remove("is-active", "enter-forward", "enter-back")
    );
    to.classList.add("is-active", direction === "forward" ? "enter-forward" : "enter-back");
    state.screen = name;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- progress UI ---------------- */

  const progressFill = $("#progress-fill");
  const progressWrap = $("#progress-bar-wrap");
  const progressLabel = $("#progress-label");
  const dotsWrap = $("#progress-dots");

  function buildDots() {
    dotsWrap.innerHTML = "";
    QUESTIONS.forEach(() => dotsWrap.appendChild(document.createElement("span")));
  }

  function updateProgress() {
    const idx = state.current;
    const pct = Math.round(((idx + 1) / QUESTIONS.length) * 100);
    progressFill.style.width = pct + "%";
    progressWrap.setAttribute("aria-valuenow", String(pct));
    progressLabel.textContent = `Question ${idx + 1} of ${QUESTIONS.length}`;
    [...dotsWrap.children].forEach((dot, i) => {
      dot.className = "";
      if (state.answers[i] !== null) dot.classList.add("done");
      if (i === idx) dot.classList.add("current");
    });
  }

  /* ---------------- question rendering ---------------- */

  const questionCard = $("#question-card");
  const questionText = $("#question-text");
  const optionsWrap = $("#options");
  const btnPrev = $("#btn-prev");
  const btnNext = $("#btn-next");
  const LETTERS = ["A", "B", "C", "D"];
  let animating = false;

  function renderQuestion() {
    const q = QUESTIONS[state.current];
    questionText.textContent = q.text;
    optionsWrap.innerHTML = "";

    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option" + (state.answers[state.current] === i ? " selected" : "");
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(state.answers[state.current] === i));
      btn.innerHTML = `<span class="option-letter">${LETTERS[i]}</span><span>${opt.text}</span>`;
      btn.addEventListener("click", () => selectOption(i));
      optionsWrap.appendChild(btn);
    });

    btnPrev.disabled = false;
    btnNext.disabled = state.answers[state.current] === null;
    btnNext.innerHTML =
      state.current === QUESTIONS.length - 1
        ? `Complete <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : `Next <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
    updateProgress();
  }

  function selectOption(i) {
    state.answers[state.current] = i;
    [...optionsWrap.children].forEach((el, j) => {
      el.classList.toggle("selected", j === i);
      el.setAttribute("aria-checked", String(j === i));
    });
    btnNext.disabled = false;
    updateProgress();
    saveProgress();
    // brief pause so the selection state is visible, then auto-advance
    setTimeout(() => {
      if (state.screen === "quiz" && state.answers[state.current] === i) advance(1);
    }, 350);
  }

  function advance(dir) {
    if (animating || state.screen !== "quiz") return;
    if (dir > 0 && state.answers[state.current] === null) return;

    const nextIdx = state.current + dir;
    if (nextIdx < 0) {
      showScreen("welcome", "back");
      return;
    }
    if (nextIdx >= QUESTIONS.length) {
      finishQuiz();
      return;
    }

    animating = true;
    questionCard.classList.add(dir > 0 ? "leaving-fwd" : "leaving-back");
    setTimeout(() => {
      state.current = nextIdx;
      renderQuestion();
      saveProgress();
      questionCard.classList.remove("leaving-fwd", "leaving-back");
      questionCard.classList.add(dir > 0 ? "entering-fwd" : "entering-back");
      setTimeout(() => {
        questionCard.classList.remove("entering-fwd", "entering-back");
        animating = false;
      }, 420);
    }, 260);
  }

  /* ---------------- scoring ---------------- */

  function computeResult() {
    const perCat = {};
    Object.keys(CATEGORIES).forEach((k) => (perCat[k] = { score: 0, max: 0 }));

    QUESTIONS.forEach((q, i) => {
      const ans = state.answers[i];
      const pts = ans === null ? 0 : q.options[ans].points;
      perCat[q.category].score += pts;
      perCat[q.category].max += MAX_POINTS_PER_QUESTION;
    });

    const total = Object.values(perCat).reduce((s, c) => s + c.score, 0);
    const max = Object.values(perCat).reduce((s, c) => s + c.max, 0);
    const score = Math.round((total / max) * 100);
    const durationSec = state.startedAt
      ? Math.max(1, Math.round((Date.now() - state.startedAt) / 1000))
      : null;

    return {
      durationSec,
      name: state.candidate.name,
      email: state.candidate.email,
      phone: state.candidate.phone,
      role: state.candidate.role,
      score,
      tier: tierForScore(score),
      date: new Date().toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      }),
      categories: Object.entries(perCat).map(([key, v]) => ({
        key,
        name: CATEGORIES[key].name,
        blurb: CATEGORIES[key].blurb,
        score: v.score,
        max: v.max,
        pct: Math.round((v.score / v.max) * 100),
      })),
    };
  }

  /** Syncs completion into the dashboard roster stored on this device. */
  function syncRoster(email, score, durationSec) {
    if (!email) return;
    try {
      const roster = JSON.parse(localStorage.getItem(ROSTER_KEY) || "[]");
      const cand = roster.find(
        (c) => c.email && c.email.toLowerCase() === email.toLowerCase()
      );
      if (cand) {
        cand.status = "completed";
        cand.score = score;
        cand.durationSec = durationSec;
        localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
      }
    } catch (_) {}
  }

  /** Files a completion report for the dashboard on this device. */
  function recordReport(result) {
    try {
      const reports = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
      reports.unshift({
        id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: result.name,
        email: result.email,
        score: result.score,
        tier: result.tier.label,
        tierKey: result.tier.key,
        durationSec: result.durationSec,
        completedAt: new Date().toISOString(),
      });
      localStorage.setItem(REPORTS_KEY, JSON.stringify(reports.slice(0, 100)));
    } catch (_) {}
  }

  /* ---------------- completion (score hidden) ---------------- */

  const completeStatus = $("#complete-status");

  function finishQuiz() {
    state.result = computeResult();
    clearProgress();
    syncRoster(state.result.email, state.result.score, state.result.durationSec);
    recordReport(state.result);

    $("#complete-heading").textContent = state.result.name
      ? `Thank you, ${state.result.name.split(" ")[0]}!`
      : "Thank you!";
    completeStatus.className = "complete-status";
    completeStatus.textContent = "";
    showScreen("complete", "forward");
    deliverResults();
  }

  async function deliverResults() {
    try {
      const mode = await WPQEmail.sendResults(state.result);
      if (mode === "sent") {
        completeStatus.classList.add("ok");
        completeStatus.innerHTML =
          'Your responses have been delivered to the hiring team <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-0.15em" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
      } else if (mode === "mailto") {
        completeStatus.textContent =
          "One last step — your mail app has opened with your submission. Just press send.";
      } else {
        // no manager email configured anywhere; the completion was still
        // recorded in this device's dashboard roster
        completeStatus.textContent = "";
      }
    } catch (err) {
      console.error("Result delivery failed:", err);
      completeStatus.classList.add("error");
      completeStatus.textContent =
        "We couldn't submit your responses automatically — please let the hiring team know you've finished.";
    }
  }

  function resetQuiz() {
    state.current = 0;
    state.answers = new Array(QUESTIONS.length).fill(null);
    state.startedAt = null;
    state.result = null;
    clearProgress();
    setKnownCandidate(WPQEmail.urlCandidate() || {});
    renderQuestion();
  }

  $("#btn-done").addEventListener("click", () => {
    resetQuiz();
    showScreen("welcome", "back");
  });

  /* ---------------- persistence (resume mid-quiz) ---------------- */

  function saveProgress() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          current: state.current,
          answers: state.answers,
          candidate: state.candidate,
          startedAt: state.startedAt,
        })
      );
    } catch (_) {}
  }

  function loadProgress() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved.candidate) return false;
      if (!Array.isArray(saved.answers) || saved.answers.length !== QUESTIONS.length) return false;
      if (!saved.answers.some((a) => a !== null)) return false;
      state.current = Math.min(saved.current || 0, QUESTIONS.length - 1);
      state.answers = saved.answers;
      state.candidate = saved.candidate;
      state.startedAt = saved.startedAt || Date.now();
      return true;
    } catch (_) {
      return false;
    }
  }

  function clearProgress() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  /* ---------------- candidate identity (no typing needed) ---------------- */

  const preparedFor = $("#prepared-for");

  function setKnownCandidate(c) {
    state.candidate = {
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      role: c.role || "",
    };
    const known = Boolean(state.candidate.email);
    preparedFor.hidden = !known;
    if (known) {
      $("#prepared-name").textContent = state.candidate.name || state.candidate.email;
      $("#prepared-avatar").textContent =
        (state.candidate.name || state.candidate.email)
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("");
    }
  }

  /* ---------------- wiring ---------------- */

  $("#btn-start").addEventListener("click", () => {
    if (!state.startedAt) state.startedAt = Date.now();
    saveProgress();
    renderQuestion();
    showScreen("quiz", "forward");
  });

  btnPrev.addEventListener("click", () => advance(-1));
  btnNext.addEventListener("click", () => advance(1));

  document.addEventListener("keydown", (e) => {
    if (state.screen !== "quiz") return;
    if (e.key >= "1" && e.key <= "4") {
      const i = Number(e.key) - 1;
      if (optionsWrap.children[i]) selectOption(i);
    } else if (e.key === "ArrowRight" || e.key === "Enter") {
      advance(1);
    } else if (e.key === "ArrowLeft") {
      advance(-1);
    }
  });

  /* ---------------- init ---------------- */

  buildDots();
  setKnownCandidate(WPQEmail.urlCandidate() || {});
  renderQuestion();
  if (loadProgress()) {
    // resume an in-progress assessment for this browser session
    renderQuestion();
    showScreen("quiz", "forward");
  } else {
    showScreen("welcome", "forward");
  }
})();
