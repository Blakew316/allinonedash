/* ============================================================
   Wholesale Payments — interactions & animations
   ============================================================ */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Nav hairline on scroll ---- */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('nav--scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- Mobile menu ---- */
  const toggle = document.getElementById('navToggle');
  const mobile = document.getElementById('navMobile');
  if (toggle && mobile) {
    toggle.addEventListener('click', () => {
      const open = mobile.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    mobile.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        mobile.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      })
    );
  }

  /* ---- Scroll reveal ---- */
  const reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('in'));
  } else {
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ---- Animated count-up ---- */
  function finalText(el) {
    const t = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const grouped = t >= 1000 && !el.dataset.plain;
    return prefix + (grouped ? t.toLocaleString('en-US') : String(t)) + suffix;
  }

  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const grouped = target >= 1000 && !el.dataset.plain;
    const duration = 1500;
    const start = performance.now();

    function fmt(n) {
      const rounded = Math.round(n);
      return prefix + (grouped ? rounded.toLocaleString('en-US') : String(rounded)) + suffix;
    }
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = finalText(el);
    }
    requestAnimationFrame(tick);
  }

  const counters = document.querySelectorAll('[data-count]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    counters.forEach((el) => { el.textContent = finalText(el); });
  } else {
    const countIO = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => countIO.observe(el));
  }

  /* ---- Quote / contact form (front-end demo handling) ---- */
  const form = document.getElementById('quoteForm');
  const note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.textContent = 'Request received ✓';
      if (note) note.hidden = false;
      form.reset();
    });
  }

  /* ---- Live chat ---- */
  const chatLauncher = document.getElementById('chatLauncher');
  const chatPanel = document.getElementById('chatPanel');
  if (chatLauncher && chatPanel) {
    const setOpen = (open) => {
      chatPanel.hidden = !open;
      chatLauncher.setAttribute('aria-expanded', String(open));
      chatLauncher.setAttribute('aria-label', open ? 'Close live chat' : 'Open live chat');
      if (open) {
        const first = chatPanel.querySelector('input, textarea, select');
        if (first) first.focus();
      }
    };
    chatLauncher.addEventListener('click', () =>
      setOpen(chatLauncher.getAttribute('aria-expanded') !== 'true')
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && chatLauncher.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        chatLauncher.focus();
      }
    });

    const chatForm = document.getElementById('chatForm');
    const chatNote = document.getElementById('chatNote');
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!chatForm.checkValidity()) {
          chatForm.reportValidity();
          return;
        }
        const btn = chatForm.querySelector('button[type="submit"]');
        if (btn) btn.textContent = 'Message sent ✓';
        if (chatNote) chatNote.hidden = false;
        chatForm.reset();
      });
    }
  }

  /* ---- Footer year ---- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
