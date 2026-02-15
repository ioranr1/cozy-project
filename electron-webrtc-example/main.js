/**
 * Electron Main Process - Complete Implementation
 * ================================================
 * 
 * VERSION: 2.17.0 (2026-02-15)
 *
 * Full main.js with WebRTC Live View + Away Mode + Monitoring integration.
 * Copy this file to your Electron project.
 *
 * Required dependencies:
 *   npm install electron electron-store@7.0.3 @supabase/supabase-js
 *   npm install @mediapipe/tasks-vision @tensorflow/tfjs @tensorflow-models/speech-commands
 * 
 * IMPORTANT: Use electron-store v7.0.3 (NOT v8+) to avoid ESM issues!
 * 
 * Optional for Away Mode display control:
 *   Windows: nircmd.exe in project root
 *   Linux: xset (usually pre-installed)
 *   macOS: uses built-in pmset
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, powerSaveBlocker, nativeImage, powerMonitor } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const Store = require('electron-store');
const { createClient } = require('@supabase/supabase-js');
const { EventEmitter } = require('events');
const http = require('http');

// CRITICAL FIX: Import AwayManager to replace old Away Mode implementation
const AwayManager = require('./away/away-manager');

// NEW: Import Monitoring system
const MonitoringManager = require('./monitoring/monitoring-manager');
// Sound detection removed (v2.14.0) - replaced by Baby Monitor mode
const LocalClipRecorder = require('./monitoring/local-clip-recorder');
const fs = require('fs');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = 'https://zoripeohnedivxkvrpbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmlwZW9obmVkaXZ4a3ZycGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODMyMDIsImV4cCI6MjA4NDA1OTIwMn0.I24w1VjEWUNf2jCBnPo4-ypu3aq5rATJldbLgSSt9mo';

const store = new Store();
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize AwayManager
const awayManager = new AwayManager({ supabase });

// Initialize MonitoringManager
const monitoringManager = new MonitoringManager({ supabase });

// Sound detection removed (v2.14.0) - replaced by Baby Monitor mode

// Clips folder path (initialized on startup)
let clipsPath = null;

// Subscriptions
let commandsSubscription = null;
let rtcSessionsSubscription = null;
let deviceStatusSubscription = null;

// Live View state
let liveViewState = {
  isActive: false,
  currentSessionId: null,
  isCleaningUp: false,  // CRITICAL: Track renderer cleanup state
  offerSentForSessionId: null, // Only set once renderer actually sent offer
};

// IPC events from renderer (used to correctly ACK/FAIL DB commands)
const rtcIpcEvents = new EventEmitter();

// Monitoring IPC events from renderer (used to ACK/FAIL monitoring commands)
const monitoringIpcEvents = new EventEmitter();

// Heartbeat interval
let heartbeatInterval = null;

// Local model server for YAMNet (sound detection)
let localModelServer = null;
let localModelPort = 0;

// Auto-Away guard (prevents infinite retries)
let autoAwayAttempts = 0;
const MAX_AUTO_AWAY_ATTEMPTS = 3;

// Language (default 'he', loaded from store in initDevice)
let currentLanguage = 'he';

// =============================================================================
// PROCESS SIGNAL HANDLERS (CMD window close safety)
// =============================================================================

// Handle SIGINT/SIGTERM for when CMD is closed or Ctrl+C is pressed
const handleProcessExit = async (signal) => {
  console.log(`[App] Received ${signal} - attempting emergency hardware cleanup...`);
  
  try {
    // Try to release camera hardware
    if (mainWindow && !mainWindow.isDestroyed?.()) {
      mainWindow.webContents?.send('stop-live-view');
      // Give renderer a brief moment to process
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    console.warn('[App] Emergency cleanup failed:', e?.message);
  }
  
  process.exit(0);
};

process.on('SIGINT', () => handleProcessExit('SIGINT'));
process.on('SIGTERM', () => handleProcessExit('SIGTERM'));

// Windows-specific: handle console window close
if (process.platform === 'win32') {
  process.on('SIGHUP', () => handleProcessExit('SIGHUP'));
}

// =============================================================================
// WebRTC HARDWARE CLEANUP (Quit safety)
// =============================================================================

async function stopWebRtcRendererOnQuit({ timeoutMs = 2500 } = {}) {
  try {
    if (!mainWindow || mainWindow.isDestroyed?.()) return;

    console.log('[App] Quit cleanup: requesting renderer to stop WebRTC (camera release)');

    // Wait for renderer to confirm cleanup-complete (best effort)
    const waitForCleanup = new Promise((resolve) => {
      let resolved = false;

      const onCleanupComplete = () => {
        if (resolved) return;
        resolved = true;
        try {
          ipcMain.removeListener('webrtc-cleanup-complete', onCleanupComplete);
        } catch (_) {
          // noop
        }
        resolve(true);
      };

      ipcMain.on('webrtc-cleanup-complete', onCleanupComplete);

      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        try {
          ipcMain.removeListener('webrtc-cleanup-complete', onCleanupComplete);
        } catch (_) {
          // noop
        }
        console.log('[App] Quit cleanup: renderer did not confirm cleanup in time (continuing)');
        resolve(false);
      }, timeoutMs);
    });

    // Trigger STOP (even if not active — harmless)
    try {
      mainWindow.webContents?.send('stop-live-view');
    } catch (e) {
      console.warn('[App] Quit cleanup: failed to send stop-live-view:', e?.message || e);
    }

    await waitForCleanup;
  } catch (e) {
    console.warn('[App] Quit cleanup: unexpected error:', e?.message || e);
  }
}

// =============================================================================
// I18N STRINGS
// =============================================================================

const STRINGS = {
  en: {
    awayModeEnabled: 'Away Mode activated - Camera ready',
    awayModeDisabled: 'Away Mode deactivated',
    awayModePreflightFailed: 'Cannot activate Away Mode',
    userReturnedTitle: 'Welcome Back',
    userReturnedMessage: 'You have returned. Would you like to disable Away Mode?',
    disableButton: 'Disable Away Mode',
    keepButton: 'Keep Away Mode',
    powerRequired: 'Please connect to power source',
    cameraRequired: 'Camera not available',
    trayTooltip: 'Security Camera',
    trayStatusLive: '[LIVE] LIVE',
    trayStatusIdle: '[IDLE] Idle',
    trayStatusAway: '[HOME] AWAY',
    trayStatusNormal: '[LOC] NORMAL',
    showWindow: 'Show Window',
    quit: 'Quit'
  },
  he: {
    awayModeEnabled: 'מצב מרוחק הופעל - המצלמה מוכנה',
    awayModeDisabled: 'מצב מרוחק כובה',
    awayModePreflightFailed: 'לא ניתן להפעיל מצב מרוחק',
    userReturnedTitle: 'ברוך שובך',
    userReturnedMessage: 'חזרת הביתה. האם לכבות את מצב מרוחק?',
    disableButton: 'כבה מצב מרוחק',
    keepButton: 'השאר מצב מרוחק',
    powerRequired: 'יש לחבר למקור חשמל',
    cameraRequired: 'המצלמה לא זמינה',
    trayTooltip: 'מצלמת אבטחה',
    trayStatusLive: '[LIVE] שידור',
    trayStatusIdle: '[IDLE] המתנה',
    trayStatusAway: '[HOME] מרוחק',
    trayStatusNormal: '[LOC] רגיל',
    showWindow: 'הצג חלון',
    quit: 'יציאה'
  }
};

function t(key) {
  return STRINGS[currentLanguage]?.[key] || STRINGS['en'][key] || key;
}

// =============================================================================
// LOCAL MODEL SERVER (serves YAMNet files for sound detection)
// =============================================================================

function startLocalModelServer() {
  return new Promise((resolve) => {
    const modelsDir = path.join(__dirname, 'monitoring', 'models');
    
    if (!fs.existsSync(modelsDir)) {
      console.warn('[ModelServer] Models directory not found:', modelsDir);
      resolve(0);
      return;
    }

    const MIME_TYPES = {
      '.json': 'application/json',
      '.bin': 'application/octet-stream',
    };

    localModelServer = http.createServer((req, res) => {
      // CORS headers for renderer
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      
      const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
      const filePath = path.join(modelsDir, safePath);
      
      // Security: ensure file is within modelsDir
      if (!filePath.startsWith(modelsDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(filePath)) {
        console.warn(`[ModelServer] 404: ${req.url}`);
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath);
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': stat.size,
      });
      fs.createReadStream(filePath).pipe(res);
    });

    localModelServer.listen(0, '127.0.0.1', () => {
      localModelPort = localModelServer.address().port;
      console.log(`[ModelServer] [OK] Serving models on http://127.0.0.1:${localModelPort}/`);
      resolve(localModelPort);
    });

    localModelServer.on('error', (err) => {
      console.error('[ModelServer] Failed to start:', err);
      resolve(0);
    });
  });
}

// =============================================================================
// WINDOW CREATION
// =============================================================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // CRITICAL: Keep monitoring/detection running while window is hidden/minimized to Tray.
      backgroundThrottling: false
    },
    icon: getIconPath()
  });

  mainWindow.loadFile('index.html');
  
  // CRITICAL FIX: Set main window reference in AwayManager
  awayManager.setMainWindow(mainWindow);

  // Intercept close to hide to tray
  mainWindow.on('close', (event) => {
    if (trayAvailable && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Handle minimize
  mainWindow.on('minimize', (event) => {
    if (trayAvailable) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Detect user return (for Away Mode)
  mainWindow.on('focus', () => {
    awayManager.handleUserReturned();
  });
}

// =============================================================================
// TRAY SETUP
// =============================================================================

// Cached nativeImage for tray – set ONCE in initTray, never changed at runtime.
let _cachedTrayIcon = null;

// Throttle state for updateTrayMenu – prevents rapid rebuilds that cause
// the Windows tray icon to flash black.
let _lastTrayMenuHash = '';
let _lastTrayMenuTime = 0;
const TRAY_UPDATE_MIN_INTERVAL_MS = 1500; // minimum 1.5s between updates

// App start timestamp for diagnostics
const _appStartTime = Date.now();

// Self-echo guard: when the agent itself writes to device_status, the Realtime
// subscription fires back with the same data. We suppress those echoes to prevent
// cascading updates (which cause rapid tray rebuilds → black icon on Windows).
let _selfWriteTimestamp = 0;
const SELF_ECHO_GUARD_MS = 3000; // ignore Realtime echoes within 3s of our own write

function getIconPath() {
  // On Windows, strongly prefer ICO (with proper multi-size + alpha).
  // PNG tray icons on Windows often render as a black square.
  const isWin = process.platform === 'win32';

  // Search order: ico first on Windows, then png, including tray-icon.png variants
  const possiblePaths = isWin
    ? [
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'assets', 'icon.ico'),
        path.join(__dirname, 'build', 'icon.ico'),
        // PNG fallbacks (Windows may render these as black squares)
        path.join(__dirname, 'tray-icon.png'),
        path.join(__dirname, 'icon.png'),
        path.join(__dirname, 'assets', 'tray-icon.png'),
        path.join(__dirname, 'assets', 'icon.png'),
        path.join(__dirname, 'build', 'icon.png'),
      ]
    : [
        path.join(__dirname, 'tray-icon.png'),
        path.join(__dirname, 'icon.png'),
        path.join(__dirname, 'assets', 'tray-icon.png'),
        path.join(__dirname, 'assets', 'icon.png'),
        path.join(__dirname, 'build', 'icon.png'),
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'assets', 'icon.ico'),
        path.join(__dirname, 'build', 'icon.ico'),
      ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      console.log('[Tray] Icon found:', iconPath);
      return iconPath;
    }
  }

  console.warn('[Tray] No icon file found in any expected location');
  return null;
}

/**
 * Create a validated nativeImage for the tray.
 * Returns null if the image is empty or corrupt.
 */
