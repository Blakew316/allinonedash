/** Settings — account, appearance, communication, notifications, organization. */
import { el, esc, $, $$ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { prefs, savePrefs, applyTheme, session } from '../core/store.js';
import { initials, avatarStyle } from '../core/format.js';
import { pageHeader, switchCtl, mountSwitches, avatar, banner } from '../components/ui.js';
import { modal, toast, drawer } from '../components/overlays.js';
import { showBusinessCard } from '../components/shell.js';
import { setQuery } from '../core/router.js';
import { getMapsKey, setMapsKey } from '../components/gmap.js';
import { connectGoogle, disconnectGoogle, googleState, explainGoogleError } from '../components/googleAuth.js';
import {
  calendarSyncState, listCalendars, setCalendarId, setAutoSync,
  clearCalendarCache, agoLabel,
} from '../components/googleCalendar.js';

const SECTIONS = [
  { id: 'account', label: 'Account', icon: 'user' },
  { id: 'appearance', label: 'Appearance', icon: 'sun' },
  { id: 'communication', label: 'Communication', icon: 'mail' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'organization', label: 'Organization', icon: 'building' },
  { id: 'danger', label: 'Danger zone', icon: 'alert' },
];

const NAV_APPS = [
  { value: 'google', label: 'Google Maps' },
  { value: 'apple', label: 'Apple Maps' },
  { value: 'waze', label: 'Waze' },
];

const TIMEZONES = [
  'Eastern Time (ET)', 'Central Time (CT)', 'Mountain Time (MT)',
  'Pacific Time (PT)', 'Alaska Time (AKT)', 'Hawaii Time (HST)',
];

const GRACE = [
  { value: '1h', label: '1 hour' }, { value: '4h', label: '4 hours' },
  { value: '8h', label: '8 hours' }, { value: '24h', label: '24 hours' },
  { value: 'custom', label: 'Custom' },
];

export default {
  title: 'Settings',

  async view({ query }) {
    const node = el('<div class="page"></div>');

    node.appendChild(el(pageHeader({
      title: 'Settings',
      lede: 'Your account, how the app looks, and which alerts are allowed to interrupt you.',
      meta: `<span class="badge outline mono">${esc(session.build)}</span>`,
    })));

    node.appendChild(el(`
      <div class="settings-shell">
        <nav class="settings-nav" id="settings-nav" aria-label="Settings sections">
          ${SECTIONS.map((s) => `<a href="#/settings?section=${s.id}" data-section="${s.id}"
            aria-current="${(query.section || 'account') === s.id}">${icon(s.icon, { size: 16 })}${esc(s.label)}</a>`).join('')}
        </nav>

        <div class="settings-sections">
          ${accountSection()}
          ${appearanceSection()}
          ${communicationSection()}
          ${notificationsSection()}
          ${organizationSection()}
          ${dangerSection()}
        </div>
      </div>`));

    return node;
  },

  mount(root, { query }) {
    /* ---------------------------------------------------- section anchors */
    const nav = $('#settings-nav', root);
    const sections = $$('[data-sec]', root);

    const focusSection = (id) => {
      $$('[data-section]', nav).forEach((a) => a.setAttribute('aria-current', String(a.dataset.section === id)));
      const target = sections.find((s) => s.dataset.sec === id);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    nav.addEventListener('click', (e) => {
      const a = e.target instanceof Element ? e.target.closest('[data-section]') : null;
      if (!a) return;
      e.preventDefault();
      setQuery({ section: a.dataset.section });
      focusSection(a.dataset.section);
    });
    if (query.section) setTimeout(() => focusSection(query.section), 120);

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (!top) return;
        const id = top.target.dataset.sec;
        $$('[data-section]', nav).forEach((a) => a.setAttribute('aria-current', String(a.dataset.section === id)));
      }, { rootMargin: '-96px 0px -70% 0px' });
      sections.forEach((s) => io.observe(s));
    }

    /* ----------------------------------------------------------- controls */
    mountSwitches(root, (id, on) => {
      if (id === 'push') { savePrefs({ pushEnabled: on }); }
      else if (id.startsWith('alert-')) {
        const key = id.replace('alert-', '');
        savePrefs({ alerts: { ...prefs.alerts, [key]: on } });
      }
      toast(on ? 'Turned on' : 'Turned off', { timeout: 1400, tone: on ? 'good' : 'info' });
    });

    $$('[data-theme-pick]', root).forEach((b) => b.addEventListener('click', () => {
      const mode = b.dataset.themePick;
      $$('[data-theme-pick]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      savePrefs({ theme: mode });
      applyTheme(mode);
      document.getElementById('theme-toggle')?.replaceChildren(
        el(icon(mode === 'dark' ? 'moon' : mode === 'light' ? 'sun' : 'monitor', { size: 18 })));
    }));

    $$('[data-navapp]', root).forEach((b) => b.addEventListener('click', () => {
      $$('[data-navapp]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      savePrefs({ navApp: b.dataset.navapp });
      toast(`Navigation opens in ${NAV_APPS.find((a) => a.value === b.dataset.navapp).label}`, { timeout: 2000 });
    }));

    const paintGrace = () => {
      const v = prefs.missedGrace;
      const isPreset = GRACE.some((g) => g.value === v && g.value !== 'custom');
      $$('[data-grace]', root).forEach((x) =>
        x.setAttribute('aria-pressed', String(x.dataset.grace === (isPreset ? v : 'custom'))));
      const badge = $('#grace-current', root);
      if (badge) badge.textContent = `Currently: ${graceLabel(v)}`;
    };
    $$('[data-grace]', root).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.grace === 'custom') { customGrace(paintGrace); return; }
      savePrefs({ missedGrace: b.dataset.grace });
      paintGrace();
    }));
    $('#grace-reset', root)?.addEventListener('click', () => {
      savePrefs({ missedGrace: '24h' });
      paintGrace();
      toast('Reset to the default grace period', { text: '24 hours after the scheduled time.', timeout: 2400 });
    });

    $('#tz-select', root)?.addEventListener('change', (e) => {
      savePrefs({ timezone: e.target.value });
      toast(`Timezone set to ${e.target.value}`, { text: 'Appointment times now display in this zone.', tone: 'good' });
    });

    $('#pw-change', root)?.addEventListener('click', changePassword);
    $('#card-open', root)?.addEventListener('click', showBusinessCard);
    $('#photo-upload', root)?.addEventListener('click', () =>
      toast('Photo upload', { text: 'Pick an image to show on your digital business card.', tone: 'info' }));
    $('#offline-queue', root)?.addEventListener('click', offlineQueue);
    $('#tpl-manage', root)?.addEventListener('click', () => { location.hash = '#/email?tab=templates'; });
    paintGoogle(root);

    $('#maps-key-edit', root)?.addEventListener('click', () => openMapsKeyDialog(() => {
      const badge = $('#maps-key-state', root);
      const btn = $('#maps-key-edit', root);
      if (badge) {
        badge.textContent = getMapsKey() ? 'Key set' : 'Not set';
        badge.className = `badge ${getMapsKey() ? 'good' : 'outline'}`;
      }
      if (btn) btn.innerHTML = `${icon('lock', { size: 14 })}${getMapsKey() ? 'Change' : 'Add key'}`;
    }));
    $('#franchise-block', root)?.addEventListener('click', franchiseBlockList);
    $('#delete-account', root)?.addEventListener('click', deleteAccount);
  },
};

