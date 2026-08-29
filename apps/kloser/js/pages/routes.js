/** Routes — planned door routes, completed runs and field sessions. */
import { el, esc, $, $$, onToolbarChange } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data } from '../core/store.js';
import { num } from '../core/format.js';
import { pageHeader, statCard, runCounters, tabs, mountTabs, emptyState, personCell, statusBadge, searchField } from '../components/ui.js';
import { drawer, toast, modal, menu } from '../components/overlays.js';

export default {
  title: 'Routes',

  async view() {
    const routes = await data('routes');
    const node = el('<div class="page"></div>');

    const stops = routes.reduce((s, r) => s + (Number(r.stops) || 0), 0);
    const avgProgress = Math.round(routes.reduce((s, r) => s + parseInt(r.progress, 10), 0) / (routes.length || 1));

    node.appendChild(el(pageHeader({
      title: 'Routes',
      lede: 'Plan the day before the day starts — order the stops, then let the app navigate stop to stop.',
      meta: `<span class="badge accent">${num(routes.length)} routes</span>
             <span class="badge outline">${num(stops)} stops planned</span>`,
      actions: `<button class="btn btn-secondary sm" id="route-session">${icon('play', { size: 14 })}Field session</button>
                <button class="btn btn-primary sm" id="route-new">${icon('plus', { size: 15 })}Create route</button>`,
    })));

    node.appendChild(el(`<section class="grid g-4">
      ${statCard({ label: 'Active routes', value: routes.length, icon: 'route', tone: 'var(--wp-blue)', foot: 'in draft or running' })}
      ${statCard({ label: 'Stops planned', value: stops, icon: 'pin', tone: 'var(--wp-cyan)', foot: 'across all routes' })}
      ${statCard({ label: 'Average progress', value: `${avgProgress}%`, icon: 'gauge', tone: 'var(--wp-green)', foot: 'of planned stops completed' })}
      ${statCard({ label: 'Route owners', value: new Set(routes.map((r) => r.owner)).size, icon: 'users', tone: 'var(--wp-mint)', foot: 'reps running routes' })}
    </section>`));

    node.appendChild(el(tabs({
      name: 'routes', value: 'routes',
      items: [
        { value: 'routes', label: 'Routes', count: routes.length },
        { value: 'completed', label: 'Completed', count: 0 },
        { value: 'sessions', label: 'Field sessions', count: 0 },
      ],
    })));

    node.appendChild(el(`
      <div class="toolbar" id="routes-toolbar">
        ${searchField({ name: 'routeName', placeholder: 'Filter by route name…' })}
        <span class="sep"></span>
        <select class="select sm" id="routes-owner" aria-label="Owner" style="width:auto">
          <option value="">All owners</option>
          ${[...new Set(routes.map((r) => r.owner))].sort().map((o) => `<option>${esc(o)}</option>`).join('')}
        </select>
        <select class="select sm" id="routes-status" aria-label="Status" style="width:auto">
          <option value="">All statuses</option>
          ${[...new Set(routes.map((r) => r.status))].sort().map((o) => `<option>${esc(o)}</option>`).join('')}
        </select>
        <span class="spacer"></span>
        <span class="muted" style="font-size:var(--fs-12)" id="routes-count"></span>
      </div>`));

    node.appendChild(el('<div id="routes-panel" class="col" style="gap:var(--s-4)"></div>'));
    node._routes = routes;
    return node;
  },

  mount(root) {
    runCounters(root);
    const routes = root.firstElementChild._routes;
    const panel = $('#routes-panel', root);

    const draw = (tab) => {
      if (tab === 'routes') {
        const q = ($('[data-search]', root)?.value || '').trim().toLowerCase();
        const owner = $('#routes-owner', root).value;
        const status = $('#routes-status', root).value;
        const list = routes.filter((r) => {
          if (owner && r.owner !== owner) return false;
          if (status && r.status !== status) return false;
          return !q || r.name.toLowerCase().includes(q);
        });
        $('#routes-count', root).textContent = `${list.length} shown`;
        $('#routes-toolbar', root).hidden = false;
        panel.innerHTML = list.length ? `
          <section class="card flush reveal">
            <div class="table-wrap scroll-x">
              <table class="data">
                <thead><tr>
                  <th>Route Name</th><th>Owner</th><th>Date</th>
                  <th class="num">Stops</th><th>Distance</th><th>Status</th><th>Progress</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  ${list.map((r, i) => {
                    const stops = Number(r.stops) || 0;
                    const progress = parseInt(r.progress, 10) || 0;
                    return `<tr class="clickable" data-route="${esc(r.name)}"
                        style="animation:rise-sm 260ms var(--ease-out) ${i * 24}ms both">
                      <td><span class="cell-strong truncate" style="display:block;max-width:300px">${esc(r.name)}</span></td>
                      <td>${personCell(r.owner)}</td>
                      <td class="mono subtle" style="font-size:var(--fs-12);white-space:nowrap">${esc(r.date)}</td>
                      <td class="num">${num(stops)}</td>
                      <td class="subtle">${esc(r.distance === '—' || !r.distance ? '—' : r.distance)}</td>
                      <td>${statusBadge(r.status)}</td>
                      <td style="min-width:130px">
                        <div class="meter-row">
                          <div class="progress thin" style="--tone:${progress >= 100 ? 'var(--wp-green)' : 'var(--wp-blue)'}">
                            <i style="width:${Math.max(2, progress)}%;animation-delay:${i * 40}ms"></i>
                          </div>
                          <span class="meter-val">${esc(r.progress)}</span>
                        </div>
                      </td>
                      <td>
                        <div class="row-actions" style="justify-content:flex-end">
                          <button class="btn btn-ghost sm" data-edit="${esc(r.name)}">${icon('edit', { size: 13 })}Edit</button>
                          <button class="btn btn-ghost sm icon-only" data-more="${esc(r.name)}"
                            aria-label="More actions for ${esc(r.name)}" aria-haspopup="menu">${icon('menu', { size: 15 })}</button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </section>

          <section class="grid g-3">${list.map((r, i) => routeCard(r, i)).join('')}</section>`
          : emptyState({ title: 'No routes match', text: 'Clear a filter to see the rest.', iconName: 'route' });

        $$('[data-route]', panel).forEach((row) => row.addEventListener('click', (e) => {
          if (e.target instanceof Element && e.target.closest('button')) return;
          const r = routes.find((x) => x.name === row.dataset.route);
          if (r) openRoute(r);
        }));
        $$('[data-edit]', panel).forEach((b) => b.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = routes.find((x) => x.name === b.dataset.edit);
          if (r) editRoute(r);
        }));
        $$('[data-more]', panel).forEach((b) => b.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = routes.find((x) => x.name === b.dataset.more);
          menu(e.currentTarget, [
            { label: 'Open route', icon: 'eye', onSelect: () => openRoute(r) },
            { label: 'Edit route', icon: 'edit', onSelect: () => editRoute(r) },
            { label: 'Duplicate', icon: 'copy', onSelect: () => toast('Route duplicated', { text: `${r.name} (copy)`, tone: 'good' }) },
            { label: 'Navigate', icon: 'navigation', onSelect: () => toast('Starting navigation', { text: r.name, tone: 'info' }) },
            { sep: true },
            { label: 'Delete route', icon: 'trash', danger: true, onSelect: () => toast('Route deleted', { text: r.name, tone: 'warn' }) },
          ], { width: 190 });
        }));
      } else if (tab === 'completed') {
        $('#routes-toolbar', root).hidden = true;
        panel.innerHTML = emptyState({
          title: 'No completed routes yet',
          text: 'A route lands here once every stop is marked done. The three open routes still have stops outstanding.',
          iconName: 'checkCircle',
          action: `<div class="row" style="gap:var(--s-2)">
            <button class="btn btn-primary sm" data-goto-tab="routes">See the open routes</button>
            <a class="btn btn-secondary sm" href="#/activities?status=completed">Completed activities</a>
          </div>`,
        });
        $('[data-goto-tab]', panel)?.addEventListener('click', () => {
          const t = $('[data-tabs="routes"] [data-value="routes"]', root);
          if (t) t.click();
        });
      } else {
        $('#routes-toolbar', root).hidden = true;
        panel.innerHTML = emptyState({
          title: 'No field sessions recorded',
          text: 'Field sessions start when a rep taps Start Day and end when they clock out — GPS breadcrumbs are kept for verification.',
          iconName: 'navigation',
          action: '<button class="btn btn-primary sm" id="start-session">Start a session</button>',
        });
        $('#start-session', panel)?.addEventListener('click', () =>
          toast('Session started', { text: 'Location tracking is on for today.', tone: 'good' }));
      }
    };

    let currentTab = 'routes';
    draw('routes');
    mountTabs(root, (val, name) => { if (name === 'routes') { currentTab = val; draw(val); } });
    $('#routes-toolbar', root).addEventListener('input', () => draw(currentTab));
    onToolbarChange($('#routes-toolbar', root), () => draw(currentTab));

    $('#route-new', root)?.addEventListener('click', () => openBuilder());
    $('#route-session', root)?.addEventListener('click', () =>
      toast('Field session', { text: 'Start Day in the top bar begins a tracked session.', tone: 'info' }));
  },
};

function routeCard(r, i) {
  const progress = parseInt(r.progress, 10) || 0;
  const stops = Number(r.stops) || 0;
  const done = Math.round((progress / 100) * stops);
  return `<article class="card interactive reveal route-card" data-route="${esc(r.name)}" style="--i:${i}">
    <div class="row-b" style="align-items:flex-start">
      <div style="min-width:0">
        <h3 style="font-size:var(--fs-14)" class="truncate">${esc(r.name)}</h3>
        <div class="subtle" style="font-size:var(--fs-12);margin-top:2px">${esc(r.date)}</div>
      </div>
      ${statusBadge(r.status)}
    </div>

    <div class="route-stops" aria-label="${done} of ${stops} stops complete">
      ${Array.from({ length: stops }, (_, s) =>
        `<span class="route-stop ${s < done ? 'done' : ''}" style="--i:${s}"></span>`).join('')}
    </div>

    <div class="row-b" style="flex-wrap:wrap;gap:var(--s-2);row-gap:var(--s-3)">
      ${personCell(r.owner)}
      <div class="row wrap" style="gap:var(--s-2);justify-content:flex-end">
        <span class="badge outline">${icon('pin', { size: 12 })}${num(stops)} stop${stops === 1 ? '' : 's'}</span>
        <span class="badge ${progress >= 100 ? 'good' : progress > 0 ? 'accent' : ''}">${esc(r.progress)}</span>
        <button class="btn btn-ghost sm" data-edit="${esc(r.name)}">${icon('edit', { size: 13 })}Edit</button>
      </div>
    </div>
  </article>`;
}

function openRoute(r) {
  const stops = Number(r.stops) || 0;
  const progress = parseInt(r.progress, 10) || 0;
  const done = Math.round((progress / 100) * stops);
  drawer({
    title: r.name,
    subtitle: `${r.date} · ${r.owner}`,
    body: `
      <div class="col" style="gap:var(--s-5)">
        <div class="row wrap" style="gap:var(--s-2)">
          ${statusBadge(r.status)}
          <span class="badge outline">${icon('pin', { size: 12 })}${num(stops)} stop${stops === 1 ? '' : 's'}</span>
          <span class="badge accent">${esc(r.progress)} complete</span>
          <span class="badge outline">${icon('route', { size: 12 })}${esc(r.distance === '—' ? 'Distance pending' : r.distance)}</span>
        </div>

        <div>
          <div class="eyebrow" style="margin-bottom:var(--s-3)">Stop order</div>
          <div class="timeline">
            ${Array.from({ length: stops }, (_, i) => `
              <div class="tl-item" style="--tone:${i < done ? 'var(--wp-green)' : 'var(--wp-blue)'}">
                <div class="row-b">
                  <div>
                    <div class="list-title">Stop ${i + 1}</div>
                    <div class="list-sub">${i < done ? 'Visited — logged and GPS-stamped' : 'Not yet visited'}</div>
                  </div>
                  ${i < done ? '<span class="badge good"><span class="dot"></span>Done</span>' : '<span class="badge outline">Pending</span>'}
                </div>
              </div>`).join('')}
          </div>
        </div>

        <dl class="dl">
          <dt>Owner</dt><dd>${esc(r.owner)}</dd>
          <dt>Date</dt><dd>${esc(r.date)}</dd>
          <dt>Status</dt><dd>${esc(r.status)}</dd>
          <dt>Distance</dt><dd>${esc(r.distance === '—' ? 'Not calculated yet' : r.distance)}</dd>
          <dt>Progress</dt><dd>${esc(r.progress)} (${done} of ${stops} stops)</dd>
        </dl>
      </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>
             <button class="btn btn-primary grow" id="route-start">${icon('navigation', { size: 15 })}Start route</button>`,
  });
  $('#route-start')?.addEventListener('click', () =>
    toast('Route started', { text: `Navigating to stop ${done + 1} of ${stops}.`, tone: 'good' }));
}

function editRoute(r) {
  const dlg = modal({
    title: `Edit ${r.name}`,
    subtitle: `${r.date} · ${r.owner}`,
    body: `
      <div class="col" style="gap:var(--s-4)">
        <div class="field">
          <label class="field-label" for="ed-name">Route name</label>
          <input class="input" id="ed-name" value="${esc(r.name)}">
        </div>
        <div class="grid g-2">
          <div class="field">
            <label class="field-label" for="ed-date">Date</label>
            <input class="input" id="ed-date" type="date" value="2026-05-28">
          </div>
          <div class="field">
            <label class="field-label" for="ed-status">Status</label>
            <select class="select" id="ed-status">
              ${['Draft', 'Active', 'Completed'].map((o) => `<option${o === r.status ? ' selected' : ''}>${esc(o)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="ed-owner">Owner</label>
          <input class="input" id="ed-owner" value="${esc(r.owner)}">
        </div>
        <p class="field-hint">${num(Number(r.stops) || 0)} stops. Reorder them from the route detail view.</p>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="ed-save">Save route</button>`,
  });
  $('#ed-save', dlg.node)?.addEventListener('click', () => {
    dlg.close();
    toast('Route saved', { text: r.name, tone: 'good' });
  });
}

function openBuilder() {
  modal({
    title: 'Create a route',
    subtitle: 'Pick a day, a rep and an area — the app orders the stops',
    body: `
      <div class="col" style="gap:var(--s-4)">
        <div class="field">
          <label class="field-label" for="rt-name">Route name</label>
          <input class="input" id="rt-name" placeholder="e.g. North Sacramento — Tuesday">
        </div>
        <div class="grid g-2">
          <div class="field">
            <label class="field-label" for="rt-date">Date</label>
            <input class="input" id="rt-date" type="date" value="2026-08-24">
          </div>
          <div class="field">
            <label class="field-label" for="rt-owner">Owner</label>
            <select class="select" id="rt-owner">
              ${['Gabriel Craft', 'Lloyd Dela Cruz', 'Seth manshym', 'Musco Adams', 'Kyle Pettit']
                .map((r) => `<option>${esc(r)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="rt-area">Area</label>
          <input class="input" id="rt-area" placeholder="ZIP, city or territory">
          <span class="field-hint">Leads in the area that have not been touched in 14 days are added first.</span>
        </div>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="rt-create">Create route</button>`,
  });
  $('#rt-create')?.addEventListener('click', () => {
    document.querySelector('.overlay [data-close]')?.click();
    toast('Route created', { text: 'Stops ordered by drive time. Open it to reorder.', tone: 'good' });
  });
}
