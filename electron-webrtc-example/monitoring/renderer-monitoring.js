/**
 * Renderer Monitoring Controller
 * ===============================
 * VERSION: 0.1.0 (2026-01-30)
 * 
 * Runs in Electron RENDERER process.
 * Initializes and manages MotionDetector and SoundDetector.
 * Communicates with main process via IPC.
 * 
 * Usage in renderer:
 *   const MonitoringController = require('./monitoring/renderer-monitoring');
 *   const controller = new MonitoringController();
 *   await controller.initialize();
 */

const MotionDetector = require('./detectors/motion-detector');
const SoundDetector = require('./detectors/sound-detector');

class RendererMonitoringController {
  constructor() {
    this.motionDetector = null;
    this.soundDetector = null;
    this.videoElement = null;
    this.isMonitoring = false;
    this.config = null;
    
    // Status tracking
    this.status = {
      motionReady: false,
      soundReady: false,
      motionRunning: false,
      soundRunning: false,
    };
    
    console.log('[RendererMonitoring] Controller created');
  }

  /**
   * Initialize detectors (load models)
   * Called once on app startup
   */
  async initialize() {
    console.log('[RendererMonitoring] Initializing detectors...');
    
    try {
      // Initialize motion detector
      this.motionDetector = new MotionDetector({
        onDetection: (event) => this.handleDetection(event),
      });
      
      const motionOk = await this.motionDetector.initialize();
      this.status.motionReady = motionOk;
      console.log('[RendererMonitoring] Motion detector ready:', motionOk);
      
      // Initialize sound detector
      this.soundDetector = new SoundDetector({
        onDetection: (event) => this.handleDetection(event),
      });
      
      const soundOk = await this.soundDetector.initialize();
      this.status.soundReady = soundOk;
      console.log('[RendererMonitoring] Sound detector ready:', soundOk);
      
      // Set up IPC listeners from main process
      this.setupIPCListeners();
      
      // Notify main process that detectors are ready
      this.notifyStatus();
      
      return {
        motion: motionOk,
        sound: soundOk,
      };
    } catch (error) {
      console.error('[RendererMonitoring] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set up IPC listeners for commands from main process
   */
  setupIPCListeners() {
    if (!window.electronAPI) {
      console.warn('[RendererMonitoring] electronAPI not available');
      return;
    }

    // Listen for start monitoring command
    window.electronAPI.onStartMonitoring?.((config) => {
      console.log('[RendererMonitoring] Received START_MONITORING:', config);
      this.startMonitoring(config);
    });

    // Listen for stop monitoring command
    window.electronAPI.onStopMonitoring?.(() => {
      console.log('[RendererMonitoring] Received STOP_MONITORING');
      this.stopMonitoring();
    });

    // Listen for config update
    window.electronAPI.onUpdateMonitoringConfig?.((config) => {
      console.log('[RendererMonitoring] Received CONFIG_UPDATE:', config);
      this.updateConfig(config);
    });

    console.log('[RendererMonitoring] IPC listeners set up');
  }

  /**
   * Start monitoring with given config
   * @param {object} config - Monitoring configuration from database
   */
  async startMonitoring(config) {
    if (this.isMonitoring) {
      console.log('[RendererMonitoring] Already monitoring, updating config...');
      this.updateConfig(config);
      return;
    }

    console.log('[RendererMonitoring] Starting monitoring with config:', config);
    this.config = config;

    try {
      // Get or create video element for camera
      this.videoElement = await this.setupVideoElement();
      
      const motionEnabled = config?.sensors?.motion?.enabled ?? true;
      const soundEnabled = config?.sensors?.sound?.enabled ?? false;

      // Start motion detector if enabled
      if (motionEnabled && this.status.motionReady) {
        // Update detector config
        this.motionDetector.updateConfig({
          targets: config?.sensors?.motion?.targets || ['person', 'animal', 'vehicle'],
          confidence_threshold: config?.sensors?.motion?.confidence_threshold || 0.7,
          debounce_ms: config?.sensors?.motion?.debounce_ms || 3000,
        });
        
        await this.motionDetector.start(this.videoElement);
        this.status.motionRunning = true;
        console.log('[RendererMonitoring] ✓ Motion detector started');
      }

      // Start sound detector if enabled
      if (soundEnabled && this.status.soundReady) {
        // Update detector config
        this.soundDetector.updateConfig({
          targets: config?.sensors?.sound?.targets || ['glass_breaking', 'baby_crying', 'alarm', 'gunshot', 'scream'],
          confidence_threshold: config?.sensors?.sound?.confidence_threshold || 0.6,
          debounce_ms: config?.sensors?.sound?.debounce_ms || 2000,
        });
        
        await this.soundDetector.start();
        this.status.soundRunning = true;
        console.log('[RendererMonitoring] ✓ Sound detector started');
      }

      this.isMonitoring = true;
      this.notifyStatus();
      
      // Notify main process
      window.electronAPI?.notifyMonitoringStarted?.({
        motion: this.status.motionRunning,
        sound: this.status.soundRunning,
      });

      console.log('[RendererMonitoring] ✓ Monitoring started successfully');
    } catch (error) {
      console.error('[RendererMonitoring] Failed to start monitoring:', error);
      window.electronAPI?.notifyMonitoringError?.(error.message);
    }
  }

  /**
   * Stop all monitoring
   */
  stopMonitoring() {
    console.log('[RendererMonitoring] Stopping monitoring...');

    // Stop motion detector
    if (this.motionDetector) {
      this.motionDetector.stop();
      this.status.motionRunning = false;
    }

    // Stop sound detector
    if (this.soundDetector) {
      this.soundDetector.stop();
      this.status.soundRunning = false;
    }

    // Stop video stream
    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = this.videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }

    this.isMonitoring = false;
    this.notifyStatus();
    
    // Notify main process
    window.electronAPI?.notifyMonitoringStopped?.();

    console.log('[RendererMonitoring] ✓ Monitoring stopped');
  }

  /**
   * Update config dynamically (while running)
   */
  updateConfig(config) {
    if (!config) return;
    
    this.config = config;
    
    const motionConfig = config?.sensors?.motion;
    const soundConfig = config?.sensors?.sound;

    // Update motion detector
    if (this.motionDetector && motionConfig) {
      if (motionConfig.enabled && !this.status.motionRunning && this.status.motionReady) {
        // Start motion if newly enabled
        this.motionDetector.updateConfig({
          targets: motionConfig.targets,
          confidence_threshold: motionConfig.confidence_threshold,
          debounce_ms: motionConfig.debounce_ms,
        });
        if (this.videoElement) {
          this.motionDetector.start(this.videoElement);
          this.status.motionRunning = true;
        }
      } else if (!motionConfig.enabled && this.status.motionRunning) {
        // Stop motion if newly disabled
        this.motionDetector.stop();
        this.status.motionRunning = false;
      } else if (motionConfig.enabled && this.status.motionRunning) {
        // Just update config
        this.motionDetector.updateConfig({
          targets: motionConfig.targets,
          confidence_threshold: motionConfig.confidence_threshold,
          debounce_ms: motionConfig.debounce_ms,
        });
      }
    }

    // Update sound detector
    if (this.soundDetector && soundConfig) {
      if (soundConfig.enabled && !this.status.soundRunning && this.status.soundReady) {
        // Start sound if newly enabled
        this.soundDetector.updateConfig({
          targets: soundConfig.targets,
          confidence_threshold: soundConfig.confidence_threshold,
          debounce_ms: soundConfig.debounce_ms,
        });
        this.soundDetector.start();
        this.status.soundRunning = true;
      } else if (!soundConfig.enabled && this.status.soundRunning) {
        // Stop sound if newly disabled
        this.soundDetector.stop();
        this.status.soundRunning = false;
      } else if (soundConfig.enabled && this.status.soundRunning) {
        // Just update config
        this.soundDetector.updateConfig({
          targets: soundConfig.targets,
          confidence_threshold: soundConfig.confidence_threshold,
          debounce_ms: soundConfig.debounce_ms,
        });
      }
    }

    this.notifyStatus();
  }

  /**
   * Handle detection event from either detector
   * Forward to main process via IPC
   */
  handleDetection(event) {
    console.log('[RendererMonitoring] Detection:', event.sensor_type, event.label, `${(event.confidence * 100).toFixed(1)}%`);
    
    // Capture snapshot for motion events
    if (event.sensor_type === 'motion' && this.videoElement) {
      event.snapshot = this.captureSnapshot();
    }
    
    // Send to main process
    window.electronAPI?.sendMonitoringEvent?.(event);
  }

  /**
   * Capture snapshot from video element as base64
   */
  captureSnapshot() {
    if (!this.videoElement || this.videoElement.readyState < 2) {
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = this.videoElement.videoWidth || 640;
      canvas.height = this.videoElement.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
      
      // Return base64 JPEG (quality 0.8)
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('[RendererMonitoring] Snapshot capture failed:', error);
      return null;
    }
  }

  /**
   * Set up hidden video element for camera capture
   */
  async setupVideoElement() {
    // Check if we already have one
    let video = document.getElementById('monitoring-video');
    if (video && video.srcObject) {
      return video;
    }

    // Create hidden video element
    if (!video) {
      video = document.createElement('video');
      video.id = 'monitoring-video';
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'absolute';
      video.style.left = '-9999px';
      video.style.width = '640px';
      video.style.height = '480px';
      document.body.appendChild(video);
    }

    // Get camera stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15 },
        },
        audio: false, // Audio handled by SoundDetector
      });

      video.srcObject = stream;
      await video.play();
      
      console.log('[RendererMonitoring] ✓ Camera stream ready');
      return video;
    } catch (error) {
      console.error('[RendererMonitoring] Camera access failed:', error);
      throw error;
    }
  }

  /**
   * Notify main process of current status
   */
  notifyStatus() {
    const status = this.getStatus();
    window.electronAPI?.notifyMonitoringStatus?.(status);
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      ...this.status,
      motion: this.motionDetector?.getStatus() || null,
      sound: this.soundDetector?.getStatus() || null,
    };
  }

  /**
   * Cleanup all resources
   */
  dispose() {
    this.stopMonitoring();
    
    if (this.motionDetector) {
      this.motionDetector.dispose();
      this.motionDetector = null;
    }
    
    if (this.soundDetector) {
      this.soundDetector.dispose();
      this.soundDetector = null;
    }
    
    // Remove video element
    const video = document.getElementById('monitoring-video');
    if (video) {
      video.remove();
    }
    
    console.log('[RendererMonitoring] Disposed');
  }
}

module.exports = RendererMonitoringController;
