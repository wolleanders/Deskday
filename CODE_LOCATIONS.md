# Code Location Reference

## Key Code Sections

### Bootstrap Flow (Happens on App Start)

**Step 1: Main Process Setup**
- **File:** `main.js` lines 1-60
- **What:** Token handlers registration (Keytar)
- **Look for:** `ipcMain.handle('tokens:...')`

**Step 2: Preload Firebase Init**
- **File:** `preload.js` lines 60-130
- **What:** Firebase initialization + setPersistence
- **Look for:** `setPersistence(auth, browserLocalPersistence)`

**Step 3: Auto-Restore from Keytar**
- **File:** `preload.js` lines 132-155
- **What:** Check Keytar for refresh token
- **Look for:** `tokens:refreshGoogle` invocation

**Step 4: Firebase Listener Setup**
- **File:** `preload.js` lines 157-195
- **What:** onAuthStateChanged registration
- **Look for:** `onAuthStateChanged(auth, (u) => { ... })`

**Step 5: Auth API Delegation**
- **File:** `preload.js` lines 210-250
- **What:** signInWithGoogle, signOut implementations
- **Look for:** `authApi.signInWithGoogle = async () => { ... }`

**Step 6: UI Boot in Renderer**
- **File:** `renderer.js` lines 1010-1040
- **What:** Calls loginMode.bootLoginMode()
- **Look for:** `bootLoginMode({ ... })`

**Step 7: Mode Listener Setup**
- **File:** `loginMode.js` lines 95-191
- **What:** window.auth.onChange listener registration
- **Look for:** `window.auth.onChange(async (user) => { ... })`

**Step 8: UI Updates**
- **File:** `authState.js` lines 38-95
- **What:** handleAuthStateChange called by Firebase event
- **Look for:** `handleAuthStateChange(user)`

---

### Login Flow

**Step 1: User Clicks "Log in"**
- **File:** `authState.js` line 115
- **Function:** `handleLoginClick()`
- **Action:** Disables button, calls `loginWithGoogle()`

**Step 2: OAuth Start**
- **File:** `main.js` lines 335-410
- **Handler:** `google-oauth:start`
- **Action:** Opens system browser, waits for code

**Step 3: OAuth Code Exchange**
- **File:** `main.js` lines 410-460
- **Action:** Exchanges code for tokens via Google
- **Returns:** `{ accessToken, idToken, refreshToken }`

**Step 4: Save Refresh Token**
- **File:** `preload.js` line 170
- **Action:** Calls `ipcRenderer.invoke('tokens:saveRefresh', refreshToken)`
- **Storage:** Keytar system storage

**Step 5: Firebase Sign-In**
- **File:** `preload.js` lines 172-174
- **Action:** `signInWithCredential(auth, credential)`
- **Result:** Firebase session created + persisted

**Step 6: Auth Event Fires**
- **File:** `preload.js` line 203
- **Trigger:** `onAuthStateChanged(auth, (u) => { ... })`
- **Action:** Invokes callbacks registered in loginMode

**Step 7: Mode Change**
- **File:** `loginMode.js` lines 147-160
- **Action:** `setMode('cloud')` stored to localStorage
- **Purpose:** UI display only (not auth control)

**Step 8: Data Sync**
- **File:** `loginMode.js` lines 66-82
- **Action:** `handleUserLoggedIn()` - pull from cloud or push local

**Step 9: UI Update**
- **File:** `authState.js` lines 55-72
- **Action:** Sets button to "Sign out", attaches logout listener

---

### Logout Flow

**Step 1: User Clicks "Sign out"**
- **File:** `authState.js` line 128
- **Function:** `handleLogoutClick()`
- **Action:** Sets `__deskday_isExplicitlyLoggingOut = true`

**Step 2: Firebase Sign-Out**
- **File:** `preload.js` line 242
- **Action:** `await signOut(auth)`
- **Result:** Firebase session cleared