/* ============================================================== sections */

function card(secId, title, sub, bodyHtml) {
  return `<section class="card flush reveal" data-sec="${secId}" id="sec-${secId}">
    <div class="card-head"><div><h3>${esc(title)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div></div>
    ${bodyHtml}
  </section>`;
}

function row(title, desc, ctl) {
  return `<div class="setting-row">
    <div class="sr-copy">
      <div class="sr-title">${esc(title)}</div>
      ${desc ? `<div class="sr-desc">${esc(desc)}</div>` : ''}
    </div>
    <div class="sr-ctl">${ctl}</div>
  </div>`;
}

function accountSection() {
  return card('account', 'Account', 'Who you are inside the CRM', `
    <div class="setting-row">
      <div class="row" style="gap:var(--s-4)">
        <span class="avatar xl" style="${avatarStyle(session.name)}">${esc(initials(session.name))}</span>
        <div>
          <div style="font-size:var(--fs-16);font-weight:640;letter-spacing:var(--tr-title)">${esc(session.name)}</div>
          <div class="muted mono" style="font-size:var(--fs-12)">${esc(session.email)}</div>
          <div class="row" style="gap:var(--s-2);margin-top:6px">
            <span class="badge accent" style="text-transform:capitalize">${esc(session.role)}</span>
            <span class="badge outline">${esc(session.team)}</span>
          </div>
        </div>
      </div>
      <div class="sr-ctl">
        <button class="btn btn-secondary sm" id="photo-upload">${icon('user', { size: 14 })}Upload photo</button>
      </div>
    </div>
    ${row('Profile photo', 'Upload a photo to display on your digital business card and in the team roster.',
      `<button class="btn btn-ghost sm" id="card-open">${icon('qr', { size: 14 })}My business card</button>`)}
    ${row('Timezone', 'Set your local timezone so appointment times display correctly for you.',
      `<select class="select sm" id="tz-select" aria-label="Timezone" style="width:auto;min-width:180px">
        ${TIMEZONES.map((t) => `<option${t === prefs.timezone || t === session.timezone ? ' selected' : ''}>${esc(t)}</option>`).join('')}
      </select>`)}
    ${row('Password', 'Update the password used to sign in with email.',
      `<button class="btn btn-secondary sm" id="pw-change">${icon('lock', { size: 14 })}Change password</button>`)}
  `);
}

