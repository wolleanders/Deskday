// preload.js (Bereinigte Version mit Fokus auf Persistenz)
const { contextBridge, ipcRenderer } = require('electron');

// --- Globals ---
let __dd_currentUser = null;
let __dd_onChangeCbs = [];
let __dd_signInInFlight = null;
let __dd_firebaseReady = false;

// --- Helper Functions (Private) ---

function __dd_invokeOnChangeCallbacks() {
    const cbs = __dd_onChangeCbs.slice();
    const run = () => {
        for (const cb of cbs) {
            try { cb(__dd_currentUser); } catch (err) { console.error('[preload] onChange cb threw', err); }
        }
    };
    if (typeof queueMicrotask === 'function') queueMicrotask(run);
    else setTimeout(run, 0);
}

// --- API Stubs (Initial setup) ---

const authApi = {
    async signInWithGoogle() { throw new Error('[preload] Auth not initialized'); },
    async signOut() {},
    onChange(cb) {
        if (typeof cb === 'function') cb(null);
        return () => {};
    },
    waitForInitialAuth: (ms = 3000) => Promise.resolve(false)
};

// --- Exposed Bridges ---

contextBridge.exposeInMainWorld('__deskday_tokens', {
    // Only refreshIfAvailable is needed here
    refreshIfAvailable: async (opts = {}) => {
        try {
            const tokens = await ipcRenderer.invoke('tokens:refreshGoogle', opts);
            return tokens || null;
        } catch (e) {
            // Note: Error means refresh failed (e.g., token revoked)
            return null;
        }
    },
    deleteRefresh: async () => { await ipcRenderer.invoke('tokens:deleteRefresh'); }
});

contextBridge.exposeInMainWorld('auth', {
    signInWithGoogle: (...args) => authApi.signInWithGoogle(...args),
    signOut:          (...args) => authApi.signOut(...args),
    onChange:         (cb)      => authApi.onChange(cb),
    getCurrentUser:   ()        => (__dd_currentUser),
    waitForInitialAuth: (ms)    => authApi.waitForInitialAuth ? authApi.waitForInitialAuth(ms) : Promise.resolve(false)
});

contextBridge.exposeInMainWorld('firebaseReady', {
    isReady: () => __dd_firebaseReady
});

contextBridge.exposeInMainWorld('appApi', {
    minimizeToTray: () => ipcRenderer.invoke('tray:minimize'),
    showFromTray:   () => ipcRenderer.invoke('tray:show'),
    quitApp:        () => ipcRenderer.invoke('app:quit'),
    flushStorage:   () => ipcRenderer.invoke('storage:flush'),
    // Auto-updater API
    installUpdate:  () => ipcRenderer.invoke('updater:installUpdate'),
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    onUpdateAvailable: (cb) => ipcRenderer.on('update:available', (_, data) => cb(data)),
    onUpdateDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_, data) => cb(data))
});

contextBridge.exposeInMainWorld('winCtl', {
    setAOT: (on) => ipcRenderer.invoke('window:setAlwaysOnTop', on)
});

contextBridge.exposeInMainWorld('autostart', {
    get: () => ipcRenderer.invoke('autostart:get'),
    set: (on) => ipcRenderer.invoke('autostart:set', on)
});

