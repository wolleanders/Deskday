// main.js
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
const keytar = require('keytar');
const { autoUpdater } = require('electron-updater');

// Load environment variables (for Google OAuth client secret)
require('dotenv').config();

console.log('[main] userData path:', app.getPath('userData'));

//##########################################################################################
// AUTO-UPDATE SETUP - called after app.whenReady() below
//##########################################################################################
// Note: checkForUpdatesAndNotify() must be called AFTER app is ready, not at module load time

//##########################################################################################
// AUTH TOKEN HANDLERS - Secure Refresh Token Storage via Keytar
// Persistent login: Refresh token (Keytar) + Firebase session (browserLocalPersistence)
//##########################################################################################

const SERVICE = 'Deskday';
const ACCOUNT_REFRESH = 'google-refresh-token';

// Save refresh token to Keytar (called after successful OAuth)
ipcMain.handle('tokens:saveRefresh', async (_, refreshToken) => {
  if (!refreshToken) return false;
  await keytar.setPassword(SERVICE, ACCOUNT_REFRESH, refreshToken);
  console.log('[main] refresh token saved to keytar');
  return true;
});

// Delete refresh token from Keytar (called on logout)
ipcMain.handle('tokens:deleteRefresh', async () => {
  await keytar.deletePassword(SERVICE, ACCOUNT_REFRESH);
  console.log('[main] refresh token deleted from keytar');
  return true;
});

// Get refresh token from Keytar (called on app boot to restore session)
ipcMain.handle('tokens:getRefresh', async () => {
  return await keytar.getPassword(SERVICE, ACCOUNT_REFRESH);
});

// Exchange refresh token for new Google tokens (called during boot restoration)
ipcMain.handle('tokens:refreshGoogle', async (_, { clientId } = {}) => {
  const refreshToken = await keytar.getPassword(SERVICE, ACCOUNT_REFRESH);
  if (!refreshToken) return null;

  const url = 'https://oauth2.googleapis.com/token';
  // Include client_secret from env (required for refresh token exchange)
  // Use hardcoded fallback for packaged app (dotenv not available in ASAR)
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId || process.env.GOOGLE_CLIENT_ID || '1068554735717-haqdeeoaejhbsmn3f807vqnq3arnv5gk.apps.googleusercontent.com',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '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'
  });

  try {
    const res = await fetchFn(url, { method: 'POST', body });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('refresh failed: ' + txt);
    }
    const json = await res.json();

    // If Google returns a new refresh token (rare), save it
    if (json.refresh_token) {
      try { await keytar.setPassword(SERVICE, ACCOUNT_REFRESH, json.refresh_token); }
      catch (e) { console.warn('[main] failed to save new refresh_token', e); }
    }
    return json;
  } catch (err) {
    console.error('[main] tokens:refreshGoogle failed:', err.message);
    throw err;
  }
});

//##########################################################################################

let fetchFn;
try {
  // wenn Node 18+ global fetch hat
  fetchFn = globalThis.fetch;
  if (!fetchFn) {
    // ansonsten node-fetch v2 (CommonJS)
    fetchFn = require('node-fetch');
    if (fetchFn && fetchFn.default) fetchFn = fetchFn.default;
  }
} catch (e) {
  fetchFn = globalThis.fetch || null;
}
console.log('[main] fetchFn ok?', !!fetchFn);
if (!fetchFn) {
  console.error('[main] fetch is not available. Please run: npm install node-fetch@2');
}

console.log('[main] >>> main.js started');

// Datei für Fenster-Position/Größe
const stateFile = path.join(app.getPath('userData'), 'window-state.json');
console.log('[main] state file:', stateFile);
let saveStateTimeout;
let lastSavedBounds = null;

let win; // settingsWin ist aktuell unbenutzt
let notesWin; // Separate floating notes window
let currentSettings = { theme: 'dark', hour12: false, autostart: false, alwaysOnTop: true }; // Cache settings
app.isQuiting = false;

