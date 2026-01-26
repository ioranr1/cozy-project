/**
 * Electron Main Process - Complete Implementation
 * ================================================
 * 
 * Full main.js with WebRTC Live View + Away Mode integration.
 * Copy this file to your Electron project.
 * 
 * Required dependencies:
 *   npm install electron electron-store @supabase/supabase-js
 * 
 * Optional for Away Mode display control:
 *   Windows: nircmd.exe in project root
 *   Linux: xset (usually pre-installed)
 *   macOS: uses built-in pmset
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, powerSaveBlocker, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const Store = require('electron-store');
const { createClient } = require('@supabase/supabase-js');

// CRITICAL FIX: Import AwayManager to replace old Away Mode implementation
const AwayManager = require('./away/away-manager');

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUPABASE_URL = 'https://zoripeohnedivxkvrpbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmlwZW9obmVkaXZ4a3ZycGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODMyMDIsImV4cCI6MjA4NDA1OTIwMn0.I24w1VjEWUNf2jCBnPo4-ypu3aq5rATJldbLgSSt9mo';

const store = new Store();
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize AwayManager
const awayManager = new AwayManager({ supabase });

// =============================================================================
// GLOBAL STATE
// =============================================================================

let mainWindow = null;
let tray = null;
let trayAvailable = false;
let deviceId = null;
let profileId = null;
let currentLanguage = 'he';

// Subscriptions
let commandsSubscription = null;
let rtcSessionsSubscription = null;
let deviceStatusSubscription = null;

// Live View state
let liveViewState = {
  isActive: false,
  currentSessionId: null
};

// Heartbeat interval
let heartbeatInterval = null;

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
    trayStatusLive: '🔴 LIVE',
    trayStatusIdle: '⚪ Idle',
    trayStatusAway: '🏠 AWAY',
    trayStatusNormal: '📍 NORMAL',
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
    trayStatusLive: '🔴 שידור',
    trayStatusIdle: '⚪ המתנה',
    trayStatusAway: '🏠 מרוחק',
    trayStatusNormal: '📍 רגיל',
    showWindow: 'הצג חלון',
    quit: 'יציאה'
  }
};

function t(key) {
  return STRINGS[currentLanguage]?.[key] || STRINGS['en'][key] || key;
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
      nodeIntegration: false
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

function getIconPath() {
  const possiblePaths = [
    path.join(__dirname, 'icon.ico'),
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, 'assets', 'icon.ico'),
    path.join(__dirname, 'assets', 'icon.png'),
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(__dirname, 'build', 'icon.png')
  ];

  const fs = require('fs');
  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }
  return null;
}

function initTray() {
  try {
    const iconPath = getIconPath();
    if (!iconPath) {
      console.warn('[Tray] No icon found, tray will not be available');
      return;
    }

    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.warn('[Tray] Icon is empty, tray will not be available');
      return;
    }

    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip(t('trayTooltip'));
    updateTrayMenu();
    trayAvailable = true;

    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    console.log('[Tray] Initialized successfully');
  } catch (error) {
    console.error('[Tray] Failed to initialize:', error);
    trayAvailable = false;
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const liveStatus = liveViewState.isActive ? t('trayStatusLive') : t('trayStatusIdle');
  const awayStatus = awayManager.getTrayStatus();
  const modeStatus = awayStatus.statusText;

  const contextMenu = Menu.buildFromTemplate([
    { label: `${liveStatus} | ${modeStatus}`, enabled: false },
    { type: 'separator' },
    { label: t('showWindow'), click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: t('quit'), click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`${t('trayTooltip')} - ${liveStatus}`);
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
    return;
  }

  // Device will be registered after pairing
  console.log('[Device] No stored device, waiting for pairing...');
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
    console.error('[Commands] ❌ Cannot subscribe - no deviceId!');
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

  console.log('[Commands] ═══════════════════════════════════════════════════');
  console.log('[Commands] Subscribing for device:', deviceId);
  console.log('[Commands] Attempt:', retryCount + 1, 'of', MAX_RETRIES + 1);
  console.log('[Commands] ═══════════════════════════════════════════════════');

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
        console.log('[Commands] ═══════════════════════════════════════════════════');
        console.log('[Commands] 🔔 NEW COMMAND RECEIVED:', payload.new?.command);
        console.log('[Commands] Command ID:', payload.new?.id);
        console.log('[Commands] ═══════════════════════════════════════════════════');
        handleCommand(payload.new);
      }
    )
    .subscribe((status, err) => {
      console.log('[Commands] Subscription status:', status, err ? `Error: ${err}` : '');
      
      if (status === 'SUBSCRIBED') {
        console.log('[Commands] ✅ Successfully subscribed to commands for device:', deviceId);
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.error('[Commands] ❌ Subscription failed:', status);
        
        if (retryCount < MAX_RETRIES) {
          console.log(`[Commands] Retrying in ${RETRY_DELAY}ms...`);
          setTimeout(() => {
            subscribeToCommands(retryCount + 1);
          }, RETRY_DELAY);
        } else {
          console.error('[Commands] ❌ Max retries reached. Using polling fallback.');
          startCommandPolling();
        }
      }
    });

  console.log('[Commands] Subscription initiated, waiting for SUBSCRIBED status...');
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
        const result = await awayManager.enable();
        if (!result.success) {
          console.error('[Commands] ❌ AWAY mode enable failed:', result.error);
          // Revert database state  
          await supabase
            .from('device_status')
            .update({ device_mode: 'NORMAL' })
            .eq('device_id', deviceId);
        }
        break;

      case 'SET_DEVICE_MODE:NORMAL':
        console.log('[Commands] Processing NORMAL mode command');
        await awayManager.disable();
        break;

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
            console.log('[Commands-Poll] 🔔 Found new command:', cmd.command);
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
          console.log('[RTC-Poll] 🔔 Found pending session:', sessions[0].id);
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
    console.error('[RTC] ❌ Cannot subscribe - no deviceId!');
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

  console.log('[RTC] ═══════════════════════════════════════════════════');
  console.log('[RTC] Subscribing to rtc_sessions for device:', deviceId);
  console.log('[RTC] Attempt:', retryCount + 1, 'of', MAX_RETRIES + 1);
  console.log('[RTC] ═══════════════════════════════════════════════════');

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
        console.log('[RTC] ═══════════════════════════════════════════════════');
        console.log('[RTC] 🔔 NEW RTC SESSION:', payload.new?.id);
        console.log('[RTC] Status:', payload.new?.status);
        console.log('[RTC] ═══════════════════════════════════════════════════');
        if (payload.new.status === 'pending') {
          handleNewRtcSession(payload.new);
        }
      }
    )
    .subscribe((status, err) => {
      console.log('[RTC] Subscription status:', status, err ? `Error: ${err}` : '');
      
      if (status === 'SUBSCRIBED') {
        console.log('[RTC] ✅ Successfully subscribed to RTC sessions');
      } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
        console.error('[RTC] ❌ Subscription failed:', status);
        
        if (retryCount < MAX_RETRIES) {
          console.log(`[RTC] Retrying in ${RETRY_DELAY}ms...`);
          setTimeout(() => {
            subscribeToRtcSessions(retryCount + 1);
          }, RETRY_DELAY);
        } else {
          console.error('[RTC] ❌ Max retries reached. Using polling fallback.');
          startRtcPolling();
        }
      }
    });

  console.log('[RTC] Subscription initiated...');
}

function handleNewRtcSession(session) {
  // Prevent duplicate start for the SAME session only
  if (liveViewState.isActive && liveViewState.currentSessionId === session.id) {
    console.log('[RTC] Session already active, skipping duplicate start:', session.id);
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

function startNewSession(session) {
  liveViewState.currentSessionId = session.id;
  liveViewState.isActive = true;
  updateTrayMenu();

  console.log('[RTC] Starting live view for session:', session.id);
  // Tell renderer to start WebRTC
  mainWindow?.webContents.send('start-live-view', session.id);
}

async function handleStartLiveView() {
  // CRITICAL FIX: Always reset state before looking for new session
  // This ensures START after STOP works properly
  if (liveViewState.isActive) {
    console.log('[RTC] handleStartLiveView: Resetting previous active state');
    liveViewState.isActive = false;
    liveViewState.currentSessionId = null;
  }
  
  // Check for pending sessions
  const { data: sessions } = await supabase
    .from('rtc_sessions')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (sessions && sessions.length > 0) {
    console.log('[RTC] handleStartLiveView: Found pending session:', sessions[0].id);
    handleNewRtcSession(sessions[0]);
  } else {
    console.log('[RTC] handleStartLiveView: No pending sessions found');
  }
}

async function handleStopLiveView() {
  liveViewState.isActive = false;
  liveViewState.currentSessionId = null;
  updateTrayMenu();

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

function handleDeviceStatusUpdate(status) {
  // Sync local state with database
  if (status.device_mode === 'AWAY' && !awayModeState.isActive) {
    activateAwayModeLocal();
  } else if (status.device_mode === 'NORMAL' && awayModeState.isActive) {
    deactivateAwayModeLocal();
  }
}

// =============================================================================
// AWAY MODE
// =============================================================================

async function checkAwayModeFeatureFlag() {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('name', 'away_mode')
      .single();

    if (error) {
      console.error('[AwayMode] Feature flag check error:', error);
      return false;
    }

    awayModeState.featureEnabled = data?.enabled || false;
    return awayModeState.featureEnabled;
  } catch (err) {
    console.error('[AwayMode] Feature flag check failed:', err);
    return false;
  }
}

async function runPreflightChecks() {
  const results = {
    power: true,
    camera: false,
    errors: []
  };

  // Check power (basic - just check if on battery on laptops)
  // This is platform-specific and simplified here
  // In production, use proper APIs

  // Check camera - ask renderer to verify
  return new Promise((resolve) => {
    mainWindow?.webContents.send('away-mode-check-camera');

    const timeout = setTimeout(() => {
      results.errors.push(t('cameraRequired'));
      resolve(results);
    }, 5000);

    ipcMain.once('away-mode-camera-check-result', (event, hasCamera) => {
      clearTimeout(timeout);
      results.camera = hasCamera;
      if (!hasCamera) {
        results.errors.push(t('cameraRequired'));
      }
      resolve(results);
    });
  });
}

async function handleEnableAwayMode() {
  console.log('[AwayMode] Enable requested');

  // Check feature flag
  const featureEnabled = await checkAwayModeFeatureFlag();
  if (!featureEnabled) {
    throw new Error('Away Mode feature is not enabled');
  }

  // Run preflight checks
  const preflight = await runPreflightChecks();

  if (!preflight.camera) {
    // Revert database state
    await supabase
      .from('device_status')
      .update({ device_mode: 'NORMAL' })
      .eq('device_id', deviceId);

    mainWindow?.webContents.send('away-mode-preflight-failed', preflight.errors);
    throw new Error(preflight.errors.join(', '));
  }

  // Activate locally (this starts powerSaveBlocker and turns off display)
  activateAwayModeLocal();

  // Update database to confirm activation
  await supabase
    .from('device_status')
    .update({ 
      device_mode: 'AWAY',
      updated_at: new Date().toISOString()
    })
    .eq('device_id', deviceId);

  console.log('[AwayMode] Database updated to AWAY');

  // Notify renderer
  mainWindow?.webContents.send('away-mode-enabled');
}

async function handleDisableAwayMode() {
  console.log('[AwayMode] Disable requested');
  deactivateAwayModeLocal();
  
  // Update database to confirm deactivation
  await supabase
    .from('device_status')
    .update({ 
      device_mode: 'NORMAL',
      updated_at: new Date().toISOString()
    })
    .eq('device_id', deviceId);

  console.log('[AwayMode] Database updated to NORMAL');
  
  mainWindow?.webContents.send('away-mode-disabled');
}

function activateAwayModeLocal() {
  console.log('[AwayMode] Activating locally');
  awayModeState.isActive = true;

  // CRITICAL: Use 'prevent-display-sleep' to prevent system sleep!
  // 'prevent-app-suspension' only keeps the app alive but allows system to sleep
  // 'prevent-display-sleep' prevents system sleep entirely (needed for Away Mode)
  awayModeState.powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  console.log('[AwayMode] Power save blocker started (prevent-display-sleep):', awayModeState.powerBlockerId);

  // Verify it's active
  if (powerSaveBlocker.isStarted(awayModeState.powerBlockerId)) {
    console.log('[AwayMode] ✓ System sleep prevention is ACTIVE');
  } else {
    console.error('[AwayMode] ✗ Failed to activate sleep prevention!');
  }

  // Try to turn off display
  turnOffDisplay();

  updateTrayMenu();
}

function deactivateAwayModeLocal() {
  console.log('[AwayMode] Deactivating locally');
  awayModeState.isActive = false;

  // Release power save blocker
  if (awayModeState.powerBlockerId !== null) {
    powerSaveBlocker.stop(awayModeState.powerBlockerId);
    awayModeState.powerBlockerId = null;
    console.log('[AwayMode] Power save blocker stopped');
  }

  updateTrayMenu();
}

function turnOffDisplay() {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      exec('pmset displaysleepnow');
    } else if (platform === 'win32') {
      // Requires nircmd.exe in project folder
      const nircmdPath = path.join(__dirname, 'nircmd.exe');
      exec(`"${nircmdPath}" monitor off`);
    } else if (platform === 'linux') {
      exec('xset dpms force off');
    }
  } catch (err) {
    console.error('[AwayMode] Failed to turn off display:', err);
  }
}

function handleUserReturned() {
  console.log('[AwayMode] User returned detected');
  mainWindow?.webContents.send('away-mode-user-returned', STRINGS[currentLanguage]);
}

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
    updateTrayMenu();
  });

  ipcMain.on('webrtc-session-ended', (event, sessionId) => {
    console.log('[IPC] WebRTC session ended:', sessionId);
    liveViewState.isActive = false;
    liveViewState.currentSessionId = null;
    updateTrayMenu();
  });

  // Away Mode
  ipcMain.on('away-mode-disable-confirmed', async () => {
    console.log('[IPC] User confirmed disable away mode');
    try {
      await supabase
        .from('device_status')
        .update({ device_mode: 'NORMAL' })
        .eq('device_id', deviceId);

      deactivateAwayModeLocal();
      mainWindow?.webContents.send('away-mode-disabled');
    } catch (err) {
      console.error('[AwayMode] Failed to disable:', err);
    }
  });

  ipcMain.on('away-mode-keep-confirmed', () => {
    console.log('[IPC] User chose to keep away mode');
    // Just hide the prompt, stay in away mode
  });

  ipcMain.on('away-mode-camera-check-result', (event, hasCamera) => {
    // Handled in runPreflightChecks
  });

  // Login from renderer (after pairing)
  ipcMain.on('login-user', (event, data) => {
    console.log('[IPC] Login user received:', data);
    
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
  });

  // Language
  ipcMain.handle('set-language', (event, lang) => {
    currentLanguage = lang;
    updateTrayMenu();
  });
}

// =============================================================================
// APP LIFECYCLE
// =============================================================================

app.whenReady().then(async () => {
  setupIpcHandlers();
  createWindow();
  initTray();
  await initDevice();

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (!app.isQuitting) {
    event.preventDefault();
    app.isQuitting = true;
    
    console.log('[App] Shutting down - marking device as inactive...');

    // Cleanup
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Mark device as inactive and WAIT for it to complete
    if (deviceId) {
      supabase
        .from('devices')
        .update({ is_active: false })
        .eq('id', deviceId)
        .then(() => {
          console.log('[App] Device marked inactive, quitting...');
          app.quit();
        })
        .catch((err) => {
          console.error('[App] Failed to mark device inactive:', err);
          app.quit();
        });
    } else {
      app.quit();
    }
    return; // Don't quit yet, wait for the update
  }

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

  // Cleanup away mode
  awayManager.cleanup();
});

// Handle system resume (for Away Mode user return detection)
const { powerMonitor } = require('electron');

powerMonitor.on('resume', () => {
  console.log('[Power] System resumed');
  awayManager.handleUserReturned();
});

powerMonitor.on('unlock-screen', () => {
  console.log('[Power] Screen unlocked');
  awayManager.handleUserReturned();
});
