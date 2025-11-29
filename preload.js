// preload.js  (angepasst)
const { contextBridge, ipcRenderer } = require('electron');
const { serverTimestamp } = require('firebase/firestore');

let __dd_currentUser = null;
let __dd_onChangeCbs = [];
let __dd_signInInFlight = null;
let firebaseReady = false;
let __dd_persistenceUsed = null; // 'indexedDB' | 'localStorage' | 'session'

// helper to call onChange subscribers async
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

// basic stub authApi — will be patched when Firebase SDK is loaded
const authApi = {
  async signInWithGoogle() { throw new Error('[preload] Firebase auth not ready'); },
  async signOut() {},
  onChange(cb) {
    if (typeof cb === 'function') cb(null);
    return () => {};
  },
  // waitForInitialAuth will be patched by firebase init
  waitForInitialAuth: (ms = 3000) => Promise.resolve(false)
};

// expose small wrappers to renderer (do NOT expose raw SDK objects)
contextBridge.exposeInMainWorld('auth', {
  signInWithGoogle: (...args) => authApi.signInWithGoogle(...args),
  signOut:          (...args) => authApi.signOut(...args),
  onChange:         (cb)      => authApi.onChange(cb),
  getCurrentUser:   ()        => (__dd_currentUser),
  waitForInitialAuth: (ms)    => authApi.waitForInitialAuth ? authApi.waitForInitialAuth(ms) : Promise.resolve(false)
});

contextBridge.exposeInMainWorld('firebaseReady', {
  isReady: () => firebaseReady
});

contextBridge.exposeInMainWorld('appApi', {
  minimizeToTray: () => ipcRenderer.invoke('tray:minimize'),
  showFromTray:   () => ipcRenderer.invoke('tray:show'),
  quitApp:        () => ipcRenderer.invoke('app:quit'),
  flushStorage:   () => ipcRenderer.invoke('storage:flush')
});

