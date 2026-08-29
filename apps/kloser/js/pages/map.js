/**
 * Map — the territory, on a real map.
 *
 * The original CRM ran Google Maps with the field controls floated over it, so
 * this is the same shape: a full-bleed street map, Area Search / Biz Search /
 * Select Leads top-left, Filters top-right, and the zoom stack bottom-right.
 *
 * On placement: the HTML export carried street addresses but no coordinates,
 * and no geocoder is reachable from this build, so a lead sits at its city's
 * center with a deterministic spread — the same lead lands in the same spot
 * every time. The screen says so rather than implying street precision.
 */
import { el, esc, $, $$, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data } from '../core/store.js';
import { num, parseAddress, seeded, telHref } from '../core/format.js';
import { stageBadge, emptyState } from '../components/ui.js';
import { tileMap, TILE_SOURCES } from '../components/tilemap.js';
import {
  loadGoogleMaps, googleMap, getMapsKey, setMapsKey, geocodeAddresses, cachedGeocodes,
  placesAvailable, placesSearch, placesInArea,
} from '../components/gmap.js';
import { openLead } from './leads.js';
import { toast, modal, menu } from '../components/overlays.js';
import { setQuery } from '../core/router.js';
import { prefs, savePrefs, subscribe } from '../core/store.js';

const STAGE_TONE = {
  'Prospecting': '#AAAFB5', 'Follow Up': '#00BAE6', 'Appointment Set': '#0090E9',
  'Appointment Held': '#7C5CFF', 'Business Card Lead': '#E8A317', 'WPI Hot Lead': '#FF7A45',
  'Giving Payments': '#4FE778', 'Deal Signed': '#00C271', 'Customer': '#00A88A', 'Lost': '#E5484D',
};

/** ~1.2 km of spread, so a hundred Missoula leads are distinguishable but honest. */
const SPREAD_DEG = 0.011;

let NOTE = '';

function placeLead(lead, geo) {
  const { city, state, zip } = parseAddress(lead.address);
  const key = `${city}, ${state}`;
  const c = geo[key] || geo[key.toUpperCase()];
  if (!c) return null;
  const rand = seeded(`${lead.name}|${lead.address}`);
  const lat = c[0] + (rand() - 0.5) * SPREAD_DEG;
  // Longitude degrees shrink with latitude; widen so the spread looks circular.
  const lng = c[1] + (rand() - 0.5) * (SPREAD_DEG / Math.cos((c[0] * Math.PI) / 180));
  return { ...lead, city, state, zip, lat, lng, cityKey: key };
}

