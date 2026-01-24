# Away Mode Integration Guide

## Overview

Away Mode allows users to keep their computer running as a security camera while they're away. When enabled:

1. **Preflight checks** verify power connection and camera availability
2. **Sleep prevention** keeps the computer awake
3. **Display off** (best effort) to save power
4. **User input detection** prompts users when they return

## DO NOT TOUCH Files

These files contain video/WebRTC logic and should NOT be modified:
- `renderer-webrtc.js`
- `preload-additions.js` (WebRTC sections)
- `main-additions.js` (WebRTC sections)

## Integration Steps

### Step 1: Add to main.js

```javascript
// At the top of main.js
const { initAwayMode, setAwayModeDeviceId, cleanupAwayMode } = require('./away-mode.js');

// After window is created and deviceId is known
await initAwayMode(mainWindow, deviceId, currentLanguage);

// When device ID changes (e.g., after pairing)
setAwayModeDeviceId(newDeviceId);

// On app quit
app.on('before-quit', async () => {
  await cleanupAwayMode();
});
```

### Step 2: Merge preload.js

```javascript
// In your preload.js
const { awayModeAPI } = require('./away-mode-preload.js');

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods ...
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  exitApp: () => ipcRenderer.invoke('exit-app'),
  
  // Away Mode additions
  ...awayModeAPI,
});
```

### Step 3: Add renderer script to index.html

```html
<!-- After renderer-webrtc.js -->
<script src="away-mode-renderer.js"></script>
```

## State Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (SSOT)                          │
│  device_status.device_mode = 'NORMAL' | 'AWAY'              │
│  feature_flags.away_mode = true | false                     │
│  commands table for SET_DEVICE_MODE commands                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Realtime subscription
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                ELECTRON MAIN PROCESS                        │
│  away-mode.js                                               │
│  - Listens for device_mode changes                          │
│  - Listens for SET_DEVICE_MODE commands (from mobile)       │
│  - Runs preflight checks (power, camera)                    │
│  - Controls powerSaveBlocker                                │
│  - ACKs or FAILs commands                                   │
│  - Detects user input                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                ELECTRON RENDERER                            │
│  away-mode-renderer.js                                      │
│  - Shows notifications (enabled/disabled/error)             │
│  - Shows "user returned" prompt                             │
│  - Checks camera availability                               │
└─────────────────────────────────────────────────────────────┘
```

## Remote Command Flow (Mobile → Desktop)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Mobile     │     │   Supabase   │     │   Desktop    │
│   Dashboard  │     │   Database   │     │   Electron   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │ 1. Toggle ON       │                    │
       │───────────────────>│                    │
       │ INSERT command     │                    │
       │ SET_DEVICE_MODE:AWAY                    │
       │                    │                    │
       │                    │ 2. Realtime INSERT │
       │                    │───────────────────>│
       │                    │                    │
       │                    │    3. Preflight    │
       │                    │    checks (power,  │
       │                    │    camera)         │
       │                    │                    │
       │                    │ 4a. If PASS:       │
       │                    │    - preventSleep()│
       │                    │    - Update status │
       │                    │<───────────────────│
       │                    │ ACK command        │
       │                    │                    │
       │ 5. Realtime UPDATE │                    │
       │<───────────────────│                    │
       │ status='acknowledged'                   │
       │                    │                    │
       │ 4b. If FAIL:       │                    │
       │                    │<───────────────────│
       │                    │ FAIL command       │
       │                    │ + error_message    │
       │                    │                    │
       │ 5. Realtime UPDATE │                    │
       │<───────────────────│                    │
       │ status='failed'    │                    │
       │ Show error toast   │                    │
       └────────────────────┴────────────────────┘
```

## Transitions

### NORMAL → AWAY

1. User toggles Away Mode ON in dashboard
2. Dashboard updates `device_status.device_mode = 'AWAY'`
3. Electron receives realtime update
4. Preflight checks run:
   - Power connected? ✓
   - Camera available? ✓
5. If passed:
   - `powerSaveBlocker.start()` prevents sleep
   - Display off attempted
   - Input detection starts
6. If failed:
   - Revert `device_status.device_mode = 'NORMAL'`
   - Show error notification

### AWAY → NORMAL

1. User toggles Away Mode OFF in dashboard (or confirms disable prompt)
2. Dashboard updates `device_status.device_mode = 'NORMAL'`
3. Electron receives realtime update
4. `powerSaveBlocker.stop()` allows sleep
5. Input detection stops

### User Returns (while AWAY)

1. User activity detected (screen unlock, window focus, etc.)
2. Prompt shown: "Would you like to disable Away mode?"
3. User clicks "Disable" → Updates DB to NORMAL
4. User clicks "Keep" → Dismisses prompt, no change

## Logging

All transitions are logged with `[AwayMode]` prefix:

```
[AwayMode] Enabling Away mode...
[AwayMode] Running preflight checks...
[AwayMode] Power check - onBattery: false
[AwayMode] Camera check result: { success: true }
[AwayMode] Preflight result: PASSED []
[AwayMode] Sleep prevention STARTED, blocker ID: 1
[AwayMode] Attempting to turn off display (best effort)...
[AwayMode] Away mode ENABLED successfully
[AwayMode] Transition: NORMAL -> AWAY
```

## Feature Flags

- `feature_flags.away_mode = true` - Enables Away Mode functionality
- `feature_flags.security_mode = true` - Shows Security Mode placeholder (coming soon)

Away mode only activates when the flag is enabled. This allows gradual rollout without code changes.

## Security Mode Scaffold (STEP 5)

Security Mode is currently scaffolded but NOT functional:

### Dependency Rules

1. **If `device_mode != AWAY`, `security_enabled` MUST be `false`**
   - Enforced in `disableAwayMode()`: when Away mode is disabled, security_enabled is automatically set to false
   
2. **SET_SECURITY_ENABLED commands are rejected with clear message:**
   - If Away mode is not active: "Security mode requires Away mode to be active"
   - Always: "Security mode is not yet available. Feature coming soon."

### Command Scaffold

The `SET_SECURITY_ENABLED` command type is defined but always fails:

```
SET_SECURITY_ENABLED:true  → FAILED: "Security mode is not yet available"
SET_SECURITY_ENABLED:false → FAILED: "Security mode is not yet available"
```

### UI Placeholder

A disabled "Security Mode (Coming Soon)" card is shown in the dashboard when `feature_flags.security_mode = true`.

### What's NOT Implemented (by design)

- ❌ Motion detection
- ❌ AI/ML analysis
- ❌ Audio detection
- ❌ Recording
- ❌ Alerts

## Hard Constraints (Confirmed)

- ✅ Does NOT modify video capture/streaming/signaling
- ✅ Does NOT change mobile viewer behavior
- ✅ Does NOT implement wake from sleep
- ✅ Preflight failure reverts to NORMAL with clear error
- ✅ User returned prompt does NOT auto-disable (requires confirmation)
- ✅ Security mode scaffold only - no detection implemented
- ✅ Dependency enforcement: security_enabled=false when device_mode!=AWAY
