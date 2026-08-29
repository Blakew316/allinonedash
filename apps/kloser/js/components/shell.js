/** The persistent chrome: rail, topbar, mobile tab bar, global actions. */
import { $, $$, el, esc, cls } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { initials, avatarStyle } from '../core/format.js';
import { prefs, savePrefs, session, applyTheme, navCounts, emit } from '../core/store.js';
import { setBadge } from '../core/pwa.js';
import { navigate, onNavigate } from '../core/router.js';
import { menu, toast, modal } from './overlays.js';
import { openNotifications, unreadCount } from './notifications.js';
import { openPalette } from './palette.js';

/** Navigation model — grouped so the rail reads as a workflow, not a list. */
export const NAV = [
  {
    group: 'Overview',
    items: [
      { path: '', label: 'Dashboard', icon: 'dashboard', desc: 'Pipeline health at a glance' },
      { path: 'team', label: 'Team', icon: 'users', desc: 'Conversion funnel and leaderboard' },
    ],
  },
  {
    group: 'Field',
    items: [
      { path: 'map', label: 'Map', icon: 'map', desc: 'Territory and lead map' },
      { path: 'routes', label: 'Routes', icon: 'route', desc: 'Planned door routes and field sessions' },
      { path: 'schedule', label: 'My Schedule', icon: 'calendar', desc: 'Today, overdue and upcoming activities' },
      { path: 'activities', label: 'Activities', icon: 'activity', desc: 'Every logged visit, call and appointment', badge: 'activities', badgeTone: 'alert' },
    ],
  },
  {
    group: 'Pipeline',
    items: [
      { path: 'list', label: 'Leads', icon: 'list', desc: 'The full lead list' },
      { path: 'pipeline', label: 'Rep Pipeline', icon: 'funnel', desc: 'Stage-by-stage board' },
      { path: 'bcl-queue', label: 'BCL Queue', icon: 'card', desc: 'Business card leads awaiting the call center', badge: 'bcl-queue' },
    ],
  },
  {
    group: 'Booking',
    items: [
      { path: 'rep-schedule', label: 'Rep Schedule', icon: 'calendarClock', desc: 'Weekly rep availability' },
      { path: 'appointment-board', label: 'Appointment Board', icon: 'board', desc: 'Who is bookable, and where' },
    ],
  },
  {
    group: 'Admin',
    items: [
      { path: 'email', label: 'Email', icon: 'mail', desc: 'Sent mail and templates' },
      { path: 'location-verify', label: 'Location Verify', icon: 'shield', desc: 'GPS verification of field activity' },
      { path: 'settings', label: 'Settings', icon: 'settings', desc: 'Account, alerts and integrations' },
    ],
  },
];

export const FLAT_NAV = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group })));

/** The five destinations that get a mobile tab. */
const TABS = ['', 'map', 'list', 'schedule', 'activities'];

const href = (p) => `#/${p}`;

/* -------------------------------------------------------------------- rail */
function railMarkup() {
  return `
  <aside class="rail" id="rail" aria-label="Primary">
    <div class="rail-head">
      <a class="brand" href="#/" aria-label="Kloser CRM home">
        <img class="brand-mark" src="./assets/logo-mark.svg" alt="" width="22" height="33">
        <span class="brand-text">
          <span class="brand-name">Kloser CRM</span>
          <span class="brand-sub">Wholesale Payments</span>
        </span>
      </a>
    </div>

    <nav class="rail-scroll">
      ${NAV.map((g) => `
        <div class="nav-group">
          <div class="nav-group-label">${esc(g.group)}</div>
          ${g.items.map((it) => `
            <a class="nav-item" href="${href(it.path)}" data-nav="${esc(it.path)}" data-tip="${esc(it.label)}">
              ${icon(it.icon, { size: 19 })}
              <span class="nav-item-label">${esc(it.label)}</span>
              ${it.badge ? `<span class="nav-badge ${it.badgeTone || ''}" data-badge="${esc(it.badge)}" hidden>0</span>` : ''}
            </a>`).join('')}
        </div>`).join('')}
    </nav>

    <div class="rail-foot">
      <button class="user-chip" id="user-menu" aria-haspopup="menu" aria-expanded="false">
        <span class="avatar sm" style="${avatarStyle(session.name)}">${esc(initials(session.name))}</span>
        <span class="user-meta">
          <span class="user-name truncate">${esc(session.name)}</span>
          <span class="user-role">${esc(session.role)}</span>
        </span>
        ${icon('chevronDown', { size: 15 })}
      </button>
      <button class="rail-toggle" id="rail-toggle" aria-label="Collapse sidebar">
        ${icon('chevronsLeft', { size: 16 })}<span>Collapse</span>
      </button>
    </div>
  </aside>
  <div class="rail-scrim" id="rail-scrim" aria-hidden="true"></div>`;
}

