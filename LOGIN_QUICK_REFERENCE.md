# Quick Reference: Persistent Login System

## One-Line Summary
✅ **Keytar (refresh token) + Firebase session = Automatic persistence**

---

## Key Files & Their Job

### main.js
**Responsible for:** OAuth flow + Keytar token storage  
**Key handlers:**
- `tokens:saveRefresh` - Save refresh token to Keytar
- `tokens:getRefresh` - Get refresh token from Keytar  
- `tokens:deleteRefresh` - Delete refresh token (logout)
- `tokens:refreshGoogle` - Exchange refresh token for new Google tokens
- `google-oauth:start` - OAuth browser flow + code exchange

**What it does NOT do:** Firebase auth, file storage, UI

---

### preload.js
**Responsible for:** Bootstrap sequence on app start  
**Key steps:**
1. `setPersistence(auth, browserLocalPersistence)` - Enable auto-persistence
2. Try to get refresh token from Keytar
3. If found → exchange for Google tokens
4. `signInWithCredential(Firebase, tokens)` - Sign in with those tokens
5. Firebase restores session automatically
6. `onAuthStateChanged` fires → auth events begin

**What it does:** Sets up Firebase + auto-restore from Keytar

---

### loginMode.js
**Responsible for:** Mode transitions (local ↔ cloud)  
**Key functions:**
- `bootLoginMode(options)` - Main entry point, waits for first Firebase event
- `handleUserLoggedIn(user, options)` - On login: sync data (pull cloud or push local)
- `loginWithGoogle()` - Initiate OAuth
- `logout()` - Sign out from Firebase

**What it tracks:** `localStorage.tt.mode` for UI display (NOT auth control)

---

### authState.js
**Responsible for:** UI button state  
**Key functions:**
- `initialize(ctx)` - Register dependencies
- `handleAuthStateChange(user)` - Update button text + listeners based on auth

**What it does:** Updates "Log in" / "Sign out" button when auth changes  
**What it does NOT do:** Token management, auth flow

---

## Single Logout Sequence

```javascript
// User clicks "Sign out"
await authState.handleLogoutClick()
  → sets window.__deskday_isExplicitlyLoggingOut = true
  → calls loginMode.logout()
    → calls window.auth.signOut() (Firebase)
    → calls ipcRenderer.invoke('tokens:deleteRefresh') (delete from Keytar)
  → Firebase fires onAuthStateChanged(null)
  → loginMode listener ignores it (flag is true)
  → flag reset to false
  → UI updates via handleAuthStateChange(null)
```

---

## Single Login Sequence

```javascript
// User clicks "Log in"
await authState.handleLoginClick()
  → calls loginMode.loginWithGoogle()
    → calls ipcRenderer.invoke('google-oauth:start')
    → Browser opens, user authenticates
    → OAuth callback received, code exchanged for tokens
    → Refresh token saved to Keytar
    → signInWithCredential(Firebase, idToken + accessToken)
    → Firebase fires onAuthStateChanged(user)
  → loginMode listener fires
    → setMode('cloud')
    → handleUserLoggedIn (sync data)
    → handleStateDelegate(user) [calls handleAuthStateChange]
  → UI updates: "Sign out" button appears
```

---

## Auto-Restore on App Restart

```javascript
// App boots
preload.js initializes
  → setPersistence (Firebase localStorage)
  → ipcRenderer.invoke('tokens:getRefresh') [check Keytar]
  → If found: ipcRenderer.invoke('tokens:refreshGoogle')
    → Get new access token from Google
    → signInWithCredential(Firebase, new tokens)
  → Firebase loads session from browserLocalPersistence (fast!)
  → onAuthStateChanged fires immediately
  → UI shows logged-in state ✓
```

---

## Token Storage Locations

| Token | Storage | Who Controls | Cleared On |
|-------|---------|--------------|-----------|
| **Refresh Token** | Keytar (system) | main.js | Logout or revoke |
| **Access Token** | Firebase memory | Firebase SDK | Auto-refreshed |
| **Session** | Firefox localStorage | Firebase SDK | Logout or expiry |
| **UI Mode** | localStorage `tt.mode` | loginMode.js | Mode switch |

---

## Troubleshooting

### "Auto-login not working"
- ✓ Check if refresh token exists in Keytar
- ✓ Verify `tokens:refreshGoogle` returns valid tokens
- ✓ Ensure Firebase `setPersistence` succeeded

### "Stuck on login loop"
- ✓ Clear Keytar manually: `keytar.deletePassword('Deskday', 'google-refresh-token')`
- ✓ Check for `__deskday_isExplicitlyLoggingOut` flag stuck as true
- ✓ Verify no race conditions in auth listeners

### "Lost session unexpectedly"
- ✓ Token revoked by Google → falls back to local mode
- ✓ Browser localStorage cleared → loses session
- ✓ Keytar deleted manually → can't restore

---

## Debug Logs to Watch

**App startup:**
```
[preload] ✓ restored firebase sign-in from refresh token
```
OR
```
[preload] [no logs] = first login or token doesn't exist
```

**After login button click:**
```
[authState] ✓ Login success. Delegating...
[loginMode] ✓ User logged in: user@email.com
[authState] ✓ Logged in: user@email.com
```

**After logout button click:**
```
[authState] Logout → Firebase signOut
[loginMode] ✗ Logged out
```

---

## Rule of Thumb

**"Where does this belong?"**
- Tokens to *persist*? → main.js (Keytar)
- Auth *events*? → preload.js (Firebase)
- *Mode* changes? → loginMode.js (localStorage)
- UI *updates*? → authState.js (button text)
- *Data* sync? → renderer.js + cloud.js

If you're confused, check **Who owns this?** in the file headers! 🎯

