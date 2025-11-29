// modules/storage.js
// Zentraler Local-Store + Newest-Wins-Helfer

const STORE_KEY = 'deskday.entries.v1';
const HOURS_KEY = 'deskday.hours.v1';
const META_KEY  = 'deskday.meta.v1';
const VERSION   = 1;

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch { return fallback; }
}

/* ---------------- Entries ---------------- */

export function loadEntries() {
  const data = safeParse(localStorage.getItem(STORE_KEY), {});
  return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
}

export function saveEntries(model, { touch = true } = {}) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(model || {}));
    if (touch) touchLocalUpdatedAt('entries');
  } catch (e) {
    console.error('[store] saveEntries failed', e);
  }
}

/* ---------------- Hours ---------------- */

export function loadHours() {
  const data = safeParse(localStorage.getItem(HOURS_KEY), null);
  if (!data || !Number.isInteger(data.start) || !Number.isInteger(data.end)) return null;
  return { start: data.start, end: data.end };
}

export function saveHours(start, end, { touch = true } = {}) {
  try {
    localStorage.setItem(HOURS_KEY, JSON.stringify({ start, end }));
    if (touch) touchLocalUpdatedAt('hours');
  } catch (e) {
    console.error('[store] saveHours failed', e);
  }
}

/* ---------------- Meta / UpdatedAt ---------------- */

function loadMeta() {
  const meta = safeParse(localStorage.getItem(META_KEY), null);
  if (!meta || typeof meta !== 'object') return { updatedAt: 0 };
  if (!Number.isFinite(meta.updatedAt)) meta.updatedAt = 0;
  return meta;
}

function saveMeta(meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta || { updatedAt: Date.now() }));
  } catch (e) {
    console.error('[store] saveMeta failed', e);
  }
}

export function getLocalUpdatedAt() {
  return loadMeta().updatedAt || 0;
}

export function touchLocalUpdatedAt(reason) {
  const m = loadMeta();
  m.updatedAt = Date.now();
  if (reason) m.reason = reason;
  saveMeta(m);
  return m.updatedAt;
}

/* ---------------- Cloud Export/Import ---------------- */

export function exportTimetable() {
  return {
    version: VERSION,
    entries: loadEntries(),
    hours:   loadHours(),
    _meta:   loadMeta(), // enthält updatedAt
  };
}

/**
 * Importiert Cloud-Daten **ohne** lokalen Timestamp zu überschreiben,
 * außer du sagst mode:'force' (Standard hier).
 */
export function importTimetable(data, { mode = 'force' } = {}) {
  if (!data || typeof data !== 'object') {
    console.warn('[store] importTimetable: invalid data, ignoring');
    return;
  }

  // Inhalte übernehmen (ohne dabei erneut den lokalen Timestamp zu "touchen")
  if (data.entries && typeof data.entries === 'object') {
    saveEntries(data.entries, { touch: false });
  }
  if (data.hours && Number.isInteger(data.hours.start) && Number.isInteger(data.hours.end)) {
    saveHours(data.hours.start, data.hours.end, { touch: false });
  }

  // Meta übernehmen: Cloud-Zeitstempel als lokaler Stand
  const remoteUpdated = Number(data._meta?.updatedAt) || Date.now();
  if (mode === 'force') {
    saveMeta({ updatedAt: remoteUpdated });
  }
}

/**
 * Entscheidung, ob REMOTE angewendet werden soll (Cloud neuer als lokal?)
 */
export function shouldApplyRemote(remote) {
  const remoteTs = Number(remote?._meta?.updatedAt) || 0;
  const localTs  = getLocalUpdatedAt();
  return remoteTs > localTs;
}

/**
 * Newest-Wins-Import für Realtime-Callbacks.
 * Gibt true zurück, wenn Cloud angewendet wurde; sonst false.
 */
export function importTimetableNewestWins(remote) {
  if (!remote) return false;
  if (shouldApplyRemote(remote)) {
    importTimetable(remote, { mode: 'force' });
    return true;
  }
  return false;
}

/* ---------------- Utilities ---------------- */

export function clearAll() {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(HOURS_KEY);
  localStorage.removeItem(META_KEY);
}