export default {
  title: 'Map',
  // The map is the screen, not a card on it — same as the original.
  fullBleed: true,

  async view({ query }) {
    const [leads, geoDoc] = await Promise.all([data('leads'), data('geo')]);
    const geo = geoDoc.cities || {};
    const pins = leads.map((l) => placeLead(l, geo)).filter(Boolean);
    const node = el('<div class="page map-page"></div>');

    const states = [...new Set(pins.map((p) => p.state))].sort();
    const stages = [...new Set(pins.map((p) => p.stage))];
    const owners = [...new Set(pins.map((p) => p.owner).filter(Boolean))].sort();

    node.appendChild(el(`
      <section class="mapview" id="mapview">
        <div class="mapview-canvas" id="map-canvas" role="application"
             aria-label="Lead map. Arrow keys pan, plus and minus zoom."></div>

        <div class="map-overlay tl map-tools">
          <button class="map-tool" id="map-area" title="Search this area">
            ${icon('pin', { size: 15 })}<span>Area Search</span></button>
          <button class="map-tool" id="map-biz" title="Find a business">
            ${icon('building', { size: 15 })}<span>Biz Search</span></button>
          <button class="map-tool" id="map-select" aria-pressed="false" title="Select leads on the map">
            ${icon('target', { size: 15 })}<span>Select Leads</span></button>
        </div>

        <button class="map-overlay tr btn btn-primary sm" id="map-filters" aria-haspopup="dialog">
          ${icon('filter', { size: 14 })}Filters<span class="map-filter-count" id="map-filter-count" hidden></span>
        </button>

        <div class="map-overlay br map-stack">
          <button id="map-layers" aria-label="Base map and clustering" title="Layers">${icon('layers', { size: 16 })}</button>
          <button id="map-locate" aria-label="My location" title="My location">${icon('navigation', { size: 16 })}</button>
          <button id="map-reset" aria-label="Fit every pin" title="Fit every pin">${icon('target', { size: 16 })}</button>
          <button id="map-in" aria-label="Zoom in" title="Zoom in">${icon('plus', { size: 16 })}</button>
          <button id="map-out" aria-label="Zoom out" title="Zoom out">${icon('minus', { size: 16 })}</button>
        </div>

        <div class="map-overlay bl map-legend" id="map-legend"></div>
        <div class="map-overlay tl map-count" id="map-count"></div>

        <div class="map-selbar" id="map-selbar" hidden>
          <span class="strong tnum" id="map-selcount">0 selected</span>
          <span class="spacer"></span>
          <button class="btn btn-secondary sm" id="map-sel-route">${icon('route', { size: 14 })}Add to route</button>
          <button class="btn btn-secondary sm" id="map-sel-export">${icon('download', { size: 14 })}Export</button>
          <button class="btn btn-ghost sm" id="map-sel-clear">Clear</button>
        </div>

        <div class="map-lasso" id="map-lasso" hidden><div class="map-band" hidden></div></div>
        <div class="map-boot" id="map-boot" hidden></div>
        <div class="map-card" id="map-detail" hidden></div>
        <div class="map-empty" id="map-empty" hidden></div>
      </section>`));

    node._pins = pins;
    NOTE = geoDoc.note || '';
    node._meta = { states, stages, owners };
    return node;
  },

  mount(root, { query }) {
    const page = root.firstElementChild;
    const pins = page._pins;
    const { states, stages, owners } = page._meta;

    const filters = {
      q: query.q || '', state: query.state || '', stage: query.stage || '',
      owner: query.owner || '', bounds: null,
    };
    const selection = new Set();
    let selectMode = false;
    let clustering = true;
    let groups = [];

    const canvas = $('#map-canvas', root);
    const detail = $('#map-detail', root);
    const legend = $('#map-legend', root);
    const emptyEl = $('#map-empty', root);

    let map = null;                 // set by boot(); every handler guards on it
    const keyOf = (p) => `${p.name}|${p.address}`;

    /* Exact coordinates, once Google has resolved them, override the city
       placement — the pin moves from the middle of town to the actual door. */
    function applyGeocodes(hits) {
      let moved = 0;
      pins.forEach((p) => {
        const c = hits[p.address];
        if (c && Array.isArray(c)) { p.lat = c[0]; p.lng = c[1]; p.exact = true; moved += 1; }
      });
      return moved;
    }
    applyGeocodes(cachedGeocodes());

    /* ------------------------------------------------------------ filtering */
    function visible() {
      const q = filters.q.trim().toLowerCase();
      return pins.filter((p) => {
        if (filters.state && p.state !== filters.state) return false;
        if (filters.stage && p.stage !== filters.stage) return false;
        if (filters.owner && p.owner !== filters.owner) return false;
        if (filters.bounds) {
          const b = filters.bounds;
          if (p.lat > b.north || p.lat < b.south || p.lng < b.west || p.lng > b.east) return false;
        }
        if (!q) return true;
        return [p.name, p.address, p.customer, p.owner, p.stage]
          .some((v) => String(v || '').toLowerCase().includes(q));
      });
    }

    const activeFilterCount = () =>
      ['state', 'stage', 'owner'].filter((k) => filters[k]).length
      + (filters.bounds ? 1 : 0) + (filters.q ? 1 : 0);

    /* ------------------------------------------------------- marker painting */
    /** Greedy absorb: every cluster center ends up more than r apart, so no two
        markers can sit on top of each other and swallow one another's clicks. */
    function cluster(points, project, r) {
      const out = [];
      points.forEach((p) => {
        const s = project(p.lat, p.lng);
        const hit = out.find((c) => Math.hypot(c.x - s.x, c.y - s.y) < r);
        if (hit) {
          hit.members.push(p);
          const n = hit.members.length;
          hit.x = (hit.x * (n - 1) + s.x) / n;
          hit.y = (hit.y * (n - 1) + s.y) / n;
        } else {
          out.push({ x: s.x, y: s.y, members: [p] });
        }
      });
      return out;
    }

    function paint(layer, project) {
      const list = visible();
      const { width: w, height: h } = canvas.getBoundingClientRect();
      groups = clustering
        ? cluster(list, project, 34)
        : list.map((p) => { const s = project(p.lat, p.lng); return { x: s.x, y: s.y, members: [p] }; });

      const meHTML = (() => {
        if (!mePin) return '';
        const s2 = project(mePin.lat, mePin.lng);
        if (s2.x < -40 || s2.y < -40 || s2.x > w + 40 || s2.y > h + 40) return '';
        return `<span class="tilemap-me" style="left:${s2.x}px;top:${s2.y}px" aria-label="Your location"></span>`;
      })();

      layer.innerHTML = meHTML + groups.map((g, gi) => {
        if (g.x < -60 || g.y < -60 || g.x > w + 60 || g.y > h + 60) return '';
        const n = g.members.length;
        if (n === 1) {
          const p = g.members[0];
          const tone = STAGE_TONE[p.stage] || 'var(--wp-blue)';
          const on = selection.has(keyOf(p));
          return `<button class="tilemap-marker${on ? ' is-selected' : ''}" data-group="${gi}"
            style="left:${g.x}px;top:${g.y}px;--tone:${tone}"
            title="${esc(p.name)} — ${esc(p.stage)}" aria-label="${esc(p.name)}, ${esc(p.stage)}">
            <svg viewBox="0 0 20 26" width="20" height="26" aria-hidden="true">
              <path d="M10 25.5S19 15.7 19 9.6A9 9 0 1 0 1 9.6c0 6.1 9 15.9 9 15.9Z"
                fill="${tone}" stroke="#fff" stroke-width="1.6"/>
              <circle cx="10" cy="9.6" r="3.1" fill="#fff"/>
            </svg></button>`;
        }
        const size = n > 60 ? 46 : n > 20 ? 40 : 34;
        const tone = STAGE_TONE[g.members[0].stage] || 'var(--wp-blue)';
        const picked = g.members.filter((p) => selection.has(keyOf(p))).length;
        return `<button class="tilemap-cluster${picked ? ' is-selected' : ''}" data-group="${gi}"
          style="left:${g.x}px;top:${g.y}px;width:${size}px;height:${size}px;--tone:${tone}"
          aria-label="${n} leads here. Activate to zoom in.">${num(n)}</button>`;
      }).join('');

      legend.innerHTML = legendHTML(list);
      const countEl = $('#map-count', root);
      if (countEl) {
        countEl.innerHTML = `<span class="map-chip">${num(list.length)} of ${num(pins.length)} leads</span>`
          + (list.some((p) => !p.exact)
            ? `<span class="map-chip subtle" title="${esc(NOTE)}">${icon('info', { size: 11 })}city-level</span>` : '');
      }
      emptyEl.hidden = list.length > 0;
      if (!list.length) {
        emptyEl.innerHTML = emptyState({
          title: 'No leads in view',
          text: filters.bounds
            ? 'Nothing matches here. Pan somewhere else, or fit every pin to clear the area filter.'
            : 'Clear a filter to bring the book back.',
          iconName: 'map',
          action: '<button class="btn btn-secondary sm" data-clear-all>Clear filters</button>',
        });
      }
      const count = activeFilterCount();
      const badge = $('#map-filter-count', root);
      if (badge) { badge.hidden = !count; badge.textContent = String(count); }
    }

    function legendHTML(list) {
      const by = new Map();
      list.forEach((p) => by.set(p.stage, (by.get(p.stage) || 0) + 1));
      const rows = [...by.entries()].sort((a, b) => b[1] - a[1]);
      return `<div class="map-legend-rows">${rows.map(([s, n]) => `
        <span class="map-legend-row"><i style="background:${STAGE_TONE[s] || 'var(--wp-blue)'}"></i>${esc(s)}
        <b class="tnum">${num(n)}</b></span>`).join('')}</div>
        <div class="map-legend-foot">${num(list.length)} of ${num(pins.length)} shown${filters.bounds ? ' · this area' : ''}</div>`;
    }

    /* ------------------------------------------------------------ interaction */
    canvas.addEventListener('click', (e) => {
      if (map.dragged) return;                    // a drag is not a click
      const t = e.target instanceof Element ? e.target.closest('[data-group]') : null;
      if (!t) { detail.hidden = true; return; }
      const g = groups[Number(t.dataset.group)];
      if (!g) return;
      if (selectMode) { g.members.forEach(toggleSelect); return; }
      if (g.members.length === 1) showDetail(g.members[0]);
      else map.fit(g.members, 80);
    });

    function toggleSelect(p) {
      const k = keyOf(p);
      if (selection.has(k)) selection.delete(k); else selection.add(k);
      const c = $('#map-selcount', root);
      if (c) c.textContent = `${selection.size} selected`;
      if (map) map.redraw();
    }

    function showDetail(p) {
      detail.hidden = false;
      detail.innerHTML = `
        <div class="row-b" style="align-items:flex-start;gap:var(--s-3)">
          <div style="min-width:0">
            <div class="strong truncate" style="font-size:var(--fs-15)">${esc(p.name)}</div>
            <div class="subtle" style="font-size:var(--fs-12);margin-top:2px">${esc(p.address)}</div>
          </div>
          <button class="icon-btn" id="map-detail-close" style="width:26px;height:26px" aria-label="Close">${icon('close', { size: 14 })}</button>
        </div>
        <div class="row wrap" style="gap:var(--s-2);margin-top:var(--s-3)">
          ${stageBadge(p.stage)}
          ${p.owner ? `<span class="badge outline">${icon('user', { size: 11 })}${esc(p.owner)}</span>` : ''}
        </div>
        <div class="map-note">${icon('info', { size: 12 })}Pin sits at the center of ${esc(p.city)} — the export carried no coordinates.</div>
        <div class="row" style="gap:6px;margin-top:var(--s-3)">
          ${p.phone && p.phone !== '—' ? `<a class="btn btn-accent sm grow" href="${telHref(p.phone)}">${icon('phone', { size: 13 })}Call</a>` : ''}
          <button class="btn btn-secondary sm grow" id="map-detail-open">Open lead</button>
        </div>`;
      $('#map-detail-close', detail).addEventListener('click', () => { detail.hidden = true; });
      $('#map-detail-open', detail).addEventListener('click', () => openLead(p));
      map.setCenter(p.lat, p.lng, Math.max(map.state.zoom, 12));
    }

    /* ----------------------------------------------------------- the controls */
    $('#map-in', root).addEventListener('click', () => map && map.zoomBy(1));
    $('#map-out', root).addEventListener('click', () => map && map.zoomBy(-1));
    $('#map-reset', root).addEventListener('click', () => {
      if (!map) return;
      filters.bounds = null;
      const list = visible();
      map.fit(list.length ? list : pins, 70);
      toast('Fit to every pin', { timeout: 1500 });
    });

    $('#map-area', root).addEventListener('click', () => {
      if (!map) return;
      const bounds = map.view().bounds;
      filters.bounds = bounds;
      map.redraw();
      openAreaSearch(visible(), bounds, {
        onShow: (p) => showDetail(p),
        onClear: () => { filters.bounds = null; map.redraw(); map.fit(visible(), 70); },
      });
    });

    $('#map-biz', root).addEventListener('click', () =>
      openBizSearch(pins, showDetail, map ? map.view().bounds : null,
        (p) => map && map.setCenter(p.lat, p.lng, 16)));

    const lasso = $('#map-lasso', root);
    $('#map-select', root).addEventListener('click', (e) => {
      selectMode = !selectMode;
      e.currentTarget.setAttribute('aria-pressed', String(selectMode));
      $('#map-selbar', root).hidden = !selectMode;
      canvas.classList.toggle('is-selecting', selectMode);
      lasso.hidden = !selectMode;
      if (!selectMode) selection.clear();
      $('#map-selcount', root).textContent = `${selection.size} selected`;
      if (map) map.redraw();
      if (selectMode) {
        toast('Select mode on', {
          text: 'Drag a box over the map to take everything inside it, or tap pins one by one.',
          timeout: 3200,
        });
      }
    });

    /* The lasso sits above the map while select mode is on, so the drag draws a
       box instead of panning. Tap-through still reaches pins: a click that never
       moved is forwarded to whatever was underneath. */
    let band = null;
    lasso.addEventListener('pointerdown', (e) => {
      band = { x0: e.offsetX, y0: e.offsetY, x1: e.offsetX, y1: e.offsetY };
      lasso.setPointerCapture(e.pointerId);
    });
    lasso.addEventListener('pointermove', (e) => {
      if (!band) return;
      band.x1 = e.offsetX;
      band.y1 = e.offsetY;
      const box = $('.map-band', lasso);
      box.hidden = false;
      box.style.left = `${Math.min(band.x0, band.x1)}px`;
      box.style.top = `${Math.min(band.y0, band.y1)}px`;
      box.style.width = `${Math.abs(band.x1 - band.x0)}px`;
      box.style.height = `${Math.abs(band.y1 - band.y0)}px`;
    });
    lasso.addEventListener('pointerup', (e) => {
      if (!band) return;
      const moved = Math.abs(band.x1 - band.x0) + Math.abs(band.y1 - band.y0);
      $('.map-band', lasso).hidden = true;
      try { lasso.releasePointerCapture(e.pointerId); } catch { /* already gone */ }
      if (moved < 8) {
        // A tap, not a drag: hand it to the pin underneath.
        band = null;
        lasso.hidden = true;
        const under = document.elementFromPoint(e.clientX, e.clientY);
        lasso.hidden = false;
        const hit = under instanceof Element ? under.closest('[data-group]') : null;
        if (hit) {
          const g = groups[Number(hit.dataset.group)];
          if (g) g.members.forEach(toggleSelect);
        }
        return;
      }
      const l = Math.min(band.x0, band.x1);
      const r = Math.max(band.x0, band.x1);
      const t = Math.min(band.y0, band.y1);
      const b = Math.max(band.y0, band.y1);
      band = null;
      let added = 0;
      visible().forEach((p) => {
        const s2 = map.project(p.lat, p.lng);
        if (s2.x >= l && s2.x <= r && s2.y >= t && s2.y <= b) {
          const k = keyOf(p);
          if (!selection.has(k)) { selection.add(k); added += 1; }
        }
      });
      $('#map-selcount', root).textContent = `${selection.size} selected`;
      map.redraw();
      toast(added ? `${num(added)} added to the selection` : 'Nothing inside that box', {
        timeout: 1800, tone: added ? 'good' : 'warn',
      });
    });

    $('#map-sel-clear', root).addEventListener('click', () => {
      selection.clear();
      $('#map-selcount', root).textContent = '0 selected';
      if (map) map.redraw();
    });
    $('#map-sel-route', root).addEventListener('click', () => {
      if (!selection.size) { toast('Nothing selected yet', { tone: 'warn', timeout: 1800 }); return; }
      toast(`${selection.size} stop${selection.size === 1 ? '' : 's'} queued`, {
        text: 'Open Routes to order them and start the run.', tone: 'good',
      });
    });
    $('#map-sel-export', root).addEventListener('click', () => {
      const picked = pins.filter((p) => selection.has(keyOf(p)));
      if (!picked.length) { toast('Nothing selected yet', { tone: 'warn', timeout: 1800 }); return; }
      exportPins(picked);
    });

    $('#map-layers', root).addEventListener('click', (e) => {
      if (!map) return;
      const sources = map.sources || TILE_SOURCES;
      menu(e.currentTarget, [
        { heading: map.engine === 'google' ? 'Google base map' : 'Base map' },
        ...Object.entries(sources).map(([key, s]) => ({
          label: s.label, icon: 'map', checked: map.state.source === key,
          onSelect: () => { map.setSource(key); toast(`${s.label} map`, { timeout: 1400 }); },
        })),
        { sep: true },
        {
          label: clustering ? 'Show every pin' : 'Group nearby pins', icon: 'layers',
          onSelect: () => { clustering = !clustering; map.redraw(); },
        },
        { sep: true },
        {
          label: getMapsKey() ? 'Google Maps key…' : 'Add Google Maps key…', icon: 'lock',
          onSelect: openKeyDialog,
        },
      ], { align: 'right', width: 230 });
    });

    $('#map-locate', root).addEventListener('click', () => {
      toast('Finding you…', { timeout: 1400 });
      goToMe(true);
    });

    $('#map-filters', root).addEventListener('click', () =>
      openFilters({ filters, states, stages, owners }, () => {
        setQuery({ q: filters.q, state: filters.state, stage: filters.stage, owner: filters.owner });
        if (map) map.redraw();
      }));

    root.addEventListener('click', (e) => {
      if (e.target instanceof Element && e.target.closest('[data-clear-all]')) {
        filters.q = ''; filters.state = ''; filters.stage = ''; filters.owner = ''; filters.bounds = null;
        setQuery({ q: '', state: '', stage: '', owner: '' });
        if (map) map.fit(pins, 70);
      }
    });

    /* ---------------------------------------------------------------- start */
    let stopGeocode = () => {};

    function start(engine) {
      map = engine;
      map.onRender(paint);
      const initial = visible();
      map.fit(initial.length ? initial : pins, 70);
      if (query.q) toast(`Filtered to “${query.q}”`, { timeout: 2200 });
      goToMe();
    }

    /* A field rep opens this standing somewhere, so open on where they are and
       drop a marker for it. If they refuse the permission or it times out, the
       fit-to-every-pin view we already drew stands. */
    let mePin = null;
    function goToMe(explicit = false) {
      if (!navigator.geolocation) {
        if (explicit) toast('Location unavailable', { text: 'This browser will not share a position.', tone: 'warn' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!map) return;
          mePin = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          map.setCenter(mePin.lat, mePin.lng, explicit ? 14 : 13);
          map.redraw();
          const near = pins.filter((p) => haversineMi(p, mePin) <= 25).length;
          toast('Centered on you', {
            text: near
              ? `${num(near)} lead${near === 1 ? '' : 's'} within 25 miles.`
              : `Nothing in the book within 25 miles. Accurate to about ${Math.round(mePin.accuracy)} m.`,
            tone: 'good', timeout: 3400,
          });
        },
        (err) => {
          if (!explicit) return;                       // never nag on a plain visit
          toast('Could not get a fix', {
            text: err && err.code === 1
              ? 'Location is blocked for this site. Allow it in the address bar and try again.'
              : 'Try again in a moment, or move somewhere with a clearer signal.',
            tone: 'warn',
          });
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 },
      );
    }

    /** Turn city pins into door pins in the background, and say so when done. */
    function beginGeocoding() {
      const pending = pins.filter((p) => !p.exact).map((p) => p.address);
      if (!pending.length) return;
      stopGeocode = geocodeAddresses(pending, {
        onEach: (address, coord) => {
          if (!coord) return;
          pins.filter((p) => p.address === address).forEach((p) => {
            p.lat = coord[0]; p.lng = coord[1]; p.exact = true;
          });
        },
        onDone: (hits, info) => {
          const exact = applyGeocodes(hits);
          if (map) map.redraw();
          if (info.fetched) {
            toast(`${num(info.fetched)} address${info.fetched === 1 ? '' : 'es'} pinned exactly`, {
              text: info.limited
                ? 'Google stopped us at the daily quota — the rest stay at city level for now.'
                : `${num(exact)} of ${num(pins.length)} pins now sit on the real address.`,
              tone: info.limited ? 'warn' : 'good',
            });
          }
        },
      });
    }

    (async function boot() {
      const banner = $('#map-boot', root);
      if (getMapsKey()) {
        try {
          await loadGoogleMaps();
          if (!root.isConnected) return;
          banner.hidden = true;
          start(googleMap(canvas, {
            center: [39.5, -98.35], zoom: 4,
            dark: document.documentElement.dataset.theme === 'dark',
          }));
          beginGeocoding();
          return;
        } catch (err) {
          if (!root.isConnected) return;
          showBootNote(banner, err && err.message);
        }
      } else {
        showBootNote(banner, 'no-key');
      }
      start(tileMap(canvas, { center: [39.5, -98.35], zoom: 4 }));
    }());

    function showBootNote(banner, reason) {
      const why = {
        'no-key': 'Put a Google Maps API key in config.js — or paste one here — and this becomes the same map the old site used.',
        auth: 'Google rejected that API key. Check it is enabled for Maps JavaScript API and this domain.',
        network: 'Google Maps could not be reached.',
        timeout: 'Google Maps did not load in time.',
      }[reason] || 'Google Maps is unavailable.';
      if (prefs.mapNoticeDismissed === reason) return;   // said once is enough
      banner.hidden = false;
      banner.innerHTML = `
        <div class="map-boot-inner">
          ${icon('info', { size: 16 })}
          <div class="grow">
            <div class="banner-title">Using the built-in map</div>
            <div class="banner-text">${esc(why)}</div>
          </div>
          <button class="btn btn-primary sm" id="map-addkey">${icon('lock', { size: 14 })}Add key</button>
          <button class="icon-btn" id="map-boot-close" aria-label="Dismiss">${icon('close', { size: 15 })}</button>
        </div>`;
      $('#map-addkey', banner).addEventListener('click', openKeyDialog);
      $('#map-boot-close', banner).addEventListener('click', () => {
        banner.hidden = true;
        savePrefs({ mapNoticeDismissed: reason });
      });
    }

    /* The map has to change with the rest of the site. Google needs telling
       (its styles are set in JS); the built-in map is styled in CSS off the
       same data-theme attribute, so it follows on its own. */
    const isDark = () => document.documentElement.dataset.theme === 'dark';
    const offTheme = subscribe('theme', () => {
      requestAnimationFrame(() => { if (map && map.setTheme) map.setTheme(isDark()); });
    });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { if (map && map.setTheme) map.setTheme(isDark()); };
    mq.addEventListener('change', onScheme);

    return () => {
      stopGeocode();
      if (typeof offTheme === 'function') offTheme();
      mq.removeEventListener('change', onScheme);
      if (map) map.destroy();
    };
  },
};

