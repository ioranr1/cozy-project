/**
 * Away Mode Manager
 * =================
 * 
 * VERSION: 2.4.9 (2026-05-06)
 * 
 * CHANGELOG:
 * - 2.1.0: Removed camera preflight check - Away Mode does NOT require camera!
 *          This fixes: Away Mode not activating by default, LED turning on unnecessarily.
 * 
 * Handles all Away Mode logic for the Electron main process:
 * - Power save blocker management
 * - Display control (platform-specific)
 * - User return detection
 * 
 * Usage:
 * const AwayManager = require('./away/away-manager');
 * const awayManager = new AwayManager({ supabase, ipcMain });
 * await awayManager.enable(deviceId, mainWindow, language);
 */

const { powerSaveBlocker, ipcMain, powerMonitor } = require('electron');
const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const { getAwayString, getAwayStrings } = require('./away-strings');
const { AwayModeIPC, AWAY_IPC_CHANNELS } = require('./away-ipc');

class AwayManager {
  constructor({ supabase }) {
    this.supabase = supabase;
    this.awayModeIPC = null;

    // BUILD STAMP (debug)
    this.__buildId = 'away-manager-2026-05-06-v2.4.9-mac-monitoring-resleep-reassert';
    console.log(`[AwayManager] build: ${this.__buildId}`);
    
    // OS-native sleep prevention process (caffeinate on macOS, powercfg on Windows)
    this._nativeSleepBlockerProcess = null;
    
    // State
    this.state = {
      isActive: false,
      powerBlockerId: null,
      featureEnabled: false,
      displayOffLoopId: null, // Interval ID for periodic display-off

      // Every active AWAY session enforces display-off + 30s reinforcement loop.
      // This includes AWAY restored after install/update/startup.
      enforceDisplayOff: false,

      // Short-interval safety watcher to stop enforcement quickly on real user activity.
      // (Some systems don't reliably fire focus/unlock/resume events.)
      userActivityWatchId: null,
      activatedAtMs: null,

      // When true, we consider the user "present" and we must NOT force display off
      // again unless the user explicitly confirms "Keep Away Mode".
      userReturnedNotified: false,
      
      // CRITICAL: Track state before sleep to restore on wake
      wasActiveBeforeSleep: false,
      wasEnforceDisplayOffBeforeSleep: false,

      // Cache active macOS Display Sleep setting so AWAY can re-darken after
      // the user wakes the monitor, without forcing it off while they are active.
      displaySleepSeconds: null,
      displaySleepSettingCheckedAtMs: 0
    };
    
    this.language = 'en';
    this.deviceId = null;
    this.mainWindow = null;
    
    // Setup IPC handlers
    this._setupIpcHandlers();
  }
  
  // =========================================================================
  // PUBLIC API
  // =========================================================================
  
