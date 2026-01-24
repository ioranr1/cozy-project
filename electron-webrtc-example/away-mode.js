/**
 * Away Mode System Behavior - Electron Main Process
 * ==================================================
 * 
 * This module handles Away mode system behavior:
 * - Preflight checks (power, camera)
 * - Sleep prevention (powerSaveBlocker)
 * - Display off (best effort)
 * - User input detection
 * 
 * IMPORTANT: This file does NOT touch any video/WebRTC logic.
 * It only manages system power states based on device_mode.
 * 
 * Integration: Add these to your existing main.js
 */

const { powerSaveBlocker, powerMonitor, screen, BrowserWindow } = require('electron');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = 'https://zoripeohnedivxkvrpbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmlwZW9obmVkaXZ4a3ZycGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODMyMDIsImV4cCI6MjA4NDA1OTIwMn0.I24w1VjEWUNf2jCBnPo4-ypu3aq3rATJldbLgSSt9mo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// I18N STRINGS
// ============================================================

const AWAY_MODE_STRINGS = {
  en: {
    preflightFailed: 'Away mode preflight failed',
    noPower: 'Device is not connected to power. Please plug in before enabling Away mode.',
    noCamera: 'Camera is not available. Please check camera connection.',
    awayEnabled: 'Away mode enabled - preventing sleep',
    awayDisabled: 'Away mode disabled - sleep allowed',
    userReturnedTitle: 'Welcome Back!',
    userReturnedMessage: 'Input detected. Would you like to disable Away mode?',
    disableAwayMode: 'Disable Away Mode',
    keepAwayMode: 'Keep Away Mode',
  },
  he: {
    preflightFailed: 'בדיקת מצב Away נכשלה',
    noPower: 'המכשיר לא מחובר לחשמל. חבר לחשמל לפני הפעלת מצב Away.',
    noCamera: 'המצלמה לא זמינה. בדוק את חיבור המצלמה.',
    awayEnabled: 'מצב Away פעיל - מניעת מצב שינה',
    awayDisabled: 'מצב Away כבוי - שינה מותרת',
    userReturnedTitle: 'ברוך שובך!',
    userReturnedMessage: 'זוהתה פעילות. האם ברצונך לבטל את מצב Away?',
    disableAwayMode: 'בטל מצב Away',
    keepAwayMode: 'השאר מצב Away',
  },
};

// ============================================================
// STATE
// ============================================================

let awayModeState = {
  isActive: false,
  powerSaveBlockerId: null,
  deviceStatusChannel: null,
  featureFlagsChannel: null,
  isFeatureEnabled: false,
  currentDeviceId: null,
  currentLanguage: 'en',
  inputListenerActive: false,
  lastInputTime: 0,
  userReturnedPromptShown: false,
};

// Reference to mainWindow (set via init)
let mainWindow = null;

// ============================================================
// PREFLIGHT CHECKS
// ============================================================

/**
 * Check if device is connected to external power
 * Returns: { success: boolean, onBattery: boolean, message?: string }
 */
function checkPowerStatus() {
  try {
    // powerMonitor.isOnBatteryPower() returns true if on battery
    const onBattery = powerMonitor.isOnBatteryPower?.() ?? false;
    
    console.log('[AwayMode] Power check - onBattery:', onBattery);
    
    return {
      success: !onBattery,
      onBattery,
    };
  } catch (err) {
    console.warn('[AwayMode] Power check failed, assuming plugged in:', err.message);
    // If we can't detect, assume plugged in but warn
    return {
      success: true,
      onBattery: false,
      warning: 'Could not verify power status',
    };
  }
}

/**
 * Check if camera is available (without starting capture)
 * This queries available media devices
 * Returns: Promise<{ success: boolean, message?: string }>
 */