/* ------------------------------------------------------------------ helpers */
/** Great-circle miles, for "how much of the book is near me". */
function haversineMi(a, b) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function exportPins(list) {
  const head = ['Business', 'Stage', 'Owner', 'Address', 'City', 'State', 'Phone', 'Latitude', 'Longitude'];
  const rows = list.map((p) => [p.name, p.stage, p.owner, p.address, p.city, p.state, p.phone,
    p.lat.toFixed(5), p.lng.toFixed(5)]);
  const csv = [head, ...rows]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kloser-map-selection.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('Export ready', {
    text: `${list.length} pin${list.length === 1 ? '' : 's'} written, with coordinates.`, tone: 'good',
  });
}

/**
 * The key belongs to whoever is paying Google, so it lives in this browser's
 * preferences rather than in the source. Pasting one switches the map over on
 * the next visit to this screen.
 */
function openKeyDialog() {
  const dlg = modal({
    title: 'Google Maps key',
    subtitle: 'Use the same map the old site did',
    body: `<div class="col" style="gap:var(--s-4)">
      <div class="field">
        <label class="field-label" for="gk-key">Maps JavaScript API key</label>
        <input class="input mono" id="gk-key" placeholder="AIza…" value="${esc(getMapsKey())}"
               data-autofocus autocomplete="off" spellcheck="false">
        <div class="field-hint">Stored in this browser only. It is never sent anywhere except Google.</div>
      </div>
      <div class="banner">
        ${icon('info', { size: 16 })}
        <div class="grow">
          <div class="banner-title">The key needs two APIs enabled</div>
          <div class="banner-text">Maps JavaScript API draws the map; Geocoding API turns each lead's
            street address into an exact pin. Without geocoding, pins stay at city level.</div>
        </div>
      </div>
    </div>`,
    footer: `<button class="btn btn-ghost" id="gk-clear">Remove key</button>
             <span class="spacer"></span>
             <button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="gk-save">Save and reload map</button>`,
  });
  $('#gk-clear', dlg.node).addEventListener('click', () => {
    setMapsKey('');
    dlg.close();
    toast('Key removed', { text: 'The built-in map takes over on the next load.', timeout: 2600 });
  });
  $('#gk-save', dlg.node).addEventListener('click', () => {
    const v = $('#gk-key', dlg.node).value.trim();
    setMapsKey(v);
    dlg.close();
    toast(v ? 'Key saved' : 'Key removed', {
      text: v ? 'Reloading the Map screen to bring Google up.' : 'The built-in map takes over.',
      tone: 'good', timeout: 2400,
    });
    // The SDK can only be loaded once per document, so a reload is the honest
    // way to switch engines.
    setTimeout(() => location.reload(), 700);
  });
}

