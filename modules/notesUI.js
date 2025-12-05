/**
 * notesUI.js - Notes panel UI management
 * - Draggable/resizable note panel at bottom
 * - Archive list view
 * - Auto-save integration
 */

import { loadNote, saveNoteDebounced, getTodayNote, getCurrentNote, setCurrentNote } from './notes.js';

const MOD = 'notesUI.js';

// ========== DOM REFS ==========
let notePanelEl = null;
let noteTextEl = null;
let archiveListEl = null;
let archiveViewEl = null;
let openArchiveBtn = null;
let closeArchiveBtn = null;
let backToTodayBtn = null;
let noteEditViewEl = null;

// ========== STATE ==========
let isPanelOpen = false;
let isArchiveOpen = false;
let archiveData = [];  // List of { date, text }

// ========== INIT UI ==========
export function initNotesUI() {
  console.log(`[${MOD}] initializing notes UI`);
  
  // Get DOM elements
  notePanelEl = document.getElementById('notePanel');
  noteTextEl = document.getElementById('noteText');
  archiveListEl = document.getElementById('archiveList');
  archiveViewEl = document.getElementById('archiveView');
  noteEditViewEl = document.getElementById('noteEditView');
  openArchiveBtn = document.getElementById('openArchiveBtn');
  closeArchiveBtn = document.getElementById('closeArchiveBtn');
  backToTodayBtn = document.getElementById('backToTodayBtn');
  
  if (!notePanelEl || !noteTextEl) {
    console.warn(`[${MOD}] note panel elements not found in DOM`);
    return false;
  }
  
  // Wire events
  wireNotePanelEvents();
  wireArchiveEvents();
  makeNotePanelDraggable();
  makeNotePanelResizable();
  
  // Wire add note button toggle
  const addNoteBtn = document.getElementById('addNoteBtn');
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', () => {
      if (isPanelOpen) {
        closeNotePanel();
      } else {
        openNotePanel();
      }
    });
  }
  
  console.log(`[${MOD}] UI initialized`);
  return true;
}

// ========== OPEN NOTE PANEL ==========
export async function openNotePanel() {
  if (isPanelOpen) return;
  
  console.log(`[${MOD}] opening note panel`);
  isPanelOpen = true;
  
  if (notePanelEl) {
    notePanelEl.classList.remove('hidden');
    notePanelEl.style.display = 'flex';
    
    // Temporarily allow body overflow so panel can escape
    document.body.style.overflow = 'visible';
  }
  
  // Add active class to button for rotation
  const addNoteBtn = document.getElementById('addNoteBtn');
  if (addNoteBtn) {
    addNoteBtn.classList.add('active');
    addNoteBtn.innerHTML = '&times;';  // Use HTML entity for consistent sizing
  }
  
  // Load today's note
  await loadTodayNote();
}

// ========== CLOSE NOTE PANEL ==========
export function closeNotePanel() {
  if (!isPanelOpen) return;
  
  console.log(`[${MOD}] closing note panel`);
  isPanelOpen = false;
  isArchiveOpen = false;
  
  if (notePanelEl) {
    notePanelEl.classList.add('hidden');
    notePanelEl.style.display = 'none';
    
    // Restore body overflow
    document.body.style.overflow = 'hidden';
  }
  
  // Remove active class from button and reset icon
  const addNoteBtn = document.getElementById('addNoteBtn');
  if (addNoteBtn) {
    addNoteBtn.classList.remove('active');
    addNoteBtn.textContent = '+';
  }
  
  // Hide archive view
  if (archiveViewEl) archiveViewEl.style.display = 'none';
  if (noteEditViewEl) noteEditViewEl.style.display = 'flex';
}

// ========== LOAD TODAY'S NOTE ==========
async function loadTodayNote() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const note = await loadNote(today);
    
    if (noteTextEl) {
      noteTextEl.value = note.text || '';
      noteTextEl.readOnly = false;  // Ensure it's editable
      noteTextEl.focus();  // Focus for immediate typing
    }
    
    setCurrentNote(today, note.text || '');
    console.log(`[${MOD}] today's note loaded`);
  } catch (e) {
    console.error(`[${MOD}] failed to load today's note:`, e);
  }
}

// ========== LOAD ARCHIVE NOTE ==========
async function loadArchiveNote(dateISO) {
  try {
    const note = await loadNote(dateISO);
    
    if (noteTextEl) {
      noteTextEl.value = note.text || '';
      noteTextEl.readOnly = true;  // Read-only for archive
    }
    
    setCurrentNote(dateISO, note.text || '');
    isArchiveOpen = true;
    
    // Show back arrow, hide list
    if (archiveViewEl) archiveViewEl.style.display = 'none';
    if (noteEditViewEl) noteEditViewEl.style.display = 'flex';
    if (backToTodayBtn) backToTodayBtn.style.display = 'inline';
    if (openArchiveBtn) openArchiveBtn.style.display = 'none';
    
    console.log(`[${MOD}] archive note loaded: ${dateISO}`);
  } catch (e) {
    console.error(`[${MOD}] failed to load archive note:`, e);
  }
}

