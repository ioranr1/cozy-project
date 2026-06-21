// BUILD ID: viewer-2026-06-21-v2.52.66-dashboard-subscribe-before-start
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, ArrowRight, Video, Laptop, RefreshCw, AlertCircle, Loader2, X, Eye, EyeOff, Volume2, VolumeX, Bell } from 'lucide-react';
import { ConnectionIndicator } from '@/components/ConnectionIndicator';
import { useLiveViewState } from '@/hooks/useLiveViewState';
import { useRtcSession, RtcSessionStatus } from '@/hooks/useRtcSession';
import { LiveViewDebugPanel } from '@/components/LiveViewDebugPanel';
import { useRemoteCommand } from '@/hooks/useRemoteCommand';
import { useDevices, getSelectedDeviceId } from '@/hooks/useDevices';
import { toast } from 'sonner';
import { useSessionManager } from '@/hooks/useSessionManager';

type ViewerState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended' | 'retrying';

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

// Auto-retry configuration
const MAX_AUTO_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const Viewer: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaryDevice, setPrimaryDevice] = useState<Device | null>(null);

  // Prevent auto-start after an actual browser reload (F5).
  // IMPORTANT: Don't use sessionStorage here because in some mobile/privacy contexts it can throw
  // and crash the whole page (resulting in a blank screen with empty console).
  const isReloadRef = useRef(false);
  useEffect(() => {
    try {
      const nav = (performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined);
      isReloadRef.current = nav?.type === 'reload';
    } catch {
      isReloadRef.current = false;
    }
  }, []);

  // Get profile ID for dynamic device selection
  const profileId = useMemo(() => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      try {
        return JSON.parse(stored).id;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, []);

  // Get selected device from useDevices hook
  const { selectedDevice } = useDevices(profileId);

  // Treat the host as online only if it is actively connected AND seen recently.
  // This prevents navigating/auto-starting into a connection loop when the desktop app is offline.
  // CRITICAL: Use 120s threshold consistent with Dashboard
  // Using 30s caused false "host_offline" errors during normal heartbeat gaps
  const isPrimaryDeviceOnline = useMemo(() => {
    if (!primaryDevice?.last_seen_at) return false;
    const lastSeen = new Date(primaryDevice.last_seen_at);
    const diffSeconds = (Date.now() - lastSeen.getTime()) / 1000;
    // Be consistent with Dashboard: 120s threshold for connectivity
    return diffSeconds <= 120;
  }, [primaryDevice]);
  
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
  const isFromBabyMonitor = searchParams.get('from') === 'baby-monitor';
  const [isFromAlert, setIsFromAlert] = useState(false);
  const [alertAutoStartDone, setAlertAutoStartDone] = useState(false);

  // Determine back destination: baby-monitor or dashboard
  const backPath = isFromBabyMonitor ? '/baby-monitor' : '/dashboard';
  const backLabel = isFromBabyMonitor
    ? (language === 'he' ? 'חזרה לניטור תינוק' : 'Back to Baby Monitor')
    : (language === 'he' ? 'חזרה לדשבורד' : 'Back to Dashboard');
  
  // CRITICAL: Prevent duplicate handleStartViewing calls
  // This flag is set when START is initiated and cleared only after cleanup/stop
  const startInitiatedRef = useRef<boolean>(false);
  
  // Live View state
  const [viewerState, setViewerState] = useState<ViewerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Must start muted for reliable autoplay on mobile
  const [isMuted, setIsMuted] = useState(true);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [needsPlaybackTap, setNeedsPlaybackTap] = useState(false);
  const [waitingForVideoFrames, setWaitingForVideoFrames] = useState(false);
  const autoRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoFrameWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Keep latest session/device/connection flags for unload/unmount handlers without
  // re-registering effects (prevents STOP spam + flicker).
  const sessionIdRef = useRef<string | null>(null);
  const primaryDeviceIdRef = useRef<string>('');
  const connectionFlagsRef = useRef<{ isConnecting: boolean; isConnected: boolean }>({
    isConnecting: false,
    isConnected: false,
  });

  // Get stable viewer ID (profile ID or device fingerprint)
  const [viewerId, setViewerId] = useState<string>('');

  // Get primary device ID for live view state hook - use selectedDevice or fallback to localStorage
  const primaryDeviceId = selectedDevice?.id || primaryDevice?.id || getSelectedDeviceId() || '';
  const { liveViewActive, isLoading: liveStateLoading, refreshState } = useLiveViewState({ deviceId: primaryDeviceId || undefined });
  const { prepareLiveView } = useSessionManager();

  // Remote command hook for START/STOP
  const { sendCommand, commandState, isLoading: isCommandLoading } = useRemoteCommand({
    deviceId: primaryDeviceId,
    onAcknowledged: (cmdType) => {
      if (cmdType === 'STOP_LIVE_VIEW') {
        console.log('[Viewer] STOP_LIVE_VIEW acknowledged');
      }
    },
  });

  // IMPORTANT: stopSession/sendCommand identities can change as hooks update internal state.
  // If we include them in effect deps, React will run the cleanup function repeatedly (NOT just on unmount),
  // which can spam STOP_LIVE_VIEW and cause flicker / no-video.
  // Keep latest fns in refs and keep the unload/unmount effect stable.
  const stopSessionFnRef = useRef<null | (() => Promise<void>)>(null);
  const sendCommandFnRef = useRef<null | ((cmd: 'START_LIVE_VIEW' | 'STOP_LIVE_VIEW') => Promise<boolean>)>(null);

  // RTC Session callbacks
  const ensureVideoPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;

    try {
      video.playsInline = true;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      await video.play();
      setNeedsPlaybackTap(false);
    } catch (error) {
      console.warn('⚠️ [VIEWER] Mobile video playback requires tap:', error);
      setNeedsPlaybackTap(true);
    }
  }, []);

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
    setNeedsPlaybackTap(false);
    setWaitingForVideoFrames(true);
    video.srcObject = stream;

    // Ensure autoplay works on mobile (muted autoplay is the only reliable path)
    video.playsInline = true;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    setIsMuted(true);

    stream.getVideoTracks().forEach((track) => {
      const retryPlayback = () => {
        console.log('🎬 [VIEWER] Video track unmuted/live, retrying playback');
        ensureVideoPlayback();
      };
      track.addEventListener('unmute', retryPlayback, { once: true });
      track.addEventListener('ended', () => setWaitingForVideoFrames(false), { once: true });
    });

    console.log('🎬 [VIEWER] Attempting video.play()...');
    ensureVideoPlayback();

    if (videoFrameWatchdogRef.current) {
      clearTimeout(videoFrameWatchdogRef.current);
    }

    videoFrameWatchdogRef.current = setTimeout(() => {
      const currentVideo = videoRef.current;
      if (!currentVideo || viewerState === 'idle') return;
      const hasFrames = currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && currentVideo.videoWidth > 0 && currentVideo.videoHeight > 0;
      setWaitingForVideoFrames(!hasFrames);
      if (!hasFrames) {
        console.warn('⚠️ [VIEWER] WebRTC connected but no decoded video frames yet; keeping recovery overlay visible');
        ensureVideoPlayback();
      }
    }, 2500);

    setViewerState('connected');
    console.log('✅ [VIEWER] State set to CONNECTED');
  }, [ensureVideoPlayback, viewerState]);

  const handleRtcError = useCallback((error: string) => {
    console.error('❌ ═══════════════════════════════════════════════════');
    console.error('❌ [VIEWER] RTC ERROR:', error);
    console.error('❌ ═══════════════════════════════════════════════════');
    setErrorMessage(error);
    setViewerState('error');
    // CRITICAL: Release start lock on error so user can retry
    startInitiatedRef.current = false;
  }, []);

  // Track if user manually stopped (to show "ended" instead of "error")
  const manualStopRef = useRef(false);
  
  // Prevent duplicate STOP commands (beforeunload + cleanup + handleStopViewing can all fire)
  const stopSentRef = useRef(false);

  const handleStatusChange = useCallback((status: RtcSessionStatus) => {
    console.log('🔄 [VIEWER] RTC Status changed:', status, 'manualStop:', manualStopRef.current, 'autoRetryCount:', autoRetryCount);
    if (status === 'connecting') {
      console.log('🟡 [VIEWER] State: CONNECTING - Waiting for desktop...');
      setViewerState('connecting');
    } else if (status === 'connected') {
      console.log('🟢 [VIEWER] State: CONNECTED - Stream should be visible!');
      setViewerState('connected');
      // Reset retry count on successful connection
      setAutoRetryCount(0);
    } else if (status === 'failed') {
      // CRITICAL: Release start lock on failure so user can retry
      startInitiatedRef.current = false;
      
      // Show "ended" if manual stop, otherwise check for auto-retry
      if (manualStopRef.current) {
        console.log('✅ [VIEWER] State: ENDED (manual stop)');
        setViewerState('ended');
        manualStopRef.current = false;
      } else {
        // Check if we should auto-retry
        if (autoRetryCount < MAX_AUTO_RETRIES) {
          console.log(`🔄 [VIEWER] Auto-retry ${autoRetryCount + 1}/${MAX_AUTO_RETRIES} in ${RETRY_DELAY_MS}ms...`);
          setViewerState('retrying');
          setAutoRetryCount(prev => prev + 1);
          // Schedule retry
          autoRetryTimerRef.current = setTimeout(() => {
            console.log(`🔄 [VIEWER] Executing auto-retry ${autoRetryCount + 1}...`);
            handleRetryInternal();
          }, RETRY_DELAY_MS);
        } else {
          console.log('🔴 [VIEWER] State: FAILED (max retries reached)');
          setViewerState('error');
          setAutoRetryCount(0);
        }
      }
    } else if (status === 'ended' || status === 'idle') {
      // CRITICAL: Release start lock on end so user can start again
      startInitiatedRef.current = false;
      
      // If manual stop, show ended state
      if (manualStopRef.current) {
        console.log('✅ [VIEWER] State: ENDED (manual stop)');
        setViewerState('ended');
        manualStopRef.current = false;
      } else {
        console.log('⚪ [VIEWER] State: IDLE');
        setViewerState('idle');
      }
    }
  }, [autoRetryCount]);

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

  // Keep latest stop/send functions for stable unmount/unload handlers
  useEffect(() => {
    stopSessionFnRef.current = stopSession;
  }, [stopSession]);

  useEffect(() => {
    sendCommandFnRef.current = sendCommand;
  }, [sendCommand]);

  // Sync latest values into refs (so event handlers always see current state)
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    primaryDeviceIdRef.current = primaryDeviceId;
  }, [primaryDeviceId]);

  useEffect(() => {
    connectionFlagsRef.current = { isConnecting, isConnected };
  }, [isConnecting, isConnected]);

  // Cleanup stream helper - defined early for use in effects
  const cleanupStream = useCallback(() => {
    console.log('[Viewer] Cleaning up stream');
    if (videoFrameWatchdogRef.current) {
      clearTimeout(videoFrameWatchdogRef.current);
      videoFrameWatchdogRef.current = null;
    }
    setNeedsPlaybackTap(false);
    setWaitingForVideoFrames(false);
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

    // CRITICAL: Reset refs on fresh mount to ensure STOP can be sent
    // This fixes the bug where stopSentRef stays true from previous session
    stopSentRef.current = false;
    startInitiatedRef.current = false;
    manualStopRef.current = false;
    console.log('[Viewer] Reset refs on mount');

    fetchDevices();
  }, [navigate, isAlertSource]);

  // Baby-monitor auto-start removed (v3.4.0) — user clicks "Start Viewing" manually

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

  // baby-monitor auto-start is handled AFTER handleStartViewing definition (below)

  // Clear alert params when stopping (to allow re-triggering if needed)
  const clearAlertParams = useCallback(() => {
    if (isAlertSource || alertDeviceId) {
      setSearchParams({});
      setIsFromAlert(false);
      setAlertAutoStartDone(false);
    }
  }, [isAlertSource, alertDeviceId, setSearchParams]);

  // Cleanup on unmount (including page refresh/navigation)
  // MUST send STOP command and close RTC session to prevent auto-restart on refresh
  useEffect(() => {
    // IMPORTANT:
    // This effect MUST NOT depend on sessionId/isConnecting/isConnected.
    // Otherwise React will run the cleanup on every state change and we will spam STOP commands
    // (causing the session to end before the desktop sends an offer, and the UI to flicker).

    const handleBeforeUnload = () => {
      // Prevent duplicate STOP commands
      if (stopSentRef.current) {
        console.log('[Viewer] beforeunload: STOP already sent, skipping');
        return;
      }

      const sid = sessionIdRef.current;
      const did = primaryDeviceIdRef.current;

      // Use sendBeacon for reliable cleanup on page unload
      if (sid && did) {
        console.log('[Viewer] Page unloading, sending stop command via beacon', { sid });
        stopSentRef.current = true;

        // Include session token, otherwise the edge function will reject it.
        // Wrap in try/catch because some environments can block storage access.
        let sessionToken: string | null = null;
        try {
          sessionToken = localStorage.getItem('aiguard_session_token');
        } catch {
          sessionToken = null;
        }

        const payload = JSON.stringify({
          device_id: did,
          command: 'STOP_LIVE_VIEW',
          session_token: sessionToken,
        });
        navigator.sendBeacon(
          'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/send-command',
          payload
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupStream();

      // CRITICAL: Check stopSentRef FIRST to prevent duplicate STOP commands
      // This flag is set by handleStopViewing, beforeunload, or previous unmount
      const alreadyStopped = stopSentRef.current;
      console.log('[Viewer] Unmount cleanup starting, stopSentRef:', alreadyStopped);
      
      if (alreadyStopped) {
        console.log('[Viewer] Unmount cleanup: STOP already sent, closing RTC only');
        // Still close local RTC session (no DB command needed)
        void stopSessionFnRef.current?.();
        return;
      }

      const sid = sessionIdRef.current;
      const { isConnecting: c, isConnected: d } = connectionFlagsRef.current;
      // Only stop if we were actually in a session
      if (sid && (c || d)) {
        // CRITICAL: Set flag BEFORE async operation to prevent race conditions
        stopSentRef.current = true;
        console.log('[Viewer] Unmount cleanup: stopping RTC session', { sid });
        
        // Close local RTC session (DB status update happens inside hook)
        void stopSessionFnRef.current?.();

        // Send STOP to desktop once (best-effort)
        if (primaryDeviceIdRef.current) {
          void sendCommandFnRef.current?.('STOP_LIVE_VIEW');
        }
      }

      // Clean up auto-retry timer
      if (autoRetryTimerRef.current) {
        clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupStream]);

  // Start viewing: connect to RTC session
  // If dashboardSessionId exists, the Dashboard already created the session AND sent the command
  // We only need to initialize the RTC peer connection
  const handleStartViewing = useCallback(async () => {
    // CRITICAL: Use ref-based lock to prevent duplicate START calls across effect cycles
    if (startInitiatedRef.current) {
      console.log('[Viewer] Start blocked - already initiated (startInitiatedRef=true)');
      return;
    }
    
    // Prevent duplicate calls - check all blocking states
    if (!viewerId || isConnecting || isConnected || viewerState === 'connecting') {
      console.log('[Viewer] Start blocked - already in progress or connected');
      return;
    }

    // CRITICAL: Block start if computer is offline (last_seen_at > 120s threshold)
    // This prevents connection loops when the desktop app is sleeping/closed
    if (!isPrimaryDeviceOnline) {
      console.log('[Viewer] Start blocked - computer is offline');
      setErrorMessage(
        language === 'he' 
          ? 'המחשב לא מחובר. פתח את האפליקציה במחשב ונסה שוב.' 
          : 'Computer is offline. Open the desktop app and try again.'
      );
      setViewerState('error');
      return;
    }

    // Set the lock BEFORE any async operations
    startInitiatedRef.current = true;
    console.log('[Viewer] Start initiated - setting lock');

    // Reset stop flag for new session
    stopSentRef.current = false;

    setErrorMessage(null);
    setViewerState('connecting');

    // If Dashboard already created session and sent command, just start RTC.
    // CRITICAL: Do NOT call prepareLiveView here — Dashboard already prepared
    // and cleanupStaleSessions would KILL the session Dashboard just created!
    //
    // Only prepare when starting MANUALLY from Viewer (no dashboardSessionId).
    if (!dashboardSessionId && primaryDevice?.id) {
      const prepared = await prepareLiveView(primaryDevice.id);
      if (!prepared) {
        setViewerState('error');
        setErrorMessage(language === 'he' ? 'שגיאה בהכנת הסשן' : 'Session preparation failed');
        startInitiatedRef.current = false;
        return;
      }
    }

    // If Dashboard already created session, subscribe to RTC signals FIRST, then send START.
    // Otherwise the desktop can send Offer/ICE before the mobile viewer is listening,
    // and the viewer misses the offer when many ICE rows push it out of a small polling window.
    if (dashboardSessionId) {
      console.log('[Viewer] Dashboard session detected, joining RTC before START command:', dashboardSessionId);
      const activeSessionId = await startSession();
      if (!activeSessionId) {
        setViewerState('error');
        setErrorMessage(language === 'he' ? 'נכשל בהתחברות' : 'Failed to connect');
        startInitiatedRef.current = false;
        return;
      }

      console.log('[Viewer] RTC subscription ready, sending START command from Viewer:', activeSessionId);
      const ok = await sendCommand('START_LIVE_VIEW');
      if (!ok) {
        await stopSession();
        setViewerState('error');
        setErrorMessage(language === 'he' ? 'נכשל בשליחת פקודה למחשב' : 'Failed to send command to computer');
        startInitiatedRef.current = false;
      }
      return;
    }

    // Manual start from Viewer (no Dashboard session) - create session first, then command.
    // DB is the SSOT: Electron must have a pending rtc_session available before START is handled,
    // otherwise it can open the camera but time out before sending a WebRTC offer.
    const startCommand = isFromBabyMonitor ? 'START_LIVE_VIEW_FULL' : 'START_LIVE_VIEW';

    console.log('[Viewer] Creating RTC session before START command');
    const activeSessionId = await startSession();
    if (!activeSessionId) {
      startInitiatedRef.current = false; // Release lock on failure
      return; // Error already handled in hook
    }

    console.log(`[Viewer] Session ready (${activeSessionId}), sending ${startCommand} command`);
    const ok = await sendCommand(startCommand);
    if (!ok) {
      await stopSession();
      setViewerState('error');
      setErrorMessage(language === 'he' ? 'נכשל בשליחת פקודה למחשב' : 'Failed to send command to computer');
      startInitiatedRef.current = false;
      return;
    }
  }, [
    viewerId,
    isConnecting,
    isConnected,
    viewerState,
    isPrimaryDeviceOnline,
    isFromBabyMonitor,
    dashboardSessionId,
    startSession,
    sendCommand,
    stopSession,
    language,
    prepareLiveView,
  ]);

  // Baby-monitor → viewer: No auto-start. User clicks "Start Viewing" like normal live view.
  // The from=baby-monitor param is kept for: 1) back button navigation, 2) START_LIVE_VIEW_FULL command.


  // This ensures identical behavior for all stop actions
  const handleStopViewing = useCallback(async (sendStopCommand = true) => {
    console.log('[Viewer] Stopping viewing, sendCommand:', sendStopCommand, 'stopSentRef:', stopSentRef.current);

    // Mark as manual stop to prevent error state
    manualStopRef.current = true;
    
    // CRITICAL: Release the start lock so next START can proceed
    startInitiatedRef.current = false;

    // 1. Clear local video immediately
    cleanupStream();

    // 2. Stop RTC session (closes peer connection, updates rtc_sessions to 'ended')
    await stopSession();

    // 3. Send STOP_LIVE_VIEW command to desktop (only if requested AND not already sent)
    // Note: This is for LIVE VIEW only - do NOT send motion detection commands
    if (sendStopCommand && !stopSentRef.current) {
      stopSentRef.current = true;
      console.log('[Viewer] Sending STOP_LIVE_VIEW command...');
      const result = await sendCommand('STOP_LIVE_VIEW');
      console.log('[Viewer] STOP_LIVE_VIEW command result:', result);
    } else {
      console.log('[Viewer] Skipping STOP command - already sent or not requested');
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

    // If the dashboard tried to start live view while the desktop is offline,
    // immediately send the user back instead of spinning in a connect loop.
    if (!loading && primaryDevice && !isPrimaryDeviceOnline) {
      toast.error(
        language === 'he'
          ? 'המחשב לא מחובר כרגע. הפעל את אפליקציית הדסקטופ ונסה שוב.'
          : 'Computer is offline. Start the desktop app and try again.'
      );

      // IMPORTANT: Dashboard already created an rtc_session before navigation.
      // If we bail out here, we must close it to avoid leaving it stuck in `pending`.
      void (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('rtc_sessions')
            .update({
              status: 'ended',
              ended_at: new Date().toISOString(),
              fail_reason: 'host_offline',
            })
            .eq('id', dashboardSessionId);
        } catch (e) {
          console.warn('[Viewer] Failed to end rtc_session on offline bailout:', e);
        }
      })();

      clearDashboardSession();
      navigate('/dashboard', { replace: true });
      return;
    }
    
    // Only start if we're idle and not already connecting
    // CRITICAL: Also check startInitiatedRef to prevent duplicate START calls
    if (!loading && viewerState === 'idle' && !isConnecting && !isConnected && !startInitiatedRef.current) {
      console.log('[Viewer] Dashboard passed sessionId, auto-starting RTC...', dashboardSessionId);
      handleStartViewing();
    }
  }, [dashboardSessionId, viewerId, viewerState, isConnecting, isConnected, handleStartViewing, loading, primaryDevice, isPrimaryDeviceOnline, language, clearDashboardSession, navigate]);

  // Watch liveViewActive and auto-start RTC session (fallback for non-Dashboard entry)
  // Note: This only handles LIVE VIEW state, not motion detection
  // CRITICAL: Skip entirely when coming from baby-monitor - user clicks "Start Viewing" manually
  useEffect(() => {
    // Skip if coming from baby-monitor (user already clicked Start Viewing)
    if (isFromBabyMonitor) return;
    // Skip if we already have a dashboard session (handled above)
    if (dashboardSessionId) return;
    if (!primaryDevice || !viewerId || liveStateLoading) return;
    
    // CRITICAL: Skip if viewer state is 'ended' or 'error' - user already stopped manually
    if (viewerState === 'ended' || viewerState === 'error') {
      console.log('[Viewer] Skipping liveViewActive effect - state is:', viewerState);
      return;
    }
    
    // CRITICAL: Skip auto-start if this is a page refresh (F5)
    if (isReloadRef.current) {
      console.log('[Viewer] Skipping auto-start - page was refreshed (F5)');
      return;
    }

    // Only auto-start if liveViewActive is true AND we're in idle state
    if (liveViewActive && viewerState === 'idle' && !isConnecting && !isConnected && !startInitiatedRef.current) {
      console.log('[Viewer] Live view active (non-dashboard), starting RTC session...');
      handleStartViewing();
    }
  }, [
    isFromBabyMonitor,
    dashboardSessionId,
    liveViewActive,
    liveStateLoading,
    primaryDevice,
    viewerId,
    viewerState,
    isConnecting,
    isConnected,
    handleStartViewing,
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
      // Set primary device - prefer the selected device from useDevices
      const savedDeviceId = getSelectedDeviceId();
      const savedDevice = savedDeviceId ? data?.find(d => d.id === savedDeviceId) : null;
      setPrimaryDevice(savedDevice || (data && data.length > 0 ? data[0] : null));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Internal retry function (used by auto-retry)
  const handleRetryInternal = async () => {
    console.log('[Viewer] Auto-retry - starting fresh session');
    
    // Clean up any lingering stream
    cleanupStream();
    
    // Stop previous session completely (but don't send stop command)
    await stopSession();

    // Clear the navigation sessionId so we don't auto-start-loop
    clearDashboardSession();
    
    // Give React time to re-render
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Start fresh - create new session and send command
    const activeSessionId = await startSession();
    if (!activeSessionId) {
      // If auto-retry fails, the status change callback will handle it
      console.log('[Viewer] Auto-retry: session creation failed');
      return;
    }

    // Send START command - preserve FULL mode when coming from baby-monitor
    const retryCommand = isFromBabyMonitor ? 'START_LIVE_VIEW_FULL' : 'START_LIVE_VIEW';
    console.log(`[Viewer] Auto-retry sending ${retryCommand}`);
    const ok = await sendCommand(retryCommand);
    if (!ok) {
      await stopSession();
      console.log('[Viewer] Auto-retry: command failed');
    }
  };

  const handleRetry = async () => {
    console.log('[Viewer] Manual retry clicked - resetting state completely');
    
    // Cancel any pending auto-retry
    if (autoRetryTimerRef.current) {
      clearTimeout(autoRetryTimerRef.current);
      autoRetryTimerRef.current = null;
    }
    setAutoRetryCount(0);
    
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
    console.log('[Viewer] Starting fresh session after manual retry');
    const activeSessionId = await startSession();
    if (!activeSessionId) {
      setViewerState('error');
      setErrorMessage(language === 'he' ? 'נכשל בהתחברות' : 'Failed to connect');
      return;
    }

    // For retry, send correct command type based on source
    const retryCmd = isFromBabyMonitor ? 'START_LIVE_VIEW_FULL' : 'START_LIVE_VIEW';
    console.log(`[Viewer] Manual retry sending ${retryCmd}`);
    const ok = await sendCommand(retryCmd);
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
    
    if (diffSeconds < 30 && device.is_active) {
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
          <Link to={backPath}>
            <Button className="bg-primary hover:bg-primary/90">
              <ArrowIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {backLabel}
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
          <Link to={backPath}>
            <Button className="bg-primary hover:bg-primary/90">
              {backLabel}
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
                <Badge variant="outline" className={`${deviceStatus.color} text-xs mt-0.5`}>
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
          {/* Connection Indicator - Always visible in top-right corner when streaming/connecting */}
          {(viewerState === 'connecting' || viewerState === 'connected') && (
            <div className="absolute top-3 right-3 z-10">
              <ConnectionIndicator 
                iceConnectionState={rtcDebugInfo?.iceConnectionState || null}
                connectionState={rtcDebugInfo?.connectionState || null}
              />
            </div>
          )}

          {/* Video Element - Always present but hidden when not connected */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            onLoadedData={() => setWaitingForVideoFrames(false)}
            onCanPlay={() => setWaitingForVideoFrames(false)}
            className={`w-full h-full object-contain bg-black ${viewerState !== 'connected' ? 'hidden' : ''}`}
          />

          {viewerState === 'connected' && (needsPlaybackTap || waitingForVideoFrames) && (
            <button
              type="button"
              onClick={ensureVideoPlayback}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 text-white text-center px-6"
            >
              {needsPlaybackTap ? (
                <>
                  <Video className="w-10 h-10 mb-3 text-cyan-400" />
                  <span className="text-sm font-medium">
                    {language === 'he' ? 'הקש להפעלת הווידאו' : 'Tap to start video'}
                  </span>
                </>
              ) : (
                <>
                  <Loader2 className="w-10 h-10 mb-3 text-cyan-400 animate-spin" />
                  <span className="text-sm font-medium">
                    {language === 'he' ? 'מכין וידאו...' : 'Preparing video...'}
                  </span>
                </>
              )}
            </button>
          )}

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
                <Link to={backPath}>
                  <Button variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                    <ArrowIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {backLabel}
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Connecting State - WITH CANCEL BUTTON */}
          {viewerState === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'מתחבר לשידור...' : 'Connecting to stream...'}
              </h3>
              <p className="text-white/60 text-sm mb-6">
                {language === 'he' ? 'אנא המתן' : 'Please wait'}
              </p>
              {/* CRITICAL: Cancel button - ALWAYS available during connecting */}
              <Button 
                variant="outline" 
                onClick={async () => {
                  console.log('[Viewer] Cancel clicked during connecting');
                  // CRITICAL: Wait for STOP command to be sent BEFORE navigating
                  await handleStopViewing(true);
                  navigate(backPath);
                }}
                className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
              >
                <X className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'ביטול וחזרה' : 'Cancel & Go Back'}
              </Button>
            </div>
          )}

          {/* Error State - WITH BACK TO DASHBOARD BUTTON */}
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
              {/* TWO BUTTONS: Retry AND Back to Dashboard */}
              <div className="flex gap-3">
                <Button onClick={handleRetry} className="bg-primary hover:bg-primary/90">
                  <RefreshCw className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'נסה שוב' : 'Try Again'}
                </Button>
                <Link to={backPath}>
                  <Button variant="outline" className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                    <ArrowIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {backLabel}
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Retrying State - Auto-retry in progress */}
          {viewerState === 'retrying' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <RefreshCw className="w-16 h-16 text-amber-400 animate-spin mb-6" />
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? `מנסה שוב... (${autoRetryCount}/${MAX_AUTO_RETRIES})` : `Retrying... (${autoRetryCount}/${MAX_AUTO_RETRIES})`}
              </h3>
              <p className="text-white/60 text-sm mb-6">
                {language === 'he' ? 'החיבור נכשל, מנסה אוטומטית' : 'Connection failed, retrying automatically'}
              </p>
              {/* Cancel button to stop retrying */}
              <Button 
                variant="outline" 
                onClick={async () => {
                  console.log('[Viewer] Cancel auto-retry clicked');
                  // Cancel pending timer
                  if (autoRetryTimerRef.current) {
                    clearTimeout(autoRetryTimerRef.current);
                    autoRetryTimerRef.current = null;
                  }
                  setAutoRetryCount(0);
                  // Stop and go back
                  await handleStopViewing(true);
                  navigate(backPath);
                }}
                className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
              >
                <X className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'ביטול וחזרה' : 'Cancel & Go Back'}
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
            viewerState === 'retrying' ? 'bg-amber-500 animate-pulse' :
            viewerState === 'error' ? 'bg-red-500' :
            'bg-slate-500'
          }`} />
          <span className="text-white/60">
            {viewerState === 'connected' && (language === 'he' ? 'שידור פעיל' : 'Stream Active')}
            {viewerState === 'connecting' && (language === 'he' ? 'מתחבר...' : 'Connecting...')}
            {viewerState === 'retrying' && (language === 'he' ? `מנסה שוב (${autoRetryCount}/${MAX_AUTO_RETRIES})` : `Retrying (${autoRetryCount}/${MAX_AUTO_RETRIES})`)}
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
              {/* CRITICAL: Large, visible back button - ALWAYS works */}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  console.log('[Viewer] Header back button clicked');
                  // CRITICAL: Wait for STOP command to be sent BEFORE navigating
                  if (viewerState === 'connecting' || viewerState === 'connected') {
                    await handleStopViewing(true);
                  }
                  navigate(backPath);
                }}
                className="text-white hover:bg-slate-700 p-2"
              >
                <ArrowIcon className="w-5 h-5" />
              </Button>
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
