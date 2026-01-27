/**
 * Away Mode Manager
 * =================
 * 
 * Handles all Away Mode logic for the Electron main process:
 * - Power save blocker management
 * - Display control (platform-specific)
 * - Preflight checks
 * - User return detection
 * 
 * Usage:
 * const AwayManager = require('./away/away-manager');
 * const awayManager = new AwayManager({ supabase, ipcMain });
 * await awayManager.enable(deviceId, mainWindow, language);
 */

const { powerSaveBlocker, ipcMain } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const { getAwayString, getAwayStrings } = require('./away-strings');
const { AwayModeIPC, AWAY_IPC_CHANNELS } = require('./away-ipc');

class AwayManager {
  constructor({ supabase }) {
    this.supabase = supabase;
    this.awayModeIPC = null;
    
    // State
    this.state = {
      isActive: false,
      powerBlockerId: null,
      featureEnabled: false,
      displayOffLoopId: null // Interval ID for periodic display-off
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
   * @param {boolean} options.skipDisplayOff - If true, don't turn off display (used for Auto-Away on startup)
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
      
      // Run preflight checks BEFORE any state changes
      const preflight = await this._runPreflightChecks();
      console.log('[AwayManager] Preflight results:', preflight);
      
      if (!preflight.camera) {
        // Preflight failed - just notify, do NOT update database
        // The command handler will handle the status update
        console.log('[AwayManager] Preflight failed - camera not available');
        this.awayModeIPC?.sendPreflightFailed(preflight.errors);
        return { success: false, error: preflight.errors.join(', ') };
      }
      
      // All checks passed - now activate
      // First update database to ensure consistency
      console.log('[AwayManager] Updating database to AWAY...');
      await this._updateDatabaseMode('AWAY');
      
      // Then activate locally - pass skipDisplayOff option
      this._activateLocal({ skipDisplayOff });
      
      console.log('[AwayManager] ✓ Away Mode enabled successfully');
      if (skipDisplayOff) {
        console.log('[AwayManager] ℹ️ Display off SKIPPED (Auto-Away mode)');
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
   */
  handleUserReturned() {
    if (!this.state.isActive) return;
    
    console.log('[AwayManager] User returned detected');
    const strings = getAwayStrings(this.language);
    this.awayModeIPC?.sendUserReturned(strings);
  }
  
  /**
   * Sync local state with database status
   * @param {object} status - device_status row
   */
  syncWithDatabaseStatus(status) {
    if (status.device_mode === 'AWAY' && !this.state.isActive) {
      console.log('[AwayManager] Syncing: DB says AWAY, activating locally');
      this._activateLocal();
    } else if (status.device_mode === 'NORMAL' && this.state.isActive) {
      console.log('[AwayManager] Syncing: DB says NORMAL, deactivating locally');
      this._deactivateLocal();
    }
  }
  
  /**
   * Cleanup on app quit
   */
  cleanup() {
    // Stop display-off loop
    this._stopDisplayOffLoop();
    
    if (this.state.powerBlockerId !== null) {
      powerSaveBlocker.stop(this.state.powerBlockerId);
      this.state.powerBlockerId = null;
      console.log('[AwayManager] Power save blocker stopped');
    }
    this.state.isActive = false;
  }
  
  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================
  
  _setupIpcHandlers() {
    ipcMain.on(AWAY_IPC_CHANNELS.DISABLE_CONFIRMED, async () => {
      console.log('[AwayManager] User confirmed disable');
      await this.disable();
    });
    
    ipcMain.on(AWAY_IPC_CHANNELS.KEEP_CONFIRMED, () => {
      console.log('[AwayManager] User chose to keep Away Mode');
      // Just hide the modal, stay in away mode
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
  
  async _runPreflightChecks() {
    const results = {
      power: true,
      camera: false,
      errors: []
    };
    
    // Check camera - ask renderer to verify
    return new Promise((resolve) => {
      this.awayModeIPC?.sendCheckCamera();
      
      const timeout = setTimeout(() => {
        results.errors.push(getAwayString('cameraRequired', this.language));
        resolve(results);
      }, 5000);
      
      ipcMain.once(AWAY_IPC_CHANNELS.CAMERA_CHECK_RESULT, (event, hasCamera) => {
        clearTimeout(timeout);
        results.camera = hasCamera;
        if (!hasCamera) {
          results.errors.push(getAwayString('cameraRequired', this.language));
        }
        resolve(results);
      });
    });
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
    
    // Use 'prevent-app-suspension' to keep the Electron process alive
    // This does NOT prevent the display from sleeping - it only keeps the app running
    this.state.powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log('[AwayManager] Power save blocker started (prevent-app-suspension):', this.state.powerBlockerId);
    
    // Verify it's active
    if (powerSaveBlocker.isStarted(this.state.powerBlockerId)) {
      console.log('[AwayManager] ✓ App suspension prevention is ACTIVE');
    } else {
      console.error('[AwayManager] ✗ Failed to activate app suspension prevention!');
    }
    
    // CRITICAL: Only turn off display and start loop for MANUAL mode
    // Auto-Away (skipDisplayOff=true) lets the OS manage display power
    if (!skipDisplayOff) {
      // MANUAL MODE: Immediately turn off the display
      this._turnOffDisplay();
      
      // Start periodic display-off loop (every 30 seconds) to re-turn off display
      // if user wakes it accidentally. This ensures display stays off in Away Mode.
      this._startDisplayOffLoop();
    } else {
      // AUTO-AWAY MODE: Do NOT turn off display, let OS power settings manage it
      console.log('[AwayManager] ℹ️ Auto-Away: Display will follow OS power settings');
    }
  }
  
  _startDisplayOffLoop() {
    // Clear any existing loop
    if (this.state.displayOffLoopId) {
      clearInterval(this.state.displayOffLoopId);
    }
    
    // Check every 30 seconds - if in Away Mode and display might be on, turn it off
    this.state.displayOffLoopId = setInterval(() => {
      if (this.state.isActive) {
        console.log('[AwayManager] 🔄 Periodic display-off check (Away Mode active)');
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
  
  _deactivateLocal() {
    console.log('[AwayManager] Deactivating locally');
    this.state.isActive = false;
    
    // Stop the display-off loop first
    this._stopDisplayOffLoop();
    
    // Release power save blocker
    if (this.state.powerBlockerId !== null) {
      powerSaveBlocker.stop(this.state.powerBlockerId);
      this.state.powerBlockerId = null;
      console.log('[AwayManager] Power save blocker stopped');
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
}

module.exports = AwayManager;