// ========== OPEN ARCHIVE ==========
async function openArchive() {
  console.log(`[${MOD}] opening archive`);
  isArchiveOpen = true;
  
  // Build archive list (simplified - in production, query Firestore)
  buildArchiveList();
  
  // Show archive view
  if (archiveViewEl) archiveViewEl.style.display = 'flex';
  if (noteEditViewEl) noteEditViewEl.style.display = 'none';
  if (backToTodayBtn) backToTodayBtn.style.display = 'none';
  if (closeArchiveBtn) closeArchiveBtn.style.display = 'inline';
  if (openArchiveBtn) openArchiveBtn.style.display = 'none';
}

// ========== CLOSE ARCHIVE ==========
function closeArchive() {
  console.log(`[${MOD}] closing archive`);
  isArchiveOpen = false;
  
  // Show edit view
  if (archiveViewEl) archiveViewEl.style.display = 'none';
  if (noteEditViewEl) noteEditViewEl.style.display = 'flex';
  if (backToTodayBtn) backToTodayBtn.style.display = 'none';
  if (closeArchiveBtn) closeArchiveBtn.style.display = 'none';
  if (openArchiveBtn) openArchiveBtn.style.display = 'inline';
  
  // Reload today
  loadTodayNote();
}

// ========== BACK TO TODAY ==========
function backToToday() {
  console.log(`[${MOD}] back to today`);
  isArchiveOpen = false;
  
  if (noteTextEl) noteTextEl.readOnly = false;  // Make editable again
  if (backToTodayBtn) backToTodayBtn.style.display = 'none';
  if (closeArchiveBtn) closeArchiveBtn.style.display = 'none';
  if (openArchiveBtn) openArchiveBtn.style.display = 'inline';
  
  loadTodayNote();
}

// ========== BUILD ARCHIVE LIST ==========
function buildArchiveList() {
  if (!archiveListEl) return;
  
  // Clear list
  archiveListEl.innerHTML = '';
  
  // Placeholder: In production, query Firestore for all notes-YYYY-MM-DD docs
  // For now, show example
  const exampleDates = [
    { date: '2025-12-04', text: 'Example note from yesterday' },
    { date: '2025-12-03', text: 'Another note' }
  ];
  
  archiveData = exampleDates;
  
  archiveData.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'archive-list-item';
    item.dataset.date = entry.date;
    item.innerHTML = `
      <div class="archive-date">${formatDateDisplay(entry.date)}</div>
      <div class="archive-preview">${entry.text.substring(0, 50)}...</div>
    `;
    item.addEventListener('click', () => loadArchiveNote(entry.date));
    archiveListEl.appendChild(item);
  });
  
  console.log(`[${MOD}] archive list built (${archiveData.length} entries)`);
}

// ========== WIRE EVENTS ==========
function wireNotePanelEvents() {
  if (!noteTextEl) return;
  
  // Auto-save on input
  noteTextEl.addEventListener('input', (e) => {
    const dateISO = getCurrentNote().date;
    const text = e.target.value;
    
    if (!isArchiveOpen) {  // Only save if in edit mode (not archive)
      saveNoteDebounced(dateISO, text);
    }
  });
}

function wireArchiveEvents() {
  if (openArchiveBtn) {
    openArchiveBtn.addEventListener('click', openArchive);
  }
  if (closeArchiveBtn) {
    closeArchiveBtn.addEventListener('click', closeArchive);
  }
  if (backToTodayBtn) {
    backToTodayBtn.addEventListener('click', backToToday);
  }
}

// ========== DRAGGABLE ==========
function makeNotePanelDraggable() {
  if (!notePanelEl) return;
  
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  const dragHandle = notePanelEl.querySelector('.note-panel-header');
  if (!dragHandle) return;
  
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragOffsetX = e.clientX - notePanelEl.offsetLeft;
    dragOffsetY = e.clientY - notePanelEl.offsetTop;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      notePanelEl.style.left = (e.clientX - dragOffsetX) + 'px';
      notePanelEl.style.top = (e.clientY - dragOffsetY) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

// ========== RESIZABLE ==========
function makeNotePanelResizable() {
  if (!notePanelEl) return;
  
  const resizeHandle = notePanelEl.querySelector('.note-panel-resize');
  if (!resizeHandle) return;
  
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  
  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = notePanelEl.offsetWidth;
    startHeight = notePanelEl.offsetHeight;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isResizing) {
      const newWidth = startWidth + (e.clientX - startX);
      const newHeight = startHeight + (e.clientY - startY);
      
      notePanelEl.style.width = Math.max(300, newWidth) + 'px';
      notePanelEl.style.height = Math.max(200, newHeight) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    isResizing = false;
  });
}

// ========== HELPER ==========
function formatDateDisplay(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

console.log(`[load] ${MOD} ready (exports: initNotesUI, openNotePanel, closeNotePanel)`);
