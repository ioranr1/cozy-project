# AIGuard Electron Desktop Agent

## 📁 Project Structure / מבנה הפרויקט

```
electron-webrtc-example/
├── node_modules/        # Dependencies
├── away/                # Away Mode module (SEPARATE!)
│   ├── README.md        # Away Mode documentation
│   ├── away-manager.js  # State & power management
│   ├── away-ipc.js      # IPC bridge definitions
│   └── away-strings.js  # i18n strings
├── icon.ico             # Windows tray icon
├── icon.png             # Cross-platform icon
├── index.html           # UI + Away Mode handlers
├── main.js              # Main process (core)
├── preload.js           # IPC bridge
├── renderer-webrtc.js   # WebRTC video logic
├── package.json         # Dependencies config
└── package-lock.json    # Lock file
```

---

## 🔧 Core Files / קבצים ראשיים

| File | Purpose | Lines |
|------|---------|-------|
| `main.js` | Electron main process, subscriptions, commands | ~900 |
| `preload.js` | IPC bridge to renderer | ~190 |
| `index.html` | Pairing UI + Away Mode modals | ~844 |
| `renderer-webrtc.js` | WebRTC camera streaming | ~500 |

---

## 📦 Away Mode Module / מודול מצב מרוחק

**See `away/README.md` for full documentation.**

Quick Integration:
```javascript
// In main.js:
const AwayManager = require('./away/away-manager');
const awayManager = new AwayManager({ supabase });
awayManager.setMainWindow(mainWindow);
awayManager.setDeviceId(deviceId);

// Handle commands:
case 'SET_DEVICE_MODE:AWAY':
  await awayManager.enable();
  break;
case 'SET_DEVICE_MODE:NORMAL':
  await awayManager.disable();
  break;
```

---

## 🚀 Flow Diagram - WebRTC

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

---

## 🏠 Flow Diagram - Away Mode

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
         │                       │                       │ 3. AwayManager.enable():
         │                       │                       │    - Check feature flag
         │                       │                       │    - Run preflight checks
         │                       │                       │    - powerSaveBlocker.start()
         │                       │                       │    - turnOffDisplay()
         │                       │                       │
         │                       │ 4. UPDATE device_status│
         │                       │    device_mode: AWAY  │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │ 5. ACK command        │
         │                       │<──────────────────────│
         │                       │                       │
         │ 6. Realtime receives  │                       │
         │    status update      │                       │
         │<──────────────────────│                       │
         │                       │                       │
```

---

## 🧪 Testing

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
   - `[AwayManager] Enable requested`
   - `[AwayManager] ✓ System sleep prevention is ACTIVE`
   - `[AwayManager] ✓ Away Mode enabled`

---

## 🔧 Troubleshooting

### WebRTC Issues:

| Problem | Solution |
|---------|----------|
| No offer sent | Check camera permissions in Electron |
| Answer not received | Verify mobile app is on Viewer page |
| Connection fails after answer | Check ICE/TURN credentials |

### Away Mode Issues:

| Problem | Solution |
|---------|----------|
| Preflight fails - "Camera" | Close other apps using camera |
| Display doesn't turn off (Windows) | Add `nircmd.exe` to project root |
| Display doesn't turn off (macOS) | Requires admin permissions for `pmset` |
| Display doesn't turn off (Linux) | Requires X11 and `xset` installed |

---

## 📝 Changelog

### v2.0.0 (2026-01-25)
- **NEW**: Separated Away Mode into `away/` folder module
- **REMOVED**: Deleted redundant files (`away-mode.js`, `away-mode-preload.js`, etc.)
- **CLEANED**: Single source of truth for all logic

### v1.0.0
- Initial WebRTC implementation
- Basic Away Mode support
