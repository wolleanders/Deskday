/* renderer.js (cleaned + defensive auth wiring so UI works reliably) */

import { bootSettings, getSettings, applyHourFormat, toggleTheme } from './modules/settings.js';
import { openSet, closeSet } from './modules/setOverlay.js';
import { bootLoginMode } from './modules/loginMode.js';
import { loadHours, saveHours, exportTimetable, importTimetable, saveEntries, loadEntries, importTimetableNewestWins, shouldApplyRemote } from "./modules/storage.js";
import { scheduleCloudSave } from "./modules/cloudSync.js";
// auth-state kept separate; may be undefined in some runs
import * as AuthState from './modules/authState.js';

/* -------------------------
   Quick UI wiring (top)
   ------------------------- */
document.getElementById('themeBtn')?.addEventListener('click', () => toggleTheme());

/* ===========================
   App state / constants
   =========================== */
let startHour = 1;
let endHour   = 23;
const H = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--hour-h')) || 88;
const H_FULL = H;
const H_COLLAPSED = Math.round(H * 0.45);
let hourHeights = [], hourTop = [];
const FOCUS = 0.320;
const THEME_KEY = 'tt.theme';
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)');

let offset = 0, vel = 0;
const friction = 0.035, gain = 0.045;
let minOffset = 0, maxOffset = 0;

let isEditor = false;
let loginInProgress = false;

let model = loadEntries();
const COLLAPSE_KEY = 'deskday.collapse.v1';
let collapseState = loadCollapseState();

function loadCollapseState(){
  try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || { auto:false, hours:{} }; }
  catch { return { auto:false, hours:{} }; }
}
function saveCollapseState(){ localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapseState)); }

/* ---------------------------
   Collapse / layout helpers
   --------------------------- */
function applyCollapsedState(){
  for (let h = startHour; h <= endHour; h++){
    const row = timetable.children[h - startHour];
    if (!row) continue;
    const hasText = !!getHourText(h);
    const manual  = !!collapseState.hours[String(h)];
    const auto    = collapseState.auto && !hasText;
    row.classList.toggle('collapsed', manual || auto);
    row.classList.toggle('empty', !hasText);
  }
  if (!isEditor) snapToCurrentHour({ smooth: true });
  recalcLayout();
  updateNowLine();
  saveCollapseState();
}

function toggleHourCollapse(h, force){
  const row = timetable.children[h - startHour];
  if (!row) return;
  let on = force;
  if (typeof on === 'undefined') on = !row.classList.contains('collapsed');
  row.classList.toggle('collapsed', on);
  collapseState.hours[String(h)] = on ? true : false;
  saveCollapseState();
  recalcLayout({smooth:true});
  updateNowLine({smooth:true});
}

function isCollapsedHour(h){
  const row = timetable.children[h - startHour];
  return row ? row.classList.contains('collapsed') : false;
}
function getHourHeight(h){ return isCollapsedHour(h) ? H_COLLAPSED : H_FULL; }
function setRowVisualHeight(row, px){ row.style.setProperty('--hour-height', `${px}px`); }

function getTotalHeight(){
  if (!hourHeights.length) return (endHour - startHour + 1) * H;
  const last = hourHeights.length - 1;
  return (hourTop[last] || 0) + (hourHeights[last] || H);
}

function recalcLayout(){
  hourTop.length = 0; hourHeights.length = 0;
  let acc = 0;
  for (let h = startHour; h <= endHour; h++){
    const row = timetable.children[h - startHour];
    if (!row) continue;
    const hh = row.classList.contains('collapsed') ? H_COLLAPSED : H_FULL;
    setRowVisualHeight(row, hh);
    hourHeights.push(hh);
    hourTop.push(acc);
    acc += hh;
  }
  timetable.style.height = `${acc}px`;
  updateBounds();
}

/* ---------------------
   Theme
   --------------------- */
function applyTheme(mode) {
  const html = document.documentElement;
  if (mode === 'light') html.setAttribute('data-theme','light');
  else html.removeAttribute('data-theme');
  localStorage.setItem(THEME_KEY, mode);
}
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') applyTheme(saved);
  else applyTheme(prefersDark?.matches ? 'dark' : 'light');
  prefersDark?.addEventListener('change', e => {
    const saved = localStorage.getItem(THEME_KEY);
    if (!saved) applyTheme(e.matches ? 'dark' : 'light');
  });
})();

/* ---------------------
   Storage helpers
   --------------------- */
function hourKey(hour) { return String(hour).padStart(2, '0'); }
function getHourText(hour) { const key = hourKey(hour); return model[key] || ""; }
function setHourText(hour, text) {
  const key = hourKey(hour);
  const trimmed = String(text || '').trim();
  if (!trimmed) delete model[key];
  else model[key] = trimmed;
  console.log('[Deskday] setHourText', hour, '→', JSON.stringify(model));
  try { saveEntries(model); } catch(e){ console.warn('saveEntries failed', e); }
  try { scheduleCloudSave(); } catch(e){ /* noop */ }
}

/* ---- DOM References ---- */
const dayLabel = document.getElementById('dayLabel');
const dateLabel = document.getElementById('dateLabel');
const timetable = document.getElementById('timetable');
const viewport = document.getElementById('viewport');

const now = new Date();
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
dayLabel && (dayLabel.textContent = days[now.getDay()]);
dateLabel && (dateLabel.textContent = `${now.getDate()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`);

const optBtn = document.getElementById('optionsBtn');
const optMenu = document.getElementById('optionsMenu');
const optTE = document.getElementById('opt-te');

// settings button (support both id variants)
const optSet = document.getElementById('optSet') || document.getElementById('opt-settings');
const optMin = document.getElementById('opt-min');

// hidden till TTE
const teiBtn = document.getElementById('teiBtn');
const stBtn = document.getElementById('stBtn');
const colEmpBtn = document.getElementById('colEmpBtn');

// SEE Overlay Elemente
const seeOverlay = document.getElementById('seeOverlay');
const seeStart = document.getElementById('seeStart');
const seeEnd = document.getElementById('seeEnd');
const seeBuild = document.getElementById('seeBuild');

// ---- Utils ----
const pad = (n) => String(n).padStart(2, '0');

/* --------- SEE helpers --------- */
function parseHour(v){ const n = parseInt(String(v).trim(), 10); return (Number.isFinite(n) && n>=1 && n<=23) ? n : null; }
function updateSeeButton(){ if (!seeBuild) return; seeBuild.disabled = !(parseHour(seeStart?.value) && parseHour(seeEnd?.value)); }
function openSEE(prefill={start:5,end:22}){
  if (!seeOverlay) return;
  seeStart.value = ''; seeEnd.value = '';
  seeStart.placeholder = String(prefill.start);
  seeEnd.placeholder   = String(prefill.end);
  updateSeeButton();
  seeOverlay.classList.remove('hidden');
  seeStart.focus();
}
function closeSEE(){ seeOverlay?.classList.add('hidden'); }