/**
 * Biz Search — find a business and fly to it.
 *
 * Searches the book first, because that always works. When a Google key is set
 * it also asks Places, so a rep can find somewhere that is not a lead yet — the
 * prospecting half of what this button did on the old site.
 */
function openBizSearch(pins, showDetail, bounds, flyTo) {
  const dlg = modal({
    title: 'Biz Search',
    subtitle: placesAvailable()
      ? 'Search the book, or find a business Google knows about'
      : 'Search every business in the book',
    body: `<div class="col" style="gap:var(--s-3)">
      <div class="field">
        <label class="field-label" for="bz-q">Business name or address</label>
        <input class="input" id="bz-q" placeholder="e.g. Fosters Tire and Automotive" data-autofocus autocomplete="off">
      </div>
      <div class="col" id="bz-hits" style="gap:4px;max-height:320px;overflow:auto"></div>
    </div>`,
    footer: '<button class="btn btn-secondary grow" data-close>Close</button>',
  });
  const input = $('#bz-q', dlg.node);
  const hits = $('#bz-hits', dlg.node);
  let token = 0;

  const row = (title, sub, attrs, tag) => `<button class="list-row" ${attrs}>
      <span class="grow" style="min-width:0;text-align:left">
        <span class="list-title truncate" style="display:block">${esc(title)}</span>
        <span class="list-sub truncate" style="display:block">${esc(sub)}</span></span>
      ${tag || ''}
      ${icon('chevronRight', { size: 15, cls: 'ico subtle' })}</button>`;

  async function paint() {
    const q = input.value.trim();
    const mine = ++token;
    if (!q) {
      hits.innerHTML = `<div class="subtle" style="font-size:var(--fs-12);padding:var(--s-2)">Start typing to search all ${pins.length} leads${placesAvailable() ? ' and everything Google knows nearby' : ''}.</div>`;
      return;
    }
    const lower = q.toLowerCase();
    const book = pins.filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(lower)).slice(0, 12);
    const render = (places) => {
      if (mine !== token) return;                       // a newer keystroke won
      hits.innerHTML =
        (book.length ? `<div class="eyebrow" style="padding:2px 4px">In the book</div>`
          + book.map((p, i) => row(p.name, p.address, `data-book="${i}"`,
            `<span class="badge outline">${esc(p.stage)}</span>`)).join('') : '')
        + (places.length ? `<div class="eyebrow" style="padding:8px 4px 2px">On Google</div>`
          + places.map((p, i) => row(p.name, p.address, `data-place="${i}"`,
            '<span class="badge accent">new</span>')).join('') : '')
        + (!book.length && !places.length
          ? '<div class="subtle" style="font-size:var(--fs-12);padding:var(--s-2)">Nothing matches that.</div>' : '');

      $$('[data-book]', hits).forEach((b) => b.addEventListener('click', () => {
        const p = book[Number(b.dataset.book)];
        dlg.close();
        if (p) setTimeout(() => showDetail(p), 220);
      }));
      $$('[data-place]', hits).forEach((b) => b.addEventListener('click', () => {
        const p = places[Number(b.dataset.place)];
        dlg.close();
        if (p && Number.isFinite(p.lat) && typeof flyTo === 'function') {
          flyTo(p);
          toast(p.name, { text: `${p.address} — not in the book yet.`, tone: 'info', timeout: 4200 });
        }
      }));
    };
    render([]);
    if (placesAvailable()) {
      const found = await placesSearch(q, { bounds, limit: 8 });
      render(found);
    }
  }
  input.addEventListener('input', debounce(paint, 220));
  paint();
}

