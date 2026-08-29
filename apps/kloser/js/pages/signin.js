/** Sign in — the front door. */
import { el, esc, $ } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { session } from '../core/store.js';
import { navigate } from '../core/router.js';
import { toast } from '../components/overlays.js';

const POINTS = [
  { icon: 'map', tone: 'var(--wp-blue)', title: 'Territory that stays honest', text: '666 leads across 44 territories, every visit GPS-stamped where it happened.' },
  { icon: 'calendarClock', tone: 'var(--wp-cyan)', title: 'Booking without the back-and-forth', text: '925 reps, their availability and their bookable ZIPs, on one board.' },
  { icon: 'funnel', tone: 'var(--wp-green)', title: 'A funnel you can act on', text: 'From a knocked door to a signed deal — and the 61 activities about to go stale.' },
];

export default {
  title: 'Sign In',
  chromeless: true,

  async view() {
    return el(`
      <div class="auth">
        <aside class="auth-aside">
          <span class="auth-blob a" aria-hidden="true"></span>
          <span class="auth-blob b" aria-hidden="true"></span>

          <div class="row" style="gap:var(--s-3);position:relative;z-index:1">
            <img src="./assets/logo-mark.svg" alt="" width="20" height="30">
            <div>
              <div style="font-weight:660;letter-spacing:var(--tr-title)">Kloser CRM</div>
              <div class="subtle" style="font-size:var(--fs-11)">Wholesale Payments</div>
            </div>
          </div>

          <div class="auth-hero anim-rise">
            <h1>The field CRM your reps will actually open.</h1>
            <p>Enterprise-grade, mobile-first, and built around the one thing that matters — what happened at the door.</p>
            <div class="auth-points">
              ${POINTS.map((p, i) => `
                <div class="auth-point anim-rise" style="--tone:${p.tone};animation-delay:${140 + i * 90}ms">
                  <span class="ico">${icon(p.icon, { size: 16 })}</span>
                  <span><b>${esc(p.title)}</b><span>${esc(p.text)}</span></span>
                </div>`).join('')}
            </div>
          </div>

          <div class="row" style="gap:var(--s-4);position:relative;z-index:1;font-size:var(--fs-11);color:var(--text-subtle)">
            <span>© 2026 Wholesale Payments</span><span>·</span><span class="mono">${esc(session.build)}</span>
          </div>
        </aside>

        <main class="auth-main">
          <form class="auth-card anim-rise" id="signin-form" novalidate>
            <img class="auth-logo" src="./assets/logo-wordmark.png" alt="Wholesale Payments">

            <div>
              <h1 style="font-size:var(--fs-24)">Sign in</h1>
              <p class="muted" style="font-size:var(--fs-13);margin-top:4px">
                Manage leads, activities and routes for your team.
              </p>
            </div>

            <button type="button" class="oauth-btn press" id="google-signin">
              ${icon('google', { size: 18, stroke: 0 })}Continue with Google
            </button>

            <div class="auth-divider">or sign in with email</div>

            <div class="field">
              <label class="field-label" for="si-email">Work email</label>
              <div class="input-icon">
                ${icon('mail', { size: 16 })}
                <input class="input" id="si-email" type="email" autocomplete="username"
                  placeholder="you@wholesalepayments.com" value="${esc(session.email)}" required>
              </div>
            </div>

            <div class="field">
              <div class="row-b">
                <label class="field-label" for="si-pass">Password</label>
                <button type="button" class="btn btn-ghost sm" id="si-forgot" style="height:auto;padding:0;font-size:var(--fs-12)">Forgot?</button>
              </div>
              <div class="input-icon">
                ${icon('lock', { size: 16 })}
                <input class="input" id="si-pass" type="password" autocomplete="current-password"
                  placeholder="••••••••••••" value="demo-password" required>
              </div>
            </div>

            <button class="btn btn-primary lg block" type="submit" id="si-submit">
              Sign in${icon('arrowRight', { size: 16 })}
            </button>

            <p class="field-hint" style="text-align:center">
              This is a redesign preview — signing in opens the dashboard with the real snapshot data.
            </p>
          </form>
        </main>
      </div>`);
  },

  mount(root) {
    const form = $('#signin-form', root);
    const submit = $('#si-submit', root);

    const go = () => {
      submit.disabled = true;
      submit.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,.3);border-top-color:#fff"></span>Signing in…';
      setTimeout(() => {
        navigate('');
        toast(`Welcome back, ${session.name.split(' ')[0]}`, { text: 'Snapshot loaded — 666 leads across 44 territories.', tone: 'good' });
      }, 620);
    };

    form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
    $('#google-signin', root).addEventListener('click', go);
    $('#si-forgot', root).addEventListener('click', () =>
      toast('Reset link sent', { text: `Check ${session.email}.`, tone: 'info' }));
  },
};
