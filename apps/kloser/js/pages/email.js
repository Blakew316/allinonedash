/** Email — sent mail, templates and the Google connection state. */
import { el, esc, $, $$, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { session } from '../core/store.js';
import { pageHeader, tabs, mountTabs, emptyState, banner, searchField } from '../components/ui.js';
import { modal, toast } from '../components/overlays.js';
import { connectGoogle, googleState, explainGoogleError } from '../components/googleAuth.js';

/** The templates the CRM ships with. */
const TEMPLATES = [
  { name: 'Momentum intro', subject: 'A 13th month of income for {{business}}', tone: 'var(--wp-blue)',
    body: 'Hi {{first_name}},\n\nGreat speaking with you today. As promised, here is a short summary of the Momentum Growth Program and how it puts a 13th month of income on the table for {{business}}.\n\nI have you down for {{appointment_time}} — looking forward to it.\n\n{{rep_name}}\nWholesale Payments' },
  { name: 'Appointment confirmation', subject: 'Confirming {{appointment_time}}', tone: 'var(--wp-green)',
    body: 'Hi {{first_name}},\n\nConfirming our appointment at {{business}} on {{appointment_date}} at {{appointment_time}}.\n\nIt takes about twenty minutes and I will bring a side-by-side of your current statement.\n\n{{rep_name}}' },
  { name: 'Post-visit follow up', subject: 'Following up on our visit', tone: 'var(--wp-cyan)',
    body: 'Hi {{first_name}},\n\nThanks for the time today. Attached is the rate comparison we discussed for {{business}}.\n\nAny questions, my number is below.\n\n{{rep_name}}' },
  { name: 'Business card follow up', subject: 'Nice meeting you at {{business}}', tone: 'var(--warn)',
    body: 'Hi {{first_name}},\n\nYou handed me a card earlier — here is my side of it. When is a good ten minutes this week to walk through the Momentum program?\n\n{{rep_name}}' },
  { name: 'Re-engagement', subject: 'Still worth a look?', tone: '#7C5CFF',
    body: 'Hi {{first_name}},\n\nIt has been a little while. Processing rates have moved since we spoke — worth a fresh look at {{business}}?\n\n{{rep_name}}' },
];

export default {
  title: 'Email',

  async view({ query }) {
    const node = el('<div class="page"></div>');

    node.appendChild(el(pageHeader({
      title: 'Email',
      lede: 'Send from your own Gmail address, with the CRM keeping the thread against the lead.',
      meta: `<span class="badge outline">${icon('mail', { size: 12 })}${esc(session.email)}</span>
             ${googleState().connected
               ? `<span class="badge good"><span class="dot"></span>Google connected</span>`
               : '<span class="badge bad"><span class="dot"></span>Google disconnected</span>'}`,
      actions: `<button class="btn btn-secondary sm" id="mail-templates">${icon('file', { size: 14 })}Templates</button>
                <button class="btn btn-primary sm" id="mail-compose">${icon('send', { size: 14 })}Compose</button>`,
    })));

    // Only worth saying when it is true. A connected account makes the calendar
    // on the Rep Schedule live, so the banner would be telling someone the
    // opposite of what they can see.
    if (!googleState().connected) {
      node.appendChild(el(banner({
        tone: 'warn', iconName: 'alert',
        title: 'Connect your Google account',
        text: 'Calendar sync on the Rep Schedule is off until a Google account is connected. '
          + 'Sending still opens your own mail client either way.',
        action: `<div class="row" style="gap:6px">
          <button class="btn btn-secondary sm" id="mail-reconnect">Connect</button>
          <button class="icon-btn" id="mail-banner-dismiss" aria-label="Dismiss" style="width:30px;height:30px">${icon('close', { size: 15 })}</button>
        </div>`,
      })));
    }

    node.appendChild(el(tabs({
      name: 'mail', value: query.tab || 'all',
      items: [
        { value: 'all', label: 'All', count: 0 },
        { value: 'sent', label: 'Sent', count: 0 },
        { value: 'templates', label: 'Templates', count: TEMPLATES.length },
      ],
    })));

    node.appendChild(el('<div id="mail-panel"></div>'));
    return node;
  },

  mount(root, { query }) {
    const panel = $('#mail-panel', root);

    function draw(tab) {
      if (tab === 'templates') {
        panel.innerHTML = `
          <div class="toolbar" style="margin-bottom:var(--s-4)">
            ${searchField({ placeholder: 'Search templates…' })}
            <span class="spacer"></span>
            <button class="btn btn-secondary sm" id="tpl-new">${icon('plus', { size: 14 })}New template</button>
          </div>
          <section class="grid g-3">
            ${TEMPLATES.map((t, i) => `
              <article class="card interactive reveal pad-sm" data-tpl="${esc(t.name)}" style="--i:${i}">
                <div class="row" style="gap:var(--s-3);margin-bottom:var(--s-3)">
                  <span class="stat-icon" style="--tone:${t.tone}">${icon('file', { size: 16 })}</span>
                  <div style="min-width:0">
                    <h3 style="font-size:var(--fs-14)" class="truncate">${esc(t.name)}</h3>
                    <div class="subtle truncate" style="font-size:var(--fs-12)">${esc(t.subject)}</div>
                  </div>
                </div>
                <p class="clamp-2 subtle" style="font-size:var(--fs-12);line-height:var(--lh-snug)">${esc(t.body.split('\n\n')[1] || t.body)}</p>
                <div class="row" style="gap:6px;margin-top:var(--s-3)">
                  <span class="badge outline">${icon('sparkles', { size: 11 })}merge fields</span>
                </div>
              </article>`).join('')}
          </section>`;
        $$('[data-tpl]', panel).forEach((c) => c.addEventListener('click', () => {
          const t = TEMPLATES.find((x) => x.name === c.dataset.tpl);
          if (t) previewTemplate(t);
        }));
        $('#tpl-new', panel)?.addEventListener('click', () =>
          toast('New template', { text: 'Templates are edited in Settings → Email templates.', tone: 'info' }));

        // The search box filters the cards. A field that only looks like it
        // works is worse than no field at all.
        const tplSearch = $('[data-search]', panel);
        const grid = $('.grid', panel);
        tplSearch?.addEventListener('input', debounce(() => {
          const q = tplSearch.value.trim().toLowerCase();
          let hits = 0;
          $$('[data-tpl]', panel).forEach((c) => {
            const t = TEMPLATES.find((x) => x.name === c.dataset.tpl);
            const match = !q || [t.name, t.subject, t.body].some((v) => String(v).toLowerCase().includes(q));
            c.hidden = !match;
            if (match) hits += 1;
          });
          let none = $('#tpl-none', panel);
          if (!hits) {
            if (!none) {
              none = el(`<div id="tpl-none">${emptyState({
                title: 'No template matches',
                text: 'Try a shorter word, or clear the search to see all five.',
                iconName: 'file',
              })}</div>`);
              grid.after(none);
            }
            none.hidden = false;
          } else if (none) { none.hidden = true; }
        }, 140));
        return;
      }

      panel.innerHTML = `
        <div class="mail-shell reveal">
          <div class="mail-list">
            <div style="padding:var(--s-3) var(--s-4);border-bottom:1px solid var(--line-soft)">
              ${searchField({ placeholder: 'Search mail…' })}
            </div>
            <div id="mail-empty">${emptyState({
              title: tab === 'sent' ? 'No email sent yet' : 'Your mailbox is empty',
              text: 'Everything you send from a lead lands here once there is a mailbox behind it.',
              iconName: 'inbox',
              action: '<button class="btn btn-primary sm" data-compose>Send your first email</button>',
            })}</div>
          </div>
          <div class="mail-read">
            ${emptyState({
              title: 'Select an email to view',
              text: 'Pick a message on the left, or start a new one — the CRM keeps the thread against the lead automatically.',
              iconName: 'mail',
            })}
          </div>
        </div>`;
      $$('[data-compose]', panel).forEach((b) => b.addEventListener('click', compose));

      /* Nothing has synced yet, so searching can only ever come back empty —
         but it should say so about the words you typed, not sit there inert. */
      const mailSearch = $('[data-search]', panel);
      const mailEmpty = $('#mail-empty', panel);
      mailSearch?.addEventListener('input', debounce(() => {
        const q = mailSearch.value.trim();
        mailEmpty.innerHTML = q
          ? emptyState({
              title: `No message matches “${q}”`,
              text: 'The mailbox has not synced yet — reconnect Google and sent mail will be searchable here.',
              iconName: 'search',
              action: '<button class="btn btn-secondary sm" data-clear-mail>Clear search</button>',
            })
          : emptyState({
              title: tab === 'sent' ? 'No email sent yet' : 'Your mailbox is empty',
              text: 'Everything you send from a lead lands here once there is a mailbox behind it.',
              iconName: 'inbox',
              action: '<button class="btn btn-primary sm" data-compose>Send your first email</button>',
            });
        $('[data-clear-mail]', mailEmpty)?.addEventListener('click', () => {
          mailSearch.value = '';
          mailSearch.dispatchEvent(new Event('input', { bubbles: true }));
          mailSearch.focus();
        });
        $$('[data-compose]', mailEmpty).forEach((b) => b.addEventListener('click', compose));
      }, 160));
    }

    draw(query.tab || 'all');
    mountTabs(root, (val, name) => { if (name === 'mail') draw(val); });

    $('#mail-compose', root)?.addEventListener('click', compose);
    $('#mail-templates', root)?.addEventListener('click', () => {
      const bar = $('.tabs', root);
      bar.querySelector('[data-value="templates"]')?.click();
    });
    $('#mail-reconnect', root)?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>Waiting for Google';
      try {
        const state = await connectGoogle();
        toast('Google connected', {
          text: state.email ? `Signed in as ${state.email}. The Rep Schedule calendar will sync.` : 'Calendar access granted.',
          tone: 'good', timeout: 4000,
        });
        btn.closest('.banner')?.remove();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Connect';
        toast('Not connected', { text: explainGoogleError(err && err.message), tone: 'warn', timeout: 6000 });
      }
    });
    $('#mail-banner-dismiss', root)?.addEventListener('click', (e) => {
      const b = e.currentTarget.closest('.banner');
      b.style.transition = 'opacity 180ms, transform 180ms';
      b.style.opacity = '0';
      b.style.transform = 'translateY(-6px)';
      setTimeout(() => b.remove(), 200);
      toast('Reminder hidden', { text: 'You can connect Google from Settings whenever you want to.', timeout: 3000 });
    });

    if (query.compose) compose();
  },
};

