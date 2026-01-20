import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export type RtcSessionStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'failed';

export interface RtcSignalCounts {
  offersReceived: number;
  answersSent: number;
  iceReceived: number;
  iceSent: number;
}

export interface RtcDebugInfo {
  sessionId: string | null;
  status: RtcSessionStatus;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  lastSignalType: 'offer' | 'answer' | 'ice' | null;
  lastError: string | null;
  signalsProcessed: number;
  signalCounts: RtcSignalCounts;
}

interface RtcSignal {
  id: number;
  session_id: string;
  from_role: 'desktop' | 'mobile';
  type: 'offer' | 'answer' | 'ice';
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  created_at: string;
}

interface UseRtcSessionOptions {
  deviceId: string;
  viewerId: string;
  onStreamReceived: (stream: MediaStream) => void;
  onError: (error: string) => void;
  onStatusChange: (status: RtcSessionStatus) => void;
  timeoutMs?: number;
  existingSessionId?: string | null; // Session ID from Dashboard (if available)
}

// Default fallback ICE servers (STUN only)
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Fetch TURN credentials from edge function
async function fetchTurnCredentials(): Promise<RTCIceServer[]> {
  try {
    console.log('[useRtcSession] Fetching TURN credentials...');
    const response = await fetch(
      'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/get-turn-credentials',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn('[useRtcSession] Failed to fetch TURN credentials, using STUN fallback');
      return DEFAULT_ICE_SERVERS;
    }

    const data = await response.json();
    
    if (data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      console.log('[useRtcSession] Using Metered.ca TURN servers:', data.iceServers.length, 'servers');
      return data.iceServers;
    }
    
    return DEFAULT_ICE_SERVERS;
  } catch (error) {
    console.warn('[useRtcSession] Error fetching TURN credentials:', error);
    return DEFAULT_ICE_SERVERS;
  }
}

