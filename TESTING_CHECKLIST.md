# Implementation Checklist & Verification

## ✅ Changes Applied

### Code Changes
- [x] **main.js** - Removed file-based token handlers (auth:saveTokens, auth:loadTokens, auth:clearTokens)
- [x] **main.js** - Cleaned up Keytar handlers with better comments
- [x] **main.js** - OAuth handler now returns refreshToken explicitly
- [x] **preload.js** - Removed auth:saveTokens call in signInWithGoogle
- [x] **preload.js** - Removed auth:loadTokens call in bootstrap
- [x] **preload.js** - Removed auth:clearTokens call in signOut
- [x] **preload.js** - Improved comments on auto-restore flow
- [x] **preload.js** - Cleaned up error handling for revoked tokens
- [x] **loginMode.js** - Added clear documentation header
- [x] **loginMode.js** - Improved bootLoginMode function comments
- [x] **loginMode.js** - Enhanced handleUserLoggedIn documentation
- [x] **authState.js** - Updated module header with single responsibility
- [x] **authState.js** - Improved handleAuthStateChange documentation
- [x] **authState.js** - Added status symbols to log messages (✓/✗)

### Verification
- [x] No syntax errors in modified files
- [x] All imports/exports intact
- [x] No breaking changes to function signatures
- [x] All handlers properly wired

### Documentation Created
- [x] `PERSISTENT_LOGIN_REFACTOR.md` - Architecture overview
- [x] `PERSISTENT_LOGIN_IMPLEMENTATION.md` - Complete implementation guide
- [x] `LOGIN_QUICK_REFERENCE.md` - Quick lookup reference
- [x] `CODE_LOCATIONS.md` - Exact line number reference
- [x] `REFACTOR_SUMMARY.md` - Summary of what changed
- [x] `BEFORE_AFTER_COMPARISON.md` - Visual comparison
- [x] This checklist

---

## 🧪 Testing Checklist

### Phase 1: Clean Boot (No saved tokens)

- [ ] **Setup:**
  - Manually delete refresh token from system keychain
  - On Windows: Use Credential Manager to delete "Deskday" credentials
  - Or run: `keytar.deletePassword('Deskday', 'google-refresh-token')`
  - Delete any old `deskday-auth-tokens.json` files if they exist
  - Clear browser cache/cookies

- [ ] **Test:**
  - [ ] Start app → "Log in" button visible
  - [ ] Console shows: `[preload] refresh token was revoked, clearing` or similar
  - [ ] No errors about missing tokens
  - [ ] Click "Log in" → Browser opens
  - [ ] Complete OAuth flow
  - [ ] Return to app → "Sign out" button
  - [ ] Console shows: `[loginMode] ✓ User logged in: {email}`
  - [ ] Console shows: `[authState] ✓ Logged in: {email}`

### Phase 2: Persistence (Login survives restart)

- [ ] **Setup:**
  - App is currently logged in (from Phase 1)

- [ ] **Test:**
  - [ ] Close app completely
  - [ ] Wait 5 seconds
  - [ ] Restart app
  - [ ] EXPECTED: Should auto-login (no click needed!)
  - [ ] "Sign out" button visible immediately
  - [ ] Console shows: `[preload] ✓ restored firebase sign-in from refresh token`
  - [ ] No "Log in" button appears

### Phase 3: Logout

- [ ] **Setup:**
  - App is logged in

- [ ] **Test:**
  - [ ] Click "Sign out" button
  - [ ] Button shows loading state briefly ("...")
  - [ ] Button changes to "Log in"
  - [ ] Console shows: `[authState] ✗ Logged out`
  - [ ] Refresh token removed from Keytar (verify in Credential Manager)
  - [ ] Local data loads/displays
  - [ ] No errors

### Phase 4: Restart After Logout

- [ ] **Setup:**
  - Just logged out (from Phase 3)

- [ ] **Test:**
  - [ ] Close app
  - [ ] Restart app
  - [ ] "Log in" button visible
  - [ ] No auto-login (expected - token was deleted)
  - [ ] Can click "Log in" again and flow works

### Phase 5: Multiple Login/Logout Cycles

- [ ] **Setup:**
  - Clean app state

- [ ] **Test:**
  - [ ] Login → Verify logged in
  - [ ] Logout → Verify logged out
  - [ ] Login → Verify logged in
  - [ ] Logout → Verify logged out
  - [ ] Repeat 3 times without errors
  - [ ] Each cycle should be clean (no state leakage)

### Phase 6: Token Refresh (After 1 hour)

- [ ] **Setup:**
  - App is logged in
  - Wait for or simulate token expiry

- [ ] **Test:**
  - [ ] Cloud operations still work
  - [ ] App silently refreshes token
  - [ ] No user-facing errors
  - [ ] New refresh token saved to Keytar

### Phase 7: Cloud Data Sync

- [ ] **Setup:**
  - App logged in (local mode)
  - Have some local data

- [ ] **Test on First Cloud Login:**
  - [ ] Click "Log in"
  - [ ] Complete OAuth
  - [ ] Console shows: `[loginMode] ✓ Applying remote data from cloud`
  - [ ] OR console shows: `[loginMode] ✓ Uploading local data to cloud`
  - [ ] Data syncs correctly to cloud

### Phase 8: Error Scenarios

- [ ] **Revoked Token:**
  - [ ] Manually delete token from Keytar
  - [ ] Restart app
  - [ ] Should fallback to local mode gracefully
  - [ ] Console shows: `[preload] refresh token was revoked, clearing`