**Step 3: Delete Refresh Token**
- **File:** `preload.js` line 243
- **Action:** `await ipcRenderer.invoke('tokens:deleteRefresh')`
- **Result:** Keytar token cleared

**Step 4: Auth Event Fires (null)**
- **File:** `preload.js` line 203
- **Trigger:** `onAuthStateChanged(auth, null)`
- **Action:** Skipped because flag is true

**Step 5: Flag Reset**
- **File:** `authState.js` line 153
- **Action:** `window.__deskday_isExplicitlyLoggingOut = false`

**Step 6: UI Update**
- **File:** `authState.js` lines 86-95
- **Action:** Sets button to "Log in", loads local data

---

### Persistence on Restart

**On App Boot:**
1. preload.js `setPersistence()` → Firebase localStorage enabled
2. preload.js `tokens:getRefresh` → Check Keytar
3. preload.js `tokens:refreshGoogle` → Get new Google tokens
4. preload.js `signInWithCredential()` → Firebase signs in
5. Firebase restores session from browserLocalPersistence (or step 4)
6. preload.js `onAuthStateChanged` fires
7. loginMode.js listener notified
8. UI updates automatically

---

### Token Management Locations

| Operation | File | Lines | Handler/Function |
|-----------|------|-------|------------------|
| Save refresh | main.js | 18-22 | `tokens:saveRefresh` |
| Get refresh | main.js | 24-27 | `tokens:getRefresh` |
| Delete refresh | main.js | 29-33 | `tokens:deleteRefresh` |
| Exchange refresh | main.js | 35-57 | `tokens:refreshGoogle` |
| OAuth flow | main.js | 335-410 | `google-oauth:start` |
| Bootstrap restore | preload.js | 132-155 | Auto-restore in init IIFE |
| SaveRefresh call | preload.js | 182 | Inside signInWithGoogle |
| DeleteRefresh call | preload.js | 243 | Inside signOut |

---

### Mode & State Management

| Operation | File | Lines | Storage |
|-----------|------|-------|---------|
| Get mode | loginMode.js | 7-9 | localStorage `tt.mode` |
| Set mode | loginMode.js | 11-13 | localStorage `tt.mode` |
| Check first run | loginMode.js | 15-17 | localStorage `tt.firstRun` |
| Mark first run done | loginMode.js | 19-21 | localStorage `tt.firstRun` |
| Logout flag set | authState.js | 128 | global `__deskday_isExplicitlyLoggingOut` |
| Logout flag clear | authState.js | 153 | global `__deskday_isExplicitlyLoggingOut` |

---

### Key Listeners & Callbacks

| Listener | File | Line | Triggered By |
|----------|------|------|--------------|
| `window.auth.onChange` | loginMode.js | 131 | Firebase `onAuthStateChanged` |
| `handleAuthStateChange` | authState.js | 38 | loginMode listener or error handler |
| `handleLoginClick` | authState.js | 115 | Button click → Login flow |
| `handleLogoutClick` | authState.js | 128 | Button click → Logout flow |
| `google-oauth:start` | main.js | 335 | User clicks "Log in" |

---

### Debug Entry Points

Start debugging from these locations:

**"Why isn't login persisting?"**
→ Check preload.js lines 132-155 (auto-restore)

**"Why does login fail?"**
→ Check main.js lines 335-460 (OAuth flow)

**"Why is button state wrong?"**
→ Check authState.js lines 38-95 (handleAuthStateChange)

**"Why is data not syncing?"**
→ Check loginMode.js lines 66-82 (handleUserLoggedIn)

**"Why did logout fail?"**
→ Check preload.js lines 240-244 (signOut cleanup)

---

### File Sizes (after cleanup)

```
main.js ..................... ~650 lines
preload.js .................. ~275 lines (was larger with file storage)
loginMode.js ................ ~191 lines
authState.js ................ ~175 lines
renderer.js ................. ~1318 lines
```

Total auth-related: ~980 lines (consolidated from messy mix before)

