/**
 * Electron Renderer WebRTC Implementation
 * ========================================
 * 
 * This file should be loaded in your Electron renderer process (e.g., index.html or a hidden window).
 * It listens for IPC messages from main.js to start/stop live view sessions.
 * 
 * Prerequisites:
 * 1. preload.js must expose: onStartLiveView, onStopLiveView
 * 2. main.js must send IPC: 'start-live-view' with { sessionId }, 'stop-live-view'
 * 3. Supabase client must be available (or use fetch directly)
 */

// Configuration - REPLACE with your actual values
const SUPABASE_URL = 'https://zoripeohnedivxkvrpbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmlwZW9obmVkaXZ4a3ZycGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODMyMDIsImV4cCI6MjA4NDA1OTIwMn0.I24w1VjEWUNf2jCBnPo4-ypu3aq5rATJldbLgSSt9mo';

// State
let peerConnection = null;
let localStream = null;
let currentSessionId = null;
let pollingInterval = null;
let processedSignalIds = new Set();
// When mobile ICE candidates arrive before we set the remote description (answer),
// addIceCandidate will fail with: "The remote description was null".
// Queue them and apply right after setRemoteDescription.
let pendingIceCandidates = [];
let isCleaningUp = false; // Prevent START during cleanup
let lastStopTime = null;   // Track when we stopped to prevent immediate restart
let isStartingSession = false; // CRITICAL: Prevent duplicate START calls

// Default ICE servers (STUN only - fallback)
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Camera timeout configuration
const CAMERA_TIMEOUT_MS = 30000; // 30 seconds
const CAMERA_MAX_RETRIES = 3;

// ============================================================
// CAMERA HELPERS WITH TIMEOUT & RETRY
// ============================================================

/**
 * Get camera access with timeout and retry logic
 */
async function getCameraWithRetry(maxRetries = CAMERA_MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Desktop] 📷 Camera access attempt ${attempt}/${maxRetries}...`);
    
    try {
      const stream = await getCameraWithTimeout(CAMERA_TIMEOUT_MS);
      console.log(`[Desktop] ✅ Camera access granted on attempt ${attempt}`);
      return stream;
    } catch (error) {
      console.error(`[Desktop] ❌ Camera attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const waitTime = 1000 * attempt;
        console.log(`[Desktop] Waiting ${waitTime}ms before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Get camera access with a specific timeout
 */
async function getCameraWithTimeout(timeoutMs) {
  return new Promise(async (resolve, reject) => {
    let timeoutId = null;
    let resolved = false;
    
    // Set timeout
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Camera access timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    
    try {
      // Try with ideal constraints first (video + audio for live view)
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: true  // Enable microphone for audio streaming
      };
      
      console.log('[Desktop] Requesting camera with constraints:', JSON.stringify(constraints));
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve(stream);
      } else {
        // If we already timed out, stop the tracks
        stream.getTracks().forEach(t => t.stop());
      }
    } catch (constraintError) {
      console.warn('[Desktop] Failed with ideal constraints, trying minimal...', constraintError.message);
      
      // Fallback to minimal constraints (still request audio)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve(stream);
        } else {
          stream.getTracks().forEach(t => t.stop());
        }
      } catch (audioMinimalError) {
        console.warn('[Desktop] ⚠️ Failed with audio+video minimal, trying VIDEO-ONLY...', audioMinimalError.message);
        
        // FINAL FALLBACK: Video only (no audio) if getUserMedia fails with audio
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutId);
            console.log('[Desktop] ⚠️ Stream acquired without audio (video-only fallback)');
            resolve(stream);
          } else {
            stream.getTracks().forEach(t => t.stop());
          }
        } catch (videoOnlyError) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
            reject(videoOnlyError);
        }
        }
      }
    }
  });
}

// ============================================================
// SUPABASE HELPERS
// ============================================================

async function supabaseInsert(table, data, { prefer = 'return=minimal' } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: prefer,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Insert failed: ${error}`);
  }

  // return=minimal => empty body
  if (prefer === 'return=minimal') return null;
  return response.json();
}