// Ensure Windows AppUserModelID is set for taskbar / notifications grouping
try {
  if (process.platform === 'win32') {
    // Use a stable app id so Windows shows the correct icon and grouping
    app.setAppUserModelId('com.wolle.deskday');
    console.log('[main] setAppUserModelId: com.wolle.deskday');
  }
} catch (e) {
  console.warn('[main] setAppUserModelId failed', e);
}

const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// ---------- State laden – inkl. displayId (Monitor-ID)----------
function loadWindowState() {
  try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const state = JSON.parse(raw);
    console.log('[main] loadWindowState:', state);
    return state;
  } catch (e) {
    console.log('[main] loadWindowState: no previous state, using defaults');
    // KEIN x/y ⇒ erster Start
    return { width: 360, height: 600 };
  }
}

//--------------- Bounds „sichtbar“ machen + letzten Monitor bevorzugen-----------------
// sorgt dafür, dass das Fenster auf einem sichtbaren Bereich liegt
function ensureVisibleBounds(state) {
  if (!state) return state;

  const displays = screen.getAllDisplays();
  if (!displays.length) return state;

  const defaultW = state.width  || 360;
  const defaultH = state.height || 600;

  // 1) Ausgangs-Rect aus gespeicherter Position (falls vorhanden)
  let rect = null;
  const hasPos =
    typeof state.x === 'number' &&
    typeof state.y === 'number';

  if (hasPos) {
    rect = {
      x: state.x,
      y: state.y,
      width: defaultW,
      height: defaultH,
    };
  }

  // 2) Ziel-Display bestimmen
  let targetDisplay = null;

  // zuerst: falls es eine Position gibt → Display nach Position
  if (rect) {
    targetDisplay = screen.getDisplayMatching(rect);
  }

  // sonst: gespeicherte displayId versuchen
  if (!targetDisplay && state.displayId != null) {
    targetDisplay = displays.find(d => d.id === state.displayId) || null;
  }

  // Fallback: Primary-Display
  if (!targetDisplay) {
    targetDisplay = screen.getPrimaryDisplay();
  }

  const wa = targetDisplay.workArea; // { x, y, width, height }

  // 3) Falls keine gültige Position → in dieses WorkArea zentrieren
  if (!rect) {
    rect = {
      x: wa.x + Math.round((wa.width  - defaultW) / 2),
      y: wa.y + Math.round((wa.height - defaultH) / 2),
      width: defaultW,
      height: defaultH,
    };
  }

  // 4) Minimale Größe sicherstellen
  const minW = 360;
  const minH = 600;
  const clamped = { ...rect };

  if (clamped.width  < minW) clamped.width  = minW;
  if (clamped.height < minH) clamped.height = minH;

  // 5) X/Y so klemmen, dass immer ein Teil im sichtbaren Bereich bleibt
  if (clamped.x + clamped.width  < wa.x + 50) clamped.x = wa.x;
  if (clamped.y + clamped.height < wa.y + 50) clamped.y = wa.y;
  if (clamped.x > wa.x + wa.width  - 50)      clamped.x = wa.x + wa.width  - clamped.width;
  if (clamped.y > wa.y + wa.height - 50)      clamped.y = wa.y + wa.height - clamped.height;

  const result = {
    ...state,
    x: clamped.x,
    y: clamped.y,
    width: clamped.width,
    height: clamped.height,
    displayId: targetDisplay.id,
  };

  console.log('[main] ensureVisibleBounds:', result, 'on', wa);
  return result;
}

//Schreib-Limit & Monitor-ID beim Speichern
//Helper, um Bounds zu vergleichen
function boundsEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.displayId === b.displayId
  );
}

