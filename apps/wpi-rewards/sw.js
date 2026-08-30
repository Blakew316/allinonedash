/* WPI Rewards — service worker.
   Pages: network-first with a short timeout, so slow connections fall
   back to cache instead of hanging. Styles/scripts: served instantly
   from cache while a background fetch refreshes them for the next
   launch. Media and images: cache-first. */
const VERSION = "wpi-rewards-v40";
const ASSETS = [
  "./",
  "./index.html",
  "./demo.html",
  "./rewards.html",
  "./earnings.html",
  "./orders.html",
  "./cart.html",
  "./profile.html",
  "./terms.html",
  "./privacy.html",
  "./assets/css/style.css",
  "./assets/js/data.js",
  "./assets/js/app.js",
  "./assets/img/icon-192.png",
  "./assets/img/icon-512.png",
  "./assets/img/apple-touch-icon.png",
  "./assets/media/card-machine.mp4",
  "./assets/media/card-machine.webm",
  "./manifest.webmanifest",
];

const CORE = /\.(?:css|js|webmanifest)$/;
const NAV_TIMEOUT_MS = 2500;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  const cachePut = (res) => {
    if (res && res.ok && sameOrigin) {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  };

  if (req.mode === "navigate" || (sameOrigin && /\.html$/.test(url.pathname))) {
    // Fresh page when the network answers quickly; cached page otherwise.
    e.respondWith(
      Promise.race([
        fetch(req).then(cachePut),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT_MS)),
      ]).catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
      )
    );
    return;
  }

  if (sameOrigin && CORE.test(url.pathname)) {
    // Stale-while-revalidate: instant response, refreshed in background.
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => {
        const refresh = fetch(req).then(cachePut).catch(() => hit);
        if (hit) {
          e.waitUntil(refresh.catch(() => {}));
          return hit;
        }
        return refresh;
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then(cachePut))
  );
});
