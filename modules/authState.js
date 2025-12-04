// modules/authState.js
// ---------------------
// Manages login button UI and delegated auth state changes
// 
// Single responsibility: Update UI when Firebase auth state changes
// - Responds to auth events from loginMode.js (which watches Firebase)
// - Does NOT manage tokens or persistence (that's main.js + preload.js)
// - Only controls login button text and event listeners

/**
 * @typedef {object} AuthContext
 * @property {function(string, object|null): void} setMode - Set local/cloud mode (from loginMode.js)
 * @property {function(): void} loadLocalData - Render local data to UI
 * @property {function(string): void} startRealtimeSync - Start cloud sync listener
 * @property {function(): void} stopRealtimeSync - Stop cloud sync listener
 * @property {function(string, string): Promise<void>} saveTimetable - Save data to cloud
 * @property {function(): object|null} exportLocalData - Get current UI data
 */

let authContext = {};
const loginBtn = document.getElementById('setLogin');
// Global flag to protect logout flow (prevents race conditions)
window.__deskday_isExplicitlyLoggingOut = false; 

/**
 * Register dependencies and set up handler references
 * Called once on app startup by renderer.js
 * 
 * @param {AuthContext} ctx - Dependencies from renderer.js
 */
export function initialize(ctx) {
    authContext = ctx;
    // Store handlers globally for event listener attachment
    window.deskdayLoginHandler = handleLoginClick;
    window.deskdayLogoutHandler = handleLogoutClick;
}

/**
 * CENTRAL CONTROL: Update entire UI based on auth status
 * Called ONLY from Firebase listener (via loginMode.js)
 * 
 * This is the single source of truth for button state and listeners
 * 
 * @param {object|null} user - Current Firebase user, or null if logged out
 */
export function handleAuthStateChange(user) {
    
    // 1. Remove old listeners to prevent duplicates
    if (loginBtn) {
        loginBtn.removeEventListener('click', window.deskdayLoginHandler);
        loginBtn.removeEventListener('click', window.deskdayLogoutHandler);
    }
    
    // Reset disabled state (in case it got stuck during a handler)
    if (loginBtn) {
        loginBtn.disabled = false; 
    }

    // 2. Set new UI state based on auth
    if (user) {
        // --- STATE: LOGGED IN / CLOUD MODE ---
        console.log('[authState] ✓ Logged in:', user.email);
        
        if (loginBtn) {
            loginBtn.textContent = `Sign out`;
            // Attach logout handler
            loginBtn.addEventListener('click', window.deskdayLogoutHandler);
        }

        // Update cloud status indicator
        if (typeof authContext.updateCloudStatus === 'function') {
            authContext.updateCloudStatus('cloud', user);
        }

        // Start realtime sync with cloud
        authContext.startRealtimeSync?.(user.uid);

    } else {
        // --- STATE: LOGGED OUT / LOCAL MODE ---
        console.log('[authState] ✗ Logged out');
        
        if (loginBtn) {
            loginBtn.textContent = 'Log in';
            // Attach login handler
            loginBtn.addEventListener('click', window.deskdayLoginHandler);
        }

        // Update cloud status indicator
        if (typeof authContext.updateCloudStatus === 'function') {
            authContext.updateCloudStatus('local', null);
        }

        // Stoppe Realtime-Sync
        authContext.stopRealtimeSync?.();

        // Lade lokale Daten (Wichtig beim Start oder nach Logout)
        authContext.loadLocalData?.();
    }
}


/**
 * Click-Handler für den Login-Button (wird in handleAuthStateChange angehängt)
 */
async function handleLoginClick(ev) {
    if (loginBtn) {
        loginBtn.textContent = '...';
        loginBtn.disabled = true; // Button disablen, um Doppelklicks zu verhindern
    }
    
    try {
        // Annahme: loginWithGoogle ist in loginMode.js exportiert und global/via Bridge verfügbar
        const user = await loginWithGoogle(); 
        console.log('[authState] Login success. Delegating UI update to Firebase listener.');
        
        // Erst-Sync nach Login: Cloud-Daten lesen und/oder lokale Daten hochladen
        if (user && typeof loadFromCloudAndApply === 'function') {
             // loadFromCloudAndApply muss sicherstellen, dass es nur einmal läuft und die Daten anwendet
            await loadFromCloudAndApply(user.uid);
        }
        
    } catch (err) {
        console.error('[authState] Login failed or cancelled:', err);
        // Bei Fehler: Manuelles Zurücksetzen der UI, da handleAuthStateChange nicht immer feuert.
        handleAuthStateChange(window.auth?.getCurrentUser?.()); 
        
    }
    // HINWEIS: Es gibt hier KEINE finally-Klausel, die den Button wieder auf 'login' setzt.
    // Das finale UI-Update kommt nur vom handleAuthStateChange, das durch den Firebase-Status 
    // ausgelöst wird.
}


/**
 * Click-Handler für den Logout-Button (wird in handleAuthStateChange angehängt)
 */
async function handleLogoutClick(ev) {
    if (loginBtn) {
        loginBtn.textContent = '...';
        loginBtn.disabled = true;
    }

    // Setze Schutz-Flag, um loginMode.js zu blockieren (verhindert Re-Login Popup)
    window.__deskday_isExplicitlyLoggingOut = true; 
    
    try {
        // 1. Finaler Save an die Cloud
        if (authContext.exportLocalData && authContext.saveTimetable) {
            const user = window.auth?.getCurrentUser?.();
            const localData = authContext.exportLocalData();
            if (user && localData) {
                await authContext.saveTimetable(user.uid, localData);
                console.log('[authState] Final save to cloud successful.');
            }
        }
        
        // 2. Setze den Modus auf 'local' VOR dem Firebase-Logout
        authContext.setMode?.('local'); 

        // 3. Führe den tatsächlichen Firebase-Logout aus
        // Annahme: logout ist in loginMode.js exportiert und global/via Bridge verfügbar
        await logout(); 

        // Das abschließende UI-Update wird durch Firebase's auth.onChange(null) ausgelöst,
        // das handleAuthStateChange(null) aufruft.

    } catch (e) { 
        console.error('[authState] Logout failed:', e); 
    }
    finally {
        // WICHTIG: Flag ZUERST zurücksetzen, damit der nächste Start/Login klappt.
        window.__deskday_isExplicitlyLoggingOut = false; 
    }
}