function saveWindowStateNow() {
  if (!win) return;
  if (win.isMinimized()) return; // minimiertes Fenster ignorieren

  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);

  const data = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    displayId: display ? display.id : undefined,
  };

  if (boundsEqual(lastSavedBounds, data)) return;
  lastSavedBounds = data;

  fs.writeFile(stateFile, JSON.stringify(data), (err) => {
    if (err) console.warn('[main] could not save window state:', err);
    else console.log('[main] saveWindowState:', data);
  });
}

function scheduleSaveWindowState() {
  if (!win) return;
  clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(saveWindowStateNow, 800);
}

function createWindow() {
  const state = ensureVisibleBounds(loadWindowState());
  // Use the generated app.ico (or fall back to PNG)
  const iconPath = path.join(__dirname, 'assets', 'icons', 'app.ico');
  let chosenIcon = null;
  try {
    if (fs.existsSync(iconPath)) {
      chosenIcon = iconPath;
      console.log('[main] using generated app.ico');
    }
  } catch (e) { console.warn('[main] app.ico check failed', e); }
  
  // Fallback to PNG if .ico doesn't exist
  if (!chosenIcon) {
    const pngCandidates = [
      path.join(__dirname, 'assets', 'icons', 'Icon', 'Square44x44Logo.targetsize-256.png'),
      path.join(__dirname, 'assets', 'icons', 'Icon', 'Square150x150Logo.scale-400.png'),
    ];
    for (const p of pngCandidates) {
      try { if (fs.existsSync(p)) { chosenIcon = p; break; } } catch (e) {}
    }
  }

  win = new BrowserWindow({
    width:  state.width  || 360,
    height: state.height || 600,
    x:      state.x,
    y:      state.y,
    minWidth: 360,
    minHeight: 600,
    maxWidth: 360,
    maxHeight: 600,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',   // transparente Farbe (RGBA im Hex-Format)
    show: false,
    hasShadow: true,
    titleBarStyle: 'hidden',
    roundedCorners: true,           // wirkt nur auf macOS
    icon: chosenIcon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // nativeWindowOpen: true,     // aktivieren, falls du Firebase-Popups nutzt
      sandbox: false,
      webSecurity: true
    }
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
    // DevTools nur im Dev-Betrieb aufmachen
    if (!app.isPackaged) win.webContents.openDevTools({ mode: 'detach' });
  });

  // Minimieren -> in Tray verstecken
  win.on('minimize', (e) => { e.preventDefault(); win.hide(); });

  // Schließen -> verstecken (bis "Exit" im Tray)
  win.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      win.hide();
    } else {
      saveWindowStateNow(); // ✅ hier den richtigen Namen benutzen
      setTimeout(() => {
            app.quit();
        }, 500); // 500ms (0.5 Sekunden)
    }
  });

  // ⬇️ hier merken wir uns Position/Größe
  win.on('move', () => {
    console.log('[main] move event');
    scheduleSaveWindowState();
  });
  win.on('resize', () => {
    console.log('[main] resize event');
    scheduleSaveWindowState();
  });
}

