/**
 * notesUI.js - Notes window management
 * - Opens/closes separate notes window
 * - Manages button toggle
 * - Manages archive modal
 */

import { initArchiveUI, openArchive } from './notesArchiveUI.js';
import { getSettings } from './settings.js';

const MOD = 'notesUI.js';
let isWindowOpen = false;

// ========== INIT UI ==========
export async function initNotesUI() {
  console.log(`[${MOD}] initializing notes UI`);
  
  // Initialize archive modal
  try {
    await initArchiveUI();
  } catch (e) {
    console.warn(`[${MOD}] failed to initialize archive UI`, e);
  }
  
  // Wire add note button toggle
  const addNoteBtn = document.getElementById('addNoteBtn');
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', () => {
      if (isWindowOpen) {
        closeNotesWindow();
      } else {
        openNotesWindow();
      }
    });
  }
  
  console.log(`[${MOD}] UI initialized`);
  return true;
}

// ========== OPEN NOTES WINDOW ==========
export async function openNotesWindow() {
  if (isWindowOpen) return;
  
  console.log(`[${MOD}] opening notes window`);
  isWindowOpen = true;
  
  // Sync theme to notes window before opening
  await syncThemeToNotesWindow();
  
  if (window.notesWindow) {
    await window.notesWindow.open();
  }
  
  // Update button
  const addNoteBtn = document.getElementById('addNoteBtn');
  if (addNoteBtn) {
    addNoteBtn.classList.add('active');
    addNoteBtn.innerHTML = '&times;';
  }
}

// ========== CLOSE NOTES WINDOW ==========
export async function closeNotesWindow() {
  if (!isWindowOpen) return;
  
  console.log(`[${MOD}] closing notes window`);
  isWindowOpen = false;
  
  if (window.notesWindow) {
    await window.notesWindow.close();
  }
  
  // Update button
  const addNoteBtn = document.getElementById('addNoteBtn');
  if (addNoteBtn) {
    addNoteBtn.classList.remove('active');
    addNoteBtn.textContent = '+';
  }
}

// ========== THEME SYNC ==========
async function syncThemeToNotesWindow() {
  try {
    const settings = getSettings();
    const theme = (settings.theme || 'dark').toLowerCase();
    
    if (window.__deskday_platform?.ipcRenderer) {
      await window.__deskday_platform.ipcRenderer.invoke('notes:setTheme', { theme });
      console.log(`[${MOD}] synced theme to notes window: ${theme}`);
    }
  } catch (e) {
    console.warn(`[${MOD}] failed to sync theme to notes window`, e);
  }
}

console.log(`[load] ${MOD} ready (exports: initNotesUI, openNotesWindow, closeNotesWindow)`);