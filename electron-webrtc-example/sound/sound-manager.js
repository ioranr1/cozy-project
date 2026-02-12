/**
 * Sound Detection Manager - Main Process
 * ========================================
 * VERSION: 1.0.0 (2026-02-12)
 * 
 * ISOLATED sound detection manager for the main process.
 * Does NOT interact with camera, motion detection, WebRTC, or Live View.
 * 
 * Responsibilities:
 *   - Feature flag gating (SOUND_DETECTION_ENABLED)
 *   - Start/Stop sound detection via IPC to renderer
 *   - Receive sound events from renderer
 *   - Report validated sound events to events-report edge function
 *   - Expose public API: start(), stop(), getStatus()
 */

// Edge function endpoint for event reporting (same as motion)
const EVENTS_REPORT_ENDPOINT = 'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/events-report';

class SoundManager {
  constructor({ supabase, featureEnabled = false }) {
    this.supabase = supabase;
    this.featureEnabled = featureEnabled;
    this.mainWindow = null;
    this.deviceId = null;
    this.deviceAuthToken = null;

    // State
    this.isActive = false;
    this.isStarting = false;
    this.lastStatus = null;

    // Debounce tracking per label
    this.lastEventTime = {};

    // Sound detection config
    this.config = {
      rms_threshold: 0.02,           // RMS threshold to trigger event
      sustained_ms: 500,             // How long RMS must stay above threshold
      debounce_ms: 60000,            // Global debounce between events (1 min)
      per_label_debounce: {
        baby_crying: 180000,          // 3 minutes
        dog_barking: 120000,          // 2 minutes
        scream: 60000,                // 1 minute
      },
      enable_ai_verify: true,        // Send to AI for classification
      sound_targets: ['baby_crying', 'dog_barking', 'scream'],
    };

    console.log('[SoundManager] Initialized (v1.0.0) - featureEnabled:', featureEnabled);
  }

  // ===========================================================================
  // SETUP
  // ===========================================================================

  setMainWindow(win) {
    this.mainWindow = win;
    console.log('[SoundManager] SOUND_INIT: Main window set');
  }

  setDeviceId(id) {
    this.deviceId = id;
  }

  setDeviceAuthToken(token) {
    this.deviceAuthToken = token;
  }

  setFeatureEnabled(enabled) {
    this.featureEnabled = enabled;
    console.log('[SoundManager] Feature flag set:', enabled);
  }

  updateConfig(partialConfig) {
    this.config = { ...this.config, ...partialConfig };
    console.log('[SoundManager] Config updated:', this.config);
  }

  // ===========================================================================
  // START / STOP
  // ===========================================================================

  async start() {
    if (!this.featureEnabled) {
      console.log('[SoundManager] SOUND_DISABLED_FALLBACK: Feature flag is OFF');
      return { success: false, error: 'Sound detection feature is disabled' };
    }

    if (this.isActive) {
      console.log('[SoundManager] Already active');
      return { success: true };
    }

    if (this.isStarting) {
      console.log('[SoundManager] Start already in progress');
      return { success: true };
    }

    console.log('[SoundManager] ═══════════════════════════════════════════');
    console.log('[SoundManager] SOUND_INIT: Starting sound detection...');
    console.log('[SoundManager] ═══════════════════════════════════════════');

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.error('[SoundManager] SOUND_DISABLED_FALLBACK: No main window');
      return { success: false, error: 'Main window not available' };
    }

    this.isStarting = true;

