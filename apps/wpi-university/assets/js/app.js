/* ==========================================================================
   WPI University — application shell
   Renders the shared chrome (nav, drawer, command palette, footer) and wires
   up every motion primitive the pages rely on.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.WPI || {};
  var App = {};
  window.App = App;

  /* ---------------------------------------------------------------- icons */
  var ICONS = {
    home:      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/>',
    book:      '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H19v3H5.5A1.5 1.5 0 0 1 4 19.5z"/>',
    users:     '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16.5 5.6a3.2 3.2 0 0 1 0 6.3"/><path d="M17.5 14.6A5.5 5.5 0 0 1 20.5 20"/>',
    chart:     '<path d="M4 20V9"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    gear:      '<circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    search:    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    play:      '<path d="M8 5.5v13l11-6.5z"/>',
    check:     '<path d="m4.5 12.5 5 5 10-11"/>',
    chevron:   '<path d="m9 5 7 7-7 7"/>',
    chevronDown:'<path d="m5 9 7 7 7-7"/>',
    arrow:     '<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>',
    plus:      '<path d="M12 5v14"/><path d="M5 12h14"/>',
    user:      '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    logout:    '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 8 6 12l4 4"/><path d="M6 12h9"/>',
    sun:       '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
    moon:      '<path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2"/>',
    menu:      '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    close:     '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    doc:       '<path d="M13 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8.5z"/><path d="M13 3v5.5h5.5"/>',
    quiz:      '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4"/><path d="M12 17h.01"/>',
    download:  '<path d="M12 4v10"/><path d="m7.5 10 4.5 4.5 4.5-4.5"/><path d="M5 19h14"/>',
    award:     '<circle cx="12" cy="9" r="5.2"/><path d="m8.6 13.4-1.2 7 4.6-2.6 4.6 2.6-1.2-7"/>',
    layers:    '<path d="m12 3 8.5 4.5L12 12 3.5 7.5z"/><path d="m3.5 12.4 8.5 4.5 8.5-4.5"/><path d="m3.5 16.9 8.5 4.5 8.5-4.5"/>',
    mail:      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.6 6.5 8.4 6 8.4-6"/>',
    key:       '<circle cx="8" cy="14" r="4.5"/><path d="m11.4 11.2 8-8"/><path d="m16.5 6.2 2 2"/><path d="m19 3.6 2 2"/>',
    shield:    '<path d="M12 3 5 6v5.5c0 4.4 2.9 8 7 9.5 4.1-1.5 7-5.1 7-9.5V6z"/>',
    clock:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.3 2"/>',
    sparkles:  '<path d="M12 3.5 13.6 9 19 10.6 13.6 12.2 12 17.7 10.4 12.2 5 10.6 10.4 9z"/><path d="M18.5 16.5 19.2 19 21.5 19.7 19.2 20.4 18.5 22.9 17.8 20.4 15.5 19.7 17.8 19z"/>',
    grid:      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    flag:      '<path d="M5.5 21V4"/><path d="M5.5 5h11l-2 3.5 2 3.5h-11"/>',

    /* The proposal's three sections, drawn to read at 18px: who the merchant is,
       what their current statement says, and what we would put them on. */
    storefront:'<path d="M3.4 9.3 5.6 4.2h12.8l2.2 5.1"/>' +
               '<path d="M3.4 9.3a2.15 2.15 0 0 0 4.3 0 2.15 2.15 0 0 0 4.3 0 ' +
                        'a2.15 2.15 0 0 0 4.3 0 2.15 2.15 0 0 0 4.3 0"/>' +
               '<path d="M5.3 11.5V20.5h13.4V11.5"/>' +
               '<path d="M9.8 20.5v-4.8h4.4v4.8"/>',
    receipt:   '<path d="M5.6 5.1A1.6 1.6 0 0 1 7.2 3.5h9.6a1.6 1.6 0 0 1 1.6 1.6v14.5' +
                        'l-2.13 1.2-2.14-1.2-2.13 1.2-2.14-1.2-2.13 1.2-2.14-1.2z"/>' +
               '<path d="M8.5 8.4h7"/><path d="M8.5 11.8h7"/><path d="M8.5 15.2h4.3"/>',
    tag:       '<path d="M10.9 3.2H19A1.6 1.6 0 0 1 20.6 4.8v8.1a1.6 1.6 0 0 1-.47 1.13' +
                        'l-6.9 6.9a1.6 1.6 0 0 1-2.26 0l-8.1-8.1a1.6 1.6 0 0 1 0-2.26' +
                        'l6.9-6.9A1.6 1.6 0 0 1 10.9 3.2Z"/>' +
               '<circle cx="16.1" cy="7.7" r="1.5"/>'
  };

  /* The logo is split into its mark and its wordmark so the bars keep their own
     colour on a dark background while the navy wordmark flips to white. */
  App.logo = function (h) {
    h = h || 26;
    return '<span class="logo-lockup" style="--logo-h:' + h + 'px">' +
      '<img class="logo-mark" src="assets/img/wholesale-payments-mark.png" alt="" ' +
        'width="' + Math.round(h * 0.6651) + '" height="' + h + '">' +
      '<img class="logo-word" src="assets/img/wholesale-payments-wordmark.png" alt="Wholesale Payments" ' +
        'width="' + Math.round(h * 3.2202) + '" height="' + h + '">' +
    '</span>';
  };

  /* The logo's bar mark, redrawn as SVG at the source artwork's own geometry:
     a 145x218 crop of the supplied logo, measured rect by rect. Three shapes,
     not three equal bars — the middle one is wider and banded blue/green/mint,
     and the outer two sit on different baselines. */
  var markSeq = 0;
  /* Each band carries a slight vertical gradient in the source art, so flat
     fills read a shade off. Endpoints are sampled from the artwork itself. */
  var MARK_BANDS = [
    ['b1', 2,   167, '#0192e5', '#008de5'],
    ['bl', 2,   48,  '#01a2e6', '#009be8'],
    ['gr', 50,  119, '#00cb7c', '#04be6a'],
    ['mi', 169, 48,  '#4ee572', '#4de56e'],
    ['b3', 50,  166, '#50e77c', '#4de777']
  ];

  App.mark = function (h, opts) {
    h = h || 22;
    opts = opts || {};
    var uid = 'm' + (++markSeq);
    var defs = MARK_BANDS.map(function (b) {
      return '<linearGradient id="' + uid + b[0] + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + b[3] + '"/>' +
        '<stop offset="1" stop-color="' + b[4] + '"/></linearGradient>';
    }).join('');
    var f = function (k) { return 'url(#' + uid + k + ')'; };

    return '<span class="mark' + (opts.still ? ' mark-static' : '') + '"' +
        ' style="--mark-h:' + h + 'px" aria-hidden="true">' +
        '<svg viewBox="0 0 145 218" height="' + h + '" width="' + (h * 0.6651).toFixed(1) + '">' +
          '<defs>' + defs + '</defs>' +
          '<g class="mark-b1"><rect x="2" y="2" width="22" height="167" rx="3" fill="' + f('b1') + '"/></g>' +
          /* Bands overlap by the corner radius so only the mark's outer
             corners round; the internal seams stay flat, as in the artwork. */
          '<g class="mark-b2">' +
            '<rect x="42" y="2"   width="62" height="50"  rx="3" fill="' + f('bl') + '"/>' +
            '<rect x="42" y="50"  width="62" height="121"        fill="' + f('gr') + '"/>' +
            '<rect x="42" y="169" width="62" height="48"  rx="3" fill="' + f('mi') + '"/>' +
          '</g>' +
          '<g class="mark-b3"><rect x="122" y="50" width="23" height="166" rx="3" fill="' + f('b3') + '"/></g>' +
        '</svg>' +
      '</span>';
  };

  App.icon = function (name, cls) {
    var p = ICONS[name] || '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  };

  /* -------------------------------------------------------------- helpers */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  App.esc = esc;

  App.param = function (k) {
    return new URLSearchParams(location.search).get(k);
  };

  App.course = function (slug) {
    return (D.courses || []).filter(function (c) { return c.slug === slug; })[0] || null;
  };

  App.fmtMinutes = function (m) {
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + ' hr ' + r + ' min' : h + ' hr';
  };

  App.trackTile = function (track) {
    return { Certification: 'navy', Foundations: 'blue', Selling: 'green', Tools: 'mint' }[track] || '';
  };
  App.trackIcon = function (track) {
    return { Certification: 'award', Foundations: 'layers', Selling: 'sparkles', Tools: 'grid' }[track] || 'book';
  };

  /* ---------------------------------------------------------------- theme */
  var THEME_KEY = 'wpi-theme';

  /* The tab icon is the logo's bar mark on the same measured geometry, with
     no backing plate so the tab strip shows through.

     assets/img/favicon.svg carries a prefers-color-scheme rule, which only
     tracks the OS. This site has its own toggle that can disagree with it,
     so the icon is repainted from the theme actually in effect. */
  var FAVICON = {
    light: ['#0095e5', '#00a1e5', '#01c271', '#4fe778', '#50e87b'],
    dark:  ['#29b0f0', '#33b6f2', '#17d989', '#6cf08f', '#6df092']
  };

  function faviconSVG(theme) {
    var c = FAVICON[theme] || FAVICON.light;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-36.5 0 218 218">' +
      '<rect fill="' + c[0] + '" x="2"   y="2"   width="22" height="167" rx="3"/>' +
      '<rect fill="' + c[1] + '" x="42"  y="2"   width="62" height="50"  rx="3"/>' +
      '<rect fill="' + c[2] + '" x="42"  y="50"  width="62" height="121"/>' +
      '<rect fill="' + c[3] + '" x="42"  y="169" width="62" height="48"  rx="3"/>' +
      '<rect fill="' + c[4] + '" x="122" y="50"  width="23" height="166" rx="3"/>' +
    '</svg>';
  }

  function paintFavicon(theme) {
    var link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(faviconSVG(theme));
  }

  App.setTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.innerHTML = App.icon(t === 'dark' ? 'sun' : 'moon');
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance');
    });
    paintFavicon(t);
    /* The browser chrome around the tab follows this. */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#07080f' : '#ffffff');
  };
  App.toggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    App.setTheme(cur === 'dark' ? 'light' : 'dark');
  };

  /* ------------------------------------------------------------ nav model */
  var NAV = [
    { href: 'index.html',    label: 'Dashboard', key: 'dashboard', icon: 'home' },
    { href: 'training.html', label: 'Training',  key: 'training',  icon: 'book' },
    { href: 'people.html',   label: 'People',    key: 'people',    icon: 'users' },
    { href: 'reports.html',  label: 'Reports',   key: 'reports',   icon: 'chart' },
    { href: 'admin.html',    label: 'Admin',     key: 'admin',     icon: 'gear' }
  ];

  function activeKey() {
    return document.body.getAttribute('data-page') || 'dashboard';
  }

  /* ----------------------------------------------------------- shell HTML */
  function buildNav() {
    var act = activeKey();
    var admin = (D.org && D.org.admin) || { initials: 'JW', name: '', email: '' };

    var links = NAV.map(function (n) {
      return '<a class="nav-link" href="' + n.href + '"' +
             (n.key === act ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
    }).join('');

    var menuItems = [
      ['profile.html', 'user', 'Profile'],
      ['settings.html', 'gear', 'Settings'],
      ['invite.html', 'mail', 'Invite a rep']
    ].map(function (m) {
      return '<a class="menu-item" href="' + m[0] + '">' + App.icon(m[1]) + esc(m[2]) + '</a>';
    }).join('');

    return '' +
      '<nav class="nav" id="siteNav">' +
        '<div class="wrap">' +
          '<a class="brand" href="index.html" aria-label="WPI University home">' +
            App.logo(26) +
            '<span class="brand-divider"></span>' +
            '<span class="brand-sub">University</span>' +
          '</a>' +
          '<div class="nav-links">' + links + '</div>' +
          '<div class="nav-actions">' +
            '<button class="search-trigger" data-palette-open aria-label="Search courses, lessons and people">' +
              App.icon('search') +
              '<span>Search</span><span class="spacer"></span><kbd>⌘K</kbd>' +
            '</button>' +
            '<button class="icon-btn" data-theme-toggle></button>' +
            '<div class="usermenu">' +
              '<button class="avatar" data-menu-toggle aria-haspopup="true" aria-expanded="false">' + esc(admin.initials) + '</button>' +
              '<div class="menu" id="userMenu" role="menu">' +
                '<div class="menu-head">' +
                  '<div class="small strong">' + esc(admin.name) + '</div>' +
                  '<div class="tiny faint truncate">' + esc(admin.email) + '</div>' +
                '</div>' +
                menuItems +
                '<hr class="hairline" style="margin:4px 0">' +
                '<a class="menu-item" href="index.html">' + App.icon('logout') + 'Log out</a>' +
              '</div>' +
            '</div>' +
            '<button class="icon-btn nav-toggle" data-drawer-open aria-label="Open menu">' + App.icon('menu') + '</button>' +
          '</div>' +
        '</div>' +
      '</nav>' +
      '<div class="scroll-progress" id="scrollProgress"></div>' +
      '<div class="net-status" id="netStatus" role="status" hidden></div>';
  }

  function buildDrawer() {
    var act = activeKey();
    var links = NAV.map(function (n) {
      return '<a class="drawer-link" href="' + n.href + '"' + (n.key === act ? ' aria-current="page"' : '') + '>' +
             App.icon(n.icon) + esc(n.label) + '</a>';
    }).join('');
    return '' +
      '<div class="drawer" id="drawer">' +
        '<div class="drawer-scrim" data-drawer-close></div>' +
        '<div class="drawer-panel" role="dialog" aria-label="Menu">' +
          '<div class="row-between" style="margin-bottom:12px">' +
            App.mark(22) +
            '<button class="icon-btn" data-drawer-close aria-label="Close menu">' + App.icon('close') + '</button>' +
          '</div>' +
          links +
          '<hr class="hairline" style="margin:12px 0">' +
          '<a class="drawer-link" href="proposal.html">' + App.icon('doc') + 'Proposal generator</a>' +
          '<a class="drawer-link" href="settings.html">' + App.icon('gear') + 'Settings</a>' +
          '<a class="drawer-link" href="profile.html">' + App.icon('user') + 'Profile</a>' +
          '<a class="drawer-link" href="invite.html">' + App.icon('mail') + 'Invite a rep</a>' +
          '<button class="drawer-link" data-palette-open style="border:0;background:none;width:100%;cursor:pointer">' +
            App.icon('search') + 'Search</button>' +
        '</div>' +
      '</div>';
  }

  function buildPalette() {
    return '' +
      '<div class="palette" id="palette" role="dialog" aria-modal="true" aria-label="Search">' +
        '<div class="palette-scrim" data-palette-close></div>' +
        '<div class="palette-box">' +
          '<div class="palette-input-row">' +
            App.icon('search') +
            '<input class="palette-input" id="paletteInput" type="text" autocomplete="off" spellcheck="false" ' +
              'placeholder="Search courses, lessons, people and pages…" aria-label="Search">' +
            '<kbd>esc</kbd>' +
          '</div>' +
          '<div class="palette-results" id="paletteResults"></div>' +
          '<div class="palette-foot">' +
            '<span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>' +
            '<span><kbd>↵</kbd> open</span>' +
            '<span class="spacer"></span>' +
            App.mark(12, { still: true }) +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="toast-wrap" id="toasts"></div>';
  }

  function buildFooter() {
    var cols = [
      ['Training', [['training.html', 'All courses'], ['training.html?track=Certification', 'Certification'], ['training.html?track=Foundations', 'Foundations'], ['training.html?track=Selling', 'Selling']]],
      ['Team', [['people.html', 'People'], ['teams.html', 'Sales teams'], ['invite.html', 'Invite a rep'], ['reports.html', 'Reports']]],
      ['Selling', [['proposal.html', 'Proposal generator'], ['pricing.html#passthrough', 'Passthrough rates'], ['pricing.html#margins', 'Margin adjustments'], ['learning-plans.html', 'Learning plans']]],
      ['Admin', [['admin.html', 'Admin'], ['settings.html#appearance', 'Appearance'], ['settings.html#api', 'API keys'], ['settings.html#billing', 'Billing']]]
    ].map(function (c) {
      return '<div><div class="footer-col-title">' + esc(c[0]) + '</div>' +
        c[1].map(function (l) { return '<a href="' + l[0] + '">' + esc(l[1]) + '</a>'; }).join('') + '</div>';
    }).join('');

    return '' +
      '<footer class="footer">' +
        '<div class="wrap wrap-wide">' +
          '<div class="footer-inner">' +
            '<div>' +
              App.logo(24) +
              '<p class="small muted" style="margin-top:14px;max-width:34ch">' +
                'The training platform behind every Wholesale Payments rep — courses, certification and team progress in one place.' +
              '</p>' +
              '<div class="row gap-sm" style="margin-top:16px">' +
                '<span class="dot dot-blue"></span><span class="dot dot-green"></span><span class="dot dot-mint"></span>' +
              '</div>' +
            '</div>' + cols +
          '</div>' +
          '<div class="footer-bottom">' +
            '<span>© ' + new Date().getFullYear() + ' Wholesale Payments. All rights reserved.</span>' +
            '<span class="row gap-sm"><span class="dot dot-green dot-live"></span> All systems operational</span>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  /* ------------------------------------------------------- search corpus */
  function corpus() {
    var items = [];
    NAV.forEach(function (n) {
      items.push({ t: n.label, s: 'Page', href: n.href, icon: n.icon, tone: 'navy', g: 'Pages' });
    });
    [['Invite a rep', 'invite.html', 'mail'], ['Profile', 'profile.html', 'user'],
     ['Sales teams', 'teams.html', 'flag'], ['Settings', 'settings.html', 'gear'],
     ['Proposal generator', 'proposal.html', 'doc'], ['Pricing', 'pricing.html', 'chart'],
     ['Margin adjustment types', 'pricing.html#margins', 'layers'],
     ['Merchant type passthrough rates', 'pricing.html#passthrough', 'chart'],
     ['Learning plans', 'learning-plans.html', 'award'],
     ['Create custom courses', 'learning-plans.html#courses', 'book'],
     ['Billing', 'settings.html#billing', 'doc'], ['API keys', 'settings.html#api', 'key'],
     ['Single sign-on', 'settings.html#sso', 'shield'],
     ['Offline downloads', 'settings.html#offline', 'download']]
      .forEach(function (p) { items.push({ t: p[0], s: 'Page', href: p[1], icon: p[2], tone: 'navy', g: 'Pages' }); });

    (D.courses || []).forEach(function (c) {
      items.push({ t: c.title, s: c.track + ' · ' + c.lessons.length + ' lessons', href: 'course.html?c=' + c.slug,
                   icon: App.trackIcon(c.track), tone: 'green', g: 'Courses' });
      c.lessons.forEach(function (l, i) {
        items.push({ t: l.t, s: c.title, href: 'lesson.html?c=' + c.slug + '&l=' + i,
                     icon: l.k === 'quiz' ? 'quiz' : (l.k === 'download' ? 'download' : 'play'), tone: '', g: 'Lessons' });
      });
    });
    (D.people || []).forEach(function (p) {
      items.push({ t: p.name, s: p.team + ' · ' + p.email, href: 'people.html?q=' + encodeURIComponent(p.name),
                   icon: 'user', tone: 'navy', g: 'People' });
    });
    return items;
  }

  var CORPUS = null, paletteIdx = 0, paletteHits = [];

  function score(item, q) {
    var t = item.t.toLowerCase(), s = (item.s || '').toLowerCase();
    if (t === q) return 1000;
    if (t.indexOf(q) === 0) return 800 - t.length;
    var i = t.indexOf(q);
    if (i > 0) return 600 - i - t.length * 0.1;
    if (s.indexOf(q) >= 0) return 300 - s.indexOf(q) * 0.1;
    // subsequence match, so "hrps" finds "How to Read a Processing Statement"
    var qi = 0;
    for (var k = 0; k < t.length && qi < q.length; k++) if (t[k] === q[qi]) qi++;
    return qi === q.length ? 120 - t.length * 0.05 : -1;
  }

  var GROUP_ORDER = ['Pages', 'Courses', 'Lessons', 'People'];
  /* A course is a better landing spot than any one of its lessons, so nudge it up. */
  var GROUP_BIAS = { Pages: 40, Courses: 34, Lessons: 0, People: 12 };

  function renderPalette(q) {
    var box = document.getElementById('paletteResults');
    if (!box) return;
    CORPUS = CORPUS || corpus();
    q = (q || '').trim().toLowerCase();

    if (!q) {
      paletteHits = CORPUS.filter(function (i) { return i.g === 'Pages'; })
        .concat((D.courses || []).slice(0, 5).map(function (c) {
          return { t: c.title, s: c.track + ' · ' + c.lessons.length + ' lessons', href: 'course.html?c=' + c.slug,
                   icon: App.trackIcon(c.track), tone: 'green', g: 'Jump back in' };
        }));
    } else {
      paletteHits = CORPUS
        .map(function (i) {
          var sc = score(i, q);
          return { i: i, sc: sc > 0 ? sc + (GROUP_BIAS[i.g] || 0) : sc };
        })
        .filter(function (r) { return r.sc > 0; })
        .sort(function (a, b) {
          if (b.sc !== a.sc) return b.sc - a.sc;
          return GROUP_ORDER.indexOf(a.i.g) - GROUP_ORDER.indexOf(b.i.g);
        })
        .slice(0, 24)
        .map(function (r) { return r.i; });
    }

    if (!paletteHits.length) {
      box.innerHTML = '<div class="palette-empty">Nothing matches “' + esc(q) + '”.</div>';
      return;
    }

    paletteIdx = 0;
    var html = '', lastGroup = null;
    paletteHits.forEach(function (it, n) {
      if (it.g !== lastGroup) {
        html += '<div class="palette-group eyebrow">' + esc(it.g) + '</div>';
        lastGroup = it.g;
      }
      html += '<a class="palette-item" role="option" data-idx="' + n + '" href="' + it.href + '"' +
              (n === 0 ? ' aria-selected="true"' : '') + '>' +
                '<span class="pi-icon ' + (it.tone || '') + '">' + App.icon(it.icon) + '</span>' +
                '<span style="min-width:0">' +
                  '<span class="pi-title truncate" style="display:block">' + esc(it.t) + '</span>' +
                  '<span class="pi-sub truncate" style="display:block">' + esc(it.s) + '</span>' +
                '</span>' +
              '</a>';
    });
    box.innerHTML = html;
  }

  function moveSelection(delta) {
    var nodes = document.querySelectorAll('.palette-item');
    if (!nodes.length) return;
    nodes[paletteIdx] && nodes[paletteIdx].removeAttribute('aria-selected');
    paletteIdx = (paletteIdx + delta + nodes.length) % nodes.length;
    var el = nodes[paletteIdx];
    el.setAttribute('aria-selected', 'true');
    el.scrollIntoView({ block: 'nearest' });
  }

  App.openPalette = function () {
    var p = document.getElementById('palette');
    if (!p) return;
    p.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderPalette('');
    var input = document.getElementById('paletteInput');
    input.value = '';
    setTimeout(function () { input.focus(); }, 40);
  };
  App.closePalette = function () {
    var p = document.getElementById('palette');
    if (!p) return;
    p.classList.remove('open');
    document.body.style.overflow = '';
  };

  /* --------------------------------------------------------------- toast */
  App.toast = function (msg, icon) {
    var wrap = document.getElementById('toasts');
    if (!wrap) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span class="pi-icon green" style="width:22px;height:22px;border-radius:7px">' +
                   App.icon(icon || 'check') + '</span>' + esc(msg);
    wrap.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 280);
    }, 2600);
  };

  /* ------------------------------------------------------------- motion */
  function initReveal() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* Stagger everything inside a [data-stagger] container. */
  function initStagger() {
    document.querySelectorAll('[data-stagger]').forEach(function (wrap) {
      var step = parseInt(wrap.getAttribute('data-stagger'), 10) || 60;
      Array.prototype.forEach.call(wrap.children, function (child, i) {
        if (child.hasAttribute('data-reveal')) {
          child.style.setProperty('--reveal-delay', (i * step) + 'ms');
        } else if (child.classList.contains('enter')) {
          child.style.setProperty('--enter-delay', (i * step) + 'ms');
        }
      });
    });
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-count-suffix') || '';
    var dur = parseInt(el.getAttribute('data-count-dur'), 10) || 1300;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target.toLocaleString() + suffix;
      return;
    }
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 4);
      var val = target * eased;
      el.textContent = (target % 1 ? val.toFixed(1) : Math.round(val).toLocaleString()) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    var els = document.querySelectorAll('[data-count]');
    if (!('IntersectionObserver' in window)) { els.forEach(animateCount); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        animateCount(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* Bars, chart columns and sparklines all grow from zero once visible. */
  function initGrowth() {
    var els = document.querySelectorAll('[data-grow]');
    function grow(el) {
      var pct = el.getAttribute('data-grow');
      var axis = el.getAttribute('data-grow-axis') || 'width';
      setTimeout(function () { el.style[axis] = pct + '%'; }, 60);
    }
    if (!('IntersectionObserver' in window)) { els.forEach(grow); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        grow(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.2 });
    els.forEach(function (e) { io.observe(e); });
  }

  function initRings() {
    var els = document.querySelectorAll('[data-ring]');
    function draw(el) {
      var pct = parseFloat(el.getAttribute('data-ring'));
      var circle = el.querySelector('.ring-value');
      if (!circle) return;
      var r = parseFloat(circle.getAttribute('r'));
      var c = 2 * Math.PI * r;
      circle.style.strokeDasharray = c;
      circle.style.strokeDashoffset = c;
      requestAnimationFrame(function () {
        setTimeout(function () { circle.style.strokeDashoffset = c * (1 - pct / 100); }, 80);
      });
    }
    if (!('IntersectionObserver' in window)) { els.forEach(draw); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        draw(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.3 });
    els.forEach(function (e) { io.observe(e); });
  }

  App.ring = function (pct, size, stroke, label) {
    size = size || 64; stroke = stroke || 6;
    var r = (size - stroke) / 2;
    return '<span class="ring" data-ring="' + pct + '" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '">' +
        '<circle class="ring-track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
        '<circle class="ring-value" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
      '</svg>' +
      '<span class="ring-label">' + (label == null ? pct + '%' : esc(label)) + '</span>' +
    '</span>';
  };

  /* The gradient every ring shares — injected once. */
  function injectRingGradient() {
    if (document.getElementById('wpiDefs')) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'wpiDefs');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = '<defs><linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">' +
                    '<stop offset="0%" stop-color="#00a3e6"/>' +
                    '<stop offset="60%" stop-color="#00c776"/>' +
                    '<stop offset="100%" stop-color="#50e56f"/>' +
                    '</linearGradient></defs>';
    document.body.appendChild(svg);
  }

  /* ---------------------------------------------------------------- media */

  /* Look a lesson up in the media map. Index and exact title are both valid
     keys, so a course can be reordered without breaking its mapping. */
  App.media = function (slug, index, title) {
    var map = window.WPI_MEDIA || {};
    var course = map[slug];
    if (!course) return null;
    var entry = course[title] || course[index] || course[String(index)];
    return entry && entry.src ? entry : null;
  };

  var YT_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/;
  /* An unlisted Vimeo video needs its hash as well as its id. Both the
     vimeo.com/<id>/<hash> and player.vimeo.com/video/<id>?h=<hash> forms
     carry it, and an entry may also supply it separately as `hash`. */
  var VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-z]+))?/;
  var VIMEO_H_RE = /[?&]h=([0-9a-z]+)/;
  var WISTIA_RE = /(?:wistia\.com|wi\.st)\/(?:medias|embed\/medias)\/(\w+)/;

  /* Work out how a source should be played. An explicit type always wins. */
  App.mediaKind = function (entry) {
    if (entry.type) return entry.type;
    var src = String(entry.src).toLowerCase();
    if (/^\d{6,}$/.test(src)) return 'vimeo';
    if (VIMEO_RE.test(src)) return 'vimeo';
    if (YT_RE.test(src)) return 'youtube';
    if (WISTIA_RE.test(src)) return 'wistia';
    if (src.indexOf('.m3u8') >= 0) return 'hls';
    if (src.indexOf('.webm') >= 0) return 'webm';
    if (/\.(mp4|m4v|mov)(\?|$)/.test(src)) return 'mp4';
    return 'iframe';
  };

  function embedUrl(kind, src, entry) {
    var m;
    if (kind === 'youtube') {
      m = src.match(YT_RE);
      return 'https://www.youtube-nocookie.com/embed/' + (m ? m[1] : '') +
             '?rel=0&modestbranding=1';
    }
    if (kind === 'vimeo') {
      m = src.match(VIMEO_RE);
      var id = m ? m[1] : (/^\d{6,}$/.test(src) ? src : '');
      var hash = (entry && entry.hash) || (m && m[2]) ||
                 (src.match(VIMEO_H_RE) || [])[1] || '';
      return 'https://player.vimeo.com/video/' + id +
             '?dnt=1' + (hash ? '&h=' + hash : '');
    }
    if (kind === 'wistia') {
      m = src.match(WISTIA_RE);
      return 'https://fast.wistia.net/embed/iframe/' + (m ? m[1] : '');
    }
    return src;
  }

  /* Build the player markup for one lesson. Returns the unmapped notice when
     no source exists, so a missing URL reads as missing rather than broken. */
  App.player = function (entry, opts) {
    opts = opts || {};
    /* A lesson with no source is not necessarily a lesson missing its source.
       The migration manifest records, per lesson, whether the platform held a
       video at all: seven lessons are written or link out, three are documents.
       Telling a rep to go and edit a JavaScript file on one of those is wrong,
       so the empty stage reads from the lesson's own type and only asks for a
       source when the lesson is supposed to have one. */
    if (!entry) {
      var blank = {
        text: ['doc', 'Nothing to play here',
               'This lesson is written material rather than a recording. ' +
               'Everything it covers is in the notes below.'],
        download: ['download', 'A document, not a video',
               'This lesson is a document to read or hand to a merchant. ' +
               'Use the download on this page.'],
        quiz: ['quiz', 'Knowledge check',
               'This is a quiz rather than a lesson. Work through it once you have ' +
               'watched the section it belongs to.']
      }[opts.kind];
      if (blank) {
        return '<div class="stage stage-empty">' +
            '<div class="stage-inner">' +
              '<span class="tile" data-icon="' + blank[0] + '"></span>' +
              '<div class="h3" style="margin-top:16px">' + esc(blank[1]) + '</div>' +
              '<p class="small muted" style="max-width:46ch;margin-top:8px">' +
                esc(blank[2]) + '</p>' +
            '</div>' +
          '</div>';
      }
      return '<div class="stage stage-empty">' +
          '<div class="stage-inner">' +
            '<span class="tile tile-blue" data-icon="play"></span>' +
            '<div class="h3" style="margin-top:16px">No video mapped yet</div>' +
            '<p class="small muted" style="max-width:46ch;margin-top:8px">' +
              'Add a source for this lesson in <code class="key">assets/js/media.js</code> ' +
              'and it plays here. Nothing else needs to change.' +
            '</p>' +
            (opts.slug != null ? '<code class="key" style="margin-top:14px;display:inline-block">' +
              esc('WPI_MEDIA["' + opts.slug + '"][' + opts.index + ']') + '</code>' : '') +
          '</div>' +
        '</div>';
    }

    var kind = App.mediaKind(entry);

    if (kind === 'vimeo' || kind === 'youtube' || kind === 'wistia' || kind === 'iframe') {
      /* An embed cannot load without a connection, so say that rather than
         rendering an iframe that will sit there blank. */
      if (!navigator.onLine) {
        return '<div class="stage stage-empty">' +
            '<div class="stage-inner">' +
              '<span class="tile" data-icon="play"></span>' +
              '<div class="h3" style="margin-top:16px">Needs a connection</div>' +
              '<p class="small muted" style="max-width:44ch;margin-top:8px">' +
                'This lesson streams from Vimeo, so it cannot be watched offline. ' +
                'Courses you have downloaded are still available.' +
              '</p>' +
              '<a class="btn btn-secondary btn-sm" href="settings.html#offline" ' +
                'style="margin-top:14px">See downloads</a>' +
            '</div>' +
          '</div>';
      }
      return '<div class="stage stage-embed">' +
          '<iframe src="' + esc(embedUrl(kind, entry.src, entry)) + '" title="' + esc(opts.title || 'Lesson video') + '" ' +
            'frameborder="0" loading="lazy" ' +
            'allow="autoplay; fullscreen; picture-in-picture; encrypted-media" ' +
            'allowfullscreen></iframe>' +
        '</div>';
    }

    var captions = '';
    if (entry.captions) {
      var tracks = Array.isArray(entry.captions)
        ? entry.captions
        : [{ src: entry.captions, srclang: 'en', label: 'English' }];
      captions = tracks.map(function (t, i) {
        return '<track kind="captions" src="' + esc(t.src) + '" ' +
               'srclang="' + esc(t.srclang || 'en') + '" ' +
               'label="' + esc(t.label || 'Captions') + '"' +
               (i === 0 ? ' default' : '') + '>';
      }).join('');
    }

    return '<div class="stage stage-video">' +
        '<video id="lessonVideo" controls playsinline preload="metadata"' +
          (entry.poster ? ' poster="' + esc(entry.poster) + '"' : '') + '>' +
          '<source src="' + esc(entry.src) + '"' +
            (kind === 'webm' ? ' type="video/webm"'
             : kind === 'hls' ? ' type="application/vnd.apple.mpegurl"'
             : ' type="video/mp4"') + '>' +
          captions +
          'Your browser cannot play this video.' +
        '</video>' +
        (kind === 'hls' ? '<p class="tiny faint stage-note" data-hls-note hidden>' +
          'This is an HLS stream. Safari plays it natively; other browsers need hls.js loaded on the page.' +
          '</p>' : '') +
      '</div>';
  };

  /* ---------------------------------------------------- playback progress */

  var PROGRESS_KEY = 'wpi-progress';

  function readProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function writeProgress(all) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch (e) {}
  }

  App.progress = {
    /* One record per lesson: furthest position and whether it finished. */
    get: function (slug, index) {
      var all = readProgress();
      return (all[slug] && all[slug][index]) || null;
    },
    set: function (slug, index, patch) {
      var all = readProgress();
      all[slug] = all[slug] || {};
      all[slug][index] = Object.assign({}, all[slug][index], patch);
      writeProgress(all);
    },
    course: function (slug) {
      return readProgress()[slug] || {};
    },
    /* How many lessons of a course have been finished. */
    doneCount: function (slug) {
      var rec = readProgress()[slug] || {}, n = 0;
      Object.keys(rec).forEach(function (k) { if (rec[k] && rec[k].done) n++; });
      return n;
    },
    clear: function () { writeProgress({}); }
  };

  /* --------------------------------------------------------------- offline */

  /* A lesson can only be taken offline if its source is a file this origin
     serves. A Vimeo embed always needs the network — the iframe fetches from
     player.vimeo.com and never touches the service worker. */
  App.isCacheable = function (entry) {
    if (!entry) return false;
    var kind = App.mediaKind(entry);
    if (kind !== 'mp4' && kind !== 'webm') return false;
    try {
      return new URL(entry.src, location.href).origin === location.origin;
    } catch (e) { return false; }
  };

  /* Every cacheable source in a course, absolute so it matches what the
     service worker stores. */
  App.courseSources = function (course) {
    var out = [];
    course.lessons.forEach(function (l, i) {
      var entry = App.media(course.slug, i, l.t);
      if (App.isCacheable(entry)) out.push(new URL(entry.src, location.href).href);
    });
    return out;
  };

  App.offline = {
    supported: 'serviceWorker' in navigator && 'caches' in window,

    ready: function () {
      if (!App.offline.supported) return Promise.resolve(null);
      return navigator.serviceWorker.ready;
    },

    /* Which of these URLs are already stored. */
    cached: function () {
      if (!App.offline.supported) return Promise.resolve([]);
      return caches.open('wpi-video')
        .then(function (c) { return c.keys(); })
        .then(function (keys) { return keys.map(function (r) { return r.url; }); })
        .catch(function () { return []; });
    },

    download: function (urls, onProgress) {
      return App.offline.ready().then(function (reg) {
        if (!reg || !reg.active) throw new Error('Offline storage is not ready yet');
        return new Promise(function (resolve, reject) {
          var tag = 'dl-' + Date.now();
          function onMessage(e) {
            var m = e.data || {};
            if (m.tag !== tag) return;
            if (m.type === 'CACHE_PROGRESS' && onProgress) onProgress(m);
            if (m.type === 'CACHE_DONE') {
              navigator.serviceWorker.removeEventListener('message', onMessage);
              resolve(m);
            }
          }
          navigator.serviceWorker.addEventListener('message', onMessage);
          reg.active.postMessage({ type: 'CACHE_VIDEOS', urls: urls, tag: tag });
          setTimeout(function () {
            navigator.serviceWorker.removeEventListener('message', onMessage);
            reject(new Error('Download timed out'));
          }, 1000 * 60 * 60);
        });
      });
    },

    remove: function (urls) {
      return App.offline.ready().then(function (reg) {
        if (!reg || !reg.active) return;
        reg.active.postMessage({ type: 'DROP_VIDEOS', urls: urls });
      });
    },

    /* Browser-reported quota. Safari is far stingier than Chrome, so the
       figure is worth showing rather than assuming. */
    estimate: function () {
      if (!navigator.storage || !navigator.storage.estimate) {
        return Promise.resolve(null);
      }
      return navigator.storage.estimate();
    },

    /* Ask the browser not to evict what has been downloaded. */
    persist: function () {
      if (!navigator.storage || !navigator.storage.persist) {
        return Promise.resolve(false);
      }
      return navigator.storage.persisted().then(function (already) {
        return already || navigator.storage.persist();
      });
    }
  };

  App.fmtBytes = function (b) {
    if (!b) return '0 MB';
    if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
    if (b < 1024 * 1024 * 1024) return (b / 1048576).toFixed(0) + ' MB';
    return (b / 1073741824).toFixed(1) + ' GB';
  };

  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    /* A service worker needs a secure context; file:// and plain http on a
       remote host will not register, which is not an error worth surfacing. */
    if (location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /* A small persistent indicator, so a rep knows before they tap a lesson. */
  function watchConnection() {
    function paint() {
      var el = document.getElementById('netStatus');
      if (!el) return;
      var off = !navigator.onLine;
      el.classList.toggle('is-offline', off);
      el.innerHTML = off
        ? App.icon('close') + '<span>Offline — downloaded lessons only</span>'
        : '';
      el.hidden = !off;
    }
    window.addEventListener('online', paint);
    window.addEventListener('offline', paint);
    paint();
  }

  /* ------------------------------------------------------------- events */
  function initShell() {
    var nav = document.getElementById('siteNav');
    var prog = document.getElementById('scrollProgress');

    function onScroll() {
      if (nav) nav.classList.toggle('is-stuck', window.scrollY > 6);
      if (prog) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    document.addEventListener('click', function (e) {
      var t = e.target;

      if (t.closest('[data-theme-toggle]')) { App.toggleTheme(); return; }

      if (t.closest('[data-palette-open]')) { e.preventDefault(); App.openPalette(); return; }
      if (t.closest('[data-palette-close]')) { App.closePalette(); return; }

      if (t.closest('[data-drawer-open]')) {
        document.getElementById('drawer').classList.add('open');
        document.body.style.overflow = 'hidden';
        return;
      }
      if (t.closest('[data-drawer-close]')) {
        document.getElementById('drawer').classList.remove('open');
        document.body.style.overflow = '';
        return;
      }

      var mt = t.closest('[data-menu-toggle]');
      if (mt) {
        var menu = document.getElementById('userMenu');
        var open = menu.classList.toggle('open');
        mt.setAttribute('aria-expanded', String(open));
        return;
      }
      var menu2 = document.getElementById('userMenu');
      if (menu2 && menu2.classList.contains('open') && !t.closest('#userMenu')) {
        menu2.classList.remove('open');
        var btn = document.querySelector('[data-menu-toggle]');
        btn && btn.setAttribute('aria-expanded', 'false');
      }
    });

    var input = document.getElementById('paletteInput');
    if (input) {
      input.addEventListener('input', function () { renderPalette(input.value); });
    }

    document.addEventListener('keydown', function (e) {
      var pal = document.getElementById('palette');
      var open = pal && pal.classList.contains('open');

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open ? App.closePalette() : App.openPalette();
        return;
      }
      if (e.key === '/' && !open && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); App.openPalette(); return;
      }
      if (e.key === 'Escape') {
        if (open) { App.closePalette(); return; }
        var dr = document.getElementById('drawer');
        if (dr && dr.classList.contains('open')) {
          dr.classList.remove('open'); document.body.style.overflow = '';
        }
        var um = document.getElementById('userMenu');
        um && um.classList.remove('open');
        return;
      }
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
      else if (e.key === 'Enter') {
        var sel = document.querySelector('.palette-item[aria-selected="true"]');
        if (sel) { e.preventDefault(); location.href = sel.getAttribute('href'); }
      }
    });
  }

  /* Any element with data-icon gets the matching glyph, markup-free. */
  function initIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      if (el.firstElementChild) return;
      el.innerHTML = App.icon(el.getAttribute('data-icon'));
    });
    (root || document).querySelectorAll('[data-mark]').forEach(function (el) {
      if (el.firstElementChild) return;
      el.outerHTML = App.mark(parseInt(el.getAttribute('data-mark'), 10) || 22);
    });
  }

  /* Re-run the motion wiring after a page renders content dynamically. */
  App.refresh = function () {
    initIcons();
    initStagger();
    initReveal();
    initCounters();
    initGrowth();
    initRings();
  };

  /* ----------------------------------------------------------- bootstrap */
  function boot() {
    var mount = document.getElementById('shell');
    if (mount) mount.innerHTML = buildNav() + buildDrawer() + buildPalette();

    var foot = document.getElementById('shellFooter');
    if (foot) foot.innerHTML = buildFooter();

    injectRingGradient();
    registerWorker();

    var stored = 'light';
    try { stored = localStorage.getItem(THEME_KEY) || ''; } catch (e) {}
    if (!stored) {
      stored = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    App.setTheme(stored);

    initShell();
    watchConnection();
    guardRoster();

    // Give page scripts a chance to render before motion is wired up.
    if (typeof window.pageInit === 'function') window.pageInit();
    App.refresh();
  }

  /* assets/js/roster.js is generated from the site archive and is gitignored,
     so a fresh clone or a git clean silently leaves it behind. When that
     happened the People page quietly served synthetic demo names and nobody
     noticed for a week.

     Any page that asks for the file gets a banner across the top when it did
     not arrive. It is deliberately loud and deliberately automatic: no page
     has to remember to check, and a new page that loads the roster is covered
     the moment it does. */
  function guardRoster() {
    var wants = document.querySelector('script[src*="roster.js"]');
    if (!wants || window.WPI_ROSTER) return;

    var main = document.getElementById('main') || document.body;
    var bar = document.createElement('div');
    bar.className = 'roster-missing';
    bar.setAttribute('role', 'alert');
    bar.innerHTML =
      '<div class="wrap wrap-wide">' +
        '<strong>Showing demo names, not your people.</strong> ' +
        'assets/js/roster.js is missing, so this page has fallen back to sample data. ' +
        'Put the file back, or rebuild it with ' +
        '<code class="key">python3 tools/extract-roster.py path/to/wpiuniversity.com</code>' +
      '</div>';
    main.insertBefore(bar, main.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