function appearanceSection() {
  return card('appearance', 'Appearance', 'How the CRM looks on this device', `
    ${row('Theme', 'System follows your device. Light and dark are pinned regardless of what the device does.',
      `<div class="theme-pick">
        ${[['system', 'System', 'tp-system'], ['light', 'Light', 'tp-light'], ['dark', 'Dark', 'tp-dark']]
          .map(([v, l, c]) => `<button class="theme-swatch" data-theme-pick="${v}" aria-pressed="${prefs.theme === v}">
            <span class="theme-preview ${c}"><span class="tp-rail"></span><span class="tp-body"></span></span>${l}
          </button>`).join('')}
      </div>`)}
    ${row('Navigation app', 'Choose which app opens when you tap directions or navigate to a lead.',
      `<div class="row" style="gap:6px">
        ${NAV_APPS.map((a) => `<button class="chip" data-navapp="${a.value}" aria-pressed="${prefs.navApp === a.value}">
          ${icon('navigation', { size: 13 })}${esc(a.label)}</button>`).join('')}
      </div>`)}
  `);
}

function communicationSection() {
  return card('communication', 'Communication', 'Email, calendar and the queue behind them', `
    ${row('Email templates', 'Create and manage the reusable templates your reps send from a lead.',
      `<button class="btn btn-secondary sm" id="tpl-manage">${icon('file', { size: 14 })}Manage templates</button>`)}
    ${row('Offline queue', 'Inspect, retry or discard writes made while the device had no signal.',
      `<button class="btn btn-secondary sm" id="offline-queue">${icon('wifiOff', { size: 14 })}Open queue</button>`)}

    <div class="setting-row" style="flex-direction:column;align-items:stretch;gap:var(--s-4)">
      <div class="row-b">
        <div class="sr-copy">
          <div class="sr-title">Google integration</div>
          <div class="sr-desc">Calendar sync and Gmail sending.</div>
        </div>
        <span class="badge ${googleState().connected ? 'good' : 'bad'}" id="google-state-badge">
          <span class="dot"></span>${googleState().connected ? 'Connected' : 'Not connected'}</span>
      </div>
      <div class="card pad-sm" style="background:var(--bg-sunken)">
        <div class="eyebrow" style="margin-bottom:var(--s-3)">What a connected account does today</div>
        <div class="col" style="gap:9px">
          ${['Pull your Google Calendar events into the Rep Schedule calendar, month by month',
             'Match each one to a rep when their name is on the invitation',
             'Put a CRM appointment on your Google Calendar from its detail sheet',
             'Take that event back off again if the plan changes',
             'Keep the last months it pulled, so the calendar still fills in offline']
            .map((t) => `<div class="row" style="gap:var(--s-2);font-size:var(--fs-13)">
              ${icon('check', { size: 14, cls: 'ico' })}<span style="color:var(--text-muted)">${esc(t)}</span></div>`).join('')}
        </div>
        <div class="row" style="gap:var(--s-2);font-size:var(--fs-12);margin-top:var(--s-3);align-items:flex-start">
          ${icon('info', { size: 14, cls: 'ico' })}
          <span class="subtle">Sending from Gmail needs a server to hold the token between
            sessions, so the lead detail page still hands off to your mail client.</span>
        </div>
      </div>
      <div id="google-account"></div>

      <div class="setting-row">
        <div>
          <div class="sr-title">Google Maps key</div>
          <div class="sr-desc">The Map screen draws on Google Maps when a key is set, the same way the
            old site did, and uses it to place each lead on its exact address. Without one it falls
            back to the built-in map and city-level pins. Stored in this browser only.</div>
        </div>
        <div class="row" style="gap:var(--s-2)">
          <span class="badge ${getMapsKey() ? 'good' : 'outline'}" id="maps-key-state">
            ${getMapsKey() ? 'Key set' : 'Not set'}</span>
          <button class="btn btn-secondary sm" id="maps-key-edit">
            ${icon('lock', { size: 14 })}${getMapsKey() ? 'Change' : 'Add key'}</button>
        </div>
      </div>
    </div>
  `);
}

