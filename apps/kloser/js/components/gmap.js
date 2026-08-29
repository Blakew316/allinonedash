/**
 * Google Maps, layered under the app's own field controls — the way the
 * original CRM did it.
 *
 * This exposes exactly the surface the built-in tile map does, so the Map screen
 * does not care which one it got: same project(), fit(), view(), onRender().
 * Markers stay in the app's own layer above the map rather than becoming Google
 * markers, so pins, clusters and the legend are one implementation for both
 * engines. Positions are computed in Web Mercator from the map's bounds, which
 * is the projection Google itself uses, so they land exactly.
 *
 * The API key is the user's: Google bills it, so it is read from preferences and
 * never hard-coded. Without one the Map screen falls back to the built-in map.
 */
import { $ } from '../core/dom.js';
import { prefs, savePrefs } from '../core/store.js';
import { MAPS_KEY as CONFIG_KEY } from '../../config.js';
import { lngToWorld, latToWorld } from './tilemap.js';

const CALLBACK = '__kloserGmapsReady';
const SCRIPT_ID = 'gmaps-sdk';
const LOAD_TIMEOUT = 12000;

/** config.js is the deployment's key; a preference overrides it per browser. */
export const getMapsKey = () => (prefs.mapsKey || CONFIG_KEY || '').trim();
export const keyIsFromConfig = () => !(prefs.mapsKey || '').trim() && Boolean((CONFIG_KEY || '').trim());
export function setMapsKey(key) {
  savePrefs({ mapsKey: (key || '').trim() });
}

let loading = null;

/**
 * Load the Maps JavaScript API once. Rejects on a bad key, a blocked network or
 * a silent failure — the caller is expected to fall back rather than hang.
 */
export function loadGoogleMaps(key = getMapsKey()) {
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  if (!key) return Promise.reject(new Error('no-key'));

  loading = new Promise((resolve, reject) => {
    const done = (fn, arg) => {
      clearTimeout(timer);
      delete window[CALLBACK];
      window.gm_authFailure = undefined;
      fn(arg);
    };
    const timer = setTimeout(() => {
      loading = null;
      done(reject, new Error('timeout'));
    }, LOAD_TIMEOUT);

    window[CALLBACK] = () => done(resolve, window.google.maps);
    // Google calls this global when the key is rejected; without it a bad key
    // just grays the map out with no way for us to notice.
    window.gm_authFailure = () => {
      loading = null;
      done(reject, new Error('auth'));
    };

    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = 'https://maps.googleapis.com/maps/api/js'
      + `?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=places&callback=${CALLBACK}`;
    s.addEventListener('error', () => {
      loading = null;
      done(reject, new Error('network'));
    });
    document.head.appendChild(s);
  });
  return loading;
}

/* --------------------------------------------------------------- geocoding */
const GEO_KEY = 'kloser.geocode.v1';

