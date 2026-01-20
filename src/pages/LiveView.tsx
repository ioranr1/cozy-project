import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useWebRTCSignaling } from '@/hooks/useWebRTCSignaling';
import { Shield, ArrowLeft, Square, Maximize2, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

interface LocationState {
  sessionId: string;
  channel: string;
  expiresAt: string;
  ttlSeconds: number;
  iceServers: RTCIceServer[];
  deviceName?: string;
}

const LiveView: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  
  const state = location.state as LocationState | null;
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // ICE queue (viewer side): don't add candidates before remoteDescription is set
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescriptionSetRef = useRef(false);
  
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const [timeRemaining, setTimeRemaining] = useState<number>(state?.ttlSeconds || 60);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Handle incoming answer from desktop
  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    if (!pcRef.current) return;
    try {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      remoteDescriptionSetRef.current = true;
      console.log('[LiveView] Remote description set');

      // Flush queued ICE candidates now that remote description is ready
      const queued = pendingIceRef.current;
      if (queued.length > 0) {
        console.log(`[LiveView] 🧊 Flushing ${queued.length} queued ICE candidates`);
        for (const c of queued) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
          } catch (error) {
            console.error('[LiveView] Error adding queued ICE candidate:', error);
          }
        }
        pendingIceRef.current = [];
      }
    } catch (error) {
      console.error('[LiveView] Error setting remote description:', error);
    }
  }, []);

  // Handle incoming ICE candidate
  const handleCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (!pc) return;

    // Don't add ICE before remoteDescription exists (queue it)
    if (!remoteDescriptionSetRef.current && !pc.remoteDescription) {
      pendingIceRef.current.push(candidate);
      console.log('[LiveView] 🧊 ICE candidate queued (waiting for answer/remoteDescription)');
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[LiveView] ICE candidate added');
    } catch (error) {
      console.error('[LiveView] Error adding ICE candidate:', error);
    }
  }, []);

  // Handle stop signal
  const handleStop = useCallback(() => {
    console.log('[LiveView] Received stop signal');
    toast.info(language === 'he' ? 'השידור הסתיים' : 'Stream ended');
    cleanup();
    navigate('/dashboard');
  }, [language, navigate]);

  // Handle signaling errors
  const handleSignalingError = useCallback((error: Error) => {
    console.error('[LiveView] Signaling error:', error);
    setConnectionState('error');
  }, []);

  const { isConnected, sendOffer, sendCandidate, sendStop } = useWebRTCSignaling({
    sessionId: sessionId || '',
    onAnswer: handleAnswer,
    onCandidate: handleCandidate,
    onStop: handleStop,
    onError: handleSignalingError,
  });

  // Cleanup function
  const cleanup = useCallback(() => {
    remoteDescriptionSetRef.current = false;
    pendingIceRef.current = [];

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize WebRTC when signaling is connected
  useEffect(() => {
    if (!isConnected || !state?.iceServers || !sessionId) return;

    const initWebRTC = async () => {
      try {
        console.log('[LiveView] Initializing WebRTC with ICE servers:', state.iceServers);
        
        const pc = new RTCPeerConnection({ iceServers: state.iceServers });
        pcRef.current = pc;

        // Handle incoming tracks
        pc.ontrack = (event) => {
          console.log('[LiveView] Received track:', event.track.kind);
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setConnectionState('connected');
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('[LiveView] Sending ICE candidate');
            sendCandidate(event.candidate.toJSON());
          }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          console.log('[LiveView] Connection state:', pc.connectionState);
          setConnectionState(pc.connectionState);
          
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            toast.error(language === 'he' ? 'החיבור נכשל' : 'Connection failed');
          }
        };

        // Add transceiver for receiving video
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('[LiveView] Sending offer');
        await sendOffer(offer);
        
        setConnectionState('waiting');
      } catch (error) {
        console.error('[LiveView] WebRTC init error:', error);
        setConnectionState('error');
        toast.error(language === 'he' ? 'שגיאה באתחול החיבור' : 'Error initializing connection');
      }
    };

    initWebRTC();

    return () => {
      cleanup();
    };
  }, [isConnected, state?.iceServers, sessionId, sendOffer, sendCandidate, language, cleanup]);

  // Timer countdown
  useEffect(() => {
    if (!state?.expiresAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const expiresAt = new Date(state.expiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      
      setTimeRemaining(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
        toast.info(language === 'he' ? 'הזמן נגמר' : 'Time expired');
        handleStopStream();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.expiresAt, language]);

  // Handle stop stream
  const handleStopStream = async () => {
    if (stopping) return;
    setStopping(true);

    try {
      // Send stop signal via signaling
      await sendStop();

      // Call API to end session
      const { data: { session } } = await supabase.auth.getSession();
      if (session && sessionId) {
        await fetch(
          'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/live-stop',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ session_id: sessionId }),
          }
        );
      }

      cleanup();
      navigate('/dashboard');
    } catch (error) {
      console.error('[LiveView] Error stopping stream:', error);
      toast.error(language === 'he' ? 'שגיאה בעצירת השידור' : 'Error stopping stream');
    } finally {
      setStopping(false);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Format time remaining
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get connection status text
  const getStatusText = () => {
    const statusMap: Record<string, { en: string; he: string }> = {
      connecting: { en: 'Connecting to signaling...', he: 'מתחבר לסיגנלינג...' },
      waiting: { en: 'Waiting for camera...', he: 'ממתין למצלמה...' },
      connected: { en: 'Connected', he: 'מחובר' },
      disconnected: { en: 'Disconnected', he: 'מנותק' },
      failed: { en: 'Connection failed', he: 'החיבור נכשל' },
      error: { en: 'Error', he: 'שגיאה' },
    };
    const status = statusMap[connectionState] || statusMap.connecting;
    return language === 'he' ? status.he : status.en;
  };

  // If no state, redirect to dashboard
  if (!state) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 mb-4">
            {language === 'he' ? 'אין שידור פעיל. הפעל מהמסך הראשי' : 'No active stream. Start it from the main screen.'}
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            {language === 'he' ? 'חזור למסך הראשי' : 'Back to Dashboard'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStopStream}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </Button>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-white font-medium">
                  {state.deviceName || (language === 'he' ? 'שידור חי' : 'Live View')}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Timer */}
              <div className={`px-3 py-1 rounded-full text-sm font-mono ${
                timeRemaining <= 10 ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-white/80'
              }`}>
                {formatTime(timeRemaining)}
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionState === 'connected' ? 'bg-green-500' :
                  connectionState === 'waiting' ? 'bg-yellow-500 animate-pulse' :
                  connectionState === 'error' || connectionState === 'failed' ? 'bg-red-500' :
                  'bg-blue-500 animate-pulse'
                }`} />
                <span className="text-xs text-white/60 hidden sm:inline">
                  {getStatusText()}
                </span>
              </div>
              
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Video Container */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="max-w-full max-h-full w-full h-full object-contain"
        />
        
        {/* Loading Overlay */}
        {connectionState !== 'connected' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-white/80">{getStatusText()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-slate-900/80 backdrop-blur-sm border-t border-slate-800 p-4">
        <div className="container mx-auto flex items-center justify-center gap-4">
          {/* Mute Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleMute}
            className="border-slate-700 bg-slate-800/50 hover:bg-slate-700"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white" />
            ) : (
              <Volume2 className="w-5 h-5 text-white" />
            )}
          </Button>

          {/* Stop Button */}
          <Button
            onClick={handleStopStream}
            disabled={stopping}
            className="bg-red-600 hover:bg-red-700 text-white px-8"
          >
            {stopping ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Square className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'עצור שידור' : 'Stop Stream'}
              </>
            )}
          </Button>

          {/* Fullscreen Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            className="border-slate-700 bg-slate-800/50 hover:bg-slate-700"
          >
            <Maximize2 className="w-5 h-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LiveView;
