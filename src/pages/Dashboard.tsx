import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Laptop, Video, Activity, Bell, Clock, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertCircle, Monitor, Baby, Camera, Download, Smartphone } from 'lucide-react';
import { useIsMobileDevice } from '@/hooks/use-platform';
import { useCapabilities } from '@/hooks/useCapabilities';
import { FeatureGate } from '@/components/FeatureGate';
import { supabase } from '@/integrations/supabase/client';
import { DEVICE_ONLINE_THRESHOLD_SECONDS, getSelectedDeviceId } from '@/hooks/useDevices';
import { Switch } from '@/components/ui/switch';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { useRemoteCommand, CommandType } from '@/hooks/useRemoteCommand';
import { useLiveViewState } from '@/hooks/useLiveViewState';
import { toast } from 'sonner';
import { SecurityArmToggle } from '@/components/SecurityArmToggle';
import { useDevices } from '@/hooks/useDevices';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { AwayModeCard } from '@/components/AwayModeCard';
import { MobileAwayModeCard } from '@/components/MobileAwayModeCard';
import { SecurityModeComingSoon } from '@/components/SecurityModeComingSoon';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useSessionManager } from '@/hooks/useSessionManager';


interface UserProfile {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
}

type ViewStatus = 'idle' | 'starting' | 'streaming' | 'stopping';