  /**
   * Set the main window reference
   * @param {BrowserWindow} mainWindow 
   */
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
    this.awayModeIPC = new AwayModeIPC(mainWindow);
  }
  
  /**
   * Set current language
   * @param {string} lang - 'en' | 'he'
   */
  setLanguage(lang) {
    this.language = lang;
  }
  
  /**
   * Set device ID for database operations
   * @param {string} deviceId 
   */
  setDeviceId(deviceId) {
    this.deviceId = deviceId;
  }
  
  /**
   * Check if Away Mode is currently active
   * @returns {boolean}
   */
  isActive() {
    return this.state.isActive;
  }
  
  /**
   * Get current state for tray menu
   * @returns {{ isActive: boolean, statusText: string }}
   */
  getTrayStatus() {
    return {
      isActive: this.state.isActive,
      statusText: this.state.isActive 
        ? getAwayString('trayStatusAway', this.language)
        : getAwayString('trayStatusNormal', this.language)
    };
  }
  
  /**
   * Enable Away Mode
   * @param {Object} options - Optional configuration
   * @param {boolean} options.skipDisplayOff - Legacy/testing only. Production AWAY should keep this false.
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async enable(options = {}) {
    const { skipDisplayOff = false } = options;
    
    console.log('═══════════════════════════════════════════════════');
    console.log('[AwayManager] 🏠 AWAY MODE - ENABLE REQUESTED');
    console.log('[AwayManager] Options:', { skipDisplayOff });
    console.log('═══════════════════════════════════════════════════');
    
    if (!this.deviceId) {
      console.error('[AwayManager] Enable failed: No device ID');
      return { success: false, error: 'No device ID' };
    }
    
    try {
      // Check feature flag first
      const featureEnabled = await this._checkFeatureFlag();
      if (!featureEnabled) {
        console.error('[AwayManager] Enable failed: Feature not enabled');
        return { success: false, error: 'Away Mode feature is not enabled' };
      }
      
      // IMPORTANT: Away Mode does NOT require camera access!
      // Camera is only needed for Live View, not for Away Mode.
      // Removed camera preflight check that was blocking Away Mode activation.
      console.log('[AwayManager] ✓ Feature flag enabled, proceeding to activate');
      
      // First update database to ensure consistency
      console.log('[AwayManager] Updating database to AWAY...');
      await this._updateDatabaseMode('AWAY');
      
      // Then activate locally - pass skipDisplayOff option
      this._activateLocal({ skipDisplayOff });
      
      console.log('[AwayManager] ✓ Away Mode enabled successfully');
      if (skipDisplayOff) {
        console.log('[AwayManager] ℹ️ Display off skipped by legacy option');
      }
      this.awayModeIPC?.sendEnabled();
      
      return { success: true };
    } catch (error) {
      console.error('[AwayManager] Enable failed with error:', error);
      // If we fail, ensure we're in a clean state
      this._deactivateLocal();
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Disable Away Mode
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async disable() {
    console.log('═══════════════════════════════════════════════════');
    console.log('[AwayManager] 🏠 AWAY MODE - DISABLE REQUESTED');
    console.log('═══════════════════════════════════════════════════');
    
    try {
      this._deactivateLocal();
      
      if (this.deviceId) {
        await this._updateDatabaseMode('NORMAL');
      }
      
      console.log('[AwayManager] ✓ Away Mode disabled');
      this.awayModeIPC?.sendDisabled();
      
      return { success: true };
    } catch (error) {
      console.error('[AwayManager] Disable failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Handle user return (focus/resume/unlock)
   * NOTE: User Returned modal removed - Away Mode is controlled from Dashboard only.
   * AWAY stays active, but display enforcement pauses until the OS idle display
   * timeout is reached again. This fixes macOS where camera/renderer activity can
   * prevent the panel from darkening after the user wakes it with the mouse.
   */
  handleUserReturned() {
    if (!this.state.isActive) return;

    // If Auto-Away is active (no display enforcement), do nothing.
    // But if some leftover loop exists (shouldn't), stop it quietly.
    if (!this.state.enforceDisplayOff) {
      if (this.state.displayOffLoopId || this.state.userActivityWatchId) {
        console.log('[AwayManager] 👤 User returned detected while enforceDisplayOff=false -> stopping any leftover loops');
        this._stopDisplayOffLoop();
        this._stopUserActivityWatch();
      }
      return;
    }

    // v2.4.8: Do NOT disable display enforcement permanently. When the user
    // moves the mouse, pause enforcement while they are active; once macOS idle
    // time reaches the configured Display Sleep timeout, turn the screen off again.
    console.log('[AwayManager] 👤 User activity detected -> pausing display-off until OS idle display timeout');
    this.state.userReturnedNotified = true;
    this._startDisplayOffLoop();
    this._startUserActivityWatch();
  }
  
  /**
   * Sync local state with database status
   * @param {object} status - device_status row
   */
  syncWithDatabaseStatus(status) {
    if (status.device_mode === 'AWAY') {
      // v2.4.6: Any DB state of AWAY means the display must be turned off and kept
      // under OS user display timeout rules. This fixes the install/update/startup
      // case where Auto-Away restored AWAY but left the screen permanently on.
      const shouldEnforceDisplayOff = this._shouldEnforceDisplayOffFromStatus(status);

      console.log('[AwayManager] Syncing: DB says AWAY, activating locally', {
        last_command: status.last_command,
        last_command_at: status.last_command_at,
        alreadyActive: this.state.isActive,
        currentEnforceDisplayOff: this.state.enforceDisplayOff,
        skipDisplayOff: !shouldEnforceDisplayOff,
      });

      if (this.state.isActive) {
        // If AWAY is active without display enforcement, upgrade immediately.
        if (shouldEnforceDisplayOff && !this.state.enforceDisplayOff) {
          console.log('[AwayManager] 📴 Enforcing display-off for active AWAY');
          this.state.enforceDisplayOff = true;
          this.state.userReturnedNotified = false;
          this.state.activatedAtMs = Date.now();
          this._startDisplayOffLoop();
          this._startUserActivityWatch();
          this._turnOffDisplay();
        }
        return;
      }

      this._activateLocal({ skipDisplayOff: !shouldEnforceDisplayOff });
    } else if (status.device_mode === 'NORMAL' && this.state.isActive) {
      console.log('[AwayManager] Syncing: DB says NORMAL, deactivating locally');
      this._deactivateLocal();
    }
  }
  
  /**
   * Handle system suspend (sleep)
   * 
   * CRITICAL CHANGE: This method should NOT be called when Away Mode is active!
   * The powerSaveBlocker should prevent suspend from happening in the first place.
   * 
   * This method is only for when Away Mode is NOT active and the system naturally
   * goes to sleep. In that case, we just clean up any lingering state.
   * 
   * If suspend happens despite Away Mode being active (forced sleep, lid close, etc.),
   * main.js handles it specially WITHOUT calling this method.
   */
  handleSuspend() {
    console.log('[AwayManager] 💤 handleSuspend called');
    console.log('[AwayManager] Current state.isActive:', this.state.isActive);
    
    // If Away Mode is active, this should NOT have been called!
    // The powerSaveBlocker should prevent suspend.
    if (this.state.isActive) {
      console.log('[AwayManager] ⚠️ WARNING: handleSuspend called while Away Mode is active!');
      console.log('[AwayManager] ⚠️ This indicates a bug or forced sleep event.');
      console.log('[AwayManager] ⚠️ NOT releasing powerSaveBlocker - preserving Away Mode state.');
      
      // Save state for resume but do NOT release the blocker
      this.state.wasActiveBeforeSleep = true;
      this.state.wasEnforceDisplayOffBeforeSleep = this.state.enforceDisplayOff;
      
      // Stop display-off loops (they're useless while sleeping)
      this._stopDisplayOffLoop();
      this._stopUserActivityWatch();
      
      return;
    }
    
    // Away Mode is NOT active - clean up any lingering state
    console.log('[AwayManager] 💤 Normal suspend (Away Mode not active)');
    
    // Stop any lingering display-off loops
    this._stopDisplayOffLoop();
    this._stopUserActivityWatch();
    
    // Clean up power blocker if somehow still active
    if (this.state.powerBlockerId !== null) {
      try {
        powerSaveBlocker.stop(this.state.powerBlockerId);
        console.log('[AwayManager] ✅ Cleaned up lingering power blocker:', this.state.powerBlockerId);
        
        if (this.awayModeIPC && typeof this.awayModeIPC.sendPowerBlockerStatus === 'function') {
          this.awayModeIPC.sendPowerBlockerStatus('STOPPED', this.state.powerBlockerId);
        }
      } catch (err) {
        console.error('[AwayManager] Failed to stop power blocker:', err);
      }
      this.state.powerBlockerId = null;
    }
    
    // Reset state
    this.state.wasActiveBeforeSleep = false;
    this.state.wasEnforceDisplayOffBeforeSleep = false;
    this.state.isActive = false;
    this.state.enforceDisplayOff = false;
    this.state.userReturnedNotified = false;
    this.state.activatedAtMs = null;
    
    console.log('[AwayManager] 💤 Suspend cleanup complete');
  }
  
  /**
   * Handle system resume (wake from sleep)
   * Called from main.js powerMonitor.on('resume')
   * Re-enables Away Mode if it was active before sleep
   * @returns {Promise<{ success: boolean, wasRestored: boolean, error?: string }>}
   */
  async handleResume() {
    console.log('[AwayManager] 💡 handleResume called - system woke up');
    console.log('[AwayManager] 💡 State before sleep:', {
      wasActive: this.state.wasActiveBeforeSleep,
      wasEnforceDisplayOff: this.state.wasEnforceDisplayOffBeforeSleep
    });
    
    // If Away Mode was NOT active before sleep, nothing to restore
    if (!this.state.wasActiveBeforeSleep) {
      console.log('[AwayManager] 💡 Away Mode was not active before sleep - nothing to restore');
      return { success: true, wasRestored: false };
    }
    
    // CRITICAL: Re-enable Away Mode to prevent system from sleeping again
    console.log('[AwayManager] 💡 Re-enabling Away Mode after wake...');
    
    try {
      // Re-activate locally - use the saved display enforcement setting
      // AWAY must continue enforcing display-off after wake as well.
      const skipDisplayOff = false;
      this._activateLocal({ skipDisplayOff });
      
      // Update database to ensure consistency
      await this._updateDatabaseMode('AWAY');
      
      console.log('[AwayManager] ✅ Away Mode restored after wake (skipDisplayOff:', skipDisplayOff, ')');
      this.awayModeIPC?.sendEnabled();
      
      // Clear the saved state
      this.state.wasActiveBeforeSleep = false;
      this.state.wasEnforceDisplayOffBeforeSleep = false;
      
      return { success: true, wasRestored: true };
    } catch (error) {
      console.error('[AwayManager] ❌ Failed to restore Away Mode after wake:', error);
      return { success: false, wasRestored: false, error: error.message };
    }
  }
  
  /**
   * Cleanup on app quit
   */
  cleanup() {
    // Stop display-off loop
    this._stopDisplayOffLoop();
    this._stopUserActivityWatch();
    
    // Stop OS-native sleep blocker
    this._stopNativeSleepBlocker();
    
    if (this.state.powerBlockerId !== null) {
      powerSaveBlocker.stop(this.state.powerBlockerId);
      this.state.powerBlockerId = null;
      console.log('[AwayManager] Power save blocker stopped');
    }
    this.state.isActive = false;
    this.state.enforceDisplayOff = false;
    this.state.userReturnedNotified = false;
    this.state.activatedAtMs = null;
  }
  
  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================
  
  _setupIpcHandlers() {
    // NOTE: User Returned modal removed - these handlers kept for backward compatibility
    // but the modal no longer appears. Away Mode is controlled from Dashboard.
    
    ipcMain.on(AWAY_IPC_CHANNELS.DISABLE_CONFIRMED, async () => {
      console.log('[AwayManager] User confirmed disable (legacy IPC)');
      await this.disable();
    });
    
    ipcMain.on(AWAY_IPC_CHANNELS.KEEP_CONFIRMED, () => {
      console.log('[AwayManager] User chose to keep Away Mode (legacy IPC)');
      // If somehow triggered, restart enforcement
      this.state.userReturnedNotified = false;
      this.state.enforceDisplayOff = true;
      this.state.activatedAtMs = Date.now();
      this._startDisplayOffLoop();
      this._startUserActivityWatch();
      this._turnOffDisplay();
    });
    
    // Camera check result is handled in _runPreflightChecks via ipcMain.once
  }
  
  async _checkFeatureFlag() {
    try {
      const { data, error } = await this.supabase
        .from('feature_flags')
        .select('enabled')
        .eq('name', 'away_mode')
        .single();
      
      if (error) {
        console.error('[AwayManager] Feature flag check error:', error);
        return false;
      }
      
      this.state.featureEnabled = data?.enabled || false;
      return this.state.featureEnabled;
    } catch (err) {
      console.error('[AwayManager] Feature flag check failed:', err);
      return false;
    }
  }
  
  /**
   * Run preflight checks for Away Mode
   * NOTE: Camera check REMOVED - Away Mode does NOT require camera access.
   * Camera is only needed when starting Live View, not for Away Mode itself.
   * This was causing Away Mode to fail when camera was busy or unavailable,
   * and was also unnecessarily activating the camera LED.
   */
  async _runPreflightChecks() {
    console.log('[AwayManager] Running preflight checks (camera check DISABLED)');
    
    // Away Mode only needs:
    // 1. Power management capability (always available on desktop)
    // 2. Feature flag (checked separately)
    // Camera is NOT required for Away Mode!
    
    return {
      power: true,
      success: true,
      errors: []
    };
  }

  _shouldEnforceDisplayOffFromStatus(status) {
    const manualAwayCommands = new Set(['ENTER_AWAY', 'ARM', 'SET_DEVICE_MODE:AWAY']);
    const lastCommand = status?.last_command || null;
    const lastCommandAt = status?.last_command_at ? Date.parse(status.last_command_at) : 0;
    const commandAgeMs = Number.isFinite(lastCommandAt) && lastCommandAt > 0 ? Date.now() - lastCommandAt : null;

    // v2.4.6: Product requirement changed — if device_status says AWAY, the
    // screen must turn off within seconds after install/startup/restart as well.
    // Keep command detection only for diagnostics/backward context; return true.
    const isManualAwayCommand = manualAwayCommands.has(lastCommand);
    void isManualAwayCommand;

    // If last_command is unavailable/old because of a Realtime race, still treat
    // an active armed motion/baby-monitor state as user intent, but only when the
    // command timestamp is recent enough to avoid converting old Auto-Away on
    // cold start into forced black-screen behavior.
    const hasManualSensorIntent = !!(status?.is_armed && (status?.motion_enabled || status?.baby_monitor_enabled));
    const hasRecentCommand = typeof commandAgeMs === 'number' && commandAgeMs >= 0 && commandAgeMs <= 2 * 60 * 1000;
    void hasManualSensorIntent;
    void hasRecentCommand;

    return true;
  }
  
  /**
   * Activate Away Mode locally
   * @param {Object} options - Optional configuration
   * @param {boolean} options.skipDisplayOff - If true, don't turn off display (Auto-Away mode)
   */
  _activateLocal(options = {}) {
    const { skipDisplayOff = false } = options;
    
    console.log('[AwayManager] Activating locally');
    console.log('[AwayManager] skipDisplayOff:', skipDisplayOff);
    this.state.isActive = true;

    this.state.activatedAtMs = Date.now();

    // Reset "user returned" latch on each activation.
    this.state.userReturnedNotified = false;

    // v2.4.6: AWAY must always force the screen off, including Auto-Away/startup.
    // Keep skipDisplayOff support only for legacy callers, but DB sync/startup now
    // passes skipDisplayOff=false so installed/updated agents behave consistently.
    this.state.enforceDisplayOff = !skipDisplayOff;
    if (skipDisplayOff) {
      this._stopDisplayOffLoop();
      this._stopUserActivityWatch();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL: AWAY MUST prevent system sleep!
    // The computer should NEVER enter full sleep while ANY Away Mode is active.
    // Sleep is ONLY allowed when:
    //   1. Away Mode is manually disabled from Dashboard
    //   2. Electron application is closed
    // 
    // Display behavior:
    //   - AWAY: forces display off + 30s reinforcement loop, while preventing system sleep
    //
    // v2.2.0 FIX: Use OS-native commands to prevent system sleep WITHOUT
    // blocking the display timeout. Electron's 'prevent-display-sleep' was
    // keeping the screen on forever; 'prevent-app-suspension' didn't prevent
    // system sleep reliably. OS-native approach solves both:
    //   - macOS: caffeinate -dimsu (keeps camera capture alive during display-off)
    //   - Windows: SetThreadExecutionState(ES_CONTINUOUS|ES_SYSTEM_REQUIRED)
    //              (prevents system sleep, allows monitor power-off)
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Start Electron's prevent-app-suspension as a lightweight baseline
    // (prevents app from being suspended in background)
    if (this.state.powerBlockerId === null) {
      this.state.powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      console.log('[AwayManager] Electron power blocker started (prevent-app-suspension):', this.state.powerBlockerId);
    }
    
    // Start OS-native sleep prevention (prevents system sleep, ALLOWS display timeout)
    this._startNativeSleepBlocker();
    
    // Send status to UI for debugging visibility
    if (this.awayModeIPC && typeof this.awayModeIPC.sendPowerBlockerStatus === 'function') {
      console.log('[AwayManager] -> UI power blocker status: STARTED', this.state.powerBlockerId);
      this.awayModeIPC.sendPowerBlockerStatus('STARTED', this.state.powerBlockerId);
    }
    
    // Display behavior
    if (!skipDisplayOff) {
      // AWAY MODE: Turn off display immediately and keep reinforcing it.
      // This is required on macOS because starting camera capture for motion
      // monitoring can wake/keep the panel on even though caffeinate omits -d/-u.
      console.log('[AwayManager] 📴 Away Mode: Turning display off + starting reinforcement loop');
      this._startDisplayOffLoop();
      this._startUserActivityWatch();
      this._turnOffDisplay();
    } else {
      // Legacy/testing only. Production AWAY should not use skipDisplayOff.
      console.log('[AwayManager] ℹ️ Legacy skipDisplayOff requested: Display follows OS power settings');
    }
  }
  
  _startDisplayOffLoop() {
    if (!this.state.enforceDisplayOff) {
      return;
    }
    // Clear any existing loop
    if (this.state.displayOffLoopId) {
      clearInterval(this.state.displayOffLoopId);
    }
    
    // Check every 30 seconds - if in Away Mode and display might be on, turn it off.
    // CRITICAL SAFETY: If we detect recent user activity (idle time is low), we pause
    // display-off until the OS idle display timeout is reached again.
    this.state.displayOffLoopId = setInterval(() => {
      if (this.state.isActive) {
        if (!this.state.enforceDisplayOff) {
          return;
        }

        // Detect real user activity even when Electron window is hidden/minimized.
        // This is more reliable than focus/unlock/resume events on some systems.
        let idleSeconds = null;
        try {
          idleSeconds = typeof powerMonitor?.getSystemIdleTime === 'function'
            ? powerMonitor.getSystemIdleTime()
            : null;
        } catch (e) {
          idleSeconds = null;
        }

        // If user has interacted recently, pause enforcement but keep the loop alive.
        // Once idle time reaches the OS Display Sleep setting, AWAY will darken again.
        if (typeof idleSeconds === 'number' && idleSeconds <= 8) {
          console.log('[AwayManager] 👤 Detected recent user activity via idleTime=', idleSeconds, 's -> pausing display-off');
          this.handleUserReturned();
          return;
        }

        if (this.state.userReturnedNotified) {
          const displaySleepSeconds = this._getDisplaySleepIdleSeconds();
          if (displaySleepSeconds === null) {
            console.log('[AwayManager] ⏸️ Display Sleep is set to Never; not forcing display off after user return');
            return;
          }
          if (typeof idleSeconds !== 'number') {
            console.log('[AwayManager] ⏸️ Waiting for readable idle time before re-darkening after user return');
            return;
          }
          if (idleSeconds < displaySleepSeconds) {
            console.log('[AwayManager] ⏸️ User returned; waiting for OS display timeout. idleTime=', idleSeconds, 'required=', displaySleepSeconds);
            return;
          }
          console.log('[AwayManager] 📴 OS display timeout reached after user return. idleTime=', idleSeconds, 'required=', displaySleepSeconds);
          this.state.userReturnedNotified = false;
        }

        if (process.platform === 'darwin') {
          this._reassertMacAwaySleepPolicy();
        }

        console.log('[AwayManager] 🔄 Periodic display-off check (Away Mode active). idleTime=', idleSeconds);
        this._turnOffDisplay();
      }
    }, 30000); // 30 seconds
    
    console.log('[AwayManager] Display-off loop started (30s interval)');
  }
  
  _stopDisplayOffLoop() {
    if (this.state.displayOffLoopId) {
      clearInterval(this.state.displayOffLoopId);
      this.state.displayOffLoopId = null;
      console.log('[AwayManager] Display-off loop stopped');
    }
  }

  _startUserActivityWatch() {
    if (!this.state.enforceDisplayOff) return;
    if (this.state.userActivityWatchId) return;

    // Polling fallback: stop enforcement quickly when user becomes active.
    // This prevents "screen turns off every 30s" after the user returned.
    this.state.userActivityWatchId = setInterval(() => {
      if (!this.state.isActive) return;
      if (!this.state.enforceDisplayOff) return;
      if (this.state.userReturnedNotified) return;

      // Small grace window to avoid false positives right at activation.
      const sinceActivate = this.state.activatedAtMs ? Date.now() - this.state.activatedAtMs : 0;
      if (sinceActivate < 8000) return;

      let idleSeconds = null;
      try {
        idleSeconds = typeof powerMonitor?.getSystemIdleTime === 'function'
          ? powerMonitor.getSystemIdleTime()
          : null;
      } catch (e) {
        idleSeconds = null;
      }

      // If user interacted recently, treat as return immediately.
      if (typeof idleSeconds === 'number' && idleSeconds <= 3) {
        console.log('[AwayManager] 👤 User activity detected (watch). idleTime=', idleSeconds, 's');
        this.handleUserReturned();
      }
    }, 1000);

    console.log('[AwayManager] User-activity watch started (1s interval)');
  }

  _stopUserActivityWatch() {
    if (this.state.userActivityWatchId) {
      clearInterval(this.state.userActivityWatchId);
      this.state.userActivityWatchId = null;
      console.log('[AwayManager] User-activity watch stopped');
    }
  }
  
  _getDisplaySleepIdleSeconds() {
    // Only macOS needs this explicit re-darken behavior; other OSes can use
    // the same safe default if Electron exposes idle time reliably.
    const fallbackSeconds = 5 * 60;
    const cacheTtlMs = 5 * 60 * 1000;
    const now = Date.now();

    if (
      typeof this.state.displaySleepSeconds !== 'undefined' &&
      now - this.state.displaySleepSettingCheckedAtMs < cacheTtlMs
    ) {
      return this.state.displaySleepSeconds;
    }

    if (process.platform !== 'darwin') {
      this.state.displaySleepSeconds = fallbackSeconds;
      this.state.displaySleepSettingCheckedAtMs = now;
      return fallbackSeconds;
    }

    try {
      const output = execSync('/usr/bin/pmset -g', {
        encoding: 'utf8',
        timeout: 1500,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const match = output.match(/^\s*displaysleep\s+(\d+)\b/m);
      if (match) {
        const minutes = Number(match[1]);
        this.state.displaySleepSeconds = minutes > 0 ? Math.max(60, minutes * 60) : null;
        this.state.displaySleepSettingCheckedAtMs = now;
        console.log('[AwayManager] macOS active displaysleep setting:', minutes, 'minutes');
        return this.state.displaySleepSeconds;
      }
    } catch (err) {
      console.warn('[AwayManager] Could not read macOS displaysleep setting, using 5 minutes:', err?.message || err);
    }

    this.state.displaySleepSeconds = fallbackSeconds;
    this.state.displaySleepSettingCheckedAtMs = now;
    return fallbackSeconds;
  }

  _reassertMacAwaySleepPolicy() {
    if (process.platform !== 'darwin') return;

    try {
      // v2.4.9: macOS can have camera/Chromium activity at the same time AWAY is
      // active. Reassert only AWAY's policy: keep system awake for monitoring,
      // but never hold display-awake or user-active assertions (-d/-u).
      if (this._nativeSleepBlockerProcess) {
        try { this._nativeSleepBlockerProcess.kill('SIGTERM'); } catch (_) { /* noop */ }
        this._nativeSleepBlockerProcess = null;
      }
      this._startNativeSleepBlocker();
      console.log('[AwayManager] macOS AWAY sleep policy reasserted before display-off');
    } catch (err) {
      console.warn('[AwayManager] macOS AWAY sleep policy reassert failed:', err?.message || err);
    }
  }

  _deactivateLocal() {
    console.log('[AwayManager] Deactivating locally');
    this.state.isActive = false;

    this.state.userReturnedNotified = false;
    this.state.enforceDisplayOff = false;
    this.state.activatedAtMs = null;
    
    // Stop the display-off loop first
    this._stopDisplayOffLoop();
    this._stopUserActivityWatch();
    
    // Stop OS-native sleep blocker
    this._stopNativeSleepBlocker();
    
    // Release Electron power save blocker
    if (this.state.powerBlockerId !== null) {
      const stoppedId = this.state.powerBlockerId;
      try {
        powerSaveBlocker.stop(this.state.powerBlockerId);
      } catch (err) {
        console.error('[AwayManager] Failed to stop power blocker:', err);
      }
      this.state.powerBlockerId = null;
      console.log('[AwayManager] Power save blocker stopped, ID was:', stoppedId);
      
      if (this.awayModeIPC && typeof this.awayModeIPC.sendPowerBlockerStatus === 'function') {
        this.awayModeIPC.sendPowerBlockerStatus('STOPPED', stoppedId);
      }
    } else {
      console.log('[AwayManager] Power save blocker was already null (not running)');
      if (this.awayModeIPC && typeof this.awayModeIPC.sendPowerBlockerStatus === 'function') {
        this.awayModeIPC.sendPowerBlockerStatus('ALREADY_NULL', null);
      }
    }
  }
  
  _turnOffDisplay() {
    const platform = process.platform;
    console.log('[AwayManager] 🖥️ Attempting to turn off display - Platform:', platform);
    
    try {
      if (platform === 'darwin') {
        exec('pmset displaysleepnow', (err, stdout, stderr) => {
          if (err) {
            console.error('[AwayManager] ❌ macOS display off FAILED:', err.message);
            console.error('[AwayManager] stderr:', stderr);
            // Retry after 1 second
            setTimeout(() => {
              console.log('[AwayManager] Retrying macOS display off...');
              exec('pmset displaysleepnow', (err2) => {
                if (err2) console.error('[AwayManager] ❌ Retry FAILED:', err2.message);
                else console.log('[AwayManager] ✅ Retry SUCCESS - display off');
              });
            }, 1000);
          } else {
            console.log('[AwayManager] ✅ macOS display off command executed');
            console.log('[AwayManager] stdout:', stdout);
          }
        });
      } else if (platform === 'win32') {
        // Use PowerShell to turn off monitor - works without nircmd!
        console.log('[AwayManager] 🖥️ Using PowerShell to turn off display...');
        
        // PowerShell command that sends SC_MONITORPOWER message to turn off display
        // SC_MONITORPOWER = 0xF170, WM_SYSCOMMAND = 0x112, HWND_BROADCAST = 0xFFFF
        // lParam: 2 = turn off, 1 = low power, -1 = on
        const psCommand = `powershell -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class Monitor{[DllImport(\\\"user32.dll\\\")]public static extern int SendMessage(int hWnd,int hMsg,int wParam,int lParam);}';[Monitor]::SendMessage(0xFFFF,0x112,0xF170,2)"`;
        
        exec(psCommand, (err, stdout, stderr) => {
          if (err) {
            console.error('[AwayManager] ❌ Windows PowerShell display off FAILED:', err.message);
            console.error('[AwayManager] stderr:', stderr);
            
            // Fallback: Try nircmd if available
            const nircmdPath = path.join(__dirname, '..', 'nircmd.exe');
            const fs = require('fs');
            if (fs.existsSync(nircmdPath)) {
              console.log('[AwayManager] Trying nircmd fallback...');
              exec(`"${nircmdPath}" monitor off`, (err2) => {
                if (err2) console.error('[AwayManager] ❌ nircmd FAILED:', err2.message);
                else console.log('[AwayManager] ✅ nircmd SUCCESS - display off');
              });
            } else {
              console.log('[AwayManager] ⚠️ No fallback available. Display will turn off based on Windows Power Settings.');
            }
          } else {
            console.log('[AwayManager] ✅ Windows display off command executed (PowerShell)');
          }
        });
      } else if (platform === 'linux') {
        exec('xset dpms force off', (err, stdout, stderr) => {
          if (err) {
            console.error('[AwayManager] ❌ Linux display off FAILED:', err.message);
            console.error('[AwayManager] stderr:', stderr);
            // Retry after 1 second
            setTimeout(() => {
              console.log('[AwayManager] Retrying Linux display off...');
              exec('xset dpms force off', (err2) => {
                if (err2) console.error('[AwayManager] ❌ Retry FAILED:', err2.message);
                else console.log('[AwayManager] ✅ Retry SUCCESS - display off');
              });
            }, 1000);
          } else {
            console.log('[AwayManager] ✅ Linux display off command executed');
            console.log('[AwayManager] stdout:', stdout);
          }
        });
      }
    } catch (err) {
      console.error('[AwayManager] Failed to turn off display:', err);
    }
  }
  
  async _updateDatabaseMode(mode) {
    if (!this.deviceId) return;
    
    const { error } = await this.supabase
      .from('device_status')
      .update({ 
        device_mode: mode,
        updated_at: new Date().toISOString()
      })
      .eq('device_id', this.deviceId);
    
    if (error) {
      console.error('[AwayManager] Database update error:', error);
      throw error;
    }
    
    console.log('[AwayManager] Database updated to', mode);
  }

  // =========================================================================
  // OS-NATIVE SLEEP PREVENTION (v2.2.0)
  // Prevents system sleep WITHOUT blocking display timeout.
  // =========================================================================

  _startNativeSleepBlocker() {
    if (this._nativeSleepBlockerProcess) {
      console.log('[AwayManager] Native sleep blocker already running');
      return;
    }

    const platform = process.platform;

    if (platform === 'darwin') {
      // v2.52.39: caffeinate -ims ONLY (no -d, no -u).
      // -i blocks idle sleep, -s blocks system sleep on AC, -m blocks disk sleep.
      // We intentionally OMIT -d (prevent display sleep) and -u (declare user active)
      // so that the display CAN turn off while the camera/inference stays alive.
      // This is the user-requested behavior for Away Mode on Mac (battery + privacy).
      try {
        this._nativeSleepBlockerProcess = spawn('/usr/bin/caffeinate', ['-i', '-m', '-s'], {
          stdio: 'ignore',
          detached: false,
        });
        this._nativeSleepBlockerProcess.on('error', (err) => {
          console.error('[AwayManager] caffeinate failed:', err.message);
          this._nativeSleepBlockerProcess = null;
        });
        this._nativeSleepBlockerProcess.on('exit', (code) => {
          console.log('[AwayManager] caffeinate exited with code:', code);
          this._nativeSleepBlockerProcess = null;
        });
        console.log('[AwayManager] ✅ macOS: caffeinate -ims started (system awake, display CAN sleep)');
        // Watchdog: respawn caffeinate if it dies while Away Mode is active.
        if (this._macWatchdogTimer) clearInterval(this._macWatchdogTimer);
        this._macWatchdogTimer = setInterval(() => {
          try {
            if (!this._nativeSleepBlockerProcess) {
              console.warn('[AwayManager] Watchdog: caffeinate missing — respawning');
              this._nativeSleepBlockerProcess = spawn('/usr/bin/caffeinate', ['-i', '-m', '-s'], {
                stdio: 'ignore', detached: false,
              });
              this._nativeSleepBlockerProcess.on('exit', () => { this._nativeSleepBlockerProcess = null; });
              this._nativeSleepBlockerProcess.on('error', () => { this._nativeSleepBlockerProcess = null; });
            }
          } catch (e) {
            console.error('[AwayManager] Watchdog error:', e?.message || e);
          }
        }, 20000);
      } catch (err) {
        console.error('[AwayManager] Failed to start caffeinate:', err);
      }
    } else if (platform === 'win32') {
      // Windows: Use PowerShell to set ES_CONTINUOUS | ES_SYSTEM_REQUIRED
      // This prevents system sleep but does NOT prevent monitor power-off
      // The -NoExit flag keeps the process alive; when we kill it, the state resets
      const psScript = `
        Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class SleepBlocker{[DllImport("kernel32.dll")]public static extern uint SetThreadExecutionState(uint esFlags);}'
        [SleepBlocker]::SetThreadExecutionState(0x80000001)
        while($true){Start-Sleep -Seconds 30;[SleepBlocker]::SetThreadExecutionState(0x80000001)}
      `.trim();

      try {
        this._nativeSleepBlockerProcess = spawn('powershell', [
          '-WindowStyle', 'Hidden',
          '-Command', psScript,
        ], {
          stdio: 'ignore',
          detached: false,
        });
        this._nativeSleepBlockerProcess.on('error', (err) => {
          console.error('[AwayManager] PowerShell sleep blocker failed:', err.message);
          this._nativeSleepBlockerProcess = null;
        });
        this._nativeSleepBlockerProcess.on('exit', (code) => {
          console.log('[AwayManager] PowerShell sleep blocker exited with code:', code);
          this._nativeSleepBlockerProcess = null;
        });
        console.log('[AwayManager] ✅ Windows: SetThreadExecutionState started (prevents sleep, allows monitor off)');
      } catch (err) {
        console.error('[AwayManager] Failed to start PowerShell sleep blocker:', err);
      }
    } else {
      console.log('[AwayManager] ℹ️ No native sleep blocker for platform:', platform);
    }
  }

  _stopNativeSleepBlocker() {
    if (this._macWatchdogTimer) {
      clearInterval(this._macWatchdogTimer);
      this._macWatchdogTimer = null;
    }
    if (!this._nativeSleepBlockerProcess) {
      return;
    }

    try {
      this._nativeSleepBlockerProcess.kill('SIGTERM');
      console.log('[AwayManager] ✅ Native sleep blocker stopped');
    } catch (err) {
      console.error('[AwayManager] Failed to stop native sleep blocker:', err);
    }
    this._nativeSleepBlockerProcess = null;

    // Windows: explicitly clear the execution state flag
    if (process.platform === 'win32') {
      const { exec } = require('child_process');
      exec('powershell -Command "Add-Type -TypeDefinition \'using System;using System.Runtime.InteropServices;public class SleepBlocker{[DllImport(\\\"kernel32.dll\\\")]public static extern uint SetThreadExecutionState(uint esFlags);}\';[SleepBlocker]::SetThreadExecutionState(0x80000000)"', (err) => {
        if (err) console.warn('[AwayManager] Failed to clear execution state:', err.message);
        else console.log('[AwayManager] ✅ Windows execution state cleared (ES_CONTINUOUS only)');
      });
    }
  }
}

module.exports = AwayManager;
