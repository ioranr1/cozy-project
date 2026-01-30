/**
 * Sound Detector - TensorFlow.js + YAMNet Integration
 * ====================================================
 * VERSION: 0.1.0 (2026-01-30)
 * 
 * Runs in Electron RENDERER process.
 * Uses TensorFlow.js with YAMNet for audio classification.
 * 
 * IMPORTANT: This file runs in the renderer, not main process!
 */

// Placeholder - Full implementation requires @tensorflow/tfjs and yamnet model

// YAMNet class IDs for sounds we care about
// Reference: https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv
const YAMNET_CLASS_MAP = {
  // Glass
  441: 'glass_breaking', // Shatter
  442: 'glass_breaking', // Splinter
  
  // Baby
  22: 'baby_crying', // Crying, sobbing
  
  // Dog
  67: 'dog_barking', // Bark
  
  // Alarms
  389: 'alarm', // Smoke detector
  390: 'alarm', // Fire alarm
  391: 'alarm', // Buzzer
  392: 'alarm', // Alarm clock
  
  // Gunshot
  427: 'gunshot', // Gunshot, gunfire
  428: 'gunshot', // Machine gun
  429: 'gunshot', // Artillery fire
  
  // Scream
  20: 'scream', // Screaming
  
  // Door
  321: 'door_knock', // Knock
  
  // Siren
  396: 'siren', // Siren
  397: 'siren', // Civil defense siren
};

class SoundDetector {
  constructor(options = {}) {
    this.options = {
      sampleRate: options.sampleRate || 16000,
      frameLengthMs: options.frameLengthMs || 960,
      confidenceThreshold: options.confidenceThreshold || 0.5,
      ...options,
    };

    this.model = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.analyser = null;
    this.isRunning = false;
    this.onDetection = options.onDetection || (() => {});
    
    // Target labels we care about
    this.targetLabels = new Set([
      'glass_breaking',
      'baby_crying',
      'dog_barking',
      'alarm',
      'gunshot',
      'scream',
      'door_knock',
      'siren',
    ]);
    
    console.log('[SoundDetector] Initialized with options:', this.options);
  }

  /**
   * Initialize the YAMNet model
   */
  async initialize() {
    console.log('[SoundDetector] Initializing...');
    
    try {
      // TODO: Import and initialize TensorFlow.js + YAMNet
      // await tf.ready();
      // this.model = await tf.loadGraphModel('path/to/yamnet/model.json');

      console.log('[SoundDetector] ✓ Initialized (placeholder)');
      
      // Notify main process
      if (window.electronAPI?.notifyDetectorReady) {
        window.electronAPI.notifyDetectorReady('sound');
      }
      
      return true;
    } catch (error) {
      console.error('[SoundDetector] Initialization failed:', error);
      
      if (window.electronAPI?.notifyDetectorError) {
        window.electronAPI.notifyDetectorError('sound', error.message);
      }
      
      return false;
    }
  }

  /**
   * Start listening to microphone
   */
  async start() {
    if (this.isRunning) {
      console.log('[SoundDetector] Already running');
      return;
    }

    console.log('[SoundDetector] Starting...');

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.options.sampleRate,
      });

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      // Connect microphone to analyser
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser);

      this.isRunning = true;
      console.log('[SoundDetector] ✓ Started');

      // Start detection loop
      this.detectionLoop();

    } catch (error) {
      console.error('[SoundDetector] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop listening
   */
  stop() {
    console.log('[SoundDetector] Stopping...');
    
    this.isRunning = false;

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    console.log('[SoundDetector] ✓ Stopped');
  }

  /**
   * Main detection loop
   */
  async detectionLoop() {
    if (!this.isRunning || !this.analyser) {
      return;
    }

    try {
      // Get audio data
      const dataArray = new Float32Array(this.analyser.frequencyBinCount);
      this.analyser.getFloatTimeDomainData(dataArray);

      // TODO: Run YAMNet inference
      // const input = tf.tensor(dataArray).reshape([1, -1]);
      // const predictions = this.model.predict(input);
      // const scores = await predictions.data();
      // 
      // // Find top predictions
      // const topK = this.getTopK(scores, 5);
      // for (const { index, score } of topK) {
      //   const label = YAMNET_CLASS_MAP[index];
      //   if (label && this.targetLabels.has(label) && score >= this.options.confidenceThreshold) {
      //     this.handleDetection({ label, confidence: score });
      //   }
      // }

    } catch (error) {
      console.error('[SoundDetector] Detection error:', error);
    }

    // Schedule next analysis (approximately every 500ms)
    if (this.isRunning) {
      setTimeout(() => this.detectionLoop(), 500);
    }
  }

  /**
   * Get top K predictions
   */
  getTopK(scores, k) {
    const indexed = Array.from(scores).map((score, index) => ({ index, score }));
    indexed.sort((a, b) => b.score - a.score);
    return indexed.slice(0, k);
  }

  /**
   * Handle a detection event
   */
  handleDetection({ label, confidence }) {
    const event = {
      sensor_type: 'sound',
      label,
      confidence,
      timestamp: Date.now(),
      metadata: {},
    };

    console.log('[SoundDetector] Detection:', event);

    // Send to main process
    if (window.electronAPI?.sendMonitoringEvent) {
      window.electronAPI.sendMonitoringEvent(event);
    }

    // Call callback
    this.onDetection(event);
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    if (config.targets) {
      this.targetLabels = new Set(config.targets);
    }
    if (config.confidence_threshold) {
      this.options.confidenceThreshold = config.confidence_threshold;
    }
    console.log('[SoundDetector] Config updated');
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.stop();
    // TODO: this.model?.dispose();
    console.log('[SoundDetector] Disposed');
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SoundDetector;
}