let tray = null;
function createTray() {
  const assetsDir = path.join(__dirname, 'assets/icons');

  // Dynamisch zwischen hell/dunkel wechseln (z. B. für Light/Dark Mode)
  const iconFile =
    process.platform === 'darwin'
      ? 'trayTemplate.png' // macOS Template-Icon (automatisch invertiert)
      : process.platform === 'win32'
      ? (nativeTheme.shouldUseDarkColors ? 'tray-light.ico' : 'tray-dark.ico')
      : (nativeTheme.shouldUseDarkColors ? 'tray-light.png' : 'tray-dark.png');

  const iconPath = path.join(assetsDir, iconFile);
  const trayIcon = nativeImage.createFromPath(iconPath);

  tray = new Tray(trayIcon);
  tray.setToolTip('Deskday Beta');

  // Build a stable context menu for the tray so users can always access actions
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Deskday',
      type: 'normal',
      click: () => {
        try { if (win) { win.show(); win.focus(); } } catch(e) { console.warn('[tray] show failed', e); }
      }
    },
    {
      label: 'Hide',
      type: 'normal',
      click: () => { try { if (win) win.hide(); } catch(e) { console.warn('[tray] hide failed', e); } }
    },
    { type: 'separator' },
    {
      label: 'Quit Deskday',
      type: 'normal',
      click: () => {
        try {
          app.isQuiting = true;
          // ensure we close gracefully
          if (win) {
            win.removeAllListeners('close');
            win.close();
          }
          app.quit();
        } catch (e) {
          console.warn('[tray] quit failed', e);
          try { app.quit(); } catch(_){}
        }
      }
    }
  ]);

  // Set context menu and wire interactions
  try {
    tray.setContextMenu(contextMenu);
  } catch (e) {
    console.warn('[tray] setContextMenu failed', e);
  }

  // Click toggles show/hide (left click)
  tray.on('click', (event, bounds, position) => {
    try {
      if (win) {
        if (win.isVisible()) { win.hide(); }
        else { win.show(); win.focus(); }
      }
    } catch (e) { console.warn('[tray] click handler failed', e); }
  });

  // Double-click shows the window
  tray.on('double-click', () => { try { if (win) { win.show(); win.focus(); } } catch(e){} });

  // Right-click: pop up context menu explicitly (some platforms need this)
  tray.on('right-click', (ev, b) => {
    try { tray.popUpContextMenu(); } catch (e) { console.warn('[tray] popUpContextMenu failed', e); }
  });

  console.log('[tray] loaded:', iconPath);
  return tray;
}

nativeTheme.on('updated', () => {
  if (tray) {
    tray.destroy();
    tray = createTray();
  }
});

// ========== NOTES WINDOW ==========
function createNotesWindow() {
  if (notesWin) {
    notesWin.focus();
    return notesWin;
  }

  const iconPath = path.join(__dirname, 'assets', 'icons', 'app.ico');
  let chosenIcon = null;
  try {
    if (fs.existsSync(iconPath)) {
      chosenIcon = iconPath;
    }
  } catch (e) {}
  
  if (!chosenIcon) {
    const pngCandidates = [
      path.join(__dirname, 'assets', 'icons', 'Icon', 'Square44x44Logo.targetsize-256.png'),
      path.join(__dirname, 'assets', 'icons', 'Icon', 'Square150x150Logo.scale-400.png'),
    ];
    for (const p of pngCandidates) {
      try { if (fs.existsSync(p)) { chosenIcon = p; break; } } catch (e) {}
    }
  }

  // Try to load saved position
  let winBounds = { width: 500, height: 600 };
  try {
    const stateFile = path.join(app.getPath('userData'), 'notes-window-state.json');
    if (fs.existsSync(stateFile)) {
      const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      winBounds = { ...winBounds, ...saved };
      console.log('[main] notes window state restored:', winBounds);
    }
  } catch (e) {
    console.warn('[main] failed to restore notes window state', e);
  }

  // Determine alwaysOnTop from cached settings
  let alwaysOnTop = currentSettings.alwaysOnTop !== false; // default true

  notesWin = new BrowserWindow({
    width: winBounds.width || 360,
    height: winBounds.height || 300,
    x: winBounds.x,
    y: winBounds.y,
    minWidth: 360,
    minHeight: 300,
    frame: false,
    alwaysOnTop: alwaysOnTop,
    backgroundColor: '#00000000',
    show: false,
    hasShadow: true,
    titleBarStyle: 'hidden',
    roundedCorners: true,
    icon: chosenIcon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });

  notesWin.loadURL(`file://${__dirname}/notes-window.html`);

  notesWin.once('ready-to-show', () => {
    notesWin.show();
  });

  // Track position changes
  notesWin.on('move', () => {
    console.log('[main] notes window moved');
  });

  notesWin.on('resize', () => {
    console.log('[main] notes window resized');
  });

  // Save position on close
  notesWin.on('close', () => {
    try {
      const bounds = notesWin.getBounds();
      const stateFile = path.join(app.getPath('userData'), 'notes-window-state.json');
      fs.writeFileSync(stateFile, JSON.stringify(bounds));
      console.log('[main] notes window state saved:', bounds);
    } catch (e) {
      console.warn('[main] failed to save notes window state', e);
    }
  });

  notesWin.on('closed', () => {
    notesWin = null;
  });

  return notesWin;
}

