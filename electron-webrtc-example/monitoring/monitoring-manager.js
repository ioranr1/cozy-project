/**
 * Monitoring Manager - State & Event Management
 * ==============================================
 * VERSION: 0.8.0 (2026-02-15)
 * 
 * CHANGELOG:
 * - v0.8.0: Baby Monitor support - enable() activates mic immediately when baby_monitor_enabled.
 *           Mic stays on after Live View closes. Only SET_MONITORING:OFF stops mic.
 *           The Renderer (index.html) is the SOLE reporter to events-report edge function.
 *           Manager now only handles: clip recording trigger, debounce tracking, logging.
 * - v0.6.0: Removed sound detection hardware activation
 * - v0.3.5: CRITICAL FIX - Add sensor preflight check to skip camera if all sensors disabled
 *           Add explicit logging for all enable/disable state transitions
 * - v0.3.4: CRITICAL FIX - Always update security_enabled=false in DB before early return in disable()
 *           Fixes bug where UI showed "active" but camera LED was off
 * - v0.3.3: Pass device_id and device_auth_token to renderer for event reporting
 * - v0.3.2: Force reload config from DB on enable()
 * - v0.3.1: Added local clip recording support
 * 
 * Manages monitoring state, configuration, and event handling.
 * Coordinates between detectors (renderer) and database (Supabase).
 * NOTE: Server event reporting is handled exclusively by the Renderer (index.html).
 * Triggers local clip recording for validated events.
 */

const { mergeWithDefaults, validateSensorConfig } = require('./monitoring-config');

// Sound detection removed (v0.5.0) - replaced by Baby Monitor mode

// Edge function endpoint for event reporting
const EVENTS_REPORT_ENDPOINT = 'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/events-report';

class MonitoringManager {
  constructor({ supabase }) {
    this.supabase = supabase;
    this.mainWindow = null;
    this.deviceId = null;
    this.profileId = null;
    this.deviceAuthToken = null; // For authenticating with edge functions
    
    // State
    this.isActive = false;
    this.isStarting = false;
    this.config = null;
    this.detectorStatus = {
      motion: false,
      sound: false,
    };
    
    // Local clip recorder reference (set by main.js)
    this.clipRecorder = null;
    
    // Debounce tracking
    this.lastEventTime = {
      motion: {},
      sound: {},
    };
    
    // Notification cooldown
    this.lastNotificationTime = 0;
    
    // Pending events queue (for batch processing)
    this.pendingEvents = [];
    this.eventQueueTimer = null;
    
    console.log('[MonitoringManager] Initialized (v0.3.0)');
  }

  // ===========================================================================
  // SETUP
  // ===========================================================================

  setMainWindow(win) {
    this.mainWindow = win;
    console.log('[MonitoringManager] Main window set');
  }

  setDeviceId(id) {
    this.deviceId = id;
    console.log('[MonitoringManager] Device ID set:', id);
  }

  setProfileId(id) {
    this.profileId = id;
    console.log('[MonitoringManager] Profile ID set:', id);
  }

  setDeviceAuthToken(token) {
    this.deviceAuthToken = token;
    console.log('[MonitoringManager] Device auth token set');
  }

  setDetectorReady(sensorType, ready) {
    this.detectorStatus[sensorType] = ready;
    console.log(`[MonitoringManager] Detector ${sensorType} ready:`, ready);
  }

