/* =========================================================
   Shared PWA wiring — service worker registration, the
   install button (dashboard only), and the offline note.
   Every hook is optional so both pages can load this file.
   ========================================================= */

(() => {
  "use strict";

  const installBtn = document.getElementById("install-btn");
  let deferredInstall = null;

  if (installBtn) {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstall = e;
      installBtn.hidden = false;
    });
    installBtn.addEventListener("click", async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
      installBtn.hidden = true;
    });
    window.addEventListener("appinstalled", () => {
      installBtn.hidden = true;
    });
  }

  const offlineNote = document.getElementById("offline-note");
  if (offlineNote) {
    const sync = () => {
      offlineNote.hidden = navigator.onLine;
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }
})();
