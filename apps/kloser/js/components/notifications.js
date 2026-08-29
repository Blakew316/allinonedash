/**
 * The notification center.
 *
 * The bell used to open a fixed list of five sentences that could not be read,
 * dismissed or cleared, and a red dot that never went away. This builds the list
 * from the actual datasets, remembers what has been read, and clears the dot
 * when there is nothing new — which is the whole point of a bell.
 *
 * Read state lives in this browser. There is no server to hold it, and pretending
 * otherwise would be worse than saying so.
 */
import { el, esc, $, $$, trapFocus, lockScroll } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { data, TODAY } from '../core/store.js';
import { num, parseDate } from '../core/format.js';
import { navigate } from '../core/router.js';

const LS_READ = 'kloser.notifs.read.v1';

const readSet = () => {
  try { return new Set(JSON.parse(localStorage.getItem(LS_READ) || '[]')); } catch { return new Set(); }
};
const writeRead = (set) => {
  try { localStorage.setItem(LS_READ, JSON.stringify([...set])); } catch { /* private mode */ }
};

/**
 * Everything worth telling someone about, derived from the data rather than
 * hard-coded. Each item carries a stable id so "read" survives a reload.
 */
export async function buildNotifications() {
  const out = [];
  const push = (n) => out.push(n);

  try {
    const [dash, acts, bcl, lv] = await Promise.all([
      data('dashboard'), data('activities'), data('bcl_queue'), data('location_verification'),
    ]);

    const pending = (dash.pendingAction || []);
    const overdue = pending.find((p) => p.label === 'Overdue > 3 days');
    if (overdue && overdue.value) {
      push({
        id: `overdue-${overdue.value}`, tone: 'bad', icon: 'alert',
        title: `${num(overdue.value)} activities overdue by more than three days`,
        body: 'The longer these sit, the colder the lead gets.',
        action: 'Review them', href: '#/activities?status=overdue',
      });
    }

    const stale = pending.find((p) => p.label === 'No activity > 14d');
    if (stale && stale.value) {
      push({
        id: `stale-${stale.value}`, tone: 'warn', icon: 'clock',
        title: `${num(stale.value)} leads have had no touch in 14 days`,
        body: 'They are still in the book, but nobody has been near them.',
        action: 'Open the list', href: '#/list?age=stale',
      });
    }

    const quiet = pending.find((p) => p.label === 'Reps with 0 visits (7d)');
    if (quiet && quiet.value) {
      push({
        id: `quiet-reps-${quiet.value}`, tone: 'warn', icon: 'users',
        title: `${num(quiet.value)} reps logged no visits this week`,
        body: 'Worth a conversation before it becomes a pattern.',
        action: 'Team dashboard', href: '#/team',
      });
    }

    const qa = bcl.filter((r) => String(r.qa).toLowerCase() === 'pending').length;
    if (qa) {
      push({
        id: `bcl-qa-${qa}`, tone: 'accent', icon: 'card',
        title: `${num(qa)} business card leads are waiting on QA`,
        body: 'They cannot be handed to the call center until someone checks them.',
        action: 'Open the queue', href: '#/bcl-queue',
      });
    }

    const flagged = (lv.flagged || []).length;
    if (flagged) {
      push({
        id: `verify-${flagged}`, tone: 'bad', icon: 'shield',
        title: `${num(flagged)} reps are below the 70% verification rate`,
        body: 'Their logged visits are not matching where their phone says they were.',
        action: 'Location Verify', href: '#/location-verify',
      });
    }

    // Anything actually scheduled for today is the most useful thing in here.
    const today = acts.filter((a) => {
      const d = parseDate(a.date);
      return d && d.getFullYear() === TODAY.getFullYear()
        && d.getMonth() === TODAY.getMonth() && d.getDate() === TODAY.getDate();
    });
    if (today.length) {
      push({
        id: `today-${today.length}-${TODAY.toDateString()}`, tone: 'good', icon: 'calendar',
        title: `${num(today.length)} activities are booked for today`,
        body: today.slice(0, 2).map((a) => a.company).join(', ')
          + (today.length > 2 ? ` and ${today.length - 2} more` : ''),
        action: 'My schedule', href: '#/schedule',
      });
    }
  } catch {
    // Offline with nothing cached: an empty bell is the honest answer.
  }
  return out;
}

