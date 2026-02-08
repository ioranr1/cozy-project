/**
 * Sound Detector - TensorFlow.js + YAMNet Integration
 * ====================================================
 * VERSION: 0.3.0 (2026-02-08)
 * 
 * CHANGELOG:
 * - v0.3.0: Per-label thresholds, persistence tracking, RMS pre-filter,
 *           distinct event types (sound_baby_cry / sound_disturbance / sound)
 * - v0.2.0: Initial YAMNet integration with flat thresholds
 * 
 * Runs in Electron RENDERER process.
 * Uses TensorFlow.js with YAMNet for audio classification.
 * 
 * Dependencies: 
 *   npm install @tensorflow/tfjs @tensorflow-models/yamnet
 * 
 * IMPORTANT: This file runs in the renderer, not main process!
 */

const tf = require('@tensorflow/tfjs');

// YAMNet class indices for sounds we care about
// Reference: https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv
const YAMNET_TARGET_CLASSES = {
  // Glass breaking / shattering
  441: { label: 'glass_breaking', name: 'Shatter' },
  442: { label: 'glass_breaking', name: 'Splinter' },
  443: { label: 'glass_breaking', name: 'Crash' },
  
  // Baby / infant
  22: { label: 'baby_crying', name: 'Crying, sobbing' },
  23: { label: 'baby_crying', name: 'Baby cry, infant cry' },
  24: { label: 'baby_crying', name: 'Whimper' },
  
  // Dog
  67: { label: 'dog_barking', name: 'Bark' },
  68: { label: 'dog_barking', name: 'Yip' },
  69: { label: 'dog_barking', name: 'Howl' },
  70: { label: 'dog_barking', name: 'Growling' },
  
  // Alarm sounds
  389: { label: 'alarm', name: 'Smoke detector, smoke alarm' },
  390: { label: 'alarm', name: 'Fire alarm' },
  391: { label: 'alarm', name: 'Foghorn' },
  392: { label: 'alarm', name: 'Buzzer' },
  394: { label: 'alarm', name: 'Alarm clock' },
  
  // Gunshot / explosion
  427: { label: 'gunshot', name: 'Gunshot, gunfire' },
  428: { label: 'gunshot', name: 'Machine gun' },
  429: { label: 'gunshot', name: 'Fusillade' },
  430: { label: 'gunshot', name: 'Artillery fire' },
  426: { label: 'explosion', name: 'Explosion' },
  
  // Scream / shout
  20: { label: 'scream', name: 'Screaming' },
  21: { label: 'scream', name: 'Wail, moan' },
  19: { label: 'scream', name: 'Shout' },
  
  // Door / knock
  321: { label: 'door_knock', name: 'Knock' },
  322: { label: 'door_knock', name: 'Tap' },
  323: { label: 'door_sound', name: 'Door' },
  324: { label: 'door_sound', name: 'Doorbell' },
  
  // Siren
  396: { label: 'siren', name: 'Siren' },
  397: { label: 'siren', name: 'Civil defense siren' },
  398: { label: 'siren', name: 'Ambulance (siren)' },
  399: { label: 'siren', name: 'Fire engine, fire truck (siren)' },
  400: { label: 'siren', name: 'Police car (siren)' },
};

// All target class indices for quick lookup
const TARGET_CLASS_INDICES = new Set(Object.keys(YAMNET_TARGET_CLASSES).map(Number));

// ═══════════════════════════════════════════════════════════════════════════════
// Per-label policy defaults (imported at runtime from monitoring-config if avail)
// Fallback values baked in for resilience.
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_LABEL_POLICIES = {
  // Informational
  baby_crying:    { threshold: 0.60, persistence: 3, debounce_ms: 180000, event_type: 'sound_baby_cry',   category: 'informational' },
  // Disturbance
  door_knock:     { threshold: 0.50, persistence: 2, debounce_ms: 60000,  event_type: 'sound_disturbance', category: 'disturbance' },
  dog_barking:    { threshold: 0.50, persistence: 2, debounce_ms: 120000, event_type: 'sound_disturbance', category: 'disturbance' },
  scream:         { threshold: 0.45, persistence: 2, debounce_ms: 60000,  event_type: 'sound_disturbance', category: 'disturbance' },
  // Security
  glass_breaking: { threshold: 0.45, persistence: 1, debounce_ms: 30000,  event_type: 'sound',            category: 'security' },
  alarm:          { threshold: 0.50, persistence: 1, debounce_ms: 30000,  event_type: 'sound',            category: 'security' },
  gunshot:        { threshold: 0.40, persistence: 1, debounce_ms: 30000,  event_type: 'sound',            category: 'security' },
  siren:          { threshold: 0.50, persistence: 1, debounce_ms: 60000,  event_type: 'sound',            category: 'security' },
};

