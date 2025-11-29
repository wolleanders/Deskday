// main.js
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen, nativeTheme, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');
console.log('[main] userData path:', app.getPath('userData'));

//##########################################################################################
const TOKENS_FILENAME = 'deskday-auth-tokens.json';
function tokenFilePath() {
  return path.join(app.getPath('userData'), TOKENS_FILENAME);
}

ipcMain.handle('auth:saveTokens', async (event, payload) => {
  try {
    const p = tokenFilePath();
    fs.writeFileSync(p, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
    return { ok: true, path: p };
  } catch (err) {
    console.warn('[main] auth:saveTokens failed', err);
    return { ok: false, err: String(err) };
  }
});

ipcMain.handle('auth:loadTokens', async () => {
  try {
    const p = tokenFilePath();
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[main] auth:loadTokens failed', err);
    return null;
  }
});

ipcMain.handle('auth:clearTokens', async () => {
  try {
    const p = tokenFilePath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return { ok: true };
  } catch (err) {
    console.warn('[main] auth:clearTokens failed', err);
    return { ok: false, err: String(err) };
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
app.isQuiting = false;

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
    icon: path.join(__dirname,'assets/icon.ico'),
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

  console.log('[tray] loaded:', iconPath);
  return tray;
}

nativeTheme.on('updated', () => {
  if (tray) {
    tray.destroy();
    tray = createTray();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  if (process.platform === 'darwin') app.dock.hide(); // optional
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


//TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST#

// ===== Replace the existing google-oauth:start handler with this debug-friendly implementation =====
// Replace the existing ipcMain.handle('google-oauth:start', ...) with this idempotent version
ipcMain.handle('google-oauth:start', async () => {
  // If a login is already in progress, return the same promise/result to future callers
  if (global.__deskday_oauth_promise) {
    console.log('[main][oauth] join existing oauth promise');
    // return the same promise so caller waits for the already-running flow
    return global.__deskday_oauth_promise;
  }

  // create and store the promise immediately so simultaneous invokes wait for it
  global.__deskday_oauth_promise = (async () => {
    try {
      // === CONFIG: set your Desktop client ID here (EXACT, no secret) ===
      const clientId = '1068554735717-k5g4d0pudmu8kl0p8idkugm255v4860r.apps.googleusercontent.com';
      if (!clientId || clientId.trim() === '') {
        throw new Error('Bitte setze die Desktop client_id in main.js (clientId variable).');
      }
      console.log('[main][oauth] using clientId:', clientId);

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
      const server = http.createServer();
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
      authUrl.searchParams.set('prompt', 'select_account');
      // authUrl.searchParams.set('access_type', 'offline'); // if you want refresh tokens (consent)

      console.log('[main][oauth] opening system browser to:', authUrl.toString());
      shell.openExternal(authUrl.toString());

      // wait for callback
      const code = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          server.close();
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

            clearTimeout(timeout);
            server.close();

            if (err) return reject(new Error('OAuth error: ' + err));
            if (!c) return reject(new Error('No code in callback'));
            console.log('[main][oauth] received code:', c);
            resolve(c);
          } catch (e) {
            clearTimeout(timeout);
            server.close();
            reject(e);
          }
        });
      });

      // Exchange code for tokens
      if (!fetchFn) throw new Error('fetchFn not available (install node-fetch@2 or use Node18+)');
      const tokenEndpoint = 'https://oauth2.googleapis.com/token';
      const clientSecret = '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';
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      });
      console.log('[main][oauth] token exchange POST body preview:', body.toString().slice(0,200), '...');

      const tokenResp = await fetchFn(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      if (!tokenResp.ok) {
        const txt = await tokenResp.text();
        console.error('[main][oauth] token exchange failed status', tokenResp.status, txt);
        throw new Error(`Token exchange failed: ${tokenResp.status} — ${txt}`);
      }

      const tokenJson = await tokenResp.json();
      console.log('[main][oauth] tokenJson received:', tokenJson);

      const accessToken = tokenJson.access_token;
      const idToken = tokenJson.id_token;
      if (!accessToken || !idToken) {
        throw new Error('Missing tokens in token response');
      }

      // success -> return tokens
      return { accessToken, idToken, raw: tokenJson };

    } catch (err) {
      console.error('[main][oauth] ERROR:', err && err.message ? err.message : err);
      throw err;
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

//TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//#######################################################################################################################
/*
ipcMain.handle('google-oauth:start', async () => {
  // 1. Redirect-URL vorbereiten (Google OAuth)
  // 2. Nonce erzeugen (zufälliger String)
  const nonce = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token id_token',
    scope: 'openid email profile',
    prompt: 'select_account'
  });

  // 3. Auth-URL bauen
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token%20id_token` +        // oder id_token%20token
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&nonce=${encodeURIComponent(nonce)}` +
    `&prompt=select_account`;

    shell.openExternal(authUrl);

  /* return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 500,
      height: 650,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    

    function cleanup() {
      if (!win.isDestroyed()) win.close();
    }

    function handleUrl(targetUrl) {
      if (!targetUrl.startsWith(redirectUri)) return;
      // Tokens hängen im Fragment hinter '#'
      const hash = targetUrl.split('#')[1] || '';
      const p = new URLSearchParams(hash);
      const accessToken = p.get('access_token');
      const idToken     = p.get('id_token');

      if (accessToken && idToken) {
        resolve({ accessToken, idToken });
      } else {
        reject(new Error('Missing tokens in redirect URL'));
      }
      cleanup();
    }

    win.webContents.on('will-redirect', (e, url) => handleUrl(url));
    win.webContents.on('will-navigate', (e, url) => handleUrl(url));
    win.on('closed', () => {
      reject(new Error('Login window closed by user'));
    });

    win.loadURL(authUrl);
  });

  //#######################################################################################################################
*/
  /*
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=token` +
    `&scope=email%20profile%20openid`;
  */

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