['input','change','keyup'].forEach(ev=>{
  seeStart?.addEventListener(ev, updateSeeButton);
  seeEnd?.addEventListener(ev, updateSeeButton);
});
[seeStart, seeEnd].forEach(inp=>{
  inp?.addEventListener('keydown', e=>{
    if (e.key === 'Enter' && !seeBuild.disabled) seeBuild.click();
  });
});
seeBuild?.addEventListener('click', ()=>{
  const s = parseHour(seeStart.value) ?? parseHour(seeStart.placeholder);
  const e = parseHour(seeEnd.value)   ?? parseHour(seeEnd.placeholder);
  if (!s || !e) return;
  startHour = s; endHour = e;
  saveHours(startHour, endHour);

  // Timetable neu aufbauen + smooth anzeigen
  closeSEE();
  timetable.classList.remove('ready');
  render();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    updateBounds();
    applyCollapsedState();
    recalcLayout();
    snapToCurrentHour();
    ensureNowLine();
    updateNowLine();
    startNowLineTicker();
    timetable.classList.add('ready');
  }));
});

/* ---------------- Now-line ---------------- */
let nowLine = null;
function ensureNowLine(){ if (!nowLine){ nowLine = document.createElement('div'); nowLine.className = 'now-line'; } }
function updateNowLine(){
  ensureNowLine();
  const now = new Date(); const h = now.getHours();
  if (h < startHour || h > endHour) { if (nowLine.parentElement) nowLine.remove(); nowLine.style.display = 'none'; return; }
  const idx = h - startHour; const row = timetable.children[idx]; if (!row) return;
  if (nowLine.parentElement !== row) row.appendChild(nowLine);
  const minutes = now.getMinutes() + now.getSeconds()/60;
  const percent = (minutes / 60) * 100;
  nowLine.style.top = `${percent}%`; nowLine.style.display = 'block';
}
function startNowLineTicker() {
  updateNowLine();
  const tick = () => { updateNowLine(); const jitter = Math.random()*10000 - 5000; setTimeout(tick, 60000 + jitter); };
  tick();
}
window.addEventListener('resize', () => { recalcLayout(); updateNowLine(); if (!isEditor) snapToCurrentHour(); });

/* ------------ Mark current hour ------------ */
function markCurrent() {
  timetable?.querySelectorAll('.hour.current')?.forEach(el => el.classList.remove('current'));
  const h = new Date().getHours();
  if (h >= startHour && h <= endHour) {
    const el = timetable.children[h - startHour];
    if (el) el.classList.add('current');
  }
}
const markCurrentHour = markCurrent;

/* ------------- Bounds / scroll -------------- */
function updateBounds(){
  const total = getTotalHeight();
  const view = viewport.clientHeight;
  if (total <= view + 0.5) minOffset = 0;
  else minOffset = -(total - view);
  maxOffset = 0;
  if (offset < minOffset) offset = minOffset;
  if (offset > maxOffset) offset = maxOffset;
  timetable.style.transform = `translateY(${offset}px)`;
}

function getCenterOffset() {
  const h = new Date().getHours();
  const i = Math.max(0, Math.min(endHour - startHour, h - startHour));
  const mid = (hourTop[i] || 0) + (hourHeights[i] || H) / 2;
  updateBounds();
  const targetY = viewport.clientHeight * FOCUS;
  let target = -(mid - targetY);
  return Math.max(minOffset, Math.min(maxOffset, target));
}

let snapAnim = null;
function animateToOffset(target, duration = 450) {
  if (snapAnim) cancelAnimationFrame(snapAnim);
  const startOff = offset;
  const start = performance.now();
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(t);
    offset = startOff + (target - startOff) * eased;
    timetable.style.transform = `translateY(${offset}px)`;
    if (t < 1) snapAnim = requestAnimationFrame(step); else snapAnim = null;
  }
  snapAnim = requestAnimationFrame(step);
}

function snapToCurrentHour({ smooth = true } = {}) {
  if (isEditor) return;
  markCurrentHour();
  recalcLayout();
  updateBounds();
  const target = getCenterOffset();
  vel = 0;
  if (smooth) animateToOffset(target);
  else { offset = target; timetable.style.transform = `translateY(${offset}px)`; }
}

function scheduleHourlySnap(){
  const now = new Date();
  const ms = (60 - now.getMinutes())*60000 - now.getSeconds()*1000 - now.getMilliseconds();
  setTimeout(() => { snapToCurrentHour({ smooth: true }); setInterval(() => snapToCurrentHour({ smooth: true }), 3600000); }, ms);
}

(function ensureMarkTicker(){
  if (!window.__deskdayMarkTicker) window.__deskdayMarkTicker = setInterval(markCurrent, 30 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) markCurrent(); });
})();

/* -------- Render hours / entries -------- */
function render() {
  const f = document.createDocumentFragment();
  for (let h = startHour; h <= endHour; h++) {
    const row  = document.createElement('div'); row.className = 'hour';
    const lab = document.createElement('div'); lab.className = 'label'; lab.textContent = `${pad(h)}`;
    const line= document.createElement('div'); line.className = 'line';
    const lineLeft= document.createElement('div'); lineLeft.className = 'line-left';
    const items = document.createElement('div'); items.className = 'items'; items.dataset.hour = String(h);

    const view = document.createElement('div'); view.className='txt';
    view.textContent = getHourText(h);

    const edit = document.createElement('textarea'); edit.className = 'txt-input';
    edit.placeholder = 'Notizen / Todos für diese Stunde…';
    edit.dataset.hour = String(h);

    const summary = document.createElement('div'); summary.className = 'summary';
    summary.innerHTML = `<span class="text"></span>`;

    const chev = document.createElement('div'); chev.className = 'chev'; chev.textContent = '▾';
    chev.dataset.hour = String(h);
    chev.addEventListener('click', (e)=>{ e.stopPropagation(); toggleHourCollapse(h); });

    items.appendChild(view);
    items.appendChild(edit);

    row.appendChild(lab);
    row.appendChild(line);
    row.appendChild(lineLeft);
    row.appendChild(items);
    row.appendChild(summary);
    f.appendChild(row);
  }
  timetable.replaceChildren(f);
  timetable.style.height = `${(endHour - startHour + 1) * H}px`;
  cacheHourEls();
  markCurrent();

  // nach Neuaufbau: Status anwenden & Summaries füllen
  applyCollapsedState();
  updateAllSummaries();

  updateBounds();

  recalcLayout();
  ensureNowLine();
  updateNowLine();
  if (!isEditor) snapToCurrentHour({ smooth: true });
  scheduleHourlySnap();
  startNowLineTicker();
}

