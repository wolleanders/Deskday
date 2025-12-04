# Deskday

Deskday Desktop App - Simple Personal Scheduling Tool

## Setup & Installation

### Prerequisites
- Node.js 18+ (or 16+ with `node-fetch@2`)
- npm

### Install Dependencies
```bash
npm install
```

### Generate App Icon
Before running the app for the first time, generate the `.ico` file for the app icon:
```bash
npm run build:icon
```

This creates `assets/icons/app.ico` from your PNG icon designs. This file is used by:
- Windows taskbar
- System tray
- App switcher
- Windows Start search results (when packaged)

### Run the App
```bash
npm start
```

## Development

### Environment Variables
Create a `.env` file in the root directory with:
```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

These are required for Google OAuth (persistent login).

### Building Icons
Whenever you update your icon designs in `assets/icons/Icon/`, regenerate the app icon:
```bash
npm run build:icon
```

The script automatically picks the highest-resolution available PNG and converts it to a multi-resolution Windows `.ico` file.

## Features

- **Persistent Login**: Secure refresh token storage via Keytar + Firebase Auth
- **Cloud Sync**: Real-time Firestore synchronization with smart merge conflict resolution
- **Local-First**: Works offline with automatic cloud sync when online
- **Tray Support**: Minimize to system tray with context menu
- **Dark/Light Mode**: Theme toggle
- **12h/24h Format**: Configurable time display
- **Autostart**: Launch with system
- **Always on Top**: Optional window layering

## Architecture

- **Main Process** (`main.js`): Electron main, OAuth, Keytar, app icons, tray management
- **Preload** (`preload.js`): IPC bridge for Firebase and cloud operations
- **Renderer** (`renderer.js`): UI, auth state, realtime sync, UI updates
- **Modules**:
  - `modules/storage.js`: Local storage with smart merge strategy
  - `modules/loginMode.js`: Firebase auth orchestration
  - `modules/cloudSync.js`: Cloud save/load
  - `modules/authState.js`: Auth UI state management
  - `modules/settings.js`: User preferences
  - `modules/theme.js`: Dark/light mode

## Troubleshooting

### Icon not showing in taskbar
1. Ensure you've run `npm run build:icon`
2. Check that `assets/icons/app.ico` exists
3. Restart the app

### Tray becomes unresponsive
1. Right-click the tray icon to open the context menu
2. Click "Show Deskday" to restore the window
3. File a bug report with OS details

### Cloud sync not working
1. Verify you're logged in (Settings → "Logged in as" should show email)
2. Check DevTools console for sync errors (Ctrl+Shift+I)
3. Ensure `.env` has correct Google credentials

## License
See LICENSE file