async function insertRtcSignalWithRetry(signal, { label, retries = 3 } = {}) {
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await supabaseInsert('rtc_signals', signal, { prefer: 'return=minimal' });
      return true;
    } catch (e) {
      lastErr = e;
      console.error(`[Desktop] ❌ Failed to insert rtc_signal (${label || signal.type}) attempt ${attempt}/${retries}:`, e);
      // Small backoff
      await new Promise((r) => setTimeout(r, 150 * attempt));
    }
  }
  console.error(`[Desktop] ❌ Giving up inserting rtc_signal (${label || signal.type}). Last error:`, lastErr);
  return false;
}

async function supabaseUpdate(table, id, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Update failed: ${error}`);
  }
}

async function supabaseSelect(table, filters) {
  const queryParams = Object.entries(filters)
    .map(([key, value]) => `${key}=eq.${value}`)
    .join('&');
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${queryParams}&order=id.desc`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Select failed: ${error}`);
  }
  
  return response.json();
}

// Fetch TURN credentials from edge function
async function fetchTurnCredentials() {
  try {
    console.log('[WebRTC] Fetching TURN credentials...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/get-turn-credentials`);
    
    if (!response.ok) {
      console.warn('[WebRTC] TURN fetch failed, using STUN only');
      return DEFAULT_ICE_SERVERS;
    }
    
    const data = await response.json();
    if (data.iceServers && Array.isArray(data.iceServers)) {
      console.log('[WebRTC] Got TURN servers:', data.iceServers.length);
      return data.iceServers;
    }
    
    return DEFAULT_ICE_SERVERS;
  } catch (error) {
    console.error('[WebRTC] Error fetching TURN:', error);
    return DEFAULT_ICE_SERVERS;
  }
}

// ============================================================
// WEBRTC CORE
// ============================================================