function notificationsSection() {
  const a = prefs.alerts;
  const alertRow = (title, desc, inAppKey, pushKey) => `
    <div class="setting-row">
      <div class="sr-copy">
        <div class="sr-title">${esc(title)}</div>
        <div class="sr-desc">${esc(desc)}</div>
      </div>
      <div class="sr-ctl">
        <label class="row" style="gap:7px;font-size:var(--fs-12);color:var(--text-muted)">
          In-app ${switchCtl(`alert-${inAppKey}`, a[inAppKey], `${title} in-app`)}
        </label>
        <label class="row" style="gap:7px;font-size:var(--fs-12);color:var(--text-muted)">
          Push ${switchCtl(`alert-${pushKey}`, a[pushKey], `${title} push`)}
        </label>
      </div>
    </div>`;

  return card('notifications', 'Notifications', 'What is allowed to interrupt you, and how', `
    ${row('Push notifications',
      'Enable push to receive alerts on this device when something needs your attention. Fine-tune which alert types use push below.',
      `<div class="row" style="gap:var(--s-3)">
        <span class="badge ${prefs.pushEnabled ? 'good' : 'outline'}"><span class="dot"></span>${prefs.pushEnabled ? 'Enabled on this device' : 'Disabled'}</span>
        ${switchCtl('push', prefs.pushEnabled, 'Push notifications')}
      </div>`)}

    <div class="setting-row" style="border-bottom:none;padding-bottom:0">
      <div class="sr-copy">
        <div class="sr-title">Hot Lead alerts</div>
        <div class="sr-desc">Choose which channels deliver Hot Lead alerts. Turn off in-app to silence the bell; toggle push to control device notifications.</div>
      </div>
    </div>
    ${alertRow('Hot Lead completed', 'When a rep completes a WPI Hot Lead activity.', 'hotCompletedInApp', 'hotCompletedPush')}
    ${alertRow('Hot Lead missed', 'When a scheduled WPI Hot Lead passes its grace period without being completed.', 'hotMissedInApp', 'hotMissedPush')}
    ${alertRow('Franchise suggestion submitted', 'When a team member adds a personal franchise entry that needs admin review (admins only).', 'franchiseInApp', 'franchisePush')}

    ${row('Missed Hot Lead grace period',
      'How long after the scheduled time before a missed WPI Hot Lead notifies you. Choose a preset or set a custom value.',
      `<div class="col" style="gap:var(--s-2);align-items:flex-end">
        <div class="row wrap" style="gap:6px">
          ${GRACE.map((g) => `<button class="chip" data-grace="${g.value}" aria-pressed="${prefs.missedGrace === g.value}">${esc(g.label)}</button>`).join('')}
        </div>
        <div class="row" style="gap:var(--s-2)">
          <span class="badge accent" id="grace-current">Currently: ${esc(GRACE.find((g) => g.value === prefs.missedGrace)?.label || '24 hours')}</span>
          <button class="btn btn-ghost sm" id="grace-reset">${icon('refresh', { size: 13 })}Use default</button>
        </div>
      </div>`)}
  `);
}