async function checkCameraAvailable() {
  try {
    // In main process, we can't directly access navigator.mediaDevices
    // We'll send an IPC to renderer to check camera availability
    if (mainWindow && mainWindow.webContents) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[AwayMode] Camera check timeout');
          resolve({ success: true, warning: 'Camera check timeout, proceeding anyway' });
        }, 5000);

        const { ipcMain } = require('electron');
        
        // One-time listener for camera check result
        const handler = (event, result) => {
          clearTimeout(timeout);
          ipcMain.removeListener('away-mode-camera-check-result', handler);
          resolve(result);
        };
        
        ipcMain.once('away-mode-camera-check-result', handler);
        mainWindow.webContents.send('away-mode-check-camera');
      });
    }
    
    // If no window, assume camera is available
    return { success: true, warning: 'No window to check camera' };
  } catch (err) {
    console.error('[AwayMode] Camera check error:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Run all preflight checks before enabling Away mode
 * Returns: Promise<{ success: boolean, errors: string[] }>
 */
async function runPreflightChecks() {
  const errors = [];
  const t = AWAY_MODE_STRINGS[awayModeState.currentLanguage];
  
  console.log('[AwayMode] Running preflight checks...');
  
  // Check power
  const powerCheck = checkPowerStatus();
  if (!powerCheck.success) {
    errors.push(t.noPower);
    console.log('[AwayMode] Preflight FAILED: Not on power');
  }
  
  // Check camera
  const cameraCheck = await checkCameraAvailable();
  if (!cameraCheck.success) {
    errors.push(t.noCamera);
    console.log('[AwayMode] Preflight FAILED: Camera not available');
  }
  
  const success = errors.length === 0;
  console.log('[AwayMode] Preflight result:', success ? 'PASSED' : 'FAILED', errors);
  
  return { success, errors };
}

// ============================================================
// SYSTEM BEHAVIOR - SLEEP PREVENTION
// ============================================================

/**
 * Prevent system from sleeping
 */
function preventSleep() {
  if (awayModeState.powerSaveBlockerId !== null) {
    console.log('[AwayMode] Already preventing sleep');
    return;
  }
  
  try {
    // 'prevent-display-sleep' prevents both display sleep and system sleep
    awayModeState.powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    console.log('[AwayMode] Sleep prevention STARTED, blocker ID:', awayModeState.powerSaveBlockerId);
  } catch (err) {
    console.error('[AwayMode] Failed to prevent sleep:', err);
  }
}

/**
 * Allow system to sleep again
 */
function allowSleep() {
  if (awayModeState.powerSaveBlockerId === null) {
    console.log('[AwayMode] Sleep was not being prevented');
    return;
  }
  
  try {
    if (powerSaveBlocker.isStarted(awayModeState.powerSaveBlockerId)) {
      powerSaveBlocker.stop(awayModeState.powerSaveBlockerId);
      console.log('[AwayMode] Sleep prevention STOPPED');
    }
    awayModeState.powerSaveBlockerId = null;
  } catch (err) {
    console.error('[AwayMode] Failed to allow sleep:', err);
    awayModeState.powerSaveBlockerId = null;
  }
}

// ============================================================
// SYSTEM BEHAVIOR - DISPLAY OFF (BEST EFFORT)
// ============================================================

/**
 * Attempt to turn off the display
 * This is best-effort and platform-dependent
 */
function turnOffDisplay() {
  console.log('[AwayMode] Attempting to turn off display (best effort)...');
  
  try {
    // On Windows, we can use nircmd or similar, but that requires external tools
    // On macOS, we can use pmset
    // For now, we'll just log - actual implementation depends on platform
    
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS: pmset displaysleepnow
      const { exec } = require('child_process');
      exec('pmset displaysleepnow', (err) => {
        if (err) console.warn('[AwayMode] macOS display off failed:', err.message);
        else console.log('[AwayMode] macOS display turned off');
      });
    } else if (platform === 'win32') {
      // Windows: SendMessage to turn off monitor
      // This requires native bindings or external tools
      // For now, we'll just log
      console.log('[AwayMode] Windows display-off not implemented (requires native bindings)');
      
      // Alternative: Use nircmd if available
      const { exec } = require('child_process');
      exec('nircmd.exe monitor off', (err) => {
        if (err) console.log('[AwayMode] nircmd not available, display remains on');
        else console.log('[AwayMode] Windows display turned off via nircmd');
      });
    } else if (platform === 'linux') {
      // Linux: xset dpms force off
      const { exec } = require('child_process');
      exec('xset dpms force off', (err) => {
        if (err) console.warn('[AwayMode] Linux display off failed:', err.message);
        else console.log('[AwayMode] Linux display turned off');
      });
    }
  } catch (err) {
    console.warn('[AwayMode] Display off error:', err.message);
  }
}

/**
 * Restore display (wake it up)
 * Usually moving the mouse or keyboard input does this automatically
 */
function restoreDisplay() {
  console.log('[AwayMode] Display restore requested');
  // Display usually wakes up automatically with input
  // No action needed in most cases
}

// ============================================================
// USER INPUT DETECTION
// ============================================================

/**
 * Start listening for user input while in Away mode
 * This uses Electron's powerMonitor events
 */
function startInputDetection() {
  if (awayModeState.inputListenerActive) return;
  
  console.log('[AwayMode] Starting user input detection...');
  awayModeState.inputListenerActive = true;
  awayModeState.userReturnedPromptShown = false;
  awayModeState.lastInputTime = Date.now();
  
  // Listen for system resume events (user activity)
  powerMonitor.on('resume', handleUserReturned);
  powerMonitor.on('unlock-screen', handleUserReturned);
  
  // Also listen for window focus as a proxy for user activity
  if (mainWindow) {
    mainWindow.on('focus', handleUserReturned);
  }
}

/**
 * Stop listening for user input
 */
function stopInputDetection() {
  if (!awayModeState.inputListenerActive) return;
  
  console.log('[AwayMode] Stopping user input detection...');
  awayModeState.inputListenerActive = false;
  
  powerMonitor.removeListener('resume', handleUserReturned);
  powerMonitor.removeListener('unlock-screen', handleUserReturned);
  
  if (mainWindow) {
    mainWindow.removeListener('focus', handleUserReturned);
  }
}

/**
 * Handle user returned event
 * Show prompt to disable Away mode (do NOT auto-disable)
 */
function handleUserReturned() {
  // Debounce - ignore events within 2 seconds of each other
  const now = Date.now();
  if (now - awayModeState.lastInputTime < 2000) return;
  awayModeState.lastInputTime = now;
  
  // Only prompt once per Away session
  if (awayModeState.userReturnedPromptShown) return;
  
  if (!awayModeState.isActive) return;
  
  console.log('[AwayMode] User returned detected, showing prompt...');
  awayModeState.userReturnedPromptShown = true;
  
  // Send IPC to renderer to show prompt
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('away-mode-user-returned', {
      strings: AWAY_MODE_STRINGS[awayModeState.currentLanguage],
    });
  }
}