async function startLiveView(sessionId) {
  // CRITICAL FIX: Prevent duplicate starts for the SAME session
  if (isStartingSession) {
    console.log('[Desktop] ⚠️ Already starting a session, ignoring duplicate call');
    return;
  }
  
  // CRITICAL FIX: If already streaming THIS session, skip
  if (currentSessionId === sessionId && peerConnection) {
    console.log('[Desktop] ⚠️ Already streaming this session:', sessionId);
    return;
  }
  
  // CRITICAL FIX: Wait for cleanup to finish before starting new session (with retry)
  if (isCleaningUp) {
    console.log('[Desktop] ⚠️ Still cleaning up previous session, waiting...');
    // Wait up to 3 seconds total (6 attempts x 500ms)
    let retries = 6;
    while (isCleaningUp && retries > 0) {
      await new Promise(r => setTimeout(r, 500));
      retries--;
      if (isCleaningUp) {
        console.log(`[Desktop] ⏳ Cleanup still in progress, retries left: ${retries}`);
      }
    }
    if (isCleaningUp) {
      console.error('[Desktop] ❌ Cannot start: cleanup still in progress after 3s, forcing reset');
      // Force reset the cleanup flag as a last resort
      isCleaningUp = false;
    }
  }
  
  // CRITICAL FIX: Ensure minimum 1 second gap between STOP and START
  if (lastStopTime) {
    const timeSinceStop = Date.now() - lastStopTime;
    if (timeSinceStop < 1500) {
      const waitTime = 1500 - timeSinceStop;
      console.log(`[Desktop] ⏳ Waiting ${waitTime}ms for camera to release...`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
  
  // Set flag to prevent duplicate starts
  isStartingSession = true;
  
  // CRITICAL FIX: Force cleanup of any lingering stream
  if (localStream) {
    console.log('[Desktop] ⚠️ Found lingering stream, cleaning up before restart...');
    localStream.getTracks().forEach(track => {
      track.stop();
      console.log('[Desktop] Emergency cleanup - stopped:', track.kind);
    });
    localStream = null;
    // Wait for hardware to release
    await new Promise(r => setTimeout(r, 800));
  }
  
  console.log('═══════════════════════════════════════════════════');
  console.log('[Desktop] START LIVE VIEW - Session:', sessionId);
  console.log('═══════════════════════════════════════════════════');
  
  currentSessionId = sessionId;
  processedSignalIds.clear();
  pendingIceCandidates = [];
  
  try {
    // 0. List available devices for better diagnostics
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoCameras = devices.filter(d => d.kind === 'videoinput');
      const audioMics = devices.filter(d => d.kind === 'audioinput');
      console.log('[Desktop] 📷 Available video devices:', videoCameras.length);
      console.log('[Desktop] 🎤 Available audio devices:', audioMics.length);
      videoCameras.forEach((cam, i) => {
        console.log(`  [Desktop] Camera ${i + 1}: ${cam.label || 'Unknown'} (${cam.deviceId.substring(0, 12)}...)`);
      });
    } catch (enumErr) {
      console.log('[Desktop] Could not enumerate devices:', enumErr.message);
    }
    
    // 1. Get camera access (with timeout and retry)
    console.log('[Desktop] Step 1/5: Getting camera access (30s timeout, 3 retries)...');
    localStream = await getCameraWithRetry(CAMERA_MAX_RETRIES);
    console.log('[Desktop] ✅ Camera access granted, tracks:', localStream.getTracks().map(t => t.kind).join(', '));
    
    // 2. Get ICE servers
    console.log('[Desktop] Step 2/5: Fetching ICE servers...');
    const iceServers = await fetchTurnCredentials();
    
    // 3. Create peer connection
    console.log('[Desktop] Step 3/5: Creating RTCPeerConnection...');
    peerConnection = new RTCPeerConnection({ iceServers });
    
    // Add tracks to peer connection
    localStream.getTracks().forEach(track => {
      console.log('[Desktop] Adding track:', track.kind);
      peerConnection.addTrack(track, localStream);
    });
    
    // 4. Handle ICE candidates
    peerConnection.onicecandidate = async (event) => {
      if (!event.candidate) {
        console.log('[Desktop] ICE gathering complete');
        return;
      }

      // Electron/Chromium candidates are sometimes not serializable via toJSON in some builds.
      const c = event.candidate;
      const payload =
        typeof c.toJSON === 'function'
          ? c.toJSON()
          : {
              candidate: c.candidate,
              sdpMid: c.sdpMid,
              sdpMLineIndex: c.sdpMLineIndex,
              usernameFragment: c.usernameFragment,
            };

      console.log('[Desktop] ICE candidate generated, sending to DB...', {
        sdpMid: payload?.sdpMid,
        sdpMLineIndex: payload?.sdpMLineIndex,
        candidatePrefix: typeof payload?.candidate === 'string' ? payload.candidate.slice(0, 32) : undefined,
      });

      await insertRtcSignalWithRetry(
        {
          session_id: sessionId,
          from_role: 'desktop',
          type: 'ice',
          payload,
        },
        { label: 'ice' }
      );
    };

    peerConnection.onicecandidateerror = (event) => {
      // Log more details about ICE errors
      console.warn('[Desktop] ⚠️ ICE candidate error:', {
        errorCode: event.errorCode,
        errorText: event.errorText,
        url: event.url,
        address: event.address,
        port: event.port,
      });
    };
    
    // Connection state changes
    peerConnection.onconnectionstatechange = async () => {
      console.log('═══════════════════════════════════════════════════');
      console.log('[Desktop] 🔄 Connection state:', peerConnection.connectionState);
      console.log('═══════════════════════════════════════════════════');
      
      if (peerConnection.connectionState === 'connected') {
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log('✅ [Desktop] PEER CONNECTION ESTABLISHED');
        console.log('✅ ═══════════════════════════════════════════════════');
      } else if (peerConnection.connectionState === 'failed') {
        console.error('❌ [Desktop] CONNECTION FAILED - ICE negotiation did not succeed');
        console.error('[Desktop] This usually means TURN/STUN servers could not establish a connection');
        await stopLiveView();
      } else if (peerConnection.connectionState === 'disconnected') {
        console.warn('[Desktop] ⚠️ Connection disconnected, waiting for reconnect...');
        // Give some time for reconnection before stopping
        setTimeout(async () => {
          if (peerConnection?.connectionState === 'disconnected') {
            console.log('[Desktop] Still disconnected, stopping...');
            await stopLiveView();
          }
        }, 5000);
      }
    };
    
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[Desktop] 🧊 ICE connection state:', peerConnection.iceConnectionState);
      
      if (peerConnection.iceConnectionState === 'checking') {
        console.log('[Desktop] 🔍 ICE checking connectivity...');
      } else if (peerConnection.iceConnectionState === 'connected') {
        console.log('[Desktop] ✅ ICE connected!');
      } else if (peerConnection.iceConnectionState === 'completed') {
        console.log('[Desktop] ✅ ICE completed - Best candidate pair found');
      } else if (peerConnection.iceConnectionState === 'failed') {
        console.error('[Desktop] ❌ ICE FAILED - No working candidate pairs');
        console.error('[Desktop] Possible causes: Firewall blocking, NAT issues, or TURN server problems');
      }
    };
    
    // Log signaling state changes
    peerConnection.onsignalingstatechange = () => {
      console.log('[Desktop] 📡 Signaling state:', peerConnection.signalingState);
    };
    
    // 5. Create and send offer
    console.log('[Desktop] Step 4/5: Creating offer...');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('[Desktop] ✅ Local description set');
    
    console.log('[Desktop] Step 5/5: Sending offer to DB...');
    await insertRtcSignalWithRetry(
      {
        session_id: sessionId,
        from_role: 'desktop',
        type: 'offer',
        payload: { sdp: offer.sdp, type: offer.type },
      },
      { label: 'offer' }
    );
    console.log('✅ [Desktop] OFFER SENT - Waiting for answer...');

    // IMPORTANT: Promote the session to 'active' only AFTER the offer is sent.
    // This prevents race conditions where the mobile viewer checks status before the offer exists.
    try {
      await supabaseUpdate('rtc_sessions', sessionId, { status: 'active' });
      console.log('[Desktop] Session status updated to active (after offer sent)');
    } catch (error) {
      console.error('[Desktop] Failed to update session status to active:', error);
    }

    // Notify Electron main process (if implemented) that the offer is sent
    try {
      if (window?.electronAPI?.notifyOfferSent) {
        window.electronAPI.notifyOfferSent(sessionId);
        console.log('[Desktop] ✅ notifyOfferSent dispatched to main process');
      }
    } catch (e) {
      console.warn('[Desktop] notifyOfferSent failed:', e);
    }
    
    // Start polling for answer and ICE candidates
    startPollingForSignals(sessionId);
    
    // CRITICAL: Reset the starting flag - session is now active
    isStartingSession = false;
    console.log('[Desktop] ✅ Session startup complete, now polling for signals');
    
  } catch (error) {
    console.error('❌ [Desktop] startLiveView FAILED:', error);
    isStartingSession = false; // Reset flag on error too
    await stopLiveView();
  }
}

function startPollingForSignals(sessionId) {
  console.log('[Desktop] Starting signal polling for session:', sessionId);
  
  // Poll every 500ms for new signals
  pollingInterval = setInterval(async () => {
    try {
      const signals = await supabaseSelect('rtc_signals', { session_id: sessionId });
      
      for (const signal of signals) {
        // Skip already processed or our own signals
        if (processedSignalIds.has(signal.id) || signal.from_role === 'desktop') {
          continue;
        }
        
        processedSignalIds.add(signal.id);
        await processSignal(signal);
      }
    } catch (error) {
      console.error('[Desktop] Polling error:', error);
    }
  }, 500);
}

async function processSignal(signal) {
  console.log('[Desktop] Processing signal:', signal.type, 'id:', signal.id);
  
  if (!peerConnection) {
    console.warn('[Desktop] No peer connection, ignoring signal');
    return;
  }
  
  if (signal.type === 'answer') {
    console.log('[Desktop] 📥 Received ANSWER from mobile');
    try {
      const answerDesc = {
        type: 'answer',
        sdp: signal.payload.sdp || signal.payload.SDP,
      };
      await peerConnection.setRemoteDescription(answerDesc);
      console.log('✅ [Desktop] Remote description set - Handshake complete!');

      // Apply any ICE candidates that arrived early
      if (pendingIceCandidates.length > 0) {
        console.log(`[Desktop] 🧊 Applying ${pendingIceCandidates.length} queued ICE candidates...`);
        const queued = pendingIceCandidates;
        pendingIceCandidates = [];

        for (const payload of queued) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(payload));
            console.log('✅ [Desktop] Queued ICE candidate added');
          } catch (e) {
            console.warn('⚠️ [Desktop] Failed to add queued ICE candidate:', e);
          }
        }
      }
    } catch (error) {
      console.error('❌ [Desktop] Failed to set remote description:', error);
    }
  } else if (signal.type === 'ice') {
    console.log('[Desktop] 🧊 Received ICE candidate from mobile');
    try {
      // If answer not set yet, queue candidates (they can arrive before answer)
      if (!peerConnection.remoteDescription) {
        pendingIceCandidates.push(signal.payload);
        console.log('[Desktop] ⏳ Remote description not set yet - queued ICE candidate');
        return;
      }

      const candidate = new RTCIceCandidate(signal.payload);
      await peerConnection.addIceCandidate(candidate);
      console.log('✅ [Desktop] ICE candidate added');
    } catch (error) {
      console.error('❌ [Desktop] Failed to add ICE candidate:', error);
    }
  }
}

