import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Baby, ArrowLeft, ArrowRight, Camera, Volume2, VolumeX, Mic, Loader2, AlertCircle, RefreshCw, Headphones } from 'lucide-react';
import { useRtcSession, RtcSessionStatus } from '@/hooks/useRtcSession';
import { useRemoteCommand } from '@/hooks/useRemoteCommand';
import { useDevices, getSelectedDeviceId } from '@/hooks/useDevices';

/**
 * Baby Monitor Viewer - v2.3.0
 * User must tap "Start Listening" to unlock browser audio policy.
 * Opens audio stream via WebRTC (camera OFF in UI).
 * "Turn on camera" navigates to full Viewer.
 */

type BabyViewerState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';

const BabyMonitorViewer: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  const [viewerState, setViewerState] = useState<BabyViewerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startInitiatedRef = useRef(false);
  const stopSentRef = useRef(false);

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  // Profile & device
  const profileId = useMemo(() => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      try { return JSON.parse(stored).id; } catch { return undefined; }
    }
    return undefined;
  }, []);

  const [viewerId, setViewerId] = useState('');
  const { selectedDevice } = useDevices(profileId);
  const primaryDeviceId = selectedDevice?.id || getSelectedDeviceId() || '';

  // Remote command
  const { sendCommand } = useRemoteCommand({ deviceId: primaryDeviceId });
  const sendCommandRef = useRef(sendCommand);
  useEffect(() => { sendCommandRef.current = sendCommand; }, [sendCommand]);

  // Stream received – attach to <audio>
  const handleStreamReceived = useCallback((stream: MediaStream) => {
    console.log('[BabyViewer] Stream received, tracks:', stream.getTracks().length);
    mediaStreamRef.current = stream;

    const audio = audioRef.current;
    if (!audio) return;

    audio.srcObject = stream;
    // Audio element was already unlocked by user gesture in handleStartListening
    audio.play().then(() => {
      console.log('[BabyViewer] [OK] Audio playing');
      setIsMuted(false);
    }).catch(e => {
      console.warn('[BabyViewer] [WARN] Audio play blocked, trying muted:', e);
      audio.muted = true;
      setIsMuted(true);
      audio.play().catch(() => {});
    });

    setViewerState('connected');
  }, []);

  const handleRtcError = useCallback((error: string) => {
    console.error('[BabyViewer] [FAIL] RTC Error:', error);
    setErrorMessage(error);
    setViewerState('error');
    startInitiatedRef.current = false;
  }, []);

  const handleStatusChange = useCallback((status: RtcSessionStatus) => {
    console.log('[BabyViewer] RTC status:', status);
    if (status === 'connecting') setViewerState('connecting');
    else if (status === 'connected') setViewerState('connected');
    else if (status === 'failed') {
      startInitiatedRef.current = false;
      setViewerState('error');
    } else if (status === 'ended' || status === 'idle') {
      startInitiatedRef.current = false;
      setViewerState('ended');
    }
  }, []);

  const { sessionId, startSession, stopSession, isConnecting } = useRtcSession({
    deviceId: primaryDeviceId,
    viewerId,
    onStreamReceived: handleStreamReceived,
    onError: handleRtcError,
    onStatusChange: handleStatusChange,
    timeoutMs: 60000,
  });

  const stopSessionRef = useRef(stopSession);
  useEffect(() => { stopSessionRef.current = stopSession; }, [stopSession]);
  const sessionIdRef = useRef(sessionId);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // Init
  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) { navigate('/login'); return; }
    try {
      const profile = JSON.parse(stored);
      setViewerId(profile.id || `viewer_${Date.now()}`);
    } catch {
      setViewerId(`viewer_${Date.now()}`);
    }
    stopSentRef.current = false;
    startInitiatedRef.current = false;
  }, [navigate]);

  // User must tap this – unlocks audio in gesture context (browser policy)
  // CRITICAL: Session order must match Viewer.tsx → startSession() FIRST, then sendCommand()
  // Otherwise Electron finds a stale session while the viewer listens on a new one.
  const handleStartListening = useCallback(async () => {
    if (startInitiatedRef.current) return;
    if (!primaryDeviceId || !viewerId) {
      console.error('[BabyViewer] Cannot start: missing deviceId or viewerId', { primaryDeviceId, viewerId });
      setErrorMessage(language === 'he' ? 'לא נמצא מכשיר מחובר' : 'No connected device found');
      setViewerState('error');
      return;
    }
    startInitiatedRef.current = true;
    stopSentRef.current = false;
    setViewerState('connecting');
    setErrorMessage(null);

    // CRITICAL: unlock audio element inside user gesture
    const audio = audioRef.current;
    if (audio) {
      audio.muted = false;
      await audio.play().catch(() => {});
    }

    console.log('[BabyViewer] Starting audio session (user gesture)...');
    console.log('[BabyViewer] deviceId:', primaryDeviceId, 'viewerId:', viewerId);

    // Step 1: Create RTC session FIRST (so Electron finds the correct pending session)
    const activeSessionId = await startSession();
    console.log('[BabyViewer] startSession returned:', activeSessionId);
    if (!activeSessionId) {
      console.error('[BabyViewer] Failed to create RTC session');
      setViewerState('error');
      setErrorMessage(language === 'he' ? 'יצירת חיבור נכשלה' : 'Failed to create session');
      startInitiatedRef.current = false;
      return;
    }

    // Step 2: THEN send START_LIVE_VIEW command (Electron will find our pending session)
    console.log('[BabyViewer] Sending START_LIVE_VIEW command...');
    const sent = await sendCommandRef.current('START_LIVE_VIEW');
    console.log('[BabyViewer] START_LIVE_VIEW sent result:', sent);
    if (!sent) {
      console.error('[BabyViewer] Failed to send START command');
      setViewerState('error');
      setErrorMessage(language === 'he' ? 'שליחת פקודה נכשלה' : 'Failed to send command');
      startInitiatedRef.current = false;
      await stopSessionRef.current?.();
      return;
    }

    console.log('[BabyViewer] Session created + command sent, waiting for offer...');
  }, [primaryDeviceId, viewerId, startSession, language]);

  const handleStopListening = useCallback(async () => {
    if (stopSentRef.current) return;
    stopSentRef.current = true;
    console.log('[BabyViewer] Stopping...');

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioRef.current) audioRef.current.srcObject = null;

    await stopSessionRef.current?.();
    await sendCommandRef.current('STOP_LIVE_VIEW');
    setViewerState('ended');
    startInitiatedRef.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const handleUnload = () => {
      if (stopSentRef.current) return;
      const sid = sessionIdRef.current;
      if (sid && primaryDeviceId) {
        stopSentRef.current = true;
        let token: string | null = null;
        try { token = localStorage.getItem('aiguard_session_token'); } catch {}
        navigator.sendBeacon(
          'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/send-command',
          JSON.stringify({ device_id: primaryDeviceId, command: 'STOP_LIVE_VIEW', session_token: token })
        );
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      if (!stopSentRef.current && sessionIdRef.current) {
        void stopSessionRef.current?.();
        void sendCommandRef.current?.('STOP_LIVE_VIEW');
      }
    };
  }, [primaryDeviceId]);

  const handleToggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setIsMuted(audioRef.current.muted);
    }
  }, []);

  const handleRetry = useCallback(() => {
    startInitiatedRef.current = false;
    stopSentRef.current = false;
    setViewerState('idle');
    setErrorMessage(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Hidden audio element for WebRTC playback */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" onClick={() => { if (viewerState === 'connected' || viewerState === 'connecting') handleStopListening(); }}>
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/10">
                  <ArrowIcon className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Baby className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">
                  {language === 'he' ? 'ניטור תינוק' : 'Baby Monitor'}
                </span>
              </div>
            </div>
            {viewerState === 'connected' && (
              <Button variant="ghost" size="sm" onClick={handleToggleMute} className="text-white/60 hover:text-white">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">

        {/* Idle State - User must tap to start */}
        {viewerState === 'idle' && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center">
              <Mic className="w-12 h-12 text-emerald-400" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-emerald-400 font-medium">
                {language === 'he' ? 'מיקרופון פעיל' : 'Microphone Active'}
              </p>
              <p className="text-white/50 text-sm">
                {language === 'he' ? 'המיקרופון מאזין ברקע. לחץ להאזנה בזמן אמת.' : 'Microphone is listening. Tap to hear real-time audio.'}
              </p>
            </div>
            <Button
              onClick={handleStartListening}
              className="h-14 px-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-3 text-base"
            >
              <Headphones className="w-5 h-5" />
              {language === 'he' ? 'התחל האזנה' : 'Start Listening'}
            </Button>
          </div>
        )}

        {/* Connecting State */}
        {viewerState === 'connecting' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-purple-500/20 border-2 border-purple-500/50 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
            </div>
            <span className="text-purple-300 font-medium">
              {language === 'he' ? 'מתחבר לאודיו...' : 'Connecting to audio...'}
            </span>
          </div>
        )}

        {/* Connected State - Audio Active */}
        {viewerState === 'connected' && (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center animate-pulse">
                <Mic className="w-12 h-12 text-emerald-400" />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-400 font-medium text-sm">
                  {language === 'he' ? 'שמע פעיל' : 'Live Audio Active'}
                </span>
              </div>
              {isMuted && (
                <p className="text-amber-400 text-sm">
                  {language === 'he' ? '🔇 האודיו מושתק - לחץ על הרמקול כדי לשמוע' : '🔇 Audio muted - tap speaker to unmute'}
                </p>
              )}
            </div>

            {/* Audio Visualization */}
            <div className="w-full max-w-sm bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-center gap-1 h-16">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-emerald-500/60 animate-pulse"
                    style={{
                      height: `${Math.random() * 40 + 10}px`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: `${0.8 + Math.random() * 0.4}s`,
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Volume2 className="w-4 h-4 text-white/40" />
                <span className="text-white/40 text-xs">
                  {language === 'he' ? 'שמע פעיל בזמן אמת' : 'Real-time Audio'}
                </span>
              </div>
            </div>

            {/* Camera button */}
            <div className="w-full max-w-sm">
              <Button
                onClick={() => navigate('/viewer')}
                variant="outline"
                className="w-full h-14 border-purple-500/50 text-purple-300 hover:bg-purple-500/10 gap-3"
              >
                <Camera className="w-5 h-5" />
                {language === 'he' ? 'הפעל מצלמה לצפייה' : 'Turn On Camera to Watch'}
              </Button>
              <p className="text-white/30 text-xs text-center mt-2">
                {language === 'he' ? 'המצלמה כבויה כברירת מחדל. הפעל ידנית לצפייה.' : 'Camera is off by default. Turn on manually to watch.'}
              </p>
            </div>

            {/* Stop button */}
            <Button
              onClick={handleStopListening}
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              {language === 'he' ? 'הפסק האזנה' : 'Stop Listening'}
            </Button>
          </>
        )}

        {/* Error State */}
        {viewerState === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-400" />
            </div>
            <span className="text-red-400 font-medium">
              {language === 'he' ? 'שגיאת חיבור' : 'Connection Error'}
            </span>
            {errorMessage && <p className="text-white/50 text-sm text-center">{errorMessage}</p>}
            <Button onClick={handleRetry} variant="outline" className="border-purple-500/50 text-purple-300 gap-2">
              <RefreshCw className="w-4 h-4" />
              {language === 'he' ? 'נסה שוב' : 'Retry'}
            </Button>
          </div>
        )}

        {/* Ended State */}
        {viewerState === 'ended' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-slate-700/50 border-2 border-slate-600/50 flex items-center justify-center">
              <Mic className="w-12 h-12 text-slate-500" />
            </div>
            <span className="text-white/60 font-medium">
              {language === 'he' ? 'ההאזנה הופסקה' : 'Listening Ended'}
            </span>
            <Button onClick={handleRetry} variant="outline" className="border-purple-500/50 text-purple-300 gap-2">
              <RefreshCw className="w-4 h-4" />
              {language === 'he' ? 'האזן שוב' : 'Listen Again'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BabyMonitorViewer;
