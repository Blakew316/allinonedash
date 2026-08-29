/* ============================================================
   Wholesale Payments — Merchant Portal
   ------------------------------------------------------------
   Sign-in requires a username + password AND a Merchant ID (MID).

   • Credentials are checked against a SHA-256 hash (the password is not
     stored in the source). The admin account can open any MID.
   • Each merchant's record — identity + statement metrics — is encrypted
     with a key derived from that MID (PBKDF2-SHA256, 100k iterations), so
     data only unlocks with the correct MID.
   • Statement PDFs are likewise AES-GCM encrypted with the MID key and
     decrypted in the browser at download time.

   NOTE: client-side credential checks can be bypassed by editing the page;
   the MID-based encryption is the real protection (no MID → no data). For
   production, move auth + lookups server-side behind real sessions.
   ============================================================ */
(function () {
  'use strict';

  const gate = document.getElementById('midGate');
  const dash = document.getElementById('portalDash');
  const form = document.getElementById('midForm');
  if (!gate || !dash || !form) return;

  const userInput = document.getElementById('username');
  const passInput = document.getElementById('password');
  const midInput = document.getElementById('mid');
  const midError = document.getElementById('midError');
  const submitBtn = form.querySelector('button[type="submit"]');
  const stmtBody = document.getElementById('stmtBody');
  const stmtEmpty = document.getElementById('stmtEmpty');
  const statTiles = document.getElementById('statTiles');

  const DATA_DIR = 'assets/portal-data';
  const STMT_DIR = 'assets/portal-statements';
  // SHA-256 of "wholesaleadmin:Tatman!316" (username lower-cased)
  const ADMIN_HASH = 'bfed70cb7e987334fcc5df68b147f85474a0a9f60788b00c2dc3d128709106a3';
  const MONTH_LABEL = { May: 'May 2026', Jun: 'June 2026', Jul: 'July 2026' };

  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const usd = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const usd2 = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const num = (n) => n.toLocaleString('en-US');

  /* ---------- crypto helpers ---------- */
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const hexToBytes = (h) => { const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
  const toHex = (b) => { let s = ''; for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0'); return s; };
  const b64ToBytes = (b64) => { const bin = atob(b64); const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; };
  async function sha256hex(s) { return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))); }

  let meta = null;
  const shardCache = {};
  async function loadMeta() { if (!meta) meta = await fetch(`${DATA_DIR}/meta.json`).then((r) => r.json()); return meta; }
  async function loadShard(pfx) {
    if (pfx in shardCache) return shardCache[pfx];
    try { const r = await fetch(`${DATA_DIR}/${pfx}.json`); shardCache[pfx] = r.ok ? await r.json() : null; }
    catch (e) { shardCache[pfx] = null; }
    return shardCache[pfx];
  }
  async function deriveBits(mid) {
    const km = await crypto.subtle.importKey('raw', enc.encode(mid), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBytes(meta.salt), iterations: meta.iter, hash: 'SHA-256' }, km, 44 * 8);
    return new Uint8Array(bits);
  }

  /* ---------- session ---------- */
  let currentMid = null, currentRid = null, currentKey = null;

  async function lookupMerchant(mid) {
    await loadMeta();
    const bits = await deriveBits(mid);
    const rid = toHex(bits.subarray(0, 12));
    const key = await crypto.subtle.importKey('raw', bits.subarray(12, 44), 'AES-GCM', false, ['decrypt']);
    const shard = await loadShard(rid.slice(0, 2));
    const entry = shard && shard[rid];
    if (!entry) return null;
    let ptBuf;
    try { ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(entry.i) }, key, b64ToBytes(entry.d)); }
    catch (e) { return null; }
    const rec = JSON.parse(dec.decode(ptBuf));
    currentRid = rid; currentKey = key;
    return { mid, ...rec };
  }

  /* ---------- rendering ---------- */
  const navToggle = document.getElementById('navToggle');
  const navMobile = document.getElementById('navMobile');

  function resetServiceForms() {
    document.querySelectorAll('.service-form').forEach((f) => {
      f.reset();
      f.querySelectorAll('.service-field, button').forEach((el) => (el.style.display = ''));
      const d = f.querySelector('.service-form__done');
      if (d) { d.hidden = true; d.textContent = ''; }
      const card = f.closest('details');
      if (card) card.open = false;
    });
  }

  function fieldOrMissing(el, value) {
    if (value) { el.textContent = value; el.classList.remove('is-missing'); }
    else { el.textContent = 'Not on file'; el.classList.add('is-missing'); }
  }

  function renderStatements(st) {
    if (!st || !st.length) {
      stmtBody.innerHTML = '';
      stmtEmpty.hidden = false;
      statTiles.style.display = 'none';
      return;
    }
    statTiles.style.display = '';
    stmtEmpty.hidden = true;

    const latest = st[0];
    document.getElementById('statVolume').textContent = usd(latest.v);
    document.getElementById('statPeriod').textContent = MONTH_LABEL[latest.mk] || latest.mk;
    document.getElementById('statCount').textContent = num(latest.c);
    document.getElementById('statAvg').textContent = latest.c > 0 ? usd2(latest.v / latest.c) : '—';
    document.getElementById('statNet').textContent = usd2(latest.d);

    stmtBody.innerHTML = st.map((s) => {
      const label = MONTH_LABEL[s.mk] || s.mk;
      return `<tr>
          <th scope="row">${label}</th>
          <td>${usd(s.v)}</td>
          <td>${num(s.c)}</td>
          <td>${usd2(s.d)}</td>
          <td class="portal-table__action"><button type="button" class="portal-download" data-mk="${s.mk}">Download PDF</button></td>
        </tr>`;
    }).join('');
  }

  function renderMerchant(account) {
    currentMid = account.mid;
    const name = account.n || `Merchant ${account.mid}`;
    document.getElementById('dashName').textContent = name;
    document.getElementById('dashMid').textContent = account.mid;
    document.getElementById('dashLocation').textContent = account.c ? [account.c, account.s].filter(Boolean).join(', ') : '—';

    document.getElementById('profBusiness').textContent = name;
    const setAddr = (id, v) => {
      const el = document.getElementById(id);
      if (v) { el.textContent = v; el.classList.remove('is-missing'); }
      else { el.textContent = '—'; el.classList.add('is-missing'); }
    };
    setAddr('profStreet', account.a);
    setAddr('profCity', account.c);
    setAddr('profState', account.s);
    setAddr('profZip', (account.z || '').split('-')[0].slice(0, 5)); // first 5 digits only
    fieldOrMissing(document.getElementById('profOwner'), account.o);

    const emailEl = document.getElementById('profEmail');
    if (account.e) { emailEl.innerHTML = `<a href="mailto:${account.e}">${account.e}</a>`; emailEl.classList.remove('is-missing'); }
    else { emailEl.textContent = 'Not on file'; emailEl.classList.add('is-missing'); }
    const phoneEl = document.getElementById('profPhone');
    if (account.p) { phoneEl.innerHTML = `<a href="tel:${account.p.replace(/[^\d+]/g, '')}">${account.p}</a>`; phoneEl.classList.remove('is-missing'); }
    else { phoneEl.textContent = 'Not on file'; phoneEl.classList.add('is-missing'); }

    renderStatements(account.st);

    resetServiceForms();
    const profilePanel = document.getElementById('profilePanel');
    if (profilePanel) profilePanel.open = false;
    const cb = document.getElementById('cbPhone');
    if (cb) cb.value = account.p || '';

    // Replacement-terminal dropdown = this merchant's actual equipment
    const rt = document.getElementById('rtDevice');
    if (rt) {
      const opts = (account.eq && account.eq.length)
        ? account.eq.map((d) => (d.q > 1 ? `${d.m} (×${d.q})` : d.m))
        : ['Valor VL550', 'Dejavoo P1', 'Clover Station Duo', 'Genius POS'];
      rt.innerHTML = opts.map((o) => `<option>${escapeHtml(o)}</option>`).join('') + '<option>Other / not sure</option>';
    }

    document.body.classList.add('portal-open');
    if (navMobile) navMobile.classList.remove('open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');

    gate.hidden = true;
    dash.hidden = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ---------- statement PDF download (decrypt in browser) ---------- */
  async function downloadStatement(mk, btn) {
    const label = btn.textContent;
    btn.textContent = 'Preparing…';
    btn.disabled = true;
    try {
      const res = await fetch(`${STMT_DIR}/${currentRid}_${mk}.enc`);
      if (!res.ok) throw new Error('not found');
      const buf = new Uint8Array(await res.arrayBuffer());
      const pdf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.subarray(0, 12) }, currentKey, buf.subarray(12));
      const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentMid}_statement_${mk}_2026.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      btn.textContent = 'Downloaded ✓';
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2200);
    } catch (e) {
      btn.textContent = 'Unavailable';
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2200);
    }
  }

  stmtBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.portal-download');
    if (btn) downloadStatement(btn.dataset.mk, btn);
  });

  /* ---------- login ---------- */
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    midError.hidden = true;
    const username = (userInput.value || '').trim();
    const password = passInput.value || '';
    const mid = midInput.value.trim().replace(/[\s-]/g, '');

    if (!username || !password) {
      midError.textContent = 'Enter your username and password.';
      midError.hidden = false; return;
    }
    if (!/^\d{8,19}$/.test(mid)) {
      midError.textContent = 'Enter a valid MID — digits only, 8 to 19 characters.';
      midError.hidden = false; midInput.focus(); return;
    }
    if (!crypto.subtle) {
      midError.textContent = 'This portal needs a secure (HTTPS) connection to sign in.';
      midError.hidden = false; return;
    }

    busy = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = 'Signing in…';
    submitBtn.disabled = true;
    try {
      const credHash = await sha256hex(username.toLowerCase() + ':' + password);
      if (credHash !== ADMIN_HASH) {
        midError.textContent = 'Incorrect username or password.';
        midError.hidden = false; passInput.focus();
        return;
      }
      const account = await lookupMerchant(mid);
      if (!account) {
        midError.innerHTML = 'We couldn\'t find that MID. Double-check the number, or call <a href="tel:+18064514863">(806) 451-4863</a> for help.';
        midError.hidden = false; midInput.focus();
        return;
      }
      renderMerchant(account);
    } catch (err) {
      midError.textContent = 'Something went wrong signing in. Please try again.';
      midError.hidden = false;
    } finally {
      busy = false;
      submitBtn.textContent = label;
      submitBtn.disabled = false;
    }
  });

  document.getElementById('signOut').addEventListener('click', () => {
    currentMid = currentRid = currentKey = null;
    form.reset();
    document.body.classList.remove('portal-open');
    dash.hidden = true;
    gate.hidden = false;
    window.scrollTo({ top: 0, behavior: 'auto' });
    userInput.focus();
  });

  /* ---------- service requests ---------- */
  const SERVICE_MSG = {
    callback: 'Callback requested — a specialist will reach out at the number you provided.',
    replacement: 'Replacement request received — we\'ll confirm shipping details shortly.',
    paper: 'Paper order received — your rolls will ship to the address on file.',
  };
  document.querySelectorAll('.service-form').forEach((f) => {
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!f.checkValidity()) { f.reportValidity(); return; }
      const done = f.querySelector('.service-form__done');
      f.querySelectorAll('.service-field, button').forEach((el) => (el.style.display = 'none'));
      const base = SERVICE_MSG[f.dataset.service] || 'Request received.';
      done.textContent = `${base} Reference MID ${currentMid || ''} — questions? Call (806) 451-4863.`;
      done.hidden = false;
    });
  });

  loadMeta().catch(() => {});
})();
