/**
 * Monitoring Manager - State & Event Management
 * ==============================================
 * VERSION: 0.2.0 (2026-01-30)
 * 
 * Manages monitoring state, configuration, and event handling.
 * Coordinates between detectors (renderer) and database (Supabase).
 * Sends events to edge function for AI validation and notifications.
 */

const { mergeWithDefaults, validateSensorConfig } = require('./monitoring-config');

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
    this.config = null;
    this.detectorStatus = {
      motion: false,
      sound: false,
    };
    
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
    
    console.log('[MonitoringManager] Initialized (v0.2.0)');
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
      return true;
    }

    console.log('[MonitoringManager] Enable requested');

    // Load config if not loaded
    if (!this.config) {
      await this.loadConfig();
    }

    // Send start command to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('monitoring-start', this.config);
    }

    this.isActive = true;

    // Update device_status in DB
    if (this.deviceId) {
      await this.supabase
        .from('device_status')
        .update({
          security_enabled: true,
          motion_enabled: this.config.sensors.motion.enabled,
          sound_enabled: this.config.sensors.sound.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', this.deviceId);
    }

    console.log('[MonitoringManager] ✓ Monitoring enabled');
    return true;
  }

  async disable() {
    if (!this.isActive) {
      console.log('[MonitoringManager] Already inactive');
      return true;
    }

    console.log('[MonitoringManager] Disable requested');

    // Send stop command to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('monitoring-stop');
    }

    this.isActive = false;

    // Clear any pending events
    if (this.eventQueueTimer) {
      clearTimeout(this.eventQueueTimer);
      this.eventQueueTimer = null;
    }
    this.pendingEvents = [];

    // Update device_status in DB
    if (this.deviceId) {
      await this.supabase
        .from('device_status')
        .update({
          security_enabled: false,
          motion_enabled: false,
          sound_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq('device_id', this.deviceId);
    }

    console.log('[MonitoringManager] ✓ Monitoring disabled');
    return true;
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
    const debounceMs = this.config?.sensors?.[sensor_type]?.debounce_ms || 3000;
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

    // Send event to edge function for AI validation and notifications
    await this.reportEventToServer({
      sensor_type,
      label,
      confidence,
      timestamp,
      metadata,
      snapshot,
    });
  }

  /**
   * Report event to edge function for AI validation and notifications
   */
  async reportEventToServer(eventData) {
    if (!this.deviceId || !this.deviceAuthToken) {
      console.warn('[MonitoringManager] Missing device ID or auth token, skipping server report');
      return null;
    }

    const { sensor_type, label, confidence, timestamp, metadata, snapshot } = eventData;

    try {
      console.log(`[MonitoringManager] Reporting event to server...`);

      const response = await fetch(EVENTS_REPORT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': this.deviceAuthToken,
        },
        body: JSON.stringify({
          device_id: this.deviceId,
          event_type: sensor_type,
          labels: [{ label, confidence }],
          snapshot: snapshot || null,
          timestamp,
          metadata: metadata || {},
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MonitoringManager] Server error: ${response.status} - ${errorText}`);
        return null;
      }

      const result = await response.json();
      
      console.log(`[MonitoringManager] Server response:`, {
        event_id: result.event_id,
        ai_is_real: result.ai_is_real,
        ai_confidence: result.ai_confidence,
        notification_sent: result.notification_sent,
      });

      return result;
    } catch (error) {
      console.error('[MonitoringManager] Failed to report event:', error);
      return null;
    }
  }

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