// ---- Firebase init (async) ----
(async () => {
  try {
    const { initializeApp } = await import('firebase/app');
    const {
      getAuth,
      setPersistence,
      indexedDBLocalPersistence,
      GoogleAuthProvider,
      signInWithCredential,
      onAuthStateChanged,
      signOut,
      browserSessionPersistence,
      browserLocalPersistence
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

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    console.log('[preload] firebase app name:', app.name, 'sdk version maybe missing'); 

    // try to restore saved tokens from disk and sign in
try {
  const saved = await ipcRenderer.invoke('auth:loadTokens');
  if (saved && saved.idToken) {
    try {
      // ensure persistence already set (keep your existing setPersistence block)
      const cred = GoogleAuthProvider.credential(saved.idToken, saved.accessToken);
      await signInWithCredential(auth, cred);
      console.log('[preload] auto restored auth from saved tokens (file)');
    } catch (errRestore) {
      console.warn('[preload] auto-restore failed (token may be stale)', errRestore);
      // optional: clear saved tokens if restore fails
      // await ipcRenderer.invoke('auth:clearTokens');
    }
  } else {
    console.log('[preload] no saved auth tokens found on disk');
  }
} catch (e) {
  console.warn('[preload] failed loading saved tokens', e);
}


// ----- 1) Set persistence immediately BEFORE any onAuthStateChanged subscription -----
  try {
  await setPersistence(auth, browserLocalPersistence);
  __dd_persistenceUsed = 'localStorage';
  console.log('[preload] setPersistence browserLocalPersistence OK (forced)');
} catch (err) {
  console.warn('[preload] setPersistence(browserLocalPersistence) failed — will try session fallback', err);
  try {
    await setPersistence(auth, browserSessionPersistence);
    __dd_persistenceUsed = 'session';
    console.log('[preload] setPersistence browserSessionPersistence OK (fallback)');
  } catch (err2) {
    console.error('[preload] all setPersistence calls failed', err2);
    __dd_persistenceUsed = null;
  }
}
    // ---------------------------
    // initial onAuthStateChanged einmalig (subscribe -> resolve -> unsub)
    // ---------------------------
    // ----- 2) Now attach a single runtime onAuthStateChanged listener (this will fire for restored user) -----
    let initialDone = false;
    const unsubRuntime = onAuthStateChanged(auth, (u) => {
      __dd_currentUser = u ? { uid: u.uid, email: u.email, displayName: u.displayName || u.email } : null;
      console.log('[preload] onAuthStateChanged ->', __dd_currentUser);
      __dd_invokeOnChangeCallbacks();

      if (!initialDone) {
        initialDone = true;
        firebaseReady = true;
        console.log('[preload] Firebase ready ✅ (initial onAuthStateChanged observed)');
      }
    });

    // optional safety timeout: if no initial event in 5s, mark ready anyway so UI won't hang
    setTimeout(() => {
      if (!initialDone) {
        console.warn('[preload] initial onAuthStateChanged did not fire in 5s — forcing firebaseReady=true (fallback)');
        firebaseReady = true;
      }
    }, 5000);

//###########################################################################################
authApi.signInWithGoogle = async () => {
  if (__dd_signInInFlight) {
    console.log('[preload] signInWithGoogle: returning inflight promise');
    return __dd_signInInFlight;
  }
  __dd_signInInFlight = (async () => {
    try {
      console.log('[preload] signInWithGoogle REAL called (start oauth)');
      // ensure persistence at call-time (defensive)
      try {
        if (!__dd_persistenceUsed) {
          await setPersistence(auth, indexedDBLocalPersistence);
          __dd_persistenceUsed = 'indexedDB';
          console.log('[preload] ensured persistence: indexedDB (on demand)');
        }
      } catch (pErr) {
        console.warn('[preload] ensurePersistence(indexedDB) failed, trying browserLocalPersistence', pErr);
        try { await setPersistence(auth, browserLocalPersistence); __dd_persistenceUsed = 'localStorage'; }
        catch(e){ console.warn('[preload] fallback persistence also failed', e); }
      }

      const { accessToken, idToken } = await ipcRenderer.invoke('google-oauth:start');
      if (!accessToken || !idToken) throw new Error('No tokens from google-oauth:start');
      const cred = GoogleAuthProvider.credential(idToken, accessToken);

      // sign in
      const userCred = await signInWithCredential(auth, cred);
      const u = userCred.user;
      console.log('[preload] Google login OK ->', u.uid, u.email);

      // --- save tokens to disk for auto-restore ---
try {
  // idToken & accessToken come from your google-oauth:start earlier in this function
  const tokenPayload = {
    idToken,           // from google-oauth:start
    accessToken,       // from google-oauth:start
    uid: u.uid,
    savedAt: Date.now()
  };
  const res = await ipcRenderer.invoke('auth:saveTokens', tokenPayload);
  if (res && res.ok) console.log('[preload] saved auth tokens to userData:', res.path);
  else console.warn('[preload] saving auth tokens reported error', res);
} catch (e) {
  console.warn('[preload] saving auth tokens failed', e);
}

      // small delay to allow firebase to perform persistence writes
      await new Promise(r => setTimeout(r, 250));

      // --- DEBUG: dump localStorage & indexedDB contents (short) ---
      try {
        console.log('[preload] DEBUG localStorage keys count:', Object.keys(window.localStorage || {}).length);
        // print keys that match firebase prefix
        const keys = Object.keys(window.localStorage || {}).filter(k => k.includes('firebase'));
        if (keys.length) console.log('[preload] DEBUG localStorage firebase keys:', keys);
        else console.log('[preload] DEBUG localStorage: no firebase keys found');
      } catch (e) { console.warn('[preload] DEBUG reading localStorage failed', e); }

      try {
        const dbs = await indexedDB.databases().catch(()=>null);
        console.log('[preload] DEBUG indexedDB databases:', dbs);
        // check specifically for firebaseLocalStorageDb store
        const maybe = (dbs||[]).find(d => d.name && d.name.toLowerCase().includes('firebaselocalstoragedb'));
        if (maybe && maybe.name) {
          const req = indexedDB.open(maybe.name);
          req.onsuccess = (ev) => {
            try {
              const dbInst = ev.target.result;
              console.log('[preload] DEBUG opened db', maybe.name, 'stores=', Array.from(dbInst.objectStoreNames));
              if (!Array.from(dbInst.objectStoreNames).includes('firebaseLocalStorage')) {
                console.warn('[preload] DEBUG firebaseLocalStorage store NOT present in indexedDB after sign-in');
              } else {
                // log up to first 10 entries
                try {
                  const tx = dbInst.transaction('firebaseLocalStorage','readonly');
                  const store = tx.objectStore('firebaseLocalStorage');
                  const all = store.getAll();
                  all.onsuccess = () => console.log('[preload] DEBUG firebaseLocalStorage entries count=', all.result?.length, all.result?.slice(0,10));
                  all.onerror = (err) => console.warn('[preload] DEBUG firebaseLocalStorage getAll error', err);
                } catch(e) { console.warn('[preload] DEBUG reading firebaseLocalStorage failed', e); }
              }
              dbInst.close();
            } catch(e) { console.warn('[preload] DEBUG open success handler failed', e); }
          };
          req.onerror = (e) => console.warn('[preload] DEBUG open indexedDB failed', e);
        } else {
          console.warn('[preload] DEBUG no firebaseLocalStorageDb found in indexedDB list');
        }
      } catch (e) { console.warn('[preload] DEBUG indexedDB dump failed', e); }

      // If indexedDB store missing, attempt a fallback: set browserLocalPersistence & log outcome
      try {
        const dbs2 = await indexedDB.databases().catch(()=>null);
        const hasStore = (dbs2||[]).some(d => d.name && Array.from((d.version?[]:[])) ); // cheap check
        // Simpler heuristic: if we earlier detected no firebaseLocalStorage, force fallback
        // (We cannot reliably detect here synchronously in all cases, so we try fallback if __dd_persistenceUsed !== 'indexedDB')
        if (__dd_persistenceUsed !== 'indexedDB') {
          console.warn('[preload] DEBUG using fallback to browserLocalPersistence (localStorage) because indexedDB persistence not used');
          try { await setPersistence(auth, browserLocalPersistence); __dd_persistenceUsed = 'localStorage'; console.log('[preload] Fallback: browserLocalPersistence set'); }
          catch (e) { console.warn('[preload] Fallback to browserLocalPersistence failed', e); }
        }
      } catch (e) { /* ignore */ }

      return { uid: u.uid, email: u.email, displayName: u.displayName || u.email || 'Google user' };
    } catch (err) {
      console.warn('[preload] signInWithGoogle failed', err);
      // if there is a currentUser, return that as best-effort
      if (auth.currentUser) {
        const cu = auth.currentUser;
        return { uid: cu.uid, email: cu.email, displayName: cu.displayName || cu.email || 'Google user' };
      }
      throw err;
    } finally {
      __dd_signInInFlight = null;
    }
  })();
  return __dd_signInInFlight;
};

    // ------------- waitForInitialAuth -------------
    authApi.waitForInitialAuth = (timeoutMs = 3000) => {
      return new Promise((resolve) => {
        if (auth.currentUser) {
          queueMicrotask(() => resolve(true));
          return;
        }
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
        }, timeoutMs);

        const unsub = onAuthStateChanged(auth, (u) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          try { unsub(); } catch (e) {}
          resolve(!!u);
        });
      });
    };

    // ----- authApi.onChange implementation (returns unsubscribe) -----
    authApi.onChange = (cb) => {
      if (typeof cb !== 'function') return () => {};
      __dd_onChangeCbs.push(cb);
      // initial async call
      queueMicrotask(() => {
        try { cb(__dd_currentUser); } catch (e) { console.warn('[preload] onChange initial cb threw', e); }
      });
      return () => {
        const idx = __dd_onChangeCbs.indexOf(cb);
        if (idx !== -1) __dd_onChangeCbs.splice(idx, 1);
      };
    };

    // signOut impl
 authApi.signOut = async () => {
  try {
    await signOut(auth);
  } catch(e) { /* ignore */ }
try {
  await ipcRenderer.invoke('auth:clearTokens');
  console.log('[preload] cleared saved auth tokens on signOut');
} catch (e) { console.warn('[preload] clearing saved tokens failed', e); }
};

    // ------ Cloud API (firestore helpers) ------
    const cloudApi = {
      async loadTimetable(uidOrNothing) {
        const uid = typeof uidOrNothing === 'string' ? uidOrNothing : (auth.currentUser?.uid || null);
        if (!uid) { console.warn('[preload][cloud] loadTimetable: no uid'); return null; }
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

    // Falls onAuthStateChanged aus irgendeinem Grund >5s nicht feuer(t), markiere ready trotzdem
    setTimeout(() => {
      if (!initialDone) {
        console.warn('[preload] initial onAuthStateChanged did not fire in 5s — forcing firebaseReady=true (fallback)');
        firebaseReady = true;
      }
    }, 5000);

  } catch (err) {
    console.error('[preload] Firebase init failed:', err);
    firebaseReady = false;
  }
})();
