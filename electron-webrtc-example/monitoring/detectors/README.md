# Monitoring Detectors

## Overview / סקירה

This folder contains the local detection logic that runs in the Electron renderer process.

**No video is streamed during monitoring** - only event candidates (labels + confidence) are sent to the server.

---

## Motion Detector (MediaPipe)

Uses `@mediapipe/tasks-vision` for object detection.

### Supported Labels
- person
- animal (cat, dog, bird)
- vehicle

### File: `motion-detector.js`
Runs in renderer, analyzes video frames from local camera.

---

## Sound Detector (YAMNet)

Uses `@tensorflow/tfjs` with YAMNet model for audio classification.

### Supported Labels
- glass_breaking
- baby_crying
- dog_barking
- alarm
- gunshot
- scream
- door_knock
- siren

### File: `sound-detector.js`
Runs in renderer, analyzes audio from local microphone.

---

## Integration

Both detectors communicate with the main process via IPC:

```javascript
// When detection occurs:
window.electronAPI.sendMonitoringEvent({
  sensor_type: 'motion', // or 'sound'
  label: 'person',
  confidence: 0.85,
  timestamp: Date.now(),
  metadata: {}
});
```

---

## Models Location

Models are stored in `../models/` folder (gitignored).
They are downloaded on first run or bundled with the app.
