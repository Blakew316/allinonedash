// Service worker for the installed app.
//
// Two rules matter here. Hiring data is never cached — every /api request goes
// straight to the network, so an installed app can never show a stale
// candidate, a stale packet status, or a hire who has already signed. Only the
// shell (HTML, CSS, JS, icons) is cached, which is what makes the app open
// instantly from the home screen and survive a dropped signal.

const VERSION = 'v4';
const SHELL_CACHE = `wp-shell-${VERSION}`;

// Enough to open and run the app offline. Relative to this script, so the
// same worker serves a root deploy and a subpath deploy (the hub) alike.
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './paperwork.html',
  './paperwork.css',
  './paperwork.js',
  './logo.png',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One missing file must not fail the whole install.
      await Promise.all(
        SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== SHELL_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// Let the page ask for the update to be applied immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

// Code has to match the HTML it was deployed with, so it is fetched fresh and
// only falls back to cache when there is no network. Images and the manifest
// can never break a page, so they come from cache for an instant open.
function isCode(url) {
  return /\.(css|js)$/.test(url.pathname);
}
function isAsset(url) {
  return /\.(png|jpe?g|svg|ico|webmanifest|woff2?)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts and the like
  if (url.pathname.includes('/api/')) return; // never cache hiring data

  // Pages: always try the network so a new deploy lands, fall back to cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match(/paperwork/.test(url.pathname) ? './paperwork.html' : './index.html')) ||
            new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } })
          );
        }
      })()
    );
    return;
  }

  // Stylesheets and scripts: network first, so a deploy never leaves old code
  // running against new markup. Cache is the offline fallback.
  if (isCode(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match(request)) || new Response('', { status: 504 });
        }
      })()
    );
    return;
  }

  // Images, icons, fonts: cache first for an instant open, refreshed behind it.
  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        return hit || (await network) || new Response('', { status: 504 });
      })()
    );
  }
});
