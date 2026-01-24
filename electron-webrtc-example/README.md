# Electron WebRTC Live View Implementation

## Overview

This folder contains example code for implementing WebRTC live streaming in your Electron desktop app. The implementation follows the existing architecture where:

1. **Mobile/Web** creates an `rtc_session` and sends `START_LIVE_VIEW` command
2. **Electron main.js** subscribes to `rtc_sessions` and triggers renderer via IPC
3. **Electron renderer** handles WebRTC: camera access, offer creation, signaling

## Files Structure

| File | Description | Action |
|------|-------------|--------|
| `renderer-webrtc.js` | WebRTC implementation for the renderer process | **Copy to your project** |
| `preload-additions.js` | IPC bridge additions for preload.js | **Merge into your preload.js** |
| `main-additions.js` | Command handling additions for main.js | **Merge into your main.js** |
| `away-mode.js` | **Away Mode system behavior (main process)** | **Copy as new file** |
| `away-mode-preload.js` | **Away Mode IPC bridge** | **Merge into your preload.js** |
| `away-mode-renderer.js` | **Away Mode UI (renderer process)** | **Copy to your project** |
| `AWAY-MODE-INTEGRATION.md` | Full Away Mode integration guide | **Read for reference** |

---

## 🚀 Quick Start - What to Copy to Your Electron Project

### Your Current Files:
```
your-electron-project/
├── main.js           ← Add code from main-additions.js + away-mode.js import
├── preload.js        ← Add code from preload-additions.js + away-mode-preload.js
├── index.html        ← Add script tags for renderer files
├── renderer-webrtc.js ← Already exists (WebRTC)
└── (new) away-mode.js ← Copy this file
```

---

## Integration Steps

### Step 1: Copy away-mode.js (NEW FILE)

Copy the `away-mode.js` file to your Electron project folder (same level as main.js).

### Step 2: Update main.js

Add at the top of your main.js:
```javascript
// Import Away Mode module
const awayMode = require('./away-mode');
```

Add after creating mainWindow:
```javascript
// Initialize Away Mode (after mainWindow is created)
awayMode.initAwayMode(mainWindow, deviceId, 'he'); // 'he' for Hebrew, 'en' for English
```

Add the session subscription logic from `main-additions.js`:
- `subscribeToRtcSessions(deviceId)` - Subscribe to pending sessions
- `handleNewSession(session)` - Send IPC to renderer with sessionId
- Update your command handler for `START_LIVE_VIEW` and `STOP_LIVE_VIEW`

Add cleanup on app quit:
```javascript
app.on('before-quit', async () => {
  await awayMode.cleanupAwayMode();
});
```

### Step 3: Update preload.js

Merge the IPC listeners from `preload-additions.js` AND `away-mode-preload.js`:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // === Existing methods ===
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  exitApp: () => ipcRenderer.invoke('exit-app'),
  
  // === WebRTC (from preload-additions.js) ===
  onStartLiveView: (callback) => {
    ipcRenderer.on('start-live-view', (event, sessionId) => callback(sessionId));
  },
  onStopLiveView: (callback) => {
    ipcRenderer.on('stop-live-view', () => callback());
  },
  
  // === Away Mode (from away-mode-preload.js) ===
  onAwayModeEnabled: (callback) => {
    ipcRenderer.on('away-mode-enabled', (event, data) => callback(data));
  },
  onAwayModeDisabled: (callback) => {
    ipcRenderer.on('away-mode-disabled', (event, data) => callback(data));
  },
  onAwayModePreflightFailed: (callback) => {
    ipcRenderer.on('away-mode-preflight-failed', (event, data) => callback(data));
  },
  onAwayModeUserReturned: (callback) => {
    ipcRenderer.on('away-mode-user-returned', (event, data) => callback(data));
  },
  onCheckCamera: (callback) => {
    ipcRenderer.on('away-mode-check-camera', () => callback());
  },
  awayModeDisableConfirmed: () => ipcRenderer.send('away-mode-disable-confirmed'),
  awayModeKeep: () => ipcRenderer.send('away-mode-keep'),
  awayModeCameraCheckResult: (result) => ipcRenderer.send('away-mode-camera-check-result', result),
});
```

### Step 4: Update index.html

Add the Away Mode renderer script:
```html
<script src="renderer-webrtc.js"></script>
<script src="away-mode-renderer.js"></script>
```

---

## Flow Diagram - WebRTC

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │     │   Supabase DB   │     │  Electron App   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. INSERT rtc_session │                       │
         │ (status: pending)     │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │ 2. INSERT command     │                       │
         │ (START_LIVE_VIEW)     │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ 3. Realtime notify    │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │                       │ 4. main.js: handleNewSession
         │                       │                       │    sends IPC to renderer
         │                       │                       │
         │                       │                       │ 5. renderer: getUserMedia
         │                       │                       │    creates RTCPeerConnection
         │                       │                       │    creates offer
         │                       │                       │
         │                       │ 6. INSERT rtc_signal  │
         │                       │    (type: offer)      │
         │                       │<──────────────────────│
         │                       │                       │
         │ 7. Realtime/polling   │                       │
         │    receives offer     │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │ 8. setRemoteDesc      │                       │
         │    createAnswer       │                       │
         │                       │                       │
         │ 9. INSERT rtc_signal  │                       │
         │    (type: answer)     │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ 10. Polling receives  │
         │                       │     answer            │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │                       │ 11. setRemoteDescription
         │                       │                       │
         │ ←────────── ICE candidates exchanged ──────────→ │
         │                       │                       │
         │ 12. Video stream      │                       │
         │     established       │                       │
         │<══════════════════════════════════════════════│
         │                       │                       │
```

