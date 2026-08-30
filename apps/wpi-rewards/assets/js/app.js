/* WPI Rewards — portal behavior (vanilla JS, no dependencies) */
(function () {
  "use strict";

  const D = window.WPI;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ------------------------------------------------------------------
     Cart store (localStorage) — shared across all pages
     ------------------------------------------------------------------ */
  const Cart = {
    KEY: "wpi-cart",
    read() {
      try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
      catch { return []; }
    },
    write(items) {
      localStorage.setItem(this.KEY, JSON.stringify(items));
      renderCartBadge(true);
    },
    add(productId, qty) {
      const items = this.read();
      const row = items.find((i) => i.id === productId);
      if (row) row.qty += qty || 1;
      else items.push({ id: productId, qty: qty || 1 });
      this.write(items);
    },
    setQty(productId, qty) {
      let items = this.read();
      const row = items.find((i) => i.id === productId);
      if (!row) return;
      row.qty = qty;
      if (row.qty <= 0) items = items.filter((i) => i.id !== productId);
      this.write(items);
    },
    remove(productId) {
      this.write(this.read().filter((i) => i.id !== productId));
    },
    clear() { this.write([]); },
    count() { return this.read().reduce((n, i) => n + i.qty, 0); },
    totalPoints() {
      return this.read().reduce((n, i) => {
        const p = D.catalog.find((c) => c.id === i.id);
        return n + (p ? p.points * i.qty : 0);
      }, 0);
    },
  };
  window.WPI.Cart = Cart;

  /* Demo orders placed through this prototype live alongside snapshot orders */
  const LocalOrders = {
    KEY: "wpi-demo-orders",
    read() {
      try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
      catch { return []; }
    },
    add(order) {
      const all = this.read();
      all.unshift(order);
      localStorage.setItem(this.KEY, JSON.stringify(all));
    },
  };

  function allOrders() {
    return LocalOrders.read().concat(D.orders);
  }

  /* ------------------------------------------------------------------
     Shared shell: header state, badge, menus, toasts, reveals
     ------------------------------------------------------------------ */
  function renderCartBadge(bump) {
    const n = Cart.count();
    $$("[data-cart-badge]").forEach((el) => {
      el.textContent = n > 99 ? "99+" : String(n);
      el.classList.toggle("is-on", n > 0);
      if (bump && n > 0) {
        el.classList.remove("bump");
        void el.offsetWidth;
        el.classList.add("bump");
      }
    });
  }

  function initHeader() {
    const header = $(".site-header");
    if (!header) return;
    const onScroll = () => header.classList.toggle("is-stuck", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const toggle = $(".nav__toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const open = document.body.classList.toggle("menu-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }

    const accBtn = $("[data-account-btn]");
    const accMenu = $("[data-account-menu]");
    if (accBtn && accMenu) {
      accBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = accMenu.classList.toggle("is-open");
        accBtn.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", (e) => {
        if (!accMenu.contains(e.target)) {
          accMenu.classList.remove("is-open");
          accBtn.setAttribute("aria-expanded", "false");
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") accMenu.classList.remove("is-open");
      });
    }

    $$("[data-points-chip]").forEach((el) => {
      el.innerHTML =
        svgIcon("star") +
        '<span class="tabular">' + D.fmt.format(D.account.availablePoints) + "<i> pts</i></span>";
    });
  }

  function toast(message) {
    let zone = $(".toast-zone");
    if (!zone) {
      zone = document.createElement("div");
      zone.className = "toast-zone";
      document.body.appendChild(zone);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.innerHTML = svgIcon("check") + "<span>" + message + "</span>";
    zone.appendChild(el);
    setTimeout(() => {
      el.classList.add("is-out");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, 2600);
  }
  window.WPI.toast = toast;

  function initReveals() {
    const els = $$("[data-reveal]");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    // Only hide-and-reveal once JS is definitely running; without this
    // class the CSS leaves everything visible, so slow or failed script
    // loads can never blank the page.
    document.documentElement.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
    );
    els.forEach((el) => io.observe(el));
    // Failsafe: whatever the observer does or doesn't do (iOS Safari has
    // known misfires on scroll), everything is visible within 1.5s.
    setTimeout(() => {
      els.forEach((el) => el.classList.add("is-in"));
      io.disconnect();
    }, 1500);
  }

  function initAccordions() {
    $$(".acc").forEach((acc) => {
      const btn = $(".acc__btn", acc);
      if (!btn) return;
      btn.addEventListener("click", () => {
        const open = acc.getAttribute("data-open") === "true";
        acc.setAttribute("data-open", String(!open));
        btn.setAttribute("aria-expanded", String(!open));
      });
    });
  }

  /* Fallback page fade for browsers without cross-document view transitions */
  function initPageTransitions() {
    if ("startViewTransition" in document || CSS.supports("view-transition-name", "root")) return;
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || a.target || a.href.startsWith("mailto:") || a.href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      e.preventDefault();
      document.body.classList.add("is-leaving");
      setTimeout(() => { location.href = a.href; }, 170);
    });
    window.addEventListener("pageshow", () => document.body.classList.remove("is-leaving"));
  }

  function countUp(el, target, ms) {
    const dur = ms || 1100;
    const start = performance.now();
    const from = 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = D.fmt.format(Math.round(from + (target - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function initCountups() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    $$("[data-countup]").forEach((el) => {
      const target = Number(el.getAttribute("data-countup"));
      if (reduce) { el.textContent = D.fmt.format(target); return; }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { countUp(el, target); io.disconnect(); }
        });
      }, { threshold: 0.4 });
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
     Icons & product art
     ------------------------------------------------------------------ */
  function svgIcon(name, size) {
    const s = size || 16;
    const paths = {
      star: '<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/>',
      check: '<polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
      cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/><path d="M3 3h2.4l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.3L20.5 7H6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      gift: '<rect x="3.5" y="8.5" width="17" height="12" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.5V20.5M3.5 13h17M12 8.5c-2.3 0-4.6-1-4.6-3a2.1 2.1 0 0 1 4.2-.6c.3.9.4 2.4.4 3.6zm0 0c2.3 0 4.6-1 4.6-3a2.1 2.1 0 0 0-4.2-.6c-.3.9-.4 2.4-.4 3.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      watch: '<circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9.4V12l1.9 1.4M9 6.6 9.6 2h4.8L15 6.6M9 17.4 9.6 22h4.8l.6-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      plane: '<path d="M10.2 13.8 3 11.4l1.5-1.5 5.6.7 4.7-4.7a1.7 1.7 0 0 1 2.4 2.4l-4.7 4.7.7 5.6-1.5 1.5-2.4-7.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      box: '<path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M3.5 7 12 11.2 20.5 7M12 11.2V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      receipt: '<path d="M6 2.8h12v18l-2.4-1.6-2.4 1.6-1.2-.9-1.2.9-2.4-1.6L6 20.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8h6M9 12h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      user: '<circle cx="12" cy="8.2" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      logout: '<path d="M14 4h-8v16h8M10 12h11M18 8.5 21.5 12 18 15.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      search: '<circle cx="10.8" cy="10.8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m15.6 15.6 4.6 4.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
      trend: '<path d="M3 17.5 9.2 11l3.6 3.4L21 6.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.4 6.4H21v5.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
      clock: '<circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.6V12l3 2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      shield: '<path d="M12 2.8 19.5 6v5.4c0 4.6-3 8.2-7.5 9.8-4.5-1.6-7.5-5.2-7.5-9.8V6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><polyline points="8.8 12 11 14.2 15.4 9.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m3.6 6.6 8.4 6.6 8.4-6.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      phone: '<path d="M7.2 3.2 9.6 3l1.4 4-2 1.6a12.5 12.5 0 0 0 4.4 4.4l1.6-2 4 1.4-.2 2.4c-.1 1.4-1.3 2.4-2.6 2.2A16.4 16.4 0 0 1 5 5.8c-.2-1.3.8-2.5 2.2-2.6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
      trash: '<path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5 7.4 20h9.2l.9-13.5M10 10.5v6M14 10.5v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    };
    return (
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      (paths[name] || "") +
      "</svg>"
    );
  }
  window.WPI.svgIcon = svgIcon;

  const CAT_META = {
    gift:   { label: "Gift Cards",     art: "gift",   icon: "gift" },
    luxury: { label: "Luxury Goods",   art: "luxury", icon: "watch" },
    travel: { label: "Travel",         art: "travel", icon: "plane" },
    merch:  { label: "Merchandise",    art: "merch",  icon: "box" },
  };
  window.WPI.CAT_META = CAT_META;

  function photoTag(p) {
    return (
      '<img class="product__art-img" src="' + p.img + '"' +
      (p.imgAlt ? ' data-alt="' + p.imgAlt + '"' : "") +
      ' alt="" loading="lazy" referrerpolicy="no-referrer">'
    );
  }

  function productArt(p, iconSize) {
    const m = CAT_META[p.cat];
    return (
      '<div class="product__art product__art--' + m.art + (p.img ? " product__art--photo" : "") +
      '" data-brand="' + p.brand + '">' +
      (p.img ? photoTag(p) : "") + svgIcon(m.icon, iconSize || 52) +
      "</div>"
    );
  }

  function miniArt(p, iconSize) {
    return p.img ? photoTag(p) : svgIcon(CAT_META[p.cat].icon, iconSize);
  }

  /* Image fallback chain, captured globally (error events don't bubble):
     primary URL fails → retry the data-alt URL once → drop to gradient art. */
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains("product__art-img")) return;
      if (img.dataset.alt && !img.dataset.retried) {
        img.dataset.retried = "1";
        img.src = img.dataset.alt;
        return;
      }
      const tile = img.closest(".product__art, .cart-item__art");
      if (tile) tile.classList.remove("product__art--photo");
      img.remove();
    },
    true
  );

  function productCard(p, opts) {
    const afford = p.points <= D.account.availablePoints;
    const badge = opts && typeof opts === "object" && opts.badge
      ? '<span class="product__flag product__flag--' + opts.badge.kind + '">' + opts.badge.text + "</span>"
      : "";
    return (
      '<article class="product' + (afford ? " product--afford" : "") + '" data-id="' + p.id + '">' +
      productArt(p).replace("</div>", badge + "</div>") +
      '<div class="product__body">' +
      '<span class="product__cat">' + CAT_META[p.cat].label + "</span>" +
      '<h3 class="product__name">' + p.name + "</h3>" +
      '<p class="product__desc">' + p.desc + "</p>" +
      '<div class="product__foot">' +
      '<div class="product__points tabular">' + D.fmt.format(p.points) + "<span>points</span></div>" +
      '<button class="btn btn--tint btn--sm" data-add="' + p.id + '">Add</button>' +
      "</div></div></article>"
    );
  }

  function bindAddButtons(root) {
    (root || document).addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add]");
      if (!btn) return;
      const id = btn.getAttribute("data-add");
      const p = D.catalog.find((c) => c.id === id);
      Cart.add(id, 1);
      toast("Added to cart — " + (p ? p.name : "item"));
    });
  }

  /* ------------------------------------------------------------------
     Charts (inline SVG, no libraries)
     ------------------------------------------------------------------ */
  function renderLineChart(host) {
    const data = D.transactions.slice().reverse(); // chronological
    const W = 720, H = 300;
    const pad = { t: 18, r: 16, b: 34, l: 48 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    const max = Math.max(...data.map((d) => d.points));
    const yMax = Math.ceil(max / 500) * 500;
    const x = (i) => pad.l + (i / (data.length - 1)) * iw;
    const y = (v) => pad.t + ih - (v / yMax) * ih;

    let path = "";
    data.forEach((d, i) => { path += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d.points).toFixed(1) + " "; });
    const area = path + "L" + x(data.length - 1).toFixed(1) + " " + (pad.t + ih) + " L" + pad.l + " " + (pad.t + ih) + " Z";

    const yTicks = [];
    for (let v = 0; v <= yMax; v += yMax / 4) yTicks.push(v);

    const xLabelIdx = [0, Math.floor(data.length / 3), Math.floor((2 * data.length) / 3), data.length - 1];
    const shortDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

    let svg =
      '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Points earned per settlement day, ' +
      shortDate(data[0].date) + " to " + shortDate(data[data.length - 1].date) + '">' +
      '<defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#2a78d6" stop-opacity="0.18"/>' +
      '<stop offset="100%" stop-color="#2a78d6" stop-opacity="0"/>' +
      "</linearGradient></defs>";

    yTicks.forEach((v) => {
      const yy = y(v).toFixed(1);
      svg += '<line class="viz-grid-line" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + yy + '" y2="' + yy + '"/>';
      svg += '<text x="' + (pad.l - 9) + '" y="' + yy + '" text-anchor="end" dominant-baseline="middle">' +
        (v >= 1000 ? v / 1000 + "k" : v) + "</text>";
    });
    svg += '<line class="viz-axis-line" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + (pad.t + ih) + '" y2="' + (pad.t + ih) + '"/>';
    xLabelIdx.forEach((i) => {
      svg += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + shortDate(data[i].date) + "</text>";
    });

    svg += '<path class="viz-area" d="' + area + '"/>';
    svg += '<path class="viz-line" d="' + path + '"/>';
    svg += '<line class="viz-crosshair" data-crosshair x1="0" x2="0" y1="' + pad.t + '" y2="' + (pad.t + ih) + '"/>';
    svg += '<circle class="viz-dot" data-hoverdot r="4.5" cx="-10" cy="-10" opacity="0"/>';
    svg += "</svg>";

    host.innerHTML = svg + '<div class="viz-tip" data-tip></div>';

    const svgEl = $("svg", host);
    const tip = $("[data-tip]", host);
    const cross = $("[data-crosshair]", host);
    const dot = $("[data-hoverdot]", host);

    function onMove(evt) {
      const rect = svgEl.getBoundingClientRect();
      const px = ((evt.clientX - rect.left) / rect.width) * W;
      const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - pad.l) / iw) * (data.length - 1))));
      const d = data[i];
      const cx = x(i), cy = y(d.points);
      cross.setAttribute("x1", cx); cross.setAttribute("x2", cx);
      cross.classList.add("is-on");
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("opacity", "1");
      tip.innerHTML = "<b>" + D.fmt.format(d.points) + " pts</b><br><span>" + D.fmtDate(d.date) + " · " + D.fmtUsd.format(d.amount) + " processed</span>";
      tip.style.left = (cx / W) * 100 + "%";
      tip.style.top = Math.max(0, (cy / H) * rect.height - 62) + "px";
      tip.classList.add("is-on");
    }
    function onLeave() {
      tip.classList.remove("is-on");
      cross.classList.remove("is-on");
      dot.setAttribute("opacity", "0");
    }
    svgEl.addEventListener("pointermove", onMove);
    svgEl.addEventListener("pointerleave", onLeave);
  }

  function renderDonut(host) {
    const a = D.account;
    const R = 66, C = 2 * Math.PI * R;
    const total = a.totalPoints;
    const avail = a.availablePoints / total;
    const pend = a.pendingPoints / total;
    const GAP = 2.6 / (2 * Math.PI * R) ; // ≈2px surface gap between segments
    const seg = (frac, offsetFrac, color) => {
      const len = Math.max(0, (frac - GAP) * C);
      return '<circle class="donut__seg" r="' + R + '" cx="79" cy="79" stroke="' + color +
        '" stroke-dasharray="' + len.toFixed(1) + " " + (C - len).toFixed(1) +
        '" stroke-dashoffset="' + (-offsetFrac * C).toFixed(1) + '"/>';
    };
    host.innerHTML =
      '<div class="donut" role="img" aria-label="Points balance: ' +
      D.fmt.format(a.availablePoints) + " available, " + D.fmt.format(a.pendingPoints) + ' pending">' +
      '<svg viewBox="0 0 158 158">' +
      '<circle class="donut__track" r="' + R + '" cx="79" cy="79"/>' +
      seg(avail, 0, "var(--viz-1)") +
      seg(pend, avail, "var(--viz-2)") +
      "</svg>" +
      '<div class="donut__center"><b class="tabular" data-countup="' + total + '">0</b><span>total points</span></div>' +
      "</div>" +
      '<div class="legend">' +
      '<div class="legend__row"><i style="background:var(--viz-1)"></i><span>Available</span><b class="tabular">' + D.fmt.format(a.availablePoints) + "</b></div>" +
      '<div class="legend__row"><i style="background:var(--viz-2)"></i><span>Pending</span><b class="tabular">' + D.fmt.format(a.pendingPoints) + "</b></div>" +
      '<div class="legend__row"><i style="background:var(--bg-3)"></i><span>Total earned</span><b class="tabular">' + D.fmt.format(total) + "</b></div>" +
      "</div>";
  }

  /* ------------------------------------------------------------------
     Earnings projection — rate derived from the captured 30-day window
     ------------------------------------------------------------------ */
  function monthlyRate() {
    const tx = D.transactions;
    const total = tx.reduce((n, t) => n + t.points, 0);
    const first = new Date(tx[tx.length - 1].date + "T12:00:00");
    const last = new Date(tx[0].date + "T12:00:00");
    const days = Math.max(1, Math.round((last - first) / 86400000) + 1);
    return Math.round((total / days) * 30.44);
  }

  function renderProjection() {
    const host = $("[data-projection]");
    if (!host) return;
    const rate = monthlyRate();
    const note = $("[data-proj-note]");
    if (note) note.innerHTML = '<span data-note-long>Based on your current pace of </span>~' + D.fmt.format(rate) + " pts/month";

    const byPointsDesc = D.catalog.slice().sort((a, b) => b.points - a.points);
    const TERMS = [
      { m: 3, label: "In 3 Months" },
      { m: 6, label: "In 6 Months" },
      { m: 12, label: "In 12 Months" },
    ];
    host.innerHTML = TERMS.map((t, i) => {
      const projected = D.account.totalPoints + rate * t.m;
      const dollars = Math.round(projected / 120);
      const unlock = byPointsDesc.find((p) => p.points <= projected);
      const unlockRow = unlock
        ? '<div class="proj-tile__unlock"><i>' + svgIcon(CAT_META[unlock.cat].icon, 15) + "</i>" +
          "<span>Enough for <b>" + unlock.name + "</b></span></div>"
        : "";
      return (
        '<article class="card proj-tile" data-reveal style="--d:' + i + '">' +
        '<span class="proj-tile__term"><i>' + t.m + "M</i>" + t.label + "</span>" +
        '<div class="proj-tile__value tabular"><span data-countup="' + projected + '">0</span> <small>pts</small></div>' +
        '<p class="proj-tile__equiv">≈ <b>' + D.fmtUsd.format(dollars).replace(".00", "") + "</b> in gift-card value</p>" +
        unlockRow +
        "</article>"
      );
    }).join("");

    const chartHost = $("[data-proj-chart]");
    if (chartHost) renderProjChart(chartHost, rate);
  }

  function renderProjChart(host, rate) {
    const start = D.account.totalPoints;
    const MONTHS = 12;
    const W = 960, H = 260;
    const pad = { t: 20, r: 20, b: 34, l: 56 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const yMaxRaw = start + rate * MONTHS;
    const yMax = Math.ceil(yMaxRaw / 50000) * 50000;
    const x = (m) => pad.l + (m / MONTHS) * iw;
    const y = (v) => pad.t + ih - (v / yMax) * ih;
    const val = (m) => start + rate * m;

    let svg = '<svg viewBox="0 0 ' + W + " " + H +
      '" role="img" aria-label="Projected points balance from now to twelve months: ' +
      D.fmt.format(start) + " today growing to about " + D.fmt.format(val(12)) + '">';

    for (let v = 0; v <= yMax; v += yMax / 4) {
      const yy = y(v).toFixed(1);
      svg += '<line class="viz-grid-line" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + yy + '" y2="' + yy + '"/>';
      svg += '<text x="' + (pad.l - 9) + '" y="' + yy + '" text-anchor="end" dominant-baseline="middle">' +
        (v >= 1000 ? Math.round(v / 1000) + "k" : v) + "</text>";
    }
    svg += '<line class="viz-axis-line" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + (pad.t + ih) + '" y2="' + (pad.t + ih) + '"/>';
    [[0, "Today"], [3, "3 mo"], [6, "6 mo"], [9, "9 mo"], [12, "12 mo"]].forEach(([m, label]) => {
      svg += '<text x="' + x(m).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + label + "</text>";
    });

    let dashed = "M" + x(0).toFixed(1) + " " + y(val(0)).toFixed(1);
    for (let m = 1; m <= MONTHS; m++) dashed += " L" + x(m).toFixed(1) + " " + y(val(m)).toFixed(1);
    svg += '<path class="viz-proj-line" d="' + dashed + '"/>';

    svg += '<circle class="viz-proj-now" r="5" cx="' + x(0) + '" cy="' + y(val(0)) + '"/>';
    [3, 6, 12].forEach((m) => {
      svg += '<circle class="viz-proj-dot" r="5" cx="' + x(m) + '" cy="' + y(val(m)) + '"/>';
      svg += '<text x="' + x(m) + '" y="' + (y(val(m)) - 13) + '" text-anchor="middle" style="font-weight:600;fill:var(--ink-2)">' +
        D.fmt.format(val(m)) + "</text>";
    });
    svg += '<text x="' + (x(0) + 10) + '" y="' + (y(val(0)) - 13) + '" text-anchor="start" style="font-weight:600;fill:var(--ink-2)">' +
      D.fmt.format(start) + " today</text>";
    svg += "</svg>";
    host.innerHTML = svg;
  }

  /* Run a render step in isolation so one failure can't blank the rest. */
  function safe(fn) {
    try { fn(); } catch (e) { /* section renders fall back to static markup */ }
  }

  /* ------------------------------------------------------------------
     Page: Dashboard
     ------------------------------------------------------------------ */
  function pageDashboard() {
    safe(() => {
      const greeting = $("[data-greeting]");
      if (greeting) {
        const h = new Date().getHours();
        const part = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
        greeting.textContent = part + ", " + D.account.business;
      }
    });

    safe(() => {
      const donut = $("[data-donut]");
      if (donut) renderDonut(donut);
    });
    safe(() => {
      const chart = $("[data-line-chart]");
      if (chart) renderLineChart(chart);
    });
    safe(renderProjection);

    safe(() => {
    const rail = $("[data-featured]");
    if (rail) {
      const avail = D.account.availablePoints;
      const total = D.account.totalPoints;
      const now = D.catalog
        .filter((p) => p.points <= avail)
        .sort((a, b) => b.points - a.points);
      const soon = D.catalog
        .filter((p) => p.points > avail && p.points <= total)
        .sort((a, b) => a.points - b.points);
      rail.innerHTML = now.concat(soon).map((p) => productCard(p)).join("");

      // Front of the rail is what greets the user — fetch those images now.
      $$(".product__art-img", rail).forEach((img, i) => {
        if (i < 4) {
          img.loading = "eager";
          img.setAttribute("fetchpriority", "high");
        }
      });

      const prev = $("[data-rail-prev]");
      const next = $("[data-rail-next]");
      if (prev && next) {
        const step = () => Math.max(220, rail.clientWidth * 0.8);
        prev.addEventListener("click", () => rail.scrollBy({ left: -step(), behavior: "smooth" }));
        next.addEventListener("click", () => rail.scrollBy({ left: step(), behavior: "smooth" }));
        const sync = () => {
          prev.disabled = rail.scrollLeft <= 4;
          next.disabled = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 4;
        };
        rail.addEventListener("scroll", sync, { passive: true });
        window.addEventListener("resize", sync);
        sync();
      }
    }
    });

    safe(() => {
    const act = $("[data-activity]");
    if (act) {
      const rows = allOrders().slice(0, 6).map((o) =>
        '<div class="row-list__item">' +
        '<div class="row-list__icon">' + svgIcon("gift", 20) + "</div>" +
        '<div class="row-list__body"><b>Redeemed ' + o.name + "</b><span>" + D.fmtDate(o.date) + "</span></div>" +
        '<div class="row-list__value is-neg tabular">−' + D.fmt.format(o.points) + " pts</div>" +
        "</div>"
      );
      const recent = D.transactions.slice(0, 5).map((t) =>
        '<div class="row-list__item">' +
        '<div class="row-list__icon">' + svgIcon("trend", 20) + "</div>" +
        '<div class="row-list__body"><b>Points earned on processing</b><span>' + D.fmtDate(t.date) + " · " + D.fmtUsd.format(t.amount) + " processed</span></div>" +
        '<div class="row-list__value is-pos tabular">+' + D.fmt.format(t.points) + " pts</div>" +
        "</div>"
      );
      act.innerHTML = recent.concat(rows).join("");
    }
    });

    safe(() => {
    const faqHost = $("[data-faq]");
    if (faqHost) {
      faqHost.innerHTML = D.faq.map((f, i) =>
        '<div class="acc" data-open="false">' +
        '<h3><button class="acc__btn" aria-expanded="false" id="faq-btn-' + i + '" aria-controls="faq-panel-' + i + '">' +
        f.q + '<span class="acc__sign" aria-hidden="true"></span></button></h3>' +
        '<div class="acc__panel" id="faq-panel-' + i + '" role="region" aria-labelledby="faq-btn-' + i + '"><div class="acc__inner"><p>' + f.a + "</p></div></div>" +
        "</div>"
      ).join("");
    }
    });
  }

  /* ------------------------------------------------------------------
     Page: Rewards catalog
     ------------------------------------------------------------------ */
  function pageCatalog() {
    const grid = $("[data-products]");
    if (!grid) return;
    const countEl = $("[data-count]");
    const searchEl = $("[data-search]");
    const sortEl = $("[data-sort]");
    const affordEl = $("[data-afford]");
    const segBtns = $$("[data-cat]");

    const params = new URLSearchParams(location.search);
    const state = {
      cat: params.get("cat") || "all",
      q: "",
      sort: "match",
      afford: params.get("afford") === "1",
    };
    if (affordEl) affordEl.checked = state.afford;
    segBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-cat") === state.cat)));

    function apply() {
      let items = D.catalog.slice();
      if (state.cat !== "all") items = items.filter((p) => p.cat === state.cat);
      if (state.afford) items = items.filter((p) => p.points <= D.account.availablePoints);
      if (state.q) {
        const q = state.q.toLowerCase();
        items = items.filter((p) => (p.name + " " + p.brand + " " + p.desc).toLowerCase().includes(q));
      }
      if (state.sort === "low") items.sort((a, b) => a.points - b.points);
      else if (state.sort === "high") items.sort((a, b) => b.points - a.points);
      else if (state.sort === "name") items.sort((a, b) => a.name.localeCompare(b.name));

      if (countEl) {
        countEl.textContent = items.length
          ? items.length + (items.length === 1 ? " reward" : " rewards") +
            (state.afford ? " within your " + D.fmt.format(D.account.availablePoints) + " available points" : "")
          : "";
      }

      if (!items.length) {
        grid.innerHTML =
          '<div class="empty" style="grid-column:1/-1">' +
          '<div class="empty__icon">' + svgIcon("search", 26) + "</div>" +
          "<h3>No rewards match</h3><p>Try a different search, category, or turn off the points filter.</p></div>";
        return;
      }
      grid.innerHTML = items.map(productCard).join("");
    }

    segBtns.forEach((b) =>
      b.addEventListener("click", () => {
        state.cat = b.getAttribute("data-cat");
        segBtns.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        apply();
      })
    );
    if (searchEl) searchEl.addEventListener("input", () => { state.q = searchEl.value.trim(); apply(); });
    if (sortEl) sortEl.addEventListener("change", () => { state.sort = sortEl.value; apply(); });
    if (affordEl) affordEl.addEventListener("change", () => { state.afford = affordEl.checked; apply(); });

    apply();
  }

  /* ------------------------------------------------------------------
     Page: Earnings
     ------------------------------------------------------------------ */
  function pageEarnings() {
    const donut = $("[data-donut]");
    if (donut) renderDonut(donut);
    const chart = $("[data-line-chart]");
    if (chart) renderLineChart(chart);

    const host = $("[data-transactions]");
    if (!host) return;
    const searchEl = $("[data-tx-search]");

    /* Month filter state: default to the current month, falling back to
       the most recent month that actually has transactions. */
    const mKey = (y, m) => y + "-" + String(m).padStart(2, "0");
    const mName = (m, style) => new Date(2000, m - 1, 1).toLocaleDateString("en-US", { month: style });
    const txMonths = new Set(D.transactions.map((t) => t.date.slice(0, 7)));
    const monthKeys = Array.from(txMonths).sort();
    const minYear = +monthKeys[0].slice(0, 4);
    const maxYear = +monthKeys[monthKeys.length - 1].slice(0, 4);
    const today = new Date();
    let selKey = mKey(today.getFullYear(), today.getMonth() + 1);
    if (!txMonths.has(selKey)) selKey = monthKeys[monthKeys.length - 1];
    let selYear = +selKey.slice(0, 4);
    let selMonth = +selKey.slice(5, 7);

    function render(q) {
      let rows = D.transactions.filter((t) => t.date.slice(0, 7) === mKey(selYear, selMonth));
      if (q) rows = rows.filter((t) => (D.fmtDateLong(t.date) + t.amount + t.points).toLowerCase().includes(q.toLowerCase()));
      if (!rows.length) {
        host.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--ink-3);padding:34px">No transactions in ' +
          mName(selMonth, "long") + " " + selYear + (q ? " match." : ".") + "</td></tr>";
        return;
      }
      let lastMonth = "";
      host.innerHTML = rows.map((t) => {
        const month = new Date(t.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const label = month !== lastMonth
          ? '<tr><td colspan="3" class="month-label" style="background:var(--bg-2);border-bottom:1px solid var(--line-2);padding:10px 18px">' + month + "</td></tr>"
          : "";
        lastMonth = month;
        return label +
          "<tr><td>" + D.fmtDateLong(t.date) + '</td><td class="num tabular">' + D.fmtUsd.format(t.amount) +
          '</td><td class="num tabular" style="color:var(--mint);font-weight:600">+' + D.fmt.format(t.points) + "</td></tr>";
      }).join("");
    }
    if (searchEl) searchEl.addEventListener("input", () => render(searchEl.value.trim()));

    /* Apple-style month & year picker */
    const picker = $("[data-month-picker]");
    if (picker) {
      const btn = $("[data-month-btn]", picker);
      const pop = $("[data-month-pop]", picker);
      const grid = $("[data-month-grid]", picker);
      const yearLabel = $("[data-year-label]", picker);
      const yearPrev = $("[data-year-prev]", picker);
      const yearNext = $("[data-year-next]", picker);
      let viewYear = selYear;

      const syncLabel = () => { $("[data-month-label]", picker).textContent = mName(selMonth, "long") + " " + selYear; };
      function drawGrid() {
        yearLabel.textContent = String(viewYear);
        yearPrev.disabled = viewYear <= minYear;
        yearNext.disabled = viewYear >= maxYear;
        grid.innerHTML = "";
        for (let m = 1; m <= 12; m++) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = mName(m, "short");
          b.disabled = !txMonths.has(mKey(viewYear, m));
          if (viewYear === selYear && m === selMonth) b.classList.add("is-on");
          b.addEventListener("click", () => {
            selYear = viewYear;
            selMonth = m;
            syncLabel();
            closePop();
            render(searchEl ? searchEl.value.trim() : "");
          });
          grid.appendChild(b);
        }
      }
      function openPop() {
        viewYear = selYear;
        drawGrid();
        pop.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
      }
      function closePop() {
        pop.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        pop.classList.contains("is-open") ? closePop() : openPop();
      });
      yearPrev.addEventListener("click", () => { viewYear--; drawGrid(); });
      yearNext.addEventListener("click", () => { viewYear++; drawGrid(); });
      document.addEventListener("click", (e) => { if (!picker.contains(e.target)) closePop(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
      syncLabel();
    }
    render("");

    const act = $("[data-redemptions]");
    if (act) {
      act.innerHTML = allOrders().map((o) =>
        '<div class="row-list__item">' +
        '<div class="row-list__icon">' + svgIcon("gift", 20) + "</div>" +
        '<div class="row-list__body"><b>Redeemed ' + o.name + "</b><span>" + D.fmtDate(o.date) + "</span></div>" +
        '<div class="row-list__value is-neg tabular">−' + D.fmt.format(o.points) + " pts</div>" +
        "</div>"
      ).join("");
    }
  }

  /* ------------------------------------------------------------------
     Page: Orders
     ------------------------------------------------------------------ */
  function pageOrders() {
    const host = $("[data-orders]");
    if (!host) return;
    const searchEl = $("[data-order-search]");

    function render(q) {
      let rows = allOrders();
      if (q) rows = rows.filter((o) => (o.id + " " + o.name).toLowerCase().includes(q.toLowerCase()));
      if (!rows.length) {
        host.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink-3);padding:34px">No orders match.</td></tr>';
        return;
      }
      host.innerHTML = rows.map((o) => {
        const p = D.catalog.find((c) => c.id === o.productId);
        const art = p
          ? '<div class="cart-item__art product__art--' + CAT_META[p.cat].art + (p.img ? " product__art--photo" : "") +
            '" style="width:56px;height:42px;border-radius:10px">' + miniArt(p, 22) + "</div>"
          : "";
        const pill = o.status === "Confirmed"
          ? '<span class="pill-status pill-status--ok">Confirmed</span>'
          : '<span class="pill-status pill-status--pending">' + o.status + "</span>";
        return "<tr><td>" + art + '</td><td><span class="tabular" style="font-weight:550">' + o.id + "</span></td><td>" + o.name +
          "</td><td>" + D.fmtDate(o.date) + '</td><td class="num tabular">' + o.qty +
          '</td><td class="num tabular" style="font-weight:600">' + D.fmt.format(o.points) + "</td><td>" + pill + "</td></tr>";
      }).join("");
    }
    if (searchEl) searchEl.addEventListener("input", () => render(searchEl.value.trim()));
    render("");
  }

  /* ------------------------------------------------------------------
     Page: Cart
     ------------------------------------------------------------------ */
  function pageCart() {
    const listHost = $("[data-cart-list]");
    if (!listHost) return;
    // Drop cart rows for products no longer in the catalog.
    const valid = Cart.read().filter((i) => D.catalog.some((c) => c.id === i.id));
    if (valid.length !== Cart.read().length) Cart.write(valid);
    const layout = $("[data-cart-layout]");
    const emptyHost = $("[data-cart-empty]");
    const totalEl = $("[data-cart-total]");
    const remainEl = $("[data-cart-remaining]");
    const warnEl = $("[data-cart-warn]");
    const checkoutBtn = $("[data-checkout]");
    const successHost = $("[data-cart-success]");

    function render() {
      const items = Cart.read();
      const has = items.length > 0;
      if (layout) layout.hidden = !has;
      if (emptyHost) emptyHost.hidden = has;
      if (!has) return;

      listHost.innerHTML = items.map((row) => {
        const p = D.catalog.find((c) => c.id === row.id);
        if (!p) return "";
        return (
          '<div class="cart-item" data-row="' + p.id + '">' +
          '<div class="cart-item__art product__art--' + CAT_META[p.cat].art + (p.img ? " product__art--photo" : "") + '">' + miniArt(p, 30) + "</div>" +
          "<div><div class='cart-item__name'>" + p.name + "</div>" +
          '<div class="cart-item__meta">' + CAT_META[p.cat].label + " · " + D.fmt.format(p.points) + " pts each</div>" +
          '<div style="margin-top:10px;display:flex;align-items:center;gap:14px">' +
          '<div class="qty"><button data-dec="' + p.id + '" aria-label="Decrease quantity">−</button><output>' + row.qty + '</output><button data-inc="' + p.id + '" aria-label="Increase quantity">+</button></div>' +
          '<button class="link" style="font-size:.8125rem" data-remove="' + p.id + '">Remove</button>' +
          "</div></div>" +
          '<div class="cart-item__right"><div class="cart-item__points tabular">' + D.fmt.format(p.points * row.qty) + " pts</div></div>" +
          "</div>"
        );
      }).join("");

      const total = Cart.totalPoints();
      const remaining = D.account.availablePoints - total;
      if (totalEl) totalEl.textContent = D.fmt.format(total) + " pts";
      if (remainEl) {
        remainEl.textContent = (remaining >= 0 ? D.fmt.format(remaining) : "−" + D.fmt.format(-remaining)) + " pts";
        remainEl.style.color = remaining < 0 ? "var(--amber)" : "";
      }
      if (warnEl) warnEl.hidden = remaining >= 0;
      if (checkoutBtn) checkoutBtn.disabled = remaining < 0;
    }

    listHost.addEventListener("click", (e) => {
      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const rem = e.target.closest("[data-remove]");
      if (inc) Cart.setQty(inc.getAttribute("data-inc"), (Cart.read().find((i) => i.id === inc.getAttribute("data-inc")) || {}).qty + 1);
      if (dec) Cart.setQty(dec.getAttribute("data-dec"), (Cart.read().find((i) => i.id === dec.getAttribute("data-dec")) || {}).qty - 1);
      if (rem) { Cart.remove(rem.getAttribute("data-remove")); toast("Removed from cart"); }
      if (inc || dec || rem) render();
    });

    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", () => {
        const items = Cart.read();
        const today = new Date().toISOString().slice(0, 10);
        items.forEach((row) => {
          const p = D.catalog.find((c) => c.id === row.id);
          if (!p) return;
          LocalOrders.add({
            id: "ORD-" + Math.random().toString(16).slice(2, 12).toUpperCase(),
            productId: p.id, name: p.name, date: today, qty: row.qty,
            points: p.points * row.qty, status: "Processing",
          });
        });
        Cart.clear();
        if (layout) layout.hidden = true;
        if (successHost) successHost.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    render();
  }

  /* ------------------------------------------------------------------
     Page: Demo — hands-free animated walkthrough
     ------------------------------------------------------------------ */
  function pageDemo() {
    const shell = $(".demo-shell");
    if (!shell) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? Math.min(ms, 90) : ms));
    const state = { pending: 0, available: 0 };
    let running = false;

    const pendingEl = $("[data-demo-pending]");
    const availableEl = $("[data-demo-available]");
    const vidWrap = $("[data-demo-sqt]");
    const vid = $("[data-demo-vid]");
    const screen = $("[data-demo-screen]");
    /* Play the machine animation once; resolve on ended, with a hard
       fallback so the flow never stalls if playback is unavailable. */
    function playMachine() {
      if (!vid || reduce) return sleep(600);
      return new Promise((resolve) => {
        const dur = isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 4.8;
        const guard = setTimeout(resolve, dur * 1000 + 900);
        vid.onended = () => { clearTimeout(guard); resolve(); };
        try { vid.currentTime = 0; } catch (e) { /* not seekable yet */ }
        const p = vid.play();
        if (p && p.catch) p.catch(() => { clearTimeout(guard); setTimeout(resolve, 1200); });
      });
    }

    /* Real 12,000-pt catalog items the demo's 12,300+ pts can redeem */
    const DEMO_REWARDS = ["gc-amazon-100", "gc-apple", "gc-ubereats"]
      .map((id) => D.catalog.find((c) => c.id === id))
      .filter(Boolean)
      .map((p) => ({ id: p.id, name: p.name, pts: p.points, img: p.img, alt: p.imgAlt }));

    function syncBalances(bump) {
      pendingEl.textContent = D.fmt.format(state.pending);
      availableEl.textContent = D.fmt.format(state.available);
      if (bump) {
        [pendingEl, availableEl].forEach((el) => {
          const wrap = el.closest(".demo-balance");
          wrap.classList.remove("bump");
          void wrap.offsetWidth;
          wrap.classList.add("bump");
        });
      }
    }

    function goStep(n) {
      $$(".demo-step", shell).forEach((s) =>
        s.classList.toggle("is-active", s.getAttribute("data-demo-step") === String(n)));
      $$(".demo-dots span", shell).forEach((d) => {
        const i = Number(d.getAttribute("data-dot"));
        d.classList.toggle("is-on", i === n);
        d.classList.toggle("is-done", i < n);
      });
    }

    async function runSale() {
      const amount = 320 + Math.round(Math.random() * 40) * 10;
      const pts = Math.round(amount * 0.2);
      await sleep(700);
      await playMachine();
      screen.innerHTML = 'Approved <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg>';
      vidWrap.classList.add("is-ok");
      const chip = document.createElement("span");
      chip.className = "points-fly";
      chip.textContent = "+" + pts + " pts";
      chip.style.left = "50%";
      chip.style.top = "12%";
      $(".demo-stage", $('[data-demo-step="1"]')).appendChild(chip);
      setTimeout(() => chip.remove(), 1250);
      state.pending += pts;
      syncBalances(true);
      await sleep(1600);
      screen.textContent = "Ready";
      vidWrap.classList.remove("is-ok");
      await sleep(700);
    }

    /* A month of batches lands in Pending until the balance clears 10,000 pts */
    async function accumulateBatches() {
      const target = 12300 + Math.round(Math.random() * 8) * 100;
      const bucket = $("[data-bucket-pending-n]");
      const stage = $(".demo-stage", $('[data-demo-step="2"]'));
      while (state.pending < target) {
        const left = target - state.pending;
        const add = left <= 3200 ? left : Math.min(left, 1600 + Math.round(Math.random() * 1400));
        state.pending += add;
        bucket.textContent = D.fmt.format(state.pending);
        const chip = document.createElement("span");
        chip.className = "points-fly";
        chip.textContent = "+" + D.fmt.format(add) + " pts";
        chip.style.left = "25%";
        chip.style.top = "8%";
        stage.appendChild(chip);
        setTimeout(() => chip.remove(), 1250);
        syncBalances(false);
        await sleep(reduce ? 60 : 850);
      }
    }

    function animateSettle() {
      return new Promise((resolve) => {
        const flow = $("[data-demo-flow]");
        const moving = state.pending;
        for (let i = 0; i < 9; i++) {
          setTimeout(() => {
            const dot = document.createElement("i");
            flow.appendChild(dot);
            setTimeout(() => dot.remove(), 720);
          }, i * 160);
        }
        const start = performance.now();
        const dur = reduce ? 90 : 1550;
        const tick = (now) => {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          const moved = Math.round(moving * eased);
          $("[data-bucket-pending-n]").textContent = D.fmt.format(moving - moved);
          $("[data-bucket-avail-n]").textContent = D.fmt.format(state.available + moved);
          if (t < 1) requestAnimationFrame(tick);
          else {
            state.available += moving;
            state.pending = 0;
            syncBalances(true);
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    }

    function renderDemoRewards() {
      $("[data-demo-rewards]").innerHTML = DEMO_REWARDS.map((r) =>
        '<div class="demo-reward' + (r.pts > state.available ? " is-dim" : "") + '" data-reward="' + r.id + '">' +
        (r.img
          ? '<img class="demo-reward__img" src="' + r.img + '"' + (r.alt ? ' data-alt="' + r.alt + '"' : "") + ' alt="" loading="lazy" referrerpolicy="no-referrer">'
          : '<span class="demo-reward__icon">' + svgIcon("gift", 22) + "</span>") +
        "<b>" + r.name + "</b><span>" + D.fmt.format(r.pts) + " pts</span></div>"
      ).join("");
      $$(".demo-reward__img").forEach((img) => {
        img.addEventListener("error", () => {
          const alt = img.getAttribute("data-alt");
          if (alt && img.src !== alt) { img.src = alt; return; }
          const span = document.createElement("span");
          span.className = "demo-reward__icon";
          span.innerHTML = svgIcon("gift", 22);
          img.replaceWith(span);
        });
      });
    }

    function confettiBurst() {
      if (reduce) return;
      const colors = ["#1e88f7", "#35d07a", "#16255f", "#8ce6a1", "#ffd977"];
      for (let i = 0; i < 26; i++) {
        const c = document.createElement("i");
        c.className = "confetti";
        c.style.left = 8 + Math.random() * 84 + "%";
        c.style.background = colors[i % colors.length];
        c.style.animationDelay = Math.random() * 260 + "ms";
        c.style.animationDuration = 1100 + Math.random() * 700 + "ms";
        shell.appendChild(c);
        setTimeout(() => c.remove(), 2400);
      }
    }

    async function run() {
      if (running) return;
      running = true;

      // reset
      state.pending = 0;
      state.available = 0;
      syncBalances(false);
      vidWrap.classList.remove("is-ok");
      if (vid) { try { vid.pause(); vid.currentTime = 0; } catch (e) { /* fine */ } }
      screen.textContent = "Ready";
      $("[data-demo-finish]").hidden = true;
      $("[data-demo-copy3]").textContent = "";
      goStep(1);
      await sleep(1500);

      await runSale();
      await sleep(900);

      goStep(2);
      $("[data-bucket-pending-n]").textContent = D.fmt.format(state.pending);
      $("[data-bucket-avail-n]").textContent = D.fmt.format(state.available);
      await sleep(1200);
      await accumulateBatches();
      await sleep(900);
      await animateSettle();
      await sleep(1200);

      goStep(3);
      renderDemoRewards();
      await sleep(1800);
      const affordable = DEMO_REWARDS.filter((r) => r.pts <= state.available);
      const pick = affordable[affordable.length - 1] || DEMO_REWARDS[0];
      const el = $('[data-reward="' + pick.id + '"]');
      state.available -= pick.pts;
      syncBalances(true);
      el.classList.add("is-won");
      confettiBurst();
      $("[data-demo-copy3]").textContent =
        "Redeemed " + pick.name + "! In the real portal your reward ships or arrives by email — and you keep earning on every sale.";
      await sleep(500);
      $("[data-demo-finish]").hidden = false;

      running = false;
    }

    // Auto-start once the demo scrolls into view; replay re-runs it.
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      }, { threshold: 0.45 });
      io.observe(shell);
    } else {
      run();
    }
    $("[data-demo-restart]").addEventListener("click", () => run());

    syncBalances(false);
  }

  /* ------------------------------------------------------------------
     Page: Profile
     ------------------------------------------------------------------ */
  function pageProfile() {
    $$("[data-save-form]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        toast(form.getAttribute("data-save-form") || "Changes saved");
      });
    });
  }

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */
  function initThemeToggle() {
    const meta = $('meta[name="theme-color"]');
    const syncMeta = () => {
      if (meta) {
        meta.setAttribute(
          "content",
          document.documentElement.getAttribute("data-theme") === "dark" ? "#101013" : "#ffffff"
        );
      }
    };
    syncMeta();
    $$("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("wpi-theme", next); } catch (e) { /* private mode */ }
        syncMeta();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    safe(initHeader);
    safe(initThemeToggle);
    safe(() => renderCartBadge(false));
    safe(initPageTransitions);
    safe(bindAddButtons);

    const page = document.body.getAttribute("data-page");
    if (page === "dashboard") safe(pageDashboard);
    if (page === "catalog") safe(pageCatalog);
    if (page === "earnings") safe(pageEarnings);
    if (page === "orders") safe(pageOrders);
    if (page === "cart") safe(pageCart);
    if (page === "profile") safe(pageProfile);
    if (page === "demo") safe(pageDemo);

    // After page renderers, so dynamically inserted content is observed too.
    safe(initReveals);
    safe(initAccordions);
    safe(initCountups);

    // PWA: offline shell + installability (service workers need http/https).
    // updateViaCache "none" + explicit update() on resume keep installed
    // iOS home-screen apps from freezing on a stale version.
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker
        .register("sw.js?v=40", { updateViaCache: "none" })
        .then((reg) => {
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") reg.update().catch(() => {});
          });
        })
        .catch(() => {});
    }
  });
})();