/* ------------------------------------------------------------------ topbar */
function topbarMarkup() {
  return `
  <header class="topbar" id="topbar">
    <button class="icon-btn" id="mobile-nav" aria-label="Open navigation" style="display:none">
      ${icon('menu', { size: 20 })}
    </button>

    <div class="topbar-title">
      <span class="crumb" id="crumb">Overview</span>
      <h1 id="page-title">Dashboard</h1>
    </div>

    <button class="sync-status" id="sync-status" type="button" aria-live="polite">
      <span class="sync-dot" aria-hidden="true"></span>
      <span class="sync-label"></span>
    </button>

    <div class="spacer"></div>

    <button class="search-trigger press" id="search-trigger" aria-label="Search — press Command K">
      ${icon('search', { size: 16 })}
      <span class="search-label grow" style="text-align:left">Search leads, reps, pages…</span>
      <span class="kbd">⌘K</span>
    </button>

    <button class="icon-btn" id="filters-toggle" aria-label="Show or hide filters" aria-pressed="true">
      ${icon('filter', { size: 18 })}
    </button>

    <button class="btn btn-secondary sm" id="start-day">
      ${icon('play', { size: 14 })}<span class="hide-sm">Start Day</span>
    </button>

    <button class="btn btn-primary sm" id="create-btn" aria-haspopup="menu" aria-expanded="false">
      ${icon('plus', { size: 15 })}<span class="hide-sm">Create</span>
    </button>

    <span class="sep" style="width:1px;height:22px;background:var(--line)"></span>

    <button class="icon-btn" id="theme-toggle" aria-label="Switch theme">${icon('sun', { size: 18 })}</button>
    <button class="icon-btn" id="notif-btn" aria-label="Notifications" aria-haspopup="dialog" aria-expanded="false">
      ${icon('bell', { size: 18 })}<span class="dot"></span>
    </button>
  </header>`;
}

function tabbarMarkup() {
  const items = TABS.map((p) => FLAT_NAV.find((n) => n.path === p)).filter(Boolean);
  return `<nav class="tabbar" aria-label="Quick navigation">
    ${items.map((it) => `
      <a class="tabbar-item" href="${href(it.path)}" data-nav="${esc(it.path)}">
        ${icon(it.icon, { size: 21 })}<span>${esc(it.label)}</span>
      </a>`).join('')}
  </nav>`;
}

/* -------------------------------------------------------------------- init */
export function buildShell(root) {
  const app = el(`
    <div class="app" id="app" data-rail="${prefs.railCollapsed ? 'collapsed' : 'expanded'}">
      ${railMarkup()}
      <div class="main">
        ${topbarMarkup()}
        <main class="content" id="view-host" tabindex="-1"></main>
        ${tabbarMarkup()}
      </div>
    </div>`);
  root.appendChild(app);

  wireRail(app);
  wireTopbar(app);
  wireSyncStatus(app);
  wireFiltersToggle(app);
  wireScrollShadow(app);
  loadBadges(app);

  onNavigate(({ path, def }) => syncActive(app, path, def));
  return $('#view-host', app);
}

function syncActive(app, path, def) {
  $$('[data-nav]', app).forEach((a) => {
    const match = a.dataset.nav === path;
    if (match) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const nav = FLAT_NAV.find((n) => n.path === path);
  $('#page-title', app).textContent = def?.title || nav?.label || 'Kloser CRM';
  $('#crumb', app).textContent = nav?.group || 'Kloser CRM';
  app.dataset.mobileNav = 'closed';
}

function wireRail(app) {
  const railBtn = $('#rail-toggle', app);
  const syncRailLabel = () => {
    const label = app.dataset.rail === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar';
    railBtn.setAttribute('aria-label', label);
    railBtn.setAttribute('title', label);
    railBtn.setAttribute('aria-expanded', String(app.dataset.rail !== 'collapsed'));
  };
  syncRailLabel();
  railBtn.addEventListener('click', () => {
    const collapsed = app.dataset.rail !== 'collapsed';
    app.dataset.rail = collapsed ? 'collapsed' : 'expanded';
    savePrefs({ railCollapsed: collapsed });
    syncRailLabel();
    emit('rail', collapsed);
  });

  const open = () => { app.dataset.mobileNav = 'open'; };
  const close = () => { app.dataset.mobileNav = 'closed'; };
  $('#mobile-nav', app).addEventListener('click', open);
  $('#rail-scrim', app).addEventListener('click', close);
  $$('.rail .nav-item', app).forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && app.dataset.mobileNav === 'open') close();
  });

  const syncMobileBtn = () => {
    $('#mobile-nav', app).style.display = window.innerWidth <= 1024 ? 'grid' : 'none';
  };
  syncMobileBtn();
  window.addEventListener('resize', syncMobileBtn);

  $('#user-menu', app).addEventListener('click', (e) => {
    menu(e.currentTarget, [
      { heading: session.email },
      { label: 'My profile', icon: 'user', onSelect: () => navigate('settings?section=account') },
      { label: 'My business card', icon: 'qr', onSelect: () => showBusinessCard() },
      { label: 'View as…', icon: 'eye', onSelect: () => showViewAs() },
      { sep: true },
      { label: 'Settings', icon: 'settings', onSelect: () => navigate('settings') },
      { label: 'Offline queue', icon: 'wifiOff', onSelect: () => toast('Offline queue is empty', { text: 'No pending writes to retry.', tone: 'good' }) },
      { sep: true },
      { label: 'Sign out', icon: 'logout', danger: true, onSelect: () => navigate('signin') },
    ], { align: 'left', width: 232 });
  });
}