// ============================================================
// AWAY MODE TRANSITIONS
// ============================================================

/**
 * Enable Away mode behavior
 */
async function enableAwayMode() {
  const t = AWAY_MODE_STRINGS[awayModeState.currentLanguage];
  
  console.log('[AwayMode] Enabling Away mode...');
  
  // Run preflight checks
  const preflight = await runPreflightChecks();
  
  if (!preflight.success) {
    console.log('[AwayMode] Preflight failed, reverting to NORMAL mode');
    
    // Revert device_mode in DB
    await revertToNormalMode(preflight.errors.join('\n'));
    
    // Notify renderer of failure
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('away-mode-preflight-failed', {
        errors: preflight.errors,
        title: t.preflightFailed,
      });
    }
    
    return false;
  }
  
  // Preflight passed - enable system behaviors
  awayModeState.isActive = true;
  
  // 1. Prevent sleep
  preventSleep();
  
  // 2. Turn off display (best effort)
  turnOffDisplay();
  
  // 3. Start input detection for "user returned" prompt
  startInputDetection();
  
  // 4. Report status to DB
  await reportAwayModeStatus('AWAY', 'enabled');
  
  console.log('[AwayMode] Away mode ENABLED successfully');
  console.log('[AwayMode] Transition: NORMAL -> AWAY');
  
  // Notify renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('away-mode-enabled', {
      message: t.awayEnabled,
    });
  }
  
  return true;
}

/**
 * Disable Away mode behavior
 */
async function disableAwayMode() {
  const t = AWAY_MODE_STRINGS[awayModeState.currentLanguage];
  
  console.log('[AwayMode] Disabling Away mode...');
  
  awayModeState.isActive = false;
  
  // 1. Allow sleep
  allowSleep();
  
  // 2. Restore display (usually automatic)
  restoreDisplay();
  
  // 3. Stop input detection
  stopInputDetection();
  
  // 4. Report status to DB
  await reportAwayModeStatus('NORMAL', 'disabled');
  
  console.log('[AwayMode] Away mode DISABLED');
  console.log('[AwayMode] Transition: AWAY -> NORMAL');
  
  // Notify renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('away-mode-disabled', {
      message: t.awayDisabled,
    });
  }
}