/**
 * Area Search — what is in this view.
 *
 * Scopes the map to the current bounds and lists the leads inside it. With a
 * Google key it also lists businesses Google finds there that are not leads
 * yet, which is the point of the button on a door-knocking round.
 */
function openAreaSearch(inArea, bounds, { onShow, onClear }) {
  const dlg = modal({
    title: 'Area Search',
    subtitle: `${num(inArea.length)} lead${inArea.length === 1 ? '' : 's'} inside the current view`,
    body: `<div class="col" style="gap:var(--s-3)">
      <div class="col" style="gap:4px;max-height:340px;overflow:auto" id="as-body">
        ${inArea.length
          ? inArea.slice(0, 60).map((p, i) => `<button class="list-row" data-area="${i}">
              <span class="grow" style="min-width:0;text-align:left">
                <span class="list-title truncate" style="display:block">${esc(p.name)}</span>
                <span class="list-sub truncate" style="display:block">${esc(p.address)}</span></span>
              <span class="badge outline">${esc(p.stage)}</span>
              ${icon('chevronRight', { size: 15, cls: 'ico subtle' })}</button>`).join('')
          : '<div class="subtle" style="font-size:var(--fs-12);padding:var(--s-2)">No leads from the book are inside this view.</div>'}
      </div>
      ${placesAvailable()
        ? `<div class="row" style="gap:var(--s-2)">
             <input class="input sm grow" id="as-kw" placeholder="Prospect for… e.g. restaurants, auto repair" autocomplete="off">
             <button class="btn btn-secondary sm" id="as-find">${icon('search', { size: 14 })}Find</button>
           </div>
           <div class="col" id="as-places" style="gap:4px;max-height:220px;overflow:auto"></div>`
        : `<div class="banner">${icon('info', { size: 16 })}<div class="grow">
             <div class="banner-title">Prospecting needs a Google key</div>
             <div class="banner-text">With one set, Area Search also lists businesses Google finds
               here that are not in the book yet.</div></div></div>`}
    </div>`,
    footer: `<button class="btn btn-ghost" id="as-clear">Clear area filter</button>
             <span class="spacer"></span>
             <button class="btn btn-primary" data-close>Keep this area</button>`,
  });

  $$('[data-area]', dlg.node).forEach((b) => b.addEventListener('click', () => {
    const p = inArea[Number(b.dataset.area)];
    dlg.close();
    if (p && typeof onShow === 'function') setTimeout(() => onShow(p), 220);
  }));
  $('#as-clear', dlg.node).addEventListener('click', () => {
    dlg.close();
    if (typeof onClear === 'function') onClear();
    toast('Area filter cleared', { timeout: 1600 });
  });

  const find = $('#as-find', dlg.node);
  if (find) {
    find.addEventListener('click', async () => {
      const out = $('#as-places', dlg.node);
      const kw = $('#as-kw', dlg.node).value.trim();
      out.innerHTML = '<div class="subtle" style="font-size:var(--fs-12);padding:var(--s-2)">Asking Google…</div>';
      const found = await placesInArea(bounds, { keyword: kw, limit: 20 });
      const known = new Set(inArea.map((p) => p.name.toLowerCase()));
      const fresh = found.filter((p) => !known.has((p.name || '').toLowerCase()));
      out.innerHTML = fresh.length
        ? `<div class="eyebrow" style="padding:8px 4px 2px">${fresh.length} not in the book</div>`
          + fresh.map((p) => `<div class="list-row" style="cursor:default">
              <span class="grow" style="min-width:0;text-align:left">
                <span class="list-title truncate" style="display:block">${esc(p.name)}</span>
                <span class="list-sub truncate" style="display:block">${esc(p.address)}</span></span>
              ${p.rating ? `<span class="badge outline">${p.rating}★</span>` : ''}</div>`).join('')
        : '<div class="subtle" style="font-size:var(--fs-12);padding:var(--s-2)">Google found nothing new here.</div>';
    });
  }
}

