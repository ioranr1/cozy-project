/**
 * Away Mode Preload Additions
 * ===========================
 * 
 * Add these to your existing preload.js to enable Away mode IPC.
 * 
 * IMPORTANT: This file does NOT touch any video/WebRTC logic.
 */

const { contextBridge, ipcRenderer } = require('electron');

// ============================================================
// AWAY MODE IPC BRIDGE
// ============================================================

const awayModeAPI = {
  // ============================================================
  // Incoming events (main -> renderer)
  // ============================================================
  
  /**
   * Called when Away mode is successfully enabled
   * @param {function} callback - (data: { message: string }) => void
   */
  onAwayModeEnabled: (callback) => {
    ipcRenderer.on('away-mode-enabled', (event, data) => {
      callback(data);
    });
  },
  
  /**
   * Called when Away mode is disabled
   * @param {function} callback - (data: { message: string }) => void
   */
  onAwayModeDisabled: (callback) => {
    ipcRenderer.on('away-mode-disabled', (event, data) => {
      callback(data);
    });
  },
  
  /**
   * Called when preflight checks fail
   * @param {function} callback - (data: { title: string, errors: string[] }) => void
   */
  onAwayModePreflightFailed: (callback) => {
    ipcRenderer.on('away-mode-preflight-failed', (event, data) => {
      callback(data);
    });
  },
  
  /**
   * Called when user activity is detected in Away mode
   * Shows prompt to disable Away mode
   * @param {function} callback - (data: { strings: object }) => void
   */
  onAwayModeUserReturned: (callback) => {
    ipcRenderer.on('away-mode-user-returned', (event, data) => {
      callback(data);
    });
  },
  
  /**
   * Called when main process wants to check camera availability
   * Renderer should respond via awayModeCameraCheckResult
   * @param {function} callback - () => void
   */
  onAwayModeCheckCamera: (callback) => {
    ipcRenderer.on('away-mode-check-camera', () => {
      callback();
    });
  },
  
  // ============================================================
  // Outgoing events (renderer -> main)
  // ============================================================
  
  /**
   * User confirmed to disable Away mode
   */
  awayModeDisableConfirmed: () => {
    ipcRenderer.send('away-mode-disable-confirmed');
  },
  
  /**
   * User chose to keep Away mode active
   */
  awayModeKeep: () => {
    ipcRenderer.send('away-mode-keep');
  },
  
  /**
   * Send camera availability check result
   * @param {object} result - { success: boolean, message?: string }
   */
  awayModeCameraCheckResult: (result) => {
    ipcRenderer.send('away-mode-camera-check-result', result);
  },
};

// ============================================================
// INTEGRATION EXAMPLE
// ============================================================

/**
 * To integrate with your existing preload.js:
 * 
 * Option 1: Merge into existing electronAPI
 * 
 * contextBridge.exposeInMainWorld('electronAPI', {
 *   // ... existing methods ...
 *   minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
 *   exitApp: () => ipcRenderer.invoke('exit-app'),
 *   
 *   // Away Mode additions
 *   ...awayModeAPI,
 * });
 * 
 * Option 2: Expose as separate API
 * 
 * contextBridge.exposeInMainWorld('awayModeAPI', awayModeAPI);
 */

// Export for merging
module.exports = { awayModeAPI };

// Or expose directly (uncomment if using Option 2):
// contextBridge.exposeInMainWorld('awayModeAPI', awayModeAPI);
