/**
 * Monitoring Manager - State & Event Management
 * ==============================================
 * VERSION: 0.4.2 (2026-02-11)
 * 
 * CHANGELOG:
 * - v0.4.0: CRITICAL FIX - Recover from WebContents crash (isCrashed=true)
 *           Instead of giving up, reload the page and retry frame check
 *           Fixes START→STOP→START cycle where renderer crashes between cycles
 * - v0.3.5: CRITICAL FIX - Add sensor preflight check to skip camera if all sensors disabled
 *           Fixes bug where UI showed "active" but camera LED was off
 * - v0.3.3: Pass device_id and device_auth_token to renderer for event reporting
 * - v0.3.2: Force reload config from DB on enable()
 * - v0.3.1: Added local clip recording support
 * 
 * Manages monitoring state, configuration, and event handling.
 * Coordinates between detectors (renderer) and database (Supabase).
 * Sends events to edge function for AI validation and notifications.
 * Triggers local clip recording for validated events.
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
    
    console.log('[MonitoringManager] Initialized (v0.4.2)');
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
      
      const motionEnabled = this.config?.sensors?.motion?.enabled ?? false;
      const soundEnabled = this.config?.sensors?.sound?.enabled ?? false;
      
      console.log('[MonitoringManager] Config loaded for enable:', {
        monitoring_enabled: this.config?.monitoring_enabled,
        motion_enabled: motionEnabled,
        sound_enabled: soundEnabled,
      });

      // CRITICAL: Sensor preflight check - skip camera if ALL sensors disabled
      if (!motionEnabled && !soundEnabled) {
        console.log('[MonitoringManager] ⚠️ Both sensors disabled - skipping camera activation');
        this.isStarting = false;
        return { success: false, error: 'All sensors are disabled. Enable motion or sound detection first.' };
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

      // CRITICAL FIX v0.3.9: Check if webContents/render frame is available
      // "Render frame was disposed before WebFrameMain could be accessed" causes
      // silent IPC send failures → ACK never arrives → 60s timeout
      const frameReady = await this._ensureFrameReady();
      if (!frameReady) {
        console.error('[MonitoringManager] ❌ Render frame not available after retries');
        this.isStarting = false;
        return { success: false, error: 'Render frame not available - try restarting the app' };
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
      
      // CRITICAL FIX v0.3.9: Wrap send() in try-catch to detect frame errors
      try {
        this.mainWindow.webContents.send('start-monitoring', configWithCredentials);
        console.log('[MonitoringManager] ✓ Config sent to renderer');
      } catch (sendError) {
        console.error('[MonitoringManager] ❌ IPC send failed:', sendError.message);
        this.isStarting = false;
        return { success: false, error: `IPC send failed: ${sendError.message}` };
      }

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

  // ===========================================================================
  // FRAME AVAILABILITY CHECK (v0.3.9)
  // ===========================================================================

  /**
   * Ensure the render frame is ready to receive IPC messages.
   * Retries up to 3 times with 2s delay.
   * 
   * Background: Electron's webContents.send() can silently fail if the render
   * frame is disposed (e.g., window minimized to tray, GC'd frame).
   * This causes the monitoring ACK to never arrive → 60s timeout.
   */
  async _ensureFrameReady(maxRetries = 4, retryDelayMs = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
          console.error(`[MonitoringManager] Frame check #${attempt}: Window destroyed`);
          return false;
        }

        const wc = this.mainWindow.webContents;

        // v0.4.0: If crashed, attempt reload+recovery instead of giving up
        if (wc.isCrashed()) {
          console.warn(`[MonitoringManager] Frame check #${attempt}: WebContents crashed — attempting reload recovery...`);
          try {
            wc.reload();
            // Wait for reload to complete via did-finish-load or timeout
            await new Promise((resolve) => {
              const timer = setTimeout(resolve, 5000);
              wc.once('did-finish-load', () => { clearTimeout(timer); resolve(); });
            });
            console.log(`[MonitoringManager] Frame check #${attempt}: Reload after crash completed`);
            // Continue to frame check below (don't return yet)
          } catch (reloadErr) {
            console.error(`[MonitoringManager] Frame check #${attempt}: Reload after crash failed:`, reloadErr.message);
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, retryDelayMs));
              continue;
            }
            return false;
          }
        }

        // Check if the main frame is available
        try {
          const mainFrame = wc.mainFrame;
          if (!mainFrame) {
            throw new Error('mainFrame is null');
          }
          const frameUrl = mainFrame.url;
          console.log(`[MonitoringManager] Frame check #${attempt}: ✓ Frame ready (url: ${frameUrl ? 'loaded' : 'empty'})`);
          return true;
        } catch (frameError) {
          console.warn(`[MonitoringManager] Frame check #${attempt}: Frame not ready - ${frameError.message}`);
          
          if (attempt < maxRetries) {
            if (this.mainWindow.isMinimized()) {
              console.log(`[MonitoringManager] Frame check #${attempt}: Window minimized, restoring...`);
              this.mainWindow.restore();
            }
            
            // Attempt reload on second-to-last retry
            if (attempt === maxRetries - 1) {
              console.log(`[MonitoringManager] Frame check #${attempt}: Attempting page reload...`);
              try {
                wc.reload();
                await new Promise((resolve) => {
                  const timer = setTimeout(resolve, 5000);
                  wc.once('did-finish-load', () => { clearTimeout(timer); resolve(); });
                });
              } catch (reloadErr) {
                console.error(`[MonitoringManager] Reload failed:`, reloadErr.message);
              }
            } else {
              await new Promise(r => setTimeout(r, retryDelayMs));
            }
          }
        }
      } catch (err) {
        console.error(`[MonitoringManager] Frame check #${attempt}: Unexpected error:`, err.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelayMs));
        }
      }
    }
    
    return false;
  }

  /**
   * Called by main.js when renderer confirmed monitoring started.
   */
  onRendererStarted(status) {
    this.isStarting = false;
    this.isActive = true;
    this._lastStartedStatus = status; // v0.4.2: Track for crash diagnostics
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

      // Send stop command to renderer (v0.4.1: guard against destroyed webContents)
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const wc = this.mainWindow.webContents;
        if (wc && !wc.isDestroyed()) {
          wc.send('stop-monitoring');
        } else {
          console.warn('[MonitoringManager] webContents destroyed, skipping stop-monitoring IPC');
        }
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

      // If event is validated as real, trigger local clip recording via IPC
      // CRITICAL: Recording must happen in the Renderer (where MediaRecorder + camera stream live)
      if (result.ai_is_real && this.mainWindow && !this.mainWindow.isDestroyed()) {
        const durationSeconds = this.config?.clips?.clip_duration_seconds || 10;
        console.log(`[MonitoringManager] Triggering clip recording via IPC (event: ${result.event_id}, ${durationSeconds}s)...`);
        this.mainWindow.webContents.send('start-clip-recording', {
          eventId: result.event_id,
          durationSeconds,
        });
      }

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