/* -------- Summaries -------- */
function summarizeHourText(text, maxLen=60){
  const t = String(text||'').trim(); if (!t) return '';
  const oneLine = t.replace(/\s+/g,' ').trim();
  return oneLine.length > maxLen ? (oneLine.slice(0,maxLen-1)+'…') : oneLine;
}
function updateHourSummary(h){
  const row = timetable.children[h - startHour]; if (!row) return;
  const txt = getHourText(h);
  row.querySelector('.summary .text').textContent = summarizeHourText(txt);
  row.classList.toggle('empty', !txt);
}
function updateAllSummaries(){ for (let h=startHour; h<=endHour; h++) updateHourSummary(h); }

/* ------------- Editor / mode ------------- */
function setMode(editorOn){
  isEditor = !!editorOn;
  document.body.classList.toggle('editor-mode', isEditor);
  optTE?.setAttribute('aria-pressed', String(isEditor));
  teiBtn?.setAttribute('aria-pressed', String(isEditor));

  if (!isEditor) {
    closeAnyHourEditor(false);
    timetable.querySelectorAll('.hour[data-temp-open="1"]').forEach(row => {
      const idx = Array.prototype.indexOf.call(timetable.children, row);
      const h = startHour + idx;
      const isEmpty = !getHourText(h);
      if (isEmpty) row.classList.add('collapsed');
      row.removeAttribute('data-temp-open');
    });
    applyCollapsedState();
    recalcLayout();
    updateNowLine();
    snapToCurrentHour();
  } else {
    vel = 0;
  }
}

/* ------------- Scroll inertia (editor) --------------- */
window.addEventListener('wheel', (e) => { if (!isEditor) return; if (minOffset === 0) return; vel -= e.deltaY * gain; }, { passive: true });

let dragging = false, lastY = 0;
viewport?.addEventListener('mousedown', (e) => { if (!isEditor) return; dragging = true; lastY = e.clientY; });

(function loop() { offset += vel; vel *= (1 - friction); if (offset > maxOffset) { offset = maxOffset; vel = 0; } if (offset < minOffset) { offset = minOffset; vel = 0; } timetable && (timetable.style.transform = `translateY(${offset}px)`); requestAnimationFrame(loop); })();

/* ----- Editor inputs ----- */
function openHourEditor(hour){
  const items = timetable.children[hour - startHour].querySelector('.items');
  const view  = items.querySelector('.txt');
  const edit  = items.querySelector('.txt-input');

  closeAnyHourEditor();

  edit.value = getHourText(hour);
  view.style.display = 'none';
  edit.style.display = 'block';
  edit.focus();
  edit.selectionStart = edit.selectionEnd = edit.value.length;
}
function closeHourEditor(hour, commit = true) {
  const items = timetable.children[hour - startHour].querySelector('.items');
  const view  = items.querySelector('.txt');
  const edit  = items.querySelector('.txt-input');

  if (commit) {
    setHourText(hour, edit.value);
    view.textContent = getHourText(hour);
  }

  edit.style.display = 'none';
  view.style.display = 'block';

  applyCollapsedState();
}
function closeAnyHourEditor(commit=true){
  const open = timetable.querySelectorAll('.txt-input');
  open.forEach(ta=>{
    if (ta.style.display === 'block'){
      closeHourEditor(parseInt(ta.dataset.hour,10), commit);
    }
  });
}

/* Editor clicks / interactions */
viewport?.addEventListener('dblclick', (e) => {
  if (!isEditor) return;
  const h = hourFromClick(e.clientY);
  const row = timetable.children[h - startHour];
  if (!row) return;
  if (row.classList.contains('collapsed')) {
    row.classList.remove('collapsed');
    row.dataset.tempOpen = '1';
    recalcLayout();
    updateNowLine();
  }
  openHourEditor(h);
});

timetable?.addEventListener('keydown', (e) => {
  const ta = e.target.closest?.('.txt-input');
  if (!ta) return;
  if ((e.key === 'Enter') && (e.shiftKey)) { e.stopPropagation(); return; }
  if ((e.key === 'Enter')) { e.preventDefault(); const hour = parseInt(ta.dataset.hour,10); closeHourEditor(hour, true); }
});
timetable?.addEventListener('blur', (e) => {
  const ta = e.target.closest?.('.txt-input');
  if (!ta) return;
  const hour = parseInt(ta.dataset.hour,10);
  setTimeout(()=> closeHourEditor(hour, true), 0);
}, true);

let __hourEls = [];
function cacheHourEls(){ __hourEls = Array.from(timetable.querySelectorAll('.hour')); }

function hourFromClick(clientY){
  if (!hourHeights || hourHeights.length === 0) {
    const r = timetable.getBoundingClientRect();
    const y = clientY - r.top;
    const idx = Math.max(0, Math.min(endHour - startHour, Math.floor(y / H)));
    return startHour + idx;
  }
  const r = timetable.getBoundingClientRect();
  const y = clientY - r.top;
  for (let i = 0; i < hourHeights.length; i++){
    const top = hourTop[i];
    const bot = top + hourHeights[i];
    if (y >= top && y < bot) return startHour + i;
  }
  if (y < 0) return startHour;
  const total = (hourTop.at(-1) ?? 0) + (hourHeights.at(-1) ?? H);
  if (y >= total) return endHour;
  return startHour;
}

/* ---------------- LOGIN / CLOUD helpers ---------------- */
function loadLocalData() {
  model = loadEntries();
  render();
  setMode(false);
  snapToCurrentHour();
}
function exportLocalData() { return exportTimetable(); }

function applyRemoteData(data, { preserveMode = true } = {}) {
  if (!data) return;

  const wasEditor = isEditor;   // aktuellen Zustand merken

  importTimetable(data);
  model = loadEntries();
  render();

  // Editor-Zustand optional beibehalten
  if (preserveMode && wasEditor) setMode(true);

  // Nur im Normalmodus automatisch zentrieren
  if (!isEditor) snapToCurrentHour();
}

const cloudStatusEl = document.getElementById('cloudStatus');

