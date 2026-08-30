/* Wholesale Payments Route Planner — offline service worker.
   Active only on real hosting (Netlify etc.); the Claude artifact host
   runs its own live-sync runtime and skips registration. */
const VER = "wp-routes-v8";
const CORE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "manifest-dark.webmanifest",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-mask-512.png",
  "icons/icon-dark-180.png",
  "icons/icon-dark-192.png",
  "icons/icon-dark-512.png",
  "icons/icon-dark-mask-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VER)
      .then(c => Promise.allSettled(CORE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* shared team state must never be served stale: network first */
  if (url.pathname.endsWith("data/state.json")) {
    e.respondWith(
      fetch(req).then(r => {
        if (r.ok) { const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp)); }
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  /* the app shell: freshest when online, cached when offline */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(r => {
        const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp));
        return r;
      }).catch(() =>
        caches.match(req)
          .then(m => m || caches.match("index.html"))
          .then(m => m || caches.match("./"))
      )
    );
    return;
  }

  /* everything else (icons, fonts): cache first, refresh in background */
  e.respondWith(
    caches.match(req).then(m => {
      const net = fetch(req).then(r => {
        if (r.ok || r.type === "opaque") { const cp = r.clone(); caches.open(VER).then(c => c.put(req, cp)); }
        return r;
      }).catch(() => m);
      return m || net;
    })
  );
});
