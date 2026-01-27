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

// MANUAL MODE (from Dashboard command):
case 'SET_DEVICE_MODE:AWAY':
  await awayManager.enable();  // Turns off display + keeps it off
  break;

case 'SET_DEVICE_MODE:NORMAL':
  await awayManager.disable();
  break;

// AUTO-AWAY MODE (on startup, in login-user handler):
if (profile.auto_away_enabled) {
  await awayManager.enable({ skipDisplayOff: true });  // NO display off
}
```

### In preload.js:
```javascript
const { awayModeAPI } = require('./away/away-ipc');
// Merge with existing electronAPI or expose separately
```

---

## ⚡ Two Modes of Operation / שני מצבי הפעלה

### 1. Manual Mode (מצב ידני)
- Triggered by: `SET_DEVICE_MODE:AWAY` command from Dashboard
- Display: **Turns off immediately** + 30-second keep-off loop
- Use case: User explicitly enables Away Mode when leaving home

### 2. Auto-Away Mode (מצב אוטומטי) ✨ NEW
- Triggered by: Electron startup when `profiles.auto_away_enabled = true`
- Display: **Follows OS power settings** (NOT forced off)
- Use case: Always-ready monitoring without surprising the user

```
┌─────────────────────────────────────────────────────────────┐
│  Mode        │  Away Active  │  Display Off  │  30s Loop   │
├─────────────────────────────────────────────────────────────┤
│  Manual      │      ✅       │      ✅       │     ✅      │
│  Auto-Away   │      ✅       │      ❌       │     ❌      │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Features / תכונות

1. **Power Save Blocker** - Prevents system sleep using `prevent-app-suspension`
2. **Display Control** (Manual mode only) - Turns off display using platform-specific commands:
   - macOS: `pmset displaysleepnow`
   - Windows: PowerShell + user32.dll (nircmd.exe as fallback)
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
- Auto-Away does NOT turn off display - prevents user surprise

---

## 📝 Changelog

### v1.1.0 (2026-01-27)
- Added Auto-Away mode with `skipDisplayOff` option
- Auto-Away enabled via `profiles.auto_away_enabled` (default: true)
- Clear separation between Manual and Auto modes
- Manual mode behavior unchanged

### v1.0.0 (2026-01-25)
- Initial modular extraction from main.js
- Clean separation from WebRTC logic