- [ ] **Network Failure During Boot:**
  - [ ] Disconnect internet
  - [ ] Restart app
  - [ ] App starts in local mode (no crash)
  - [ ] Shows "Log in" button
  - [ ] No error popups

- [ ] **Concurrent Login Attempts:**
  - [ ] Click "Log in" twice rapidly
  - [ ] Should queue/wait, not double-start
  - [ ] Only one OAuth flow happens

- [ ] **Logout During Token Exchange:**
  - [ ] Start login
  - [ ] While OAuth flow is happening, try to logout
  - [ ] Should handle gracefully

### Phase 9: UI States

- [ ] **Button States:**
  - [ ] "Log in" - visible when logged out
  - [ ] "..." - visible during login (disabled)
  - [ ] "Sign out" - visible when logged in

- [ ] **Cloud Indicator:**
  - [ ] Shows "Local" when logged out
  - [ ] Shows user email when logged in
  - [ ] Updates correctly on login/logout

- [ ] **Settings Menu:**
  - [ ] "Log in"/"Sign out" option works
  - [ ] Modal doesn't get stuck loading

### Phase 10: Local Storage

- [ ] **localStorage Checks:**
  - [ ] `localStorage.getItem('tt.mode')` = 'local' when logged out
  - [ ] `localStorage.getItem('tt.mode')` = 'cloud' when logged in
  - [ ] `localStorage.getItem('tt.firstRun')` = '1' after first boot
  - [ ] Other localStorage keys untouched

---

## 📊 Console Output Examples

### Expected Logs (Happy Path: Fresh Boot + Login)

```
[preload] fetchFn ok? true
[preload] Firebase initialized
[preload] attempting refresh token restore...
[preload] no refresh token saved (first boot)
[preload] ✓ Firebase ready (no active session)

[loginMode] waiting for first Firebase auth event...
[authState] State: LOCAL / Logged Out
[renderer] app ready

<user clicks "Log in">

[authState] login started...
[main][oauth] opening system browser
[main][oauth] received code
[main][oauth] token exchange success
[main] refresh token saved to keytar
[preload] signInWithGoogle success

[preload] onAuthStateChanged(user)
[loginMode] ✓ User logged in: user@example.com
[loginMode] ✓ Applying remote data from cloud (or uploading local)
[authState] ✓ Logged in: user@example.com
```

### Expected Logs (Persistence: Boot After Logout)

```
[preload] Firebase initialized
[preload] attempting refresh token restore...
[preload] ✓ restored firebase sign-in from refresh token
[preload] onAuthStateChanged(user)
[loginMode] ✓ User logged in: user@example.com
[authState] ✓ Logged in: user@example.com
[renderer] app ready (already logged in)
```

### Expected Logs (Logout)

```
<user clicks "Sign out">

[authstate] logout started
[preload] firebase signOut called
[main] refresh token deleted from keytar
[preload] onAuthStateChanged(null)
[loginmode] Logged out
[authState] ✗ Logged out
```

---

## 🔍 Debugging Checklist

If something isn't working:

- [ ] **Check console for errors** - Look for stack traces
- [ ] **Check Keytar** - Verify refresh token exists (or doesn't)
- [ ] **Check localStorage** - Verify `tt.mode` and `tt.firstRun`
- [ ] **Check Firebase logs** - Any auth errors?
- [ ] **Check network** - Is internet available?
- [ ] **Check credentials** - Are Google OAuth credentials correct?
- [ ] **Check file timestamps** - When was app last started?

---

## 🚀 Go-Live Checklist

Before shipping to users:

- [ ] All 10 testing phases passed
- [ ] No console errors on normal use
- [ ] Keytar installed and working (`npm ls keytar`)
- [ ] Google OAuth credentials configured correctly
- [ ] Environment variables set (if needed)
- [ ] No stale `deskday-auth-tokens.json` files left
- [ ] Documentation reviewed and up-to-date
- [ ] Team aware of new architecture
- [ ] Monitoring/logging enabled for auth failures

---

## 📝 Rollback Plan (If Needed)

If this refactor breaks something:

1. **Last working version:** Commit before cleanup
2. **Revert changes:** `git revert [commit-hash]`
3. **File-based restore:** Comment out file deletions, they're backward compatible
4. **Keytar fallback:** Keytar handlers are unchanged

**But:** You shouldn't need to rollback - this is more stable! 💪

---

## 🎯 Success Criteria

Your persistent login is working correctly when:

✅ Login button appears on first boot  
✅ OAuth works and saves user  
✅ App auto-logins on restart (persistence)  
✅ Logout clears everything  
✅ Can re-login after logout  
✅ No console errors  
✅ Keytar has exactly one token (refresh)  
✅ No `deskday-auth-tokens.json` file exists  
✅ Cloud sync works (if using cloud)  
✅ Local mode works (if not logged in)  

**All ✅?** You're done! 🎉

---

## Questions During Testing?

1. **"Why isn't it auto-logging in?"**
   → Check if refresh token exists in Keytar
   → Check preload.js logs

2. **"Why did logout fail?"**
   → Check if Firebase signOut succeeded
   → Check if Keytar delete succeeded

3. **"Why is button stuck on '...'?"**
   → Check for OAuth window stuck in background
   → Check for network timeout
   → Restart app

4. **"Why am I in local mode when I expect cloud?"**
   → Check localStorage `tt.mode`
   → Check if token was revoked
   → Force re-login

---

## Final Notes

- Each phase is independent (you can test out of order)
- Rerun tests after any code changes
- Document any edge cases you find
- Add to this checklist if you discover new scenarios

Good luck! 🚀