// IPC to open/close notes window
ipcMain.handle('notes:open', () => {
  return createNotesWindow() ? true : false;
});

ipcMain.handle('notes:close', () => {
  if (notesWin) {
    notesWin.close();
    notesWin = null;
    return true;
  }
  return false;
});

// IPC to get notes window bounds
ipcMain.handle('notes:getWindowBounds', () => {
  if (notesWin && !notesWin.isDestroyed()) {
    return notesWin.getBounds();
  }
  return null;
});

// IPC to set notes window bounds
ipcMain.handle('notes:setWindowBounds', (_, bounds) => {
  if (notesWin && !notesWin.isDestroyed() && bounds) {
    if (bounds.x !== undefined && bounds.y !== undefined) {
      notesWin.setPosition(bounds.x, bounds.y);
    }
    if (bounds.width !== undefined && bounds.height !== undefined) {
      notesWin.setSize(bounds.width, bounds.height);
    }
    return true;
  }
  return false;
});

// IPC to set alwaysOnTop for notes window
ipcMain.handle('notes:setAlwaysOnTop', (_, on) => {
  if (notesWin && !notesWin.isDestroyed()) {
    notesWin.setAlwaysOnTop(!!on, 'screen-saver');
    console.log('[main] notes window alwaysOnTop set to:', !!on);
    return true;
  }
  return false;
});

ipcMain.handle('notes:setTheme', (_, { theme }) => {
  if (notesWin && !notesWin.isDestroyed()) {
    try {
      const themeVal = (theme || 'dark').toLowerCase();
      notesWin.webContents.executeJavaScript(`
        const html = document.documentElement;
        if ('${themeVal}' === 'light') {
          html.setAttribute('data-theme', 'light');
        } else {
          html.removeAttribute('data-theme');
        }
        console.log('[notes-window] theme set to: ${themeVal}');
      `);
      console.log('[main] notes window theme set to:', theme);
      return true;
    } catch (e) {
      console.warn('[main] failed to set notes window theme:', e);
      return false;
    }
  }
  return false;
});

// IPC listener for settings changes from main renderer - broadcast to notes window
ipcMain.on('settings:changed', (event, patch) => {
  console.log('[main] settings changed:', patch);
  // Update cached settings
  currentSettings = { ...currentSettings, ...patch };
  console.log('[main] updated settings cache:', currentSettings);
  
  // Apply alwaysOnTop setting to main window if it changed
  if (patch.hasOwnProperty('alwaysOnTop')) {
    win.setAlwaysOnTop(!!patch.alwaysOnTop, 'screen-saver');
    console.log('[main] main window alwaysOnTop set to:', !!patch.alwaysOnTop);
  }
  
  if (notesWin && !notesWin.isDestroyed()) {
    try {
      notesWin.webContents.send('settings:changed', patch);
      console.log('[main] broadcasted settings to notes window:', patch);
      
      // Apply alwaysOnTop to notes window as well
      if (patch.hasOwnProperty('alwaysOnTop')) {
        notesWin.setAlwaysOnTop(!!patch.alwaysOnTop, 'screen-saver');
        console.log('[main] notes window alwaysOnTop set to:', !!patch.alwaysOnTop);
      }
    } catch (e) {
      console.warn('[main] failed to broadcast settings to notes window', e);
    }
  }
});

