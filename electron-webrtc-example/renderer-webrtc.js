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

// Default ICE servers (STUN only - fallback)
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ============================================================
// SUPABASE HELPERS
// ============================================================

async function supabaseInsert(table, data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Insert failed: ${error}`);
  }
  
  return response.json();
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
  console.log('═══════════════════════════════════════════════════');
  console.log('[Desktop] START LIVE VIEW - Session:', sessionId);
  console.log('═══════════════════════════════════════════════════');
  
  currentSessionId = sessionId;
  processedSignalIds.clear();
  
  try {
    // 1. Get camera access
    console.log('[Desktop] Step 1/5: Getting camera access...');
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: false 
    });
    console.log('[Desktop] ✅ Camera access granted');
    
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
      if (event.candidate) {
        console.log('[Desktop] ICE candidate generated, sending to DB...');
        try {
          await supabaseInsert('rtc_signals', {
            session_id: sessionId,
            from_role: 'desktop',
            type: 'ice',
            payload: event.candidate.toJSON(),
          });
          console.log('[Desktop] ✅ ICE candidate sent');
        } catch (error) {
          console.error('[Desktop] ❌ Failed to send ICE:', error);
        }
      } else {
        console.log('[Desktop] ICE gathering complete');
      }
    };
    
    // Connection state changes
    peerConnection.onconnectionstatechange = async () => {
      console.log('[Desktop] Connection state:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        console.log('✅ ═══════════════════════════════════════════════════');
        console.log('✅ [Desktop] PEER CONNECTION ESTABLISHED');
        console.log('✅ ═══════════════════════════════════════════════════');
        
        // Update session status to 'active'
        try {
          await supabaseUpdate('rtc_sessions', sessionId, { status: 'active' });
          console.log('[Desktop] Session status updated to active');
        } catch (error) {
          console.error('[Desktop] Failed to update session status:', error);
        }
      } else if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        console.log('[Desktop] Connection failed/disconnected, stopping...');
        await stopLiveView();
      }
    };
    
    peerConnection.oniceconnectionstatechange = () => {
      console.log('[Desktop] ICE connection state:', peerConnection.iceConnectionState);
    };
    
    // 5. Create and send offer
    console.log('[Desktop] Step 4/5: Creating offer...');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    console.log('[Desktop] ✅ Local description set');
    
    console.log('[Desktop] Step 5/5: Sending offer to DB...');
    await supabaseInsert('rtc_signals', {
      session_id: sessionId,
      from_role: 'desktop',
      type: 'offer',
      payload: { sdp: offer.sdp, type: offer.type },
    });
    console.log('✅ [Desktop] OFFER SENT - Waiting for answer...');
    
    // Start polling for answer and ICE candidates
    startPollingForSignals(sessionId);
    
  } catch (error) {
    console.error('❌ [Desktop] startLiveView FAILED:', error);
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
    } catch (error) {
      console.error('❌ [Desktop] Failed to set remote description:', error);
    }
  } else if (signal.type === 'ice') {
    console.log('[Desktop] 🧊 Received ICE candidate from mobile');
    try {
      const candidate = new RTCIceCandidate(signal.payload);
      await peerConnection.addIceCandidate(candidate);
      console.log('✅ [Desktop] ICE candidate added');
    } catch (error) {
      console.error('❌ [Desktop] Failed to add ICE candidate:', error);
    }
  }
}

async function stopLiveView() {
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
