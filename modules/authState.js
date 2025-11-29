// modules/authState.js
// ---------------------
// Verwaltet den UI-Zustand des Login-Buttons, Cloud-Indikators und Realtime-Listeners.

/**
 * @typedef {object} AuthContext
 * @property {function(string, object|null): void} setMode - Setzt den lokalen/Cloud-Modus (aus loginMode.js)
 * @property {function(): void} loadLocalData - Lädt die lokalen Daten in die UI (aus renderer.js)
 * @property {function(string): void} startRealtimeSync - Startet den Cloud-Sync-Listener (aus renderer.js)
 * @property {function(): void} stopRealtimeSync - Stoppt den Cloud-Sync-Listener (aus renderer.js)
 * @property {function(string, string): Promise<void>} saveTimetable - Speichert Daten in der Cloud (aus window.cloud)
 * @property {function(): object|null} exportLocalData - Liefert aktuelle lokale Daten (aus renderer.js)
 */

let authContext = {};
const loginBtn = document.getElementById('setLogin');
// Das globale Flag __deskday_isExplicitlyLoggingOut wird hier benötigt:
window.__deskday_isExplicitlyLoggingOut = false; 

/**
 * Registriert die notwendigen Abhängigkeiten beim App-Start.
 * @param {AuthContext} ctx
 */
export function initialize(ctx) {
    authContext = ctx;
    // Hängt die Handler einmalig an das globale window-Objekt
    window.deskdayLoginHandler = handleLoginClick;
    window.deskdayLogoutHandler = handleLogoutClick;
}

/**
 * ZENTRALE STEUERUNG: Aktualisiert die gesamte UI basierend auf dem Auth-Status.
 * Diese Funktion ist die EINZIGE, die den Button-Zustand setzt und wird vom Firebase-Listener
 * in loginMode.js (und bei Fehlern in den Handlern) aufgerufen.
 * @param {object|null} user - Aktueller Firebase User
 */
export function handleAuthStateChange(user) {
    
    // 1. Alle alten Listener entfernen
    if (loginBtn) {
        loginBtn.removeEventListener('click', window.deskdayLoginHandler);
        loginBtn.removeEventListener('click', window.deskdayLogoutHandler);
    }
    
    // Stelle sicher, dass das Lade-Flag zurückgesetzt wird (falls es im Handler hängen geblieben ist)
    if (loginBtn) {
        loginBtn.disabled = false; 
    }

    // 2. Zustand setzen
    if (user) {
        // --- Zustand: ANGEMELDET / CLOUD ---
        console.log('[authState] State: CLOUD / Logged In');
        
        // Button-UI
        const displayName = user.displayName || user.email || 'User';
        if (loginBtn) {
            loginBtn.textContent = `Sign out (${displayName})`;
            // Listener für den Logout-Prozess anhängen
            loginBtn.addEventListener('click', window.deskdayLogoutHandler);
        }

        // Cloud-Indikator
        if (typeof updateCloudStatus === 'function') {
            updateCloudStatus('cloud', user);
        }

        // Starte Realtime-Sync
        authContext.startRealtimeSync?.(user.uid);

    } else {
        // --- Zustand: ABGEMELDET / LOKAL ---
        console.log('[authState] State: LOCAL / Logged Out');
        
        // Button-UI
        if (loginBtn) {
            loginBtn.textContent = 'Log in';
            // Listener für den Login-Prozess anhängen
            loginBtn.addEventListener('click', window.deskdayLoginHandler);
        }

        // Cloud-Indikator
        if (typeof updateCloudStatus === 'function') {
            updateCloudStatus('local', null);
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