function createValidatedTrayIcon(iconPath) {
  if (!iconPath) return null;

  try {
    const icon = nativeImage.createFromPath(iconPath);

    if (icon.isEmpty()) {
      console.error('[Tray] ICON_VALIDATION_FAIL: nativeImage is empty for path:', iconPath);
      return null;
    }

    const size = icon.getSize();
    console.log(`[Tray] Icon loaded: ${iconPath} (${size.width}x${size.height})`);

    // On Windows, ICO files already contain multi-size – don't resize.
    // For PNG, resize to 16x16 for the tray.
    if (iconPath.endsWith('.ico')) {
      return icon;
    }

    const resized = icon.resize({ width: 16, height: 16 });
    if (resized.isEmpty()) {
      console.error('[Tray] ICON_VALIDATION_FAIL: resized icon is empty');
      return null;
    }

    return resized;
  } catch (err) {
    console.error('[Tray] ICON_VALIDATION_FAIL: Error loading icon:', err);
    return null;
  }
}

function initTray() {
  try {
    const iconPath = getIconPath();
    
    // DIAGNOSTIC: Log icon file details
    if (iconPath) {
      try {
        const stats = fs.statSync(iconPath);
        console.log(`[Tray:Diag] Icon file: ${iconPath}`);
        console.log(`[Tray:Diag] File size: ${stats.size} bytes`);
        console.log(`[Tray:Diag] File extension: ${path.extname(iconPath)}`);
        console.log(`[Tray:Diag] Platform: ${process.platform}`);
      } catch (statErr) {
        console.error('[Tray:Diag] Cannot stat icon file:', statErr.message);
      }
    } else {
      console.error('[Tray:Diag] No icon path found at all!');
    }

    let icon = createValidatedTrayIcon(iconPath);

    // FALLBACK: If no icon file found or validation failed, create a programmatic icon
    // This prevents the tray from not being created at all or showing a black square
    if (!icon) {
      console.warn('[Tray] No valid icon file found – creating programmatic fallback icon');
      try {
        // Create a simple 16x16 blue circle icon as fallback
        const size = 16;
        const canvas = Buffer.alloc(size * size * 4); // RGBA
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const cx = x - size / 2 + 0.5;
            const cy = y - size / 2 + 0.5;
            const dist = Math.sqrt(cx * cx + cy * cy);
            const idx = (y * size + x) * 4;
            if (dist < size / 2 - 1) {
              canvas[idx] = 66;     // R
              canvas[idx + 1] = 133; // G
              canvas[idx + 2] = 244; // B
              canvas[idx + 3] = 255; // A
            } else if (dist < size / 2) {
              const alpha = Math.max(0, Math.min(255, Math.round((size / 2 - dist) * 255)));
              canvas[idx] = 66;
              canvas[idx + 1] = 133;
              canvas[idx + 2] = 244;
              canvas[idx + 3] = alpha;
            } else {
              canvas[idx] = 0;
              canvas[idx + 1] = 0;
              canvas[idx + 2] = 0;
              canvas[idx + 3] = 0;
            }
          }
        }
        icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
        if (icon.isEmpty()) {
          console.error('[Tray] Programmatic fallback icon is also empty!');
          return;
        }
        console.log('[Tray] [OK] Programmatic fallback icon created (16x16 blue circle)');
      } catch (fallbackErr) {
        console.error('[Tray] Failed to create fallback icon:', fallbackErr);
        return;
      }
    }

    // DIAGNOSTIC: Log icon bitmap details
    const bitmapSize = icon.getSize();
    console.log(`[Tray:Diag] nativeImage size: ${bitmapSize.width}x${bitmapSize.height}`);
    console.log(`[Tray:Diag] nativeImage isEmpty: ${icon.isEmpty()}`);
    const bmp = icon.toBitmap();
    console.log(`[Tray:Diag] Bitmap buffer length: ${bmp.length} bytes`);
    // Check if bitmap is all zeros (= fully transparent/black)
    let nonZeroCount = 0;
    for (let i = 0; i < Math.min(bmp.length, 1024); i++) {
      if (bmp[i] !== 0) nonZeroCount++;
    }
    console.log(`[Tray:Diag] Non-zero bytes in first 1024: ${nonZeroCount} (0 = fully black/transparent)`);

    // Resize to 16x16 for Windows system tray
    let trayIcon = icon.resize({ width: 16, height: 16 });
    console.log(`[Tray:Diag] Resized icon to 16x16, isEmpty: ${trayIcon.isEmpty()}`);
    
    // Check resized bitmap quality
    const resizedBmp = trayIcon.toBitmap();
    let resizedNonZero = 0;
    for (let i = 0; i < resizedBmp.length; i++) {
      if (resizedBmp[i] !== 0) resizedNonZero++;
    }
    console.log(`[Tray:Diag] Resized bitmap: ${resizedBmp.length} bytes, non-zero: ${resizedNonZero}`);

    // CRITICAL FIX v2.8.4: If resized icon has too few non-zero bytes,
    // the .ico is rendering as black. Use programmatic icon instead.
    const MIN_NONZERO_THRESHOLD = 100; // 16x16 RGBA = 1024 bytes, need at least ~10%
    if (resizedNonZero < MIN_NONZERO_THRESHOLD) {
      console.warn(`[Tray] Resized icon is nearly black (${resizedNonZero} non-zero bytes). Switching to programmatic icon.`);
      const size = 16;
      const canvas = Buffer.alloc(size * size * 4);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const cx = x - size / 2 + 0.5;
          const cy = y - size / 2 + 0.5;
          const dist = Math.sqrt(cx * cx + cy * cy);
          const idx = (y * size + x) * 4;
          if (dist < size / 2 - 1) {
            canvas[idx] = 66;     // R
            canvas[idx + 1] = 133; // G
            canvas[idx + 2] = 244; // B
            canvas[idx + 3] = 255; // A
          } else {
            canvas[idx + 3] = 0; // transparent
          }
        }
      }
      trayIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
      console.log(`[Tray] Programmatic fallback icon created (16x16 blue circle)`);
    }

    // Cache the working icon for safety
    _cachedTrayIcon = trayIcon;

    tray = new Tray(trayIcon);
    tray.setToolTip(t('trayTooltip'));
    updateTrayMenu('initTray');
    trayAvailable = true;

    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    console.log('[Tray] [OK] Initialized successfully (icon validated)');
    
    // DIAGNOSTIC: Start periodic tray health monitor
    startTrayHealthMonitor();
    
  } catch (error) {
    console.error('[Tray] Failed to initialize:', error);
    trayAvailable = false;
  }
}

