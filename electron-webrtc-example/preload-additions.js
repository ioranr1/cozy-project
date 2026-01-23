/**
 * Preload.js Additions for WebRTC Live View
 * ==========================================
 * 
 * Add these to your existing preload.js file.
 * These expose IPC channels for the renderer to receive start/stop commands.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Add to your existing contextBridge.exposeInMainWorld('electronAPI', { ... })
const webrtcAPI = {
  // Existing methods...
  // minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  // exitApp: () => ipcRenderer.invoke('exit-app'),
  // loginUser: (credentials) => ipcRenderer.invoke('login-user', credentials),
  // onShowSuccessScreen: (callback) => ipcRenderer.on('show-success-screen', callback),
  
  // NEW: WebRTC Live View IPC
  onStartLiveView: (callback) => {
    ipcRenderer.on('start-live-view', (event, sessionId) => {
      callback(sessionId);
    });
  },
  
  onStopLiveView: (callback) => {
    ipcRenderer.on('stop-live-view', () => {
      callback();
    });
  },
};

// If you're replacing the whole contextBridge:
contextBridge.exposeInMainWorld('electronAPI', webrtcAPI);

/**
 * ============================================================
 * FULL EXAMPLE of preload.js with all methods:
 * ============================================================
 * 
 * const { contextBridge, ipcRenderer } = require('electron');
 * 
 * contextBridge.exposeInMainWorld('electronAPI', {
 *   // Window controls
 *   minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
 *   exitApp: () => ipcRenderer.invoke('exit-app'),
 *   
 *   // Authentication
 *   loginUser: (credentials) => ipcRenderer.invoke('login-user', credentials),
 *   onShowSuccessScreen: (callback) => ipcRenderer.on('show-success-screen', callback),
 *   
 *   // WebRTC Live View
 *   onStartLiveView: (callback) => {
 *     ipcRenderer.on('start-live-view', (event, sessionId) => {
 *       callback(sessionId);
 *     });
 *   },
 *   onStopLiveView: (callback) => {
 *     ipcRenderer.on('stop-live-view', () => {
 *       callback();
 *     });
 *   },
 * });
 */