/** How many of the current items have not been read. */
export async function unreadCount() {
  const items = await buildNotifications();
  const read = readSet();
  return items.filter((n) => !read.has(n.id)).length;
}

const TONE_CLASS = { bad: 'bad', warn: 'warn', good: 'good', accent: 'accent' };

/**
 * The panel itself — a real sheet, not a menu, because these need room for a
 * line of context and an action each.
 */
export async function openNotifications(anchor, onChange) {
  const items = await buildNotifications();
  const read = readSet();

  const host = el(`
    <div class="notif-host" role="dialog" aria-modal="true" aria-label="Notifications">
      <aside class="notif-panel">
        <div class="notif-head">
          <div>
            <h2>Notifications</h2>
            <p class="muted" id="notif-sub"></p>
          </div>
          <div class="row" style="gap:6px">
            <button class="btn btn-ghost sm" id="notif-readall">Mark all read</button>
            <button class="icon-btn" data-close aria-label="Close">${icon('close', { size: 18 })}</button>
          </div>
        </div>
        <div class="notif-list" id="notif-list"></div>
        <div class="notif-foot">
          <a class="btn btn-secondary sm grow" href="#/settings?section=notifications">
            ${icon('settings', { size: 14 })}Notification settings</a>
        </div>
      </aside>
    </div>`);

  const list = $('#notif-list', host);
  const sub = $('#notif-sub', host);

  function paint() {
    const unread = items.filter((n) => !read.has(n.id)).length;
    sub.textContent = items.length
      ? `${unread ? `${num(unread)} unread of ` : ''}${num(items.length)} · from this device's data`
      : 'Nothing needs you right now';
    list.innerHTML = items.length
      ? items.map((n, i) => `
        <article class="notif ${read.has(n.id) ? 'is-read' : ''}" data-i="${i}">
          <span class="notif-dot ${TONE_CLASS[n.tone] || ''}">${icon(n.icon, { size: 15 })}</span>
          <div class="grow" style="min-width:0">
            <div class="notif-title">${esc(n.title)}</div>
            <div class="notif-body">${esc(n.body)}</div>
            <div class="row" style="gap:6px;margin-top:8px">
              <a class="btn btn-secondary sm" href="${esc(n.href)}" data-go="${i}">${esc(n.action)}</a>
              <button class="btn btn-ghost sm" data-toggle="${i}">
                ${read.has(n.id) ? 'Mark unread' : 'Mark read'}</button>
            </div>
          </div>
        </article>`).join('')
      : `<div class="empty" style="padding:var(--s-8) var(--s-4)">
           <div class="empty-art">${icon('checkCircle', { size: 28 })}</div>
           <h3>All clear</h3>
           <p>Nothing overdue, nothing waiting on QA, nobody below target.</p>
         </div>`;

    $$('[data-toggle]', list).forEach((b) => b.addEventListener('click', () => {
      const n = items[Number(b.dataset.toggle)];
      if (read.has(n.id)) read.delete(n.id); else read.add(n.id);
      writeRead(read);
      paint();
      if (typeof onChange === 'function') onChange(items.filter((x) => !read.has(x.id)).length);
    }));
    $$('[data-go]', list).forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      const n = items[Number(b.dataset.go)];
      read.add(n.id);
      writeRead(read);
      close();
      navigate(n.href);
      if (typeof onChange === 'function') onChange(items.filter((x) => !read.has(x.id)).length);
    }));
  }

  let release = () => {};
  let unlock = () => {};
  let done = false;
  function close() {
    if (host.classList.contains('closing')) return;
    host.classList.add('closing');
    const finish = () => {
      if (done) return;
      done = true;
      host.remove();
      release();
      unlock();
      if (anchor) anchor.setAttribute('aria-expanded', 'false');
    };
    host.addEventListener('animationend', finish, { once: true });
    setTimeout(finish, 400);
  }

  host.addEventListener('click', (e) => {
    if (e.target === host || (e.target instanceof Element && e.target.closest('[data-close]'))) close();
  });
  host.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  $('#notif-readall', host).addEventListener('click', () => {
    items.forEach((n) => read.add(n.id));
    writeRead(read);
    paint();
    if (typeof onChange === 'function') onChange(0);
  });

  document.body.appendChild(host);
  unlock = lockScroll();
  release = trapFocus(host);
  if (anchor) anchor.setAttribute('aria-expanded', 'true');
  paint();
  return { node: host, close };
}