class SoundDetector {
  constructor(options = {}) {
    this.options = {
      sampleRate: 16000, // YAMNet expects 16kHz
      frameLength: 0.975, // ~1 second per inference
      rmsThreshold: options.rmsThreshold || 0.01, // skip near-silence
      ...options,
    };

    this.model = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.source = null;
    this.isRunning = false;
    this.isInitialized = false;
    this.onDetection = options.onDetection || (() => {});
    
    // Target labels from config
    this.targetLabels = new Set(options.targets || [
      'glass_breaking',
      'baby_crying',
      'dog_barking',
      'alarm',
      'gunshot',
      'scream',
      'siren',
    ]);
    
    // Per-label policies (merged with config overrides if provided)
    this.labelPolicies = { ...DEFAULT_LABEL_POLICIES };
    if (options.labelPolicies) {
      for (const [label, policy] of Object.entries(options.labelPolicies)) {
        this.labelPolicies[label] = { ...DEFAULT_LABEL_POLICIES[label], ...policy };
      }
    }
    
    // Audio buffer for accumulating samples
    this.audioBuffer = [];
    this.samplesNeeded = Math.floor(this.options.sampleRate * this.options.frameLength);
    
    // Debounce tracking per label (timestamp of last emitted event)
    this.lastDetectionTime = {};
    
    // Persistence tracking per label (consecutive window count above threshold)
    this.persistenceCount = {};
    
    console.log('[SoundDetector] Created v0.3.0 with per-label policies');
    console.log('[SoundDetector] Targets:', Array.from(this.targetLabels));
    console.log('[SoundDetector] RMS threshold:', this.options.rmsThreshold);
  }

  /**
   * Initialize TensorFlow.js and load YAMNet model
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[SoundDetector] Already initialized');
      return true;
    }

    console.log('[SoundDetector] Initializing TensorFlow.js + YAMNet...');
    
    try {
      // Ensure TensorFlow.js is ready
      await tf.ready();
      console.log('[SoundDetector] TensorFlow.js backend:', tf.getBackend());
      
      // Load YAMNet model from TensorFlow Hub
      this.model = await tf.loadGraphModel(
        'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1',
        { fromTFHub: true }
      );
      
      // Warm up the model with a dummy input
      const dummyInput = tf.zeros([15600]); // ~0.975s at 16kHz
      const warmupResult = this.model.predict(dummyInput);
      warmupResult.dispose();
      dummyInput.dispose();

      this.isInitialized = true;
      console.log('[SoundDetector] ✓ YAMNet model loaded successfully');
      
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
    if (!this.isInitialized) {
      console.error('[SoundDetector] Not initialized. Call initialize() first.');
      return false;
    }

    if (this.isRunning) {
      console.log('[SoundDetector] Already running');
      return true;
    }

    console.log('[SoundDetector] Starting audio capture...');

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Create audio context at target sample rate
      this.audioContext = new AudioContext({
        sampleRate: this.options.sampleRate,
      });

      // Create source from microphone
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for audio data access
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.isRunning) return;
        
        const inputData = event.inputBuffer.getChannelData(0);
        this.processAudioChunk(new Float32Array(inputData));
      };

      // Connect the audio graph
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRunning = true;
      this.audioBuffer = [];
      this.persistenceCount = {};
      console.log('[SoundDetector] ✓ Audio capture started');
      
      return true;
    } catch (error) {
      console.error('[SoundDetector] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Process incoming audio chunk
   */
  processAudioChunk(chunk) {
    // Accumulate samples
    this.audioBuffer.push(...chunk);
    
    // When we have enough samples, run inference
    if (this.audioBuffer.length >= this.samplesNeeded) {
      const samples = new Float32Array(this.audioBuffer.slice(0, this.samplesNeeded));
      this.audioBuffer = this.audioBuffer.slice(this.samplesNeeded);
      
      // ── RMS pre-filter: skip near-silence ──
      const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
      if (rms < this.options.rmsThreshold) {
        // Reset all persistence counters on silence
        for (const label of Object.keys(this.persistenceCount)) {
          this.persistenceCount[label] = 0;
        }
        return;
      }
      
      // Run inference asynchronously
      this.runInference(samples);
    }
  }

  /**
   * Run YAMNet inference on audio samples
   */
  async runInference(samples) {
    try {
      const inputTensor = tf.tensor1d(samples);
      const output = this.model.predict(inputTensor);
      
      // YAMNet returns [scores, embeddings, log_mel_spectrogram]
      const scores = Array.isArray(output) ? output[0] : output;
      const scoresData = await scores.data();
      
      const numClasses = 521;
      const numFrames = scoresData.length / numClasses;
      
      // Average scores across frames
      const avgScores = new Float32Array(numClasses);
      for (let c = 0; c < numClasses; c++) {
        let sum = 0;
        for (let f = 0; f < numFrames; f++) {
          sum += scoresData[f * numClasses + c];
        }
        avgScores[c] = sum / numFrames;
      }
      
      // Find detections above per-label thresholds
      this.processScores(avgScores);
      
      // Cleanup tensors
      inputTensor.dispose();
      if (Array.isArray(output)) {
        output.forEach(t => t.dispose());
      } else {
        output.dispose();
      }
    } catch (error) {
      console.error('[SoundDetector] Inference error:', error);
    }
  }