function readCache() {
  try { return JSON.parse(localStorage.getItem(GEO_KEY) || '{}'); } catch { return {}; }
}
function writeCache(c) {
  try { localStorage.setItem(GEO_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}

/**
 * Resolve real coordinates for addresses, cached forever after the first pass.
 *
 * The export carried addresses but no coordinates. With Maps loaded we can ask
 * Google for the real ones, which is what turns city-level pins into the
 * street-level pins the original had. Throttled, and it stops the moment Google
 * says we are over quota rather than hammering a billed API.
 */
export function geocodeAddresses(addresses, { onEach, onDone, gapMs = 120 } = {}) {
  const cache = readCache();
  const todo = [...new Set(addresses)].filter((a) => a && !cache[a]);
  const hits = {};
  Object.keys(cache).forEach((k) => { hits[k] = cache[k]; });
  if (typeof onEach === 'function') Object.entries(hits).forEach(([a, c]) => onEach(a, c));

  if (!todo.length || !(window.google && window.google.maps)) {
    if (typeof onDone === 'function') onDone(hits, { fetched: 0, remaining: todo.length });
    return () => {};
  }

  const geocoder = new window.google.maps.Geocoder();
  let i = 0;
  let stopped = false;
  let fetched = 0;

  const step = () => {
    if (stopped || i >= todo.length) {
      writeCache(cache);
      if (typeof onDone === 'function') onDone(hits, { fetched, remaining: todo.length - i });
      return;
    }
    const address = todo[i++];
    geocoder.geocode({ address, region: 'us' }, (res, status) => {
      if (status === 'OK' && res && res[0]) {
        const loc = res[0].geometry.location;
        const coord = [Number(loc.lat().toFixed(6)), Number(loc.lng().toFixed(6))];
        cache[address] = coord;
        hits[address] = coord;
        fetched += 1;
        if (typeof onEach === 'function') onEach(address, coord);
      } else if (status === 'OVER_QUERY_LIMIT') {
        // Back off entirely: this is a billed API and the user's quota.
        stopped = true;
        writeCache(cache);
        if (typeof onDone === 'function') onDone(hits, { fetched, remaining: todo.length - i, limited: true });
        return;
      } else if (status === 'ZERO_RESULTS') {
        cache[address] = null;            // remember the miss so we never re-ask
      }
      if (fetched % 10 === 0) writeCache(cache);
      setTimeout(step, gapMs);
    });
  };
  step();
  return () => { stopped = true; writeCache(cache); };
}

export function cachedGeocodes() { return readCache(); }
export function clearGeocodeCache() {
  try { localStorage.removeItem(GEO_KEY); } catch { /* noop */ }
}

/* ------------------------------------------------------------------ places */
/**
 * Real businesses from Google, for the two prospecting tools the original had:
 * Biz Search (find a named business anywhere) and Area Search (find businesses
 * inside the current view). Both resolve to [] when Places is unavailable, so
 * the callers degrade to searching the book instead of breaking.
 */
export function placesAvailable() {
  return Boolean(window.google && window.google.maps && window.google.maps.places);
}

function toRow(p) {
  const loc = p.geometry && p.geometry.location;
  return {
    placeId: p.place_id,
    name: p.name || '',
    address: p.formatted_address || p.vicinity || '',
    rating: p.rating,
    types: p.types || [],
    lat: loc ? loc.lat() : null,
    lng: loc ? loc.lng() : null,
  };
}

/** Free-text business search, biased to the current view when one is given. */
export function placesSearch(query, { bounds, limit = 20 } = {}) {
  return new Promise((resolve) => {
    if (!placesAvailable() || !query.trim()) { resolve([]); return; }
    const svc = new window.google.maps.places.PlacesService(document.createElement('div'));
    const req = { query };
    if (bounds) {
      req.locationBias = new window.google.maps.LatLngBounds(
        { lat: bounds.south, lng: bounds.west }, { lat: bounds.north, lng: bounds.east });
    }
    svc.textSearch(req, (res, status) => {
      resolve(status === 'OK' && res ? res.slice(0, limit).map(toRow) : []);
    });
  });
}

/** Businesses inside the current view — the prospecting half of Area Search. */
export function placesInArea(bounds, { keyword = '', limit = 20 } = {}) {
  return new Promise((resolve) => {
    if (!placesAvailable() || !bounds) { resolve([]); return; }
    const gmaps = window.google.maps;
    const svc = new gmaps.places.PlacesService(document.createElement('div'));
    const b = new gmaps.LatLngBounds(
      { lat: bounds.south, lng: bounds.west }, { lat: bounds.north, lng: bounds.east });
    svc.textSearch({ query: keyword || 'business', bounds: b }, (res, status) => {
      resolve(status === 'OK' && res ? res.slice(0, limit).map(toRow) : []);
    });
  });
}

/* ------------------------------------------------------------ the adapter */
const STYLE_DARK = [
  { elementType: 'geometry', stylers: [{ color: '#14202e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#14202e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8fa6bd' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#2a3a4d' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f8ba5' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#16301f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#22303f' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2b3b4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a4b60' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e2a38' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1a26' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a6b85' }] },
];

const MAP_TYPES = {
  roadmap: { label: 'Street', id: 'roadmap' },
  hybrid: { label: 'Satellite', id: 'hybrid' },
  terrain: { label: 'Terrain', id: 'terrain' },
};

/**
 * @param {HTMLElement} host
 * @param {{center?: [number, number], zoom?: number, dark?: boolean}} opts
 */
export function googleMap(host, opts = {}) {
  const gm = window.google.maps;
  host.classList.add('gmap');
  host.innerHTML = '<div class="gmap-canvas"></div><div class="tilemap-markers"></div>';
  const canvas = $('.gmap-canvas', host);
  const markerLayer = $('.tilemap-markers', host);

  const map = new gm.Map(canvas, {
    center: { lat: opts.center ? opts.center[0] : 39.5, lng: opts.center ? opts.center[1] : -98.35 },
    zoom: opts.zoom ?? 4,
    mapTypeId: 'roadmap',
    // The app supplies its own controls, exactly like the original did.
    disableDefaultUI: true,
    gestureHandling: 'greedy',
    clickableIcons: false,
    keyboardShortcuts: true,
    styles: opts.dark ? STYLE_DARK : undefined,
  });

  let renderMarkers = null;
  let dragged = false;
  let source = 'roadmap';

  const size = () => ({ w: host.clientWidth || 1, h: host.clientHeight || 1 });

  /**
   * Screen pixel for a lat/lng.
   *
   * Google's own fromLatLngToContainerPixel is only available inside an
   * OverlayView, so this derives the same answer from the bounds: Web Mercator
   * is linear in world pixels, so interpolating between the corners is exact.
   */
  function project(lat, lng) {
    const b = map.getBounds();
    const { w, h } = size();
    if (!b) return { x: -9999, y: -9999 };
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    const z = 20;                                  // any zoom: the ratio cancels
    const wx = lngToWorld(lng, z);
    const wy = latToWorld(lat, z);
    let west = lngToWorld(sw.lng(), z);
    let east = lngToWorld(ne.lng(), z);
    if (east <= west) east += lngToWorld(180, z) * 2;   // the view crosses the date line
    let x = wx;
    if (x < west) x += lngToWorld(180, z) * 2;
    const north = latToWorld(ne.lat(), z);
    const south = latToWorld(sw.lat(), z);
    return {
      x: ((x - west) / (east - west)) * w,
      y: ((wy - north) / (south - north)) * h,
    };
  }

  function unproject(px, py) {
    const b = map.getBounds();
    const { w, h } = size();
    if (!b) return { lat: 0, lng: 0 };
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    return {
      lat: ne.lat() + (py / h) * (sw.lat() - ne.lat()),
      lng: sw.lng() + (px / w) * (ne.lng() - sw.lng()),
    };
  }

  function draw() {
    if (typeof renderMarkers === 'function') renderMarkers(markerLayer, project, view());
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  };

  const listeners = [
    map.addListener('bounds_changed', schedule),
    map.addListener('zoom_changed', schedule),
    map.addListener('idle', schedule),
    map.addListener('dragstart', () => { dragged = false; }),
    map.addListener('drag', () => { dragged = true; }),
    map.addListener('dragend', () => { setTimeout(() => { dragged = false; }, 60); }),
  ];

  function view() {
    const b = map.getBounds();
    const c = map.getCenter();
    return {
      lat: c ? c.lat() : 0,
      lng: c ? c.lng() : 0,
      zoom: map.getZoom(),
      bounds: b
        ? { north: b.getNorthEast().lat(), east: b.getNorthEast().lng(),
            south: b.getSouthWest().lat(), west: b.getSouthWest().lng() }
        : null,
    };
  }

  const api = {
    host,
    engine: 'google',
    map,
    get state() { const v = view(); return { lat: v.lat, lng: v.lng, zoom: v.zoom, source }; },
    project,
    unproject,
    view,
    fit(points, pad = 64) {
      const pts = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (!pts.length) return;
      if (pts.length === 1) { map.setCenter({ lat: pts[0].lat, lng: pts[0].lng }); map.setZoom(15); return; }
      const b = new gm.LatLngBounds();
      pts.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(b, pad);
    },
    setZoom: (z) => map.setZoom(z),
    zoomBy: (d) => map.setZoom((map.getZoom() || 4) + d),
    setCenter(lat, lng, z) {
      map.setCenter({ lat, lng });
      if (typeof z === 'number') map.setZoom(z);
    },
    /** The layers menu switches Google's own map types here. */
    setSource(name) {
      const t = MAP_TYPES[name];
      if (!t) return;
      source = name;
      map.setMapTypeId(t.id);
    },
    sources: MAP_TYPES,
    onRender(fn) { renderMarkers = fn; schedule(); },
    get dragged() { return dragged; },
    redraw: schedule,
    setTheme(dark) { map.setOptions({ styles: dark ? STYLE_DARK : null }); },
    destroy() {
      listeners.forEach((l) => { try { l.remove(); } catch { /* already gone */ } });
      host.innerHTML = '';
    },
  };
  return api;
}
