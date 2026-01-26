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
      featureEnabled: false
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
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async enable() {
    console.log('[AwayManager] Enable requested');
    
    if (!this.deviceId) {
      return { success: false, error: 'No device ID' };
    }
    
    try {
      // Check feature flag
      const featureEnabled = await this._checkFeatureFlag();
      if (!featureEnabled) {
        return { success: false, error: 'Away Mode feature is not enabled' };
      }
      
      // Run preflight checks
      const preflight = await this._runPreflightChecks();
      
      if (!preflight.camera) {
        // Revert database state
        await this._updateDatabaseMode('NORMAL');
        
        this.awayModeIPC?.sendPreflightFailed(preflight.errors);
        return { success: false, error: preflight.errors.join(', ') };
      }
      
      // Activate locally
      this._activateLocal();
      
      // Update database
      await this._updateDatabaseMode('AWAY');
      
      console.log('[AwayManager] ✓ Away Mode enabled');
      this.awayModeIPC?.sendEnabled();
      
      return { success: true };
    } catch (error) {
      console.error('[AwayManager] Enable failed:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Disable Away Mode
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async disable() {
    console.log('[AwayManager] Disable requested');
    
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
  
  _activateLocal() {
    console.log('[AwayManager] Activating locally');
    this.state.isActive = true;
    
    // Use 'prevent-app-suspension' to keep the process alive
    // while allowing the OS to manage display power settings naturally.
    // This means the screen will turn off after system idle timeout,
    // wake on mouse movement, and turn off again naturally.
    this.state.powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log('[AwayManager] Power save blocker started (prevent-app-suspension):', this.state.powerBlockerId);
    
    // Verify it's active
    if (powerSaveBlocker.isStarted(this.state.powerBlockerId)) {
      console.log('[AwayManager] ✓ App suspension prevention is ACTIVE (display managed by OS)');
    } else {
      console.error('[AwayManager] ✗ Failed to activate app suspension prevention!');
    }
    
    // Try to turn off display
    this._turnOffDisplay();
  }
  
  _deactivateLocal() {
    console.log('[AwayManager] Deactivating locally');
    this.state.isActive = false;
    
    // Release power save blocker
    if (this.state.powerBlockerId !== null) {
      powerSaveBlocker.stop(this.state.powerBlockerId);
      this.state.powerBlockerId = null;
      console.log('[AwayManager] Power save blocker stopped');
    }
  }
  
  _turnOffDisplay() {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin') {
        exec('pmset displaysleepnow', (err) => {
          if (err) console.error('[AwayManager] macOS display off error:', err);
          else console.log('[AwayManager] ✓ macOS display off');
        });
      } else if (platform === 'win32') {
        // Requires nircmd.exe in project folder (optional)
        const nircmdPath = path.join(__dirname, '..', 'nircmd.exe');
        const fs = require('fs');
        
        if (fs.existsSync(nircmdPath)) {
          exec(`"${nircmdPath}" monitor off`, (err) => {
            if (err) console.error('[AwayManager] Windows display off error:', err);
            else console.log('[AwayManager] ✓ Windows display off (nircmd)');
          });
        } else {
          console.log('[AwayManager] nircmd.exe not found, relying on Windows Power Settings');
        }
      } else if (platform === 'linux') {
        exec('xset dpms force off', (err) => {
          if (err) console.error('[AwayManager] Linux display off error:', err);
          else console.log('[AwayManager] ✓ Linux display off');
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
