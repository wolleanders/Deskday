# Persistent Login System - Clean Implementation

## Architecture Overview

### Single Source of Truth for Persistent Auth
- **Refresh Token**: Stored in Keytar (system secure storage) via main process
- **Session**: Handled by Firebase SDK's `browserLocalPersistence`
- **Bootstrap**: On app start, automatically restore session from Keytar → Firebase

---

## File Changes Summary

### 1. main.js - Simplified Token Handlers
- **Keep**: `tokens:saveRefresh`, `tokens:getRefresh`, `tokens:deleteRefresh`, `tokens:refreshGoogle`
- **Remove**: `auth:saveTokens`, `auth:loadTokens`, `auth:clearTokens` (not needed - Firebase handles this)
- **Result**: Only Keytar-based refresh token management

### 2. preload.js - Bootstrap Only On Start
- **On init**: Check Keytar for refresh token → exchange for Google tokens → signIn to Firebase
- **Firebase persistence**: Automatically restores session on subsequent boots
- **Result**: Login persists across app restarts without extra file storage

### 3. loginMode.js - Simplified Mode Tracking
- **localStorage 'tt.mode'**: Only for UI state (local vs cloud display), NOT auth control
- **Auth source**: Only Firebase's `onAuthStateChanged`
- **Result**: No confusion about who controls the login state

### 4. authState.js - Cleaner Handler
- Remove mixed auth checking
- UI only responds to Firebase auth state changes
- No direct token manipulation in UI layer

### 5. renderer.js - Simplified Init
- Boot sequence stays the same but cleaner
- No extra token polling needed

---

## Flow Diagrams

### First Login (Desktop App)
```
User clicks "Log in"
    ↓
OAuth flow in browser (main.js:google-oauth:start)
    ↓
Code exchange → Get: accessToken, idToken, refreshToken
    ↓
Save refreshToken to Keytar (main.js:tokens:saveRefresh)
    ↓
signInWithCredential(Firebase, idToken+accessToken)
    ↓
Firebase session persisted locally (browserLocalPersistence)
    ↓
onAuthStateChanged fires → UI updates
```

### App Restart (Persistent Login)
```
preload.js initializes Firebase
    ↓
Calls tokens:getRefresh (checks Keytar)
    ↓
If found: exchange for new Google tokens
    ↓
signInWithCredential(Firebase, new tokens)
    ↓
Firebase restores session from browserLocalPersistence
    ↓
onAuthStateChanged fires → User is logged in
```

### Logout
```
User clicks "Sign out"
    ↓
Firebase signOut()
    ↓
auth:clearTokens removes refresh from Keytar
    ↓
onAuthStateChanged(null) fires → UI updates
```

---

## What NOT To Do
❌ Don't store tokens in plain JSON files
❌ Don't create extra localStorage keys for auth state
❌ Don't manually manage Firebase persistence
❌ Don't have multiple places tracking login state
✅ Let Firebase + Keytar handle persistence
✅ Use localStorage only for UI preferences (theme, layout, etc.)

---

## Implementation Order
1. Simplify main.js (remove file-based token storage)
2. Update preload.js (auto-restore on boot)
3. Clean up loginMode.js (remove auth:saveTokens/loadTokens calls)
4. Simplify authState.js (respond to Firebase events only)
5. Test: Fresh start → Login → Restart app → Should stay logged in

