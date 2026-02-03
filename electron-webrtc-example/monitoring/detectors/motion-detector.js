/**
 * Motion Detector - MediaPipe Tasks Vision Integration
 * =====================================================
 * VERSION: 0.2.0 (2026-01-30)
 * 
 * Runs in Electron RENDERER process.
 * Uses MediaPipe Object Detection for local detection (person, animal, vehicle).
 * 
 * Dependencies: @mediapipe/tasks-vision
 * Install: npm install @mediapipe/tasks-vision
 * 
 * IMPORTANT: This file runs in the renderer, not main process!
 */

const { ObjectDetector, FilesetResolver } = require('@mediapipe/tasks-vision');

// Label mapping from COCO dataset to our simplified categories
const LABEL_MAPPING = {
  // Person
  'person': 'person',
  
  // Animals
  'cat': 'animal',
  'dog': 'animal',
  'bird': 'animal',
  'horse': 'animal',
  'sheep': 'animal',
  'cow': 'animal',
  'elephant': 'animal',
  'bear': 'animal',
  'zebra': 'animal',
  'giraffe': 'animal',
  
  // Vehicles
  'car': 'vehicle',
  'truck': 'vehicle',
  'bus': 'vehicle',
  'motorcycle': 'vehicle',
  'bicycle': 'vehicle',
  'airplane': 'vehicle',
  'boat': 'vehicle',
  'train': 'vehicle',
};

// Specific animal labels for granular detection
const SPECIFIC_ANIMAL_LABELS = ['cat', 'dog', 'bird'];

class MotionDetector {
  constructor(options = {}) {
    this.options = {
      modelPath: options.modelPath || 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
      maxResults: options.maxResults || 5,
      scoreThreshold: options.scoreThreshold || 0.5,
      delegate: options.delegate || 'GPU', // GPU or CPU
      ...options,
    };

    this.detector = null;
    this.videoElement = null;
    this.isRunning = false;
    this.isInitialized = false;
    this.onDetection = options.onDetection || (() => {});
    
    // Target labels from config
    this.targetLabels = new Set(options.targets || ['person', 'animal', 'vehicle']);
    
    // Debounce tracking per label
    this.lastDetectionTime = {};
    this.debounceMs = options.debounce_ms || 3000;
    
    // Detection loop timing
    this.detectionIntervalMs = options.detectionIntervalMs || 200; // 5 FPS for detection
    this.lastFrameTime = 0;
    
    console.log('[MotionDetector] Created with options:', this.options);
  }

  /**
   * Initialize the MediaPipe detector
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[MotionDetector] Already initialized');
      return true;
    }

    console.log('[MotionDetector] Initializing MediaPipe...');
    
    try {
      // Load the MediaPipe vision WASM files
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      
      // Create the object detector
      this.detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.options.modelPath,
          delegate: this.options.delegate,
        },
        runningMode: 'VIDEO',
        maxResults: this.options.maxResults,
        scoreThreshold: this.options.scoreThreshold,
      });

      this.isInitialized = true;
      console.log('[MotionDetector] ✓ MediaPipe initialized successfully');
      
      // Notify main process
      if (window.electronAPI?.notifyDetectorReady) {
        window.electronAPI.notifyDetectorReady('motion');
      }
      
      return true;
    } catch (error) {
      console.error('[MotionDetector] Initialization failed:', error);
      
      if (window.electronAPI?.notifyDetectorError) {
        window.electronAPI.notifyDetectorError('motion', error.message);
      }
      
      return false;
    }
  }

  /**
   * Start detection on a video element
   * @param {HTMLVideoElement} videoElement - Video element with camera stream
   */
  async start(videoElement) {
    if (!this.isInitialized) {
      console.error('[MotionDetector] Not initialized. Call initialize() first.');
      return false;
    }

    if (this.isRunning) {
      console.log('[MotionDetector] Already running');
      return true;
    }

    if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
      console.error('[MotionDetector] Invalid video element');
      return false;
    }

    this.videoElement = videoElement;
    this.isRunning = true;
    this.lastFrameTime = 0;