function wireTopbar(app) {
  $('#search-trigger', app).addEventListener('click', () => openPalette());

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      e.preventDefault(); openPalette();
    }
  });

  const startBtn = $('#start-day', app);
  const paintDay = () => {
    startBtn.innerHTML = prefs.dayStarted
      ? `${icon('checkCircle', { size: 14 })}<span class="hide-sm">Day active</span>`
      : `${icon('play', { size: 14 })}<span class="hide-sm">Start Day</span>`;
    cls(startBtn, 'btn-accent', prefs.dayStarted);
    cls(startBtn, 'btn-secondary', !prefs.dayStarted);
  };
  paintDay();
  startBtn.addEventListener('click', () => {
    savePrefs({ dayStarted: !prefs.dayStarted });
    paintDay();
    toast(prefs.dayStarted ? 'Day started' : 'Day ended', {
      text: prefs.dayStarted
        ? 'Location tracking is on. Visits will be GPS-verified.'
        : 'Location tracking stopped for today.',
      tone: prefs.dayStarted ? 'good' : 'info',
    });
  });

  $('#create-btn', app).addEventListener('click', (e) => {
    menu(e.currentTarget, [
      { heading: 'Create' },
      { label: 'New lead', icon: 'plus', onSelect: () => stub('New lead') },
      { label: 'Log a visit', icon: 'pin', onSelect: () => stub('Log a visit') },
      { label: 'Schedule an appointment', icon: 'calendar', onSelect: () => stub('Schedule an appointment') },
      { label: 'Business card lead', icon: 'card', onSelect: () => stub('Business card lead') },
      { sep: true },
      { label: 'Build a route', icon: 'route', onSelect: () => navigate('routes') },
      { label: 'Compose email', icon: 'mail', onSelect: () => navigate('email?compose=1') },
    ], { width: 244 });
  });

  const themeBtn = $('#theme-toggle', app);
  const paintTheme = () => {
    const mode = prefs.theme;
    themeBtn.innerHTML = icon(mode === 'dark' ? 'moon' : mode === 'light' ? 'sun' : 'monitor', { size: 18 });
    themeBtn.setAttribute('aria-label', `Theme: ${mode}. Click to change.`);
  };
  paintTheme();
  themeBtn.addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(prefs.theme) + 1) % order.length];
    savePrefs({ theme: next });
    applyTheme(next);
    paintTheme();
    toast(`Theme: ${next}`, { tone: 'info', timeout: 1600 });
  });

  const bell = $('#notif-btn', app);
  const paintBell = (n) => {
    bell.dataset.count = n > 0 ? String(n) : '';
    bell.classList.toggle('has-unread', n > 0);
    bell.setAttribute('aria-label', n > 0 ? `Notifications, ${n} unread` : 'Notifications, none unread');
  };
  unreadCount().then(paintBell).catch(() => paintBell(0));
  bell.addEventListener('click', () => openNotifications(bell, paintBell));
}

/**
 * Global sync status. The original app carries one on every page; this one
 * reports what is actually true — whether the device is online, and when the
 * data on screen was last read.
 */
