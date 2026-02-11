

# Fix Sound Detection Pipeline - Diagnostic & Repair Plan

## Problem Summary
Sound monitoring starts successfully (YAMNet loads, microphone captured, ACK sent), but `onaudioprocess` never fires after initialization. No DIAG, CANARY, or RMS logs appear after the ACK. The audio pipeline is "dead on arrival."

## Root Cause Hypothesis
The `ScriptProcessorNode.onaudioprocess` callback is not being invoked by Chromium, despite the node graph being correctly wired (`source -> processor -> destination`). This may be related to:
- Post-crash WebContents reload corrupting the audio graph
- Chrome autoplay policy silently blocking audio processing
- ScriptProcessor node being garbage collected or disconnected

## Implementation Steps (Sound-Only, Zero Motion Changes)

All changes are in `electron-webrtc-example/index.html` only (sound subsystem). No changes to motion detection, camera, MediaPipe, or event motion code.

### Step 1: Prove `onaudioprocess` runs
- The existing `audioProcessCount++` counter (line 964) and DIAG interval (lines 986-994) are already in the code but not firing
- Add a **fallback `setInterval` heartbeat** outside the `startSoundDetection` function scope, directly after sound setup completes, to verify the timer itself runs
- Add explicit `console.log` inside `onaudioprocess` for the first 3 calls to confirm entry
- Format: `[Sound][DBG] audioProcessCount=123 dtSinceLast=15ms ctx=running buffer=8200`

### Step 2: Prove buffer reaches 15600 and inference starts  
- Add a one-time log when `soundAudioBuffer.length` first crosses `SOUND_SAMPLES_NEEDED` (15600)
- Log every 5th inference: `[Sound][DBG] inferenceCount=..., rms=..., maxScore=...`
- These logs already partially exist (lines 1038, 1088) but will be verified/enhanced

### Step 3: Make RMS gate transparent and temporarily lower threshold
- Log every RMS skip (throttled to 1/second) — already exists at line 1018-1021
- Temporarily lower `SOUND_RMS_THRESHOLD` from `0.003` to `0.001` to eliminate false silence filtering
- Format: `[Sound][DBG] RMS below threshold: rms=0.00x thr=0.00y - skipping inference`

### Step 4: Print Top-3 from model on every inference
- Already implemented at lines 1078-1093
- Will verify the target index validation log format matches the requested format
- Add explicit log: `[Sound][DBG] target(help) indices 19/20/21 best=X threshold=0.15 pass=YES/NO`

### Step 5: Verify DETECTED mechanism can trigger
- Add persistence-rising log: `[Sound][DBG] help persistence now = X (score=Y)` — partially exists at line 1148
- Add clear DETECTED log — already exists at lines 1168-1170
- Verify thresholds: help mode = threshold 0.15, persistence 2, debounce 15000ms

### Step 6: Verify event actually sends to server
- Pre-fetch log already exists at line 791
- Post-response log already exists at lines 816-826
- Will verify these are complete and match the requested format

### Step 7: Fix STOP IPC error (non-critical)
- In `monitoring-manager.js` `disable()` method (line 444): add guard before `send('stop-monitoring')`
- Check: `!this.mainWindow.webContents.isDestroyed()` before sending IPC
- Prevents "Render frame was disposed before WebFrameMain could be accessed" error

## Technical Details

### File: `electron-webrtc-example/index.html`
**Changes (sound subsystem only):**

1. **Version bump**: `2.16.1` to `2.17.0`
2. **Inside `onaudioprocess` handler (line 962-967)**: Add first-3-calls debug log to prove entry
3. **After `startSoundDetection` returns (line 996)**: Add a redundant verification `setTimeout` at 1s and 2s that logs whether `audioProcessCount` has increased, independent of the DIAG interval
4. **`processSoundChunk` (line 1007-1030)**: Add one-time log when buffer first reaches `SOUND_SAMPLES_NEEDED`
5. **`SOUND_RMS_THRESHOLD`**: Lower from `0.003` to `0.001`
6. **`processSoundScores` (line 1111)**: Add persistence-rising log with score value
7. **CANARY block (line 1584-1609)**: Add a third canary at 10s with full pipeline state dump

### File: `electron-webrtc-example/monitoring/monitoring-manager.js`
**Changes:**

1. **`disable()` method (line 444)**: Add `webContents.isDestroyed()` guard before `send('stop-monitoring')`
2. **Version bump**: `0.4.0` to `0.4.1`

## Verification Checklist
After implementation, enable "help" mode and shout for 20 seconds. You must see:
- `audioProcessCount` increasing in DIAG logs
- `inferenceCount` increasing
- Top-3 indices changing
- Target best score printed
- If score exceeds 0.15 with persistence 2: SOUND DETECTED log + event sent to server

