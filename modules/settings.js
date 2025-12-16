// modules/settings.js
const MOD = 'settings.js';
console.time(`[load] ${MOD}`);

const KEY = 'tt.settings';
const DEFAULTS = { theme: 'dark', hour12: false, autostart: false, alwaysOnTop: true, notifications: true };

/* -------- Persistence -------- */
export function getSettings() {
  let s;
  try {
    s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    s = { ...DEFAULTS };
  }
  // Normalisieren
  s.theme       = (s.theme || 'dark').toLowerCase();
  s.hour12      = !!s.hour12;
  s.autostart   = !!s.autostart;
  s.alwaysOnTop = s.alwaysOnTop !== false;
  s.notifications = s.notifications !== false;
  return s;
}

export function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.settings?.set?.(patch); // optional
  
  // Broadcast settings change to notes window via IPC
  try {
    if (window.__deskday_platform?.ipcRenderer) {
      window.__deskday_platform.ipcRenderer.send('settings:changed', patch);
    }
  } catch (e) {
    console.warn('[settings] failed to broadcast settings change', e);
  }
  
  return next;
}

/* -------- Theme -------- */
export function applyTheme(mode) {
  const m = (mode || 'dark').toLowerCase();           // normalisieren
  const html = document.documentElement;
  if (m === 'light') html.setAttribute('data-theme','light');
  else html.removeAttribute('data-theme');            // dark = Attribut weg
}

export function setTheme(mode) {
  const m = (mode || 'dark').toLowerCase();
  applyTheme(m);
  setSettings({ theme: m });
}

export function toggleTheme() {
  const cur = (getSettings().theme || 'dark').toLowerCase();
  setTheme(cur === 'light' ? 'dark' : 'light');
}

/* -------- 24h <-> 12h -------- */
//data-hour (0–23)
function ensureHourData(labelSelector = '.hour .label') {
  const nodes = document.querySelectorAll(labelSelector);
  let filled = 0;
  nodes.forEach(el => {
    if (!el.dataset.hour) {
      const n = parseInt((el.textContent || '').trim(), 10);
      if (!Number.isNaN(n)) {
        el.dataset.hour = String(n); // 0–23
        filled++;
      }
    }
  });
  console.log(`[${MOD}] ensureHourData: total=${nodes.length}, filled=${filled}`);
  return { total: nodes.length, filled };
}

export function applyHourFormat(hour12, { labelSelector = '.hour .label' } = {}) {
  ensureHourData(labelSelector);

  document.querySelectorAll(labelSelector).forEach(el => {
    const h = parseInt(el.dataset.hour, 10); // 0–23
    if (Number.isNaN(h)) return;

    if (hour12) {
      const base = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? 'am' : 'pm';
      el.textContent = String(base);          // keine führende 0 in 12h
      el.dataset.ampm = ampm;
    } else {
      el.textContent = String(h).padStart(2, '0'); // führende 0 in 24h
      el.removeAttribute('data-ampm');
    }
  });

  setSettings({ hour12: !!hour12 });          // ⬅︎ PERSISTENZ
}

/* -------- Autostart / Always-on-top -------- */
export async function applyAutostart(on) {
  const target = !!on;
  try {
    if (window.autostart?.set) {
      const ok = await window.autostart.set(target);
      setSettings({ autostart: !!ok });
      return !!ok;
    }
  } catch (e) {
    console.warn('[settings] applyAutostart failed:', e);
  }
  setSettings({ autostart: target });
  return target;
}

export async function applyAOT(on) {
  const target = !!on;
  try {
    if (window.winCtl?.setAOT) {
      await window.winCtl.setAOT(target);
    }
  } catch (e) {
    console.warn('[settings] applyAOT failed:', e);
  }
  setSettings({ alwaysOnTop: target });
  return target;
}

export function applyNotifications(on) {
  const target = !!on;
  try {
    if (target) {
      // Enable notifications
      if (window.initNotifications && typeof window.initNotifications === 'function') {
        window.initNotifications();
      }
    } else {
      // Disable notifications
      if (window.stopNotifications && typeof window.stopNotifications === 'function') {
        window.stopNotifications();
      }
    }
  } catch (e) {
    console.warn('[settings] applyNotifications failed:', e);
  }
  setSettings({ notifications: target });
  return target;
}


/* -------- Boot -------- */
export async function bootSettings({ labelSelector = '.hour .label' } = {}) {
  const s = getSettings();
  console.log('[settings.js] bootSettings settings=', s);

  applyTheme(s.theme);

  const stats = ensureHourData(labelSelector);
  if (stats.total > 0) {
    // Labels sind schon da → Format direkt anwenden
    applyHourFormat(s.hour12, { labelSelector });
  } else {
    console.log('[settings.js] bootSettings: noch keine hour-labels, Format wird später angewendet');
  }

  await applyAOT(s.alwaysOnTop);
  applyNotifications(s.notifications);
  console.log('[settings.js] boot complete ✅');
}

/* Rückwärtskompatibler Alias, falls irgendwo noch verwendet */
export const bootApply = bootSettings;

console.log(`[load] ${MOD} ready (exports: getSettings,setSettings,applyTheme,setTheme,toggleTheme,applyHourFormat,applyAutostart,applyAOT,applyNotifications,bootSettings)`);
console.timeEnd(`[load] ${MOD}`);