/**
 * Revert to NORMAL mode in database after preflight failure
 */
async function revertToNormalMode(errorMessage) {
  if (!awayModeState.currentDeviceId) {
    console.error('[AwayMode] No device ID to revert');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('device_status')
      .update({
        device_mode: 'NORMAL',
        last_mode_changed_at: new Date().toISOString(),
        last_mode_changed_by: 'DESKTOP',
      })
      .eq('device_id', awayModeState.currentDeviceId);
    
    if (error) {
      console.error('[AwayMode] Failed to revert mode:', error);
    } else {
      console.log('[AwayMode] Reverted to NORMAL mode in DB');
    }
  } catch (err) {
    console.error('[AwayMode] Revert error:', err);
  }
}

/**
 * Report Away mode status to database
 */
async function reportAwayModeStatus(mode, action) {
  console.log(`[AwayMode] Reporting status: mode=${mode}, action=${action}`);
  // Status is already tracked in device_status.device_mode
  // Additional logging/metrics could be added here
}

// ============================================================
// DATABASE SUBSCRIPTIONS
// ============================================================

/**
 * Subscribe to device_status changes for Away mode
 */
async function subscribeToDeviceStatus(deviceId) {
  console.log('[AwayMode] Subscribing to device_status for device:', deviceId);
  
  awayModeState.currentDeviceId = deviceId;
  
  // Unsubscribe from previous channel
  if (awayModeState.deviceStatusChannel) {
    await supabase.removeChannel(awayModeState.deviceStatusChannel);
  }
  
  // Subscribe to device_status changes
  awayModeState.deviceStatusChannel = supabase
    .channel('away_mode_device_status')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'device_status',
        filter: `device_id=eq.${deviceId}`,
      },
      async (payload) => {
        const newStatus = payload.new;
        const oldStatus = payload.old;
        
        console.log('[AwayMode] device_status changed:', {
          old_mode: oldStatus?.device_mode,
          new_mode: newStatus?.device_mode,
        });
        
        // Only react if feature flag is enabled
        if (!awayModeState.isFeatureEnabled) {
          console.log('[AwayMode] Feature flag OFF, ignoring device_mode change');
          return;
        }
        
        // Handle mode transitions
        if (newStatus.device_mode === 'AWAY' && !awayModeState.isActive) {
          await enableAwayMode();
        } else if (newStatus.device_mode === 'NORMAL' && awayModeState.isActive) {
          await disableAwayMode();
        }
      }
    )
    .subscribe((status) => {
      console.log('[AwayMode] device_status subscription:', status);
    });
}

/**
 * Subscribe to feature_flags changes
 */
async function subscribeToFeatureFlags() {
  console.log('[AwayMode] Subscribing to feature_flags...');
  
  // First, fetch current flag status
  const { data, error } = await supabase
    .from('feature_flags')
    .select('flag_name, is_enabled')
    .eq('flag_name', 'away_mode')
    .maybeSingle();
  
  if (!error && data) {
    awayModeState.isFeatureEnabled = data.is_enabled;
    console.log('[AwayMode] Initial feature flag status:', awayModeState.isFeatureEnabled);
  }
  
  // Subscribe to changes
  awayModeState.featureFlagsChannel = supabase
    .channel('away_mode_feature_flags')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'feature_flags',
      },
      (payload) => {
        if (payload.new?.flag_name === 'away_mode') {
          awayModeState.isFeatureEnabled = payload.new.is_enabled;
          console.log('[AwayMode] Feature flag updated:', awayModeState.isFeatureEnabled);
          
          // If feature is disabled while Away mode is active, disable Away mode
          if (!awayModeState.isFeatureEnabled && awayModeState.isActive) {
            console.log('[AwayMode] Feature disabled, turning off Away mode');
            disableAwayMode();
          }
        }
      }
    )
    .subscribe((status) => {
      console.log('[AwayMode] feature_flags subscription:', status);
    });
}

// ============================================================
// COMMAND HANDLING (for remote SET_DEVICE_MODE commands)
// ============================================================

let commandsChannel = null;

/**
 * Subscribe to commands table for SET_DEVICE_MODE commands
 * This allows mobile to remotely control Away mode
 */
