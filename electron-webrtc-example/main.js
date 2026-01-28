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

const { app, BrowserWindow, Tray, Menu, ipcMain, powerSaveBlocker, nativeImage, powerMonitor } = require('electron');
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

// Auto-Away guard (prevents infinite retries)
let autoAwayAttempts = 0;
const MAX_AUTO_AWAY_ATTEMPTS = 3;

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

    // AUTO-AWAY on startup (uses profile.auto_away_enabled)
    scheduleAutoAwayCheck('startup-stored-session');
    return;
  }

  // Device will be registered after pairing
  console.log('[Device] No stored device, waiting for pairing...');
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

  console.log('[AutoAway] ✅ Away Mode enabled successfully (Auto-Away)');
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
        const awayResult = await awayManager.enable();
        if (!awayResult.success) {
          console.error('[Commands] ❌ AWAY mode enable failed:', awayResult.error);
          // Revert database state  
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
  // CRITICAL FIX: Prevent duplicate start for the SAME session
  if (liveViewState.currentSessionId === session.id) {
    console.log('[RTC] ⚠️ Session already handled, skipping:', session.id);
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
  // CRITICAL: Double-check we're not already handling this session
  if (liveViewState.currentSessionId === session.id) {
    console.log('[RTC] ⚠️ startNewSession called for already-active session, skipping');
    return;
  }
  
  liveViewState.currentSessionId = session.id;
  liveViewState.isActive = true;
  updateTrayMenu();

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
    console.log('[RTC] handleStartLiveView: ⚠️ Session already being handled by RTC-Poll, skipping:', pendingSession.id);
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
  // CRITICAL FIX: Use AwayManager for device status sync
  console.log('[DeviceStatus] Syncing with AwayManager:', status.device_mode);
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
    updateTrayMenu();
  });

  ipcMain.on('webrtc-session-ended', (event, sessionId) => {
    console.log('[IPC] WebRTC session ended:', sessionId);
    liveViewState.isActive = false;
    liveViewState.currentSessionId = null;
    updateTrayMenu();
  });

  // Away Mode - AwayManager handles its own IPC handlers
  // Additional IPC handler for legacy camera check
  ipcMain.on('away-mode-camera-check-result', (event, hasCamera) => {
    console.log('[IPC] Camera check result:', hasCamera);
    // Handled by AwayManager's internal IPC
  });

  // Login from renderer (after pairing)
  ipcMain.on('login-user', async (event, data) => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[IPC] 📥 LOGIN-USER RECEIVED FROM RENDERER');
    console.log('[IPC] Data:', JSON.stringify(data, null, 2));
    console.log('═══════════════════════════════════════════════════════════════');
    
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
            console.log('[IPC] ═══════════════════════════════════════════════════');
            console.log('[IPC] 🤖 AUTO-AWAY: Profile has auto_away_enabled=true');
            console.log('[IPC] 🤖 Enabling Away Mode with skipDisplayOff=true');
            console.log('[IPC] ═══════════════════════════════════════════════════');
            
            // Enable Away Mode WITHOUT turning off display
            // This is the key difference from manual mode
            const result = await awayManager.enable({ skipDisplayOff: true });
            
            if (result.success) {
              console.log('[IPC] ✅ Auto-Away enabled successfully (display follows OS settings)');
            } else {
              console.log('[IPC] ⚠️ Auto-Away could not be enabled:', result.error);
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
  ipcMain.handle('set-language', (event, lang) => {
    currentLanguage = lang;
    updateTrayMenu();
  });
}

// =============================================================================
// APP LIFECYCLE
// =============================================================================

// BUILD ID - Verify this matches your local file!
console.log('═══════════════════════════════════════════════════════════════');
console.log('[Main] BUILD ID: main-js-2026-01-27-autoaway-fix-v1');
console.log('[Main] Starting Electron app...');
console.log('═══════════════════════════════════════════════════════════════');

app.whenReady().then(async () => {
  console.log('[Main] app.whenReady() - Setting up IPC handlers...');
  setupIpcHandlers();
  console.log('[Main] IPC handlers registered. Creating window...');
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

// =============================================================================
// POWER MONITOR - Suspend/Resume handling
// =============================================================================

// CRITICAL: Mark device offline BEFORE system sleeps
// This allows mobile dashboard to know immediately via Realtime
powerMonitor.on('suspend', async () => {
  console.log('[PowerMonitor] 💤 System going to sleep - updating DB immediately...');
  
  if (!deviceId) {
    console.log('[PowerMonitor] No deviceId, skipping suspend cleanup');
    return;
  }

  try {
    // CRITICAL: Update device_status to NORMAL before sleep
    // This ensures mobile dashboard shows correct state
    const statusPromise = supabase
      .from('device_status')
      .update({ 
        device_mode: 'NORMAL', 
        updated_at: new Date().toISOString() 
      })
      .eq('device_id', deviceId);
    
    // Mark device as inactive
    const devicePromise = supabase
      .from('devices')
      .update({ 
        is_active: false,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    // Execute both updates in parallel with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Suspend DB update timeout')), 2000)
    );

    await Promise.race([
      Promise.all([statusPromise, devicePromise]),
      timeoutPromise
    ]);

    console.log('[PowerMonitor] ✅ Device marked as offline before sleep');
    
    // Stop heartbeat interval (will restart on resume)
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      console.log('[PowerMonitor] Heartbeat interval stopped');
    }

    // Disable power blocker (allow sleep to proceed)
    awayManager.handleSuspend();

  } catch (err) {
    console.error('[PowerMonitor] ⚠️ Failed to update DB before sleep:', err.message);
    // Don't block suspend - just log the error
  }
});

powerMonitor.on('resume', async () => {
  console.log('[PowerMonitor] 💡 System resumed from sleep - sending immediate heartbeat');
  sendHeartbeat();
  
  // Restart heartbeat interval if it was cleared
  if (!heartbeatInterval && deviceId) {
    console.log('[PowerMonitor] Restarting heartbeat interval');
    startHeartbeat();
  }

  // CRITICAL: Handle Away Mode user return
  awayManager.handleUserReturned();

  // CRITICAL FIX: Recover missed commands sent while sleeping
  if (deviceId) {
    console.log('[PowerMonitor] 🔍 Checking for missed commands...');
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
        console.log(`[PowerMonitor] 📬 Found ${missedCommands.length} missed commands, processing...`);
        for (const cmd of missedCommands) {
          console.log(`[PowerMonitor] Processing missed command: ${cmd.command}`);
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('process-command', cmd);
          }
        }
      } else {
        console.log('[PowerMonitor] ✅ No missed commands');
      }
    } catch (err) {
      console.error('[PowerMonitor] Error recovering commands:', err);
    }
  }
});

powerMonitor.on('unlock-screen', () => {
  console.log('[PowerMonitor] 🔓 Screen unlocked - sending heartbeat');
  sendHeartbeat();
  awayManager.handleUserReturned();
});

powerMonitor.on('user-did-become-active', () => {
  console.log('[PowerMonitor] 👤 User became active');
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

    // Cleanup Away Mode
    awayManager.cleanup();

    // CRITICAL: Reset device_mode to NORMAL when Electron closes
    // This prevents the mobile app from showing AWAY as active when the computer is off
    if (deviceId) {
      try {
        // Update device_status to NORMAL
        await supabase
          .from('device_status')
          .update({ device_mode: 'NORMAL', updated_at: new Date().toISOString() })
          .eq('device_id', deviceId);
        
        console.log('[App] Device mode reset to NORMAL');
        
        // Mark device as inactive
        await supabase
          .from('devices')
          .update({ is_active: false })
          .eq('id', deviceId);
        
        console.log('[App] Device marked inactive, quitting...');
      } catch (err) {
        console.error('[App] Failed to cleanup device state:', err);
      }
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

    app.quit();
    return;
  }
});