export function useRtcSession({
  deviceId,
  viewerId,
  onStreamReceived,
  onError,
  onStatusChange,
  timeoutMs = 60000,
  existingSessionId = null,
}: UseRtcSessionOptions) {
  const { language } = useLanguage();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<RtcSessionStatus>('idle');
  
  // Debug state
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [iceConnectionState, setIceConnectionState] = useState<RTCIceConnectionState | null>(null);
  const [lastSignalType, setLastSignalType] = useState<'offer' | 'answer' | 'ice' | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [signalsProcessed, setSignalsProcessed] = useState(0);
  
  // Detailed signal counts
  const [signalCounts, setSignalCounts] = useState<RtcSignalCounts>({
    offersReceived: 0,
    answersSent: 0,
    iceReceived: 0,
    iceSent: 0,
  });
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedSignalsRef = useRef<Set<number>>(new Set());
  const isMountedRef = useRef(true);
  const isProcessingOfferRef = useRef(false); // Prevent duplicate offer processing

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updateStatus = useCallback((newStatus: RtcSessionStatus) => {
    if (isMountedRef.current) {
      setStatus(newStatus);
      onStatusChange(newStatus);
    }
  }, [onStatusChange]);

  // Cleanup function - performs complete teardown of RTC session
  const cleanup = useCallback(async (finalStatus?: 'ended' | 'failed', failReason?: string) => {
    console.log('[useRtcSession] Cleaning up, finalStatus:', finalStatus, 'reason:', failReason);
    
    // 1. Clear timeout first to prevent race conditions
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 2. Close peer connection and all tracks
    if (peerConnectionRef.current) {
      // Stop all senders/receivers
      peerConnectionRef.current.getSenders().forEach(sender => {
        if (sender.track) sender.track.stop();
      });
      peerConnectionRef.current.getReceivers().forEach(receiver => {
        if (receiver.track) receiver.track.stop();
      });
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // 3. Unsubscribe from realtime
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // 4. Update session status in DB if we have a session
    if (sessionId && finalStatus) {
      try {
        const updateData: Record<string, unknown> = {
          status: finalStatus,
          ended_at: new Date().toISOString(),
        };
        if (failReason) {
          updateData.fail_reason = failReason;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('rtc_sessions')
          .update(updateData)
          .eq('id', sessionId);
        console.log('[useRtcSession] Session status updated to:', finalStatus);
      } catch (err) {
        console.error('[useRtcSession] Error updating session status:', err);
      }
    }

    // 5. Clear processed signals set
    processedSignalsRef.current.clear();
    isProcessingOfferRef.current = false;
    
    // 6. Update local status
    if (finalStatus && isMountedRef.current) {
      updateStatus(finalStatus === 'ended' ? 'idle' : 'failed');
    }
  }, [sessionId, updateStatus]);

  // Insert a signal to the database with verification
  const insertSignal = useCallback(async (
    targetSessionId: string,
    type: 'offer' | 'answer' | 'ice',
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ): Promise<boolean> => {
    console.log(`[useRtcSession] Inserting signal: ${type} for session: ${targetSessionId}`);
    
    const insertData = {
      session_id: targetSessionId,
      from_role: 'mobile',
      type,
      payload,
    };
    
    console.log('[useRtcSession] Signal insert payload:', JSON.stringify(insertData, null, 2));
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('rtc_signals')
      .insert(insertData)
      .select('id');
    
    console.log('[useRtcSession] Signal insert result:', { data, error });
    
    if (error) {
      console.error('[useRtcSession] ❌ Error inserting signal:', error);
      setLastError(`Failed to insert ${type}: ${error.message}`);
      return false;
    }
    
    console.log(`[useRtcSession] ✅ Signal ${type} inserted successfully, id:`, data?.[0]?.id);
    return true;
  }, []);

  // Process a single signal - ROBUST offer handling
  const processSignal = useCallback(async (signal: RtcSignal, targetSessionId: string, pc: RTCPeerConnection) => {
    // Skip if already processed or from mobile (our own)
    if (processedSignalsRef.current.has(signal.id)) {
      console.log(`[useRtcSession] Skipping signal ${signal.id}: already processed`);
      return;
    }
    
    if (signal.from_role === 'mobile') {
      console.log(`[useRtcSession] Skipping signal ${signal.id}: from mobile (our own)`);
      return;
    }
    
    processedSignalsRef.current.add(signal.id);
    
    // Update debug info
    setLastSignalType(signal.type);
    setSignalsProcessed(prev => prev + 1);

    console.log(`[useRtcSession] 📥 Processing signal: type=${signal.type}, from_role=${signal.from_role}, id=${signal.id}`);
    console.log(`[useRtcSession] Signal payload:`, JSON.stringify(signal.payload, null, 2));

    try {
      if (signal.type === 'offer') {
        console.log('[LiveView] offer received');
        
        // Prevent duplicate offer processing
        if (isProcessingOfferRef.current) {
          console.log('[useRtcSession] Already processing an offer, skipping duplicate');
          return;
        }
        isProcessingOfferRef.current = true;
        
        // Track offers received
        setSignalCounts(prev => ({ ...prev, offersReceived: prev.offersReceived + 1 }));
        
        // CRITICAL: Normalize payload - desktop may send { sdp } without { type }
        const offerPayload = signal.payload as Record<string, unknown>;
        console.log('[useRtcSession] Raw offer payload keys:', Object.keys(offerPayload));
        console.log('[useRtcSession] Raw offer payload.type:', offerPayload.type);
        console.log('[useRtcSession] Raw offer payload.sdp exists:', !!offerPayload.sdp);
        
        // Explicitly construct RTCSessionDescriptionInit with type='offer'
        const offerDesc: RTCSessionDescriptionInit = {
          type: 'offer',
          sdp: offerPayload.sdp as string
        };
        
        if (!offerDesc.sdp) {
          throw new Error('Invalid offer payload: missing sdp');
        }
        
        console.log('[useRtcSession] 📝 Normalized offer descriptor:', { type: offerDesc.type, sdpLength: offerDesc.sdp?.length });
        console.log('[useRtcSession] Offer SDP (first 200 chars):', offerDesc.sdp?.substring(0, 200));
        
        // Set remote description from offer
        console.log('[useRtcSession] 📝 Setting remote description...');
        await pc.setRemoteDescription(offerDesc);
        console.log('[useRtcSession] ✅ Remote description set successfully');
        console.log('[useRtcSession] PC signaling state after setRemoteDescription:', pc.signalingState);
        
        // Create and set local answer
        console.log('[LiveView] creating answer');
        const answer = await pc.createAnswer();
        console.log('[useRtcSession] ✅ Answer created');
        console.log('[useRtcSession] Answer SDP (first 200 chars):', answer.sdp?.substring(0, 200));
        
        await pc.setLocalDescription(answer);
        console.log('[useRtcSession] ✅ Local description (answer) set');
        console.log('[useRtcSession] PC signaling state after setLocalDescription:', pc.signalingState);
        
        // Send answer back to database with verification
        console.log('[useRtcSession] 📤 Inserting answer to rtc_signals...');
        const { data, error } = await (supabase as any)
          .from('rtc_signals')
          .insert({
            session_id: targetSessionId,
            from_role: 'mobile',
            type: 'answer',
            payload: pc.localDescription
          })
          .select('id');
        
        console.log('[LiveView] answer insert result', { data, error });
        
        if (error) {
          console.error('[useRtcSession] ❌ FAILED TO INSERT ANSWER!', error);
          setLastError(`answer insert failed: ${error.message}`);
        } else {
          console.log('[useRtcSession] ✅✅ ANSWER SENT SUCCESSFULLY! id:', data?.[0]?.id);
          setSignalCounts(prev => ({ ...prev, answersSent: prev.answersSent + 1 }));
        }
        
      } else if (signal.type === 'ice') {
        // Track ICE candidates received
        setSignalCounts(prev => ({ ...prev, iceReceived: prev.iceReceived + 1 }));
        
        // Add ICE candidate with try/catch
        const candidate = signal.payload as RTCIceCandidateInit;
        console.log('[useRtcSession] 🧊 Adding ICE candidate:', candidate.candidate?.substring(0, 80));
        
        if (candidate.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('[useRtcSession] ✅ ICE candidate added successfully');
          } catch (iceErr) {
            console.error('[useRtcSession] ❌ Error adding ICE candidate:', iceErr);
            setLastError(`ICE error: ${iceErr instanceof Error ? iceErr.message : 'Unknown'}`);
          }
        } else {
          console.log('[useRtcSession] Empty ICE candidate (end-of-candidates)');
        }
      }
    } catch (err) {
      console.error(`[useRtcSession] ❌ Error processing ${signal.type}:`, err);
      const errorMsg = `Signal error: ${signal.type} - ${err instanceof Error ? err.message : 'Unknown'}`;
      setLastError(errorMsg);
      isProcessingOfferRef.current = false;
    }
  }, [insertSignal]);

  // Subscribe to signals for a session - returns promise that resolves when subscribed
  const subscribeToSignals = useCallback((targetSessionId: string, pc: RTCPeerConnection) => {
    console.log('[useRtcSession] 🔔 Subscribing to signals for session:', targetSessionId);
    
    const channel = supabase
      .channel(`rtc-signals-${targetSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rtc_signals',
          filter: `session_id=eq.${targetSessionId}`,
        },
        (payload) => {
          const signal = payload.new as RtcSignal;
          console.log('[useRtcSession] 🔔 Realtime signal received:', { id: signal.id, type: signal.type, from_role: signal.from_role });
          processSignal(signal, targetSessionId, pc);
        }
      )
      .subscribe((status, err) => {
        console.log('[useRtcSession] 🔔 Signal subscription status:', status, err ? `Error: ${err}` : '');
      });

    channelRef.current = channel;

    // Fetch any existing signals (in case they arrived before subscription)
    console.log('[useRtcSession] 📥 Fetching existing signals from database...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('rtc_signals')
      .select('*')
      .eq('session_id', targetSessionId)
      .eq('from_role', 'desktop')
      .order('created_at', { ascending: true })
      .then(({ data, error }: { data: RtcSignal[] | null; error: Error | null }) => {
        if (error) {
          console.error('[useRtcSession] ❌ Error fetching existing signals:', error);
          return;
        }
        console.log(`[useRtcSession] 📥 Found ${data?.length || 0} existing signals from desktop`);
        if (data && data.length > 0) {
          console.log('[useRtcSession] Processing existing signals:', data.map(s => ({ id: s.id, type: s.type })));
          data.forEach((signal) => processSignal(signal, targetSessionId, pc));
        }
      });
  }, [processSignal]);

  // Initialize WebRTC peer connection
  const initPeerConnection = useCallback(async (sessionId: string) => {
    console.log('[useRtcSession] Initializing peer connection');
    
    // Fetch TURN credentials from edge function
    const iceServers = await fetchTurnCredentials();
    
    const pc = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = pc;

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await insertSignal(sessionId, 'ice', event.candidate.toJSON());
          // Track ICE candidates sent
          setSignalCounts(prev => ({ ...prev, iceSent: prev.iceSent + 1 }));
        } catch (err) {
          console.error('[useRtcSession] Error sending ICE candidate:', err);
        }
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('[useRtcSession] ICE connection state:', pc.iceConnectionState);
      setIceConnectionState(pc.iceConnectionState);
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[useRtcSession] Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        // Clear timeout on successful connection
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        updateStatus('connected');
        
        // Update session status to active
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('rtc_sessions')
          .update({ status: 'active' })
          .eq('id', sessionId)
          .then(({ error }: { error: Error | null }) => {
            if (error) console.error('[useRtcSession] Error updating session to active:', error);
          });
          
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        const errorMsg = language === 'he' ? 'החיבור נותק' : 'Connection lost';
        setLastError(errorMsg);
        onError(errorMsg);
        cleanup('failed', 'connection_' + pc.connectionState);
      }
    };

    // Handle incoming tracks (video stream from desktop)
    pc.ontrack = (event) => {
      console.log('[useRtcSession] Track received:', event.streams.length, 'streams');
      if (event.streams && event.streams[0]) {
        onStreamReceived(event.streams[0]);
      }
    };

    // IMPORTANT: recvonly - mobile viewer does NOT send any media
    // This ensures no camera permission is requested on mobile devices
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    return pc;
  }, [insertSignal, language, onError, onStreamReceived, updateStatus, cleanup]);

  // Check for existing active/pending session within last 2 minutes
  const findExistingSession = useCallback(async (): Promise<string | null> => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('rtc_sessions')
      .select('id')
      .eq('device_id', deviceId)
      .in('status', ['pending', 'active'])
      .gte('created_at', twoMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('[useRtcSession] Error checking existing sessions:', error);
      return null;
    }

    if (data && data.length > 0) {
      console.log('[useRtcSession] Found existing session:', data[0].id);
      return data[0].id as string;
    }

    return null;
  }, [deviceId]);

  // Start a new RTC session (or reuse existing one)
  const startSession = useCallback(async (): Promise<string | null> => {
    if (!deviceId || !viewerId) {
      const error = language === 'he' ? 'חסרים פרטי מכשיר' : 'Missing device details';
      console.error('[useRtcSession] ❌ Missing deviceId or viewerId:', { deviceId, viewerId });
      onError(error);
      return null;
    }

    // Prevent duplicate calls if already connecting/connected
    if (status === 'connecting' || status === 'connected') {
      console.log('[useRtcSession] Already connecting/connected, ignoring start request');
      return sessionId;
    }

    console.log('[useRtcSession] 🚀 Starting session for device:', deviceId, 'viewer:', viewerId);
    updateStatus('connecting');

    try {
      // 1. First check if existingSessionId was provided from Dashboard
      let activeSessionId: string | null = existingSessionId || null;
      
      if (activeSessionId) {
        console.log('[useRtcSession] Using provided session from Dashboard:', activeSessionId);
      } else {
        // 2. Check for existing session within last 2 minutes
        activeSessionId = await findExistingSession();
      }
      
      if (activeSessionId) {
        console.log('[useRtcSession] Reusing existing session:', activeSessionId);
      } else {
        // Create new rtc_sessions row
        console.log('[useRtcSession] Creating new rtc_session...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sessionData, error: sessionError } = await (supabase as any)
          .from('rtc_sessions')
          .insert({
            device_id: deviceId,
            viewer_id: viewerId,
            status: 'pending',
          })
          .select('id')
          .single();

        if (sessionError || !sessionData) {
          console.error('[useRtcSession] ❌ Error creating session:', sessionError);
          throw new Error(sessionError?.message || 'Failed to create session');
        }

        activeSessionId = sessionData.id as string;
        console.log('[useRtcSession] ✅ Session created:', activeSessionId);
      }

      setSessionId(activeSessionId);

      // 2. Initialize WebRTC FIRST (creates the peer connection we need for signal processing)
      console.log('[useRtcSession] Initializing WebRTC peer connection...');
      const pc = await initPeerConnection(activeSessionId);
      console.log('[useRtcSession] ✅ Peer connection initialized');

      // 3. NOW subscribe to signals (pass the pc so signals can be processed immediately)
      subscribeToSignals(activeSessionId, pc);

      // 4. Set connection timeout
      timeoutRef.current = setTimeout(() => {
        console.warn('[useRtcSession] ⏱️ Connection timeout');
        const timeoutError = language === 'he' 
          ? 'פג הזמן להתחברות. נסה שוב.'
          : 'Connection timed out. Please try again.';
        onError(timeoutError);
        cleanup('failed', 'timeout');
      }, timeoutMs);

      return activeSessionId;

    } catch (err) {
      console.error('[useRtcSession] ❌ Error starting session:', err);
      const error = language === 'he' 
        ? 'שגיאה בהתחלת החיבור'
        : 'Error starting connection';
      setLastError(error);
      onError(error);
      updateStatus('failed');
      return null;
    }
  }, [deviceId, viewerId, language, onError, updateStatus, initPeerConnection, subscribeToSignals, timeoutMs, cleanup, findExistingSession, status, sessionId, existingSessionId]);

  // Stop the current session
  const stopSession = useCallback(async () => {
    console.log('[useRtcSession] Stopping session');
    await cleanup('ended');
    setSessionId(null);
    // Reset debug state
    setConnectionState(null);
    setIceConnectionState(null);
    setLastSignalType(null);
    setLastError(null);
    setSignalsProcessed(0);
    setSignalCounts({
      offersReceived: 0,
      answersSent: 0,
      iceReceived: 0,
      iceSent: 0,
    });
  }, [cleanup]);

  // Force cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current || channelRef.current) {
        cleanup();
      }
    };
  }, [cleanup]);

  // Build debug info object
  const debugInfo: RtcDebugInfo = {
    sessionId,
    status,
    connectionState,
    iceConnectionState,
    lastSignalType,
    lastError,
    signalsProcessed,
    signalCounts,
  };

  return {
    sessionId,
    status,
    startSession,
    stopSession,
    isConnecting: status === 'connecting',
    isConnected: status === 'connected',
    debugInfo,
  };
}