function compose() {
  modal({
    title: 'New message',
    subtitle: `From ${session.email}`,
    wide: true,
    body: `
      <div class="col" style="gap:var(--s-4)">
        <div class="banner warn">
          ${icon('alert', { size: 18 })}
          <div class="grow">
            <div class="banner-title">Sending is paused</div>
            <div class="banner-text">Reconnect Google to send. You can still save this as a draft.</div>
          </div>
        </div>
        <div class="field">
          <label class="field-label" for="cmp-to">To</label>
          <input class="input" id="cmp-to" placeholder="name@business.com">
        </div>
        <div class="field">
          <label class="field-label" for="cmp-tpl">Template</label>
          <select class="select" id="cmp-tpl">
            <option value="">Start from blank</option>
            ${TEMPLATES.map((t) => `<option>${esc(t.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="cmp-subject">Subject</label>
          <input class="input" id="cmp-subject" placeholder="Subject">
        </div>
        <div class="field">
          <label class="field-label" for="cmp-body">Message</label>
          <textarea class="textarea" id="cmp-body" rows="9" placeholder="Write your message…"></textarea>
          <span class="field-hint">Merge fields like {{first_name}} and {{business}} fill in from the lead record when you send from a lead page.</span>
        </div>
      </div>`,
    footer: `<button class="btn btn-secondary" data-close>Discard</button>
             <button class="btn btn-secondary" id="cmp-draft">Save draft</button>
             <button class="btn btn-primary" id="cmp-send" disabled>${icon('send', { size: 15 })}Send</button>`,
  });

  $('#cmp-tpl')?.addEventListener('change', (e) => {
    const t = TEMPLATES.find((x) => x.name === e.target.value);
    if (!t) return;
    $('#cmp-subject').value = t.subject;
    $('#cmp-body').value = t.body;
  });
  $('#cmp-draft')?.addEventListener('click', () => {
    document.querySelector('.overlay [data-close]')?.click();
    toast('Draft saved', { tone: 'good' });
  });
}

function previewTemplate(t) {
  modal({
    title: t.name,
    subtitle: t.subject,
    body: `<div class="card pad-sm" style="background:var(--bg-sunken)">
      <pre style="font-family:var(--font-sans);font-size:var(--fs-13);line-height:var(--lh-loose);white-space:pre-wrap;margin:0">${esc(t.body)}</pre>
    </div>
    <p class="field-hint" style="margin-top:var(--s-3)">Fields in double braces are replaced with the lead’s details when the message is sent.</p>`,
    footer: `<button class="btn btn-secondary" data-close>Close</button>
             <button class="btn btn-primary" id="tpl-use">Use this template</button>`,
  });
  $('#tpl-use')?.addEventListener('click', () => {
    document.querySelector('.overlay [data-close]')?.click();
    setTimeout(() => {
      compose();
      const sel = $('#cmp-tpl');
      if (sel) { sel.value = t.name; sel.dispatchEvent(new Event('change')); }
    }, 220);
  });
}
