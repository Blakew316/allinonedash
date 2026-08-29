/*
 * Statement Studio service worker.
 *
 * Strategy: network-first with cache fallback, for every request. Online,
 * the site always runs the freshly deployed code — the cache can never
 * serve anything stale — and each successful response refreshes the copy
 * used when offline. The full app shell is precached at install so the
 * tool keeps working with no connection at all.
 */
var CACHE = 'statement-studio-v17';

var SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/statement.js',
  'js/statement2.js',
  'js/statement3.js',
  'js/check.js',
  'js/letter.js',
  'js/importer.js',
  'js/fonts.data.js',
  'js/brand.data.js',
  'vendor/pdf-lib.min.js',
  'vendor/fontkit.umd.min.js',
  'vendor/pdfjs.min.js',
  'vendor/pdfjs.worker.min.js',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-512-maskable.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch other origins

  event.respondWith(
    fetch(req).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: req.mode === 'navigate' })
        .then(function (hit) {
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('index.html');
          return Response.error();
        });
    })
  );
});