// IPC handler to get current settings (called by notes window on boot)
ipcMain.handle('settings:get', () => {
  console.log('[main] settings:get called, returning:', currentSettings);
  return currentSettings;
});


app.whenReady().then(async () => {
  createWindow();
  createTray();
  if (process.platform === 'darwin') app.dock.hide(); // optional

  // Configure auto-updater with GitHub feed URL
  // Use GitHub releases API directly - more reliable than raw.githubusercontent.com
  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'wolleanders',
      repo: 'Deskday'
    });
    console.log('[main] auto-updater configured to use GitHub releases API');
  } catch (e) {
    console.warn('[main] failed to set GitHub feed URL:', e.message);
    // Fallback to raw content if needed
    try {
      const feedUrl = 'https://raw.githubusercontent.com/wolleanders/Deskday/main/latest.yml';
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: feedUrl
      });
      console.log('[main] fallback: using raw.githubusercontent.com');
    } catch (e2) {
      console.warn('[main] both feed URL methods failed:', e2.message);
    }
  }

  // Enable auto-updater debug logging
  try {
    // Configure auto-updater with more verbose logging
    autoUpdater.logger = require('electron-log');
    autoUpdater.logger.transports.file.level = 'debug';
    console.log('[main] auto-updater debug logging enabled');
  } catch (e) {
    console.log('[main] auto-updater debug logging failed:', e.message);
  }

  // Auto-updater: check for updates after window is ready
  console.log('[main] app ready - checking for updates...');
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(e => {
      console.warn('[main] auto-updater check failed:', e);
    });
  }, 2000); // 2 second delay to ensure everything is initialized
});

// IPC
ipcMain.handle('tray:minimize', () => { if (win) win.hide(); });
ipcMain.handle('tray:show',      () => { if (win) { win.show(); win.focus(); } });
ipcMain.handle('app:quit', async () => {
  app.isQuiting = true;
  /*try {
    if (win && win.webContents && win.webContents.session?.flushStorageData) {
      await win.webContents.session.flushStorageData();
      console.log('[main] storage flushed before quit');
    }
  } catch (e) {
    console.warn('[main] flush before quit failed', e);
  }
    */
  if (win) {
        win.close();
    } else {
        app.quit();
    }
});

ipcMain.handle('storage:flush', async () => {
  try {
    if (win && win.webContents && win.webContents.session) {
      const ses = win.webContents.session;
      if (ses.flushStorageData) {
        await ses.flushStorageData();
        console.log('[main] storage flushed');
      }
    }
  } catch (e) {
    console.warn('[main] storage flush failed', e);
  }
});

ipcMain.on('minimize-to-tray', () => { if (win) win.hide(); });

//##########################################################################################
// AUTO-UPDATE IPC HANDLERS & EVENT LISTENERS
//##########################################################################################