// ------------------ Cloud: robust color-only fix ------------------
// 1) Inject small CSS override to neutralize potential pseudo-element slashes
(function ensureCloudCssOnce() {
  if (document.getElementById('deskday-cloud-fix')) return;
  const s = document.createElement('style');
  s.id = 'deskday-cloud-fix';
  s.textContent = `
    /* hide any pseudo elements that draw a slash or overlay */
    .cloud-indicator::before, .cloud-indicator::after { display: none !important; }

    /* Ensure cloud-on looks full and readable; cloud-off muted */
    .cloud-indicator.cloud-on { color: #ffffff !important; opacity: 1 !important; text-decoration: none !important; filter: none !important; }
    .cloud-indicator.cloud-off { opacity: 0.6 !important; text-decoration: none !important; filter: none !important; }

    /* defensive: ensure the glyph itself isn't dimmed by user-agent rules */
    .cloud-indicator { text-decoration: none !important; }
  `;
  (document.head || document.documentElement).appendChild(s);
})();

// 2) Helper: set cloud element state (keeps original DOM, only styles + class + tooltip)
function setCloudState(isCloud, user = null) {
  const el = document.getElementById('cloudStatus') || document.querySelector('.cloud-indicator');
  if (!el) return false;

  const title = isCloud ? `Cloud mode (${user?.displayName || user?.email || 'Google user'})` : 'Local mode';

  // Deterministic class
  el.classList.toggle('cloud-on', !!isCloud);
  el.classList.toggle('cloud-off', !isCloud);
  try { window.__deskday_forceCloudInline?.(el, isCloud); } catch(e) {}

  // Inline style enforcement (color white for cloud, reset for local)
  try {
    if (isCloud) {
      el.style.color = '#ffffff';
      el.style.opacity = '1';
      el.style.textDecoration = 'none';
    } else {
      // remove forced white so CSS can decide; keep muted opacity
      el.style.color = '';
      el.style.opacity = '0.6';
      el.style.textDecoration = 'none';
    }
  } catch (e) {
    // ignore style failures
  }

  // Tooltip / accessibility
  try { el.setAttribute('title', title); el.setAttribute('aria-label', title); } catch(e){}

  // store desired state for observer
  el.dataset.__deskday_want = isCloud ? 'cloud' : 'local';

  // install a focused observer to re-assert if someone touches this exact element
  installCloudElementObserver(el);

  return true;
}

// ---- persistent cloud override: append last CSS + helper to set inline important ----
(function installPersistentCloudOverride() {
  const ID = 'deskday-cloud-latefix';
  if (document.getElementById(ID)) return;

  const css = `
    /* strong override for the cloud (placed late) */
    .set-card #cloudStatus.cloud-indicator.cloud-on,
    .set-card > .cloud-indicator.cloud-on,
    #cloudStatus.cloud-indicator.cloud-on,
    .cloud-indicator.cloud-on {
      color: #ffffff !important;
      opacity: 1 !important;
      text-decoration: none !important;
      filter: none !important;
    }
    .set-card .cloud-indicator.cloud-off::after,
    .set-card .cloud-indicator::after,
    #cloudStatus::after {
      display: none !important;
    }
    .set-card .cloud-indicator,
    #cloudStatus { pointer-events: auto !important; }
  `;

  const node = document.createElement('style');
  node.id = ID;
  node.textContent = css;
  // append _after_ initial UI render (try immediate head append; if head missing schedule)
  const attach = () => (document.head || document.documentElement).appendChild(node);
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', attach, { once: true });
  } else {
    attach();
  }

  // helper to set inline !important props (use when toggling state)
  window.__deskday_forceCloudInline = function(el, isCloud) {
    if (!el) el = document.getElementById('cloudStatus') || document.querySelector('.cloud-indicator');
    if (!el) return false;
    try {
      if (isCloud) {
        el.style.setProperty('color', '#ffffff', 'important');
        el.style.setProperty('opacity', '1', 'important');
      } else {
        el.style.setProperty('opacity', '0.6', 'important');
        el.style.removeProperty('color'); // allow stylesheet for local mode
      }
      return true;
    } catch(e) { return false; }
  };
})();

// 3) Focused MutationObserver that watches only the cloud element (lightweight)
//    Re-applies inline style + class if the element gets modified.
function installCloudElementObserver(targetEl) {
  if (!targetEl) return;
  if (targetEl.__deskday_cloud_observer_installed) return;
  targetEl.__deskday_cloud_observer_installed = true;

  const want = () => (targetEl.dataset.__deskday_want === 'cloud');

  const mo = new MutationObserver((mutations) => {
    // quick check: if class or style changed against our desired state, reassert
    const shouldBeCloud = want();
    const hasCloudOn = targetEl.classList.contains('cloud-on');

    if (shouldBeCloud && !hasCloudOn) {
      // re-apply cloud state
      try { setCloudState(true, null); } catch(e){ console.warn('[cloud-obs] restore failed', e); }
      return;
    }
    if (!shouldBeCloud && hasCloudOn) {
      try { setCloudState(false, null); } catch(e){ /* ignore */ }
      return;
    }

    // also ensure inline color/opacity remain correct
    const computedOpacity = getComputedStyle(targetEl).opacity;
    if (shouldBeCloud && computedOpacity !== '1') {
      try { targetEl.style.opacity = '1'; targetEl.style.color = '#ffffff'; } catch(e){ }
    }
  });

  mo.observe(targetEl, { attributes: true, attributeFilter: ['class', 'style', 'title', 'aria-label', 'data-*'] });

  // keep a small timed cleanup: after 3s we assume the UI stabilized; we keep observer but it's fine
  // (no heavy resource usage because it observes only one node)
}


// 4) Small convenience wrapper exposed for dev-testing
window.__deskday_setCloudState = (mode, user) => {
  try {
    const isCloud = (mode === 'cloud' || mode === true);
    return setCloudState(isCloud, user || null);
  } catch(e) { return false; }
};

// ---------- Forceful / robust updateCloudStatus (replace existing) ----------
function updateCloudStatus(mode, user) {
  const isCloud = (mode === 'cloud');
  const title = isCloud ? `Cloud mode (${user?.displayName || user?.email || 'Google user'})` : 'Local mode';

  const target = document.getElementById('cloudStatus')
               || document.querySelector('.cloud-indicator')
               || document.querySelector('[data-cloud]');

  if (!target) {
    console.warn('[cloud] updateCloudStatus: no cloud element found');
    return;
  }

  try {
    // deterministic classname (avoid incremental add/remove races)
    target.className = 'cloud-indicator ' + (isCloud ? 'cloud-on' : 'cloud-off');

    // Inline fallback styles so we are robust against stylesheet race
    if (isCloud) {
      target.style.opacity = '';
      target.style.textDecoration = 'none';
    } else {
      target.style.opacity = '0.55';
    }

    target.setAttribute('title', title);
    target.setAttribute('aria-label', title);

    // ensure CSS override exists (only once)
    if (!document.getElementById('deskday-cloud-fix')) {
      const s = document.createElement('style');
      s.id = 'deskday-cloud-fix';
      s.textContent = `
        .cloud-indicator::before, .cloud-indicator::after { display: none !important; }
        .cloud-indicator.cloud-on { opacity: 1 !important; text-decoration: none !important; }
        .cloud-indicator.cloud-off { opacity: 0.55 !important; }
      `;
      document.head.appendChild(s);
    }

    console.log('[cloud] updateCloudStatus ->', { mode, id: target.id || null, className: target.className });
  } catch (e) {
    console.warn('[cloud] updateCloudStatus failed', e);
  }
}


