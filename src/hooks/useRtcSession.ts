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
    console.log('🔑 ═══════════════════════════════════════════════════');
    console.log('🔑 [TURN] Fetching TURN credentials from Metered.ca...');
    console.log('🔑 ═══════════════════════════════════════════════════');
    
    const startTime = performance.now();
    const response = await fetch(
      'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/get-turn-credentials',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    const elapsed = Math.round(performance.now() - startTime);

    console.log(`🔑 [TURN] Response status: ${response.status} (${elapsed}ms)`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [TURN] Failed to fetch TURN credentials:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 200),
      });
      console.warn('⚠️ [TURN] Falling back to STUN-only (may fail behind NAT/firewalls)');
      return DEFAULT_ICE_SERVERS;
    }

    const data = await response.json();
    console.log('🔑 [TURN] Response data keys:', Object.keys(data));
    
    if (data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
      console.log('✅ [TURN] Got Metered.ca TURN servers:', data.iceServers.length, 'servers');
      data.iceServers.forEach((server: RTCIceServer, i: number) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        console.log(`   [TURN] Server ${i + 1}:`, urls.join(', '), server.username ? '(with auth)' : '(no auth)');
      });
      return data.iceServers;
    }
    
    console.warn('⚠️ [TURN] No iceServers in response, falling back to STUN');
    return DEFAULT_ICE_SERVERS;
  } catch (error) {
    console.error('❌ [TURN] Network error fetching credentials:', error);
    console.warn('⚠️ [TURN] Falling back to STUN-only');
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPolledIdRef = useRef<number>(0);
  
  // ICE Queue: store ICE candidates that arrive before setRemoteDescription
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef(false);

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

    // 1b. Clear polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    lastPolledIdRef.current = 0;

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

    // 5. Clear processed signals set and ICE queue
    processedSignalsRef.current.clear();
    isProcessingOfferRef.current = false;
    iceCandidateQueueRef.current = [];
    remoteDescriptionSetRef.current = false;
    
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
    console.log('🔵 ═══════════════════════════════════════════════════');
    console.log(`🔵 [RTC] SIGNAL RECEIVED - Type: ${signal.type.toUpperCase()}`);
    console.log('🔵 ═══════════════════════════════════════════════════');
    console.log('🔵 [RTC] Signal details:', {
      id: signal.id,
      type: signal.type,
      from_role: signal.from_role,
      session_id: signal.session_id,
    });
    
    // Skip if already processed or from mobile (our own)
    if (processedSignalsRef.current.has(signal.id)) {
      console.log(`⚪ [RTC] Skipping signal ${signal.id}: already processed`);
      return;
    }
    
    if (signal.from_role === 'mobile') {
      console.log(`⚪ [RTC] Skipping signal ${signal.id}: from mobile (our own)`);
      return;
    }
    
    processedSignalsRef.current.add(signal.id);
    
    // Update debug info
    setLastSignalType(signal.type);
    setSignalsProcessed(prev => prev + 1);

    console.log(`🟢 [RTC] Processing signal: type=${signal.type}, id=${signal.id}`);
    console.log(`🟢 [RTC] Current PC state:`, {
      signalingState: pc.signalingState,
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
    });


    // Offer handling MUST normalize SDP-only payloads from desktop
    if (signal.type === 'offer') {
      console.log('🟠 ═══════════════════════════════════════════════════');
      console.log('🟠 [RTC] ████ OFFER RECEIVED - STARTING HANDSHAKE ████');
      console.log('🟠 ═══════════════════════════════════════════════════');
      console.log('🟠 [RTC] Offer payload keys:', Object.keys(signal.payload || {}));
      console.log('🟠 [RTC] Offer raw:', JSON.stringify(signal.payload).substring(0, 200) + '...');

      // Prevent duplicate offer processing
      if (isProcessingOfferRef.current) {
        console.log('[useRtcSession] Already processing an offer, skipping duplicate');
        return;
      }
      isProcessingOfferRef.current = true;

      // Track offers received
      setSignalCounts(prev => ({ ...prev, offersReceived: prev.offersReceived + 1 }));

      try {
        // CRITICAL: desktop offer payload only contains { sdp }, but WebRTC needs { type: 'offer', sdp }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawPayload = signal.payload as any;
        const sdpString = rawPayload?.sdp || rawPayload?.SDP || (typeof rawPayload === 'string' ? rawPayload : null);
        
        if (!sdpString) {
          throw new Error(`Invalid offer payload: missing sdp. Keys: ${Object.keys(rawPayload || {}).join(',')}`);
        }

        const offerDesc: RTCSessionDescriptionInit = {
          type: 'offer',
          sdp: sdpString,
        };

        console.log('🟡 [RTC] Step 1/4: Setting remote description...');
        console.log('🟡 [RTC] SDP type:', offerDesc.type, 'SDP length:', offerDesc.sdp?.length);
        await pc.setRemoteDescription(offerDesc);
        remoteDescriptionSetRef.current = true;
        console.log('✅ [RTC] Step 1/4: Remote description SET. signalingState:', pc.signalingState);

        // Process queued ICE candidates now that remote description is set
        const queuedCandidates = iceCandidateQueueRef.current;
        if (queuedCandidates.length > 0) {
          console.log(`[LiveView] 🧊 Processing ${queuedCandidates.length} queued ICE candidates`);
          for (const candidate of queuedCandidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
              console.log('[LiveView] ✅ Queued ICE candidate added');
            } catch (e) {
              console.log('[LiveView] ⚠️ Failed to add queued ICE candidate:', e);
            }
          }
          iceCandidateQueueRef.current = [];
        }

        console.log('🟡 [RTC] Step 2/4: Creating answer...');
        const answer = await pc.createAnswer();
        console.log('✅ [RTC] Step 2/4: Answer created. SDP length:', answer.sdp?.length);
        
        console.log('🟡 [RTC] Step 3/4: Setting local description...');
        await pc.setLocalDescription(answer);
        console.log('✅ [RTC] Step 3/4: Local description SET. signalingState:', pc.signalingState);

        // Insert answer into database
        console.log('🟡 [RTC] Step 4/4: Inserting answer to database...');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('rtc_signals')
          .insert({
            session_id: targetSessionId,
            from_role: 'mobile',
            type: 'answer',
            payload: pc.localDescription,
          })
          .select('id');

        if (error) {
          console.error('❌ [RTC] Step 4/4: ANSWER INSERT FAILED:', error.message);
          setLastError(error.message);
          onError(error.message);
          return;
        }

        console.log('✅ ═══════════════════════════════════════════════════');
        console.log('✅ [RTC] HANDSHAKE COMPLETE - ANSWER SENT');
        console.log('✅ [RTC] Answer ID:', data?.[0]?.id);
        console.log('✅ ═══════════════════════════════════════════════════');
        setSignalCounts(prev => ({ ...prev, answersSent: prev.answersSent + 1 }));
        return;
      } catch (e) {
        console.error('[LiveView] ❌ offer->answer FAILED:', e);
        const msg = e instanceof Error ? e.message : 'offer->answer failed';
        setLastError(msg);
        onError(msg);
        isProcessingOfferRef.current = false;
        return;
      }
    }

    if (signal.type === 'ice') {
      // Track ICE candidates received
      setSignalCounts(prev => ({ ...prev, iceReceived: prev.iceReceived + 1 }));

      const candidate = signal.payload as RTCIceCandidateInit;
      console.log('🧊 [RTC] ICE candidate received:', candidate?.candidate?.substring(0, 50) + '...');

      if (candidate?.candidate) {
        // ICE Queue: only add candidate if remote description is set
        if (!remoteDescriptionSetRef.current) {
          console.log('🧊 [RTC] ICE candidate QUEUED (waiting for remote description). Queue size:', iceCandidateQueueRef.current.length + 1);
          iceCandidateQueueRef.current.push(candidate);
          return;
        }
        
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('✅ [RTC] ICE candidate ADDED. iceConnectionState:', pc.iceConnectionState);
        } catch (e) {
          console.log('⚠️ [RTC] addIceCandidate failed:', e);
          const msg = e instanceof Error ? e.message : 'addIceCandidate failed';
          setLastError(msg);
          onError(msg);
        }
      } else {
        console.log('🧊 [RTC] Empty ICE candidate (end-of-candidates signal)');
      }

      return;
    }
  }, [onError]);

  // Subscribe to signals for a session - returns promise that resolves when subscribed
  const subscribeToSignals = useCallback((targetSessionId: string, pc: RTCPeerConnection) => {
    console.log('[LiveView] sessionId', targetSessionId);
    console.log('[LiveView] subscribing to rtc_signals', { sessionId: targetSessionId });
    
    // Create channel with proper naming
    const channelName = `rtc_signals_${targetSessionId}`;
    console.log('[LiveView] creating channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rtc_signals',
          filter: `session_id=eq.${targetSessionId}`,
        },
        (payload) => {
          console.log('[LiveView] realtime payload', payload);
          const signal = payload.new as RtcSignal;

          console.log('[LiveView] signal received', {
            sessionId: targetSessionId,
            id: signal.id,
            from_role: signal.from_role,
            type: signal.type,
          });

          processSignal(signal, targetSessionId, pc);
        }
      )
      .subscribe((status, err) => {
        console.log('[LiveView] realtime status', status, err ? String(err) : null);
      });

    channelRef.current = channel;

    // ============ POLLING FALLBACK ============
    // Poll every 1000ms as a fallback in case Realtime doesn't work
    console.log('[LiveView] starting polling fallback');
    
    const pollSignals = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('rtc_signals')
          .select('id, from_role, type, payload, created_at')
          .eq('session_id', targetSessionId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) {
          console.log('[LiveView] polling error', error);
          return;
        }

        const rows = data as RtcSignal[] | null;
        const newestId = rows?.[0]?.id ?? null;
        console.log('[LiveView] polling signals', { 
          count: rows?.length || 0, 
          newestId,
          lastPolledId: lastPolledIdRef.current 
        });

        // Process any new signals we haven't seen
        // CRITICAL: Process ALL signals we haven't processed yet, regardless of ID order
        // The offer might have a lower ID than ICE candidates that arrived first
        if (rows && rows.length > 0) {
          // Reverse to process oldest first (by created_at, not ID)
          const sortedRows = [...rows].reverse();
          
          // First pass: prioritize OFFER signals (process them first)
          const offerSignals = sortedRows.filter(s => s.type === 'offer' && s.from_role === 'desktop');
          const otherSignals = sortedRows.filter(s => s.type !== 'offer' && s.from_role === 'desktop');
          
          // Process offers first, then other signals
          const orderedSignals = [...offerSignals, ...otherSignals];
          
          for (const signal of orderedSignals) {
            // Use processedSignalsRef (inside processSignal) to skip already-processed signals
            // Don't rely on lastPolledIdRef which can miss out-of-order signals
            if (signal.from_role === 'desktop') {
              console.log('[LiveView] polling: processing signal', {
                id: signal.id,
                from_role: signal.from_role,
                type: signal.type,
              });
              await processSignal(signal, targetSessionId, pc);
            }
          }
          // Update last polled ID (for logging purposes only, not for filtering)
          if (newestId && newestId > lastPolledIdRef.current) {
            lastPolledIdRef.current = newestId;
          }
        }
      } catch (e) {
        console.log('[LiveView] polling exception', e);
      }
    };

    // Start polling immediately and every 1000ms
    pollSignals();
    pollingIntervalRef.current = setInterval(pollSignals, 1000);

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
      if (!event.candidate) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('rtc_signals')
        .insert({
          session_id: sessionId,
          from_role: 'mobile',
          type: 'ice',
          payload: event.candidate.toJSON(),
        })
        .select('id');

      console.log('[LiveView] ice insert', { data, error });

      if (error) {
        setLastError(error.message);
        onError(error.message);
        return;
      }

      // Track ICE candidates sent
      setSignalCounts(prev => ({ ...prev, iceSent: prev.iceSent + 1 }));
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
      console.log('[viewer] ontrack fired');
      console.log('[useRtcSession] 🎥 Track received:', {
        kind: event.track.kind,
        streamsCount: event.streams?.length ?? 0,
        trackId: event.track.id,
        trackEnabled: event.track.enabled,
        trackMuted: event.track.muted,
        trackReadyState: event.track.readyState,
      });

      const stream = event.streams?.[0] ?? new MediaStream([event.track]);

      console.log(
        '[viewer] stream tracks:',
        stream.getTracks().map((t) => ({
          kind: t.kind,
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        }))
      );

      onStreamReceived(stream);
    };

    // NOTE: We do NOT add transceivers here. 
    // The desktop host sends an offer WITH tracks already attached.
    // Adding recvonly transceivers before receiving the offer causes SDP mismatch.
    // The browser will automatically handle incoming tracks from the desktop's offer.

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
    // Reset ALL state including status to allow fresh start
    setStatus('idle');
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
