/**
 * notes.js - Daily notes management
 * - One note per day stored in Firebase (with localStorage fallback)
 * - Auto-save on typing (debounced)
 * - Archive support (read-only)
 * - Offline-first: always saves to localStorage, syncs to cloud when possible
 */

const MOD = 'notes.js';

// ========== LOCAL STATE ==========
let currentNote = null;        // { date: 'YYYY-MM-DD', text: string }
let notesSyncInFlight = null;
let notesSaveTimeout = null;

// ========== CLOUD API ==========
// Injected from preload.js
let cloudApi = null;

// ========== LOCAL STORAGE KEY ==========
const NOTES_STORAGE_PREFIX = 'deskday.notes.v1';

export function initCloudApi(api) {
  cloudApi = api;
}

// ========== DATE UTILITIES ==========
function getTodayISO() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function formatDateDisplay(iso) {
  // Convert YYYY-MM-DD to "Dec 5, 2025"
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ========== LOAD NOTE ==========
export async function loadNote(dateISO) {
  try {
    // First, try localStorage (offline-first approach)
    const localKey = `${NOTES_STORAGE_PREFIX}.${dateISO}`;
    const localData = localStorage.getItem(localKey);
    
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        currentNote = { date: dateISO, text: parsed.text || '' };
        console.log(`[${MOD}] loaded note from localStorage for ${dateISO}`);
        return currentNote;
      } catch (e) {
        console.warn(`[${MOD}] localStorage parse failed, trying cloud`);
      }
    }
    
    // Then try cloud if available
    if (cloudApi) {
      const data = await cloudApi.loadTimetable(`notes-${dateISO}`);
      if (data && data.text) {
        currentNote = { date: dateISO, text: data.text };
        // Cache to localStorage
        localStorage.setItem(localKey, JSON.stringify({ text: data.text }));
        console.log(`[${MOD}] loaded note from cloud for ${dateISO}`);
        return currentNote;
      }
    }
    
    // No note exists yet
    currentNote = { date: dateISO, text: '' };
    return currentNote;
  } catch (e) {
    console.error(`[${MOD}] loadNote failed:`, e);
    return { date: dateISO, text: '' };
  }
}

// ========== SAVE NOTE (Debounced) ==========
export async function saveNoteDebounced(dateISO, text) {
  // Clear previous timeout
  if (notesSaveTimeout) clearTimeout(notesSaveTimeout);
  
  // Only save if text is not empty
  if (!text || !text.trim()) {
    console.log(`[${MOD}] skipping empty note for ${dateISO}`);
    return false;
  }
  
  // Debounce: wait 1.5s before saving
  notesSaveTimeout = setTimeout(async () => {
    try {
      currentNote = { date: dateISO, text };
      
      // 1. ALWAYS save to localStorage first (offline-first)
      const localKey = `${NOTES_STORAGE_PREFIX}.${dateISO}`;
      localStorage.setItem(localKey, JSON.stringify({ text }));
      console.log(`[${MOD}] note saved to localStorage for ${dateISO}`);
      
      // 2. Then sync to cloud if available
      if (cloudApi) {
        try {
          const meta = await cloudApi.saveTimetable(
            `notes-${dateISO}`,
            { text, updatedAt: new Date().toISOString() }
          );
          console.log(`[${MOD}] note synced to cloud for ${dateISO}`);
        } catch (cloudError) {
          console.warn(`[${MOD}] cloud save failed, but localStorage saved:`, cloudError);
        }
      }
      
      return true;
    } catch (e) {
      console.error(`[${MOD}] saveNote failed:`, e);
      return false;
    }
  }, 1500);
}

// ========== GET TODAY'S NOTE ==========
export async function getTodayNote() {
  const today = getTodayISO();
  return loadNote(today);
}

// ========== GET ALL NOTES (Archive) ==========
export async function getAllNotes() {
  try {
    if (!cloudApi) throw new Error('Cloud API not ready');
    
    // This is a simplified approach - in production you'd query by prefix
    // For now, we'll need to load notes manually or use Firestore query
    // Return empty array - caller will build list from UI state
    console.log(`[${MOD}] getAllNotes - archive list will be built from stored keys`);
    return [];
  } catch (e) {
    console.error(`[${MOD}] getAllNotes failed:`, e);
    return [];
  }
}

// ========== GET CURRENT NOTE ==========
export function getCurrentNote() {
  return currentNote || { date: getTodayISO(), text: '' };
}

// ========== SET CURRENT NOTE ==========
export function setCurrentNote(dateISO, text) {
  currentNote = { date: dateISO, text };
}

// ========== BOOT ==========
export async function bootNotes() {
  console.log(`[${MOD}] booting...`);
  
  // Load today's note on startup
  try {
    await getTodayNote();
    console.log(`[${MOD}] today's note loaded on boot`);
  } catch (e) {
    console.warn(`[${MOD}] boot: could not load today's note`, e);
  }
}

console.log(`[load] ${MOD} ready (exports: initCloudApi, loadNote, saveNoteDebounced, getTodayNote, getAllNotes, getCurrentNote, setCurrentNote, bootNotes)`);
