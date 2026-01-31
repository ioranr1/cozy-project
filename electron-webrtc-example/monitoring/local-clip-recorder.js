/**
 * Local Clip Recorder - MediaRecorder Integration
 * ================================================
 * VERSION: 0.2.0 (2026-01-31)
 * 
 * Records short video clips after validated security events.
 * Saves clips locally and manages retention.
 * 
 * Runs in Electron RENDERER process.
 * Uses IPC to get paths from main process (no @electron/remote).
 */

// Default configuration
const DEFAULT_CONFIG = {
  clip_duration_seconds: 10,
  local_retention_days: 7,
  max_clips_per_device: 100,
  video_format: 'webm',
  video_codec: 'vp9',
  video_bitrate: 2500000, // 2.5 Mbps
};

class LocalClipRecorder {
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.currentEventId = null;
    this.videoElement = null;
    this.clipsPath = null;
    this.isInitialized = false;

    console.log('[LocalClipRecorder] Created with config:', this.config);
  }

  /**
   * Initialize the recorder - must be called after electronAPI is available
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Get clips path from main process via IPC
      if (window.electronAPI?.getClipsPath) {
        this.clipsPath = await window.electronAPI.getClipsPath();
        console.log('[LocalClipRecorder] Clips path:', this.clipsPath);
        this.isInitialized = true;
        return true;
      } else {
        console.warn('[LocalClipRecorder] getClipsPath not available - clips will be stored in memory only');
        this.isInitialized = true;
        return true;
      }
    } catch (error) {
      console.error('[LocalClipRecorder] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Set the video element to record from
   */
  setVideoElement(videoElement) {
    this.videoElement = videoElement;
    console.log('[LocalClipRecorder] Video element set');
  }

  /**
   * Start recording a clip
   * @param {string} eventId - The event ID to associate with this clip
   * @param {MediaStream} [stream] - Optional stream to record (uses video element stream if not provided)
   * @returns {Promise<boolean>}
   */
  async startRecording(eventId, stream = null) {
    if (this.isRecording) {
      console.warn('[LocalClipRecorder] Already recording');
      return false;
    }

    // Get stream from video element if not provided
    let recordStream = stream;
    if (!recordStream && this.videoElement) {
      recordStream = this.videoElement.srcObject;
    }

    if (!recordStream) {
      console.error('[LocalClipRecorder] No stream available for recording');
      return false;
    }

    this.currentEventId = eventId;
    this.recordedChunks = [];

    try {
      // Determine best supported codec
      const mimeType = this.getSupportedMimeType();
      if (!mimeType) {
        console.error('[LocalClipRecorder] No supported video codec found');
        return false;
      }

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(recordStream, {
        mimeType,
        videoBitsPerSecond: this.config.video_bitrate,
      });

      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        this.saveRecording();
      };

      // Handle errors
      this.mediaRecorder.onerror = (event) => {
        console.error('[LocalClipRecorder] Recording error:', event.error);
        this.isRecording = false;
      };

      // Start recording
      this.mediaRecorder.start(1000); // Capture in 1-second chunks
      this.isRecording = true;
      console.log(`[LocalClipRecorder] Started recording for event: ${eventId}`);

      // Auto-stop after duration
      setTimeout(() => {
        this.stopRecording();
      }, this.config.clip_duration_seconds * 1000);

      return true;
    } catch (error) {
      console.error('[LocalClipRecorder] Failed to start recording:', error);
      return false;
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      return;
    }

    try {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      this.isRecording = false;
      console.log('[LocalClipRecorder] Stopped recording');
    } catch (error) {
      console.error('[LocalClipRecorder] Error stopping recording:', error);
      this.isRecording = false;
    }
  }

  /**
   * Save the recorded clip via IPC to main process
   */
  async saveRecording() {
    if (this.recordedChunks.length === 0) {
      console.warn('[LocalClipRecorder] No data to save');
      return null;
    }

    try {
      const blob = new Blob(this.recordedChunks, { 
        type: this.getSupportedMimeType() 
      });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.currentEventId}_${timestamp}.${this.config.video_format}`;

      // Convert blob to base64 for IPC transfer
      const arrayBuffer = await blob.arrayBuffer();
      const base64Data = this.arrayBufferToBase64(arrayBuffer);
      
      console.log(`[LocalClipRecorder] Saving clip: ${filename} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

      // Send to main process to save
      if (window.electronAPI?.saveClip) {
        const result = await window.electronAPI.saveClip({
          filename,
          base64Data,
          eventId: this.currentEventId,
          durationSeconds: this.config.clip_duration_seconds,
        });

        if (result.success) {
          console.log(`[LocalClipRecorder] Clip saved successfully: ${result.filepath}`);
          return {
            filename,
            filepath: result.filepath,
            durationSeconds: this.config.clip_duration_seconds,
            sizeBytes: arrayBuffer.byteLength,
          };
        } else {
          console.error('[LocalClipRecorder] Failed to save clip:', result.error);
          return null;
        }
      } else {
        console.warn('[LocalClipRecorder] saveClip IPC not available');
        return null;
      }
    } catch (error) {
      console.error('[LocalClipRecorder] Failed to save recording:', error);
      return null;
    } finally {
      this.recordedChunks = [];
      this.currentEventId = null;
    }
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Get supported MIME type for recording
   */
  getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    console.log('[LocalClipRecorder] Config updated');
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isRecording: this.isRecording,
      isInitialized: this.isInitialized,
      currentEventId: this.currentEventId,
      clipsPath: this.clipsPath,
      config: this.config,
    };
  }
}

// Export for use in renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalClipRecorder;
}

// Also make available globally for renderer scripts
if (typeof window !== 'undefined') {
  window.LocalClipRecorder = LocalClipRecorder;
}