const Dashboard: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [laptopStatus, setLaptopStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [isLaptopStatusLoading, setIsLaptopStatusLoading] = useState(true);
  const [viewStatus, setViewStatus] = useState<ViewStatus>('idle');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isBabyMonitorArmed, setIsBabyMonitorArmed] = useState(false);
  const isMobileDevice = useIsMobileDevice();
  const capabilities = useCapabilities();
  const { flags: featureFlags, isLoading: isFlagsLoading } = useFeatureFlags();
  const { prepareLiveView } = useSessionManager();

  // Get profile ID for device loading
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

  // Load devices and get selected device
  const { selectedDevice, devices, isLoading: isDevicesLoading } = useDevices(profileId);
  
  // Get active device ID - use selected device only (no fallback to legacy)
  const activeDeviceId = useMemo(() => {
    const deviceId = selectedDevice?.id || getSelectedDeviceId() || null;
    console.log('[Dashboard] activeDeviceId computed:', deviceId, 'selectedDevice:', selectedDevice?.device_name);
    return deviceId;
  }, [selectedDevice]);

  // Live view state from Supabase (source of truth)
  const { liveViewActive, isLoading: isLiveViewLoading, refreshState } = useLiveViewState({ 
    deviceId: activeDeviceId 
  });

  // Sync viewStatus with liveViewActive from Supabase
  useEffect(() => {
    // Always sync viewStatus when liveViewActive changes (after initial load)
    if (!isLiveViewLoading) {
      console.log('[Dashboard] Syncing viewStatus from liveViewActive:', liveViewActive);
      setViewStatus(liveViewActive ? 'streaming' : 'idle');
    }
  }, [liveViewActive, isLiveViewLoading]);

  // CRITICAL: Aggressive refresh on mount/navigation (e.g., returning from Viewer)
  // This ensures we get the latest command state after a STOP was sent
  useEffect(() => {
    console.log('[Dashboard] Mount detected, refreshing live view state');
    // Small delay to allow DB to catch up with STOP command
    const timer = setTimeout(() => {
      refreshState();
    }, 500);
    return () => clearTimeout(timer);
  }, [refreshState]);

  // Remote command hook
  const { sendCommand, commandState, isLoading, resetState } = useRemoteCommand({
    deviceId: activeDeviceId,
    onAcknowledged: (_commandType) => {
      // Motion detection removed - only live view uses this hook now
      // Live view state is managed by useLiveViewState hook
    },
    onFailed: (commandType) => {
      // Reset viewStatus on failure/timeout
      if (commandType === 'START_LIVE_VIEW') {
        setViewStatus('idle');
        // Refresh state from DB in case realtime missed the ACK
        refreshState();
      } else if (commandType === 'STOP_LIVE_VIEW') {
        setViewStatus('streaming');
        refreshState();
      }
    },
  });

  // Clear timeout/error banners once the *intended* live-view state is observed in SSOT
  // (Realtime ACK might be missed/delayed, but the DB-derived state is authoritative.)
  useEffect(() => {
    const startCompleted = commandState.commandType === 'START_LIVE_VIEW' && liveViewActive;
    const stopCompleted = commandState.commandType === 'STOP_LIVE_VIEW' && !liveViewActive;

    if ((startCompleted || stopCompleted) && commandState.error) {
      resetState();
    }
  }, [liveViewActive, commandState.commandType, commandState.error, resetState]);

  // Check laptop connection status - REALTIME with fallback polling
  useEffect(() => {
    const parseDbTimestamp = (value: string | null): Date | null => {
      if (!value) return null;
      let s = value.trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
        s = s.replace(' ', 'T');
      }
      if (/([+-]\d{2})$/.test(s)) {
        s = `${s}:00`;
      }
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const updateLaptopStatus = (data: { last_seen_at: string | null; is_active: boolean } | null) => {
      if (!data) {
        setLaptopStatus('unknown');
        return;
      }
      
      // If is_active is false, device is offline immediately
      if (!data.is_active) {
        console.log('[Dashboard] Device is_active=false, setting offline');
        setLaptopStatus('offline');
        return;
      }
      
      const lastSeen = parseDbTimestamp(data.last_seen_at);
      if (!lastSeen) {
        setLaptopStatus(data.last_seen_at ? 'unknown' : 'offline');
      } else {
        const now = new Date();
        const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
        setLaptopStatus(diffSeconds <= DEVICE_ONLINE_THRESHOLD_SECONDS ? 'online' : 'offline');
      }
    };

    const checkLaptopStatus = async () => {
      if (!activeDeviceId) {
        setLaptopStatus('unknown');
        setIsLaptopStatusLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('devices')
          .select('last_seen_at, is_active')
          .eq('id', activeDeviceId)
          .maybeSingle();

        if (error || !data) {
          setLaptopStatus('unknown');
          setIsLaptopStatusLoading(false);
          return;
        }

        updateLaptopStatus(data);
      } catch {
        setLaptopStatus('unknown');
      } finally {
        setIsLaptopStatusLoading(false);
      }
    };

    if (!activeDeviceId) {
      setLaptopStatus('unknown');
      setIsLaptopStatusLoading(false);
      return;
    }

    // Reset loading state when device changes
    setIsLaptopStatusLoading(true);
    
    // Check immediately
    checkLaptopStatus();

    // Subscribe to REALTIME updates for immediate status changes
    console.log('[Dashboard] Setting up Realtime subscription for device:', activeDeviceId);
    const channel = supabase
      .channel(`dashboard-device-${activeDeviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `id=eq.${activeDeviceId}`,
        },
        (payload) => {
          console.log('[Dashboard] Realtime device UPDATE:', payload);
          const updated = payload.new as { last_seen_at: string | null; is_active: boolean };
          updateLaptopStatus(updated);
        }
      )
      .subscribe((status) => {
        console.log('[Dashboard] Device subscription status:', status);
      });

    // Fallback: poll every 30 seconds in case Realtime is unavailable
    const interval = setInterval(checkLaptopStatus, 30000);

    return () => {
      console.log('[Dashboard] Cleaning up device subscription');
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeDeviceId]);

  // Subscribe to device_status for baby_monitor_enabled + is_armed
  useEffect(() => {
    if (!activeDeviceId) return;

    const fetchBabyMonitorState = async () => {
      const { data } = await supabase
        .from('device_status')
        .select('is_armed, baby_monitor_enabled')
        .eq('device_id', activeDeviceId)
        .maybeSingle();
      if (data) {
        console.log('[Dashboard] baby monitor state fetched:', data.is_armed, data.baby_monitor_enabled);
        setIsBabyMonitorArmed(data.is_armed && data.baby_monitor_enabled);
      } else {
        setIsBabyMonitorArmed(false);
      }
    };

    fetchBabyMonitorState();

    // Re-fetch when user navigates back to this page (e.g. from /baby-monitor)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchBabyMonitorState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Also re-fetch on window focus (covers SPA navigation back)
    window.addEventListener('focus', fetchBabyMonitorState);

    const channel = supabase
      .channel(`dashboard-baby-monitor-${activeDeviceId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'device_status',
        filter: `device_id=eq.${activeDeviceId}`,
      }, (payload) => {
        const s = payload.new as { is_armed: boolean; baby_monitor_enabled: boolean };
        console.log('[Dashboard] baby monitor realtime update:', s.is_armed, s.baby_monitor_enabled);
        setIsBabyMonitorArmed(s.is_armed && s.baby_monitor_enabled);
      })
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', fetchBabyMonitorState);
      supabase.removeChannel(channel);
    };
  }, [activeDeviceId]);

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      setUserProfile(JSON.parse(stored));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  // Create rtc_session for live view - MUST happen before START_LIVE_VIEW command
  const createRtcSession = async (): Promise<string | null> => {
    const profileId = userProfile?.id;
    const userId = profileId || `anon_${Date.now()}`;
    
    console.log('[LiveView] Creating rtc_session', { 
      selectedDeviceId: activeDeviceId, 
      profileId, 
      userId 
    });

    if (!activeDeviceId) {
      console.error('[LiveView] No device_id available');
      toast.error(language === 'he' ? 'לא נבחר מכשיר' : 'No device selected');
      return null;
    }
    
    const insertPayload = {
      device_id: activeDeviceId,
      viewer_id: userId,
      status: 'pending' as const,
    };

    console.log('[LiveView] rtc_sessions INSERT payload:', insertPayload);

    const { data: session, error: sessErr } = await supabase
      .from('rtc_sessions')
      .insert(insertPayload)
      .select()
      .single();

    console.log('[LiveView] rtc_sessions insert result', { session, sessErr });

    if (sessErr || !session) {
      console.error('[LiveView] Failed to create rtc_session:', sessErr);
      toast.error(
        language === 'he' 
          ? `שגיאה ביצירת session: ${sessErr?.message || 'Unknown error'}` 
          : `Error creating session: ${sessErr?.message || 'Unknown error'}`
      );
      return null;
    }

    console.log('[LiveView] rtc_session created successfully:', session.id);
    return session.id;
  };

  // Update rtc_session to ended
  const endRtcSession = async (sessionId: string) => {
    console.log('[LiveView] Ending rtc_session:', sessionId);
    
    const { error } = await supabase
      .from('rtc_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[LiveView] Error ending rtc_session:', error);
    }
  };

  // Handle command sending with proper status tracking
  const handleCommand = async (commandType: CommandType) => {
    console.log('[Dashboard] handleCommand:', commandType, { activeDeviceId, laptopStatus, isDevicesLoading });
    
    if (commandType === 'START_LIVE_VIEW') {
      // Validate device is selected
      if (!activeDeviceId) {
        toast.error(
          language === 'he'
            ? 'לא נבחר מכשיר. עבור להגדרות ובחר מצלמה.'
            : 'No device selected. Go to settings and select a camera.'
        );
        setViewStatus('idle');
        return;
      }

      // Prevent starting live view when the host computer is offline.
      // This avoids navigating to Viewer and getting stuck in a connect loop.
      if (laptopStatus !== 'online') {
        toast.error(
          language === 'he'
            ? 'המחשב לא מחובר כרגע. פתח את אפליקציית הדסקטופ ונסה שוב.'
            : 'Computer is offline. Open the desktop app and try again.'
        );
        setViewStatus('idle');
        return;
      }

      const profileId = userProfile?.id;
      console.log('[LiveView] Start clicked', { 
        selectedDeviceId: activeDeviceId, 
        profileId, 
        userId: profileId || 'anonymous' 
      });

      setViewStatus('starting');

      // CENTRALIZED SESSION PREPARATION (KILL → SET → cleanup stale sessions)
      // This single call replaces scattered flag resets and stale session cleanup.
      const prepared = await prepareLiveView(activeDeviceId);
      if (!prepared) {
        console.error('[LiveView] Session preparation failed');
        setViewStatus('idle');
        toast.error(language === 'he' ? 'שגיאה בהכנת הסשן' : 'Session preparation failed');
        return;
      }

      // 1. FIRST: Create rtc_session (MUST happen before command)
      const sessionId = await createRtcSession();
      
      if (!sessionId) {
        // Session creation failed - do NOT send command
        console.error('[LiveView] Aborting START_LIVE_VIEW - no session created');
        setViewStatus('idle');
        return;
      }
      
      setCurrentSessionId(sessionId);
      console.log('[LiveView] Session stored in state:', sessionId);

      // 2. Navigate to Viewer — the Viewer will send the START command itself.
      // Previously, Dashboard sent the command AFTER navigate(), but since Dashboard
      // unmounts on navigation, the command's ack tracking was lost. If the command
      // failed on Electron's side, the Viewer never knew and sat spinning forever.
      // FIX (v2.42.0): Viewer now owns the full START lifecycle.
      console.log('[LiveView] Navigating to Viewer with sessionId:', sessionId);
      navigate('/viewer', { state: { sessionId } });
    } else if (commandType === 'STOP_LIVE_VIEW') {
      console.log('[LiveView] Stop clicked', { currentSessionId });
      setViewStatus('stopping');

      // 1. Send STOP_LIVE_VIEW command
      const ok = await sendCommand(commandType);

      // 2. End the rtc_session
      if (currentSessionId) {
        await endRtcSession(currentSessionId);
        setCurrentSessionId(null);
      }

      if (!ok) {
        setViewStatus(liveViewActive ? 'streaming' : 'idle');
      }
    }

    // Bootstrap-safe: always re-fetch live view state after sending live view commands
    if (commandType === 'START_LIVE_VIEW' || commandType === 'STOP_LIVE_VIEW') {
      refreshState();
      window.setTimeout(() => refreshState(), 1500);
    }
  };

  // Get command status indicator
  const getStatusIndicator = () => {
    switch (commandState.status) {
      case 'sending':
        return (
          <div className="flex items-center gap-2 text-blue-400 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            {language === 'he' ? 'שולח...' : 'Sending...'}
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-amber-400 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            {language === 'he' ? 'ממתין לאישור...' : 'Waiting...'}
          </div>
        );
      case 'acknowledged':
        return (
          <div className="flex items-center gap-2 text-green-400 text-xs">
            <CheckCircle className="w-3 h-3" />
            {language === 'he' ? 'התקבל' : 'Acknowledged'}
          </div>
        );
      case 'failed':
      case 'timeout':
        return (
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <XCircle className="w-3 h-3" />
            {commandState.status === 'timeout' 
              ? (language === 'he' ? 'פג תוקף' : 'Timeout')
              : (language === 'he' ? 'נכשל' : 'Failed')}
          </div>
        );
      default:
        return null;
    }
  };

  if (!userProfile) {
    return null;
  }

  // Mobile Dashboard - Controller + Viewer Mode
  if (isMobileDevice) {
    return (
      <AppLayout>
        <DashboardHeader 
          userFullName={userProfile.fullName}
          subtitle={language === 'he' ? 'שלוט במצלמות וצפה בשידור חי' : 'Control cameras and watch live streams'}
          roleBadge={{
            label: language === 'he' ? 'שליטה + צפייה' : 'Controller + Viewer',
            variant: 'emerald'
          }}
        />

        <div className="p-4 space-y-4">
          {/* Mobile Viewer Info Card */}
          <div className="bg-gradient-to-br from-emerald-600/20 to-teal-800/20 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {language === 'he' ? 'מסך צפייה מרחוק' : 'Mobile Viewer Active'}
                </h3>
              </div>
            </div>
            <p className="text-white/70 text-sm mb-3">
              {language === 'he' 
                ? 'אתה כרגע על מכשיר נייד. השתמש במסך זה לצפות במצלמות הפעילות שלך. כדי להוסיף מצלמה חדשה, התחבר לדשבורד מהמחשב הנייד או הנייח שלך.'
                : 'You are currently on a mobile device. Use this screen to monitor your active cameras. To add a new camera, please log in to this dashboard from your Laptop or PC.'}
            </p>
          </div>

          {/* OFFLINE WARNING BANNER - Shows when computer is not connected */}
          {laptopStatus === 'offline' && !isLaptopStatusLoading && (
            <OfflineBanner />
          )}

          {/* Security Arm Toggle - Main Control - DISABLED when offline */}
          <SecurityArmToggle disabled={laptopStatus !== 'online'} onBabyMonitorActivated={() => navigate('/baby-monitor')} />

          {/* Away Mode Card - Only visible when feature flag is ON - DISABLED when offline */}
          {featureFlags.away_mode && (
            <MobileAwayModeCard disabled={laptopStatus !== 'online'} />
          )}

          {/* Security Mode Placeholder - Only visible when feature flag is ON */}
          {featureFlags.security_mode && (
            <SecurityModeComingSoon />
          )}

          {/* Connection Status with Command Feedback */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">
                {language === 'he' ? 'סטטוס מחשב' : 'Computer Status'}
              </span>
              <div className="flex items-center gap-3">
                {getStatusIndicator()}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    laptopStatus === 'online' ? 'bg-green-500 animate-pulse' : 
                    laptopStatus === 'offline' ? 'bg-yellow-500' : 'bg-slate-500'
                  }`} />
                  <span className={`text-xs ${
                    laptopStatus === 'online' ? 'text-green-400' : 
                    laptopStatus === 'offline' ? 'text-yellow-400' : 'text-slate-400'
                  }`}>
                    {language === 'he' 
                      ? (laptopStatus === 'online' ? 'מחובר' : laptopStatus === 'offline' ? 'לא מחובר' : 'לא ידוע')
                      : (laptopStatus === 'online' ? 'Connected' : laptopStatus === 'offline' ? 'Disconnected' : 'Unknown')}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Error Message Display */}
            {commandState.error && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-xs">{commandState.error}</p>
                </div>
              </div>
            )}
          </div>


          {/* Baby Monitor Viewer Card - shown when baby monitor is armed */}
          {isBabyMonitorArmed && (
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <Baby className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    {language === 'he' ? 'ניטור תינוק' : 'Baby Monitor'}
                  </h3>
                  <p className="text-white/60 text-sm">
                    {language === 'he' ? 'מיקרופון פעיל • מצלמה ידנית' : 'Mic active • Manual camera'}
                  </p>
                </div>
                <div className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
                  {language === 'he' ? 'פעיל' : 'Active'}
                </div>
              </div>
              <Button
                onClick={() => navigate('/baby-monitor')}
                disabled={laptopStatus !== 'online'}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                <Baby className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'צפה בתינוק 👶' : 'Watch Baby 👶'}
              </Button>
            </div>
          )}

          {/* Manual Live View Control Card - HIDDEN when baby monitor is armed */}
          {!isBabyMonitorArmed && (
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                liveViewActive 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                  : 'bg-slate-700/50'
              }`}>
                <Video className={`w-6 h-6 ${liveViewActive ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {language === 'he' ? 'צפייה חיה' : 'Live View'}
                </h3>
                <p className="text-white/60 text-sm">
                  {language === 'he' ? 'צפייה ידנית • ללא התראות' : 'Manual viewing • No alerts'}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs ${
                liveViewActive ? 'bg-green-500/20 text-green-400' :
                viewStatus === 'starting' || viewStatus === 'stopping' ? 'bg-blue-500/20 text-blue-400' :
                'bg-slate-600/50 text-slate-400'
              }`}>
                {language === 'he' 
                  ? (liveViewActive ? 'משדר' : 
                     viewStatus === 'starting' ? 'מתחיל...' : 
                     viewStatus === 'stopping' ? 'עוצר...' : 'כבוי')
                  : (liveViewActive ? 'Streaming' : 
                     viewStatus === 'starting' ? 'Starting...' : 
                     viewStatus === 'stopping' ? 'Stopping...' : 'Off')}
              </div>
            </div>


            <div className="grid grid-cols-2 gap-3 mb-3">
              <Button 
                onClick={() => handleCommand('START_LIVE_VIEW')}
                disabled={
                  (isLoading && commandState.commandType?.includes('LIVE')) ||
                  isLiveViewLoading ||
                  liveViewActive ||
                  isLaptopStatusLoading ||
                  (laptopStatus !== 'online' && !isLaptopStatusLoading)
                }
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {viewStatus === 'starting' ? (
                  <Loader2 className={`w-4 h-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                ) : (
                  <Eye className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                )}
                {language === 'he' ? 'התחל' : 'Start'}
              </Button>
              <Button 
                onClick={() => handleCommand('STOP_LIVE_VIEW')}
                disabled={(isLoading && commandState.commandType?.includes('LIVE')) || isLiveViewLoading || !liveViewActive}
                variant="outline"
                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              >
                {viewStatus === 'stopping' ? (
                  <Loader2 className={`w-4 h-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                ) : (
                  <EyeOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                )}
                {language === 'he' ? 'הפסק' : 'Stop'}
              </Button>
            </div>

          </div>
          )}

          {/* Recent Events Card */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">
                {language === 'he' ? 'אירועים אחרונים' : 'Recent Events'}
              </h3>
              <Bell className="w-4 h-4 text-white/40" />
            </div>
            <div className="text-center py-6">
              <Clock className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-white/40 text-sm">
                {language === 'he' ? 'אין אירועים אחרונים' : 'No recent events'}
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Desktop Dashboard - Read-Only Status View
  return (
    <AppLayout>
      <DashboardHeader 
        userFullName={userProfile.fullName}
        subtitle={language === 'he' ? 'לוח בקרה - תחנת מצלמה' : 'Dashboard - Camera Station'}
      />

      <div className="p-6">
        {/* Download Agent Card - Only for desktop browsers (not Electron) */}
        {!capabilities.isElectron && (
          <div className="bg-gradient-to-br from-cyan-600/20 to-blue-800/20 border border-cyan-500/30 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Download className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {language === 'he' ? 'הפוך את המחשב הזה למצלמת אבטחה' : 'Turn this computer into a security camera'}
                </h3>
                <p className="text-white/60 text-sm">
                  {language === 'he'
                    ? 'הורד והתקן את ה-Camera Agent על מחשב זה. לאחר הפתיחה, התחבר עם החשבון שלך כדי לקשר אותו.'
                    : 'Download and install our Camera Agent on this computer. Once opened, log in with your account to link it.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {(typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)) ? (
                <a href="https://github.com/ioranr1/cozy-project/releases/latest/download/Security-Camera-Agent-Setup.exe" download>
                  <Button size="lg" className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-cyan-500/30 font-semibold border-0 gap-2">
                    <Monitor className="w-5 h-5" />
                    {language === 'he' ? 'הורד ל-Windows' : 'Download for Windows'}
                  </Button>
                </a>
              ) : (typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)) ? (
                <a href="https://github.com/ioranr1/cozy-project/releases/latest/download/Security-Camera-Agent.dmg" download>
                  <Button size="lg" className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-cyan-500/30 font-semibold border-0 gap-2">
                    <Monitor className="w-5 h-5" />
                    {language === 'he' ? 'הורד ל-Mac' : 'Download for Mac'}
                  </Button>
                </a>
              ) : (
                <>
                  <a href="https://github.com/ioranr1/cozy-project/releases/latest/download/Security-Camera-Agent-Setup.exe" download>
                    <Button size="lg" className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-cyan-500/30 font-semibold border-0 gap-2">
                      <Monitor className="w-5 h-5" />
                      {language === 'he' ? 'הורד ל-Windows' : 'Download for Windows'}
                    </Button>
                  </a>
                  <a href="https://github.com/ioranr1/cozy-project/releases/latest/download/Security-Camera-Agent.dmg" download>
                    <Button size="lg" className="bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-cyan-500/30 font-semibold border-0 gap-2">
                      <Monitor className="w-5 h-5" />
                      {language === 'he' ? 'הורד ל-Mac' : 'Download for Mac'}
                    </Button>
                  </a>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Status Cards */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* This Device Card */}
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <Laptop className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {language === 'he' ? 'מכשיר זה' : 'This Device'}
                    </h3>
                    <p className="text-white/60 text-sm">
                      {language === 'he' ? 'תחנת מצלמה ראשית' : 'Primary Camera Station'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${laptopStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                  <span className={`text-sm ${laptopStatus === 'online' ? 'text-green-400' : 'text-slate-400'}`}>
                    {language === 'he' 
                      ? (laptopStatus === 'online' ? 'פעיל' : 'לא פעיל')
                      : (laptopStatus === 'online' ? 'Active' : 'Inactive')}
                  </span>
                </div>
              </div>

              {/* Status Grid - Read Only */}
              <div className="grid grid-cols-1 gap-4">
                {/* Live View Status */}
                <div className={`p-4 rounded-xl border ${
                  liveViewActive 
                    ? 'bg-blue-500/10 border-blue-500/30' 
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <Video className={`w-5 h-5 ${liveViewActive ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className="text-white font-medium text-sm">
                      {language === 'he' ? 'צפייה חיה' : 'Live View'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${liveViewActive ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-600/50 text-slate-300'}`}>
                      {language === 'he' 
                        ? (liveViewActive ? 'פעיל' : 'כבוי')
                        : (liveViewActive ? 'Active' : 'Off')}
                    </span>
                    <span className="text-white/40 text-xs">
                      {language === 'he' ? 'קריאה בלבד' : 'Read-only'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Away Mode Card - Only visible when feature flag is ON */}
            {featureFlags.away_mode && (
              <AwayModeCard />
            )}

            {/* Security Mode Placeholder - Only visible when feature flag is ON */}
            {featureFlags.security_mode && (
              <SecurityModeComingSoon />
            )}


            {/* Advanced Settings */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {language === 'he' ? 'הגדרות מתקדמות' : 'Advanced Settings'}
              </h3>
              
              <div className="space-y-4">
                <FeatureGate requires={['canBackgroundRun']} mode="hide">
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                    <div>
                      <p className="text-white font-medium">
                        {language === 'he' ? 'מצב רקע' : 'Background Mode'}
                      </p>
                      <p className="text-white/50 text-xs">
                        {language === 'he' ? 'המשך הקלטה כשהחלון ממוזער' : 'Keep recording when minimized'}
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                </FeatureGate>

                <FeatureGate requires={['canRecordSegments']} mode="hide">
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                    <div>
                      <p className="text-white font-medium">
                        {language === 'he' ? 'הקלט באירוע' : 'Record on Alert'}
                      </p>
                      <p className="text-white/50 text-xs">
                        {language === 'he' ? 'שמור קליפים לדיסק המקומי' : 'Save clips to local disk'}
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                </FeatureGate>

                <FeatureGate requires={['isElectron']} mode="hide">
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                    <div>
                      <p className="text-white font-medium">
                        {language === 'he' ? 'הפעלה אוטומטית' : 'Auto-start on Launch'}
                      </p>
                      <p className="text-white/50 text-xs">
                        {language === 'he' ? 'התחל זיהוי תנועה עם הפעלת המערכת' : 'Start motion detection when system boots'}
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                </FeatureGate>

                {!capabilities.isElectron && (
                  <div className="text-center py-4 text-white/40 text-sm">
                    {language === 'he' 
                      ? 'הגדרות מתקדמות זמינות באפליקציית Desktop בלבד'
                      : 'Advanced settings available in Desktop app only'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Status & Events */}
          <div className="space-y-6">
            
            {/* System Status */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-white/60" />
                <h3 className="text-lg font-semibold text-white">
                  {language === 'he' ? 'סטטוס מערכת' : 'System Status'}
                </h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">
                    {language === 'he' ? 'חיבור לשרת' : 'Server Connection'}
                  </span>
                  <span className="text-green-400 text-sm">
                    {language === 'he' ? 'מחובר' : 'Connected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">
                    {language === 'he' ? 'שירות TURN' : 'TURN Service'}
                  </span>
                  <span className="text-green-400 text-sm">
                    {language === 'he' ? 'זמין' : 'Available'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">
                    {language === 'he' ? 'פלטפורמה' : 'Platform'}
                  </span>
                  <span className="text-white/80 text-sm capitalize">
                    {capabilities.platform}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Events */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-white/60" />
                  <h3 className="text-lg font-semibold text-white">
                    {language === 'he' ? 'אירועים אחרונים' : 'Recent Events'}
                  </h3>
                </div>
                <Link to="/events" className="text-primary text-sm hover:underline">
                  {language === 'he' ? 'הכל' : 'All'}
                </Link>
              </div>
              
              <div className="text-center py-8">
                <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">
                  {language === 'he' ? 'אין אירועים אחרונים' : 'No recent events'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;