import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, ArrowRight, Video, Laptop, RefreshCw, AlertCircle, Loader2, X, Eye, EyeOff, Volume2, VolumeX, Bell } from 'lucide-react';
import { useLiveViewState } from '@/hooks/useLiveViewState';
import { useRtcSession, RtcSessionStatus } from '@/hooks/useRtcSession';
import { LiveViewDebugPanel } from '@/components/LiveViewDebugPanel';
import { useRemoteCommand } from '@/hooks/useRemoteCommand';
import { laptopDeviceId } from '@/config/devices';
import { toast } from 'sonner';

type ViewerState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';

interface Device {
  id: string;
  device_name: string;
  device_type: string;
  is_active: boolean;
  last_seen_at: string | null;
}

interface LocationState {
  sessionId?: string;
}

const Viewer: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaryDevice, setPrimaryDevice] = useState<Device | null>(null);
  
  // Get sessionId from Dashboard navigation (if available)
  const dashboardSessionId = (location.state as LocationState)?.sessionId;

  // When coming from Dashboard we may have a sessionId in navigation state.
  // After Stop/Retry we MUST clear it, otherwise the auto-start effect will re-trigger and cause a loop.
  const clearDashboardSession = useCallback(() => {
    if (!dashboardSessionId) return;
    try {
      navigate(location.pathname + location.search, { replace: true, state: {} });
      console.log('[Viewer] Cleared dashboard navigation sessionId');
    } catch (e) {
      console.warn('[Viewer] Failed to clear dashboard navigation state:', e);
    }
  }, [dashboardSessionId, navigate, location.pathname, location.search]);
  
  // Alert deep link state
  const alertDeviceId = searchParams.get('device_id');
  const isAlertSource = searchParams.get('source') === 'alert';
  const [isFromAlert, setIsFromAlert] = useState(false);
  const [alertAutoStartDone, setAlertAutoStartDone] = useState(false);
  
  // Live View state
  const [viewerState, setViewerState] = useState<ViewerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Must start muted for reliable autoplay on mobile
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Debug state for video element
  const [videoDebugInfo, setVideoDebugInfo] = useState({
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    paused: true,
    currentTime: 0,
    srcObjectSet: false,
    trackCount: 0,
    videoTrackWidth: 0,
    videoTrackHeight: 0,
    containerWidth: 0,
    containerHeight: 0,
  });

  // Get stable viewer ID (profile ID or device fingerprint)
  const [viewerId, setViewerId] = useState<string>('');

  // Get primary device ID for live view state hook
  const primaryDeviceId = primaryDevice?.id || laptopDeviceId;
  const { liveViewActive, isLoading: liveStateLoading, refreshState } = useLiveViewState({ deviceId: primaryDeviceId });

  // Remote command hook for START/STOP
  const { sendCommand, commandState, isLoading: isCommandLoading } = useRemoteCommand({
    deviceId: primaryDeviceId,
    onAcknowledged: (cmdType) => {
      if (cmdType === 'STOP_LIVE_VIEW') {
        console.log('[Viewer] STOP_LIVE_VIEW acknowledged');
      }
    },
  });

  // RTC Session callbacks
  const handleStreamReceived = useCallback((stream: MediaStream) => {
    console.log('🎬 ═══════════════════════════════════════════════════');
    console.log('🎬 [VIEWER] ████ VIDEO STREAM RECEIVED ████');
    console.log('🎬 ═══════════════════════════════════════════════════');
    
    const tracks = stream.getTracks();
    console.log('🎬 [VIEWER] Total tracks:', tracks.length);
    tracks.forEach((t, i) => {
      console.log(`🎬 [VIEWER] Track ${i + 1}:`, {
        kind: t.kind,
        id: t.id.substring(0, 8) + '...',
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      });
    });

    mediaStreamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      console.error('❌ [VIEWER] Video element not found!');
      return;
    }

    console.log('🎬 [VIEWER] Attaching stream to video element...');
    console.log('🎬 [VIEWER] Video element state before attach:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState,
      currentSrc: video.currentSrc,
      paused: video.paused,
    });

    video.srcObject = stream;

    // Ensure autoplay works on mobile AND desktop emulation
    video.playsInline = true;
    video.muted = true;
    setIsMuted(true);

    // Add event listeners for debugging video state changes
    video.onloadedmetadata = () => {
      console.log('🎥 [VIEWER] Video metadata loaded:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        duration: video.duration,
      });
    };
    
    video.onplay = () => {
      console.log('▶️ [VIEWER] Video onplay event fired');
    };
    
    video.onplaying = () => {
      console.log('▶️ [VIEWER] Video onplaying event fired - VIDEO IS NOW PLAYING');
    };

    console.log('🎬 [VIEWER] Attempting video.play()...');
    const playPromise = video.play();
    if (playPromise && typeof (playPromise as Promise<void>).catch === 'function') {
      (playPromise as Promise<void>).then(() => {
        console.log('✅ [VIEWER] Video playing successfully!');
        console.log('✅ [VIEWER] Video dimensions after play:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          offsetWidth: video.offsetWidth,
          offsetHeight: video.offsetHeight,
        });
      }).catch((e) => {
        console.warn('⚠️ [VIEWER] video.play() blocked:', e);
        // Try to play again after a short delay (helps with desktop emulation)
        setTimeout(() => {
          video.play().catch(e2 => console.error('❌ [VIEWER] Retry play failed:', e2));
        }, 100);
      });
    }

    setViewerState('connected');
    console.log('✅ [VIEWER] State set to CONNECTED');
  }, []);

  const handleRtcError = useCallback((error: string) => {
    console.error('❌ ═══════════════════════════════════════════════════');
    console.error('❌ [VIEWER] RTC ERROR:', error);
    console.error('❌ ═══════════════════════════════════════════════════');
    setErrorMessage(error);
    setViewerState('error');
  }, []);

  // Track if user manually stopped (to show "ended" instead of "error")
  const manualStopRef = useRef(false);

  const handleStatusChange = useCallback((status: RtcSessionStatus) => {
    console.log('🔄 ═══════════════════════════════════════════════════');
    console.log('🔄 [VIEWER] RTC Status changed:', status);
    console.log('🔄 [VIEWER] manualStopRef:', manualStopRef.current);
    console.log('🔄 [VIEWER] currentViewerState:', viewerState);
    console.log('🔄 ═══════════════════════════════════════════════════');
    
    if (status === 'connecting') {
      console.log('🟡 [VIEWER] State: CONNECTING - Waiting for desktop...');
      setViewerState('connecting');
    } else if (status === 'connected') {
      console.log('🟢 [VIEWER] State: CONNECTED - Stream should be visible!');
      setViewerState('connected');
    } else if (status === 'failed') {
      // Show "ended" if manual stop, otherwise show error
      if (manualStopRef.current) {
        console.log('✅ [VIEWER] State: ENDED (manual stop, status was failed)');
        setViewerState('ended');
        manualStopRef.current = false;
      } else {
        console.log('🔴 [VIEWER] State: ERROR (network failure, NOT manual stop)');
        console.log('🔴 [VIEWER] Expected screen: "שגיאת חיבור" with "נסה שוב" button');
        setViewerState('error');
      }
    } else if (status === 'ended' || status === 'idle') {
      // If manual stop, show ended state
      if (manualStopRef.current) {
        console.log('✅ [VIEWER] State: ENDED (manual stop, status was', status, ')');
        setViewerState('ended');
        manualStopRef.current = false;
      } else {
        console.log('⚪ [VIEWER] State: IDLE');
        setViewerState('idle');
      }
    }
  }, [viewerState]);

  // RTC Session hook
  const { 
    sessionId,
    startSession, 
    stopSession, 
    isConnecting, 
    isConnected,
    debugInfo: rtcDebugInfo,
  } = useRtcSession({
    deviceId: primaryDeviceId,
    viewerId,
    onStreamReceived: handleStreamReceived,
    onError: handleRtcError,
    onStatusChange: handleStatusChange,
    timeoutMs: 60000,
    existingSessionId: dashboardSessionId, // Use session from Dashboard if available
  });

  // Cleanup stream helper - defined early for use in effects
  const cleanupStream = useCallback(() => {
    console.log('[Viewer] Cleaning up stream');
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('[Viewer] Track stopped:', track.kind);
      });
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Initialize viewer ID from profile
  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) {
      navigate('/login');
      return;
    }
    
    try {
      const profile = JSON.parse(stored);
      // Use profile ID or generate a stable ID
      const id = profile.id || `viewer_${Date.now()}`;
      setViewerId(id);
    } catch {
      setViewerId(`viewer_${Date.now()}`);
    }

    // Track if opened from alert
    if (isAlertSource) {
      setIsFromAlert(true);
    }

    fetchDevices();
  }, [navigate, isAlertSource]);

  // Handle alert deep link auto-start
  useEffect(() => {
    // Only auto-start once when all conditions are met
    if (
      isFromAlert && 
      !alertAutoStartDone && 
      primaryDevice && 
      viewerId && 
      !loading && 
      !liveStateLoading &&
      viewerState === 'idle' && 
      !isConnecting && 
      !isConnected
    ) {
      console.log('[Viewer] Alert deep link detected, auto-starting live view');
      setAlertAutoStartDone(true);
      handleStartViewing();
    }
  }, [isFromAlert, alertAutoStartDone, primaryDevice, viewerId, loading, liveStateLoading, viewerState, isConnecting, isConnected]);

  // Clear alert params when stopping (to allow re-triggering if needed)
  const clearAlertParams = useCallback(() => {
    if (isAlertSource || alertDeviceId) {
      setSearchParams({});
      setIsFromAlert(false);
      setAlertAutoStartDone(false);
    }
  }, [isAlertSource, alertDeviceId, setSearchParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, [cleanupStream]);

  // Real-time video debug info updater
  useEffect(() => {
    const updateDebugInfo = () => {
      const video = videoRef.current;
      const stream = mediaStreamRef.current;
      const videoTrack = stream?.getVideoTracks()?.[0];
      let trackWidth = 0;
      let trackHeight = 0;
      
      if (videoTrack) {
        try {
          const settings = videoTrack.getSettings();
          trackWidth = settings.width ?? 0;
          trackHeight = settings.height ?? 0;
        } catch {
          // Ignore errors
        }
      }
      
      setVideoDebugInfo({
        videoWidth: video?.videoWidth ?? 0,
        videoHeight: video?.videoHeight ?? 0,
        readyState: video?.readyState ?? 0,
        paused: video?.paused ?? true,
        currentTime: video?.currentTime ?? 0,
        srcObjectSet: !!video?.srcObject,
        trackCount: stream?.getTracks()?.length ?? 0,
        videoTrackWidth: trackWidth,
        videoTrackHeight: trackHeight,
        containerWidth: video?.offsetWidth ?? 0,
        containerHeight: video?.offsetHeight ?? 0,
      });
    };

    // Update immediately and every 500ms
    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 500);

    return () => clearInterval(interval);
  }, [viewerState]);

  // Start viewing: connect to RTC session
  // If dashboardSessionId exists, the Dashboard already created the session AND sent the command
  // We only need to initialize the RTC peer connection
  const handleStartViewing = useCallback(async () => {
    // Prevent duplicate calls - check all blocking states
    if (!viewerId || isConnecting || isConnected || viewerState === 'connecting') {
      console.log('[Viewer] Start blocked - already in progress or connected');
      return;
    }

    setErrorMessage(null);
    setViewerState('connecting');

    // If Dashboard already created session and sent command, just start RTC
    // Do NOT create new session or send command again!
    if (dashboardSessionId) {
      console.log('[Viewer] Using Dashboard session, starting RTC only:', dashboardSessionId);
      const activeSessionId = await startSession();
      if (!activeSessionId) {
        setViewerState('error');
        setErrorMessage(language === 'he' ? 'נכשל בהתחברות' : 'Failed to connect');
      }
      // Command was already sent by Dashboard - don't send again
      return;
    }

    // Manual start from Viewer (no Dashboard session) - need to create session AND send command
    console.log('[Viewer] Manual start - creating session and sending command');
    const activeSessionId = await startSession();
    if (!activeSessionId) {
      return; // Error already handled in hook
    }

    // Send START_LIVE_VIEW command (only for manual Viewer start)
    const ok = await sendCommand('START_LIVE_VIEW');
    if (!ok) {
      // Command failed, cleanup session
      await stopSession();
      setViewerState('error');
      setErrorMessage(language === 'he' ? 'נכשל בשליחת פקודה למחשב' : 'Failed to send command to computer');
    }
  }, [
    viewerId,
    isConnecting,
    isConnected,
    viewerState,
    dashboardSessionId,
    startSession,
    sendCommand,
    stopSession,
    language,
  ]);

  // Stop viewing: complete cleanup flow (used by both Stop button and X button)
  // This ensures identical behavior for all stop actions
  const handleStopViewing = useCallback(async (sendStopCommand = true) => {
    console.log('[Viewer] Stopping viewing, sendCommand:', sendStopCommand);

    // Mark as manual stop to prevent error state
    manualStopRef.current = true;

    // 1. Clear local video immediately
    cleanupStream();

    // 2. Stop RTC session (closes peer connection, updates rtc_sessions to 'ended')
    await stopSession();

    // 3. Send STOP_LIVE_VIEW command to desktop (only if requested)
    // Note: This is for LIVE VIEW only - do NOT send motion detection commands
    if (sendStopCommand) {
      await sendCommand('STOP_LIVE_VIEW');
    }

    // 4. Reset viewer state to "ended" (not idle - shows user that stream ended)
    setViewerState('ended');
    setErrorMessage(null);

    // 5. Clear alert params if from alert
    clearAlertParams();

    // 5b. Clear Dashboard sessionId (prevents auto-start loop after stop)
    clearDashboardSession();

    // 6. Refresh live view state from DB
    refreshState();
  }, [cleanupStream, stopSession, sendCommand, refreshState, clearAlertParams, clearDashboardSession]);

  // Auto-start RTC session when Dashboard passes sessionId
  // This MUST happen immediately when we have a sessionId from navigation
  useEffect(() => {
    if (!dashboardSessionId || !viewerId) {
      console.log('[Viewer] No dashboardSessionId or viewerId yet', { dashboardSessionId, viewerId });
      return;
    }
    
    // Only start if we're idle and not already connecting
    if (viewerState === 'idle' && !isConnecting && !isConnected) {
      console.log('[Viewer] Dashboard passed sessionId, auto-starting RTC...', dashboardSessionId);
      handleStartViewing();
    }
  }, [dashboardSessionId, viewerId, viewerState, isConnecting, isConnected, handleStartViewing]);

  // Watch liveViewActive and auto-start RTC session (fallback for non-Dashboard entry)
  // Note: This only handles LIVE VIEW state, not motion detection
  useEffect(() => {
    // Skip if we already have a dashboard session (handled above)
    if (dashboardSessionId) return;
    if (!primaryDevice || !viewerId || liveStateLoading) return;
    
    // CRITICAL: Skip if viewer state is 'ended' - user already stopped manually
    // This prevents resetting back to 'idle' after manual stop
    if (viewerState === 'ended') {
      console.log('[Viewer] Skipping liveViewActive effect - already ended');
      return;
    }

    if (liveViewActive && viewerState === 'idle' && !isConnecting && !isConnected) {
      console.log('[Viewer] Live view active (non-dashboard), starting RTC session...');
      handleStartViewing();
    } else if (!liveViewActive && (isConnecting || isConnected)) {
      console.log('[Viewer] Live view stopped externally, cleaning up...');
      // External stop - just cleanup locally, don't send command
      handleStopViewing(false);
    }
  }, [
    dashboardSessionId,
    liveViewActive,
    liveStateLoading,
    primaryDevice,
    viewerId,
    viewerState,
    isConnecting,
    isConnected,
    handleStartViewing,
    handleStopViewing,
  ]);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('id, device_name, device_type, is_active, last_seen_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching devices:', error);
        return;
      }

      setDevices(data || []);
      // Set primary device - prefer the configured laptop
      const laptop = data?.find(d => d.id === laptopDeviceId);
      setPrimaryDevice(laptop || (data && data.length > 0 ? data[0] : null));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    console.log('[Viewer] Retry clicked - resetting state completely');
    
    // 1. Reset error message and mark as manual stop (so status change doesn't trigger error again)
    setErrorMessage(null);
    manualStopRef.current = true;
    
    // 2. Clean up any lingering stream
    cleanupStream();
    
    // 3. Stop previous session completely (but don't send stop command)
    await stopSession();

    // 3b. If we came from Dashboard, clear the navigation sessionId so we don't auto-start-loop
    clearDashboardSession();
    
    // 4. Reset viewer state to idle BEFORE starting
    setViewerState('idle');
    
    // 5. Give React time to re-render and hook to update isConnecting/isConnected
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 6. Clear manual stop flag before starting fresh
    manualStopRef.current = false;
    
    // 7. Now start fresh - create new session and send command
    console.log('[Viewer] Starting fresh session after retry');
    const activeSessionId = await startSession();
    if (!activeSessionId) {
      setViewerState('error');
      setErrorMessage(language === 'he' ? 'נכשל בהתחברות' : 'Failed to connect');
      return;
    }

    // For retry, always send START command (we're not coming from Dashboard anymore)
    const ok = await sendCommand('START_LIVE_VIEW');
    if (!ok) {
      await stopSession();
      setViewerState('error');
      setErrorMessage(language === 'he' ? 'נכשל בשליחת פקודה למחשב' : 'Failed to send command to computer');
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const getDeviceStatus = (device: Device) => {
    if (!device.last_seen_at) {
      return { label: language === 'he' ? 'לא מחובר' : 'Never connected', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', isOnline: false };
    }
    
    const lastSeen = new Date(device.last_seen_at);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffSeconds = diffMs / 1000;
    
    if (diffSeconds < 30) {
      return { label: language === 'he' ? 'מחובר' : 'Online', color: 'bg-green-500/20 text-green-400 border-green-500/30', isOnline: true };
    } else if (diffSeconds < 120) {
      return { label: language === 'he' ? 'לאחרונה' : 'Recently', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', isOnline: false };
    }
    return { label: language === 'he' ? 'לא מחובר' : 'Offline', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', isOnline: false };
  };

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const renderViewerContent = () => {
    // CRITICAL: Check 'ended' state FIRST before any other checks
    // This ensures the "Stream Ended" screen stays visible after manual stop
    if (viewerState === 'ended') {
      return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <Video className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">
            {language === 'he' ? 'השידור הסתיים' : 'Stream Ended'}
          </h2>
          <p className="text-white/60 mb-6">
            {language === 'he'
              ? 'נא לחץ על הכפתור חזרה לדשבורד'
              : 'Please click the button to return to dashboard'}
          </p>
          <Link to="/dashboard">
            <Button className="bg-primary hover:bg-primary/90">
              <ArrowIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'חזרה לדשבורד' : 'Back to Dashboard'}
            </Button>
          </Link>
        </div>
      );
    }

    if (loading || liveStateLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-white/60">
            {language === 'he' ? 'טוען...' : 'Loading...'}
          </p>
        </div>
      );
    }

    // If we have a dashboardSessionId, skip the device check - we're joining an existing session
    if (!primaryDevice && !dashboardSessionId) {
      return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-600/20 to-slate-800/20 border border-slate-500/30 flex items-center justify-center mx-auto mb-6">
            <Laptop className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">
            {language === 'he' ? 'לא נמצא מחשב מארח' : 'No Host Computer Found'}
          </h2>
          <p className="text-white/60 mb-6">
            {language === 'he'
              ? 'ודא שהמחשב הנייד מחובר ופעיל'
              : 'Make sure your laptop is connected and active'}
          </p>
          <Link to="/dashboard">
            <Button className="bg-primary hover:bg-primary/90">
              {language === 'he' ? 'חזרה לדשבורד' : 'Back to Dashboard'}
            </Button>
          </Link>
        </div>
      );
    }

    const deviceStatus = primaryDevice ? getDeviceStatus(primaryDevice) : null;

    return (
      <div className="space-y-4">
        {/* Device Status Bar - Always visible, separate from stream state */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 flex items-center justify-center">
              <Laptop className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">
                {primaryDevice?.device_name || (language === 'he' ? 'מתחבר...' : 'Connecting...')}
              </h3>
              {deviceStatus && (
                <Badge className={`${deviceStatus.color} border text-xs mt-0.5`}>
                  {deviceStatus.label}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${deviceStatus?.isOnline ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">sessionId</span>
          <span className="text-xs font-mono text-foreground truncate max-w-[60%]">{sessionId || 'none'}</span>
        </div>

        {/* Alert Banner - Show when from alert and connecting/connected */}
        {isFromAlert && (viewerState === 'connecting' || viewerState === 'connected') && (
          <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-amber-200 text-sm font-medium">
              {language === 'he' ? 'התראה נכנסת' : 'Incoming Alert'}
            </span>
          </div>
        )}

        {/* Live View Container */}
        <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden aspect-video relative">
          {/* Video Element - ALWAYS visible (not display:none) for stream attachment compatibility
              Using opacity and position to hide when not connected, since display:none 
              can cause issues with srcObject assignment in desktop emulation */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            style={{
              position: viewerState === 'connected' ? 'relative' : 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              backgroundColor: '#000',
              opacity: viewerState === 'connected' ? 1 : 0,
              pointerEvents: viewerState === 'connected' ? 'auto' : 'none',
              zIndex: viewerState === 'connected' ? 10 : -1,
            }}
          />

          {/* Idle State */}
          {viewerState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-600/20 to-slate-800/20 border border-slate-500/30 flex items-center justify-center mb-6">
                <Video className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'אין שידור פעיל' : 'No Active Stream'}
              </h3>
              <p className="text-white/60 text-sm text-center max-w-xs mb-6">
                {language === 'he'
                  ? 'הפעל את השידור מהמסך הראשי או לחץ כאן להתחלה'
                  : 'Start the stream from the main screen or click here to start'}
              </p>
              <div className="flex gap-3">
                <Button 
                  onClick={handleStartViewing}
                  disabled={isCommandLoading || !(deviceStatus?.isOnline) || isConnecting || isConnected}
                  className="bg-primary hover:bg-primary/90"
                >
                  {(isCommandLoading || isConnecting) ? (
                    <Loader2 className={`w-4 h-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  ) : (
                    <Eye className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  )}
                  {language === 'he' ? 'התחל צפייה' : 'Start Viewing'}
                </Button>
                <Link to="/dashboard">
                  <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-700">
                    <ArrowIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {language === 'he' ? 'דשבורד' : 'Dashboard'}
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Connecting State */}
          {viewerState === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'מתחבר לשידור...' : 'Connecting to stream...'}
              </h3>
              <p className="text-white/60 text-sm">
                {language === 'he' ? 'אנא המתן' : 'Please wait'}
              </p>
            </div>
          )}

          {/* Error State */}
          {viewerState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-500/30 flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'שגיאת חיבור' : 'Connection Error'}
              </h3>
              <p className="text-white/60 text-sm text-center max-w-xs mb-6">
                {errorMessage || (language === 'he' ? 'לא ניתן להתחבר לשידור' : 'Could not connect to stream')}
              </p>
              <Button onClick={handleRetry} className="bg-primary hover:bg-primary/90">
                <RefreshCw className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'נסה שוב' : 'Try Again'}
              </Button>
            </div>
          )}

          {/* Ended State is now handled at top of renderViewerContent */}

          {/* Controls Overlay - Only when connected */}
          {viewerState === 'connected' && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleMute}
                    className="text-white hover:bg-white/20"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                  <span className="text-white/80 text-sm">
                    {language === 'he' ? 'שידור חי' : 'Live'}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleStopViewing(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <X className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'עצור' : 'Stop'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Stream Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${
            viewerState === 'connected' ? 'bg-green-500 animate-pulse' :
            viewerState === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            viewerState === 'error' ? 'bg-red-500' :
            'bg-slate-500'
          }`} />
          <span className="text-white/60">
            {viewerState === 'connected' && (language === 'he' ? 'שידור פעיל' : 'Stream Active')}
            {viewerState === 'connecting' && (language === 'he' ? 'מתחבר...' : 'Connecting...')}
            {viewerState === 'error' && (language === 'he' ? 'שגיאה' : 'Error')}
            {viewerState === 'idle' && (language === 'he' ? 'ממתין לשידור' : 'Waiting for stream')}
          </span>
        </div>

        {/* Debug: Session ID Display */}
        <div className="mt-2 p-2 bg-slate-800/80 border border-slate-600/50 rounded-lg text-center">
          <span className="text-xs font-mono text-cyan-400">
            sessionId: {sessionId || 'none'}
          </span>
        </div>

        {/* Real-time Video Debug Overlay */}
        <div className="mt-2 p-3 bg-amber-900/80 border border-amber-500/50 rounded-lg">
          <div className="text-xs font-mono text-amber-200 space-y-1">
            <div className="font-bold text-amber-400 mb-2">🔍 Video Debug Info (Real-time)</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span>Video Dimensions:</span>
              <span className={videoDebugInfo.videoWidth > 10 ? 'text-green-400' : 'text-red-400'}>
                {videoDebugInfo.videoWidth} x {videoDebugInfo.videoHeight}
                {videoDebugInfo.videoWidth <= 10 && ' ⚠️ TOO SMALL!'}
              </span>
              
              <span>Track Settings:</span>
              <span className={videoDebugInfo.videoTrackWidth > 0 ? 'text-green-400' : 'text-yellow-400'}>
                {videoDebugInfo.videoTrackWidth} x {videoDebugInfo.videoTrackHeight}
              </span>
              
              <span>Container Size:</span>
              <span className="text-cyan-400">
                {videoDebugInfo.containerWidth} x {videoDebugInfo.containerHeight}
              </span>
              
              <span>readyState:</span>
              <span className={videoDebugInfo.readyState >= 3 ? 'text-green-400' : 'text-yellow-400'}>
                {videoDebugInfo.readyState} {videoDebugInfo.readyState === 0 && '(HAVE_NOTHING)'}
                {videoDebugInfo.readyState === 1 && '(HAVE_METADATA)'}
                {videoDebugInfo.readyState === 2 && '(HAVE_CURRENT_DATA)'}
                {videoDebugInfo.readyState === 3 && '(HAVE_FUTURE_DATA)'}
                {videoDebugInfo.readyState === 4 && '(HAVE_ENOUGH_DATA)'}
              </span>
              
              <span>Paused:</span>
              <span className={!videoDebugInfo.paused ? 'text-green-400' : 'text-red-400'}>
                {videoDebugInfo.paused ? 'YES ❌' : 'NO ▶️'}
              </span>
              
              <span>srcObject:</span>
              <span className={videoDebugInfo.srcObjectSet ? 'text-green-400' : 'text-red-400'}>
                {videoDebugInfo.srcObjectSet ? 'SET ✓' : 'NULL ❌'}
              </span>
              
              <span>Track Count:</span>
              <span className={videoDebugInfo.trackCount > 0 ? 'text-green-400' : 'text-red-400'}>
                {videoDebugInfo.trackCount}
              </span>
              
              <span>Current Time:</span>
              <span className="text-cyan-400">
                {videoDebugInfo.currentTime.toFixed(2)}s
              </span>
              
              <span>viewerState:</span>
              <span className={viewerState === 'connected' ? 'text-green-400' : 'text-yellow-400'}>
                {viewerState}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <ArrowIcon className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">AIGuard</span>
              </div>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold text-white mb-4 text-center">
            {language === 'he' ? 'צפייה בשידור' : 'Live View'}
          </h1>

          {renderViewerContent()}
        </div>
      </main>

      {/* Debug Panel - Only visible in dev mode */}
      <LiveViewDebugPanel 
        viewerState={viewerState}
        rtcDebugInfo={rtcDebugInfo}
        errorMessage={errorMessage}
      />
    </div>
  );
};

export default Viewer;
