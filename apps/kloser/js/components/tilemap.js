/**
 * A slippy map, from scratch.
 *
 * The original CRM used the Google Maps JavaScript API. This is the same idea
 * without the dependency: Web Mercator projection, raster tiles positioned on a
 * translated layer, and markers on a second, unscaled layer so pins stay a
 * constant size however far you zoom.
 *
 * The tile source is swappable (see TILE_SOURCES). Nothing here assumes tiles
 * will load: if they fail the map keeps working — pan, zoom, pins and all — over
 * a plain background, because a field rep in a basement still needs the pins.
 */
import { el, $ } from '../core/dom.js';

const TILE = 256;
const MIN_Z = 3;
const MAX_Z = 18;

export const TILE_SOURCES = {
  osm: {
    label: 'Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    attributionHref: 'https://www.openstreetmap.org/copyright',
    maxZoom: 19,
  },
  osmHot: {
    label: 'Humanitarian',
    url: 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors, Humanitarian OSM Team',
    attributionHref: 'https://www.openstreetmap.org/copyright',
    maxZoom: 19,
  },
};

/* ------------------------------------------------------------- projection */
export const lngToWorld = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
export function latToWorld(lat, z) {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * TILE * 2 ** z;
}
export const worldToLng = (x, z) => (x / (TILE * 2 ** z)) * 360 - 180;
export function worldToLat(y, z) {
  const n = Math.PI - 2 * Math.PI * (y / (TILE * 2 ** z));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @param {HTMLElement} host
 * @param {{center?: [number, number], zoom?: number, source?: string,
 *          onMove?: Function, onReady?: Function}} opts
 */
export function tileMap(host, opts = {}) {
  const state = {
    lat: opts.center ? opts.center[0] : 39.5,
    lng: opts.center ? opts.center[1] : -98.35,
    zoom: opts.zoom ?? 4,
    source: opts.source || 'osm',
  };

  host.classList.add('tilemap');
  host.innerHTML = `
    <div class="tilemap-tiles" aria-hidden="true"></div>
    <div class="tilemap-markers"></div>
    <div class="tilemap-attrib"></div>`;
  const tileLayer = $('.tilemap-tiles', host);
  const markerLayer = $('.tilemap-markers', host);
  const attrib = $('.tilemap-attrib', host);

  let markers = [];          // [{ lat, lng, render(screenPos) }]
  let renderMarkers = null;  // caller-supplied painter
  let tileFails = 0;
  let tileTries = 0;
  const cache = new Map();   // key -> img

  const size = () => ({ w: host.clientWidth || 1, h: host.clientHeight || 1 });
  const src = () => TILE_SOURCES[state.source] || TILE_SOURCES.osm;

  /** Screen pixel for a lat/lng at the current view. */
  function project(lat, lng) {
    const { w, h } = size();
    const z = state.zoom;
    return {
      x: lngToWorld(lng, z) - lngToWorld(state.lng, z) + w / 2,
      y: latToWorld(lat, z) - latToWorld(state.lat, z) + h / 2,
    };
  }

  /** The inverse: lat/lng under a screen pixel. */
  function unproject(x, y) {
    const { w, h } = size();
    const z = state.zoom;
    return {
      lat: worldToLat(latToWorld(state.lat, z) + y - h / 2, z),
      lng: worldToLng(lngToWorld(state.lng, z) + x - w / 2, z),
    };
  }

  /* ------------------------------------------------------------- tiles */
  function drawTiles() {
    const { w, h } = size();
    const z = state.zoom;
    const tz = clamp(Math.round(z), MIN_Z, Math.min(MAX_Z, src().maxZoom || MAX_Z));
    const scale = 2 ** (z - tz);
    const n = 2 ** tz;

    // World pixel of the view center, in the tile zoom's own pixel space.
    const cx = lngToWorld(state.lng, tz);
    const cy = latToWorld(state.lat, tz);
    const halfW = w / 2 / scale;
    const halfH = h / 2 / scale;

    const x0 = Math.floor((cx - halfW) / TILE);
    const x1 = Math.floor((cx + halfW) / TILE);
    const y0 = Math.floor((cy - halfH) / TILE);
    const y1 = Math.floor((cy + halfH) / TILE);

    const wanted = new Set();
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (y < 0 || y >= n) continue;          // above the pole / below it: nothing there
        const wrapped = ((x % n) + n) % n;      // the world repeats east-west
        const key = `${tz}/${wrapped}/${y}@${x}`;
        wanted.add(key);
        let img = cache.get(key);
        if (!img) {
          img = new Image();
          img.className = 'tilemap-tile';
          img.alt = '';
          img.decoding = 'async';
          img.draggable = false;
          tileTries += 1;
          img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
          img.addEventListener('error', () => {
            tileFails += 1;
            img.classList.add('is-failed');
            // Once enough tiles fail we stop pretending and let the fallback show.
            if (tileTries >= 4 && tileFails / tileTries > 0.5) host.dataset.tiles = 'unavailable';
          }, { once: true });
          img.src = src().url
            .replace('{z}', tz).replace('{x}', wrapped).replace('{y}', y);
          cache.set(key, img);
          tileLayer.appendChild(img);
        }
        // Position in layer space; the layer itself carries the fractional scale.
        img.style.transform =
          `translate3d(${x * TILE * scale - (cx - w / 2 / scale) * scale}px,`
          + `${y * TILE * scale - (cy - h / 2 / scale) * scale}px,0)`;
        img.style.width = `${TILE * scale + 1}px`;   // +1 hides seams between tiles
        img.style.height = `${TILE * scale + 1}px`;
      }
    }
    // Drop tiles that scrolled out of view, but keep a small buffer of recent ones.
    if (cache.size > wanted.size + 120) {
      for (const [key, img] of cache) {
        if (!wanted.has(key)) { img.remove(); cache.delete(key); }
      }
    }
  }

  function drawAttribution() {
    const s = src();
    attrib.innerHTML =
      `<a href="${s.attributionHref}" target="_blank" rel="noopener noreferrer">${s.attribution}</a>`;
  }

  function draw() {
    drawTiles();
    if (typeof renderMarkers === 'function') renderMarkers(markerLayer, project, state);
    if (typeof opts.onMove === 'function') opts.onMove(view());
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  }

  /* -------------------------------------------------------- interaction */
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let moved = 0;
  const pointers = new Map();
  let pinchStart = null;

  host.addEventListener('pointerdown', (e) => {
    // Let the pins and the controls have their own clicks.
    if (e.target instanceof Element && e.target.closest('.tilemap-marker, .tilemap-cluster, .map-overlay, .tilemap-attrib')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: state.zoom };
      dragging = false;
      return;
    }
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    host.setPointerCapture(e.pointerId);
    host.classList.add('is-dragging');
  });

  host.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchStart && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart.dist > 0) {
        setZoom(pinchStart.zoom + Math.log2(dist / pinchStart.dist));
      }
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    lastX = e.clientX;
    lastY = e.clientY;
    panBy(-dx, -dy);
  });

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (!dragging) return;
    dragging = false;
    host.classList.remove('is-dragging');
    try { host.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
  };
  host.addEventListener('pointerup', endPointer);
  host.addEventListener('pointercancel', endPointer);

  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    zoomAround(e.clientX - rect.left, e.clientY - rect.top,
      state.zoom - Math.sign(e.deltaY) * 0.5);
  }, { passive: false });

  host.addEventListener('dblclick', (e) => {
    if (e.target instanceof Element && e.target.closest('.tilemap-marker, .tilemap-cluster')) return;
    const rect = host.getBoundingClientRect();
    zoomAround(e.clientX - rect.left, e.clientY - rect.top, state.zoom + 1);
  });

  // Keyboard: a map you can only reach with a mouse is a map half the team cannot use.
  host.tabIndex = 0;
  host.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 200 : 80;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) { e.preventDefault(); panBy(...moves[e.key]); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(state.zoom + 1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(state.zoom - 1); }
  });

  function panBy(dx, dy) {
    const { w, h } = size();
    const p = unproject(w / 2 + dx, h / 2 + dy);
    state.lat = clamp(p.lat, -85, 85);
    state.lng = p.lng;
    schedule();
  }

  function setZoom(z) {
    state.zoom = clamp(z, MIN_Z, Math.min(MAX_Z, src().maxZoom || MAX_Z));
    schedule();
  }

  /** Zoom while keeping whatever is under (x, y) under (x, y). */
  function zoomAround(x, y, z) {
    const before = unproject(x, y);
    state.zoom = clamp(z, MIN_Z, Math.min(MAX_Z, src().maxZoom || MAX_Z));
    const after = unproject(x, y);
    state.lat = clamp(state.lat + (before.lat - after.lat), -85, 85);
    state.lng += before.lng - after.lng;
    schedule();
  }

  function view() {
    const { w, h } = size();
    const nw = unproject(0, 0);
    const se = unproject(w, h);
    return {
      lat: state.lat, lng: state.lng, zoom: state.zoom,
      bounds: { north: nw.lat, west: nw.lng, south: se.lat, east: se.lng },
    };
  }

  /** Frame a set of points with padding, the way "fit to results" should behave. */
  function fit(points, pad = 64) {
    const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!pts.length) return;
    const { w, h } = size();
    const north = Math.max(...pts.map((p) => p.lat));
    const south = Math.min(...pts.map((p) => p.lat));
    const west = Math.min(...pts.map((p) => p.lng));
    const east = Math.max(...pts.map((p) => p.lng));
    state.lat = (north + south) / 2;
    state.lng = (west + east) / 2;
    if (pts.length === 1) { setZoom(14); return; }
    let z = MIN_Z;
    for (let t = MAX_Z; t >= MIN_Z; t--) {
      const dx = Math.abs(lngToWorld(east, t) - lngToWorld(west, t));
      const dy = Math.abs(latToWorld(south, t) - latToWorld(north, t));
      if (dx <= Math.max(1, w - pad * 2) && dy <= Math.max(1, h - pad * 2)) { z = t; break; }
    }
    setZoom(Math.min(z, 16));
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  if (ro) ro.observe(host);

  drawAttribution();
  requestAnimationFrame(() => { draw(); if (typeof opts.onReady === 'function') opts.onReady(api); });

  const api = {
    host,
    get state() { return { ...state }; },
    project,
    unproject,
    view,
    fit,
    setZoom,
    zoomBy: (d) => setZoom(state.zoom + d),
    setCenter(lat, lng, z) {
      state.lat = clamp(lat, -85, 85);
      state.lng = lng;
      if (typeof z === 'number') state.zoom = clamp(z, MIN_Z, MAX_Z);
      schedule();
    },
    setSource(name) {
      if (!TILE_SOURCES[name]) return;
      state.source = name;
      cache.forEach((img) => img.remove());
      cache.clear();
      tileFails = 0;
      tileTries = 0;
      delete host.dataset.tiles;
      drawAttribution();
      schedule();
    },
    /** The painter owns the marker layer; it is called on every view change. */
    onRender(fn) { renderMarkers = fn; schedule(); },
    setMarkers(list) { markers = list || []; schedule(); },
    get markers() { return markers; },
    /** True while the pointer is actually dragging, so pins can ignore that click. */
    get dragged() { return moved > 6; },
    redraw: schedule,
    destroy() {
      if (ro) ro.disconnect();
      cache.forEach((img) => img.remove());
      cache.clear();
    },
  };
  return api;
}
