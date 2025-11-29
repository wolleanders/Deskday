// setOverlay.js
const MOD = 'setOverlay.js';
console.time(`[load] ${MOD}`);

import {
  getSettings, setTheme, applyHourFormat, applyAutostart, applyAOT
} from './settings.js';

function $(id) { return document.getElementById(id); }
function ensureHourData(sel = '.hour .label') {
  document.querySelectorAll(sel).forEach(el => {
    if (!el.dataset.hour) {
      const n = parseInt(el.textContent.trim(), 10);
      if (!Number.isNaN(n)) el.dataset.hour = n;
    }
  });
}

/** Checkboxen aus Settings/OS spiegeln */
async function syncCheckboxes({ labelSelector = '.hour .label' } = {}) {
  const s = getSettings();
  const light = $('setLight'), h12 = $('set12h'), auto = $('setAuto'), aot = $('setAOT');

  if (light) light.checked = (s.theme === 'light');
  if (h12)   h12.checked   = !!s.hour12;
  if (aot)   aot.checked   = (s.alwaysOnTop !== false);

  if (auto) {
    if (window.autostart?.get) {
      try { const on = await window.autostart.get(); auto.checked = !!on; }
      catch { auto.checked = !!s.autostart; }
    } else auto.checked = !!s.autostart;
  }

  ensureHourData(labelSelector);
  console.log(`[${MOD}] checkboxes synced`, { theme: s.theme, hour12: !!s.hour12, aot: aot?.checked, autostart: auto?.checked });
}

/** Listener (nur einmal verkabeln) */
let wired = false;
function wireEvents({ labelSelector = '.hour .label' } = {}) {
  const el12h = document.getElementById('set12h');
  if (wired) return; wired = true;

  $('setLight')?.addEventListener('change', () => {
    setTheme($('setLight').checked ? 'light' : 'dark');
  });
  if (el12h && !el12h._wired) {
    el12h._wired = true;
    el12h.addEventListener('change', () => {
      applyHourFormat(el12h.checked, { labelSelector });
    });
  }
  $('setAuto')?.addEventListener('change', async () => {
    const ok = await applyAutostart($('setAuto').checked);
    $('setAuto').checked = ok;
  });
  $('setAOT')?.addEventListener('change', async () => {
    const ok = await applyAOT($('setAOT').checked);
    $('setAOT').checked = ok;
  });

  // Login/Logout (optional – nur UI)
  const btnLogin = $('setLogin');
  if (btnLogin && window.auth?.onChange) {
    window.auth.onChange(u => { btnLogin.textContent = u ? 'Sign out' : 'Log in'; });
    btnLogin.addEventListener('click', async () => {
      try {
        if (btnLogin.textContent.toLowerCase().includes('out')) await window.auth?.signOut?.();
        else await window.auth?.signInWithGoogle?.();
      } catch (e) { alert(e.message || String(e)); }
    });
  }

  // Close / ESC / Backdrop
  $('setClose')?.addEventListener('click', closeSet);
  $('setOverlay')?.addEventListener('click', (e) => { if (e.target === $('setOverlay')) closeSet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSet(); });

  console.log(`[${MOD}] events wired`);
}

/** Public API */
export async function openSet(options = {}) {
  await syncCheckboxes(options);
  wireEvents(options);
  $('setOverlay')?.classList.remove('hidden');
  console.log(`[${MOD}] openSet()`);
}
export function closeSet() {
  $('setOverlay')?.classList.add('hidden');
  console.log(`[${MOD}] closeSet()`);
}

console.log(`[load] ${MOD} ready (exports: openSet, closeSet)`);
console.timeEnd(`[load] ${MOD}`);
