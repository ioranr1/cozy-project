/**
 * AudioWorklet Level Processor
 * =============================
 * VERSION: 1.0.0 (2026-02-12)
 * 
 * Runs in AudioWorklet thread. Calculates RMS and Peak levels
 * from incoming audio samples. Sends metrics to main thread
 * via port.postMessage at a throttled rate (~250ms).
 * 
 * IMPORTANT: This file runs in a separate thread.
 * No access to DOM, window, or Node.js APIs.
 */

class LevelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Throttle: send metrics every ~250ms (at 44100Hz, 128 samples/block ≈ 2.9ms/block → ~86 blocks)
    this._reportIntervalFrames = 86;
    this._frameCount = 0;
    
    // Accumulate across multiple process() calls
    this._sumSquares = 0;
    this._peak = 0;
    this._sampleCount = 0;
    
    // Control channel
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === 'stop') {
        this._stopped = true;
      }
    };
    
    this._stopped = false;
  }

  process(inputs, outputs, parameters) {
    // If stopped, return false to let GC collect this processor
    if (this._stopped) {
      return false;
    }
    
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }
    
    // Use first channel only (mono)
    const channelData = input[0];
    if (!channelData || channelData.length === 0) {
      return true;
    }
    
    // Accumulate RMS and Peak
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      this._sumSquares += sample * sample;
      const abs = Math.abs(sample);
      if (abs > this._peak) {
        this._peak = abs;
      }
    }
    this._sampleCount += channelData.length;
    this._frameCount++;
    
    // Report at throttled interval
    if (this._frameCount >= this._reportIntervalFrames) {
      const rms = this._sampleCount > 0
        ? Math.sqrt(this._sumSquares / this._sampleCount)
        : 0;
      
      this.port.postMessage({
        type: 'level',
        rms: rms,
        peak: this._peak,
        samples: this._sampleCount,
        timestamp: currentTime,
      });
      
      // Reset accumulators
      this._sumSquares = 0;
      this._peak = 0;
      this._sampleCount = 0;
      this._frameCount = 0;
    }
    
    return true;
  }
}

registerProcessor('level-processor', LevelProcessor);
