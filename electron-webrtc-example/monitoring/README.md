# AIGuard Monitoring Module

## 📁 Structure / מבנה

```
monitoring/
├── README.md              # This file
├── monitoring-manager.js  # State & event management
├── monitoring-ipc.js      # IPC bridge definitions
├── monitoring-config.js   # Default configs & schemas
├── detectors/
│   ├── motion-detector.js # MediaPipe Tasks Vision integration
│   └── sound-detector.js  # TensorFlow.js + YAMNet integration
└── models/                # Local ML models (gitignored)
    ├── .gitkeep
    └── README.md
```

---

## 🎯 Design Principles / עקרונות עיצוב

1. **Local Detection Only** - כל הזיהוי רץ מקומית
   - Motion: MediaPipe Tasks Vision (@mediapipe/tasks-vision)
   - Sound: TensorFlow.js + YAMNet model

2. **No Video Streaming** - אין שידור וידאו בזמן ניטור
   - Only event candidates (labels + confidence) sent to server

3. **Per-Device Configuration** - הגדרות לכל מכשיר
   - Sensors config stored in JSONB
   - Easy to extend with new sensor types

4. **Hierarchical State** - מצב היררכי
   - Monitoring is child of Away Mode
   - Motion/Sound are children of Monitoring

---

## 🔧 Dependencies / תלויות

```json
{
  "@mediapipe/tasks-vision": "^0.10.x",
  "@tensorflow/tfjs": "^4.x",
  "@tensorflow-models/speech-commands": "^0.5.x"
}
```

---

## 📊 Data Flow / זרימת נתונים

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electron Renderer                            │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Motion Detector │    │ Sound Detector  │                     │
│  │ (MediaPipe)     │    │ (YAMNet)        │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           └──────────┬───────────┘                               │
│                      ▼                                           │
│           ┌─────────────────────┐                               │
│           │ Monitoring Manager  │                               │
│           │ - Debounce logic    │                               │
│           │ - Confidence filter │                               │
│           │ - Event aggregation │                               │
│           └──────────┬──────────┘                               │
└──────────────────────┼──────────────────────────────────────────┘
                       │ IPC: monitoring-event-detected
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Electron Main                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Main.js                                                      │ │
│  │ - Receives event candidates                                  │ │
│  │ - Sends to Supabase: monitoring_events table                │ │
│  │ - Triggers push notification (optional)                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Supabase                                      │
│  ┌────────────────────┐  ┌────────────────────┐                  │
│  │ monitoring_config  │  │ monitoring_events  │                  │
│  │ (per device)       │  │ (event log)        │                  │
│  └────────────────────┘  └────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Integration with Main.js / אינטגרציה

```javascript
// In main.js:
const MonitoringManager = require('./monitoring/monitoring-manager');
const monitoringManager = new MonitoringManager({ supabase });
monitoringManager.setMainWindow(mainWindow);
monitoringManager.setDeviceId(deviceId);

// Handle commands:
case 'SET_MONITORING:ON':
  await monitoringManager.enable();
  break;
case 'SET_MONITORING:OFF':
  await monitoringManager.disable();
  break;
case 'UPDATE_MONITORING_CONFIG':
  await monitoringManager.updateConfig(payload);
  break;
```

---

## 📝 Event Schema / סכמת אירוע

```javascript
// Event sent from detector to manager
{
  sensor_type: 'motion' | 'sound',
  label: 'person' | 'animal' | 'glass_breaking' | 'baby_crying' | ...,
  confidence: 0.85,
  timestamp: Date.now(),
  frame_data: null, // Optional: base64 thumbnail for AI validation
  audio_snippet: null // Optional: base64 audio for AI validation
}

// Event stored in monitoring_events table
{
  id: uuid,
  device_id: uuid,
  sensor_type: 'motion',
  label: 'person',
  confidence: 0.85,
  metadata: { /* additional context */ },
  ai_validation: null, // Later: { validated: true, label: 'person', confidence: 0.92 }
  created_at: timestamp
}
```

---

## 📅 Changelog

### v0.1.0 (2026-01-30)
- Initial module structure
- README with architecture documentation
