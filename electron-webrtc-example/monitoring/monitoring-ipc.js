/**
 * Monitoring IPC Bridge Definitions
 * ==================================
 * VERSION: 0.1.0 (2026-01-30)
 * 
 * IPC channel definitions for communication between Main and Renderer
 * regarding the monitoring subsystem.
 */

// =============================================================================
// IPC CHANNEL NAMES
// =============================================================================

/**
 * Channels from Main → Renderer
 */
const MAIN_TO_RENDERER = {
  // Start/stop monitoring
  START_MONITORING: 'monitoring-start',
  STOP_MONITORING: 'monitoring-stop',
  
  // Configuration updates
  CONFIG_UPDATED: 'monitoring-config-updated',
  
  // Status notifications
  STATUS_CHANGED: 'monitoring-status-changed',
  
  // Error notifications
  ERROR: 'monitoring-error',
};

/**
 * Channels from Renderer → Main
 */
const RENDERER_TO_MAIN = {
  // Event detection
  EVENT_DETECTED: 'monitoring-event-detected',
  
  // Status reports
  DETECTOR_READY: 'monitoring-detector-ready',
  DETECTOR_ERROR: 'monitoring-detector-error',
  
  // Configuration requests
  GET_CONFIG: 'monitoring-get-config',
  UPDATE_CONFIG: 'monitoring-update-config',
};

// =============================================================================
// PRELOAD DEFINITIONS (for preload.js integration)
// =============================================================================

/**
 * Generate preload bridge code for monitoring
 * Copy this to preload.js under electronAPI
 */
const PRELOAD_TEMPLATE = `
  // -------------------------------------------------------------------------
  // Monitoring
  // -------------------------------------------------------------------------
  
  /**
   * Listen for start monitoring command
   * @param {function(config: object)} callback
   */
  onStartMonitoring: (callback) => {
    ipcRenderer.on('monitoring-start', (event, config) => {
      callback(config);
    });
  },
  
  /**
   * Listen for stop monitoring command
   * @param {function()} callback
   */
  onStopMonitoring: (callback) => {
    ipcRenderer.on('monitoring-stop', () => {
      callback();
    });
  },
  
  /**
   * Listen for configuration updates
   * @param {function(config: object)} callback
   */
  onMonitoringConfigUpdated: (callback) => {
    ipcRenderer.on('monitoring-config-updated', (event, config) => {
      callback(config);
    });
  },
  
  /**
   * Send detected event to main process
   * @param {object} event - { sensor_type, label, confidence, timestamp, metadata }
   */
  sendMonitoringEvent: (event) => {
    ipcRenderer.send('monitoring-event-detected', event);
  },
  
  /**
   * Notify main that detector is ready
   * @param {string} sensorType - 'motion' or 'sound'
   */
  notifyDetectorReady: (sensorType) => {
    ipcRenderer.send('monitoring-detector-ready', sensorType);
  },
  
  /**
   * Notify main that detector encountered an error
   * @param {string} sensorType - 'motion' or 'sound'
   * @param {string} error - Error message
   */
  notifyDetectorError: (sensorType, error) => {
    ipcRenderer.send('monitoring-detector-error', { sensorType, error });
  },
  
  /**
   * Request current monitoring configuration
   * @returns {Promise<object>}
   */
  getMonitoringConfig: () => ipcRenderer.invoke('monitoring-get-config'),
  
  /**
   * Update monitoring configuration
   * @param {object} config - Partial config to update
   * @returns {Promise<{success: boolean, config?: object, error?: string}>}
   */
  updateMonitoringConfig: (config) => ipcRenderer.invoke('monitoring-update-config', config),
`;

// =============================================================================
// MAIN PROCESS HANDLERS TEMPLATE
// =============================================================================

/**
 * Template for main.js IPC handlers
 * Copy and integrate into main.js
 */
const MAIN_HANDLERS_TEMPLATE = `
  // -------------------------------------------------------------------------
  // Monitoring IPC Handlers
  // -------------------------------------------------------------------------
  
  // Handle event detection from renderer
  ipcMain.on('monitoring-event-detected', async (event, eventData) => {
    console.log('[Main] Monitoring event detected:', eventData);
    await monitoringManager.handleEvent(eventData);
  });
  
  // Handle detector ready notification
  ipcMain.on('monitoring-detector-ready', (event, sensorType) => {
    console.log('[Main] Detector ready:', sensorType);
    monitoringManager.setDetectorReady(sensorType, true);
  });
  
  // Handle detector error
  ipcMain.on('monitoring-detector-error', (event, { sensorType, error }) => {
    console.error('[Main] Detector error:', sensorType, error);
    monitoringManager.setDetectorReady(sensorType, false);
  });
  
  // Handle config request
  ipcMain.handle('monitoring-get-config', async () => {
    return monitoringManager.getConfig();
  });
  
  // Handle config update
  ipcMain.handle('monitoring-update-config', async (event, config) => {
    try {
      const updatedConfig = await monitoringManager.updateConfig(config);
      return { success: true, config: updatedConfig };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
`;

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  MAIN_TO_RENDERER,
  RENDERER_TO_MAIN,
  PRELOAD_TEMPLATE,
  MAIN_HANDLERS_TEMPLATE,
};