async function stopLiveView() {
  // Mark as cleaning up to prevent immediate restart
  isCleaningUp = true;
  isStartingSession = false; // CRITICAL: Also reset starting flag
  lastStopTime = Date.now();
  pendingIceCandidates = [];
  
  console.log('═══════════════════════════════════════════════════');
  console.log('[Desktop] STOP LIVE VIEW');
  console.log('═══════════════════════════════════════════════════');
  
  // Stop polling
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  // Stop all tracks
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
      console.log('[Desktop] Track stopped:', track.kind);
    });
    
    // CRITICAL FIX: Wait for tracks to fully release hardware
    // This prevents "device in use" errors on immediate restart
    await new Promise(r => setTimeout(r, 300));
    
    localStream = null;
  }
  
  // Close peer connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    console.log('[Desktop] Peer connection closed');
  }
  
  // Update session status
  if (currentSessionId) {
    try {
      await supabaseUpdate('rtc_sessions', currentSessionId, {
        status: 'ended',
        ended_at: new Date().toISOString(),
      });
      console.log('[Desktop] Session marked as ended');
    } catch (error) {
      console.error('[Desktop] Failed to update session:', error);
    }
  }
  
  currentSessionId = null;
  processedSignalIds.clear();
  
  // CRITICAL FIX: Add extra delay to ensure complete hardware release
  await new Promise(r => setTimeout(r, 200));
  
  isCleaningUp = false;
  console.log('[Desktop] ✅ Cleanup complete');
}

// ============================================================
// IPC LISTENERS (called from preload.js)
// ============================================================

// Check if we're in Electron environment with IPC exposed
if (typeof window !== 'undefined' && window.electronAPI) {
  // Listen for start-live-view from main process
  window.electronAPI.onStartLiveView((sessionId) => {
    console.log('[Desktop] Received start-live-view IPC with sessionId:', sessionId);
    startLiveView(sessionId);
  });
  
  // Listen for stop-live-view from main process
  window.electronAPI.onStopLiveView(() => {
    console.log('[Desktop] Received stop-live-view IPC');
    stopLiveView();
  });
  
  console.log('[Desktop] ✅ WebRTC renderer initialized, waiting for IPC...');
} else {
  // For testing outside Electron
  console.log('[Desktop] Not in Electron environment, exposing global functions');
  window.startLiveView = startLiveView;
  window.stopLiveView = stopLiveView;
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { startLiveView, stopLiveView };
}