  /**
   * Set the local clip recorder instance
   */
  setClipRecorder(recorder) {
    this.clipRecorder = recorder;
    console.log('[MonitoringManager] Clip recorder set');
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  /**
   * Load configuration from database or return defaults
   */
  async loadConfig() {
    if (!this.deviceId) {
      console.warn('[MonitoringManager] No device ID, using defaults');
      this.config = mergeWithDefaults({});
      return this.config;
    }

    try {
      const { data, error } = await this.supabase
        .from('monitoring_config')
        .select('*')
        .eq('device_id', this.deviceId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        this.config = mergeWithDefaults(data.config);
        console.log('[MonitoringManager] Config loaded from DB');
      } else {
        this.config = mergeWithDefaults({});
        console.log('[MonitoringManager] Using default config');
      }

      return this.config;
    } catch (error) {
      console.error('[MonitoringManager] Failed to load config:', error);
      this.config = mergeWithDefaults({});
      return this.config;
    }
  }

  getConfig() {
    return this.config || mergeWithDefaults({});
  }

  /**
   * Update configuration and persist to database
   */
  async updateConfig(partialConfig) {
    const newConfig = mergeWithDefaults({
      ...this.config,
      ...partialConfig,
      sensors: {
        ...this.config?.sensors,
        ...partialConfig?.sensors,
      },
    });

    // Validate
    const motionValidation = validateSensorConfig(newConfig.sensors.motion, 'motion');
    const soundValidation = validateSensorConfig(newConfig.sensors.sound, 'sound');
    
    if (!motionValidation.valid || !soundValidation.valid) {
      const errors = [...motionValidation.errors, ...soundValidation.errors];
      throw new Error(`Invalid config: ${errors.join(', ')}`);
    }

    // Persist to database
    if (this.deviceId && this.profileId) {
      const { error } = await this.supabase
        .from('monitoring_config')
        .upsert({
          device_id: this.deviceId,
          profile_id: this.profileId,
          config: newConfig,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'device_id',
        });

      if (error) {
        console.error('[MonitoringManager] Failed to save config:', error);
        throw error;
      }
    }

    this.config = newConfig;
    
    // Notify renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('monitoring-config-updated', this.config);
    }

    console.log('[MonitoringManager] Config updated');
    return this.config;
  }

  // ===========================================================================
  // ENABLE / DISABLE
  // ===========================================================================

  async enable() {
    if (this.isActive) {
      console.log('[MonitoringManager] Already active');
      return { success: true };
    }

    // If a start is already in progress, don't send duplicate start signals.
    if (this.isStarting) {
      console.log('[MonitoringManager] Start already in progress');
      return { success: true };
    }

    console.log('[MonitoringManager] ═══════════════════════════════════════════════════');
    console.log('[MonitoringManager] Enable requested');
    console.log('[MonitoringManager] ═══════════════════════════════════════════════════');

    try {
      this.isStarting = true;

      // Always reload config from DB to get latest values
      await this.loadConfig();
      
      let motionEnabled = this.config?.sensors?.motion?.enabled ?? false;
      let babyMonitorEnabled = this.config?.baby_monitor_enabled ?? false;
      
      // Sound detection removed (v0.5.0) - replaced by Baby Monitor mode
      
      console.log('[MonitoringManager] Config loaded for enable:', {
        monitoring_enabled: this.config?.monitoring_enabled,
        motion_enabled: motionEnabled,
        baby_monitor_enabled: babyMonitorEnabled,
      });

      // CRITICAL: Sensor preflight check - skip if ALL sensors disabled
      if (!motionEnabled && !babyMonitorEnabled) {
        console.log('[MonitoringManager] No sensors enabled - skipping activation');
        this.isStarting = false;
        return { success: false, error: 'No sensors enabled (motion or baby monitor).' };
      }

      // Check mainWindow availability
      if (!this.mainWindow) {
        console.error('[MonitoringManager] ❌ No main window reference set!');
        this.isStarting = false;
        return { success: false, error: 'Main window not available' };
      }
      
      if (this.mainWindow.isDestroyed()) {
        console.error('[MonitoringManager] ❌ Main window is destroyed!');
        this.isStarting = false;
        return { success: false, error: 'Main window destroyed' };
      }

      // Include device credentials for event reporting
      const configWithCredentials = {
        ...this.config,
        device_id: this.deviceId,
        device_auth_token: this.deviceAuthToken,
      };
      
      console.log('[MonitoringManager] Sending start-monitoring to renderer...');
      console.log('[MonitoringManager] device_id:', this.deviceId);
      console.log('[MonitoringManager] device_auth_token present:', !!this.deviceAuthToken);
      
      this.mainWindow.webContents.send('start-monitoring', configWithCredentials);
      console.log('[MonitoringManager] ✓ Config sent to renderer');

      // IMPORTANT (SSOT): Do NOT set isActive or update DB here.
      // The renderer will attempt getUserMedia + start detectors.
      // We only mark active after receiving 'monitoring-started' from renderer.
      console.log('[MonitoringManager] ⏳ Waiting for renderer ACK (monitoring-started)...');
      return { success: true, starting: true };
    } catch (error) {
      console.error('[MonitoringManager] ❌ Enable failed:', error);
      this.isStarting = false;
      this.isActive = false;
      return { success: false, error: error.message || 'Enable failed' };
    }
  }

  /**
   * Called by main.js when renderer confirmed monitoring started.
   */
  onRendererStarted(status) {
    this.isStarting = false;
    this.isActive = true;
    console.log('[MonitoringManager] ✓ Renderer confirmed monitoring started', status);
  }