function organizationSection() {
  return card('organization', 'Organization', 'Settings that apply beyond your own account', `
    ${row('My franchise block list', 'Hide franchise brands from your search results so reps stop knocking on corporate-owned locations.',
      `<button class="btn btn-secondary sm" id="franchise-block">${icon('slash', { size: 14 })}Manage block list</button>`)}
    ${row('Build', 'The version of Kloser CRM currently running on this device.',
      `<span class="badge outline mono">${esc(session.build)}</span>`)}
  `);
}

function dangerSection() {
  return `<section class="card flush reveal" data-sec="danger" id="sec-danger"
      style="border-color:color-mix(in srgb, var(--bad) 30%, transparent)">
    <div class="card-head" style="border-bottom-color:color-mix(in srgb, var(--bad) 18%, transparent)">
      <div><h3 style="color:var(--bad-ink)">Danger zone</h3><div class="sub">These cannot be undone</div></div>
    </div>
    ${row('Delete my account', 'Permanently delete your account and personal data. Requires email confirmation.',
      `<button class="btn btn-danger sm" id="delete-account">${icon('trash', { size: 14 })}Delete my account</button>`)}
  </section>`;
}

/* =============================================================== dialogs */

/** Human label for a grace value, including a custom "Nh" form. */
function graceLabel(v) {
  const preset = GRACE.find((g) => g.value === v && g.value !== 'custom');
  if (preset) return preset.label;
  const m = /^(\d+)h$/.exec(String(v || ''));
  if (m) return `${m[1]} hour${m[1] === '1' ? '' : 's'} (custom)`;
  return '24 hours';
}

/** The original's Custom button opens a value entry, not a preset. */
function customGrace(onDone) {
  const current = /^(\d+)h$/.exec(String(prefs.missedGrace || ''));
  const dlg = modal({
    title: 'Custom grace period',
    subtitle: 'How long after the scheduled time a missed Hot Lead notifies you',
    body: `<div class="col" style="gap:var(--s-4)">
        <div class="field">
          <label class="field-label" for="gr-hours">Hours</label>
          <input class="input" id="gr-hours" type="number" min="1" max="168" step="1"
                 value="${current ? esc(current[1]) : '12'}" data-autofocus>
          <span class="field-hint">Between 1 and 168 hours (one week).</span>
        </div>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="gr-save">Save</button>`,
  });
  $('#gr-save', dlg.node)?.addEventListener('click', () => {
    const n = Math.max(1, Math.min(168, Number($('#gr-hours', dlg.node).value) || 24));
    savePrefs({ missedGrace: `${n}h` });
    dlg.close();
    onDone();
    toast('Grace period updated', { text: `Missed Hot Leads notify after ${n} hour${n === 1 ? '' : 's'}.`, tone: 'good' });
  });
}

function changePassword() {
  modal({
    title: 'Change password',
    subtitle: 'Used when signing in with email',
    body: `<div class="col" style="gap:var(--s-4)">
      <div class="field"><label class="field-label" for="pw-old">Current password</label>
        <input class="input" id="pw-old" type="password" autocomplete="current-password"></div>
      <div class="field"><label class="field-label" for="pw-new">New password</label>
        <input class="input" id="pw-new" type="password" autocomplete="new-password">
        <span class="field-hint">At least 12 characters, with a number and a symbol.</span></div>
      <div class="field"><label class="field-label" for="pw-confirm">Confirm new password</label>
        <input class="input" id="pw-confirm" type="password" autocomplete="new-password"></div>
    </div>`,
    footer: `<button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="pw-save">Update password</button>`,
  });
  $('#pw-save')?.addEventListener('click', () => {
    document.querySelector('.overlay [data-close]')?.click();
    toast('Password updated', { tone: 'good' });
  });
}

function offlineQueue() {
  drawer({
    title: 'Offline queue',
    subtitle: 'Writes made while the device had no signal',
    body: `<div class="col" style="gap:var(--s-4)">
      <div class="banner good">
        ${icon('checkCircle', { size: 18 })}
        <div class="grow">
          <div class="banner-title">Queue is empty</div>
          <div class="banner-text">Everything you have logged has reached the server.</div>
        </div>
      </div>
      <p class="field-hint">
        When the app loses signal it keeps working — visits, notes and appointments are stored on the device
        and replayed in order the moment the connection returns. If a write fails permanently it lands here so
        you can retry or discard it.
      </p>
    </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>`,
  });
}

