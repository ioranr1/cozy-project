/**
 * Electron Preload Script - Complete Implementation
 * ==================================================
 * 
 * Full preload.js with WebRTC Live View + Away Mode IPC bridges.
 * Copy this file to your Electron project.
 */

const { contextBridge, ipcRenderer } = require('electron');

// =============================================================================
// MAIN API - Exposed to Renderer
// =============================================================================

contextBridge.exposeInMainWorld('electronAPI', {
  // -------------------------------------------------------------------------
  // Window Controls
  // -------------------------------------------------------------------------
  
  /**
   * Minimize window to system tray (or taskbar if tray unavailable)
   */
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  
  /**
   * Quit the application
   */
  exitApp: () => ipcRenderer.invoke('exit-app'),

  // -------------------------------------------------------------------------
  // Pairing
  // -------------------------------------------------------------------------
  
  /**
   * Verify a 6-digit pairing code
   * @param {string} code - The 6-digit code
   * @returns {Promise<{success: boolean, deviceId?: string, error?: string}>}
   */
  verifyPairingCode: (code) => ipcRenderer.invoke('verify-pairing-code', code),

  // -------------------------------------------------------------------------
  // WebRTC Live View
  // -------------------------------------------------------------------------
  
  /**
   * Listen for start-live-view command from main process
   * @param {function(sessionId: string)} callback
   */
  onStartLiveView: (callback) => {
    ipcRenderer.on('start-live-view', (event, sessionId) => {
      callback(sessionId);
    });
  },
  
  /**
   * Listen for stop-live-view command from main process
   * @param {function()} callback
   */
  onStopLiveView: (callback) => {
    ipcRenderer.on('stop-live-view', () => {
      callback();
    });
  },
  
  /**
   * Notify main process that WebRTC offer was sent (session is active)
   * @param {string} sessionId
   */
  notifyOfferSent: (sessionId) => {
    ipcRenderer.send('webrtc-offer-sent', sessionId);
  },
  
  /**
   * Notify main process that WebRTC session has ended
   * @param {string} sessionId
   */
  notifySessionEnded: (sessionId) => {
    ipcRenderer.send('webrtc-session-ended', sessionId);
  },

  // -------------------------------------------------------------------------
  // Away Mode
  // -------------------------------------------------------------------------
  
  /**
   * Listen for away mode enabled notification
   * @param {function()} callback
   */
  onAwayModeEnabled: (callback) => {
    ipcRenderer.on('away-mode-enabled', () => {
      callback();
    });
  },
  
  /**
   * Listen for away mode disabled notification
   * @param {function()} callback
   */
  onAwayModeDisabled: (callback) => {
    ipcRenderer.on('away-mode-disabled', () => {
      callback();
    });
  },
  
  /**
   * Listen for away mode preflight failure
   * @param {function(errors: string[])} callback
   */
  onAwayModePreflightFailed: (callback) => {
    ipcRenderer.on('away-mode-preflight-failed', (event, errors) => {
      callback(errors);
    });
  },
  
  /**
   * Listen for user returned detection (while in away mode)
   * @param {function(strings: object)} callback - strings contains localized UI text
   */
  onAwayModeUserReturned: (callback) => {
    ipcRenderer.on('away-mode-user-returned', (event, strings) => {
      callback(strings);
    });
  },
  
  /**
   * Listen for camera check request from main process
   * @param {function()} callback
   */
  onAwayModeCheckCamera: (callback) => {
    ipcRenderer.on('away-mode-check-camera', () => {
      callback();
    });
  },
  
  /**
   * Send camera check result back to main process
   * @param {boolean} hasCamera
   */
  sendCameraCheckResult: (hasCamera) => {
    ipcRenderer.send('away-mode-camera-check-result', hasCamera);
  },
  
  /**
   * User confirmed to disable away mode
   */
  awayModeDisableConfirmed: () => {
    ipcRenderer.send('away-mode-disable-confirmed');
  },
  
  /**
   * User chose to keep away mode active
   */
  awayModeKeepConfirmed: () => {
    ipcRenderer.send('away-mode-keep-confirmed');
  },
  
  /**
   * Listen for power blocker status updates (for debugging)
   * @param {function({status: string, id: number|null})} callback
   */
  onPowerBlockerStatus: (callback) => {
    ipcRenderer.on('away-mode-power-blocker-status', (event, data) => {
      callback(data);
    });
  },

  // -------------------------------------------------------------------------
  // Language
  // -------------------------------------------------------------------------
  
  /**
   * Set the current language
   * @param {string} lang - 'en' or 'he'
   */
  setLanguage: (lang) => ipcRenderer.invoke('set-language', lang),

  // -------------------------------------------------------------------------
  // Auto-Login / Success Screen
  // -------------------------------------------------------------------------
  
  /**
   * Called after successful pairing to sync credentials with main process
   * @param {{profile_id: string, session_token: string, device_id: string}} data
   */
  loginUser: (data) => {
    ipcRenderer.send('login-user', data);
  },
  
  /**
   * Listen for auto-show success screen (when device is already paired)
   * @param {function()} callback
   */
  onShowSuccessScreen: (callback) => {
    ipcRenderer.on('show-success-screen', () => {
      callback();
    });
  }
});

// BUILD STAMP (debug)
const __ELECTRON_PRELOAD_BUILD_ID__ = 'electron-preload-2026-01-28-pb-debug-01';
console.log('[Preload] electronAPI exposed to renderer');
console.log(`[Preload] build: ${__ELECTRON_PRELOAD_BUILD_ID__}`);
