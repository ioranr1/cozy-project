/**
 * Away Mode IPC Bridge
 * ====================
 * 
 * IPC channel definitions and renderer-side API for Away Mode.
 * This file can be imported into preload.js.
 */

const { ipcRenderer } = require('electron');

// ============================================================
// IPC CHANNEL NAMES (constants for consistency)
// ============================================================

const AWAY_IPC_CHANNELS = {
  // Main → Renderer
  ENABLED: 'away-mode-enabled',
  DISABLED: 'away-mode-disabled',
  PREFLIGHT_FAILED: 'away-mode-preflight-failed',
  USER_RETURNED: 'away-mode-user-returned',
  CHECK_CAMERA: 'away-mode-check-camera',
  
  // Renderer → Main
  DISABLE_CONFIRMED: 'away-mode-disable-confirmed',
  KEEP_CONFIRMED: 'away-mode-keep-confirmed',
  CAMERA_CHECK_RESULT: 'away-mode-camera-check-result',
};

// ============================================================
// RENDERER API (for preload.js)
// ============================================================

/**
 * Away Mode API to expose via contextBridge
 * Usage in preload.js:
 * 
 * const { awayModeAPI } = require('./away/away-ipc');
 * contextBridge.exposeInMainWorld('electronAPI', {
 *   ...existingAPI,
 *   ...awayModeAPI
 * });
 */
const awayModeAPI = {
  // -------------------------------------------------------------------------
  // Incoming Events (Main → Renderer)
  // -------------------------------------------------------------------------
  
  /**
   * Called when Away Mode is successfully enabled
   * @param {function} callback - () => void
   */
  onAwayModeEnabled: (callback) => {
    ipcRenderer.on(AWAY_IPC_CHANNELS.ENABLED, () => {
      callback();
    });
  },
  
  /**
   * Called when Away Mode is disabled
   * @param {function} callback - () => void
   */
  onAwayModeDisabled: (callback) => {
    ipcRenderer.on(AWAY_IPC_CHANNELS.DISABLED, () => {
      callback();
    });
  },
  
  /**
   * Called when preflight checks fail
   * @param {function} callback - (errors: string[]) => void
   */
  onAwayModePreflightFailed: (callback) => {
    ipcRenderer.on(AWAY_IPC_CHANNELS.PREFLIGHT_FAILED, (event, errors) => {
      callback(errors);
    });
  },
  
  /**
   * Called when user activity is detected while in Away Mode
   * @param {function} callback - (strings: object) => void
   */
  onAwayModeUserReturned: (callback) => {
    ipcRenderer.on(AWAY_IPC_CHANNELS.USER_RETURNED, (event, strings) => {
      callback(strings);
    });
  },
  
  /**
   * Called when main process wants to check camera availability
   * Renderer should respond via sendCameraCheckResult
   * @param {function} callback - () => void
   */
  onAwayModeCheckCamera: (callback) => {
    ipcRenderer.on(AWAY_IPC_CHANNELS.CHECK_CAMERA, () => {
      callback();
    });
  },
  
  // -------------------------------------------------------------------------
  // Outgoing Events (Renderer → Main)
  // -------------------------------------------------------------------------
  
  /**
   * User confirmed to disable Away Mode
   */
  awayModeDisableConfirmed: () => {
    ipcRenderer.send(AWAY_IPC_CHANNELS.DISABLE_CONFIRMED);
  },
  
  /**
   * User chose to keep Away Mode active
   */
  awayModeKeepConfirmed: () => {
    ipcRenderer.send(AWAY_IPC_CHANNELS.KEEP_CONFIRMED);
  },
  
  /**
   * Send camera availability check result
   * @param {boolean} hasCamera - Whether camera is available
   */
  sendCameraCheckResult: (hasCamera) => {
    ipcRenderer.send(AWAY_IPC_CHANNELS.CAMERA_CHECK_RESULT, hasCamera);
  },
};

// ============================================================
// MAIN PROCESS HELPERS
// ============================================================

/**
 * Helper class for main process to send Away Mode events
 * Usage in main.js:
 * 
 * const { AwayModeIPC } = require('./away/away-ipc');
 * const awayIPC = new AwayModeIPC(mainWindow);
 * awayIPC.sendEnabled();
 */
class AwayModeIPC {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
  }
  
  updateWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }
  
  sendEnabled() {
    this.mainWindow?.webContents.send(AWAY_IPC_CHANNELS.ENABLED);
  }
  
  sendDisabled() {
    this.mainWindow?.webContents.send(AWAY_IPC_CHANNELS.DISABLED);
  }
  
  sendPreflightFailed(errors) {
    this.mainWindow?.webContents.send(AWAY_IPC_CHANNELS.PREFLIGHT_FAILED, errors);
  }
  
  sendUserReturned(strings) {
    this.mainWindow?.webContents.send(AWAY_IPC_CHANNELS.USER_RETURNED, strings);
  }
  
  sendCheckCamera() {
    this.mainWindow?.webContents.send(AWAY_IPC_CHANNELS.CHECK_CAMERA);
  }
}

module.exports = {
  AWAY_IPC_CHANNELS,
  awayModeAPI,
  AwayModeIPC
};
