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

/** Checkboxen und Radio-Buttons aus Settings/OS spiegeln */
async function syncCheckboxes({ labelSelector = '.hour .label' } = {}) {
  const s = getSettings();
  
  // Theme radio buttons
  const themeDark = $('setThemeDark');
  const themeLight = $('setThemeLight');
  if (themeDark && themeLight) {
    if (s.theme === 'light') {
      themeLight.checked = true;
    } else {
      themeDark.checked = true;
    }
  }
  
  // Time format radio buttons
  const format24h = $('setFormat24h');
  const format12h = $('setFormat12h');
  if (format24h && format12h) {
    if (s.hour12) {
      format12h.checked = true;
    } else {
      format24h.checked = true;
    }
  }
  
  // Autostart checkbox
  const auto = $('setAuto');
  if (auto) {
    if (window.autostart?.get) {
      try { const on = await window.autostart.get(); auto.checked = !!on; }
      catch { auto.checked = !!s.autostart; }
    } else auto.checked = !!s.autostart;
  }
  
  // Always on top checkbox
  const aot = $('setAOT');
  if (aot) aot.checked = (s.alwaysOnTop !== false);

  ensureHourData(labelSelector);
  console.log(`[${MOD}] settings synced`, { theme: s.theme, hour12: !!s.hour12, aot: aot?.checked, autostart: auto?.checked });
}

/** Listener (nur einmal verkabeln) */
let wired = false;
function wireEvents({ labelSelector = '.hour .label' } = {}) {
  if (wired) return; 
  wired = true;

  // Theme radio buttons
  const themeDark = $('setThemeDark');
  const themeLight = $('setThemeLight');
  if (themeDark) {
    themeDark.addEventListener('change', () => {
      if (themeDark.checked) setTheme('dark');
    });
  }
  if (themeLight) {
    themeLight.addEventListener('change', () => {
      if (themeLight.checked) setTheme('light');
    });
  }
  
  // Time format radio buttons
  const format12h = $('setFormat12h');
  if (format12h) {
    const format24h = $('setFormat24h');
    if (format24h) {
      format24h.addEventListener('change', () => {
        if (format24h.checked) applyHourFormat(false, { labelSelector });
      });
    }
    format12h.addEventListener('change', () => {
      if (format12h.checked) applyHourFormat(true, { labelSelector });
    });
  }

  // Autostart checkbox
  $('setAuto')?.addEventListener('change', async () => {
    const ok = await applyAutostart($('setAuto').checked);
    $('setAuto').checked = ok;
  });
  
  // Always on top checkbox
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
  // Hide add note button when settings opens
  $('addNoteBtn')?.classList.add('hidden');
  console.log(`[${MOD}] openSet()`);
}
export function closeSet() {
  const overlay = $('setOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => {}, 500);
  }
  // Show add note button when settings closes
  $('addNoteBtn')?.classList.remove('hidden');
  console.log(`[${MOD}] closeSet()`);
}

console.log(`[load] ${MOD} ready (exports: openSet, closeSet)`);
console.timeEnd(`[load] ${MOD}`);