let __rtUnsub = null;
function startRealtimeSync(uid) {
  stopRealtimeSync();
  if (!uid || !window.cloud?.subscribeToTimetable) {
    console.warn('[realtime] subscribe skipped (missing uid or cloud bridge)');
    return;
  }
  try {
    __rtUnsub = window.cloud.subscribeToTimetable(uid, (remoteData) => {
  console.log('[realtime] update ->', !!remoteData);
  if (!remoteData) return;

  const applied = importTimetableNewestWins(remoteData); // vergleicht _meta.updatedAt
  if (applied) {
    // nur UI neu aufbauen – NICHT setMode(false) o. Ä. aufrufen
    model = loadEntries();
    render();
  } else {
    console.log('[realtime] ignored stale cloud snapshot');
  }
});
    console.log('[realtime] subscribed for', uid);
  } catch (e) {
    console.warn('[realtime] subscribe failed', e);
  }
}

// --- robust helper: wait for cloud element then update it (idempotent) ---
function waitForCloudEl(selector = '#cloudStatus, .cloud-indicator', timeoutMs = 2000) {
  return new Promise((resolve) => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);
    const interval = 80;
    let waited = 0;
    const id = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(id);
        return resolve(el);
      }
      waited += interval;
      if (waited >= timeoutMs) {
        clearInterval(id);
        return resolve(null);
      }
    }, interval);
  });
}

async function ensureCloudUpdate(mode, user = null) {
  // mode: 'cloud' or 'local'
  const el = await waitForCloudEl();
  if (!el) {
    console.warn('[cloud] ensureCloudUpdate: cloud element not found (timeout)');
    return false;
  }
  try {
    const isCloud = (mode === 'cloud');
    // deterministic: set classes and inline fallback
    el.classList.toggle('cloud-on', isCloud);
    el.classList.toggle('cloud-off', !isCloud);
    el.style.opacity = isCloud ? '1' : '0.55';
    el.style.textDecoration = 'none';
    const title = isCloud ? `Cloud mode (${user?.displayName || user?.email || 'Google user'})` : 'Local mode';
    el.title = title;
    el.setAttribute('aria-label', title);
    console.log('[cloud] ensureCloudUpdate applied ->', { id: el.id || null, className: el.className, title });
    return true;
  } catch (e) {
    console.warn('[cloud] ensureCloudUpdate failed', e);
    return false;
  }
}

// expose for quick testing in devtools
window.__deskday_forceCloud = (mode, user) => ensureCloudUpdate(mode, user);

function stopRealtimeSync() {
  if (__rtUnsub) {
    try { __rtUnsub(); } catch (e) { console.warn('[realtime] unsub failed', e); }
    __rtUnsub = null;
  }
}



// ---------------- Robust / tolerant updateLoginButton ----------------
// ---------------------- Helper: updateLoginButton ----------------------
// ---------- Sauberes / enges updateLoginButton (nur gezielte Elemente) ----------
// ---------- Clean / focused updateLoginButton (replace existing) ----------
function updateLoginButton(arg1, arg2) {
  // normalize signature: (state, user) or (user)
  let state = arg1;
  let user = arg2;
  if (typeof arg1 === 'object' && arg2 === undefined) {
    user = arg1;
    state = 'logout';
  }
  if (typeof state !== 'string') state = 'login';

  const userSummary = user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null;
  console.log('[ui] updateLoginButton called ->', { state, user: userSummary });

  // PRIMARY target: element with id="setLogin"
  const el = document.getElementById('setLogin');
  if (!el) {
    console.warn('[ui] updateLoginButton: #setLogin not found, skipping UI update');
    try { updateCloudStatus(state === 'logout' ? 'cloud' : 'local', user); } catch(e) {}
    return;
  }

  // mark element so delegated handlers / observers find it reliably
  try { el.setAttribute('data-auth-login', '1'); } catch(e){}

  // reset
  el.disabled = false;
  el.onclick = null;

  // loading state
  if (state === 'loading') {
    el.textContent = '...';
    el.disabled = true;
    try { updateCloudStatus('local', null); } catch(e) {}
    return;
  }

  // login state
  if (state === 'login') {
    el.textContent = 'Log in';
    el.disabled = false;
    el.title = 'Log in';
    el.setAttribute('aria-label', 'Log in');
    el.onclick = async (e) => {
      e?.preventDefault();
      try { el.disabled = true; await window.auth?.signInWithGoogle?.(); }
      catch (err) { console.warn('[ui] signIn failed', err); }
      finally { el.disabled = false; }
    };
    try { updateCloudStatus('local', null); } catch(e) {}
    return;
  }

  // logout state: visible text = generic "Sign out" (no name)
  if (state === 'logout') {
    const label = user ? (user.displayName || user.email || '') : '';
    el.textContent = 'Sign out';
    const tooltip = label ? `Signed in as ${label}` : 'Sign out';
    el.title = tooltip;
    el.setAttribute('aria-label', tooltip);

    el.onclick = async (e) => {
      e?.preventDefault();
      try {
        el.disabled = true;
        const cur = window.auth?.getCurrentUser?.();
        if (cur) {
          await window.auth?.signOut?.();
          // reflect immediately
          updateLoginButton('login', null);
        } else {
          // fallback: start login flow if no currentUser
          await window.auth?.signInWithGoogle?.();
        }
      } catch (err) {
        console.warn('[ui] auth toggle failed', err);
      } finally {
        el.disabled = false;
      }
    };

    try { updateCloudStatus('cloud', user); } catch(e) {}
    return;
  }

  // fallback safety
  el.textContent = 'Log in';
  el.title = 'Log in';
  el.setAttribute('aria-label', 'Log in');
  el.onclick = async () => { await window.auth?.signInWithGoogle?.(); };
  try { updateCloudStatus('local', null); } catch(e) {}
}

