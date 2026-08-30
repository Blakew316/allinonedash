/* ==========================================================================
   WPI University — service worker
   --------------------------------------------------------------------------
   Two caches, deliberately separate:

     SHELL   the pages, CSS, JS and images. Small, precached on install, and
             replaced wholesale whenever VERSION changes.
     VIDEO   lesson media a rep has chosen to keep. Large, opt-in per course,
             and never cleared by a shell update — a deploy must not wipe
             someone's downloads before they get on a plane.

   Vimeo embeds cannot be cached: the iframe fetches from player.vimeo.com at
   play time and its requests never reach this worker. Only self-hosted files
   (mp4/webm) can be taken offline, which is why the download control counts
   them separately.
   ========================================================================== */

const VERSION = 'v3';
const SHELL = `wpi-shell-${VERSION}`;
const VIDEO = 'wpi-video';           // unversioned on purpose — see above

const SHELL_ASSETS = [
  './',
  'index.html',
  'training.html',
  'course.html',
  'lesson.html',
  'people.html',
  'teams.html',
  'reports.html',
  'invite.html',
  'profile.html',
  'settings.html',
  'admin.html',
  'learning-plans.html',
  'pricing.html',
  'proposal.html',
  'offline.html',
  'assets/css/app.css',
  'assets/js/app.js',
  'assets/js/data.js',
  'assets/js/media.js',
  'assets/js/interchange.js',
  'assets/js/pricing.js',
  'assets/js/quote.js',
  'assets/js/billing.js',
  'assets/img/wholesale-payments-mark.png',
  'assets/img/wholesale-payments-wordmark.png',
  'assets/img/favicon.svg',
  'manifest.webmanifest'
];

/* roster.js is generated locally and may not exist; a missing optional file
   must not fail the whole install. */
const OPTIONAL = ['assets/js/roster.js'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(SHELL_ASSETS);
    await Promise.all(OPTIONAL.map(url =>
      cache.add(url).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('wpi-shell-') && k !== SHELL)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isVideo(url) {
  return /\.(mp4|m4v|webm|mov)(\?|$)/i.test(url);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Anything off-origin — Vimeo, Google Fonts — is left to the network.
     Caching an opaque cross-origin response would consume quota without
     being inspectable or reliably replayable. */
  if (url.origin !== self.location.origin) return;

  if (isVideo(url.pathname)) {
    event.respondWith(videoResponse(req));
    return;
  }

  /* Shell: cache first, then network, refreshing the copy in the background.
     A rep on a bad connection gets the page instantly either way. */
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) {
      event.waitUntil(refresh(req));
      return cached;
    }
    try {
      const fresh = await fetch(req);
      if (fresh.ok) (await caches.open(SHELL)).put(req, fresh.clone());
      return fresh;
    } catch (e) {
      const fallback = await caches.match('offline.html');
      return fallback || new Response('Offline', { status: 503 });
    }
  })());
});

async function refresh(req) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok) (await caches.open(SHELL)).put(req, fresh.clone());
  } catch (e) { /* offline — the cached copy stands */ }
}

/* Video needs range support: a browser seeking in a <video> sends
   Range requests, and replaying a full cached body against one would
   break scrubbing. Serve the slice the player asked for. */
async function videoResponse(req) {
  const cache = await caches.open(VIDEO);
  const cached = await cache.match(req.url);

  if (!cached) {
    try { return await fetch(req); }
    catch (e) { return new Response('Video not available offline', { status: 504 }); }
  }

  const range = req.headers.get('range');
  if (!range) return cached;

  const buffer = await cached.arrayBuffer();
  const match = /bytes=(\d*)-(\d*)/.exec(range);
  const start = match && match[1] ? parseInt(match[1], 10) : 0;
  const end = match && match[2] ? parseInt(match[2], 10) : buffer.byteLength - 1;

  if (start >= buffer.byteLength) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${buffer.byteLength}` }
    });
  }

  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${buffer.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

/* -------------------------------------------------------------- messages */

self.addEventListener('message', event => {
  const msg = event.data || {};
  if (msg.type === 'CACHE_VIDEOS') {
    event.waitUntil(cacheVideos(msg.urls || [], msg.tag, event.source));
  } else if (msg.type === 'DROP_VIDEOS') {
    event.waitUntil(dropVideos(msg.urls || [], event.source));
  } else if (msg.type === 'CACHED_URLS') {
    event.waitUntil(reportCached(event.source, msg.tag));
  }
});

async function cacheVideos(urls, tag, client) {
  const cache = await caches.open(VIDEO);
  let done = 0, bytes = 0, failed = [];

  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      if (existing) {
        done++;
        bytes += Number(existing.headers.get('Content-Length') || 0);
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const copy = res.clone();
        await cache.put(url, res);
        bytes += Number(copy.headers.get('Content-Length') || 0);
        done++;
      }
    } catch (e) {
      failed.push(url);
    }
    post(client, { type: 'CACHE_PROGRESS', tag, done, total: urls.length, bytes, failed: failed.length });
  }
  post(client, { type: 'CACHE_DONE', tag, done, total: urls.length, bytes, failed });
}

async function dropVideos(urls, client) {
  const cache = await caches.open(VIDEO);
  for (const url of urls) await cache.delete(url);
  post(client, { type: 'DROP_DONE', count: urls.length });
}

async function reportCached(client, tag) {
  const cache = await caches.open(VIDEO);
  const keys = await cache.keys();
  post(client, { type: 'CACHED_URLS', tag, urls: keys.map(r => r.url) });
}

function post(client, payload) {
  if (client && client.postMessage) client.postMessage(payload);
}
