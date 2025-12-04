// modules/storage.js
// Zentraler Local-Store + Newest-Wins-Helfer

const STORE_KEY = 'deskday.entries.v1';
const HOURS_KEY = 'deskday.hours.v1';
const META_KEY  = 'deskday.meta.v1';
const ENTRY_META_KEY = 'deskday.entryMeta.v1'; // Per-entry timestamps
const VERSION   = 1;

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); }
  catch { return fallback; }
}

// Simple deep-equality helper for plain data structures stored in entries
function deepEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}
/**
 * Per-entry metadata tracking (hour-level timestamps for granular merging)
 */
function loadEntryMeta() {
  const data = safeParse(localStorage.getItem(ENTRY_META_KEY), {});
  return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
}

function saveEntryMeta(meta) {
  try {
    localStorage.setItem(ENTRY_META_KEY, JSON.stringify(meta || {}));
  } catch (e) {
    console.error('[store] saveEntryMeta failed', e);
  }
}

export function touchEntryUpdatedAt(hourKey) {
  const meta = loadEntryMeta();
  meta[hourKey] = Date.now();
  saveEntryMeta(meta);
  return meta[hourKey];
}

export function getEntryUpdatedAt(hourKey) {
  const meta = loadEntryMeta();
  return meta[hourKey] || 0;
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
    _meta:   loadMeta(), // Document-level timestamp
    _entryMeta: loadEntryMeta(), // Per-entry timestamps for granular merging
  };
}

/**
 * Intelligent merge: applies remote data with per-entry timestamp comparison
 * If an hour was only changed locally or remotely, that wins
 * If changed on both, newest timestamp wins
 */
export function importTimetable(data, { mode = 'smart' } = {}) {
  if (!data || typeof data !== 'object') {
    console.warn('[store] importTimetable: invalid data, ignoring');
    return;
  }

  if (mode === 'force') {
    // Legacy: force-apply everything
    if (data.entries && typeof data.entries === 'object') {
      saveEntries(data.entries, { touch: false });
    }
    if (data.hours && Number.isInteger(data.hours.start) && Number.isInteger(data.hours.end)) {
      saveHours(data.hours.start, data.hours.end, { touch: false });
    }
    const remoteUpdated = Number(data._meta?.updatedAt) || Date.now();
    saveMeta({ updatedAt: remoteUpdated });
    if (data._entryMeta) saveEntryMeta(data._entryMeta);
    return;
  }

  // Smart merge mode (default for realtime syncs)
  if (mode === 'smart' && data.entries && data._entryMeta) {
    const localEntries = loadEntries();
    const localMeta = loadEntryMeta();
    const remoteEntries = data.entries;
    const remoteMeta = data._entryMeta || {};
    
    let merged = { ...localEntries };
    let mergedMeta = { ...localMeta };
    let changed = false;
    const remoteDocTs = (function() {
      const m = data._meta || {};
      if (!m) return 0;
      if (typeof m.updatedAt === 'number') return m.updatedAt;
      if (typeof m.updatedAt === 'string') { const n = Number(m.updatedAt); return Number.isFinite(n) ? n : 0; }
      if (typeof m.updatedAt === 'object') {
        if (typeof m.updatedAt.toMillis === 'function') try { return Number(m.updatedAt.toMillis()); } catch(e) {}
        if (Number.isFinite(m.updatedAt.seconds)) return Number(m.updatedAt.seconds)*1000 + Math.round((Number(m.updatedAt.nanoseconds)||0)/1e6);
      }
      return 0;
    })();
    const localDocTs = Number(getLocalUpdatedAt()) || 0;

    // Per-entry merge
    for (const hourKey in remoteEntries) {
      const remoteTs = remoteMeta[hourKey] || 0;
      const localTs = localMeta[hourKey] || 0;
      const localVal = localEntries[hourKey];
      const remoteVal = remoteEntries[hourKey];

      // Apply if remote per-entry timestamp is newer
      // OR if timestamps equal but the document-level timestamp indicates remote update
      if (remoteTs > localTs || (remoteTs === localTs && remoteTs !== 0 && remoteDocTs > localDocTs)) {
        merged[hourKey] = remoteVal;
        mergedMeta[hourKey] = remoteTs;
        changed = true;
        console.log(`[merge] hour ${hourKey}: applied remote`);
        continue;
      }

      // If timestamps didn't indicate remote is newer, but the actual content differs,
      // apply the remote data as a content-diff fallback. This helps when someone
      // manually edited the Firestore document without updating per-entry timestamps.
      if (!deepEqual(localVal, remoteVal)) {
        merged[hourKey] = remoteVal;
        // keep remote meta if present, otherwise stamp with remoteDocTs or now
        mergedMeta[hourKey] = remoteTs || remoteDocTs || Date.now();
        changed = true;
        console.log(`[merge] hour ${hourKey}: applied remote (content-diff)`);
        continue;
      }
      // else: keep local (values equal or no reason to apply remote)
    }

    if (changed) {
      saveEntries(merged, { touch: false });
      saveEntryMeta(mergedMeta);
      // Update document-level timestamp to reflect merge. Use normalised doc ts when available.
      const remoteUpdated = remoteDocTs || Date.now();
      saveMeta({ updatedAt: Math.max(getLocalUpdatedAt(), remoteUpdated) });
      console.log('[merge] ✓ smart merge applied');
    }
    return;
  }

  // Fallback: basic import
  if (data.entries && typeof data.entries === 'object') {
    saveEntries(data.entries, { touch: false });
  }
  if (data.hours && Number.isInteger(data.hours.start) && Number.isInteger(data.hours.end)) {
    saveHours(data.hours.start, data.hours.end, { touch: false });
  }
  if (data._entryMeta) saveEntryMeta(data._entryMeta);
  const remoteUpdated = Number(data._meta?.updatedAt) || Date.now();
  saveMeta({ updatedAt: remoteUpdated });
}