async function subscribeToCommands(deviceId) {
  console.log('[AwayMode] Subscribing to commands for device:', deviceId);
  
  // Unsubscribe from previous channel
  if (commandsChannel) {
    await supabase.removeChannel(commandsChannel);
  }
  
  // Subscribe to new commands
  commandsChannel = supabase
    .channel('away_mode_commands')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'commands',
        filter: `device_id=eq.${deviceId}`,
      },
      async (payload) => {
        const command = payload.new;
        console.log('[AwayMode] Command received:', command);
        
        // Only handle SET_DEVICE_MODE commands
        if (!command.command?.startsWith('SET_DEVICE_MODE')) {
          return;
        }
        
        // Already handled?
        if (command.handled || command.status !== 'pending') {
          console.log('[AwayMode] Command already handled, skipping');
          return;
        }
        
        await handleSetDeviceModeCommand(command);
      }
    )
    .subscribe((status) => {
      console.log('[AwayMode] commands subscription:', status);
    });
}

/**
 * Handle SET_DEVICE_MODE command from mobile
 * Format: SET_DEVICE_MODE:AWAY or SET_DEVICE_MODE:NORMAL
 */
async function handleSetDeviceModeCommand(command) {
  const commandId = command.id;
  const commandStr = command.command;
  
  console.log('[AwayMode] Handling SET_DEVICE_MODE command:', commandId, commandStr);
  
  // Parse mode from command string (SET_DEVICE_MODE:AWAY or SET_DEVICE_MODE:NORMAL)
  const parts = commandStr.split(':');
  const targetMode = parts[1] || 'NORMAL';
  
  console.log('[AwayMode] Target mode:', targetMode);
  
  // Only react if feature flag is enabled
  if (!awayModeState.isFeatureEnabled) {
    console.log('[AwayMode] Feature flag OFF, failing command');
    await acknowledgeCommand(commandId, 'failed', 'Away mode feature is disabled');
    return;
  }
  
  try {
    if (targetMode === 'AWAY') {
      // Run preflight and enable
      const success = await enableAwayModeForCommand(commandId);
      
      if (success) {
        // Update device_status to AWAY
        await supabase
          .from('device_status')
          .update({
            device_mode: 'AWAY',
            last_mode_changed_at: new Date().toISOString(),
            last_mode_changed_by: 'MOBILE',
          })
          .eq('device_id', awayModeState.currentDeviceId);
        
        await acknowledgeCommand(commandId, 'acknowledged', null);
      }
      // If not success, enableAwayModeForCommand already handled the failure
      
    } else if (targetMode === 'NORMAL') {
      // Disable Away mode
      await disableAwayMode();
      
      // Update device_status to NORMAL
      await supabase
        .from('device_status')
        .update({
          device_mode: 'NORMAL',
          last_mode_changed_at: new Date().toISOString(),
          last_mode_changed_by: 'MOBILE',
        })
        .eq('device_id', awayModeState.currentDeviceId);
      
      await acknowledgeCommand(commandId, 'acknowledged', null);
    } else {
      await acknowledgeCommand(commandId, 'failed', `Unknown mode: ${targetMode}`);
    }
    
  } catch (err) {
    console.error('[AwayMode] Error handling command:', err);
    await acknowledgeCommand(commandId, 'failed', err.message);
  }
}

/**
 * Enable Away mode for a command (with preflight)
 * Returns true if successful, false if failed
 */
async function enableAwayModeForCommand(commandId) {
  const t = AWAY_MODE_STRINGS[awayModeState.currentLanguage];
  
  console.log('[AwayMode] Enabling Away mode for command:', commandId);
  
  // Run preflight checks
  const preflight = await runPreflightChecks();
  
  if (!preflight.success) {
    console.log('[AwayMode] Preflight failed for command:', preflight.errors);
    
    // ACK with failure
    await acknowledgeCommand(commandId, 'failed', `Preflight failed: ${preflight.errors.join(', ')}`);
    
    // Notify renderer of failure
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('away-mode-preflight-failed', {
        errors: preflight.errors,
        title: t.preflightFailed,
      });
    }
    
    return false;
  }
  
  // Preflight passed - enable system behaviors
  awayModeState.isActive = true;
  
  // 1. Prevent sleep
  preventSleep();
  
  // 2. Turn off display (best effort)
  turnOffDisplay();
  
  // 3. Start input detection for "user returned" prompt
  startInputDetection();
  
  console.log('[AwayMode] Away mode ENABLED via remote command');
  console.log('[AwayMode] Transition: NORMAL -> AWAY (remote)');
  
  // Notify renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('away-mode-enabled', {
      message: t.awayEnabled,
    });
  }
  
  return true;
}

