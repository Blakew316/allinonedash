/* =============================================================================
   Kloser CRM — service worker

   Goal: the installed app cold-launches with no network at all, which is the
   actual field condition (basements, back offices, rural territory).

   Shape:
   - CORE is precached atomically. If any of it is missing the install fails
     and the old worker keeps serving — better a stale app than a broken one.
   - DATA is warmed opportunistically; a miss there degrades one screen, not
     the app, so it must never fail the install.
   - Navigations always resolve to the cached shell. The app is hash-routed,
     so the fragment never reaches the network and one cached document serves
     every route.
   ========================================================================== */

const VERSION = '2.7.0';
const SHELL_CACHE = `kloser-shell-${VERSION}`;
const DATA_CACHE = `kloser-data-${VERSION}`;

/* The app shell. Every ES module is listed explicitly: the browser discovers
   imports by executing them, which never happens on a cold offline start. */
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',

  './styles/fonts.css',
  './styles/tokens.css',
  './styles/base.css',
  './styles/animations.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/charts.css',
  './styles/pages.css',
  './styles/platform.css',

  './config.js',
  './js/main.js',
  './js/core/dom.js',
  './js/core/format.js',
  './js/core/icons.js',
  './js/core/router.js',
  './js/core/store.js',
  './js/core/pwa.js',
  './js/components/charts.js',
  './js/components/overlays.js',
  './js/components/palette.js',
  './js/components/repDrawer.js',
  './js/components/tilemap.js',
  './js/components/gmap.js',
  './js/components/googleAuth.js',
  './js/components/googleCalendar.js',
  './js/components/notifications.js',
  './js/components/calendar.js',
  './js/components/shell.js',
  './js/components/table.js',
  './js/components/ui.js',
  './js/pages/activities.js',
  './js/pages/appointmentBoard.js',
  './js/pages/bcl.js',
  './js/pages/dashboard.js',
  './js/pages/email.js',
  './js/pages/leads.js',
  './js/pages/locationVerify.js',
  './js/pages/map.js',
  './js/pages/notFound.js',
  './js/pages/pipeline.js',
  './js/pages/repSchedule.js',
  './js/pages/routes.js',
  './js/pages/schedule.js',
  './js/pages/settings.js',
  './js/pages/signin.js',
  './js/pages/team.js',

  './assets/fonts/inter-latin.woff2',
  './assets/logo-mark.svg',
  './assets/favicon.svg',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/apple-touch-icon-152.png',
];

/* Boot-critical data: the dashboard awaits these before it can paint. */
const DATA_CRITICAL = [
  './data/dashboard.json',
  './data/leads.json',
  './data/activities.json',
  './data/bcl_queue.json',
];

/* Everything else, warmed after activation so the first tap into any screen
   already has its data. Two of these are large, hence the age gate below. */
const DATA_WARM = [
  './data/geo.json',
  './data/routes.json',
  './data/location_verification.json',
  './data/rep_schedule.json',
  './data/reps_board.json',
];

/* Large datasets only revalidate once a day — re-fetching 291KB every time
   someone opens the appointment board is a waste of a field rep's data plan. */
const HEAVY = /\/data\/(reps_board|rep_schedule)\.json$/;
const HEAVY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isNav = (req) =>
  req.mode === 'navigate' ||
  (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));

/* -------------------------------------------------------------- install -- */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // Atomic: a shell that is missing a module must not go live.
    await shell.addAll(CORE);

    const data = await caches.open(DATA_CACHE);
    // Best effort: a missing dataset degrades one screen, not the app.
    await Promise.allSettled(DATA_CRITICAL.map((u) => data.add(u)));
    // Deliberately no skipWaiting — the running app decides when to swap.
  })());
});

/* ------------------------------------------------------------- activate -- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, DATA_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));

    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.disable();
    }
    await self.clients.claim();

    // Warm the rest in the background; never block activation on it.
    const data = await caches.open(DATA_CACHE);
    Promise.allSettled(DATA_WARM.map(async (u) => {
      if (await data.match(u)) return;
      return data.add(u);
    }));
  })());
});

/* ---------------------------------------------------------- strategies -- */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: false });
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, { ageGate = 0 } = {}) {
  const cache = await caches.open(DATA_CACHE);
  const hit = await cache.match(req);

  const revalidate = () => fetch(req)
    .then((res) => {
      if (res && res.ok) {
        // Stamp the entry so the age gate has something to read.
        const headers = new Headers(res.headers);
        headers.set('x-kloser-cached-at', String(Date.now()));
        return res.clone().blob().then((body) => {
          cache.put(req, new Response(body, { status: res.status, statusText: res.statusText, headers }));
          return res;
        });
      }
      return res;
    })
    .catch(() => undefined);

  if (!hit) return (await revalidate()) || Response.error();

  if (ageGate) {
    const at = Number(hit.headers.get('x-kloser-cached-at') || 0);
    const stale = !at || (Date.now() - at) > ageGate;
    const saveData = self.navigator && self.navigator.connection && self.navigator.connection.saveData;
    if (stale && !saveData) revalidate();
  } else {
    revalidate();
  }
  return hit;
}

/* -------------------------------------------------------------- routing -- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never touch non-GET, cross-origin, or the worker's own script.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  // Every in-scope navigation resolves to the one cached shell. The route
  // lives in the fragment, which the network never sees.
  if (isNav(req)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const shell = await cache.match('./index.html') || await cache.match('./');
      if (shell) return shell;
      try {
        return await fetch(req);
      } catch {
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
          '<body style="font:16px -apple-system,system-ui,sans-serif;padding:40px;color:#131C2E">' +
          '<h1>Kloser CRM is offline</h1><p>Reopen the app once you have a connection to finish setting up offline access.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 });
      }
    })());
    return;
  }

  if (url.pathname.includes('/data/')) {
    event.respondWith(staleWhileRevalidate(req, { ageGate: HEAVY.test(url.pathname) ? HEAVY_MAX_AGE_MS : 0 }));
    return;
  }

  // Shell assets are immutable within a cache version; freshness comes from
  // bumping VERSION, not from revalidating on every request.
  event.respondWith(
    cacheFirst(req, SHELL_CACHE).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match(req)) || Response.error();
    })
  );
});

/* ------------------------------------------------------------- messages -- */
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
});