function franchiseBlockList() {
  const brands = ['McDonald’s', 'Subway', 'Starbucks', 'Dunkin’', '7-Eleven', 'Domino’s', 'Taco Bell', 'Chick-fil-A'];
  drawer({
    title: 'Franchise block list',
    subtitle: 'Brands hidden from your search results',
    body: `<div class="col" style="gap:var(--s-4)">
      <div class="input-icon">
        ${icon('search', { size: 16 })}
        <input class="input" placeholder="Add a brand to block…">
      </div>
      <div class="card flush">
        <div class="list">
          ${brands.map((b) => `<div class="list-row">
            <span class="stat-icon" style="--tone:var(--wp-gray);width:28px;height:28px">${icon('slash', { size: 14 })}</span>
            <span class="grow list-title">${esc(b)}</span>
            <button class="btn btn-ghost sm icon-only" aria-label="Unblock ${esc(b)}">${icon('close', { size: 14 })}</button>
          </div>`).join('')}
        </div>
      </div>
      <p class="field-hint">Corporate-owned locations of these brands will not appear when reps search for prospects.</p>
    </div>`,
    footer: `<button class="btn btn-secondary grow" data-close>Close</button>`,
  });
}

function deleteAccount() {
  modal({
    title: 'Delete your account',
    subtitle: 'This is permanent',
    body: `<div class="col" style="gap:var(--s-4)">
      <div class="banner bad">
        ${icon('alert', { size: 18 })}
        <div class="grow">
          <div class="banner-title">Everything personal to you is removed</div>
          <div class="banner-text">Leads you created stay with the organization; your profile, sessions and personal settings do not.</div>
        </div>
      </div>
      <div class="field">
        <label class="field-label" for="del-confirm">Type your email to confirm</label>
        <input class="input" id="del-confirm" placeholder="${esc(session.email)}">
      </div>
    </div>`,
    footer: `<button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-danger" id="del-go" disabled>Delete my account</button>`,
  });
  const input = $('#del-confirm');
  const go = $('#del-go');
  input?.addEventListener('input', () => { go.disabled = input.value.trim() !== session.email; });
  go?.addEventListener('click', () => {
    document.querySelector('.overlay [data-close]')?.click();
    toast('Deletion requested', { text: 'Check your inbox for the confirmation link.', tone: 'warn' });
  });
}

/** Shared with the Map screen's own prompt: one place the key can be set. */
function openMapsKeyDialog(after) {
  const dlg = modal({
    title: 'Google Maps key',
    subtitle: 'Maps JavaScript API + Geocoding API',
    body: `<div class="col" style="gap:var(--s-4)">
      <div class="field">
        <label class="field-label" for="sk-key">API key</label>
        <input class="input mono" id="sk-key" placeholder="AIza…" value="${esc(getMapsKey())}"
               data-autofocus autocomplete="off" spellcheck="false">
        <div class="field-hint">Kept in this browser's storage. It is only ever sent to Google.</div>
      </div>
    </div>`,
    footer: `<button class="btn btn-ghost" id="sk-clear">Remove</button>
             <span class="spacer"></span>
             <button class="btn btn-secondary" data-close>Cancel</button>
             <button class="btn btn-primary" id="sk-save">Save</button>`,
  });
  const finish = (msg) => {
    dlg.close();
    if (typeof after === 'function') after();
    toast(msg, { text: 'Open the Map screen to see it take effect.', tone: 'good', timeout: 2600 });
  };
  $('#sk-clear', dlg.node).addEventListener('click', () => { setMapsKey(''); finish('Key removed'); });
  $('#sk-save', dlg.node).addEventListener('click', () => {
    setMapsKey($('#sk-key', dlg.node).value);
    finish(getMapsKey() ? 'Key saved' : 'Key removed');
  });
}

