import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export type RtcSessionStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'failed';

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
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useRtcSession({
  deviceId,
  viewerId,
  onStreamReceived,
  onError,
  onStatusChange,
  timeoutMs = 60000,
}: UseRtcSessionOptions) {
  const { language } = useLanguage();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<RtcSessionStatus>('idle');
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedSignalsRef = useRef<Set<number>>(new Set());
  const isMountedRef = useRef(true);

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

  // Cleanup function
  const cleanup = useCallback(async (finalStatus?: 'ended' | 'failed', failReason?: string) => {
    console.log('[useRtcSession] Cleaning up...');
    
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Unsubscribe from realtime
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Update session status in DB if we have a session
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
      } catch (err) {
        console.error('[useRtcSession] Error updating session status:', err);
      }
    }

    processedSignalsRef.current.clear();
    
    if (finalStatus && isMountedRef.current) {
      updateStatus(finalStatus === 'ended' ? 'idle' : 'failed');
    }
  }, [sessionId, updateStatus]);

  // Insert a signal to the database
  // Note: Using 'as any' because rtc_signals table is new and types not yet regenerated
  const insertSignal = useCallback(async (
    targetSessionId: string,
    type: 'offer' | 'answer' | 'ice',
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  ) => {
    console.log(`[useRtcSession] Inserting signal: ${type}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('rtc_signals')
      .insert({
        session_id: targetSessionId,
        from_role: 'mobile',
        type,
        payload,
      });
    
    if (error) {
      console.error('[useRtcSession] Error inserting signal:', error);
      throw error;
    }
  }, []);

  // Process incoming signals
  const processSignal = useCallback(async (signal: RtcSignal) => {
    // Skip if already processed or from mobile (our own)
    if (processedSignalsRef.current.has(signal.id) || signal.from_role === 'mobile') {
      return;
    }
    processedSignalsRef.current.add(signal.id);

    const pc = peerConnectionRef.current;
    if (!pc) {
      console.warn('[useRtcSession] No peer connection for signal processing');
      return;
    }

    console.log(`[useRtcSession] Processing signal: ${signal.type} from ${signal.from_role}`);

    try {
      if (signal.type === 'offer') {
        // Set remote description from offer
        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload as RTCSessionDescriptionInit));
        
        // Create and set local answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        // Send answer back
        await insertSignal(signal.session_id, 'answer', answer);
        console.log('[useRtcSession] Answer sent');
        
      } else if (signal.type === 'ice') {
        // Add ICE candidate
        const candidate = signal.payload as RTCIceCandidateInit;
        if (candidate.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('[useRtcSession] ICE candidate added');
        }
      }
    } catch (err) {
      console.error(`[useRtcSession] Error processing ${signal.type}:`, err);
    }
  }, [insertSignal]);

  // Subscribe to signals for a session
  const subscribeToSignals = useCallback((sessionId: string) => {
    console.log('[useRtcSession] Subscribing to signals for session:', sessionId);
    
    const channel = supabase
      .channel(`rtc-signals-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rtc_signals',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const signal = payload.new as RtcSignal;
          processSignal(signal);
        }
      )
      .subscribe((status) => {
        console.log('[useRtcSession] Signal subscription status:', status);
      });

    channelRef.current = channel;

    // Also fetch any existing signals (in case they arrived before subscription)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('rtc_signals')
      .select('*')
      .eq('session_id', sessionId)
      .eq('from_role', 'desktop')
      .order('created_at', { ascending: true })
      .then(({ data, error }: { data: RtcSignal[] | null; error: Error | null }) => {
        if (error) {
          console.error('[useRtcSession] Error fetching existing signals:', error);
          return;
        }
        if (data) {
          data.forEach((signal) => processSignal(signal));
        }
      });
  }, [processSignal]);

  // Initialize WebRTC peer connection
  const initPeerConnection = useCallback((sessionId: string) => {
    console.log('[useRtcSession] Initializing peer connection');
    
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = pc;

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await insertSignal(sessionId, 'ice', event.candidate.toJSON());
        } catch (err) {
          console.error('[useRtcSession] Error sending ICE candidate:', err);
        }
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[useRtcSession] Connection state:', pc.connectionState);
      
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
        onError(errorMsg);
        cleanup('failed', 'connection_' + pc.connectionState);
      }
    };

    // Handle incoming tracks (video stream)
    pc.ontrack = (event) => {
      console.log('[useRtcSession] Track received:', event.streams.length, 'streams');
      if (event.streams && event.streams[0]) {
        onStreamReceived(event.streams[0]);
      }
    };

    // Add transceivers for receiving video/audio
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    return pc;
  }, [insertSignal, language, onError, onStreamReceived, updateStatus, cleanup]);

  // Start a new RTC session
  const startSession = useCallback(async (): Promise<string | null> => {
    if (!deviceId || !viewerId) {
      const error = language === 'he' ? 'חסרים פרטי מכשיר' : 'Missing device details';
      onError(error);
      return null;
    }

    console.log('[useRtcSession] Starting session for device:', deviceId);
    updateStatus('connecting');

    try {
      // 1. Create rtc_sessions row
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
        console.error('[useRtcSession] Error creating session:', sessionError);
        throw new Error(sessionError?.message || 'Failed to create session');
      }

      const newSessionId = sessionData.id as string;
      setSessionId(newSessionId);
      console.log('[useRtcSession] Session created:', newSessionId);

      // 2. Initialize WebRTC
      initPeerConnection(newSessionId);

      // 3. Subscribe to signals
      subscribeToSignals(newSessionId);

      // 4. Set connection timeout
      timeoutRef.current = setTimeout(() => {
        console.warn('[useRtcSession] Connection timeout');
        const timeoutError = language === 'he' 
          ? 'פג הזמן להתחברות. נסה שוב.'
          : 'Connection timed out. Please try again.';
        onError(timeoutError);
        cleanup('failed', 'timeout');
      }, timeoutMs);

      return newSessionId;

    } catch (err) {
      console.error('[useRtcSession] Error starting session:', err);
      const error = language === 'he' 
        ? 'שגיאה בהתחלת החיבור'
        : 'Error starting connection';
      onError(error);
      updateStatus('failed');
      return null;
    }
  }, [deviceId, viewerId, language, onError, updateStatus, initPeerConnection, subscribeToSignals, timeoutMs, cleanup]);

  // Stop the current session
  const stopSession = useCallback(async () => {
    console.log('[useRtcSession] Stopping session');
    await cleanup('ended');
    setSessionId(null);
  }, [cleanup]);

  // Force cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerConnectionRef.current || channelRef.current) {
        cleanup();
      }
    };
  }, [cleanup]);

  return {
    sessionId,
    status,
    startSession,
    stopSession,
    isConnecting: status === 'connecting',
    isConnected: status === 'connected',
  };
}