    try {
      // Send start command to renderer with config
      this.mainWindow.webContents.send('sound-start', {
        config: this.config,
        device_id: this.deviceId,
        device_auth_token: this.deviceAuthToken,
      });

      console.log('[SoundManager] ⏳ Waiting for renderer ACK...');
      return { success: true, starting: true };
    } catch (error) {
      console.error('[SoundManager] SOUND_DISABLED_FALLBACK: Start failed:', error);
      this.isStarting = false;
      return { success: false, error: error.message };
    }
  }

  stop() {
    console.log('[SoundManager] Stopping sound detection...');

    if (!this.isActive && !this.isStarting) {
      console.log('[SoundManager] Already stopped');
      return { success: true };
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        this.mainWindow.webContents.send('sound-stop');
      } catch (e) {
        console.warn('[SoundManager] Failed to send stop to renderer:', e?.message);
      }
    }

    this.isActive = false;
    this.isStarting = false;
    this.lastStatus = null;

    console.log('[SoundManager] ✓ Sound detection stopped');
    return { success: true };
  }

  // ===========================================================================
  // RENDERER CALLBACKS
  // ===========================================================================

  onRendererStarted(status) {
    this.isStarting = false;
    this.isActive = true;
    this.lastStatus = status;
    console.log('[SoundManager] SOUND_WORKLET_LOADED: Renderer confirmed sound started', status);
  }

  onRendererStopped() {
    this.isStarting = false;
    this.isActive = false;
    this.lastStatus = null;
    console.log('[SoundManager] Renderer confirmed sound stopped');
  }

  onRendererError(error) {
    this.isStarting = false;
    this.isActive = false;
    console.error('[SoundManager] SOUND_DISABLED_FALLBACK: Renderer error:', error);
  }

  onRendererLevel(data) {
    // Just log at debug level - high frequency
    // data = { rms, peak, timestamp }
    this.lastStatus = data;
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  /**
   * Handle a sound event triggered by the renderer (RMS above threshold)
   * @param {Object} eventData - { rms, peak, duration_ms, timestamp }
   */
  async handleSoundEvent(eventData) {
    console.log('[SoundManager] SOUND_EVENT_TRIGGERED:', {
      rms: eventData.rms?.toFixed(4),
      peak: eventData.peak?.toFixed(4),
      duration_ms: eventData.duration_ms,
    });

    // Global debounce
    const now = Date.now();
    const lastGlobal = this.lastEventTime._global || 0;
    if (now - lastGlobal < this.config.debounce_ms) {
      console.log('[SoundManager] Debounced (global)');
      return;
    }
    this.lastEventTime._global = now;

    // Report to server for AI classification
    if (this.config.enable_ai_verify) {
      await this.reportSoundEvent(eventData);
    } else {
      console.log('[SoundManager] AI verify disabled, event logged locally only');
    }
  }

  /**
   * Report sound event to events-report edge function for AI classification
   */
  async reportSoundEvent(eventData) {
    if (!this.deviceId || !this.deviceAuthToken) {
      console.warn('[SoundManager] Missing device credentials, skipping report');
      return null;
    }

    try {
      console.log('[SoundManager] SOUND_AI_VERIFY_SENT: Reporting to server...');

      const response = await fetch(EVENTS_REPORT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-token': this.deviceAuthToken,
        },
        body: JSON.stringify({
          device_id: this.deviceId,
          event_type: 'sound',
          labels: this.config.sound_targets.map(target => ({
            label: target,
            confidence: eventData.rms || 0.5,
          })),
          snapshot: null, // No visual snapshot for sound events
          timestamp: eventData.timestamp || Date.now(),
          metadata: {
            rms: eventData.rms,
            peak: eventData.peak,
            duration_ms: eventData.duration_ms,
            source: 'audioworklet_v1',
            sound_targets: this.config.sound_targets,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SoundManager] SOUND_AI_VERIFY_RESULT: Server error:', response.status, errorText);
        return null;
      }

      const result = await response.json();
      console.log('[SoundManager] SOUND_AI_VERIFY_RESULT:', {
        event_id: result.event_id,
        ai_is_real: result.ai_is_real,
        ai_confidence: result.ai_confidence,
        notification_sent: result.notification_sent,
      });

      return result;
    } catch (error) {
      console.error('[SoundManager] Report failed:', error);
      return null;
    }
  }

  // ===========================================================================
  // STATUS
  // ===========================================================================

  getStatus() {
    return {
      featureEnabled: this.featureEnabled,
      isActive: this.isActive,
      isStarting: this.isStarting,
      lastStatus: this.lastStatus,
      config: this.config,
    };
  }
}

module.exports = SoundManager;