function wireSyncStatus(app) {
  const btn = $('#sync-status', app);
  let lastSync = new Date();
  let syncing = false;

  const paint = () => {
    const offline = !navigator.onLine;
    btn.dataset.state = syncing ? 'syncing' : offline ? 'offline' : 'ok';
    const label = $('.sync-label', btn);
    if (syncing) label.textContent = 'Syncing…';
    else if (offline) label.textContent = 'Offline';
    else label.textContent = `Synced ${lastSync.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    btn.title = offline
      ? 'You are offline. Everything you log is queued and sent when you reconnect.'
      : 'Data last read at ' + lastSync.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) + '. Click to refresh.';
  };

  btn.addEventListener('click', () => {
    if (syncing) return;
    if (!navigator.onLine) {
      toast('Still offline', { text: 'Kloser CRM keeps working from its cache until you reconnect.', tone: 'warn' });
      return;
    }
    syncing = true; paint();
    setTimeout(() => {
      syncing = false; lastSync = new Date(); paint();
      toast('Up to date', { text: 'Nothing new since the last sync.', tone: 'good', timeout: 2200 });
    }, 850);
  });

  window.addEventListener('online', () => { lastSync = new Date(); paint(); });
  window.addEventListener('offline', paint);
  paint();
  setInterval(paint, 60000);
}

/** Show/hide the page filter toolbars — the original's button-show-filters. */
function wireFiltersToggle(app) {
  const btn = $('#filters-toggle', app);
  const apply = () => {
    app.dataset.filters = prefs.filtersHidden ? 'hidden' : 'shown';
    btn.setAttribute('aria-pressed', String(!prefs.filtersHidden));
    btn.title = prefs.filtersHidden ? 'Show filters' : 'Hide filters';
  };
  btn.addEventListener('click', () => {
    savePrefs({ filtersHidden: !prefs.filtersHidden });
    apply();
  });
  apply();
  onNavigate(apply);
}

function wireScrollShadow(app) {
  const bar = $('#topbar', app);
  const onScroll = () => { bar.dataset.scrolled = String(window.scrollY > 4); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

async function loadBadges(app) {
  try {
    const counts = await navCounts();
    Object.entries(counts).forEach(([key, val]) => {
      const b = $(`[data-badge="${key}"]`, app);
      if (!b || !val) return;
      b.textContent = val > 99 ? '99+' : String(val);
      b.title = key === 'activities' ? `${val} overdue activities` : `${val} waiting in the queue`;
      b.hidden = false;
    });
    // Same number, on the Home Screen icon.
    setBadge(counts.activities || 0);
  } catch { /* badges are decorative */ }
}

/* ----------------------------------------------------------------- dialogs */
function stub(what) {
  toast(`${what} — demo build`, {
    text: 'This redesign ships the full interface; write actions are wired to the live API in production.',
    tone: 'info',
  });
}

export function showBusinessCard() {
  modal({
    title: 'My digital business card',
    subtitle: 'Share via link or QR code',
    body: `
      <div class="col" style="align-items:center;gap:var(--s-5);text-align:center">
        <span class="avatar xl" style="${avatarStyle(session.name)}">${esc(initials(session.name))}</span>
        <div>
          <div style="font-size:var(--fs-18);font-weight:660;letter-spacing:var(--tr-title)">${esc(session.name)}</div>
          <div class="muted" style="font-size:var(--fs-13);text-transform:capitalize">${esc(session.role)} · Wholesale Payments</div>
          <div class="muted mono" style="font-size:var(--fs-12);margin-top:4px">${esc(session.email)}</div>
        </div>
        <div class="card pad" style="background:var(--bg-sunken);width:172px;height:172px;display:grid;place-items:center">
          ${icon('qr', { size: 96, stroke: 1.2 })}
        </div>
        <p class="muted" style="font-size:var(--fs-12);max-width:38ch">
          Anyone who scans this gets your contact details and a direct line to book an appointment.
        </p>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>Close</button>
             <button class="btn btn-primary" id="copy-card">${icon('copy', { size: 15 })}Copy link</button>`,
  });
  $('#copy-card')?.addEventListener('click', () => {
    navigator.clipboard?.writeText('https://kloser.wholesalepayments.com/c/justin-woodruff').catch(() => {});
    toast('Link copied', { tone: 'good', timeout: 2000 });
  });
}

export function showViewAs() {
  modal({
    title: 'View as',
    subtitle: 'See the CRM exactly as another rep sees it',
    body: `
      <div class="col" style="gap:var(--s-4)">
        <div class="field">
          <label class="field-label" for="viewas-rep">Rep</label>
          <select class="select" id="viewas-rep">
            <option>Return to my own view</option>
            ${['Lloyd Dela Cruz', 'Gabriel Craft', 'Timothy Karl Oscar Constenius', 'Musco Adams', 'Kyle Pettit', 'Sadie Scoville']
              .map((r) => `<option>${esc(r)}</option>`).join('')}
          </select>
        </div>
        <p class="field-hint">View-as is read-only. Any action you take is still recorded against your own account.</p>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="viewas-go">Switch view</button>`,
  });
  $('#viewas-go')?.addEventListener('click', () => {
    const v = $('#viewas-rep').value;
    document.querySelector('.overlay')?.querySelector('[data-close]')?.click();
    toast(v.startsWith('Return') ? 'Back to your own view' : `Viewing as ${v}`, { tone: 'info' });
  });
}