// ---------- Slim MutationObserver: reagiert nur auf explizit markierte Nodes ----------
function installAuthMutationObserver() {
  if (window.__deskday_auth_mutation_installed) return;
  window.__deskday_auth_mutation_installed = true;

  const mo = new MutationObserver((records) => {
    const cur = window.auth?.getCurrentUser?.();
    for (const rec of records) {
      for (const n of rec.addedNodes || []) {
        if (!(n instanceof HTMLElement)) continue;
        // react ONLY if the added node *is* an explicit auth node or contains one
        if (n.matches && (n.matches('#setLogin') || n.matches('[data-auth-login]') || n.matches('[data-auth-toggle]') || n.matches('.auth-toggle'))) {
          updateLoginButton(cur ? 'logout' : 'login', cur);
          return;
        }
        if (n.querySelector) {
          if (n.querySelector('#setLogin') || n.querySelector('[data-auth-login]') || n.querySelector('[data-auth-toggle]') || n.querySelector('.auth-toggle')) {
            updateLoginButton(cur ? 'logout' : 'login', cur);
            return;
          }
        }
      }
    }
  });

  mo.observe(document.body, { childList: true, subtree: true });
}

// ---------------------- Delegated click handler ----------------------
(function installAuthDelegatedHandler() {
  if (window.__deskday_auth_delegate_installed) return;
  window.__deskday_auth_delegate_installed = true;

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-auth-login]');
    if (!el) return;
    ev.preventDefault(); ev.stopPropagation();

    try {
      el.disabled = true;
      const cur = window.auth?.getCurrentUser?.();
      if (cur) {
        console.log('[auth-delegator] click -> signOut (uid)', cur.uid);
        await window.auth?.signOut?.();
        try { updateLoginButton('login', null); } catch(e) {}
      } else {
        console.log('[auth-delegator] click -> signInWithGoogle');
        await window.auth?.signInWithGoogle?.();
        // UI will be updated via onChange/onPoll when sign-in completes
      }
    } catch (err) {
      console.warn('[auth-delegator] auth toggle failed', err);
    } finally {
      setTimeout(() => { try { el.disabled = false; } catch(e) {} }, 200);
    }
  }, { capture: true });
})();

// ---------------------- Short poller (race-proof) ----------------------
(function installShortAuthPoller() {
  if (window.__deskday_auth_poller_installed) return;
  window.__deskday_auth_poller_installed = true;
  if (window.auth?.getCurrentUser?.()) return;

  const maxAttempts = 12;
  let attempts = 0;
  const id = setInterval(() => {
    attempts++;
    try {
      const cur = window.auth?.getCurrentUser?.();
      console.log('[auth-poller] attempt', attempts, 'cur ->', cur ? { uid: cur.uid, email: cur.email } : null);
      if (cur) {
        try { updateLoginButton('logout', cur); } catch(e) { console.warn('[auth-poller] updateLoginButton failed', e); }
        try { updateCloudStatus('cloud', cur); } catch(e) {}
        try { startRealtimeSync(cur.uid); } catch(e) {}
        try { window.loadFromCloudAndApply?.(cur.uid); } catch (e) {}
        clearInterval(id);
        return;
      }
      if (attempts >= maxAttempts) clearInterval(id);
    } catch (err) {
      console.warn('[auth-poller] error', err);
      if (attempts >= maxAttempts) clearInterval(id);
    }
  }, 250);
})();

// ---------------------- Auth realtime wiring ----------------------
(function wireAuthRealtime() {
  if (!window.auth) {
    console.warn('[auth] bridge missing — fallback to local');
    updateCloudStatus('local', null);
    return;
  }

  // immediate check (best-effort)
  try {
    const cur = window.auth.getCurrentUser?.() || null;
    console.log('[auth] immediate currentUser ->', cur ? { uid: cur.uid } : null);
    if (cur) {
      updateLoginButton('logout', cur);
      updateCloudStatus('cloud', cur);
      try { startRealtimeSync(cur.uid); } catch (e) {}
      window.loadFromCloudAndApply?.(cur.uid);
    } else {
      updateLoginButton('login', null);
      updateCloudStatus('local', null);
    }
  } catch (e) {
    console.warn('[auth] getCurrentUser threw', e);
    updateLoginButton('login', null);
    updateCloudStatus('local', null);
  }

  // subscribe to onChange (keep UI in sync)
  if (typeof window.auth.onChange === 'function') {
    window.auth.onChange((u) => {
      console.log('[auth] onChange ->', u);
      if (u) {
        updateLoginButton('logout', u);
        updateCloudStatus('cloud', u);
        try { startRealtimeSync(u.uid); } catch (e) {}
        try { window.loadFromCloudAndApply?.(u.uid); } catch (e) {}
      } else {
        stopRealtimeSync();
        updateLoginButton('login', null);
        updateCloudStatus('local', null);
        loadLocalData();
        setMode(false);
      }
    });
  } else {
    console.warn('[auth] onChange not available');
  }
})();
  
// expose helper for other modules (kept compatible)
window.__deskday_updateLoginButton = updateLoginButton;

/* ---------------- end LOGIN / CLOUD helpers ---------------- */