## Flow Diagram - Away Mode

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │     │   Supabase DB   │     │  Electron App   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ 1. INSERT command     │                       │
         │ (SET_DEVICE_MODE:AWAY)│                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │ 2. Realtime notify    │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │                       │ 3. Run preflight checks:
         │                       │                       │    - Power connected?
         │                       │                       │    - Camera available?
         │                       │                       │
         │                       │                       │ 4. If passed:
         │                       │                       │    - preventSleep()
         │                       │                       │    - turnOffDisplay()
         │                       │                       │
         │                       │ 5. UPDATE device_status│
         │                       │    device_mode: AWAY  │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 6. ACK command        │
         │                       │<──────────────────────│
         │                       │                       │
         │ 7. Realtime receives  │                       │
         │    status update      │                       │
         │<──────────────────────│                       │
         │                       │                       │
```

---

## Testing

### WebRTC Live View:
1. Start your Electron app
2. Open the mobile app Dashboard
3. Click "Live View" (צפייה חיה)
4. Check Electron console for:
   - `[Main] New rtc_session detected`
   - `[Main] Sending start-live-view IPC`
   - `[Desktop] START LIVE VIEW`
   - `[Desktop] ✅ OFFER SENT`
   - `[Desktop] 📥 Received ANSWER`
   - `[Desktop] PEER CONNECTION ESTABLISHED`

### Away Mode:
1. Start your Electron app
2. Make sure laptop is plugged into power
3. From mobile Dashboard, enable Away Mode
4. Check Electron console for:
   - `[AwayMode] Command received: SET_DEVICE_MODE:AWAY`
   - `[AwayMode] Running preflight checks...`
   - `[AwayMode] Preflight result: PASSED`
   - `[AwayMode] Sleep prevention STARTED`
   - `[AwayMode] Away mode ENABLED`

---

## Troubleshooting

### WebRTC Issues:

#### No offer sent
- Check camera permissions in Electron
- Verify `getUserMedia` succeeds
- Check Supabase credentials

#### Answer not received
- Verify mobile app is on Viewer page
- Check `rtc_signals` table in Supabase
- Ensure Realtime is enabled on `rtc_signals` table

#### Connection fails after answer
- Check ICE candidates are being exchanged
- Verify TURN credentials are being fetched
- Check firewall/NAT settings

### Away Mode Issues:

#### Preflight fails - "Not on power"
- Plug laptop into charger
- Check `powerMonitor.isOnBatteryPower()` in Electron DevTools

#### Preflight fails - "Camera not available"
- Close other apps using camera
- Check camera permissions

#### Display doesn't turn off
- Windows: Install `nircmd.exe` and add to PATH
- macOS: Requires admin permissions for `pmset`
- Linux: Requires X11 and `xset` installed

#### User returned prompt doesn't show
- Check `powerMonitor` events are working
- Verify window focus events are firing
