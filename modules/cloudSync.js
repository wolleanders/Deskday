// modules/cloudSync.js
import { exportTimetable, importTimetable } from './storage.js';

let saveTimer = null;

// Cloud-Save: leicht entkoppelt, damit nicht bei jedem Key sofort ein Firestore-Write kommt
export function scheduleCloudSave() {
  if (!window.cloud || typeof window.cloud.saveTimetable !== 'function') return;

  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const payload = exportTimetable();
      console.log('[Deskday] cloud save →', payload);
      await window.cloud.saveTimetable(payload);
      console.log('[Deskday] cloud save done');
    } catch (e) {
      console.warn('[Deskday] cloud save failed', e);
    }
  }, 1500); // 1,5 Sekunden nach der letzten Änderung
}

// Beim Login aus der Cloud holen und lokal übernehmen
export async function loadFromCloudAndApply() {
  if (!window.cloud || typeof window.cloud.loadTimetable !== 'function') return null;

  try {
    const data = await window.cloud.loadTimetable();
    if (!data) {
      console.log('[Deskday] no cloud data found');
      return null;
    }
    console.log('[Deskday] cloud data loaded:', data);
    importTimetable(data);  // schreibt in localStorage
    return data;
  } catch (e) {
    console.warn('[Deskday] cloud load failed', e);
    return null;
  }
}
