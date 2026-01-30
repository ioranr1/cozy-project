/**
 * Local Clip Recorder - MediaRecorder Integration
 * ================================================
 * VERSION: 0.1.0 (2026-01-30)
 * 
 * Records short video clips after validated security events.
 * Saves clips locally and manages retention.
 * 
 * Runs in Electron RENDERER process.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron').remote || require('@electron/remote');

// Default configuration
const DEFAULT_CONFIG = {
  clip_duration_seconds: 10,
  local_retention_days: 7,
  max_clips_per_device: 100,
  clips_folder: 'clips', // Relative to app data folder
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

    // Initialize clips folder
    this.initializeClipsFolder();
    
    console.log('[LocalClipRecorder] Initialized with config:', this.config);
  }

  /**
   * Initialize the clips storage folder
   */
  initializeClipsFolder() {
    try {
      const userDataPath = app ? app.getPath('userData') : process.cwd();
      this.clipsPath = path.join(userDataPath, this.config.clips_folder);
      
      if (!fs.existsSync(this.clipsPath)) {
        fs.mkdirSync(this.clipsPath, { recursive: true });
        console.log('[LocalClipRecorder] Created clips folder:', this.clipsPath);
      }
    } catch (error) {
      console.error('[LocalClipRecorder] Failed to initialize clips folder:', error);
      this.clipsPath = null;
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

    if (!this.clipsPath) {
      console.error('[LocalClipRecorder] Clips folder not available');
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
   * Save the recorded clip to disk
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
      const filePath = path.join(this.clipsPath, filename);

      // Convert blob to buffer and save
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      fs.writeFileSync(filePath, buffer);
      
      console.log(`[LocalClipRecorder] Saved clip: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

      // Notify main process about the clip
      if (window.electronAPI?.notifyClipRecorded) {
        window.electronAPI.notifyClipRecorded({
          eventId: this.currentEventId,
          filename,
          filepath: filePath,
          durationSeconds: this.config.clip_duration_seconds,
          sizeBytes: buffer.length,
        });
      }

      // Clean old clips
      this.cleanOldClips();

      return {
        filename,
        filepath: filePath,
        durationSeconds: this.config.clip_duration_seconds,
        sizeBytes: buffer.length,
      };
    } catch (error) {
      console.error('[LocalClipRecorder] Failed to save recording:', error);
      return null;
    } finally {
      this.recordedChunks = [];
      this.currentEventId = null;
    }
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
   * Clean old clips based on retention policy
   */
  cleanOldClips() {
    if (!this.clipsPath || !fs.existsSync(this.clipsPath)) {
      return;
    }

    try {
      const files = fs.readdirSync(this.clipsPath);
      const now = Date.now();
      const maxAge = this.config.local_retention_days * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.clipsPath, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`[LocalClipRecorder] Deleted old clip: ${file}`);
        }
      }

      // Also enforce max clips limit
      const remainingFiles = fs.readdirSync(this.clipsPath)
        .map(f => ({
          name: f,
          path: path.join(this.clipsPath, f),
          mtime: fs.statSync(path.join(this.clipsPath, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime); // Newest first

      if (remainingFiles.length > this.config.max_clips_per_device) {
        const toDelete = remainingFiles.slice(this.config.max_clips_per_device);
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
          deletedCount++;
          console.log(`[LocalClipRecorder] Deleted excess clip: ${file.name}`);
        }
      }

      if (deletedCount > 0) {
        console.log(`[LocalClipRecorder] Cleaned ${deletedCount} old clips`);
      }
    } catch (error) {
      console.error('[LocalClipRecorder] Failed to clean old clips:', error);
    }
  }

  /**
   * Get list of local clips
   */
  getClipsList() {
    if (!this.clipsPath || !fs.existsSync(this.clipsPath)) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.clipsPath);
      return files.map(f => {
        const filePath = path.join(this.clipsPath, f);
        const stats = fs.statSync(filePath);
        const eventIdMatch = f.match(/^([a-f0-9-]+)_/);
        
        return {
          filename: f,
          filepath: filePath,
          eventId: eventIdMatch ? eventIdMatch[1] : null,
          sizeBytes: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      }).sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      console.error('[LocalClipRecorder] Failed to list clips:', error);
      return [];
    }
  }

  /**
   * Get clip by event ID
   */
  getClipByEventId(eventId) {
    const clips = this.getClipsList();
    return clips.find(c => c.eventId === eventId) || null;
  }

  /**
   * Delete a specific clip
   */
  deleteClip(filename) {
    if (!this.clipsPath) return false;

    try {
      const filePath = path.join(this.clipsPath, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[LocalClipRecorder] Deleted clip: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[LocalClipRecorder] Failed to delete clip:', error);
      return false;
    }
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
      currentEventId: this.currentEventId,
      clipsPath: this.clipsPath,
      clipCount: this.getClipsList().length,
      config: this.config,
    };
  }
}

module.exports = LocalClipRecorder;
