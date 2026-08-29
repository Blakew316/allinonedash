/* Team Maverick · Appointments — service worker
   The app shell (an explicit allowlist) is cached for instant loads and
   offline use. Appointment data always goes to the network; the app keeps
   its own last-good copy in localStorage for offline viewing. */

var CACHE = 'tm-shell-v31';

var SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.webmanifest',
  './assets/logo.png',
  './assets/logo-dark.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
];

// Resolve the allowlist to absolute URLs so cache lookups are exact.
var SHELL_URLS = SHELL.map(function (p) { return new URL(p, self.registration.scope).href; });
var INDEX_URL = new URL('./index.html', self.registration.scope).href;

function isShell(url) { return SHELL_URLS.indexOf(url) >= 0; }

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Google Fonts: cache-first, populate on first use.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
          return res;
        }).catch(function () { return hit; });
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return; // never touch the Apps Script or anything else

  // Navigations (including ?view=… deep links): serve the cached shell
  // INSTANTLY, refresh it in the background. New deploys still land fast —
  // sw.js is checked on every launch, the new worker's install re-downloads
  // the shell, and the page reloads once when it takes over.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(INDEX_URL).then(function (hit) {
        var network = fetch(req).then(function (res) {
          if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(INDEX_URL, copy); }); }
          return res;
        }).catch(function () { return hit; });
        return hit || network;
      })
    );
    return;
  }

  // Only the explicit shell allowlist is cache-managed. Everything else passes through.
  if (!isShell(url.href)) return;

  // Stale-while-revalidate: serve the cached copy instantly (fast loads),
  // refresh the cache in the background. Updates still arrive promptly:
  // every deploy bumps CACHE, whose install re-downloads the whole shell
  // fresh, and the page reloads once when the new worker takes over.
  e.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
