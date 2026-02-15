import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Baby, ArrowLeft, ArrowRight, Camera, CameraOff, Volume2, VolumeX, Mic, MicOff, Loader2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useRtcSession, RtcSessionStatus } from '@/hooks/useRtcSession';
import { useRemoteCommand } from '@/hooks/useRemoteCommand';
import { useDevices, getSelectedDeviceId } from '@/hooks/useDevices';

/**
 * Baby Monitor Viewer - v3.0.0
 * 
 * New design:
 * - Opens "quiet" — no auto-connection
 * - Video area (black when camera off, shows video when on)
 * - Button A: Toggle Audio (ON/OFF)
 * - Button B: Toggle Camera (ON/OFF) — requires audio to be on
 * - Cancel button: disarm baby monitor + back to dashboard
 * - Back button: return to dashboard
 * - Dark theme, prominent buttons
 */

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error';
type ActiveMode = 'none' | 'audio_only' | 'full';

const BabyMonitorViewer: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  // UI state
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [activeMode, setActiveMode] = useState<ActiveMode>('none');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const startInitiatedRef = useRef(false);
  const stopSentRef = useRef(false);
  const isReconnectingRef = useRef(false);
  const pendingModeRef = useRef<ActiveMode>('none');

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

  // Stream received — attach to audio/video elements
  const handleStreamReceived = useCallback((stream: MediaStream) => {
    console.log('[BabyViewer] Stream received, tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`).join(', '));
    mediaStreamRef.current = stream;

    // Attach audio
    const audio = audioRef.current;
    if (audio) {
      audio.srcObject = stream;
      audio.play().then(() => {
        console.log('[BabyViewer] Audio playing');
        setIsMuted(false);
      }).catch(e => {
        console.warn('[BabyViewer] Audio play blocked, trying muted:', e);
        audio.muted = true;
        setIsMuted(true);
        audio.play().catch(() => {});
      });
    }

    // Attach video if video tracks exist
    const video = videoRef.current;
    if (video && stream.getVideoTracks().length > 0) {
      video.srcObject = stream;
      video.play().catch(e => console.warn('[BabyViewer] Video play error:', e));
    }

    setActiveMode(pendingModeRef.current);
    setConnectionState('connected');
    isReconnectingRef.current = false;
  }, []);

  const handleRtcError = useCallback((error: string) => {
    console.error('[BabyViewer] RTC Error:', error);
    setErrorMessage(error);
    setConnectionState('error');
    startInitiatedRef.current = false;
    isReconnectingRef.current = false;
  }, []);

  const handleStatusChange = useCallback((status: RtcSessionStatus) => {
    console.log('[BabyViewer] RTC status:', status);
    if (status === 'connecting') {
      setConnectionState(isReconnectingRef.current ? 'reconnecting' : 'connecting');
    } else if (status === 'connected') {
      setConnectionState('connected');
    } else if (status === 'failed') {
      startInitiatedRef.current = false;
      isReconnectingRef.current = false;
      setConnectionState('error');
    } else if (status === 'ended' || status === 'idle') {
      startInitiatedRef.current = false;
      // Only go to idle if we're not reconnecting
      if (!isReconnectingRef.current) {
        setConnectionState('idle');
        setActiveMode('none');
        setAudioEnabled(false);
        setCameraEnabled(false);
      }
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

  // Connect with a specific mode
  const connectWithMode = useCallback(async (mode: 'audio_only' | 'full') => {
    if (startInitiatedRef.current && !isReconnectingRef.current) return;
    if (!primaryDeviceId || !viewerId) {
      setErrorMessage(language === 'he' ? 'לא נמצא מכשיר מחובר' : 'No connected device found');
      setConnectionState('error');
      return;
    }

    startInitiatedRef.current = true;
    stopSentRef.current = false;
    pendingModeRef.current = mode;

    if (!isReconnectingRef.current) {
      setConnectionState('connecting');
    }
    setErrorMessage(null);

    // Unlock audio element inside user gesture
    const audio = audioRef.current;
    if (audio) {
      audio.muted = false;
      await audio.play().catch(() => {});
    }

    console.log('[BabyViewer] Connecting with mode:', mode);

    // Step 1: Create RTC session
    const activeSessionId = await startSession();
    if (!activeSessionId) {
      setConnectionState('error');
      setErrorMessage(language === 'he' ? 'יצירת חיבור נכשלה' : 'Failed to create session');
      startInitiatedRef.current = false;
      isReconnectingRef.current = false;
      return;
    }

    // Step 2: Send command — audio_only uses START_LIVE_VIEW, full uses START_LIVE_VIEW_FULL
    const commandType = mode === 'full' ? 'START_LIVE_VIEW_FULL' : 'START_LIVE_VIEW';
    console.log('[BabyViewer] Sending', commandType);
    const sent = await sendCommandRef.current(commandType);
    if (!sent) {
      setConnectionState('error');
      setErrorMessage(language === 'he' ? 'שליחת פקודה נכשלה' : 'Failed to send command');
      startInitiatedRef.current = false;
      isReconnectingRef.current = false;
      await stopSessionRef.current?.();
      return;
    }

    console.log('[BabyViewer] Session + command sent, waiting for stream...');
  }, [primaryDeviceId, viewerId, startSession, language]);

  // Disconnect current session
  const disconnectCurrent = useCallback(async () => {
    if (stopSentRef.current) return;
    stopSentRef.current = true;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioRef.current) audioRef.current.srcObject = null;
    if (videoRef.current) videoRef.current.srcObject = null;

    await stopSessionRef.current?.();
    await sendCommandRef.current('STOP_LIVE_VIEW');
    startInitiatedRef.current = false;
  }, []);

  // ============================================================
  // TOGGLE HANDLERS
  // ============================================================

  const handleToggleAudio = useCallback(async () => {
    if (audioEnabled) {
      // Turn OFF audio (and camera)
      setAudioEnabled(false);
      setCameraEnabled(false);
      setActiveMode('none');
      setConnectionState('idle');
      await disconnectCurrent();
    } else {
      // Turn ON audio
      setAudioEnabled(true);
      setCameraEnabled(false);
      await connectWithMode('audio_only');
    }
  }, [audioEnabled, connectWithMode, disconnectCurrent]);

  const handleToggleCamera = useCallback(async () => {
    if (!audioEnabled) return; // Camera requires audio

    if (cameraEnabled) {
      // Turn OFF camera, keep audio — reconnect as audio_only
      setCameraEnabled(false);
      isReconnectingRef.current = true;
      setConnectionState('reconnecting');
      await disconnectCurrent();
      // Small delay for cleanup
      await new Promise(r => setTimeout(r, 500));
      await connectWithMode('audio_only');
    } else {
      // Turn ON camera — reconnect as full
      setCameraEnabled(true);
      isReconnectingRef.current = true;
      setConnectionState('reconnecting');
      await disconnectCurrent();
      await new Promise(r => setTimeout(r, 500));
      await connectWithMode('full');
    }
  }, [audioEnabled, cameraEnabled, connectWithMode, disconnectCurrent]);

  // Cancel baby monitor — stop everything + navigate back
  const handleCancel = useCallback(async () => {
    if (connectionState === 'connected' || connectionState === 'connecting' || connectionState === 'reconnecting') {
      await disconnectCurrent();
    }
    navigate('/dashboard');
  }, [connectionState, disconnectCurrent, navigate]);

  const handleToggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setIsMuted(audioRef.current.muted);
    }
  }, []);

  const handleRetry = useCallback(() => {
    startInitiatedRef.current = false;
    stopSentRef.current = false;
    isReconnectingRef.current = false;
    setConnectionState('idle');
    setActiveMode('none');
    setAudioEnabled(false);
    setCameraEnabled(false);
    setErrorMessage(null);
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

  const isActive = connectionState === 'connected';
  const isBusy = connectionState === 'connecting' || connectionState === 'reconnecting';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Hidden audio element */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Header */}
      <header className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 z-10 shrink-0">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" onClick={() => { if (isActive || isBusy) disconnectCurrent(); }}>
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
            {/* Mute/unmute when connected */}
            {isActive && audioEnabled && (
              <Button variant="ghost" size="sm" onClick={handleToggleMute} className="text-white/60 hover:text-white">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Video Area */}
      <div className="flex-1 flex flex-col">
        <div className="relative w-full aspect-video max-h-[50vh] bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${cameraEnabled && isActive ? '' : 'hidden'}`}
          />
          {/* Camera OFF overlay */}
          {(!cameraEnabled || !isActive) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <CameraOff className="w-12 h-12 text-slate-600" />
              <span className="text-slate-500 text-sm">
                {language === 'he' ? 'המצלמה כבויה' : 'Camera Off'}
              </span>
            </div>
          )}
          {/* Connection status overlay */}
          {isBusy && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="flex items-center gap-3 bg-slate-800/80 px-5 py-3 rounded-xl">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                <span className="text-white/80 text-sm">
                  {connectionState === 'reconnecting'
                    ? (language === 'he' ? 'מתחבר מחדש...' : 'Reconnecting...')
                    : (language === 'he' ? 'מתחבר...' : 'Connecting...')}
                </span>
              </div>
            </div>
          )}
          {/* Audio indicator when connected + audio only */}
          {isActive && audioEnabled && !cameraEnabled && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium">
                {language === 'he' ? 'שמע פעיל' : 'Audio Active'}
              </span>
            </div>
          )}
        </div>

        {/* Controls Area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">

          {/* Error State */}
          {connectionState === 'error' && (
            <div className="flex flex-col items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <span className="text-red-400 font-medium text-sm">
                {language === 'he' ? 'שגיאת חיבור' : 'Connection Error'}
              </span>
              {errorMessage && <p className="text-white/40 text-xs text-center max-w-xs">{errorMessage}</p>}
              <Button onClick={handleRetry} variant="outline" size="sm" className="border-slate-600 text-slate-300 gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                {language === 'he' ? 'נסה שוב' : 'Retry'}
              </Button>
            </div>
          )}

          {/* Main Toggle Buttons */}
          <div className="w-full max-w-sm space-y-4">
            {/* Audio Toggle */}
            <button
              onClick={handleToggleAudio}
              disabled={isBusy}
              className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all duration-200 ${
                audioEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                  : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/50'
              } ${isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  audioEnabled ? 'bg-emerald-500/20' : 'bg-slate-700/50'
                }`}>
                  {audioEnabled ? (
                    <Mic className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <MicOff className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className={`text-start ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className={`font-semibold ${audioEnabled ? 'text-emerald-300' : 'text-white/80'}`}>
                    {language === 'he' ? 'האזנה' : 'Audio'}
                  </p>
                  <p className="text-xs text-white/40">
                    {audioEnabled
                      ? (language === 'he' ? 'שמע פעיל — לחץ לכיבוי' : 'Active — tap to turn off')
                      : (language === 'he' ? 'לחץ להפעלת שמע' : 'Tap to enable audio')}
                  </p>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${
                audioEnabled ? 'bg-emerald-500 justify-end' : 'bg-slate-600 justify-start'
              }`}>
                <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </div>
            </button>

            {/* Camera Toggle */}
            <button
              onClick={handleToggleCamera}
              disabled={!audioEnabled || isBusy}
              className={`w-full flex items-center justify-between px-6 py-4 rounded-2xl border-2 transition-all duration-200 ${
                cameraEnabled
                  ? 'bg-purple-500/15 border-purple-500/50 shadow-lg shadow-purple-500/10'
                  : audioEnabled
                    ? 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/50'
                    : 'bg-slate-900/40 border-slate-800/30 opacity-40'
              } ${(!audioEnabled || isBusy) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  cameraEnabled ? 'bg-purple-500/20' : 'bg-slate-700/50'
                }`}>
                  {cameraEnabled ? (
                    <Camera className="w-6 h-6 text-purple-400" />
                  ) : (
                    <CameraOff className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className={`text-start ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className={`font-semibold ${cameraEnabled ? 'text-purple-300' : 'text-white/80'}`}>
                    {language === 'he' ? 'מצלמה' : 'Camera'}
                  </p>
                  <p className="text-xs text-white/40">
                    {!audioEnabled
                      ? (language === 'he' ? 'יש להפעיל שמע תחילה' : 'Enable audio first')
                      : cameraEnabled
                        ? (language === 'he' ? 'מצלמה פעילה — לחץ לכיבוי' : 'Active — tap to turn off')
                        : (language === 'he' ? 'לחץ להפעלת מצלמה' : 'Tap to enable camera')}
                  </p>
                </div>
              </div>
              <div className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${
                cameraEnabled ? 'bg-purple-500 justify-end' : 'bg-slate-600 justify-start'
              }`}>
                <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
              </div>
            </button>
          </div>

          {/* Muted warning */}
          {isActive && isMuted && (
            <p className="text-amber-400 text-xs text-center">
              {language === 'he' ? '🔇 האודיו מושתק — לחץ על הרמקול בראש המסך' : '🔇 Audio muted — tap speaker icon above'}
            </p>
          )}

          {/* Cancel Baby Monitor Button */}
          <Button
            onClick={handleCancel}
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2 mt-4"
          >
            <X className="w-4 h-4" />
            {language === 'he' ? 'בטל ניטור תינוק' : 'Cancel Baby Monitor'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BabyMonitorViewer;