  /**
   * Process YAMNet scores with per-label policies and persistence tracking
   */
  processScores(scores) {
    const now = Date.now();
    
    // Aggregate best score per label across all YAMNet class indices
    const labelBestScores = {};
    
    for (const [indexStr, classInfo] of Object.entries(YAMNET_TARGET_CLASSES)) {
      const index = parseInt(indexStr);
      const score = scores[index];
      const label = classInfo.label;
      
      // Check if this label is in our targets
      if (!this.targetLabels.has(label)) continue;
      
      if (!labelBestScores[label] || score > labelBestScores[label].score) {
        labelBestScores[label] = { score, name: classInfo.name, classIndex: index };
      }
    }
    
    // Apply per-label threshold + persistence + debounce
    for (const [label, best] of Object.entries(labelBestScores)) {
      const policy = this.labelPolicies[label] || DEFAULT_LABEL_POLICIES[label] || {
        threshold: 0.50, persistence: 1, debounce_ms: 60000, event_type: 'sound', category: 'security',
      };
      
      // Threshold check
      if (best.score < policy.threshold) {
        // Reset persistence counter (not consecutive)
        this.persistenceCount[label] = 0;
        continue;
      }
      
      // Increment persistence counter
      this.persistenceCount[label] = (this.persistenceCount[label] || 0) + 1;
      
      // Check persistence requirement
      if (this.persistenceCount[label] < policy.persistence) {
        continue; // Need more consecutive windows
      }
      
      // Debounce check
      const lastTime = this.lastDetectionTime[label] || 0;
      if (now - lastTime < policy.debounce_ms) continue;
      
      // ═══ Detection confirmed! ═══
      this.persistenceCount[label] = 0; // Reset after emit
      this.lastDetectionTime[label] = now;
      
      const eventData = {
        sensor_type: policy.event_type, // sound_baby_cry / sound_disturbance / sound
        label: label,
        confidence: best.score,
        timestamp: now,
        metadata: {
          yamnet_class: best.name,
          yamnet_index: best.classIndex,
          category: policy.category,
          persistence_windows: policy.persistence,
          debounce_ms: policy.debounce_ms,
        },
      };

      console.log(`[SoundDetector] ✓ Detected: ${best.name} → ${label} [${policy.category}] (${(best.score * 100).toFixed(1)}%) persistence=${policy.persistence}`);

      // Send to main process
      if (window.electronAPI?.sendMonitoringEvent) {
        window.electronAPI.sendMonitoringEvent(eventData);
      }

      // Call callback
      this.onDetection(eventData);
    }
    
    // Reset persistence for labels that had NO score above threshold this window
    for (const label of Object.keys(this.persistenceCount)) {
      if (!labelBestScores[label] || labelBestScores[label].score < (this.labelPolicies[label]?.threshold || 0.50)) {
        // Already handled above, but ensure it's set to 0
      }
    }
  }

  /**
   * Stop listening
   */
  stop() {
    console.log('[SoundDetector] Stopping...');
    
    this.isRunning = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioBuffer = [];
    this.lastDetectionTime = {};
    this.persistenceCount = {};
    
    console.log('[SoundDetector] ✓ Stopped');
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(config) {
    if (config.targets) {
      this.targetLabels = new Set(config.targets);
      console.log('[SoundDetector] Updated targets:', Array.from(this.targetLabels));
    }
    if (config.rms_threshold !== undefined) {
      this.options.rmsThreshold = config.rms_threshold;
      console.log('[SoundDetector] Updated RMS threshold:', this.options.rmsThreshold);
    }
    // Per-label policy overrides (future use for Advanced presets)
    if (config.labelPolicies) {
      for (const [label, policy] of Object.entries(config.labelPolicies)) {
        this.labelPolicies[label] = { ...this.labelPolicies[label], ...policy };
      }
      console.log('[SoundDetector] Updated label policies');
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      hasAudio: !!this.mediaStream,
      targets: Array.from(this.targetLabels),
      rmsThreshold: this.options.rmsThreshold,
      persistenceCounters: { ...this.persistenceCount },
      bufferSize: this.audioBuffer.length,
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.stop();
    
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    
    this.isInitialized = false;
    console.log('[SoundDetector] Disposed');
  }
}

module.exports = SoundDetector;