// Listen for update events and notify renderer
autoUpdater.on('update-available', (info) => {
  console.log('[updater] Update available:', info.version);
  if (win) {
    win.webContents.send('update:available', { version: info.version });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[updater] Update downloaded:', info.version);
  if (win) {
    win.webContents.send('update:downloaded', { version: info.version });
  }
});

autoUpdater.on('error', (err) => {
  console.warn('[updater] Error:', err);
});

// IPC handler for user to install update
ipcMain.handle('updater:installUpdate', async () => {
  console.log('[main] Installing update...');
  try {
    setImmediate(() => autoUpdater.quitAndInstall());
    return true;
  } catch (e) {
    console.error('[main] Install failed:', e);
    return false;
  }
});

// IPC handler for renderer to check for updates manually
ipcMain.handle('updater:checkForUpdates', async () => {
  try {
    console.log('[main] checkForUpdates: starting...');
    console.log('[main] checkForUpdates: current version:', app.getVersion());
    
    const result = await autoUpdater.checkForUpdates();
    
    console.log('[main] checkForUpdates result:', JSON.stringify(result, null, 2));
    const available = result && result.updateInfo && result.updateInfo.version;
    console.log('[main] Update available?', available);
    
    if (result && result.updateInfo) {
      console.log('[main] updateInfo details:', JSON.stringify(result.updateInfo, null, 2));
    }
    
    return { available: !!available };
  } catch (e) {
    console.error('[main] Check for updates failed:', e);
    console.error('[main] Error stack:', e.stack);
    return { available: false };
  }
});

ipcMain.on('minimize-to-tray', () => { if (win) win.hide(); });

// Fenster "always on top" setzen
ipcMain.handle('window:setAlwaysOnTop', (_event, on) => {
  if (win) {
    win.setAlwaysOnTop(!!on, 'screen-saver'); // 'screen-saver' = ziemlich "stark" on top
  }
  return !!on;
});

// Autostart-Status abfragen
ipcMain.handle('autostart:get', () => {
  if (isWin || isMac) {
    const settings = app.getLoginItemSettings();
    return !!settings.openAtLogin;
  }
  // andere Plattformen erstmal als "aus" behandeln
  return false;
});

// Autostart setzen
ipcMain.handle('autostart:set', (_event, on) => {
  const enabled = !!on;
  if (isWin || isMac) {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true, // Fenster beim Booten ruhig im Hintergrund starten
    });
  }
  return enabled;
});