/**
 * TRAY HEALTH MONITOR
 * Logs tray state every 30 seconds so we can see WHEN the icon goes black.
 * Also logs the total number of updateTrayMenu calls and setContextMenu calls.
 */
let _trayHealthInterval = null;
let _setContextMenuCallCount = 0;

function startTrayHealthMonitor() {
  if (_trayHealthInterval) return;
  
  _trayHealthInterval = setInterval(() => {
    if (!tray || tray.isDestroyed?.()) {
      console.log('[Tray:Health] Tray is destroyed or null!');
      return;
    }
    
    const uptime = Math.round((Date.now() - _appStartTime) / 1000);
    const bounds = tray.getBounds?.() || { x: 0, y: 0, width: 0, height: 0 };
    
    console.log(`[Tray:Health] uptime=${uptime}s | menuUpdates=${_trayUpdateCounter} | setContextMenu=${_setContextMenuCallCount} | bounds=${JSON.stringify(bounds)} | hash=${_lastTrayMenuHash}`);
    
    // AUTO-RECOVERY: If bounds width/height is 0, tray icon is gone
    if (bounds.width === 0 && bounds.height === 0 && _cachedTrayIcon) {
      console.log('[Tray:Health] WARNING: Tray bounds are 0x0, attempting recovery...');
      try {
        tray.setImage(_cachedTrayIcon);
        console.log('[Tray:Health] Recovery: setImage applied');
      } catch (e) {
        console.error('[Tray:Health] Recovery failed:', e.message);
      }
    }
  }, 30000); // every 30 seconds
}

// Global tray-update counter for diagnostics
let _trayUpdateCounter = 0;