/**
 * Acknowledge a command in the database
 */
async function acknowledgeCommand(commandId, status, errorMessage) {
  console.log('[AwayMode] Acknowledging command:', commandId, status, errorMessage);
  
  const updateData = {
    handled: true,
    handled_at: new Date().toISOString(),
    status: status,
  };
  
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }
  
  const { error } = await supabase
    .from('commands')
    .update(updateData)
    .eq('id', commandId);
  
  if (error) {
    console.error('[AwayMode] Error acknowledging command:', error);
  } else {
    console.log('[AwayMode] Command acknowledged successfully:', status);
  }
}

// ============================================================
// IPC HANDLERS
// ============================================================

/**
 * Set up IPC handlers for Away mode
 */
function setupAwayModeIPC(ipcMain) {
  // Handle user response to "user returned" prompt
  ipcMain.on('away-mode-disable-confirmed', async () => {
    console.log('[AwayMode] User confirmed disable');
    
    // Update DB to NORMAL mode
    if (awayModeState.currentDeviceId) {
      await supabase
        .from('device_status')
        .update({
          device_mode: 'NORMAL',
          last_mode_changed_at: new Date().toISOString(),
          last_mode_changed_by: 'DESKTOP',
        })
        .eq('device_id', awayModeState.currentDeviceId);
    }
    
    // Disable Away mode locally
    await disableAwayMode();
  });
  
  ipcMain.on('away-mode-keep', () => {
    console.log('[AwayMode] User chose to keep Away mode');
    // Reset the prompt flag so it can show again next time
    awayModeState.userReturnedPromptShown = false;
  });
  
  // Handle camera check result from renderer
  ipcMain.on('away-mode-camera-check-result', (event, result) => {
    // Handled by the one-time listener in checkCameraAvailable
    console.log('[AwayMode] Camera check result received:', result);
  });
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize Away mode module
 * Call this from your main.js after window is created
 * 
 * @param {BrowserWindow} window - The main window
 * @param {string} deviceId - The current device ID
 * @param {string} language - Current language ('en' or 'he')
 */
async function initAwayMode(window, deviceId, language = 'en') {
  console.log('[AwayMode] Initializing...', { deviceId, language });
  
  mainWindow = window;
  awayModeState.currentLanguage = language;
  
  // Set up IPC handlers
  const { ipcMain } = require('electron');
  setupAwayModeIPC(ipcMain);
  
  // Subscribe to feature flags
  await subscribeToFeatureFlags();
  
  // Subscribe to device status and commands
  if (deviceId) {
    await subscribeToDeviceStatus(deviceId);
    await subscribeToCommands(deviceId);
  }
  
  console.log('[AwayMode] Initialization complete');
}

/**
 * Update device ID (call when device changes)
 */
async function setAwayModeDeviceId(deviceId) {
  if (deviceId !== awayModeState.currentDeviceId) {
    await subscribeToDeviceStatus(deviceId);
    await subscribeToCommands(deviceId);
  }
}

/**
 * Update language
 */
function setAwayModeLanguage(language) {
  awayModeState.currentLanguage = language;
}

/**
 * Cleanup on app quit
 */
async function cleanupAwayMode() {
  console.log('[AwayMode] Cleaning up...');
  
  // Disable Away mode if active
  if (awayModeState.isActive) {
    allowSleep();
    stopInputDetection();
  }
  
  // Remove subscriptions
  if (awayModeState.deviceStatusChannel) {
    await supabase.removeChannel(awayModeState.deviceStatusChannel);
  }
  if (awayModeState.featureFlagsChannel) {
    await supabase.removeChannel(awayModeState.featureFlagsChannel);
  }
  if (commandsChannel) {
    await supabase.removeChannel(commandsChannel);
  }
  
  console.log('[AwayMode] Cleanup complete');
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  initAwayMode,
  setAwayModeDeviceId,
  setAwayModeLanguage,
  cleanupAwayMode,
  // For testing
  checkPowerStatus,
  checkCameraAvailable,
  runPreflightChecks,
  preventSleep,
  allowSleep,
  enableAwayMode,
  disableAwayMode,
  // Command handling
  handleSetDeviceModeCommand,
  acknowledgeCommand,
};
