# Monitoring Detectors

## Overview / סקירה

Detection runs **locally only** in the Electron renderer process.
**No video is streamed** during monitoring - only event candidates (labels + confidence) are sent to the server.

---

## Dependencies / תלויות

Add to `package.json`:

```json
{
  "dependencies": {
    "@mediapipe/tasks-vision": "^0.10.14",
    "@tensorflow/tfjs": "^4.17.0"
  }
}
```

Install:
```bash
npm install @mediapipe/tasks-vision @tensorflow/tfjs
```

---

## Motion Detector (MediaPipe)

**File:** `motion-detector.js`

Uses `@mediapipe/tasks-vision` Object Detection API.

### Supported Labels
| Label | Description | Raw COCO Labels |
|-------|-------------|-----------------|
| `person` | Human detection | person |
| `animal` | Animal detection | cat, dog, bird, horse, etc. |
| `vehicle` | Vehicle detection | car, truck, bus, motorcycle, etc. |

### Usage

```javascript
const MotionDetector = require('./detectors/motion-detector');

const detector = new MotionDetector({
  targets: ['person', 'animal'],
  scoreThreshold: 0.6,
  debounce_ms: 3000,
  onDetection: (event) => console.log('Motion:', event),
});

await detector.initialize();

// Get video element with camera stream
const video = document.getElementById('camera-feed');
await detector.start(video);

// Later...
detector.stop();
detector.dispose();
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `modelPath` | EfficientDet-Lite0 | Path to TFLite model |
| `maxResults` | 5 | Max detections per frame |
| `scoreThreshold` | 0.5 | Minimum confidence |
| `delegate` | 'GPU' | GPU or CPU |
| `targets` | ['person', 'animal', 'vehicle'] | Labels to detect |
| `debounce_ms` | 3000 | Debounce per label |
| `detectionIntervalMs` | 200 | Detection frame rate (5 FPS) |

---

## Sound Detector (YAMNet)

**File:** `sound-detector.js`

Uses TensorFlow.js with Google's YAMNet model.

### Supported Labels

| Label | Description | YAMNet Classes |
|-------|-------------|----------------|
| `glass_breaking` | Glass shatter/break | Shatter, Splinter, Crash |
| `baby_crying` | Baby/infant crying | Crying, sobbing, Baby cry |
| `dog_barking` | Dog sounds | Bark, Yip, Howl, Growling |
| `alarm` | Alarm sounds | Smoke detector, Fire alarm, Buzzer |
| `gunshot` | Gunfire | Gunshot, Machine gun, Artillery |
| `scream` | Human scream | Screaming, Wail, Shout |
| `siren` | Emergency sirens | Siren, Police, Ambulance, Fire engine |
| `door_knock` | Door knock | Knock, Tap |

### Usage

```javascript
const SoundDetector = require('./detectors/sound-detector');

const detector = new SoundDetector({
  targets: ['glass_breaking', 'alarm', 'scream'],
  confidenceThreshold: 0.6,
  debounce_ms: 2000,
  onDetection: (event) => console.log('Sound:', event),
});

await detector.initialize();
await detector.start(); // Uses microphone

// Later...
detector.stop();
detector.dispose();
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `sampleRate` | 16000 | Audio sample rate (fixed for YAMNet) |
| `confidenceThreshold` | 0.5 | Minimum confidence |
| `targets` | All supported | Labels to detect |
| `debounce_ms` | 2000 | Debounce per label |

---

## Event Format

Both detectors emit events in this format:

```javascript
{
  sensor_type: 'motion' | 'sound',
  label: 'person' | 'animal' | 'glass_breaking' | ...,
  confidence: 0.85,
  timestamp: 1706600000000,
  metadata: {
    // Motion: bounding_box, raw_label
    // Sound: yamnet_class, yamnet_index
  }
}
```

---

## Integration with Main Process

Events are sent via IPC:

```javascript
// In renderer (detector does this automatically):
window.electronAPI.sendMonitoringEvent(eventData);

// In main.js:
ipcMain.on('monitoring-event-detected', (event, data) => {
  monitoringManager.handleEvent(data);
});
```

---

## Privacy Notes

1. **Camera/Mic only accessed when Monitoring is active**
2. **All processing is local** - no video/audio leaves the device
3. **Only labels + confidence are sent to server**
4. **Hardware LEDs indicate active sensors**

---

## Changelog

### v0.2.0 (2026-01-30)
- Full MediaPipe Tasks Vision implementation
- Full TensorFlow.js + YAMNet implementation
- Proper debouncing and threshold filtering
- Label mapping and normalization
