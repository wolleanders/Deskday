# Deskday AI Coding Instructions

## Architecture Overview

Deskday is an Electron desktop app (v0.5.1) with persistent login, cloud sync, and local-first scheduling. Three-process model:

- **Main (`main.js`)**: Electron app lifecycle, OAuth token management (Keytar), system tray, IPC handlers
- **Preload (`preload.js`)**: Secured context bridge exposing `auth`, `__deskday_tokens`, and cloud APIs to renderer
- **Renderer (`renderer.js`)**: ~1500 lines; UI rendering, event wiring, offline-first storage sync
- **Modules** (`modules/`): Task-specific concerns (storage, auth state, cloud sync, settings, theme, onboarding)

## Authentication & Persistence Pattern

**Non-negotiable flow:**
1. Keytar (OS credential store) holds Google refresh token (main process only)
2. Firebase SDK manages session via `browserLocalPersistence` (preload + renderer)
3. On app boot → `preload.js` fetches stored refresh token → exchanges for Google tokens → initializes Firebase
4. `modules/loginMode.js` tracks mode (`'local'` | `'cloud'`) in localStorage; auth truth is Firebase's `onAuthStateChanged`
5. Logout: `authState.js` sets mode to `'local'` **before** calling `signOut()` (prevents race conditions)

When touching auth: verify `__deskday_isExplicitlyLoggingOut` flag in `authState.js` to prevent duplicate handlers.

## Storage & Conflict Resolution

- **Local source of truth**: localStorage with three keys: `deskday.entries.v1`, `deskday.hours.v1`, `deskday.meta.v1`
- **Per-entry timestamps**: `deskday.entryMeta.v1` tracks hour-level `updatedAt` for granular merging
- **Cloud sync**: `scheduleCloudSave()` debounces (1500ms) before Firestore write; `loadFromCloudAndApply()` on login
- **Newest-wins merge**: `shouldApplyRemote()` compares entry timestamps; bias toward user's latest change

`modules/storage.js` exports the canonical functions: `loadHours`, `saveHours`, `exportTimetable`, `importTimetable`, `saveEntries`, `loadEntries`, `touchEntryUpdatedAt`.

## Development Workflow

**Setup:**
```bash
npm install
npm run build:icon          # REQUIRED before first run—creates assets/icons/app.ico
```

**Run dev:** `npm start` → Opens with DevTools detached (`main.js` line ~312)

**Build output:**
- Portable `.exe`: `npm run build:portable`
- NSIS installer: `npm run build:dist`
- Icon generation required before packaging; fails if `app.ico` missing

**Environment:** `.env` file with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (for Google OAuth).

## Key Module Patterns

| Module | Responsibility | Key Export |
|--------|-----------------|-----------|
| `storage.js` | Local data CRUD, merge strategy | `exportTimetable()`, `importTimetable()`, `shouldApplyRemote()` |
| `cloudSync.js` | Debounced cloud save/load | `scheduleCloudSave()`, `loadFromCloudAndApply()` |
| `loginMode.js` | Mode tracking (local↔cloud) | `getMode()`, `setMode()`, `loginWithGoogle()`, `logout()` |
| `authState.js` | Login button UI + handler wiring | `handleAuthStateChange(user)` |
| `settings.js` | User preferences (theme, time format) | `getSettings()`, `applyHourFormat()`, `toggleTheme()` |
| `theme.js` | Dark/light mode CSS toggle | `installThemeListener()` |
| `onboarding.js` | First-run flow state | `isFirstStartup()`, `completeOnboarding()` |

## Debugging Tips

- **Auth stuck?** Check DevTools → `__deskday_currentUser` (preload.js global) and Keytar via `tokens:getRefresh` IPC
- **Sync not working?** Verify login state in Settings UI; check `shouldApplyRemote()` logic in `storage.js`
- **Icon missing?** Always run `npm run build:icon` after icon source changes in `assets/icons/Icon/`
- **Tray unresponsive?** Right-click tray → "Show Deskday"; check `main.js` createTray() for platform-specific icon paths
- **localStorage corrupt?** Open DevTools (Ctrl+Shift+I) → Application → Local Storage → check JSON validity

## IPC Handlers (main.js)

Critical handlers for agent changes:
- `tokens:saveRefresh`, `tokens:getRefresh`, `tokens:deleteRefresh` — Keytar integration
- `tokens:refreshGoogle` — OAuth token exchange
- `tray:minimize`, `tray:show`, `app:quit` — Tray control
- `storage:flush` — Sync session before app exit

Do NOT add synchronous IPC calls; use `ipcMain.handle()` with async/await.

## Code Style Notes

- **No tests yet** (`package.json` test: `echo error`)
- **ES Modules in renderer/modules**, CommonJS in main/preload
- Comments use German and English interchangeably (legacy; preserve existing style)
- Defensive checks for nullish DOM elements: `element?.method()` or `if (element)`
- Single-flight protection for async operations (e.g., `__deskday_signin_promise` in `loginMode.js`)
