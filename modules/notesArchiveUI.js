/**
 * notesArchiveUI.js - Archive modal for viewing past notes
 * Shows last 15 days in calendar grid format
 * Single click to view full note with navigation
 */

import { getNotesForLastDays, loadNote } from './notes.js';

const MOD = 'notesArchiveUI.js';

let archiveModal = null;
let archiveOverlay = null;
let currentViewingDate = null;
let allNotes = [];

export async function initArchiveUI() {
  console.log(`[${MOD}] initializing archive UI`);
  createArchiveModal();
}

function createArchiveModal() {
  // Create overlay (will be reused)
  archiveOverlay = document.createElement('div');
  archiveOverlay.id = 'archiveOverlay';
  archiveOverlay.className = 'overlay hidden';
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'notesArchiveModal';
  modal.className = 'archive-modal hidden';
  
  modal.innerHTML = `
    <div class="archive-header">
      <button type="button" class="archive-back-btn" id="archiveBackBtn" title="Back">
        <svg viewBox="0 0 24 24">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <h2 id="archiveTitle">Notes Archive</h2>
      <button type="button" class="archive-close-btn" id="archiveCloseBtn" title="Close">✕</button>
    </div>
    
    <div class="archive-content" id="archiveContent">
      <div class="archive-calendar-grid" id="archiveCalendarGrid">
        <!-- Calendar grid will be rendered here -->
      </div>
    </div>
  `;
  
  document.body.appendChild(archiveOverlay);
  document.body.appendChild(modal);
  archiveModal = modal;
  
  // Wire events with debugging
  const closeBtn = document.getElementById('archiveCloseBtn');
  const backBtn = document.getElementById('archiveBackBtn');
  
  console.log(`[${MOD}] buttons found:`, { closeBtn, backBtn });
  
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      console.log(`[${MOD}] close button clicked`);
      e.preventDefault();
      closeArchive();
    });
  }
  
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      console.log(`[${MOD}] back button clicked`);
      e.preventDefault();
      e.stopPropagation();
      goBackFromNote();
    });
  }
  
  archiveOverlay.addEventListener('click', (e) => {
    if (e.target === archiveOverlay) {
      console.log(`[${MOD}] overlay clicked`);
      closeArchive();
    }
  });
  
  console.log(`[${MOD}] archive modal created`);
}

export async function openArchive() {
  console.log(`[${MOD}] opening archive`);
  
  if (!archiveModal) {
    createArchiveModal();
  }
  
  // Load notes for last 15 days
  allNotes = await getNotesForLastDays(15);
  console.log(`[${MOD}] loaded ${allNotes.length} days`);
  
  // Show calendar view
  showCalendarView();
  
  // Show modal and overlay
  archiveOverlay.classList.remove('hidden');
  archiveModal.classList.remove('hidden');
  currentViewingDate = null;
}

export function closeArchive() {
  console.log(`[${MOD}] closing archive`);
  if (archiveModal) {
    archiveModal.classList.add('hidden');
  }
  if (archiveOverlay) {
    archiveOverlay.classList.add('hidden');
  }
  currentViewingDate = null;
}

function showCalendarView() {
  const grid = document.getElementById('archiveCalendarGrid');
  const title = document.getElementById('archiveTitle');
  const backBtn = document.getElementById('archiveBackBtn');
  
  title.textContent = 'Notes Archive';
  backBtn.style.opacity = '0';
  backBtn.style.pointerEvents = 'none';
  
  if (!grid) return;
  grid.innerHTML = '';
  grid.className = 'archive-calendar-grid';
  
  allNotes.forEach(note => {
    const day = new Date(note.date + 'T00:00:00');
    const dayNum = day.getDate();
    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
    
    const dayEl = document.createElement('div');
    dayEl.className = `archive-day ${note.hasContent ? 'has-content' : 'empty'}`;
    dayEl.dataset.date = note.date;
    dayEl.innerHTML = `
      <div class="archive-day-num">${dayNum}</div>
      <div class="archive-day-name">${dayName}</div>
    `;
    
    if (note.hasContent) {
      dayEl.addEventListener('click', () => {
        showNoteView(note.date, note.text);
      });
      dayEl.style.cursor = 'pointer';
    }
    
    grid.appendChild(dayEl);
  });
}

function showNoteView(date, text) {
  currentViewingDate = date;
  
  const grid = document.getElementById('archiveCalendarGrid');
  const title = document.getElementById('archiveTitle');
  const backBtn = document.getElementById('archiveBackBtn');
  
  const day = new Date(date + 'T00:00:00');
  const dateStr = day.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  title.textContent = dateStr;
  backBtn.style.opacity = '1';
  backBtn.style.pointerEvents = 'auto';
  backBtn.style.cursor = 'pointer';
  
  grid.innerHTML = `
    <div class="archive-note-view">
      <div class="archive-note-content">${escapeHtml(text)}</div>
    </div>
  `;
  grid.className = 'archive-note-display';
}

function goBackFromNote() {
  if (currentViewingDate) {
    showCalendarView();
    currentViewingDate = null;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log(`[load] ${MOD} ready (exports: initArchiveUI, openArchive, closeArchive)`);