    console.log('[MotionDetector] Starting detection loop');
    this.runDetectionLoop();
    
    return true;
  }

  /**
   * Stop detection
   */
  stop() {
    console.log('[MotionDetector] Stopping');
    this.isRunning = false;
    this.videoElement = null;
    this.lastDetectionTime = {};
  }

  /**
   * Main detection loop using requestAnimationFrame
   */
  runDetectionLoop() {
    if (!this.isRunning || !this.videoElement || !this.detector) {
      return;
    }

    const now = performance.now();
    
    // Throttle detection to target FPS
    if (now - this.lastFrameTime >= this.detectionIntervalMs) {
      this.lastFrameTime = now;
      
      // Only process if video is playing
      if (this.videoElement.readyState >= 2 && !this.videoElement.paused) {
        this.processFrame(now);
      }
    }

    // Schedule next frame
    requestAnimationFrame(() => this.runDetectionLoop());
  }

  /**
   * Process a single video frame
   */
  processFrame(timestamp) {
    try {
      const detections = this.detector.detectForVideo(this.videoElement, timestamp);
      
      if (detections && detections.detections.length > 0) {
        this.processDetections(detections.detections);
      }
    } catch (error) {
      console.error('[MotionDetector] Frame processing error:', error);
    }
  }

  /**
   * Process detection results
   */
  processDetections(detections) {
    const now = Date.now();
    
    for (const detection of detections) {
      if (!detection.categories || detection.categories.length === 0) continue;
      
      const category = detection.categories[0];
      const rawLabel = category.categoryName.toLowerCase();
      const confidence = category.score;
      
      // Map to our label categories
      const mappedLabel = LABEL_MAPPING[rawLabel];
      if (!mappedLabel) continue;
      
      // Check if this label is in our targets
      if (!this.targetLabels.has(mappedLabel)) continue;
      
      // Check confidence threshold
      if (confidence < this.options.scoreThreshold) continue;
      
      // Create unique key for debouncing (include specific animal if applicable)
      const debounceKey = SPECIFIC_ANIMAL_LABELS.includes(rawLabel) 
        ? `${mappedLabel}:${rawLabel}` 
        : mappedLabel;
      
      // Check debounce
      const lastTime = this.lastDetectionTime[debounceKey] || 0;
      if (now - lastTime < this.debounceMs) continue;
      
      // Update debounce tracking
      this.lastDetectionTime[debounceKey] = now;
      
      // Prepare event data
      const eventData = {
        sensor_type: 'motion',
        label: mappedLabel,
        confidence: confidence,
        timestamp: now,
        metadata: {
          raw_label: rawLabel,
          bounding_box: detection.boundingBox ? {
            x: detection.boundingBox.originX,
            y: detection.boundingBox.originY,
            width: detection.boundingBox.width,
            height: detection.boundingBox.height,
          } : null,
        },
      };

      console.log(`[MotionDetector] Detected: ${rawLabel} → ${mappedLabel} (${(confidence * 100).toFixed(1)}%)`);

      // Send to main process
      if (window.electronAPI?.sendMonitoringEvent) {
        window.electronAPI.sendMonitoringEvent(eventData);
      }

      // Call callback
      this.onDetection(eventData);
    }
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(config) {
    if (config.targets) {
      this.targetLabels = new Set(config.targets);
      console.log('[MotionDetector] Updated targets:', Array.from(this.targetLabels));
    }
    if (config.confidence_threshold !== undefined) {
      this.options.scoreThreshold = config.confidence_threshold;
      console.log('[MotionDetector] Updated threshold:', this.options.scoreThreshold);
    }
    if (config.debounce_ms !== undefined) {
      this.debounceMs = config.debounce_ms;
      console.log('[MotionDetector] Updated debounce:', this.debounceMs);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      hasVideo: !!this.videoElement,
      targets: Array.from(this.targetLabels),
      threshold: this.options.scoreThreshold,
    };
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.stop();
    
    if (this.detector) {
      this.detector.close();
      this.detector = null;
    }
    
    this.isInitialized = false;
    console.log('[MotionDetector] Disposed');
  }
}

module.exports = MotionDetector;
