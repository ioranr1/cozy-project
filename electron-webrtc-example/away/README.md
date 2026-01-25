# Away Mode Module
## מודול מצב מרוחק

This folder contains all Away Mode related logic, separated from the core WebRTC/Video functionality.

---

## 📁 Structure / מבנה

```
away/
├── README.md          ← You are here
├── away-manager.js    ← Away Mode state & power management (main process)
├── away-ipc.js        ← IPC bridge definitions
└── away-strings.js    ← i18n strings for Away Mode
```

---

## 🔌 Integration / אינטגרציה

### In main.js:
```javascript
const AwayManager = require('./away/away-manager');
const awayManager = new AwayManager(supabase, store);

// When handling commands:
case 'SET_DEVICE_MODE:AWAY':
  await awayManager.enable(deviceId, mainWindow);
  break;

case 'SET_DEVICE_MODE:NORMAL':
  await awayManager.disable(deviceId, mainWindow);
  break;
```

### In preload.js:
```javascript
const { awayModeAPI } = require('./away/away-ipc');
// Merge with existing electronAPI or expose separately
```

---

## ⚙️ Features / תכונות

1. **Power Save Blocker** - Prevents system sleep using `prevent-display-sleep`
2. **Display Control** - Turns off display using platform-specific commands:
   - macOS: `pmset displaysleepnow`
   - Windows: `nircmd.exe monitor off` (optional)
   - Linux: `xset dpms force off`
3. **User Return Detection** - Detects when user returns (focus, resume, unlock)
4. **Preflight Checks** - Camera availability before enabling

---

## 📡 IPC Events / אירועי IPC

### Main → Renderer:
| Event | Data | Description |
|-------|------|-------------|
| `away-mode-enabled` | `{}` | Away Mode activated successfully |
| `away-mode-disabled` | `{}` | Away Mode deactivated |
| `away-mode-preflight-failed` | `{ errors: string[] }` | Preflight checks failed |
| `away-mode-user-returned` | `{ strings: object }` | User activity detected |
| `away-mode-check-camera` | `{}` | Request camera availability check |

### Renderer → Main:
| Event | Data | Description |
|-------|------|-------------|
| `away-mode-disable-confirmed` | `{}` | User confirmed disable |
| `away-mode-keep-confirmed` | `{}` | User wants to keep Away Mode |
| `away-mode-camera-check-result` | `boolean` | Camera check result |

---

## 🔒 Security Notes / הערות אבטחה

- Away Mode does **NOT** automatically start the camera
- Camera activation is a separate action via Live View
- User must explicitly confirm to disable Away Mode when returning

---

## 📝 Changelog

### v1.0.0 (2026-01-25)
- Initial modular extraction from main.js
- Clean separation from WebRTC logic