/**
 * Check if remote has any entries newer than local
 * Returns true if smart merge should be attempted
 */
export function shouldApplyRemote(remote) {
  if (!remote) {
    console.log('[shouldApplyRemote] remote is null, returning false');
    return false;
  }

  const remoteEntryMeta = remote._entryMeta || {};
  const localMeta = loadEntryMeta();
  const remoteDocMeta = remote._meta || {};

  // Helper to normalise Firestore Timestamps (or other forms) to milliseconds
  function tsToMillis(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    if (typeof ts === 'string') {
      const n = Number(ts);
      return Number.isFinite(n) ? n : 0;
    }
    // Firestore Timestamp-like object
    if (typeof ts === 'object') {
      if (typeof ts.toMillis === 'function') {
        try { return Number(ts.toMillis()); } catch (e) { /* ignore */ }
      }
      if (Number.isFinite(ts.seconds)) {
        const secs = Number(ts.seconds) || 0;
        const nanos = Number(ts.nanoseconds) || 0;
        return secs * 1000 + Math.round(nanos / 1e6);
      }
    }
    return 0;
  }

  // Check if any remote entry is newer than local
  for (const hourKey in remoteEntryMeta) {
    const remoteTs = remoteEntryMeta[hourKey] || 0;
    const localTs = localMeta[hourKey] || 0;

    if (remoteTs > localTs) {
      console.log(`[shouldApplyRemote] ✓ remote entry ${hourKey} is newer`);
      return true;
    }

    // If timestamps are equal, use document-level timestamp (may be Firestore Timestamp)
    if (remoteTs === localTs && remoteTs !== 0) {
      const remoteDocTs = tsToMillis(remoteDocMeta.updatedAt);
      const localDocTs = Number(getLocalUpdatedAt()) || 0;
      if (remoteDocTs > localDocTs) {
        console.log(`[shouldApplyRemote] ✓ doc-level: remote newer`);
        return true;
      }
    }
  }

  // Fallback to document-level comparison if no entry meta
  if (!Object.keys(remoteEntryMeta).length) {
    const remoteTs = Number(remote?._meta?.updatedAt) || 0;
    const localTs = getLocalUpdatedAt();
    if (remoteTs > localTs) {
      console.log(`[shouldApplyRemote] ✓ document-level: remote newer`);
      return true;
    }
  }

  // As a final check, compare actual content of entries. If any remote entry differs
  // from local, request an import so the content-diff fallback in importTimetable
  // can reconcile and apply the new values. This ensures runtime manual edits
  // to the database are picked up even when timestamps were not updated.
  try {
    const localEntries = loadEntries();
    const remoteEntries = remote.entries || {};
    for (const k in remoteEntries) {
      const r = remoteEntries[k];
      const l = localEntries[k];
      if (!deepEqual(l, r)) {
        return true;
      }
    }
  } catch (e) {
    console.warn('[shouldApplyRemote] content-diff check failed', e);
  }

  return false;
}

/**
 * Smart-merge import for realtime callbacks.
 * Returns true if anything was merged; else false.
 */
export function importTimetableNewestWins(remote) {
  if (!remote) return false;
  if (shouldApplyRemote(remote)) {
    importTimetable(remote, { mode: 'smart' });
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