function openFilters({ filters, states, stages, owners }, onApply) {
  const dlg = modal({
    title: 'Filters',
    subtitle: 'Narrow what the map is showing',
    body: `<div class="col" style="gap:var(--s-4)">
      <div class="field">
        <label class="field-label" for="mf-q">Search</label>
        <input class="input" id="mf-q" placeholder="Business, address, owner…" value="${esc(filters.q)}" data-autofocus autocomplete="off">
      </div>
      <div class="grid g-3" style="gap:var(--s-3)">
        <div class="field"><label class="field-label" for="mf-state">State</label>
          <select class="select" id="mf-state">
            <option value="">All states</option>
            ${states.map((s) => `<option${s === filters.state ? ' selected' : ''}>${esc(s)}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label" for="mf-stage">Stage</label>
          <select class="select" id="mf-stage">
            <option value="">All stages</option>
            ${stages.map((s) => `<option${s === filters.stage ? ' selected' : ''}>${esc(s)}</option>`).join('')}
          </select></div>
        <div class="field"><label class="field-label" for="mf-owner">Owner</label>
          <select class="select" id="mf-owner">
            <option value="">All owners</option>
            ${owners.map((s) => `<option${s === filters.owner ? ' selected' : ''}>${esc(s)}</option>`).join('')}
          </select></div>
      </div>
      ${filters.bounds ? `<div class="banner">${icon('info', { size: 16 })}
        <div class="grow"><div class="banner-title">Area filter is on</div>
        <div class="banner-text">Only leads inside the current view are showing. Fit every pin to clear it.</div></div></div>` : ''}
    </div>`,
    footer: `<button class="btn btn-ghost" id="mf-clear">Clear all</button>
             <span class="spacer"></span>
             <button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="mf-apply">Apply</button>`,
  });
  $('#mf-clear', dlg.node).addEventListener('click', () => {
    filters.q = ''; filters.state = ''; filters.stage = ''; filters.owner = ''; filters.bounds = null;
    dlg.close();
    onApply();
  });
  $('#mf-apply', dlg.node).addEventListener('click', () => {
    filters.q = $('#mf-q', dlg.node).value;
    filters.state = $('#mf-state', dlg.node).value;
    filters.stage = $('#mf-stage', dlg.node).value;
    filters.owner = $('#mf-owner', dlg.node).value;
    dlg.close();
    onApply();
  });
}
