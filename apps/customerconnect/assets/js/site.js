/* ==========================================================================
   Customer Connect — by Wholesale Payments
   Interaction layer  ·  v2.0
   Vanilla, dependency-free, respects prefers-reduced-motion.
   ========================================================================== */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------------- boot */
  function boot() {
    document.body.classList.add('ready');
    header();
    megaMenus();
    drawer();
    reveal();
    counters();
    rotator();
    tabs();
    accordions();
    carousels();
    billingToggle();
    cardGlow();
    scrollProgress();
    backToTop();
    tocHighlight();
    resourceSearch();
    share();
    forms();
    parallax();
    pageExit();
    year();
  }

  /* --------------------------------------------------------- sticky header */
  function header() {
    var el = $('.site-header');
    if (!el) return;
    var last = -1;
    function onScroll() {
      var stuck = window.scrollY > 12;
      if (stuck !== last) { el.classList.toggle('is-stuck', stuck); last = stuck; }
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ------------------------------------------------------------ mega menu */
  function megaMenus() {
    var items = $$('.nav-item.has-mega');
    if (!items.length) return;
    var closeTimer;

    function closeAll(except) {
      items.forEach(function (i) { if (i !== except) i.classList.remove('open'); });
      items.forEach(function (i) {
        if (i !== except) {
          var t = $('.nav-link', i);
          if (t) t.setAttribute('aria-expanded', 'false');
        }
      });
    }

    items.forEach(function (item) {
      var trigger = $('.nav-link', item);
      if (!trigger) return;
      trigger.setAttribute('aria-expanded', 'false');

      function open() {
        clearTimeout(closeTimer);
        closeAll(item);
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      function close() {
        item.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }

      item.addEventListener('mouseenter', open);
      item.addEventListener('mouseleave', function () {
        closeTimer = setTimeout(close, 140);
      });
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (item.classList.contains('open')) { close(); } else { open(); }
      });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { close(); trigger.blur(); }
      });
      item.addEventListener('focusout', function (e) {
        if (!item.contains(e.relatedTarget)) close();
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-item.has-mega')) closeAll(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll(null);
    });
  }

  /* --------------------------------------------------------- mobile drawer */
  function drawer() {
    var burger = $('.burger');
    var panel  = $('.drawer');
    if (!burger || !panel) return;

    function setOpen(open) {
      burger.classList.toggle('open', open);
      panel.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-locked', open);
    }

    burger.addEventListener('click', function () {
      setOpen(!panel.classList.contains('open'));
    });
    $$('.drawer a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1080 && panel.classList.contains('open')) setOpen(false);
    });

    $$('.drawer-group').forEach(function (group) {
      var t = $('.drawer-toggle', group);
      if (!t) return;
      t.setAttribute('aria-expanded', 'false');
      t.addEventListener('click', function () {
        var open = group.classList.toggle('open');
        t.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* --------------------------------------------------- scroll reveal (IO) */
  function reveal() {
    var nodes = $$('[data-reveal]');
    if (!nodes.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    nodes.forEach(function (n) {
      // auto-stagger siblings that share a parent grid
      if (!n.style.getPropertyValue('--d')) {
        var group = n.closest('[data-stagger]');
        if (group) {
          var kids = $$('[data-reveal]', group);
          var i = kids.indexOf(n);
          if (i > -1) n.style.setProperty('--d', (i * (parseInt(group.dataset.stagger, 10) || 80)) + 'ms');
        }
      }
      io.observe(n);
    });
  }

  /* ------------------------------------------------------- number counters */
  function counters() {
    var nodes = $$('[data-count]');
    if (!nodes.length) return;

    function fmt(v, node) {
      var dec = parseInt(node.dataset.decimals || '0', 10);
      var s = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
      return (node.dataset.prefix || '') + s + (node.dataset.suffix || '');
    }

    function run(node) {
      var target = parseFloat(node.dataset.count);
      if (reduced) { node.textContent = fmt(target, node); return; }
      var dur = parseInt(node.dataset.duration || '1700', 10);
      var t0 = null;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 4);       // easeOutQuart
        node.textContent = fmt(target * eased, node);
        if (p < 1) requestAnimationFrame(frame);
        else node.textContent = fmt(target, node);
      }
      requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* -------------------------------------------------- rotating hero words */
  function rotator() {
    $$('.rotator').forEach(function (r) {
      var words = $$('span', r);
      if (words.length < 2) return;
      // size the box to the widest word so layout never jumps
      var i = 0;
      words[0].classList.add('in');
      if (reduced) return;
      setInterval(function () {
        var cur = words[i];
        i = (i + 1) % words.length;
        var next = words[i];
        cur.classList.remove('in');
        cur.classList.add('out');
        next.classList.remove('out');
        // force reflow so the transition restarts cleanly
        void next.offsetWidth;
        next.classList.add('in');
        setTimeout(function () { cur.classList.remove('out'); }, 760);
      }, parseInt(r.dataset.interval || '2600', 10));
    });
  }

  /* ------------------------------------------------------------ tab groups */
  function tabs() {
    $$('[data-tabs]').forEach(function (group) {
      var btns   = $$('.tab-btn', group);
      var panels = $$('.tab-panel', group);
      var ind    = $('.tab-ind', group);
      if (!btns.length) return;

      function moveInd(btn) {
        if (!ind) return;
        ind.style.height = btn.offsetHeight + 'px';
        ind.style.transform = 'translateY(' + btn.offsetTop + 'px)';
      }

      function select(idx, focus) {
        btns.forEach(function (b, i) {
          b.setAttribute('aria-selected', String(i === idx));
          b.tabIndex = i === idx ? 0 : -1;
        });
        panels.forEach(function (p, i) { p.classList.toggle('active', i === idx); });
        moveInd(btns[idx]);
        if (focus) btns[idx].focus();
      }

      btns.forEach(function (b, i) {
        b.addEventListener('click', function () { select(i); });
        b.addEventListener('keydown', function (e) {
          var n = null;
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % btns.length;
          if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  n = (i - 1 + btns.length) % btns.length;
          if (e.key === 'Home') n = 0;
          if (e.key === 'End')  n = btns.length - 1;
          if (n !== null) { e.preventDefault(); select(n, true); }
        });
      });

      var start = btns.findIndex(function (b) { return b.getAttribute('aria-selected') === 'true'; });
      select(start > -1 ? start : 0);
      window.addEventListener('resize', function () {
        var active = btns.find(function (b) { return b.getAttribute('aria-selected') === 'true'; });
        if (active) moveInd(active);
      });

      // auto-advance when idle and in view
      if (!reduced && group.dataset.autoplay) {
        var paused = false;
        group.addEventListener('mouseenter', function () { paused = true; });
        group.addEventListener('mouseleave', function () { paused = false; });
        group.addEventListener('focusin', function () { paused = true; });
        var visible = false;
        if ('IntersectionObserver' in window) {
          new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: .3 })
            .observe(group);
        } else { visible = true; }
        setInterval(function () {
          if (paused || !visible) return;
          var cur = btns.findIndex(function (b) { return b.getAttribute('aria-selected') === 'true'; });
          select((cur + 1) % btns.length);
        }, parseInt(group.dataset.autoplay, 10) || 5200);
      }
    });
  }

  /* -------------------------------------------------------- FAQ accordions */
  function accordions() {
    $$('.faq').forEach(function (list) {
      var single = list.dataset.single !== 'false';
      $$('.faq-item', list).forEach(function (item) {
        var q = $('.faq-q', item);
        var a = $('.faq-a', item);
        if (!q || !a) return;
        var open = item.classList.contains('open');
        q.setAttribute('aria-expanded', String(open));
        q.addEventListener('click', function () {
          var willOpen = !item.classList.contains('open');
          if (single && willOpen) {
            $$('.faq-item.open', list).forEach(function (o) {
              o.classList.remove('open');
              var oq = $('.faq-q', o);
              if (oq) oq.setAttribute('aria-expanded', 'false');
            });
          }
          item.classList.toggle('open', willOpen);
          q.setAttribute('aria-expanded', String(willOpen));
        });
      });
    });
  }

  /* ------------------------------------------------- testimonial carousels */
  function carousels() {
    $$('[data-carousel]').forEach(function (wrap) {
      var track = $('.quotes', wrap);
      if (!track) return;
      var prev = $('[data-prev]', wrap);
      var next = $('[data-next]', wrap);
      var dots = $('.qdots', wrap);
      var slides = $$('.quote', track);

      function step() {
        return slides.length > 1
          ? slides[1].getBoundingClientRect().left - slides[0].getBoundingClientRect().left
          : track.clientWidth;
      }
      function index() { return Math.round(track.scrollLeft / Math.max(step(), 1)); }

      if (dots) {
        slides.forEach(function (_, i) {
          var d = document.createElement('i');
          if (i === 0) d.className = 'on';
          dots.appendChild(d);
        });
      }

      var nav = $('.quotes-nav', wrap);

      function sync() {
        var scrollable = track.scrollWidth - track.clientWidth > 4;
        if (nav) nav.hidden = !scrollable;
        var i = index();
        if (dots) $$('i', dots).forEach(function (d, j) { d.classList.toggle('on', j === i); });
        var max = track.scrollWidth - track.clientWidth - 2;
        if (prev) prev.disabled = track.scrollLeft <= 2;
        if (next) next.disabled = track.scrollLeft >= max;
      }

      function go(dir) {
        track.scrollBy({ left: dir * step(), behavior: reduced ? 'auto' : 'smooth' });
      }
      if (prev) prev.addEventListener('click', function () { go(-1); });
      if (next) next.addEventListener('click', function () { go(1); });

      var t;
      track.addEventListener('scroll', function () {
        clearTimeout(t);
        t = setTimeout(sync, 90);
      }, { passive: true });
      window.addEventListener('resize', sync);
      sync();

      // pointer drag
      var down = false, sx = 0, sl = 0;
      track.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch') return;
        down = true; sx = e.clientX; sl = track.scrollLeft;
        track.style.cursor = 'grabbing';
      });
      window.addEventListener('pointerup', function () {
        down = false; track.style.cursor = '';
      });
      track.addEventListener('pointermove', function (e) {
        if (!down) return;
        e.preventDefault();
        track.scrollLeft = sl - (e.clientX - sx);
      });
    });
  }

  /* ----------------------------------------------- monthly / annual toggle */
  function billingToggle() {
    var toggle = $('.bill-toggle');
    if (!toggle) return;
    var btns = $$('button', toggle);
    var knob = $('.knob', toggle);

    function place(btn) {
      if (!knob) return;
      knob.style.width = btn.offsetWidth + 'px';
      knob.style.transform = 'translateX(' + (btn.offsetLeft - 5) + 'px)';
    }
    function apply(mode) {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.bill === mode)); });
      var active = btns.find(function (b) { return b.dataset.bill === mode; });
      if (active) place(active);
      $$('[data-price-monthly]').forEach(function (el) {
        var v = mode === 'annual' ? el.dataset.priceAnnual : el.dataset.priceMonthly;
        if (v === undefined) return;
        el.classList.remove('flash');
        void el.offsetWidth;
        el.textContent = v;
        el.classList.add('flash');
      });
      $$('[data-bill-note]').forEach(function (el) {
        el.textContent = mode === 'annual' ? el.dataset.noteAnnual || '' : el.dataset.noteMonthly || '';
      });
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.dataset.bill); });
    });
    var start = btns.find(function (b) { return b.getAttribute('aria-pressed') === 'true'; }) || btns[0];
    apply(start.dataset.bill);
    window.addEventListener('resize', function () {
      var a = btns.find(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
      if (a) place(a);
    });
  }

  /* ------------------------------------------------- cursor-tracked glow */
  function cardGlow() {
    if (reduced || window.matchMedia('(hover: none)').matches) return;
    $$('.card-glow').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  /* --------------------------------------------------- reading progress bar */
  function scrollProgress() {
    var bar = $('.scroll-progress');
    if (!bar) return;
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(window.scrollY / h, 1) : 0) + ')';
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* --------------------------------------------------------- back to top */
  function backToTop() {
    var btn = $('.to-top');
    if (!btn) return;
    function update() { btn.classList.toggle('show', window.scrollY > 620); }
    update();
    window.addEventListener('scroll', update, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* --------------------------------------------------- TOC active section */
  function tocHighlight() {
    var links = $$('.toc-list a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    var targets = links.map(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) map[el.id] = a;
      return el;
    }).filter(Boolean);
    if (!targets.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('active'); });
        if (map[e.target.id]) map[e.target.id].classList.add('active');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  }

  /* ------------------------------------ resource center search + filters */
  function resourceSearch() {
    var input = $('.search-field input');
    if (!input) return;
    var index = $('[data-blog-index]');

    if (!index) {
      // Article pages: send the query to the resource index.
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && input.value.trim()) {
          location.href = 'blog.html?q=' + encodeURIComponent(input.value.trim());
        }
      });
      return;
    }

    var cards = $$('.article-layout .post-card');
    var note  = $('[data-filter-note]');
    var catLinks = $$('.side-list a[href^="blog.html#"]');

    function slug(s) {
      return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function apply() {
      var term = input.value.trim().toLowerCase();
      var cat  = location.hash.replace('#', '');
      var shown = 0;
      cards.forEach(function (c) {
        var catEl  = $('.post-cat', c);
        var okCat  = !cat || (catEl && slug(catEl.textContent) === cat);
        var okTerm = !term || c.textContent.toLowerCase().indexOf(term) > -1;
        var ok = okCat && okTerm;
        c.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      catLinks.forEach(function (l) {
        l.classList.toggle('active', !!cat && l.hash.replace('#', '') === cat);
      });
      if (note) note.hidden = shown > 0;
    }

    input.addEventListener('input', apply);
    window.addEventListener('hashchange', apply);

    // Tag chips act as instant search terms on the index.
    $$('.side-tags a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
        input.value = a.textContent.trim();
        apply();
        input.focus();
      });
    });

    var q = /[?&]q=([^&]+)/.exec(location.search);
    if (q) input.value = decodeURIComponent(q[1].replace(/\+/g, ' '));
    apply();
  }

  /* -------------------------------------------------- article share links */
  function share() {
    var wrap = $('.share');
    if (!wrap) return;
    var check = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
    $$('a', wrap).forEach(function (a) {
      var kind = (a.getAttribute('aria-label') || '').replace(/^Share on /, '').toLowerCase();
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var u = encodeURIComponent(location.href);
        var t = encodeURIComponent(document.title);
        function pop(href) { window.open(href, '_blank', 'noopener,width=640,height=560'); }
        if (kind === 'x')             pop('https://twitter.com/intent/tweet?url=' + u + '&text=' + t);
        else if (kind === 'facebook') pop('https://www.facebook.com/sharer/sharer.php?u=' + u);
        else if (kind === 'linkedin') pop('https://www.linkedin.com/sharing/share-offsite/?url=' + u);
        else if (kind === 'email')    location.href = 'mailto:?subject=' + t + '&body=' + u;
        else { // copy link
          function done() {
            var old = a.innerHTML;
            a.innerHTML = check;
            setTimeout(function () { a.innerHTML = old; }, 1400);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(location.href).then(done, done);
          } else {
            var ta = document.createElement('textarea');
            ta.value = location.href;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (err) {}
            document.body.removeChild(ta);
            done();
          }
        }
      });
    });
  }

  /* ------------------------------------------------------- form behaviour */
  function forms() {
    // Phone mask: (806) 606-6500
    $$('input[type="tel"]').forEach(function (input) {
      input.addEventListener('input', function () {
        var d = input.value.replace(/\D/g, '').slice(0, 10);
        var out = d;
        if (d.length > 6)      out = '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
        else if (d.length > 3) out = '(' + d.slice(0, 3) + ') ' + d.slice(3);
        else if (d.length > 0) out = '(' + d;
        input.value = out;
      });
    });

    $$('form[data-demo-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        var status = $('.form-status', form);
        var btn = $('button[type="submit"]', form);
        if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; }
        setTimeout(function () {
          if (status) {
            status.innerHTML = '<strong>Thanks — you’re on the list.</strong><br>A Growth Specialist will text or call you within one business day to confirm your demo.';
            status.classList.add('show');
          }
          form.reset();
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Book my demo'; }
        }, 700);
      });
    });

    // Merchant sign-in: keep credentials out of the URL and explain that the
    // portal is not wired up on this static preview build.
    $$('form[data-auth-form]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        var status = $('.form-status', form);
        var btn = $('button[type="submit"]', form);
        if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Signing in…'; }
        setTimeout(function () {
          if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Sign in'; }
          if (status) {
            status.innerHTML = '<strong>The merchant portal isn’t connected on this preview build.</strong><br>Call or text <a href="tel:+18066066500">(806) 606-6500</a> or email <a href="mailto:support@customerconnectwp.com">support@customerconnectwp.com</a> and we’ll get you into your account.';
            status.classList.add('show');
          }
        }, 800);
      });
    });
  }

  /* ------------------------------------------------------ gentle parallax */
  function parallax() {
    if (reduced) return;
    var orbs = $$('.orb');
    if (!orbs.length) return;
    var ticking = false;
    function frame() {
      var y = window.scrollY;
      orbs.forEach(function (o, i) {
        var rate = (i % 2 ? -0.045 : 0.06) * (1 + i * 0.12);
        o.style.transform = 'translate3d(0,' + (y * rate).toFixed(1) + 'px,0)';
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }, { passive: true });
  }

  /* -------------------------------------------------- soft page transition */
  function pageExit() {
    if (reduced) return;
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented) return;
      var a = e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || a.target === '_blank' || a.hasAttribute('download')) return;
      if (/^(#|mailto:|tel:|sms:|javascript:)/.test(href)) return;
      if (a.origin && a.origin !== location.origin) return;
      if (a.pathname === location.pathname && a.hash) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      document.body.classList.add('leaving');
      setTimeout(function () { location.href = a.href; }, 210);
    });
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) document.body.classList.remove('leaving');
    });
  }

  /* ---------------------------------------------------------- © year stamp */
  function year() {
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