// main.js - Ab hier (Zeile ~425) den kompletten Block ersetzen
ipcMain.handle('google-oauth:start', async () => {
    // If a login is already in progress, return the same promise/result to future callers
    if (global.__deskday_oauth_promise) {
        console.log('[main][oauth] join existing oauth promise');
        return global.__deskday_oauth_promise;
    }

    // create and store the promise immediately so simultaneous invokes wait for it
    global.__deskday_oauth_promise = (async () => {
        let server;
        try {
            // === CONFIG: set your Desktop client ID here (EXACT, no secret) ===
            const clientId = process.env.GOOGLE_CLIENT_ID || '1068554735717-haqdeeoaejhbsmn3f807vqnq3arnv5gk.apps.googleusercontent.com';
            if (!clientId || clientId.trim() === '') {
                throw new Error('Bitte setze die Desktop client_id in main.js (clientId variable).');
            }
            console.log('[main][oauth] using clientId:', clientId);

            // Get client secret from environment or use hardcoded value
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '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';
            if (!clientSecret) {
                throw new Error('GOOGLE_CLIENT_SECRET is missing.');
            }
            console.log('[main][oauth] client secret configured ✓');

            // PKCE helpers
            function base64url(buffer) {
                return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            }
            function makeCodeVerifier() { return base64url(crypto.randomBytes(32)); }
            function makeCodeChallenge(verifier) { return base64url(crypto.createHash('sha256').update(verifier).digest()); }

            const codeVerifier = makeCodeVerifier();
            const codeChallenge = makeCodeChallenge(codeVerifier);
            console.log('[main][oauth] PKCE created');

            // start loopback server
            server = http.createServer();
            const port = await new Promise((resolve, reject) => {
                server.listen(0, '127.0.0.1', () => {
                    const addr = server.address();
                    if (!addr || typeof addr.port !== 'number') return reject(new Error('Failed to get listening port'));
                    resolve(addr.port);
                });
                server.on('error', (err) => reject(err));
            });
            const redirectUri = `http://127.0.0.1:${port}/callback`;
            console.log('[main][oauth] loopback server listening on', redirectUri);

            // build auth url
            const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            authUrl.searchParams.set('client_id', clientId);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('scope', 'openid email profile');
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');
            authUrl.searchParams.set('prompt', 'consent');
            authUrl.searchParams.set('access_type', 'offline');

            console.log('[main][oauth] opening system browser to:', authUrl.toString());
            shell.openExternal(authUrl.toString());

            // --- WAIT FOR CALLBACK (code) AND THEN DO TOKEN EXCHANGE ---
            const code = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for OAuth callback (2min)'));
                }, 2 * 60 * 1000);

                server.on('request', (req, res) => {
                    try {
                        const u = new URL(req.url, `http://127.0.0.1:${port}`);
                        if (u.pathname !== '/callback') {
                            res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
                            res.end('Not found');
                            return;
                        }

                        const err = u.searchParams.get('error');
                        const c = u.searchParams.get('code');

                        // nice browser response
                        res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
                        if (c) {
                            res.end(`<!doctype html><meta charset="utf-8"><title>Deskday — Login complete</title>
                                <div style="font-family:system-ui,Arial;padding:40px;text-align:center">
                                    <h1>Login successful</h1><p>Du kannst dieses Fenster schließen.</p>
                                </div>`);
                        } else {
                            res.end(`<!doctype html><meta charset="utf-8"><title>Deskday — Login failed</title>
                                <div style="font-family:system-ui,Arial;padding:40px;text-align:center"><h1>Login failed</h1><p>${err||'unknown'}</p></div>`);
                        }

                        // clear timeout and resolve/reject
                        clearTimeout(timeout);

                        if (err) return reject(new Error('OAuth error: ' + err));
                        if (!c) return reject(new Error('No code in callback'));
                        console.log('[main][oauth] received code:', c);
                        resolve(c);
                    } catch (e) {
                        clearTimeout(timeout);
                        reject(e);
                    }
                });
            });

            // Exchange code for tokens
            if (!fetchFn) throw new Error('fetchFn not available (install node-fetch@2 or use Node18+)');

            const tokenEndpoint = 'https://oauth2.googleapis.com/token';
            // build body for token exchange
            // Desktop apps REQUIRE client_secret even with PKCE (unlike web apps with PKCE)
            const bodyParams = {
                client_id: clientId,
                client_secret: clientSecret || '',  // Desktop apps require this
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
            };
            
            const body = new URLSearchParams(bodyParams);

            console.log('[main][oauth] starting token exchange...');
            const tokenResp = await fetchFn(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString()
            });

            if (!tokenResp.ok) {
                // Bei einem Fehler den genauen Text-Body von Google loggen
                const txt = await tokenResp.text().catch(() => 'No response body');
                console.error('[main][oauth] token exchange failed status', tokenResp.status, txt);
                throw new Error(`Token exchange failed: ${tokenResp.status} — ${txt}`);
            }

            const tokenJson = await tokenResp.json();
            
            // store refresh token securely (keytar)
            if (tokenJson.refresh_token) {
                try {
                    await keytar.setPassword(SERVICE, ACCOUNT_REFRESH, tokenJson.refresh_token);
                    console.log('[main][oauth] saved refresh_token to keytar');
                } catch (e) {
                    console.warn('[main][oauth] failed saving refresh_token to keytar', e);
                }
            }

            const accessToken = tokenJson.access_token;
            const idToken = tokenJson.id_token;
            const refreshToken = tokenJson.refresh_token;
            if (!accessToken || !idToken) {
                throw new Error('Missing tokens in token response');
            }

            console.log('[main][oauth] token exchange success — tokens received (has_refresh=' + !!refreshToken + ')');

            // success -> return tokens
            return { accessToken, idToken, refreshToken };

        } catch (err) {
            console.error('[main][oauth] ERROR:', err && err.message ? err.message : err);
            throw err;
        } finally {
            // guaranteed cleanup of loopback server
            try { if (server && server.close) server.close(); } catch (e) { /* ignore */ }
        }
    })();

    // Wait for the stored promise, and always clear it once done (success or error)
    try {
        const result = await global.__deskday_oauth_promise;
        return result;
    } finally {
        global.__deskday_oauth_promise = null;
    }
});

//#######################################################################################################################
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
//1068554735717-haqdeeoaejhbsmn3f807vqnq3arnv5gk.apps.googleusercontent.com
//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