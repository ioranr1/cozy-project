import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Message types for WebRTC signaling
export interface SignalingOffer {
  type: 'offer';
  session_id: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalingAnswer {
  type: 'answer';
  session_id: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalingCandidate {
  type: 'candidate';
  session_id: string;
  candidate: RTCIceCandidateInit;
}

export interface SignalingStop {
  type: 'stop';
  session_id: string;
  ended_at?: string;
  ended_by?: string;
}

export type SignalingMessage = SignalingOffer | SignalingAnswer | SignalingCandidate | SignalingStop;

interface UseWebRTCSignalingOptions {
  sessionId: string;
  onOffer?: (sdp: RTCSessionDescriptionInit) => void;
  onAnswer?: (sdp: RTCSessionDescriptionInit) => void;
  onCandidate?: (candidate: RTCIceCandidateInit) => void;
  onStop?: (message: SignalingStop) => void;
  onError?: (error: Error) => void;
}

export function useWebRTCSignaling({
  sessionId,
  onOffer,
  onAnswer,
  onCandidate,
  onStop,
  onError,
}: UseWebRTCSignalingOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Subscribe to channel
  useEffect(() => {
    if (!sessionId) return;

    const channelName = `live:${sessionId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'offer' }, ({ payload }) => {
        const message = payload as SignalingOffer;
        console.log('[Signaling] Received offer:', message.session_id);
        onOffer?.(message.sdp);
      })
      .on('broadcast', { event: 'answer' }, ({ payload }) => {
        const message = payload as SignalingAnswer;
        console.log('[Signaling] Received answer:', message.session_id);
        onAnswer?.(message.sdp);
      })
      .on('broadcast', { event: 'candidate' }, ({ payload }) => {
        const message = payload as SignalingCandidate;
        console.log('[Signaling] Received candidate');
        onCandidate?.(message.candidate);
      })
      .on('broadcast', { event: 'stop' }, ({ payload }) => {
        const message = payload as SignalingStop;
        console.log('[Signaling] Received stop:', message.session_id);
        onStop?.(message);
      })
      .subscribe((status) => {
        console.log('[Signaling] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          onError?.(new Error(`Channel ${status}`));
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[Signaling] Unsubscribing from channel');
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [sessionId, onOffer, onAnswer, onCandidate, onStop, onError]);

  // Send offer (viewer -> desktop)
  const sendOffer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    if (!channelRef.current) {
      console.error('[Signaling] Channel not connected');
      return;
    }
    
    const message: SignalingOffer = {
      type: 'offer',
      session_id: sessionId,
      sdp,
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'offer',
      payload: message,
    });
    console.log('[Signaling] Sent offer');
  }, [sessionId]);

  // Send answer (desktop -> viewer)
  const sendAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    if (!channelRef.current) {
      console.error('[Signaling] Channel not connected');
      return;
    }
    
    const message: SignalingAnswer = {
      type: 'answer',
      session_id: sessionId,
      sdp,
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'answer',
      payload: message,
    });
    console.log('[Signaling] Sent answer');
  }, [sessionId]);

  // Send ICE candidate (both directions)
  const sendCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!channelRef.current) {
      console.error('[Signaling] Channel not connected');
      return;
    }
    
    const message: SignalingCandidate = {
      type: 'candidate',
      session_id: sessionId,
      candidate,
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'candidate',
      payload: message,
    });
    console.log('[Signaling] Sent candidate');
  }, [sessionId]);

  // Send stop (either side can stop)
  const sendStop = useCallback(async () => {
    if (!channelRef.current) {
      console.error('[Signaling] Channel not connected');
      return;
    }
    
    const message: SignalingStop = {
      type: 'stop',
      session_id: sessionId,
      ended_at: new Date().toISOString(),
      ended_by: 'client',
    };

    await channelRef.current.send({
      type: 'broadcast',
      event: 'stop',
      payload: message,
    });
    console.log('[Signaling] Sent stop');
  }, [sessionId]);

  return {
    isConnected,
    sendOffer,
    sendAnswer,
    sendCandidate,
    sendStop,
  };
}
