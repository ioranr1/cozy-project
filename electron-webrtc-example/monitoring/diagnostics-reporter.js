/**
 * Diagnostics Reporter v1.0.0
 * ===========================
 * Sends periodic health reports to the server for remote monitoring.
 * Reports every 5 minutes with device status, sensor health, and recent errors.
 *
 * Usage in main.js:
 *   const DiagnosticsReporter = require('./monitoring/diagnostics-reporter');
 *   const diagReporter = new DiagnosticsReporter({ supabase, store });
 *   diagReporter.start(deviceId, monitoringManager);
 *   // On quit: diagReporter.stop();
 */

const os = require('os');

const SUPABASE_URL = 'https://zoripeohnedivxkvrpbi.supabase.co';
const REPORT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ERRORS = 10;

class DiagnosticsReporter {
  constructor({ supabase, store }) {
    this._supabase = supabase;
    this._store = store;
    this._interval = null;
    this._deviceId = null;
    this._monitoringManager = null;
    this._startTime = Date.now();
    this._recentErrors = [];
  }

  /**
   * Start periodic reporting.
   * @param {string} deviceId
   * @param {object} monitoringManager - reference to MonitoringManager instance
   */
  start(deviceId, monitoringManager) {
    if (this._interval) return; // already running
    this._deviceId = deviceId;
    this._monitoringManager = monitoringManager;

    console.log('[Diagnostics] Starting health reporter (interval: 5min)');

    // Send first report immediately
    this._sendReport();

    // Then every 5 minutes
    this._interval = setInterval(() => this._sendReport(), REPORT_INTERVAL_MS);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    console.log('[Diagnostics] Reporter stopped');
  }

  /**
   * Record an error for inclusion in next report.
   * @param {string} source - e.g. 'monitoring', 'webrtc', 'away'
   * @param {string} message
   */
  recordError(source, message) {
    this._recentErrors.push({
      ts: new Date().toISOString(),
      source,
      message: String(message).slice(0, 500),
    });
    // Keep only last N
    if (this._recentErrors.length > MAX_ERRORS) {
      this._recentErrors = this._recentErrors.slice(-MAX_ERRORS);
    }
  }

  async _sendReport() {
    if (!this._deviceId) return;

    try {
      const pkg = require('../package.json');
      const uptimeSeconds = Math.floor((Date.now() - this._startTime) / 1000);

      // Gather sensor statuses from monitoring manager
      let monitoringActive = false;
      let cameraStatus = 'unknown';
      let motionDetectorStatus = 'unknown';
      let soundDetectorStatus = 'unknown';

      if (this._monitoringManager) {
        monitoringActive = !!this._monitoringManager._isEnabled;
        // Attempt to read sensor states if available
        if (this._monitoringManager._motionDetector) {
          motionDetectorStatus = this._monitoringManager._motionDetector._isRunning ? 'active' : 'idle';
        } else {
          motionDetectorStatus = 'not_loaded';
        }
        if (this._monitoringManager._soundDetector) {
          soundDetectorStatus = this._monitoringManager._soundDetector._isRunning ? 'active' : 'idle';
        } else {
          soundDetectorStatus = 'not_loaded';
        }
        // Camera status: if monitoring is active and motion detector is running, camera is presumably in use
        if (monitoringActive && motionDetectorStatus === 'active') {
          cameraStatus = 'active';
        } else if (monitoringActive) {
          cameraStatus = 'idle';
        } else {
          cameraStatus = 'off';
        }
      }

      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
        freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
        cpuCount: os.cpus().length,
        hostname: os.hostname(),
        nodeVersion: process.version,
      };

      const payload = {
        device_id: this._deviceId,
        agent_version: pkg.version || '0.0.0',
        uptime_seconds: uptimeSeconds,
        monitoring_active: monitoringActive,
        camera_status: cameraStatus,
        motion_detector_status: motionDetectorStatus,
        sound_detector_status: soundDetectorStatus,
        system_info: systemInfo,
        recent_errors: this._recentErrors,
      };

      const { error } = await this._supabase.functions.invoke('agent-health-report', {
        body: payload,
      });

      if (error) {
        console.warn('[Diagnostics] Report failed:', error.message || error);
      } else {
        console.log('[Diagnostics] Health report sent successfully');
      }
    } catch (err) {
      console.warn('[Diagnostics] Report error:', err.message || err);
    }
  }
}

module.exports = DiagnosticsReporter;
