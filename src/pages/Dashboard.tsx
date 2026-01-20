import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Laptop, Smartphone, Video, Radar, Activity, Bell, Clock, Eye, EyeOff, Power, PowerOff, Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw, Monitor } from 'lucide-react';
import { useIsMobileDevice } from '@/hooks/use-platform';
import { useCapabilities } from '@/hooks/useCapabilities';
import { FeatureGate } from '@/components/FeatureGate';
import { supabase } from '@/integrations/supabase/client';
import { laptopDeviceId } from '@/config/devices';
import { Switch } from '@/components/ui/switch';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { useRemoteCommand, CommandType } from '@/hooks/useRemoteCommand';
import { useLiveViewState } from '@/hooks/useLiveViewState';
import { toast } from 'sonner';

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
  const [motionDetectionActive, setMotionDetectionActive] = useState(false);
  const [viewStatus, setViewStatus] = useState<ViewStatus>('idle');
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const isMobileDevice = useIsMobileDevice();
  const capabilities = useCapabilities();

  // Live view state from Supabase (source of truth)
  const { liveViewActive, lastAckedCommand, isLoading: isLiveViewLoading, refreshState } = useLiveViewState({ 
    deviceId: laptopDeviceId 
  });

  // Sync viewStatus with liveViewActive from Supabase
  useEffect(() => {
    // Always sync viewStatus when liveViewActive changes (after initial load)
    if (!isLiveViewLoading) {
      console.log('[Dashboard] Syncing viewStatus from liveViewActive:', liveViewActive);
      setViewStatus(liveViewActive ? 'streaming' : 'idle');
    }
  }, [liveViewActive, isLiveViewLoading]);

  // Remote command hook
  const { sendCommand, commandState, isLoading, resetState } = useRemoteCommand({
    deviceId: laptopDeviceId,
    onAcknowledged: (commandType) => {
      if (commandType === 'START_MOTION_DETECTION') {
        setMotionDetectionActive(true);
      } else if (commandType === 'STOP_MOTION_DETECTION') {
        setMotionDetectionActive(false);
      }
      // Live view state is now managed by useLiveViewState hook
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

  // Check laptop connection status
  useEffect(() => {
    const checkLaptopStatus = async () => {
      if (!laptopDeviceId) {
        setLaptopStatus('unknown');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('devices')
          .select('last_seen_at, is_active')
          .eq('id', laptopDeviceId)
          .maybeSingle();

        if (error || !data) {
          setLaptopStatus('unknown');
          return;
        }

        if (data.last_seen_at) {
          const lastSeen = new Date(data.last_seen_at);
          const now = new Date();
          const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
          
          if (diffSeconds <= 30 && data.is_active) {
            setLaptopStatus('online');
          } else {
            setLaptopStatus('offline');
          }
        } else {
          setLaptopStatus('offline');
        }
      } catch {
        setLaptopStatus('unknown');
      }
    };

    checkLaptopStatus();
    const interval = setInterval(checkLaptopStatus, 10000);
    return () => clearInterval(interval);
  }, []);

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
      selectedDeviceId: laptopDeviceId, 
      profileId, 
      userId 
    });

    if (!laptopDeviceId) {
      console.error('[LiveView] No device_id available');
      toast.error(language === 'he' ? 'לא נבחר מכשיר' : 'No device selected');
      return null;
    }
    
    const insertPayload = {
      device_id: laptopDeviceId,
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
    if (commandType === 'START_LIVE_VIEW') {
      const profileId = userProfile?.id;
      console.log('[LiveView] Start clicked', { 
        selectedDeviceId: laptopDeviceId, 
        profileId, 
        userId: profileId || 'anonymous' 
      });

      setViewStatus('starting');

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

      // 2. ONLY if session succeeded: send START_LIVE_VIEW command
      console.log('[LiveView] inserting START_LIVE_VIEW', { sessionId });
      const ok = await sendCommand(commandType);
      
      if (!ok) {
        // Command failed - cleanup session
        console.error('[LiveView] START_LIVE_VIEW command failed, cleaning up session');
        await endRtcSession(sessionId);
        setCurrentSessionId(null);
        setViewStatus('idle');
        return;
      }
      
      console.log('[LiveView] START_LIVE_VIEW command sent successfully');
      
      // 3. Navigate to Viewer with the sessionId so it can listen to RTC signals
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
    } else {
      // Motion detection commands - no rtc_session needed
      await sendCommand(commandType);
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

          {/* Motion Detection Control Card */}
          <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border border-amber-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                motionDetectionActive 
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600' 
                  : 'bg-slate-700/50'
              }`}>
                <Radar className={`w-6 h-6 ${motionDetectionActive ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {language === 'he' ? 'זיהוי תנועה' : 'Motion Detection'}
                </h3>
                <p className="text-white/60 text-sm">
                  {language === 'he' ? 'התראות ואירועים • ללא וידאו חי' : 'Alerts & events • No live video'}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs ${
                motionDetectionActive 
                  ? 'bg-amber-500/20 text-amber-400' 
                  : 'bg-slate-600/50 text-slate-400'
              }`}>
                {language === 'he' 
                  ? (motionDetectionActive ? 'פעיל' : 'כבוי')
                  : (motionDetectionActive ? 'Active' : 'Off')}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={() => handleCommand('START_MOTION_DETECTION')}
                disabled={(isLoading && commandState.commandType?.includes('MOTION')) || motionDetectionActive}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
              >
                {isLoading && commandState.commandType === 'START_MOTION_DETECTION' ? (
                  <Loader2 className={`w-4 h-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                ) : (
                  <Power className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                )}
                {language === 'he' ? 'הפעל' : 'Enable'}
              </Button>
              <Button 
                onClick={() => handleCommand('STOP_MOTION_DETECTION')}
                disabled={(isLoading && commandState.commandType?.includes('MOTION')) || !motionDetectionActive}
                variant="outline"
                className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                {isLoading && commandState.commandType === 'STOP_MOTION_DETECTION' ? (
                  <Loader2 className={`w-4 h-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />
                ) : (
                  <PowerOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                )}
                {language === 'he' ? 'כבה' : 'Disable'}
              </Button>
            </div>
          </div>

          {/* Manual Live View Control Card */}
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
                disabled={(isLoading && commandState.commandType?.includes('LIVE')) || isLiveViewLoading || liveViewActive}
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

            {/* Debug: Session ID Display */}
            <div className="mt-2 p-2 bg-slate-800/80 border border-slate-600/50 rounded-lg text-center">
              <span className="text-xs font-mono text-cyan-400">
                sessionId: {currentSessionId || 'none'}
              </span>
            </div>

            {/* View Stream Link - Always visible with status indicator */}
            <Link 
              to="/viewer" 
              state={{ sessionId: currentSessionId }}
              className="block mt-3"
            >
              <Button 
                className={`w-full ${liveViewActive ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-600 hover:bg-slate-500'}`}
              >
                <div className="relative">
                  <Monitor className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  <div className={`absolute -top-1 ${isRTL ? '-left-1' : '-right-1'} w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                    liveViewActive ? 'bg-green-400 animate-pulse' : 'bg-red-500'
                  }`} />
                </div>
                {language === 'he' ? 'צפייה' : 'Watch'}
              </Button>
            </Link>
          </div>

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
              <div className="grid grid-cols-2 gap-4">
                {/* Motion Detection Status */}
                <div className={`p-4 rounded-xl border ${
                  motionDetectionActive 
                    ? 'bg-amber-500/10 border-amber-500/30' 
                    : 'bg-slate-700/30 border-slate-600/30'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <Radar className={`w-5 h-5 ${motionDetectionActive ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-white font-medium text-sm">
                      {language === 'he' ? 'זיהוי תנועה' : 'Motion Detection'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${motionDetectionActive ? 'text-amber-400' : 'text-slate-500'}`}>
                      {language === 'he' 
                        ? (motionDetectionActive ? 'פעיל' : 'כבוי')
                        : (motionDetectionActive ? 'Active' : 'Off')}
                    </span>
                    <span className="text-white/40 text-xs">
                      {language === 'he' ? 'קריאה בלבד' : 'Read-only'}
                    </span>
                  </div>
                </div>

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
                    <span className={`text-xs ${liveViewActive ? 'text-blue-400' : 'text-slate-500'}`}>
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

              {/* Link to Controls */}
              <div className="mt-4 pt-4 border-t border-slate-600/30">
                <Link to="/motion-detection">
                  <Button variant="secondary" size="sm" className="w-full">
                    {language === 'he' ? 'נהל מצבי פעולה' : 'Manage Operation Modes'}
                  </Button>
                </Link>
              </div>
            </div>

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