// ---- Firebase init & Core Logic (async) ----
(async () => {
    try {
        const { initializeApp } = await import('firebase/app');
        const {
            getAuth,
            setPersistence,
            browserLocalPersistence,
            GoogleAuthProvider,
            signInWithCredential,
            onAuthStateChanged,
            signOut,
        } = await import('firebase/auth');

        const {
            getFirestore,
            doc,
            getDoc,
            setDoc,
            onSnapshot,
            serverTimestamp
        } = await import('firebase/firestore');

        const firebaseConfig = {
            apiKey: "AIzaSyDz8GU3XhtAiYo6oHp0lGAaBcjn-T3RdnA",
            authDomain: "deskday-7a3d6.firebaseapp.com",
            projectId: "deskday-7a3d6",
            storageBucket: "deskday-7a3d6.firebasestorage.app",
            messagingSenderId: "1068554735717",
            appId: "1:1068554735717:web:ce069aa62ab4d3972ab68c",
            measurementId: "G-EPCDZQ6K1B"
        };
        
        const DESKTOP_CLIENT_ID = '1068554735717-haqdeeoaejhbsmn3f807vqnq3arnv5gk.apps.googleusercontent.com';

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);
        
        // 1) Set Firebase Persistence
        try {
            await setPersistence(auth, browserLocalPersistence);
            console.log('[preload] ✓ browserLocalPersistence enabled');
        } catch (err) {
            console.warn('[preload] setPersistence failed (using default/session)', err);
        }
        
        // 2) Auto-restore via Refresh Token (Keytar)
        // Try to restore session from saved refresh token on app boot
        try {
            console.log('[preload] attempting to restore session from refresh token...');
            const refreshResp = await ipcRenderer.invoke('tokens:refreshGoogle', {
                clientId: DESKTOP_CLIENT_ID
            });

            if (refreshResp && refreshResp.id_token) {
                console.log('[preload] ✓ got refresh token response, signing in to firebase...');
                const cred = GoogleAuthProvider.credential(refreshResp.id_token, refreshResp.access_token);
                await signInWithCredential(auth, cred);
                console.log('[preload] ✓ restored firebase sign-in from refresh token');
            } else {
                console.log('[preload] no refresh token available (first login or token cleared)');
            }
        } catch (e) {
            // Failure is normal if no refresh token saved (first login)
            // or if token is expired/revoked
            console.error('[preload] token restoration failed:', String(e));
            if (String(e).includes('invalid_grant')) {
                console.log('[preload] refresh token was revoked, clearing');
                await ipcRenderer.invoke('tokens:deleteRefresh').catch(() => {});
            }
            // Otherwise silently continue; onAuthStateChanged will determine login state
        }

        // 3) onAuthStateChanged Listener (Core state management)
        // This will fire immediately if an existing Firebase session was loaded (setPersistence)
        // OR after the manual restore above OR after a new sign-in.
        let initialDone = false;
        onAuthStateChanged(auth, (u) => {
            __dd_currentUser = u ? { uid: u.uid, email: u.email, displayName: u.displayName || u.email } : null;
            
            if (!initialDone) {
                initialDone = true;
                __dd_firebaseReady = true;
                console.log('[preload] ✓ Firebase auth ready, initial user:', __dd_currentUser ? __dd_currentUser.email : 'NOT LOGGED IN');
            } else {
                console.log('[preload] auth state changed:', __dd_currentUser ? __dd_currentUser.email : 'logged out');
            }
            __dd_invokeOnChangeCallbacks();
        });

        // 4) Implement authApi functions
        
        // signInWithGoogle implementation
        authApi.signInWithGoogle = async () => {
            if (__dd_signInInFlight) return __dd_signInInFlight;
            
            __dd_signInInFlight = (async () => {
                try {
                    // Start Google OAuth flow via main process
                    const { accessToken, idToken, refreshToken } = await ipcRenderer.invoke('google-oauth:start');
                    if (!accessToken || !idToken) throw new Error('No tokens from google-oauth:start');
                    
                    const cred = GoogleAuthProvider.credential(idToken, accessToken);

                    // Sign in to Firebase using the Google tokens
                    const userCred = await signInWithCredential(auth, cred);
                    const u = userCred.user;
                    
                    // Save refresh token to Keytar (secure storage)
                    if (refreshToken) {
                        console.log('[preload] saving refresh token to keytar...');
                        await ipcRenderer.invoke('tokens:saveRefresh', refreshToken);
                        console.log('[preload] ✓ refresh token saved');
                    } else {
                        console.warn('[preload] ⚠ no refreshToken from google-oauth:start!');
                    }
                    
                    // Give Firebase time to persist the session locally
                    await new Promise(r => setTimeout(r, 250));
                    
                    return { uid: u.uid, email: u.email, displayName: u.displayName || u.email || 'Google user' };

                } catch (err) {
                    throw err;
                } finally {
                    __dd_signInInFlight = null;
                }
            })();
            return __dd_signInInFlight;
        };

        // signOut implementation (clears firebase session and refresh token)
        authApi.signOut = async () => {
            await signOut(auth).catch(() => {});
            await ipcRenderer.invoke('tokens:deleteRefresh').catch(() => {});
        };
        
        // waitForInitialAuth implementation
        authApi.waitForInitialAuth = (timeoutMs = 3000) => {
            return new Promise((resolve) => {
                if (__dd_currentUser !== null) { // User known from initial sync
                    queueMicrotask(() => resolve(true));
                    return;
                }
                let settled = false;
                const timer = setTimeout(() => {
                    if (!settled) {
                        settled = true;
                        resolve(false); // Timeout: assume no active user
                    }
                }, timeoutMs);

                const unsub = onAuthStateChanged(auth, (u) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(timer);
                    try { unsub(); } catch (e) {}
                    resolve(!!u); // Resolved by auth state change
                });
            });
        };
        
        // onChange implementation
        authApi.onChange = (cb) => {
            if (typeof cb !== 'function') return () => {};
            __dd_onChangeCbs.push(cb);
            queueMicrotask(() => {
                try { cb(__dd_currentUser); } catch (e) { console.warn('[preload] onChange initial cb threw', e); }
            });
            return () => {
                const idx = __dd_onChangeCbs.indexOf(cb);
                if (idx !== -1) __dd_onChangeCbs.splice(idx, 1);
            };
        };


        // ------ Cloud API (firestore helpers) ------
        const cloudApi = {
            async loadTimetable(uidOrNothing) {
                const uid = typeof uidOrNothing === 'string' ? uidOrNothing : (auth.currentUser?.uid || null);
                if (!uid) return null;
                const ref = doc(db, 'users', uid, 'deskday', 'timetable');
                const snap = await getDoc(ref);
                return snap.exists() ? snap.data() : null;
            },
            async saveTimetable(uidOrPayload, maybePayload) {
                let uid, payload;
                if (typeof uidOrPayload === 'string' && maybePayload) { uid = uidOrPayload; payload = maybePayload; }
                else { payload = uidOrPayload; uid = auth.currentUser?.uid; }
                if (!uid) throw new Error('uid missing');
                const meta = { updatedAt: serverTimestamp() };
                const docPayload = Object.assign({}, payload, { _meta: meta });
                const ref = doc(db, 'users', uid, 'deskday', 'timetable');
                await setDoc(ref, docPayload);
                return meta;
            },
            subscribeToTimetable(uid, cb) {
                const realUid = uid || auth.currentUser?.uid;
                if (!realUid) throw new Error('uid missing for subscribe');
                const ref = doc(db, 'users', realUid, 'deskday', 'timetable');
                const unsub = onSnapshot(ref, snap => {
                    cb(snap.exists() ? snap.data() : null);
                }, err => console.warn('[preload] onSnapshot error', err));
                return unsub;
            }
        };
        contextBridge.exposeInMainWorld('cloud', cloudApi);

    } catch (err) {
        console.error('[preload] Firebase init failed:', err);
    }
})();