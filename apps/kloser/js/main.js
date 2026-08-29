/**
 * Kloser CRM — application entry point.
 * Builds the shell, registers routes, and starts the hash router.
 */
import { $, observeReveals, attachRipples } from './core/dom.js';
import { applyTheme, prefs, subscribe } from './core/store.js';
import { initPWA, syncStatusBar } from './core/pwa.js';
import { route, startRouter, onNavigate, onBeforeNavigate, focusView } from './core/router.js';
import { buildShell } from './components/shell.js';
import { runCounters } from './components/ui.js';
import { closeMenu, closeOverlays } from './components/overlays.js';
import { wireRepOpeners } from './components/repDrawer.js';

import dashboard from './pages/dashboard.js';
import map from './pages/map.js';
import repSchedule from './pages/repSchedule.js';
import appointmentBoard from './pages/appointmentBoard.js';
import routes from './pages/routes.js';
import leads from './pages/leads.js';
import activities from './pages/activities.js';
import schedule from './pages/schedule.js';
import bcl from './pages/bcl.js';
import email from './pages/email.js';
import team from './pages/team.js';
import locationVerify from './pages/locationVerify.js';
import settings from './pages/settings.js';
import pipeline from './pages/pipeline.js';
import signin from './pages/signin.js';
import notFound from './pages/notFound.js';

syncStatusBar(applyTheme(prefs.theme));
subscribe('theme', syncStatusBar);

// Runs before the router so a resumed route is in place when it first reads
// the hash, and so `data-standalone` is set before the first paint.
initPWA();

const host = buildShell($('#root'));

route('', dashboard);
route('map', map);
route('rep-schedule', repSchedule);
route('appointment-board', appointmentBoard);
route('routes', routes);
route('list', leads);
route('activities', activities);
route('schedule', schedule);
route('bcl-queue', bcl);
route('email', email);
route('team', team);
route('location-verify', locationVerify);
route('settings', settings);
route('pipeline', pipeline);
route('signin', signin);
route('404', notFound);

/* Chromeless routes (sign-in) hide the rail, topbar and tab bar. */
/* A drawer, modal or menu must never outlive the screen that opened it — and
   must be gone before the next screen mounts, so a screen that opens its own
   sheet on arrival keeps it. */
onBeforeNavigate(() => { closeMenu(); closeOverlays(); });

onNavigate(({ def }) => {
  document.body.classList.toggle('chromeless', Boolean(def?.chromeless));
  document.body.classList.toggle('fullbleed', Boolean(def?.fullBleed));
  requestAnimationFrame(() => {
    runCounters(host);
    observeReveals(host);
  });
});

attachRipples(document);
/* Every rep name in the app, on every screen, opens the same sheet. */
wireRepOpeners(document);

/* The skip link points at #view-host, which in a hash-routed app would be read
   as the route "view-host" and land on the 404 screen. Intercept it and move
   focus directly instead. */
const skip = document.querySelector('.skip-link');
if (skip) skip.addEventListener('click', (e) => { e.preventDefault(); focusView(); });

/* Hold the boot splash until the first view has real content in it — the
   dashboard awaits several datasets, and dropping the splash a frame after
   the modules parse leaves the user staring at an empty shell. */
let bootCleared = false;
function clearBoot() {
  if (bootCleared) return;
  bootCleared = true;
  const boot = $('#boot');
  if (!boot) return;
  boot.classList.add('is-gone');
  boot.addEventListener('transitionend', () => boot.remove(), { once: true });
  setTimeout(() => boot.remove(), 900);
}

startRouter(host).then(clearBoot, clearBoot);
// Ceiling, not the primary trigger: never strand the user behind the splash.
setTimeout(clearBoot, 6000);
