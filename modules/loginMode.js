// modules/loginMode.js
// ---------------------
// Manages login state transitions (local ↔ cloud mode)
// Auth truth: Firebase's onAuthStateChanged (persisted via Keytar + browserLocalPersistence)
// Mode tracking: Only for UI display, not for auth control

const MODE_KEY = 'tt.mode';      
const FIRST_KEY = 'tt.firstRun'; 
let __deskday_signin_promise = null; // Single-flight login protection// --- Exporte für den externen Zugriff ---

export function getMode() {
  return localStorage.getItem(MODE_KEY) || 'local';
}

export function setMode(mode) {
  localStorage.setItem(MODE_KEY, mode);
}

export function isFirstRun() {
  return !localStorage.getItem(FIRST_KEY);
}

export function markFirstRunDone() {
  localStorage.setItem(FIRST_KEY, '1');
}

export async function logout() {
  if (window.auth?.signOut) {
    // setMode('local') erfolgt im authState.js/deskdayLogoutHandler VOR dem signOut
    await window.auth.signOut();
  }
}

export async function loginWithGoogle() {
  if (__deskday_signin_promise) {
    return __deskday_signin_promise;
  }

  __deskday_signin_promise = (async () => {
    if (!window.auth || typeof window.auth.signInWithGoogle !== 'function') {
      throw new Error('Auth bridge not available.');
    }

    const user = await window.auth.signInWithGoogle();
    markFirstRunDone();
    return user;
  })();

  try {
    return await __deskday_signin_promise;
  } finally {
    __deskday_signin_promise = null;
  }
}

// -------------------------------------------------------------
// Core: Bootstrapping und Listener-Verdrahtung
// -------------------------------------------------------------

/**
 * After successful login: sync timetable data
 * Either load from cloud (if exists) or push local data to cloud (first login)
 * 
 * @param {object} user - The logged-in Firebase user
 * @param {object} options - Callbacks for data access
 */
async function handleUserLoggedIn(user, { exportLocalData, applyRemoteData }) {
  const uid = user.uid;
  let remote = null;
  
  // Try to load data from cloud
  if (window.cloud?.loadTimetable) {
    remote = await window.cloud.loadTimetable(uid);
  }

  if (remote) {
    // Cloud data exists: use it (cloud wins on login)
    console.log('[loginMode] ✓ Applying remote data from cloud');
    applyRemoteData?.(remote);
  } else if (exportLocalData && window.cloud?.saveTimetable) {
    // No cloud data: push local data (first login)
    const local = exportLocalData();
    if (local) {
      console.log('[loginMode] ✓ Uploading local data to cloud (first login)');
      await window.cloud.saveTimetable(uid, local);
    }
  }
}
/**
 * Haupt-Entry: Login-/Mode-Logik booten
 * Auth is fully restored by preload.js before this is called:
 * - Refresh token (Keytar) is exchanged for Google tokens
 * - Firebase signs in automatically
 * - This function waits for the first auth event from Firebase
 * 
 * @param {object} options - Contains all required callbacks and delegates
 */
export async function bootLoginMode(options = {}) {
  const {
    loadLocalData, 
    exportLocalData, 
    applyRemoteData, 
    updateLoginButton: handleStateDelegate, // handleAuthStateChange aus authState.js
    showReLoginPopup, 
  } = options;  if (typeof handleStateDelegate !== 'function') {
    console.error('[loginMode] Delegate handleAuthStateChange is missing!');
    return;
  }

  // 1) Erster Start?
  if (isFirstRun()) {
    markFirstRunDone();
    setMode('local');
    loadLocalData?.();
    handleStateDelegate(null); // Setze UI auf "Log in"
    return;
  }

  // 2) Nicht erster Start → Modus auslesen
  const mode = getMode();

  if (!window.auth?.onChange) {
    console.warn('[loginMode] auth.onChange missing, fallback to local/manual mode.');
    setMode('local');
    handleStateDelegate(null); 
    return;
  }

  // Initialer Zustand setzen (Der Delegate setzt die UI, wird vom ersten Auth-Event überschrieben)
  if (mode === 'local') { 
    loadLocalData?.(); 
    handleStateDelegate(null); 
  } else {
    // Wenn der Modus 'cloud' ist, warten wir auf Firebase, setzen aber keine UI-Daten (nur "Loading" über den Delegate).
    // Wir lassen Firebase das initiale Laden übernehmen.
  }


  // Warte auf das erste Auth-Event (für Persistenz-Fix)
  let hasInitialState = false;
  let resolveInitialAuth;
  const initialAuthPromise = new Promise(resolve => resolveInitialAuth = resolve);
  
  // 3) Listener verdrahten
  window.auth.onChange(async (user) => {
    const isFirstCall = !hasInitialState;
    hasInitialState = true;
    resolveInitialAuth(); // Löse das Initial-Promise beim ersten Event auf
    
    // Hole den Modus JEDES MAL neu, um Race Conditions zu vermeiden
    const currentMode = getMode();

    // --- 1. Schutz vor explizitem Logout (wenn user === null) ---
    // Das Flag __deskday_isExplicitlyLoggingOut wird in authState.js gesetzt und zurückgesetzt.
    if (!user && window.__deskday_isExplicitlyLoggingOut) {
      console.log('[loginMode] Ignoring auth.onChange(null) due to explicit logout in progress.');
      return; 
    }

    // --- 2. User angemeldet (user != null) ---
    if (user) {
      console.log(`[loginMode] User logged in: ${user.email}. Starting sync...`);
      setMode('cloud');
      
      // Führe Daten-Logik aus
      await handleUserLoggedIn(user, { exportLocalData, applyRemoteData }); 
      
      // Delegiere UI-Steuerung an den zentralen Handler
      handleStateDelegate(user); 
      
    } else {
      // --- 3. User abgemeldet (user === null) ---

      // 3a) Ignoriere initiales 'null' im Cloud-Mode (Firebase liest Persistenz)
      if (isFirstCall && currentMode === 'cloud') {
        console.log('[loginMode] Ignoring initial null state (waiting for persistence).');
        return; 
      }
      
      // 3b) Echter Session-Verlust (Mode war 'cloud', jetzt 'null')
      if (currentMode === 'cloud') {
        console.warn('[loginMode] Session lost. Fallback to local and show relogin.'); 
        setMode('local');
        showReLoginPopup?.(); 
      }
      
      // 3c) Delegiere UI-Steuerung (Setzt UI auf "Log in", lädt lokale Daten)
      handleStateDelegate(null);
    }
  });

  // Wichtig: Erst mit dem Renderer-Boot fortfahren, wenn das initiale Auth-Event kam
  await initialAuthPromise; 
}