  /**
   * Called by main.js when renderer confirmed monitoring stopped.
   */
  onRendererStopped() {
    this.isStarting = false;
    this.isActive = false;
    console.log('[MonitoringManager] ✓ Renderer confirmed monitoring stopped');
  }

  /**
   * Called by main.js when renderer failed to start monitoring.
   */
  onRendererError(error) {
    this.isStarting = false;
    this.isActive = false;
    console.log('[MonitoringManager] ✗ Renderer reported monitoring error:', error);
  }

  async disable() {
    console.log('[MonitoringManager] Disable requested');

    try {
      // CRITICAL FIX: Always update DB first to ensure security_enabled is false
      // This fixes the bug where UI shows "active" but camera is off
      if (this.deviceId) {
        const { error } = await this.supabase
          .from('device_status')
          .update({
            security_enabled: false,
            motion_enabled: false,
            sound_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('device_id', this.deviceId);

        if (error) {
          console.error('[MonitoringManager] Failed to update device_status:', error);
        } else {
          console.log('[MonitoringManager] ✓ DB updated: security_enabled = false');
        }
      }

      // If already inactive, we still updated DB above (critical for sync)
      if (!this.isActive && !this.isStarting) {
        console.log('[MonitoringManager] Already inactive (DB synced)');
        return { success: true };
      }

      // Send stop command to renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('stop-monitoring');
      }

      this.isActive = false;
      this.isStarting = false;

      // Clear any pending events
      if (this.eventQueueTimer) {
        clearTimeout(this.eventQueueTimer);
        this.eventQueueTimer = null;
      }
      this.pendingEvents = [];

      console.log('[MonitoringManager] ✓ Monitoring disabled');
      return { success: true };
    } catch (error) {
      console.error('[MonitoringManager] Disable failed:', error);
      return { success: false, error: error.message || 'Disable failed' };
    }
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  /**
   * Handle event detected by renderer
   * @param {Object} eventData - Event from detector
   * @param {string} eventData.sensor_type - 'motion' or 'sound'
   * @param {string} eventData.label - Detected label
   * @param {number} eventData.confidence - Confidence score
   * @param {number} eventData.timestamp - Detection timestamp
   * @param {Object} eventData.metadata - Additional metadata
   * @param {string} [eventData.snapshot] - Base64 encoded image (for motion)
   */
  async handleEvent(eventData) {
    const { sensor_type, label, confidence, timestamp, metadata, snapshot } = eventData;

    console.log(`[MonitoringManager] Event: ${sensor_type}/${label} (${(confidence * 100).toFixed(1)}%)`);

    // Check debounce
    const debounceMs = this.config?.sensors?.[sensor_type]?.debounce_ms || 60000;
    const lastTime = this.lastEventTime[sensor_type]?.[label] || 0;
    
    if (timestamp - lastTime < debounceMs) {
      console.log(`[MonitoringManager] Debounced (${debounceMs}ms)`);
      return;
    }

    // Check confidence threshold
    const threshold = this.config?.sensors?.[sensor_type]?.confidence_threshold || 0.5;
    if (confidence < threshold) {
      console.log(`[MonitoringManager] Below threshold (${threshold})`);
      return;
    }

    // Check if label is in targets
    const targets = this.config?.sensors?.[sensor_type]?.targets || [];
    if (targets.length > 0 && !targets.includes(label)) {
      console.log(`[MonitoringManager] Label not in targets`);
      return;
    }

    // Update debounce tracking
    this.lastEventTime[sensor_type][label] = timestamp;

    // NOTE: Server reporting is done by the Renderer (index.html) directly.
    // The manager only logs and could trigger clip recording if needed via separate IPC.
    console.log(`[MonitoringManager] Event accepted: ${sensor_type}/${label} (will be reported by renderer)`);
  }

  // NOTE: reportEventToServer() has been REMOVED in v0.7.0.
  // The Renderer (index.html) is the sole reporter to the events-report edge function.
  // This eliminates the duplicate reporting that caused snapshot-less events.

  // ===========================================================================
  // STATUS
  // ===========================================================================

  isMonitoringActive() {
    return this.isActive;
  }

  getStatus() {
    return {
      isActive: this.isActive,
      config: this.config,
      detectorStatus: this.detectorStatus,
    };
  }
}

module.exports = MonitoringManager;