/* ------------------------------------------------------- Google account */
/** Draw whichever state the connection is actually in, and wire its buttons. */
function paintGoogle(root) {
  const host = $('#google-account', root);
  if (!host) return;
  const g = googleState();

  host.innerHTML = g.connected
    ? `<div class="setting-row">
         <div class="row" style="gap:var(--s-3);min-width:0">
           ${g.picture
             ? `<img src="${esc(g.picture)}" alt="" width="34" height="34" style="border-radius:50%;flex:none">`
             : `<span class="stat-icon" style="--tone:var(--wp-green)">${icon('google', { size: 16, stroke: 0 })}</span>`}
           <div style="min-width:0">
             <div class="sr-title truncate">${esc(g.name || 'Google account')}</div>
             <div class="sr-desc truncate">${esc(g.email || 'Connected')}${
               g.expiresAt ? ` · access expires ${new Date(g.expiresAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</div>
           </div>
         </div>
         <div class="row" style="gap:var(--s-2)">
           <span class="badge good">Connected</span>
           <button class="btn btn-secondary sm" id="google-disconnect">Disconnect</button>
         </div>
       </div>
       <div class="setting-row">
         <div class="sr-copy">
           <div class="sr-title">Calendar to sync</div>
           <div class="sr-desc">Which Google calendar the Rep Schedule reads, and whether it
             refreshes on its own. Last synced ${esc(agoLabel(calendarSyncState().lastSyncAt))}.</div>
         </div>
         <div class="row" style="gap:var(--s-2)">
           <select class="select sm" id="gcal-cal" aria-label="Calendar to sync" style="width:auto;max-width:200px">
             <option value="${esc(calendarSyncState().calendarId)}">Loading calendars…</option>
           </select>
           ${switchCtl('gcal-auto-setting', calendarSyncState().auto, 'Sync on open')}
         </div>
       </div>`
    : `<div class="col" style="gap:var(--s-3);align-items:flex-start">
         <button class="btn btn-secondary" id="google-connect">
           ${icon('google', { size: 16, stroke: 0 })}Connect Google Account
         </button>
         ${g.hasClientId ? '' : `<div class="banner">${icon('info', { size: 16 })}
           <div class="grow"><div class="banner-title">No Google client ID is set</div>
           <div class="banner-text">Put an OAuth 2.0 Web client ID in <span class="mono">config.js</span>
             as <span class="mono">GOOGLE_CLIENT_ID</span>, and add this site's origin to its authorized
             JavaScript origins. Then this opens Google's real consent screen.</div></div></div>`}
       </div>`;

  const badge = $('#google-state-badge', root);
  if (badge) {
    badge.className = `badge ${g.connected ? 'good' : 'bad'}`;
    badge.innerHTML = `<span class="dot"></span>${g.connected ? 'Connected' : 'Not connected'}`;
  }

  const pick = $('#gcal-cal', host);
  if (pick) {
    pick.addEventListener('change', () => setCalendarId(pick.value));
    listCalendars().then((list) => {
      if (!pick.isConnected) return;
      const current = calendarSyncState().calendarId;
      pick.innerHTML = list.map((c) =>
        `<option value="${esc(c.id)}"${c.id === current ? ' selected' : ''}>${esc(c.summary)}</option>`).join('');
    });
  }
  // This switch is drawn after mountSwitches has already run, so wire it here.
  const auto = $('#gcal-auto-setting', host);
  if (auto) {
    auto.addEventListener('click', () => {
      const next = auto.getAttribute('aria-checked') !== 'true';
      auto.setAttribute('aria-checked', String(next));
      setAutoSync(next);
    });
  }

  $('#google-connect', host)?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>Waiting for Google';
    try {
      const state = await connectGoogle();
      paintGoogle(root);
      toast('Google connected', {
        text: state.email ? `Signed in as ${state.email}.` : 'Calendar and Gmail access granted.',
        tone: 'good',
      });
    } catch (err) {
      paintGoogle(root);
      toast('Not connected', { text: explainGoogleError(err && err.message), tone: 'warn', timeout: 6000 });
    }
  });

  $('#google-disconnect', host)?.addEventListener('click', async () => {
    await disconnectGoogle();
    clearCalendarCache();
    paintGoogle(root);
    toast('Google disconnected', {
      text: 'The token has been revoked, and the calendar events it had pulled are gone from this browser.',
      timeout: 3800,
    });
  });
}