/* ------------------ DOMContentLoaded boot (BEREINIGT) ------------------ */
document.addEventListener('DOMContentLoaded', async () => {

  console.time('[entry] boot');

  // robust: wait for preload/firebase to say "ready" (with a safe timeout)
  async function waitForAuthReady(timeoutMs = 5000) {

    // Prefer explicit auth.waitForInitialAuth if exposed by preload (gives true/false whether user restored)
    try {
      if (window.auth && typeof window.auth.waitForInitialAuth === 'function') {
        console.log('[renderer] using auth.waitForInitialAuth() to await initial auth state');
        const restored = await window.auth.waitForInitialAuth(Math.min(timeoutMs, 5000));
        console.log('[renderer] auth.waitForInitialAuth ->', restored);
        return;
      }
    } catch (e) {
      console.warn('[renderer] auth.waitForInitialAuth threw', e);
    }

    // fallback: wait for firebaseReady flag from preload
    try {
      if (window.firebaseReady && typeof window.firebaseReady.isReady === 'function') {
        const start = Date.now();
        while (true) {
          try {
            if (window.firebaseReady.isReady()) { console.log('[renderer] firebaseReady.isReady -> true'); return; }
          } catch (e) { console.warn('[renderer] firebaseReady.isReady threw', e); }
          if (Date.now() - start > timeoutMs) { console.warn('[renderer] waitForAuthReady timeout, continuing anyway'); return; }
          await new Promise(r => setTimeout(r, 120));
        }
      }
    } catch (e) {
      console.warn('[renderer] waitForAuthReady fallback threw', e);
    }
  }

  await waitForAuthReady(5000);

      // --- Force UI sync after firebase/preload ready (insert in DOMContentLoaded boot) ---
try {
  const cur = window.auth?.getCurrentUser?.() || null;
  console.log('[ui] force-sync at boot — currentUser ->', cur);
  if (cur) {
    updateLoginButton('logout', cur);
    updateCloudStatus('cloud', cur);
    if (cur) {
  setCloudState(true, cur);
} else {
  setCloudState(false, null);
}
    // ensure realtime subscription starts if needed
    try { startRealtimeSync(cur.uid); } catch(e){ /* noop */ }
  } else {
    updateLoginButton('login', null);
    updateCloudStatus('local', null);
  }
} catch (e) {
  console.warn('[ui] force-sync failed', e);
}

  // ---------- small race-proof fallback: poll for restored auth (short-lived) ----------
(function installShortAuthPoller() {
  // only once
  if (window.__deskday_auth_poller_installed) return;
  window.__deskday_auth_poller_installed = true;

  // if already have user, nothing to do
  if (window.auth?.getCurrentUser?.()) return;

  // poll a few times (fast), then stop
  const maxAttempts = 12;       // 12 * 250ms = 3s total
  let attempts = 0;
  const id = setInterval(() => {
    attempts++;
    try {
      const cur = window.auth?.getCurrentUser?.();
      console.log('[auth-poller] attempt', attempts, 'cur ->', cur ? { uid: cur.uid, email: cur.email } : null);
      if (cur) {
        // found restored user -> update UI and start realtime
        try { updateLoginButton('logout', cur); } catch (e) { console.warn('[auth-poller] updateLoginButton failed', e); }
        try { updateCloudStatus('cloud', cur); } catch (e) {}
        try { startRealtimeSync(cur.uid); } catch (e) {}
        // also try to load remote once
        try { window.loadFromCloudAndApply?.(cur.uid); } catch (e) {}
        clearInterval(id);
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(id);
      }
    } catch (err) {
      console.warn('[auth-poller] error', err);
      if (attempts >= maxAttempts) clearInterval(id);
    }
  }, 250);
})();

  // ---- Auth wiring: set indicator + start/stop realtime + initial cloud sync ----
(function wireAuthRealtime(){
  if (!window.auth) {
    console.warn('[auth] bridge missing — fallback to local');
    updateCloudStatus('local', null);
    return;
  }

  // Sofortstatus
try {
  const cur = window.auth.getCurrentUser?.() || null;
  if (cur) {
    updateCloudStatus('cloud', cur);
    startRealtimeSync(cur.uid);
    // NEU: aktualisiere auch den Login-Button gleich beim Start
    updateLoginButton('logout', cur);
    // initial Cloud laden (wenn vorhanden), sonst lokale hochladen (best effort)
    window.loadFromCloudAndApply?.(cur.uid);
  } else {
    updateCloudStatus('local', null);
    updateLoginButton('login', null); // setze Button auf Login
  }
} catch (e) {
  console.warn('[auth] getCurrentUser threw', e);
  updateCloudStatus('local', null);
  updateLoginButton('login', null);
}

  // Laufende Änderungen
  if (typeof window.auth.onChange === 'function') {
  window.auth.onChange((u) => {
    console.log('[auth] onChange ->', u);
    if (u) {
      updateCloudStatus('cloud', u);
      
      startRealtimeSync(u.uid);
      window.loadFromCloudAndApply?.(u.uid);
      updateLoginButton('logout', u);
      setCloudState(!!u, u);
    } else {
      stopRealtimeSync();
      updateCloudStatus('local', null);
      updateLoginButton('login', null);
      loadLocalData();
      setMode(false);
    }
  });
}
})();

//#####################################################################################################

// Delegated auth toggle handler — put this once during boot (DOMContentLoaded)
(function installAuthDelegatedHandler() {
  if (window.__deskday_auth_delegate_installed) return;
  window.__deskday_auth_delegate_installed = true;

  document.addEventListener('click', async (ev) => {
    // find nearest element marked for auth toggle
    const el = ev.target.closest && ev.target.closest('[data-auth-login]');
    if (!el) return; // not an auth control

    // prevent any other handlers in siblings from also running
    ev.preventDefault();
    ev.stopPropagation();

    try {
      el.disabled = true;

      // read live auth state (always use the bridge)
      const cur = window.auth?.getCurrentUser?.();

      if (cur) {
        // currently logged in -> sign out
        console.log('[auth-delegator] click -> signOut (uid)', cur.uid);
        await window.auth?.signOut?.();
        // update UI immediately (best-effort)
        try { updateLoginButton('login', null); } catch(e) {}
      } else {
        // not logged in -> start login flow
        console.log('[auth-delegator] click -> signInWithGoogle');
        await window.auth?.signInWithGoogle?.();
        // UI will be updated via auth.onChange when sign-in completes
      }
    } catch (err) {
      console.warn('[auth-delegator] auth toggle failed', err);
    } finally {
      // small delay to avoid re-enable racing the UI replacement
      setTimeout(() => { try { el.disabled = false; } catch(e) {} }, 200);
    }
  }, { capture: true }); // capture to get clicks before some libraries stopPropagation
})();

//#########################################################################################

  // Settings boot
  const initialSettings = getSettings();
  applyHourFormat(initialSettings.hour12, {labelSelector: '.hour .label'});
  try { await bootSettings({ labelSelector: '.hour .label' }); } catch (e) { console.error('bootSettings failed', e); }

  // Small helper used by login/cloud components (kept in scope)
  async function loadFromCloudAndApply(uid) {
    if (!uid) return null;
    if (!window.cloud || typeof window.cloud.loadTimetable !== 'function') return null;
    try {
      const data = await window.cloud.loadTimetable(uid);
      if (data) {
  if (shouldApplyRemote(data)) {
    // Cloud ist neuer -> hart übernehmen
    importTimetable(data, { mode: 'force' });
    model = loadEntries();
    render();
  } else {
    // Lokal ist neuer -> lokalen Stand hochladen
    const local = exportTimetable(); // enthält _meta.updatedAt
    await window.cloud.saveTimetable(uid, local);
  }
} else {
  // Noch keine Cloud-Daten -> lokalen Stand hochladen
  const local = exportTimetable();
  await window.cloud.saveTimetable(uid, local);
}
    } catch (e) { console.warn('[renderer] loadFromCloudAndApply failed', e); }
    return null;
  }
  window.loadFromCloudAndApply = loadFromCloudAndApply;

  // Defensive AuthState.initialize: pass local functions or noop so it cannot throw
  try {
    const safeStartRealtime = () => { /* noop; real subscribe handled elsewhere */ };
    const safeStopRealtime = () => { /* noop */ };
    AuthState?.initialize?.({
      loadLocalData,
      startRealtimeSync: safeStartRealtime,
      stopRealtimeSync: safeStopRealtime,
      saveTimetable: async () => {},
      exportLocalData,
      updateUI: updateLoginButton
    });
  } catch (e) {
    console.warn('[renderer] AuthState.initialize failed (ignored)', e);
  }

  // Start bootLoginMode but don't allow it to throw UI-breaking errors
  try {
    await bootLoginMode({
      loadLocalData,
      exportLocalData,
      applyRemoteData,
      updateLoginButton: (typeof AuthState?.handleAuthStateChange === 'function') ? AuthState.handleAuthStateChange : updateLoginButton
    });
  } catch (e) {
    console.warn('[renderer] bootLoginMode failed (ignored)', e);
    updateLoginButton('login', null);
  }

  // ---------- install observer to update newly added auth controls ----------
function installAuthMutationObserver() {
  if (window.__deskday_auth_mutation_installed) return;
  window.__deskday_auth_mutation_installed = true;

  const mo = new MutationObserver((records) => {
    const cur = window.auth?.getCurrentUser?.();
    let found = false;
    for (const rec of records) {
      for (const n of rec.addedNodes || []) {
        if (!(n instanceof HTMLElement)) continue;
        // if a new node contains an auth control by attribute or button text, update it
        if (n.matches && n.matches('[data-auth-login]')) { updateLoginButton(cur ? 'logout' : 'login', cur); found = true; break; }
        if (n.querySelector && n.querySelector('[data-auth-login]')) { updateLoginButton(cur ? 'logout' : 'login', cur); found = true; break; }
        if (n.querySelector && n.querySelector('button, a')) {
          const maybe = Array.from(n.querySelectorAll('button, a')).find(b => /sign|log/i.test(b.textContent || ''));
          if (maybe) { updateLoginButton(cur ? 'logout' : 'login', cur); found = true; break; }
        }
      }
      if (found) break;
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

  // ----------------- Wire options menu / buttons (UI) -----------------
  if (optBtn && optMenu) {
    optBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      optMenu.classList.toggle('hidden');
      const isOpen = !optMenu.classList.contains('hidden');
      optBtn.setAttribute('aria-expanded', String(isOpen));
      optBtn.classList.toggle('open', isOpen);
      optTE?.classList.toggle('active', isEditor);
    });
    function closeOptionsMenu(){ if (!optMenu) return; optMenu.classList.add('hidden'); optBtn?.setAttribute('aria-expanded', 'false'); optBtn?.classList.remove('open'); }
    optMenu.addEventListener('click', (e) => { const item = e.target.closest('[data-om-item]'); if (!item) return; if (item.dataset.noClose === 'true') return; setTimeout(closeOptionsMenu, 0); });
    optMenu.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const item = e.target.closest('[data-om-item]'); if (!item) return; e.preventDefault(); item.click(); setTimeout(closeOptionsMenu, 0); });
    document.addEventListener('click', (e) => { if (optMenu.classList.contains('hidden')) return; if (!optMenu.contains(e.target) && e.target !== optBtn) { optMenu.classList.add('hidden'); optBtn.setAttribute('aria-expanded', 'false'); optBtn.classList.remove('open'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !optMenu.classList.contains('hidden')) { optMenu.classList.add('hidden'); optBtn.setAttribute('aria-expanded', 'false'); optBtn.classList.remove('open'); } });
  }

  // optSet (settings overlay) -> pass label selector
  if (optSet) {
    optSet.addEventListener('click', (e) => {
      e.stopPropagation();
      try { openSet({ labelSelector: '.hour .label' }); }
      catch (err) { console.warn('openSet failed', err); openSet(); }
    });
  }

  // Close button inside settings if exist (uses closeSet from module)
  const setCloseEl = document.getElementById('setClose');
  if (setCloseEl) {
    setCloseEl.addEventListener('click', (e) => { e.stopPropagation(); try { closeSet(); } catch(e){ document.getElementById('setOverlay')?.classList.add('hidden'); } });
  }

  // optMin
  if (optMin) optMin.addEventListener('click', () => { window.appApi?.minimizeToTray(); });

  // TTE toggle
  if (optTE) {
    optTE.addEventListener('click', (e) => { e.stopPropagation(); setMode(!isEditor); optMenu?.classList.add('hidden'); });
  }
  // separate TEI button
  if (teiBtn){
    teiBtn.addEventListener('click', (e) => { e.stopPropagation(); setMode(!isEditor); });
  }

  // start/end overlay button
  if (stBtn){
    stBtn.addEventListener('click', () => { closeAnyHourEditor(true); openSEE({start:startHour, end:endHour}); });
  }

  // collapse empty
  if (colEmpBtn){
    colEmpBtn.addEventListener('click', () => {
      collapseState.auto = !collapseState.auto;
      saveCollapseState();
      updateAllSummaries();
      applyCollapsedState();
      recalcLayout();
      updateNowLine();
      snapToCurrentHour({ smooth:true });
      colEmpBtn.setAttribute('aria-expanded', String(collapseState.auto));
      colEmpBtn.classList.toggle('active', collapseState.auto);
      colEmpBtn.setAttribute('aria-pressed', String(collapseState.auto));
    });
  }

  // Escape behaviour: close editors + overlays
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    const openInputs = timetable.querySelectorAll('.txt-input[style*="display: block"]');
    openInputs.forEach(inp => { const hour = parseInt(inp.dataset.hour, 10); closeHourEditor(hour, false); });
    closeSEE();
    applyCollapsedState();
    if (isEditor && openInputs.length === 0) setMode(false);
  });

  // hours load
  const hours = loadHours();
  if (hours) { startHour = hours.start; endHour = hours.end; } else openSEE({start:5, end:22});

  // initial render & boot UI
  render();
  timetable.classList.add('ready');
  setMode(false);
  snapToCurrentHour();
  scheduleHourlySnap();
  const settingsAfterRender = getSettings();
  applyHourFormat(settingsAfterRender.hour12, { labelSelector: '.hour .label' });

  const whenFontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  whenFontsReady.then(() => {
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      recalcLayout();
      ensureNowLine();
      updateNowLine();
      startNowLineTicker();
    }));
  });


  console.timeEnd('[entry] boot');
  console.log('[entry] ready ✅');
});

/* -------------- beforeunload -------------- */
window.addEventListener('beforeunload', () => {
  try { saveEntries(model); saveCollapseState(); } catch (e) { console.log('[Deskday] beforeunload save failed', e); }
});