function updateTrayMenu(caller = 'unknown') {
  if (!tray) return;

  const now = Date.now();
  const liveStatus = liveViewState.isActive ? t('trayStatusLive') : t('trayStatusIdle');
  const awayStatus = awayManager.getTrayStatus();
  const modeStatus = awayStatus.statusText;

  // Build a hash of the menu content – skip rebuild if nothing changed
  const menuHash = `${liveStatus}|${modeStatus}|${currentLanguage}`;

  // CRITICAL FIX: If content hasn't changed, NEVER rebuild.
  // On Windows, every tray.setContextMenu() call can corrupt the PNG icon
  // and cause the "black tray icon" bug after ~45 seconds.
  if (menuHash === _lastTrayMenuHash) {
    return;
  }

  // Throttle: even if content changed, don't rebuild faster than the interval
  if (now - _lastTrayMenuTime < TRAY_UPDATE_MIN_INTERVAL_MS) {
    // Schedule a deferred update so the change isn't lost
    if (!updateTrayMenu._deferred) {
      updateTrayMenu._deferred = setTimeout(() => {
        updateTrayMenu._deferred = null;
        updateTrayMenu(caller + '-deferred');
      }, TRAY_UPDATE_MIN_INTERVAL_MS);
    }
    return;
  }

  _trayUpdateCounter++;
  _lastTrayMenuHash = menuHash;
  _lastTrayMenuTime = now;

  console.log(`[Tray] #${_trayUpdateCounter} updateTrayMenu by: ${caller} | hash: ${menuHash} | uptime: ${Math.round((now - _appStartTime) / 1000)}s`);

  const contextMenu = Menu.buildFromTemplate([
    { label: `${liveStatus} | ${modeStatus}`, enabled: false },
    { type: 'separator' },
    { label: t('showWindow'), click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: t('quit'), click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  _setContextMenuCallCount++;
  tray.setContextMenu(contextMenu);
  tray.setToolTip(`${t('trayTooltip')} - ${liveStatus}`);
  console.log(`[Tray:Diag] setContextMenu call #${_setContextMenuCallCount} completed`);

  // REMOVED: tray.setImage() after setContextMenu.
  // The icon is set ONCE in initTray() and never touched again at runtime.
  // Calling setImage during context menu rebuilds was causing the Windows
  // tray icon to flash black.
}

// =============================================================================
// DEVICE REGISTRATION & HEARTBEAT
// =============================================================================

async function initDevice() {
  // Check for stored device ID
  deviceId = store.get('deviceId');
  profileId = store.get('profileId');
  currentLanguage = store.get('language') || 'he';
  
  // Initialize AwayManager with device info
  if (deviceId) {
    awayManager.setDeviceId(deviceId);
    awayManager.setLanguage(currentLanguage);
  }

  if (deviceId && profileId) {
    console.log('[Device] Using stored device:', deviceId);
    startHeartbeat();

    // Fetch device_auth_token for monitoring events API
    await fetchAndSetDeviceAuthToken();

    // AUTO-AWAY on startup (uses profile.auto_away_enabled)
    scheduleAutoAwayCheck('startup-stored-session');
    return;
  }

  // Device will be registered after pairing
  console.log('[Device] No stored device, waiting for pairing...');
}

/**
 * Fetch device_auth_token from DB and set it on MonitoringManager
 */
async function fetchAndSetDeviceAuthToken() {
  if (!deviceId) {
    console.log('[DeviceToken] No deviceId, skipping token fetch');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('devices')
      .select('device_auth_token')
      .eq('id', deviceId)
      .single();

    if (error) {
      console.error('[DeviceToken] Failed to fetch token:', error);
      return;
    }

    if (data?.device_auth_token) {
      monitoringManager.setDeviceAuthToken(data.device_auth_token);
      console.log('[DeviceToken] [OK] Device auth token set for monitoring');
    } else {
      console.warn('[DeviceToken] No device_auth_token found in DB - events will not be reported');
    }
  } catch (err) {
    console.error('[DeviceToken] Unexpected error:', err);
  }
}

// =============================================================================
// AUTO-AWAY (on startup / after pairing)
// =============================================================================

function scheduleAutoAwayCheck(reason, delayMs = 1500) {
  if (!profileId || !deviceId) {
    console.log('[AutoAway] Not scheduled - missing ids.', {
      reason,
      deviceId,
      profileId,
      autoAwayAttempts,
    });
    return;
  }
  if (autoAwayAttempts >= MAX_AUTO_AWAY_ATTEMPTS) {
    console.log('[AutoAway] Max attempts reached - skipping. Reason:', reason);
    return;
  }

  console.log(`[AutoAway] Scheduling auto-away check in ${delayMs}ms. Reason: ${reason}`);
  setTimeout(() => {
    maybeEnableAutoAway(reason).catch((e) => {
      console.error('[AutoAway] Unexpected error:', e);
    });
  }, delayMs);
}

async function maybeEnableAutoAway(reason) {
  if (!profileId || !deviceId) {
    console.log('[AutoAway] Aborting enable - missing ids.', { reason, deviceId, profileId });
    return;
  }
  if (autoAwayAttempts >= MAX_AUTO_AWAY_ATTEMPTS) return;

  autoAwayAttempts += 1;

  console.log('[AutoAway] Checking auto_away_enabled via RPC...', {
    reason,
    attempt: autoAwayAttempts,
    profileId,
    deviceId,
  });

  // Use SECURITY DEFINER RPC to avoid RLS issues with the profiles table
  const { data, error } = await supabase.rpc('get_profile_auto_away', {
    _profile_id: profileId,
  });

  if (error) {
    console.error('[AutoAway] RPC error:', error);
    scheduleAutoAwayCheck(`${reason}-retry-fetch`, 2000);
    return;
  }

  // The RPC returns a single row with { profile_exists, auto_away_enabled }
  const row = Array.isArray(data) ? data[0] : data;

  if (!row || !row.profile_exists) {
    console.log('[AutoAway] Profile not found for id:', profileId);
    return;
  }

  if (row.auto_away_enabled !== true) {
    console.log('[AutoAway] Disabled in profile (auto_away_enabled=false).');
    return;
  }

  console.log('[AutoAway] Enabled in profile -> enabling Away Mode (skipDisplayOff=true)');
  const result = await awayManager.enable({ skipDisplayOff: true });

  if (!result.success) {
    console.error('[AutoAway] awayManager.enable failed:', result.error);
    scheduleAutoAwayCheck(`${reason}-retry-enable`, 2000);
    return;
  }

  console.log('[AutoAway] [OK] Away Mode enabled successfully (Auto-Away)');
}

function startHeartbeat() {
  if (!deviceId) return;

  // Initial heartbeat
  sendHeartbeat();

  // Heartbeat every 10 seconds
  heartbeatInterval = setInterval(sendHeartbeat, 10000);
}

async function sendHeartbeat() {
  if (!deviceId) return;

  try {
    const { error } = await supabase
      .from('devices')
      .update({
        last_seen_at: new Date().toISOString(),
        is_active: true
      })
      .eq('id', deviceId);

    if (error) {
      console.error('[Heartbeat] Error:', error);
    }
  } catch (err) {
    console.error('[Heartbeat] Failed:', err);
  }
}

// =============================================================================
// PAIRING
// =============================================================================

async function verifyPairingCode(code) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-pairing-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    if (data.success && data.device_id) {
      deviceId = data.device_id;
      profileId = data.profile_id;

      // Store for future use
      store.set('deviceId', deviceId);
      store.set('profileId', profileId);

      console.log('[Pairing] Success! Device ID:', deviceId);

      // Start services
      startHeartbeat();
      subscribeToCommands();
      subscribeToRtcSessions();
      subscribeToDeviceStatus();
      
      // Initialize AwayManager with device info
      awayManager.setDeviceId(deviceId);
      awayManager.setLanguage(currentLanguage);

      // Fetch device_auth_token for monitoring events API
      await fetchAndSetDeviceAuthToken();

      // AUTO-AWAY immediately after pairing
      scheduleAutoAwayCheck('pairing-success');

      return { success: true, deviceId };
    }

    return { success: false, error: data.error || 'Pairing failed' };
  } catch (error) {
    console.error('[Pairing] Error:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// COMMANDS SUBSCRIPTION
// =============================================================================

function subscribeToCommands(retryCount = 0) {
  if (!deviceId) {
    console.error('[Commands] [FAIL] Cannot subscribe - no deviceId!');
    return;
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  // Close existing subscription if any
  if (commandsSubscription) {
    console.log('[Commands] Closing existing subscription before re-subscribing');
    try {
      supabase.removeChannel(commandsSubscription);
    } catch (e) {
      console.log('[Commands] Error removing channel:', e.message);
    }
    commandsSubscription = null;
  }

  console.log('[Commands] ===================================================');
  console.log('[Commands] Subscribing for device:', deviceId);
  console.log('[Commands] Attempt:', retryCount + 1, 'of', MAX_RETRIES + 1);
  console.log('[Commands] ===================================================');

  const channelName = `commands-${deviceId}-${Date.now()}`;
  
  commandsSubscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'commands',
        filter: `device_id=eq.${deviceId}`
      },
      (payload) => {
        console.log('[Commands] ===================================================');
        console.log('[Commands] [ALERT] NEW COMMAND RECEIVED:', payload.new?.command);
        console.log('[Commands] Command ID:', payload.new?.id);
        console.log('[Commands] ===================================================');
        handleCommand(payload.new);
      }
    )
    .subscribe((status, err) => {
      console.log('[Commands] Subscription status:', status, err ? `Error: ${err}` : '');
      
      if (status === 'SUBSCRIBED') {
        console.log('[Commands] [OK] Successfully subscribed to commands for device:', deviceId);
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.error('[Commands] [FAIL] Subscription failed:', status);
        
        if (retryCount < MAX_RETRIES) {
          console.log(`[Commands] Retrying in ${RETRY_DELAY}ms...`);
          setTimeout(() => {
            subscribeToCommands(retryCount + 1);
          }, RETRY_DELAY);
        } else {
          console.error('[Commands] [FAIL] Max retries reached. Using polling fallback.');
          startCommandPolling();
        }
      }
    });

  console.log('[Commands] Subscription initiated, waiting for SUBSCRIBED status...');
}

function waitForMonitoringStartAck({ timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      try {
        monitoringIpcEvents.off('started', onStarted);
        monitoringIpcEvents.off('error', onError);
      } catch (_) {
        // noop
      }
    };

    const onStarted = (status) => {
      cleanup();
      resolve(status || { motion: false, sound: false });
    };

    const onError = (err) => {
      cleanup();
      reject(new Error(err || 'Monitoring start failed'));
    };

    monitoringIpcEvents.on('started', onStarted);
    monitoringIpcEvents.on('error', onError);

    setTimeout(() => {
      if (done) return;
      cleanup();
      // Ensure MonitoringManager is not stuck in "starting" state.
      try {
        monitoringManager.onRendererError?.('timeout');
      } catch (_) {
        // noop
      }
      reject(new Error('Monitoring start timeout'));
    }, timeoutMs);
  });
}

async function handleCommand(command) {
  const { id, command: cmd } = command;

  console.log(`[Commands] Processing: ${cmd}`);

  try {
    switch (cmd) {
      case 'START_LIVE_VIEW':
        await handleStartLiveView();
        break;

      case 'STOP_LIVE_VIEW':
        await handleStopLiveView();
        break;

      case 'SET_DEVICE_MODE:AWAY':
        console.log('[Commands] Processing AWAY mode command');
        const awayResult = await awayManager.enable();
        if (!awayResult.success) {
          console.error('[Commands] [FAIL] AWAY mode enable failed:', awayResult.error);
          // Revert database state
          _selfWriteTimestamp = Date.now();
          await supabase
            .from('device_status')
            .update({ device_mode: 'NORMAL' })
            .eq('device_id', deviceId);
          // CRITICAL FIX: Throw error so command is marked as 'failed' with error message
          // This allows the mobile UI to show the actual error to the user
          throw new Error(awayResult.error || 'Away Mode preflight failed');
        }
        break;

      case 'SET_DEVICE_MODE:NORMAL':
        console.log('[Commands] Processing NORMAL mode command');
        
        // CRITICAL FIX: Stop monitoring/camera FIRST before disabling Away Mode
        // This ensures the camera LED turns off when switching to NORMAL mode
        if (monitoringManager.isMonitoringActive()) {
          console.log('[Commands] Stopping monitoring as part of NORMAL mode transition...');
          const monitoringStopResult = await monitoringManager.disable();
          if (!monitoringStopResult.success) {
            console.warn('[Commands] Warning: Monitoring disable failed:', monitoringStopResult.error);
            // Continue anyway - we still want to disable Away Mode
          }
        }
        
        // IMPORTANT: disable() returns { success, error } and may fail silently if not checked.
        // If we don't check it, the mobile UI can show a green "ack" even though AWAY wasn't actually disabled.
        const normalResult = await awayManager.disable();

        if (normalResult && normalResult.success === false) {
          console.error('[Commands] [FAIL] NORMAL mode disable failed:', normalResult.error);
          // Throw so the command is marked as failed with a meaningful message.
          throw new Error(normalResult.error || 'Away Mode disable failed');
        }

        // SSOT HARDENING: Ensure DB reflects NORMAL even if AwayManager had no deviceId
        // or its internal DB update did not run for any reason.
        if (!deviceId) {
          throw new Error('Missing deviceId while disabling Away Mode');
        }

        _selfWriteTimestamp = Date.now();
        const { error: normalDbError } = await supabase
          .from('device_status')
          .update({
            device_mode: 'NORMAL',
            security_enabled: false,  // CRITICAL: Also disable security in DB
            is_armed: false,          // CRITICAL: Disarm in DB
            updated_at: new Date().toISOString(),
          })
          .eq('device_id', deviceId);

        if (normalDbError) {
          console.error('[Commands] [FAIL] Failed to update device_status to NORMAL:', normalDbError);
          throw new Error(normalDbError.message || 'Failed to update device status');
        }
        console.log('[Commands] [OK] NORMAL mode set (monitoring stopped, camera released)');
        break;

      case 'SET_MONITORING:ON':
        console.log('[Commands] ===================================================');
        console.log('[Commands] Processing SET_MONITORING:ON command');
        console.log('[Commands] ===================================================');
        try {
          console.log('[Commands] Calling monitoringManager.enable()...');
          const monitoringResult = await monitoringManager.enable();
          console.log('[Commands] monitoringManager.enable() result:', monitoringResult);
          if (!monitoringResult.success) {
            console.error('[Commands] [FAIL] Monitoring enable failed:', monitoringResult.error);
            throw new Error(monitoringResult.error || 'Monitoring enable failed');
          }

          // CRITICAL (SSOT): Only mark camera active after renderer confirms getUserMedia succeeded.
          // CRITICAL FIX: Increased timeout from 15s to 60s for slow camera/MediaPipe init
          console.log('[Commands] Waiting for renderer ACK (timeout: 60s)...');
          const startedStatus = await waitForMonitoringStartAck({ timeoutMs: 60000 });
          console.log('[Commands] Renderer ACK received:', startedStatus);

          if (!deviceId) {
            throw new Error('Missing deviceId while enabling monitoring');
          }

          const nowIso = new Date().toISOString();
          _selfWriteTimestamp = Date.now();
          const { error: statusError } = await supabase
            .from('device_status')
            .update({
              security_enabled: true,
              motion_enabled: startedStatus?.motion ?? true,
              sound_enabled: startedStatus?.sound ?? false,
              updated_at: nowIso,
            })
            .eq('device_id', deviceId);

          if (statusError) {
            console.error('[Commands] [FAIL] Failed to update device_status after monitoring-started:', statusError);
            throw new Error(statusError.message || 'Failed to update device status');
          }

          console.log('[Commands] [OK] Monitoring enabled (renderer ACK received)');
        } catch (e) {
          // Ensure DB reflects reality: if monitoring didn't start, it is NOT armed.
          if (deviceId) {
            try {
              _selfWriteTimestamp = Date.now();
              await supabase
                .from('device_status')
                .update({
                  security_enabled: false,
                  is_armed: false,
                  updated_at: new Date().toISOString(),
                })
                .eq('device_id', deviceId);
            } catch (_) {
              // noop
            }
          }
          throw e;
        }
        break;

      case 'SET_MONITORING:OFF':
        console.log('[Commands] Processing SET_MONITORING:OFF command');
        _selfWriteTimestamp = Date.now(); // MonitoringManager.disable() writes to device_status
        const stopResult = await monitoringManager.disable();
        if (!stopResult.success) {
          console.error('[Commands] [FAIL] Monitoring disable failed:', stopResult.error);
          throw new Error(stopResult.error || 'Monitoring disable failed');
        }
        console.log('[Commands] [OK] Monitoring disabled');
        break;

      // Sound detection removed (v2.14.0) - replaced by Baby Monitor mode



      default:
        console.log(`[Commands] Unknown command: ${cmd}`);
    }

    // Acknowledge command
    await supabase
      .from('commands')
      .update({
        handled: true,
        handled_at: new Date().toISOString(),
        status: 'completed'
      })
      .eq('id', id);

  } catch (error) {
    console.error(`[Commands] Error handling ${cmd}:`, error);

    // Mark as failed
    await supabase
      .from('commands')
      .update({
        handled: true,
        handled_at: new Date().toISOString(),
        status: 'failed',
        error_message: error.message
      })
      .eq('id', id);
  }
}

// =============================================================================
// POLLING FALLBACK (When Realtime fails)
// =============================================================================

let commandPollingInterval = null;
let rtcPollingInterval = null;
let lastProcessedCommandId = null;

function startCommandPolling() {
  if (commandPollingInterval) {
    clearInterval(commandPollingInterval);
  }
  
  console.log('[Commands] Starting polling fallback (every 3s)...');
  
  commandPollingInterval = setInterval(async () => {
    if (!deviceId) return;
    
    try {
      const { data: commands } = await supabase
        .from('commands')
        .select('*')
        .eq('device_id', deviceId)
        .eq('handled', false)
        .order('created_at', { ascending: true })
        .limit(5);
      
      if (commands && commands.length > 0) {
        for (const cmd of commands) {
          if (cmd.id !== lastProcessedCommandId) {
            console.log('[Commands-Poll] [ALERT] Found new command:', cmd.command);
            lastProcessedCommandId = cmd.id;
            handleCommand(cmd);
          }
        }
      }
    } catch (err) {
      console.error('[Commands-Poll] Error:', err.message);
    }
  }, 3000);
}

function startRtcPolling() {
  if (rtcPollingInterval) {
    clearInterval(rtcPollingInterval);
  }
  
  console.log('[RTC] Starting polling fallback (every 3s)...');
  
  rtcPollingInterval = setInterval(async () => {
    if (!deviceId) return;
    
    // CRITICAL FIX: Don't skip polling if active - let handleNewRtcSession decide
    // This allows detecting new sessions even during active streaming
    
    try {
      const { data: sessions } = await supabase
        .from('rtc_sessions')
        .select('*')
        .eq('device_id', deviceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (sessions && sessions.length > 0) {
        // Only log if it's a new session we haven't started
        if (sessions[0].id !== liveViewState.currentSessionId) {
          console.log('[RTC-Poll] [ALERT] Found pending session:', sessions[0].id);
          handleNewRtcSession(sessions[0]);
        }
      }
    } catch (err) {
      console.error('[RTC-Poll] Error:', err.message);
    }
  }, 3000);
}

// =============================================================================
// RTC SESSIONS SUBSCRIPTION
// =============================================================================

function subscribeToRtcSessions(retryCount = 0) {
  if (!deviceId) {
    console.error('[RTC] [FAIL] Cannot subscribe - no deviceId!');
    return;
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000;

  // Close existing subscription if any
  if (rtcSessionsSubscription) {
    console.log('[RTC] Closing existing subscription before re-subscribing');
    try {
      supabase.removeChannel(rtcSessionsSubscription);
    } catch (e) {
      console.log('[RTC] Error removing channel:', e.message);
    }
    rtcSessionsSubscription = null;
  }

  console.log('[RTC] ===================================================');
  console.log('[RTC] Subscribing to rtc_sessions for device:', deviceId);
  console.log('[RTC] Attempt:', retryCount + 1, 'of', MAX_RETRIES + 1);
  console.log('[RTC] ===================================================');

  const channelName = `rtc-${deviceId}-${Date.now()}`;

  rtcSessionsSubscription = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_sessions',
        filter: `device_id=eq.${deviceId}`
      },
      (payload) => {
        console.log('[RTC] ===================================================');
        console.log('[RTC] [ALERT] NEW RTC SESSION:', payload.new?.id);
        console.log('[RTC] Status:', payload.new?.status);
        console.log('[RTC] ===================================================');
        if (payload.new.status === 'pending') {
          handleNewRtcSession(payload.new);
        }
      }
    )
    .subscribe((status, err) => {
      console.log('[RTC] Subscription status:', status, err ? `Error: ${err}` : '');
      
      if (status === 'SUBSCRIBED') {
        console.log('[RTC] [OK] Successfully subscribed to RTC sessions');
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.error('[RTC] [FAIL] Subscription failed:', status);
        
        if (retryCount < MAX_RETRIES) {
          console.log(`[RTC] Retrying in ${RETRY_DELAY}ms...`);
          setTimeout(() => {
            subscribeToRtcSessions(retryCount + 1);
          }, RETRY_DELAY);
        } else {
          console.error('[RTC] [FAIL] Max retries reached. Using polling fallback.');
          startRtcPolling();
        }
      }
    });

  console.log('[RTC] Subscription initiated...');
}

function handleNewRtcSession(session) {
  // CRITICAL FIX: Prevent duplicate start for the SAME session
  if (liveViewState.currentSessionId === session.id) {
    console.log('[RTC] [WARN] Session already handled, skipping:', session.id);
    return;
  }

  // CRITICAL FIX: If we have a different session active, clean it up first
  // This allows START-STOP-START to work properly
  if (liveViewState.isActive && liveViewState.currentSessionId !== session.id) {
    console.log('[RTC] New session requested while old session active. Cleaning up old session:', liveViewState.currentSessionId);
    // Stop the old session first
    mainWindow?.webContents.send('stop-live-view');
    // Reset state
    liveViewState.isActive = false;
    liveViewState.currentSessionId = null;
    // Small delay to let cleanup happen
    setTimeout(() => {
      startNewSession(session);
    }, 500);
    return;
  }

  startNewSession(session);
}

async function startNewSession(session) {
  // CRITICAL: Double-check we're not already handling this session
  if (liveViewState.currentSessionId === session.id) {
    console.log('[RTC] [WARN] startNewSession called for already-active session, skipping');
    return;
  }
  
  // CRITICAL FIX: Wait for cleanup to complete before starting new session
  if (liveViewState.isCleaningUp) {
    console.log('[RTC] [WAIT] Renderer still cleaning up, waiting...');
    let retries = 10; // 10 x 300ms = 3 seconds max
    while (liveViewState.isCleaningUp && retries > 0) {
      await new Promise(r => setTimeout(r, 300));
      retries--;
      if (liveViewState.isCleaningUp) {
        console.log(`[RTC] [WAIT] Cleanup still in progress, retries left: ${retries}`);
      }
    }
    if (liveViewState.isCleaningUp) {
      console.log('[RTC] [WARN] Cleanup timeout - forcing reset and proceeding');
      liveViewState.isCleaningUp = false;
    }
  }
  
  // NOTE: Do NOT mark as active until renderer confirms offer-sent.
  // currentSessionId is enough to de-dupe session handling.
  liveViewState.currentSessionId = session.id;
  liveViewState.isActive = false;
  liveViewState.offerSentForSessionId = null;
  updateTrayMenu('live-view-start-reset');

  console.log('[RTC] Starting live view for session:', session.id);
  // Tell renderer to start WebRTC
  mainWindow?.webContents.send('start-live-view', session.id);
}

async function handleStartLiveView() {
  // Check for pending sessions FIRST (before any state changes)
  const { data: sessions } = await supabase
    .from('rtc_sessions')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (!sessions || sessions.length === 0) {
    console.log('[RTC] handleStartLiveView: No pending sessions found');
    return;
  }

  const pendingSession = sessions[0];
  
  // CRITICAL FIX: If RTC-Poll already started this SAME session, skip entirely
  // This prevents duplicate offers when both Command and RTC channels fire
  if (liveViewState.currentSessionId === pendingSession.id) {
    console.log('[RTC] handleStartLiveView: [WARN] Session already being handled by RTC-Poll, skipping:', pendingSession.id);
    // But we STILL must wait for offer-sent (or start-failed) so the command isn't ACKed too early.
    if (liveViewState.offerSentForSessionId !== pendingSession.id) {
      await waitForLiveViewStartAck(pendingSession.id);
    }
    return;
  }
  
  // Only reset if we have a DIFFERENT old session active
  if (liveViewState.isActive && liveViewState.currentSessionId !== pendingSession.id) {
    console.log('[RTC] handleStartLiveView: Resetting previous active state for new session');
    liveViewState.isActive = false;
    liveViewState.currentSessionId = null;
  }

  console.log('[RTC] handleStartLiveView: Starting session:', pendingSession.id);
  handleNewRtcSession(pendingSession);

  // CRITICAL: Do NOT acknowledge START until renderer actually sent an offer.
  // If camera/mic fails, renderer will report via IPC and we must mark command as failed.
  await waitForLiveViewStartAck(pendingSession.id);
}

function waitForLiveViewStartAck(sessionId, { timeoutMs = 15000 } = {}) {
  // If the renderer already confirmed offer-sent for this session, resolve immediately.
  if (liveViewState.offerSentForSessionId === sessionId) {
    return Promise.resolve(true);
  }
  return new Promise((resolve, reject) => {
    const onOfferSent = (sid) => {
      if (sid !== sessionId) return;
      cleanup();
      resolve(true);
    };

    const onStartFailed = (payload) => {
      if (!payload || payload.sessionId !== sessionId) return;
      cleanup();
      reject(new Error(payload.message || 'WebRTC start failed'));
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('WebRTC start timed out (offer not sent)'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      rtcIpcEvents.off('offer-sent', onOfferSent);
      rtcIpcEvents.off('start-failed', onStartFailed);
    };

    rtcIpcEvents.on('offer-sent', onOfferSent);
    rtcIpcEvents.on('start-failed', onStartFailed);
  });
}

async function handleStopLiveView() {
  // CRITICAL: Mark cleanup immediately to prevent race conditions
  liveViewState.isCleaningUp = true;
  liveViewState.isActive = false;
  liveViewState.currentSessionId = null;
  updateTrayMenu('live-view-stop');

  // Tell renderer to stop WebRTC
  mainWindow?.webContents.send('stop-live-view');
}

// =============================================================================
// DEVICE STATUS SUBSCRIPTION
// =============================================================================

function subscribeToDeviceStatus() {
  if (!deviceId) return;

  deviceStatusSubscription = supabase
    .channel('device-status-channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'device_status',
        filter: `device_id=eq.${deviceId}`
      },
      (payload) => {
        console.log('[DeviceStatus] Update:', payload.new);
        handleDeviceStatusUpdate(payload.new);
      }
    )
    .subscribe();

  console.log('[DeviceStatus] Subscribed');
}

// Global counter for debugging tray/device_status update frequency
let _deviceStatusUpdateCounter = 0;

function handleDeviceStatusUpdate(status) {
  _deviceStatusUpdateCounter++;
  const now = Date.now();

  // SELF-ECHO GUARD: If we just wrote to device_status ourselves, ignore
  // the Realtime echo to prevent cascading updates (tray rebuild loops).
  if (now - _selfWriteTimestamp < SELF_ECHO_GUARD_MS) {
    console.log(`[DeviceStatus] #${_deviceStatusUpdateCounter} SKIPPED (self-echo, ${now - _selfWriteTimestamp}ms since our write)`);
    return;
  }

  console.log(`[DeviceStatus] #${_deviceStatusUpdateCounter} Syncing with AwayManager: ${status.device_mode}`);
  awayManager.syncWithDatabaseStatus(status);
}

// =============================================================================
// AWAY MODE (Delegated to AwayManager)
// =============================================================================
// All Away Mode logic is now handled by the AwayManager class in ./away/away-manager.js
// This includes:
// - Feature flag checking
// - Preflight camera checks
// - Power save blocker management (prevent-app-suspension)
// - Display off commands (pmset/nircmd/xset)
// - User return detection
//
// The AwayManager is initialized at the top of this file and configured when:
// 1. Device ID is set (after pairing)
// 2. Main window is created
// 3. Language is set

// =============================================================================
// IPC HANDLERS
// =============================================================================

function setupIpcHandlers() {
  // Window controls
  ipcMain.handle('minimize-to-tray', () => {
    if (trayAvailable) {
      mainWindow?.hide();
    } else {
      mainWindow?.minimize();
    }
  });

  ipcMain.handle('exit-app', () => {
    app.isQuitting = true;
    app.quit();
  });

  // Pairing
  ipcMain.handle('verify-pairing-code', async (event, code) => {
    return await verifyPairingCode(code);
  });

  // WebRTC session state
  ipcMain.on('webrtc-offer-sent', (event, sessionId) => {
    console.log('[IPC] WebRTC offer sent for session:', sessionId);
    liveViewState.isActive = true;
    liveViewState.currentSessionId = sessionId;
    liveViewState.offerSentForSessionId = sessionId;
    updateTrayMenu('offer-sent');
    rtcIpcEvents.emit('offer-sent', sessionId);
  });

  ipcMain.on('webrtc-start-failed', (event, payload) => {
    console.error('[IPC] [FAIL] WebRTC start failed:', payload);
    // Ensure state doesn't get stuck on "active" if renderer failed.
    liveViewState.isActive = false;
    // CRITICAL: Also clear currentSessionId so START retries won't be skipped.
    // Without this, handleStartLiveView may log "already being handled" forever.
    liveViewState.currentSessionId = null;
    liveViewState.offerSentForSessionId = null;
    // If a start failed, we must allow immediate retries (don't stay in cleanup mode).
    liveViewState.isCleaningUp = false;
    updateTrayMenu('rtc-start-failed');

    // Best-effort: ask renderer to stop in case it partially acquired hardware.
    try {
      mainWindow?.webContents?.send('stop-live-view');
    } catch (e) {
      console.warn('[IPC] Failed to send stop-live-view after start-failed:', e?.message || e);
    }

    rtcIpcEvents.emit('start-failed', payload);
  });

  ipcMain.on('webrtc-session-ended', (event, sessionId) => {
    console.log('[IPC] WebRTC session ended:', sessionId);
    liveViewState.isActive = false;
    liveViewState.currentSessionId = null;
    liveViewState.offerSentForSessionId = null;
    updateTrayMenu('rtc-ended');
  });
  
  // CRITICAL: Cleanup coordination signals from renderer
  ipcMain.on('webrtc-cleanup-started', () => {
    console.log('[IPC] [SYNC] Renderer cleanup started');
    liveViewState.isCleaningUp = true;
  });
  
  ipcMain.on('webrtc-cleanup-complete', () => {
    console.log('[IPC] [OK] Renderer cleanup complete');
    liveViewState.isCleaningUp = false;
  });

  // Away Mode - AwayManager handles its own IPC handlers
  // Additional IPC handler for legacy camera check
  ipcMain.on('away-mode-camera-check-result', (event, hasCamera) => {
    console.log('[IPC] Camera check result:', hasCamera);
    // Handled by AwayManager's internal IPC
  });

  // Login from renderer (after pairing)
  ipcMain.on('login-user', async (event, data) => {
    console.log('===============================================================');
    console.log('[IPC] [IN] LOGIN-USER RECEIVED FROM RENDERER');
    console.log('[IPC] Data:', JSON.stringify(data, null, 2));
    console.log('===============================================================');
    
    const oldDeviceId = deviceId;
    const deviceChanged = data.device_id && data.device_id !== oldDeviceId;
    
    if (data.device_id) {
      deviceId = data.device_id;
      store.set('deviceId', data.device_id);
    }
    if (data.profile_id) {
      profileId = data.profile_id;
      store.set('profileId', data.profile_id);
    }
    if (data.session_token) {
      store.set('sessionToken', data.session_token);
    }
    
    // Update AwayManager with new device info
    awayManager.setDeviceId(deviceId);
    awayManager.setLanguage(currentLanguage);
    
    // CRITICAL: If device ID changed, we must restart all subscriptions
    // Otherwise they'll be listening to the old device ID!
    if (deviceChanged) {
      console.log('[IPC] Device ID changed from', oldDeviceId, 'to', deviceId, '- restarting subscriptions...');
      
      // Clear old subscriptions
      if (commandsSubscription) {
        supabase.removeChannel(commandsSubscription);
        commandsSubscription = null;
      }
      if (rtcSessionsSubscription) {
        supabase.removeChannel(rtcSessionsSubscription);
        rtcSessionsSubscription = null;
      }
      if (deviceStatusSubscription) {
        supabase.removeChannel(deviceStatusSubscription);
        deviceStatusSubscription = null;
      }
      
      // Clear old heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
    
    // Start services if not already running
    if (!heartbeatInterval && deviceId) {
      console.log('[IPC] Starting heartbeat and subscriptions for device:', deviceId);
      startHeartbeat();
    }
    if (!commandsSubscription && deviceId) {
      console.log('[IPC] About to call subscribeToCommands() for device:', deviceId);
      subscribeToCommands();
    } else {
      console.log('[IPC] Skipping subscribeToCommands - commandsSubscription:', commandsSubscription ? 'exists' : 'null', 'deviceId:', deviceId);
    }
    if (!rtcSessionsSubscription && deviceId) {
      console.log('[IPC] About to call subscribeToRtcSessions()');
      subscribeToRtcSessions();
    }
    if (!deviceStatusSubscription && deviceId) {
      console.log('[IPC] About to call subscribeToDeviceStatus()');
      subscribeToDeviceStatus();
    }
    
    // =========================================================================
    // AUTO-AWAY MODE (NEW - Separate path, does NOT affect manual mode)
    // =========================================================================
    // Check if user has auto_away_enabled in their profile
    // If yes, enable Away Mode automatically WITHOUT turning off display
    // This is COMPLETELY SEPARATE from the manual SET_DEVICE_MODE:AWAY command
    // =========================================================================
    if (profileId) {
      try {
        console.log('[IPC] Checking auto_away_enabled via RPC for profile:', profileId);
        
        // Use SECURITY DEFINER RPC to avoid RLS issues with the profiles table
        const { data, error } = await supabase.rpc('get_profile_auto_away', {
          _profile_id: profileId,
        });
        
        if (error) {
          console.error('[IPC] RPC error for auto-away:', error);
        } else {
          // The RPC returns a single row with { profile_exists, auto_away_enabled }
          const row = Array.isArray(data) ? data[0] : data;
          
          if (row && row.profile_exists && row.auto_away_enabled === true) {
            console.log('[IPC] ===================================================');
            console.log('[IPC] [AUTO] AUTO-AWAY: Profile has auto_away_enabled=true');
            console.log('[IPC] [AUTO] Enabling Away Mode with skipDisplayOff=true');
            console.log('[IPC] ===================================================');
            
            // Enable Away Mode WITHOUT turning off display
            // This is the key difference from manual mode
            const result = await awayManager.enable({ skipDisplayOff: true });
            
            if (result.success) {
              console.log('[IPC] [OK] Auto-Away enabled successfully (display follows OS settings)');
            } else {
              console.log('[IPC] [WARN] Auto-Away could not be enabled:', result.error);
            }
          } else {
            console.log('[IPC] Auto-Away not enabled for this profile (auto_away_enabled=false, not set, or profile not found)');
          }
        }
      } catch (err) {
        console.error('[IPC] Auto-Away check failed:', err);
      }
    }
  });

  // Language
  ipcMain.handle('set-language', (lang) => {
    currentLanguage = lang;
    updateTrayMenu('set-language');
  });

  // -------------------------------------------------------------------------
  // Monitoring IPC handlers
  // -------------------------------------------------------------------------
  
  // Monitoring event from renderer (detection)
  ipcMain.on('monitoring-event', async (event, eventData) => {
    console.log('[IPC] Monitoring event received:', eventData.sensor_type, eventData.label);
    await monitoringManager.handleEvent(eventData);
  });

  // Detector ready notification
  ipcMain.on('detector-ready', (event, type) => {
    console.log('[IPC] Detector ready:', type);
    monitoringManager.setDetectorReady(type, true);
  });

  // Detector error notification
  ipcMain.on('detector-error', (event, type, error) => {
    console.error('[IPC] Detector error:', type, error);
    monitoringManager.setDetectorReady(type, false);
  });

  // Monitoring started notification
  ipcMain.on('monitoring-started', (event, status) => {
    console.log('[IPC] Monitoring started:', status);
    try {
      monitoringManager.onRendererStarted?.(status);
    } catch (_) {
      // noop
    }
    monitoringIpcEvents.emit('started', status);
  });

  // Monitoring stopped notification
  ipcMain.on('monitoring-stopped', (event) => {
    console.log('[IPC] Monitoring stopped');
    try {
      monitoringManager.onRendererStopped?.();
    } catch (_) {
      // noop
    }
    monitoringIpcEvents.emit('stopped');
  });

  // Monitoring error notification
  ipcMain.on('monitoring-error', (event, error) => {
    console.error('[IPC] Monitoring error:', error);
    try {
      monitoringManager.onRendererError?.(error);
    } catch (_) {
      // noop
    }
    monitoringIpcEvents.emit('error', error);
  });

  // Monitoring status update
  ipcMain.on('monitoring-status', (event, status) => {
    console.log('[IPC] Monitoring status:', status);
  });

  // Sound detection IPC handlers removed (v2.14.0) - replaced by Baby Monitor mode

  // -------------------------------------------------------------------------
  // Clip Recording IPC handlers
  // -------------------------------------------------------------------------
  
  // Get clips storage path - saved to Desktop/SecurityClips for easy access
  function ensureClipsPath() {
    if (!clipsPath) {
      clipsPath = path.join(app.getPath('desktop'), 'SecurityClips');
      if (!fs.existsSync(clipsPath)) {
        fs.mkdirSync(clipsPath, { recursive: true });
      }
    }
    return clipsPath;
  }

  ipcMain.handle('get-clips-path', () => {
    return ensureClipsPath();
  });

  // Model server port for renderer (YAMNet sound detection)
  ipcMain.handle('get-model-server-port', () => {
    return localModelPort;
  });

  // Open clips folder in OS file explorer
  ipcMain.handle('open-clips-folder', () => {
    ensureClipsPath();
    const { shell } = require('electron');
    shell.openPath(clipsPath);
    console.log('[Clips] Opened folder:', clipsPath);
  });

  ipcMain.handle('save-clip', async (event, { filename, base64Data, eventId, durationSeconds }) => {
    try {
      ensureClipsPath();

      const filePath = path.join(clipsPath, filename);
      const buffer = Buffer.from(base64Data, 'base64');
      
      fs.writeFileSync(filePath, buffer);
      console.log(`[Clips] Saved: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

      return { success: true, filepath: filePath };
    } catch (error) {
      console.error('[Clips] Save error:', error);
      return { success: false, error: error.message };
    }
  });

  // Clip recorded notification - update DB with clip metadata
  ipcMain.on('clip-recorded', async (event, clipInfo) => {
    console.log('[Clips] Recorded:', clipInfo.filename);
    
    // Update monitoring_events with clip metadata
    if (clipInfo.eventId) {
      try {
        const { error } = await supabase
          .from('monitoring_events')
          .update({
            has_local_clip: true,
            local_clip_duration_seconds: clipInfo.durationSeconds || 10,
            local_clip_filename: clipInfo.filename,
          })
          .eq('id', clipInfo.eventId);
        
        if (error) {
          console.error('[Clips] Failed to update event metadata:', error);
        } else {
          console.log('[Clips] [OK] Event metadata updated with clip info');
        }
      } catch (err) {
        console.error('[Clips] DB update error:', err);
      }
    }
  });
}

// =============================================================================
// APP LIFECYCLE
// =============================================================================

// BUILD ID - Verify this matches your local file!
console.log('===============================================================');
console.log('[Main] BUILD ID: main-js-2026-02-13-v2.14.0-baby-monitor');
console.log('[Main] Sound detection: REMOVED (Baby Monitor mode)');

console.log('[Main] Starting Electron app...');
console.log('===============================================================');

app.whenReady().then(async () => {
  console.log('[Main] app.whenReady() - Starting local model server...');
  await startLocalModelServer();
  console.log('[Main] Setting up IPC handlers...');
  setupIpcHandlers();
  console.log('[Main] IPC handlers registered. Creating window...');
  createWindow();
  initTray();
  await initDevice();

  // Initialize MonitoringManager with device info
  if (deviceId) {
    monitoringManager.setDeviceId(deviceId);
    monitoringManager.setProfileId(profileId);
    monitoringManager.setMainWindow(mainWindow);
    
    // Initialize LocalClipRecorder
    clipRecorder = new LocalClipRecorder({
      clipsDir: path.join(app.getPath('desktop'), 'SecurityClips'),
      defaultDurationSeconds: 10,
    });
    monitoringManager.setClipRecorder(clipRecorder);

    // Sound detection removed (v2.14.0) - replaced by Baby Monitor mode
  }

  // If we have a stored device, start subscriptions
  if (deviceId) {
    subscribeToCommands();
    subscribeToRtcSessions();
    subscribeToDeviceStatus();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// =============================================================================
// POWER MONITOR - Suspend/Resume handling
// =============================================================================

// CRITICAL FIX: When Away Mode is active, the powerSaveBlocker SHOULD prevent
// this event from being called at all. If it IS called, it means either:
// 1. User closed the lid (forced sleep bypasses blocker on some systems)
// 2. Critical battery or other forced sleep event
//
// In these cases, we do NOT disable Away Mode - we only pause temporarily
// and restore on resume. The powerSaveBlocker remains the source of truth.
powerMonitor.on('suspend', async () => {
  const isAwayActive = awayManager.isActive();
  
  console.log('[PowerMonitor] [SLEEP] Suspend event detected');
  console.log('[PowerMonitor] Away Mode active:', isAwayActive);
  
  if (!deviceId) {
    console.log('[PowerMonitor] No deviceId, skipping suspend handling');
    return;
  }

  // CRITICAL: If Away Mode is active, this suspend should NOT have happened
  // Log this as a potential issue - the powerSaveBlocker should prevent sleep
  if (isAwayActive) {
    console.log('[PowerMonitor] [WARN] UNEXPECTED SUSPEND while Away Mode is active!');
    console.log('[PowerMonitor] [WARN] powerSaveBlocker should have prevented this.');
    console.log('[PowerMonitor] [WARN] Possible causes: lid closed, critical battery, or system override.');
    
    // DO NOT update device_mode to NORMAL - Away Mode is still logically active
    // Just mark device as temporarily inactive
    try {
      await supabase
        .from('devices')
        .update({ 
          is_active: false,
          last_seen_at: new Date().toISOString()
        })
        .eq('id', deviceId);
      
      console.log('[PowerMonitor] Device marked as temporarily inactive (Away Mode preserved)');
    } catch (err) {
      console.error('[PowerMonitor] Failed to update device:', err.message);
    }
    
    // Stop heartbeat interval (will restart on resume)
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      console.log('[PowerMonitor] Heartbeat interval paused');
    }
    
    // IMPORTANT: Do NOT call awayManager.handleSuspend() here!
    // That would release the powerSaveBlocker, which we want to keep active.
    // The manager's internal state remains "active" so resume can restore properly.
    return;
  }

  // If Away Mode is NOT active, proceed with normal sleep handling
  try {
    // Mark device as inactive
    await supabase
      .from('devices')
      .update({ 
        is_active: false,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    console.log('[PowerMonitor] [OK] Device marked as offline before sleep');
    
    // Stop heartbeat interval (will restart on resume)
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      console.log('[PowerMonitor] Heartbeat interval stopped');
    }

  } catch (err) {
    console.error('[PowerMonitor] [WARN] Failed to update DB before sleep:', err.message);
  }
});

powerMonitor.on('resume', async () => {
  console.log('[PowerMonitor] [WAKE] System resumed from sleep - sending immediate heartbeat');
  sendHeartbeat();
  
  // Restart heartbeat interval if it was cleared
  if (!heartbeatInterval && deviceId) {
    console.log('[PowerMonitor] Restarting heartbeat interval');
    startHeartbeat();
  }

  // CRITICAL FIX: Re-enable Away Mode if it was active before sleep
  // This ensures the computer doesn't go back to sleep immediately
  console.log('[PowerMonitor] [HOME] Checking if Away Mode needs to be restored...');
  const resumeResult = await awayManager.handleResume();
  
  if (resumeResult.wasRestored) {
    console.log('[PowerMonitor] [OK] Away Mode was restored after wake');
  } else {
    console.log('[PowerMonitor] [INFO] Away Mode was not active before sleep, not restoring');
    // Only call handleUserReturned if Away Mode was NOT restored
    // (If restored, we want to stay in Away Mode)
    awayManager.handleUserReturned();
  }

  // CRITICAL FIX: Recover missed commands sent while sleeping
  if (deviceId) {
    console.log('[PowerMonitor] [SEARCH] Checking for missed commands...');
    try {
      const { data: missedCommands, error } = await supabase
        .from('commands')
        .select('*')
        .eq('device_id', deviceId)
        .eq('handled', false)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[PowerMonitor] Failed to fetch missed commands:', error);
      } else if (missedCommands && missedCommands.length > 0) {
        console.log(`[PowerMonitor] [MAIL] Found ${missedCommands.length} missed commands, processing...`);
        for (const cmd of missedCommands) {
          console.log(`[PowerMonitor] Processing missed command: ${cmd.command}`);
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('process-command', cmd);
          }
        }
      } else {
        console.log('[PowerMonitor] [OK] No missed commands');
      }
    } catch (err) {
      console.error('[PowerMonitor] Error recovering commands:', err);
    }
  }
});

powerMonitor.on('unlock-screen', () => {
  console.log('[PowerMonitor] [UNLOCK] Screen unlocked - sending heartbeat');
  sendHeartbeat();
  awayManager.handleUserReturned();
});

powerMonitor.on('user-did-become-active', () => {
  console.log('[PowerMonitor] [USER] User became active');
  awayManager.handleUserReturned();
});

// Diagnostic only - OS handles screen sleep
powerMonitor.on('user-did-resign-active', () => {
  console.log('[PowerMonitor] User resigned active');
});

// =============================================================================
// APP LIFECYCLE - Window and Quit handlers
// =============================================================================

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  if (!app.isQuitting) {
    event.preventDefault();
    app.isQuitting = true;
    
    console.log('[App] Shutting down - marking device as inactive and resetting Away Mode...');

    // Cleanup intervals
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    // Cleanup Away Mode (sync, no await needed)
    awayManager.cleanup();

    // CRITICAL FIX v2.3.1: DB updates FIRST, in parallel, with a 3s timeout.
    // Windows can kill the process before sequential awaits finish.
    // By running all DB updates concurrently and before WebRTC cleanup,
    // the mobile dashboard gets the NORMAL/inactive state immediately.
    if (deviceId) {
      const dbUpdates = [];

      // If live view was active, insert a synthetic STOP command
      if (liveViewState.isActive || liveViewState.currentSessionId) {
        console.log('[App] Quit cleanup: inserting synthetic STOP_LIVE_VIEW command...');
        dbUpdates.push(
          supabase.from('commands').insert({
            device_id: deviceId,
            command: 'STOP_LIVE_VIEW',
            status: 'completed',
            handled: true,
            handled_at: new Date().toISOString(),
          })
        );
      }

      // Update device_status to NORMAL + mark device inactive — in parallel
      _selfWriteTimestamp = Date.now();
      dbUpdates.push(
        supabase
          .from('device_status')
          .update({ device_mode: 'NORMAL', updated_at: new Date().toISOString() })
          .eq('device_id', deviceId)
      );
      dbUpdates.push(
        supabase
          .from('devices')
          .update({ is_active: false })
          .eq('id', deviceId)
      );

      try {
        await Promise.race([
          Promise.all(dbUpdates),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB cleanup timeout')), 3000))
        ]);
        console.log('[App] [OK] DB cleanup completed (device NORMAL + inactive)');
      } catch (err) {
        console.warn('[App] [WARN] DB cleanup did not finish in time:', err.message);
      }
    }

    // WebRTC cleanup AFTER DB updates are sent
    await stopWebRtcRendererOnQuit({ timeoutMs: 2500 });

    // Unsubscribe from channels
    if (commandsSubscription) {
      supabase.removeChannel(commandsSubscription);
    }
    if (rtcSessionsSubscription) {
      supabase.removeChannel(rtcSessionsSubscription);
    }
    if (deviceStatusSubscription) {
      supabase.removeChannel(deviceStatusSubscription);
    }

    app.quit();
    return;
  }
});
