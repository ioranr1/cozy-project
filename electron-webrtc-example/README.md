# Electron WebRTC Live View Implementation

## Overview

This folder contains example code for implementing WebRTC live streaming in your Electron desktop app. The implementation follows the existing architecture where:

1. **Mobile/Web** creates an `rtc_session` and sends `START_LIVE_VIEW` command
2. **Electron main.js** subscribes to `rtc_sessions` and triggers renderer via IPC
3. **Electron renderer** handles WebRTC: camera access, offer creation, signaling

## Files

| File | Description |
|------|-------------|
| `renderer-webrtc.js` | WebRTC implementation for the renderer process |
| `preload-additions.js` | IPC bridge additions for preload.js |
| `main-additions.js` | Command handling additions for main.js |

## Integration Steps

### 1. Update preload.js

Add the IPC listeners from `preload-additions.js` to your existing preload.js:

```javascript
onStartLiveView: (callback) => {
  ipcRenderer.on('start-live-view', (event, sessionId) => {
    callback(sessionId);
  });
},
onStopLiveView: (callback) => {
  ipcRenderer.on('stop-live-view', () => {
    callback();
  });
},
```

### 2. Update main.js

Add the session subscription logic from `main-additions.js`:

- `subscribeToRtcSessions(deviceId)` - Subscribe to pending sessions
- `handleNewSession(session)` - Send IPC to renderer with sessionId
- Update your command handler for `START_LIVE_VIEW` and `STOP_LIVE_VIEW`

### 3. Load renderer-webrtc.js

Include the renderer script in your HTML:

```html
<script src="renderer-webrtc.js"></script>
```

Or if using a bundler, import it:

```javascript
import './renderer-webrtc.js';
```

## Flow Diagram

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

## Testing

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

## Troubleshooting

### No offer sent
- Check camera permissions in Electron
- Verify `getUserMedia` succeeds
- Check Supabase credentials

### Answer not received
- Verify mobile app is on Viewer page
- Check `rtc_signals` table in Supabase
- Ensure Realtime is enabled on `rtc_signals` table

### Connection fails after answer
- Check ICE candidates are being exchanged
- Verify TURN credentials are being fetched
- Check firewall/NAT settings

### Session stuck in pending
- Verify main.js is subscribing to `rtc_sessions`
- Check IPC is reaching renderer
- Ensure renderer script is loaded
