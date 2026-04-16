import React, { useEffect, useState, useCallback, useMemo, forwardRef } from 'react';
import { Home, HomeIcon, Loader2, Plug, Monitor, AlertCircle, CheckCircle, WifiOff, Moon, AlertTriangle, Camera, CameraOff } from 'lucide-react';
import { SensorStatusIndicator } from '@/components/SensorStatusIndicator';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEVICE_ONLINE_THRESHOLD_SECONDS, parseDbTimestamp, useDevices } from '@/hooks/useDevices';
import { useRemoteCommand } from '@/hooks/useRemoteCommand';

type DeviceMode = 'NORMAL' | 'AWAY';
type DeviceConnectionStatus = 'online' | 'offline' | 'sleeping' | 'unknown';

export interface MobileAwayModeCardProps {
  className?: string;
  disabled?: boolean;
}

// Analytics/logging helper
const logAwayModeEvent = (event: string, data?: Record<string, unknown>) => {
  console.log(`[MobileAwayMode:Analytics] ${event}`, data || {});
  // Future: Send to analytics service
};

// Use forwardRef to avoid React warnings when this component receives a ref
export const MobileAwayModeCard = forwardRef<HTMLDivElement, MobileAwayModeCardProps>(({ className, disabled = false }, ref) => {
  const { language } = useLanguage();
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('NORMAL');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMode, setPendingMode] = useState<DeviceMode | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<DeviceConnectionStatus>('unknown');
  
  // Security monitoring status - camera/sensors active state
  const [securityStatus, setSecurityStatus] = useState<{
    security_enabled: boolean;
    motion_enabled: boolean;
    sound_enabled: boolean;
    baby_monitor_enabled: boolean;
  }>({ security_enabled: false, motion_enabled: false, sound_enabled: false, baby_monitor_enabled: false });

  // Comprehensive i18n translations
  const t = useMemo(() => ({
    title: language === 'he' ? 'מצב Away' : 'Away Mode',
    description: language === 'he' 
      ? 'השאר את המחשב דלוק מרחוק' 
      : 'Keep your computer running remotely',
    requirementPower: language === 'he' 
      ? 'חייב להיות מחובר לחשמל' 
      : 'Must be plugged into power',
    requirementLid: language === 'he' 
      ? 'השאר את המכסה פתוח' 
      : 'Keep the lid open',
    // Status labels
    statusNormal: language === 'he' ? 'כבוי' : 'Off',
    statusAwayActive: language === 'he' ? 'Away פעיל' : 'Away Active',
    statusOffline: language === 'he' ? 'לא מחובר' : 'Offline',
    statusSleeping: language === 'he' ? 'במצב שינה' : 'Sleeping',
    statusPending: language === 'he' ? 'ממתין...' : 'Pending...',
    // Messages
    activeMessage: language === 'he' 
      ? 'מצב Away פעיל - המחשב ער' 
      : 'Away mode active - Computer awake',
    noDevice: language === 'he' ? 'לא נבחר מכשיר' : 'No device selected',
    sendingCommand: language === 'he' ? 'שולח פקודה...' : 'Sending command...',
    waitingAck: language === 'he' ? 'ממתין לאישור...' : 'Waiting for ACK...',
    commandSuccess: language === 'he' ? 'הפקודה התקבלה' : 'Command acknowledged',
    commandFailed: language === 'he' ? 'הפקודה נכשלה' : 'Command failed',
    // Detailed error messages
    preflightFailed: language === 'he' 
      ? 'המחשב לא עמד בדרישות (חשמל/מצלמה)' 
      : 'Computer failed preflight checks (power/camera)',
    errorPowerRequired: language === 'he' 
      ? 'נדרש חיבור לחשמל - חבר את המחשב לחשמל' 
      : 'Power required - plug in the computer',
    errorCameraNotAvailable: language === 'he' 
      ? 'המצלמה לא זמינה - בדוק את החיבור' 
      : 'Camera not available - check connection',
    errorDeviceOffline: language === 'he' 
      ? 'המחשב לא מחובר - פתח את האפליקציה במחשב' 
      : 'Computer offline - open the app on your computer',
    errorDeviceSleeping: language === 'he' 
      ? 'המחשב במצב שינה - הער אותו במחשב ואז הפעל מצב Away' 
      : 'Computer is sleeping - wake it up on the computer, then activate Away Mode',
    errorTimeout: language === 'he' 
      ? 'לא התקבלה תשובה - ודא שהמחשב מחובר' 
      : 'No response - ensure computer is connected',
    // Display off message (non-blocking)
    displayOffNote: language === 'he' 
      ? 'המסך יכבה אוטומטית (אם נתמך)' 
      : 'Display will turn off automatically (if supported)',
    // CRITICAL: Security not monitored warning
    securityNotMonitored: language === 'he' 
      ? '⚠️ המערכת לא מנוטרת! המחשב לא מחובר' 
      : '⚠️ System NOT monitored! Computer disconnected',
    securityNotMonitoredSleeping: language === 'he' 
      ? '⚠️ המערכת לא מנוטרת! המחשב במצב שינה' 
      : '⚠️ System NOT monitored! Computer sleeping',
    // Camera/Security active indicator
    cameraActive: language === 'he' 
      ? '📷 מצלמה פעילה ומנטרת' 
      : '📷 Camera active & monitoring',
    cameraInactive: language === 'he' 
      ? '🔴 מצלמה כבויה' 
      : '🔴 Camera inactive',
    securityArmed: language === 'he' 
      ? '🛡️ מערכת אבטחה מופעלת' 
      : '🛡️ Security system armed',
  }), [language]);

  // Get profile ID and selected device dynamically
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

  const { selectedDevice } = useDevices(profileId);
  const deviceId = selectedDevice?.id || null;

  // Check device connection status - updates locally, Realtime handles live sync
  const updateConnectionStatus = useCallback((data: { last_seen_at: string | null; is_active: boolean } | null) => {
    if (!data) {
      setConnectionStatus('unknown');
      return;
    }

    // If is_active is false, device is offline immediately
    if (!data.is_active) {
      console.log('[MobileAwayMode] Device is_active=false, setting offline');
      setConnectionStatus('offline');
      return;
    }

    const lastSeen = parseDbTimestamp(data.last_seen_at);
    if (!lastSeen) {
      setConnectionStatus('offline');
      return;
    }

    const now = new Date();
    const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

    // Grace period of 30s to absorb clock drift between phone and server
    const GRACE_SECONDS = 30;
    if (diffSeconds <= DEVICE_ONLINE_THRESHOLD_SECONDS + GRACE_SECONDS) {
      setConnectionStatus('online');
    } else if (diffSeconds <= 300 + GRACE_SECONDS) {
      setConnectionStatus('sleeping');
    } else {
      setConnectionStatus('offline');
    }
  }, []);

  const checkConnectionStatus = useCallback(async () => {
    if (!deviceId) {
      setConnectionStatus('unknown');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('devices')
        .select('last_seen_at, is_active')
        .eq('id', deviceId)
        .maybeSingle();

      if (error || !data) {
        setConnectionStatus('unknown');
        return;
      }

      updateConnectionStatus(data);
    } catch {
      setConnectionStatus('unknown');
    }
  }, [deviceId, updateConnectionStatus]);

  // Parse error message to provide better guidance
  const parseErrorMessage = useCallback((error: string | null): string => {
    if (!error) return t.commandFailed;
    
    const lowerError = error.toLowerCase();
    
    if (lowerError.includes('power') || lowerError.includes('battery')) {
      return t.errorPowerRequired;
    }
    if (lowerError.includes('camera')) {
      return t.errorCameraNotAvailable;
    }
    if (lowerError.includes('preflight')) {
      return t.preflightFailed;
    }
    if (lowerError.includes('timeout') || lowerError.includes('no response')) {
      return t.errorTimeout;
    }
    
    return error;
  }, [t]);

  // Remote command hook for sending SET_DEVICE_MODE
  const { sendCommand, commandState, isLoading: isCommandLoading, resetState } = useRemoteCommand({
    deviceId,
    onAcknowledged: (cmdType) => {
      if (cmdType === 'SET_DEVICE_MODE') {
        console.log('[MobileAwayMode] Command acknowledged, pending mode:', pendingMode);
        
        logAwayModeEvent('mode_change_succeeded', {
          to: pendingMode,
          deviceId,
          source: 'MOBILE',
        });
        
        // CRITICAL: Adopt the pending mode immediately after acknowledgment
        // This prevents the toggle from flickering back to the old state
        if (pendingMode) {
          setDeviceMode(pendingMode);
        }
        
        setPendingMode(null);
      }
    },
    onFailed: (cmdType, error) => {
      if (cmdType === 'SET_DEVICE_MODE') {
        console.log('[MobileAwayMode] Command failed:', error);
        
        logAwayModeEvent('mode_change_failed', {
          to: pendingMode,
          error,
          deviceId,
        });
        
        setPendingMode(null);
        
        // Show specific error message
        const parsedError = parseErrorMessage(error);
        toast.error(parsedError);
      }
    },
    timeoutMs: 15000,
  });

  // Fetch initial status
  const fetchStatus = useCallback(async () => {
    if (!deviceId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('device_status')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error) {
        console.error('[MobileAwayMode] Error fetching status:', error);
        return;
      }

      if (data) {
        const status = data as any;
        setDeviceMode(status.device_mode || 'NORMAL');
        
        // Update security/camera status
        setSecurityStatus({
          security_enabled: status.security_enabled ?? false,
          motion_enabled: status.motion_enabled ?? false,
          sound_enabled: status.sound_enabled ?? false,
          baby_monitor_enabled: status.baby_monitor_enabled ?? false,
        });
        
        console.log('[MobileAwayMode] Security status:', {
          security_enabled: status.security_enabled,
          motion_enabled: status.motion_enabled,
          sound_enabled: status.sound_enabled,
        });
      }
    } catch (err) {
      console.error('[MobileAwayMode] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  // Subscribe to realtime changes - this is the SSOT
  useEffect(() => {
    if (!deviceId) return;

    fetchStatus();
    checkConnectionStatus();

    // Realtime subscription for device_status changes - CRITICAL for instant Away Mode sync
    const statusChannelName = `mobile_away_mode_status_${deviceId}`;
    console.log('[MobileAwayMode] Setting up Realtime subscription for device_status:', statusChannelName);
    
    const statusChannel = supabase
      .channel(statusChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_status',
          filter: `device_id=eq.${deviceId}`
        },
        (payload) => {
          console.log('[MobileAwayMode] 🔔 Realtime device_status update:', payload.new);
          const newStatus = payload.new as any;
          const newMode = newStatus.device_mode || 'NORMAL';
          
          console.log('[MobileAwayMode] Setting deviceMode from Realtime:', newMode);
          setDeviceMode(newMode);
          
          // CRITICAL: Update security/camera status from Realtime
          setSecurityStatus({
            security_enabled: newStatus.security_enabled ?? false,
            motion_enabled: newStatus.motion_enabled ?? false,
            sound_enabled: newStatus.sound_enabled ?? false,
            baby_monitor_enabled: newStatus.baby_monitor_enabled ?? false,
          });
          
          console.log('[MobileAwayMode] 📷 Camera status from Realtime:', {
            security_enabled: newStatus.security_enabled,
            motion_enabled: newStatus.motion_enabled,
          });
          
          if (pendingMode && newMode === pendingMode) {
            console.log('[MobileAwayMode] Pending mode matched, clearing pending state');
            setPendingMode(null);
            resetState();
          }
        }
      )
      .subscribe((status) => {
        console.log('[MobileAwayMode] device_status subscription status:', status);
      });

    // Realtime subscription for devices table - CRITICAL for immediate offline detection
    const devicesChannelName = `mobile_away_mode_devices_${deviceId}`;
    console.log('[MobileAwayMode] Setting up Realtime subscription for devices:', devicesChannelName);
    
    const devicesChannel = supabase
      .channel(devicesChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `id=eq.${deviceId}`
        },
        (payload) => {
          console.log('[MobileAwayMode] 🔔 Realtime devices update:', payload.new);
          const updated = payload.new as { last_seen_at: string | null; is_active: boolean };
          updateConnectionStatus(updated);
        }
      )
      .subscribe((status) => {
        console.log('[MobileAwayMode] devices subscription status:', status);
      });

    // Fallback: poll connection status every 30 seconds (reduced from 10s)
    const connectionInterval = setInterval(checkConnectionStatus, 30000);
    
    // CRITICAL FIX: Also poll device_status as fallback if Realtime fails
    const statusInterval = setInterval(fetchStatus, 15000);

    return () => {
      clearInterval(connectionInterval);
      clearInterval(statusInterval);
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(devicesChannel);
    };
  }, [fetchStatus, checkConnectionStatus, updateConnectionStatus, deviceId, pendingMode, resetState]);

  // Handle toggle - send remote command with analytics
  const handleToggle = async (checked: boolean) => {
    if (!deviceId) {
      toast.error(t.noDevice);
      return;
    }

    // CRITICAL: Block toggle when explicitly disabled (parent knows computer is offline)
    if (disabled) {
      toast.error(t.errorDeviceOffline);
      return;
    }

    // CRITICAL: Block toggle when computer is not connected or sleeping
    // This prevents the LOOP bug where user activates AWAY while computer is sleeping,
    // causing repeated screen on/off cycles when user returns
    if (connectionStatus === 'offline') {
      toast.error(t.errorDeviceOffline);
      return;
    }

    if (connectionStatus === 'sleeping') {
      toast.error(t.errorDeviceSleeping);
      return; // BLOCK - do not allow AWAY activation when sleeping!
    }

    const newMode: DeviceMode = checked ? 'AWAY' : 'NORMAL';
    setPendingMode(newMode);

    logAwayModeEvent('mode_change_requested', {
      from: deviceMode,
      to: newMode,
      deviceId,
      source: 'MOBILE',
    });

    console.log('[MobileAwayMode] Sending SET_DEVICE_MODE command:', newMode);

    const success = await sendCommand('SET_DEVICE_MODE', { mode: newMode });
    
    if (!success) {
      console.log('[MobileAwayMode] Command send failed immediately');
      setPendingMode(null);
    }
  };

  // SSOT: device_mode from DB determines AWAY state, NOT connection status
  const isDeviceReachable = connectionStatus === 'online';
  const isAway = deviceMode === 'AWAY';
  const isAwayButUnreachable = isAway && !isDeviceReachable;
  const isPending = pendingMode !== null || isCommandLoading;
  const showError = commandState.status === 'failed' || commandState.status === 'timeout';

  // Get status label - must be defined before any conditional returns
  const getStatusLabel = () => {
    if (isPending) return t.statusPending;
    if (isAwayButUnreachable && connectionStatus === 'sleeping') {
      return language === 'he' ? 'Away פעיל • שינה' : 'Away Active • Sleeping';
    }
    if (isAwayButUnreachable && connectionStatus === 'offline') {
      return language === 'he' ? 'Away פעיל • לא זמין' : 'Away Active • Unavailable';
    }
    if (connectionStatus === 'offline' && !isAway) return t.statusOffline;
    if (connectionStatus === 'sleeping' && !isAway) return t.statusSleeping;
    if (isAway && isDeviceReachable) return t.statusAwayActive;
    return t.statusNormal;
  };

  // Get status color - must be defined before any conditional returns
  const getStatusColor = () => {
    if (isPending) return 'text-blue-400';
    if (isAwayButUnreachable) return 'text-orange-400';
    if (connectionStatus === 'offline' && !isAway) return 'text-red-400';
    if (connectionStatus === 'sleeping' && !isAway) return 'text-yellow-400';
    if (isAway) return 'text-amber-400';
    return 'text-slate-500';
  };

  // Loading state - AFTER all function definitions
  if (isLoading) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 ${className}`}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br ${
      isAway 
        ? isAwayButUnreachable
          ? 'from-orange-600/20 to-amber-800/20 border-orange-500/30'
          : 'from-amber-600/20 to-orange-800/20 border-amber-500/30' 
        : connectionStatus === 'offline'
          ? 'from-red-900/20 to-slate-800/20 border-red-500/30'
          : connectionStatus === 'sleeping'
            ? 'from-yellow-900/20 to-slate-800/20 border-yellow-500/30'
            : 'from-slate-700/20 to-slate-800/20 border-slate-600/30'
    } border rounded-2xl p-5 transition-all duration-300 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isAway 
            ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30' 
            : connectionStatus === 'offline'
              ? 'bg-red-900/50'
              : connectionStatus === 'sleeping'
                ? 'bg-yellow-900/50'
                : 'bg-slate-700/50'
        }`}>
          {isPending ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : isAway ? (
            <Home className="w-6 h-6 text-white" />
          ) : connectionStatus === 'offline' ? (
            <WifiOff className="w-6 h-6 text-red-400" />
          ) : connectionStatus === 'sleeping' ? (
            <Moon className="w-6 h-6 text-yellow-400" />
          ) : (
            <HomeIcon className="w-6 h-6 text-slate-400" />
          )}
        </div>

        <div className="flex-1">
          <h3 className="text-base font-semibold text-white">
            {t.title}
          </h3>
          <p className="text-white/60 text-xs">
            {t.description}
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="flex flex-col items-center gap-1">
          <Switch
            checked={pendingMode ? pendingMode === 'AWAY' : isAway}
            onCheckedChange={handleToggle}
            disabled={disabled || isPending || connectionStatus === 'offline' || connectionStatus === 'sleeping'}
            className={isAway || pendingMode === 'AWAY' ? 'data-[state=checked]:bg-amber-500' : ''}
          />
          <span className={`text-xs ${getStatusColor()}`}>
            {getStatusLabel()}
          </span>
        </div>
      </div>

      {/* Requirements - compact for mobile */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1.5 text-white/60">
          <Plug className="w-3.5 h-3.5 text-amber-500/70" />
          <span>{t.requirementPower}</span>
        </div>
        <div className="flex items-center gap-1.5 text-white/60">
          <Monitor className="w-3.5 h-3.5 text-amber-500/70" />
          <span>{t.requirementLid}</span>
        </div>
      </div>

      {/* Status indicators */}
      {isPending && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          <span className="text-blue-400 text-xs">
            {commandState.status === 'sending' ? t.sendingCommand : 
             commandState.status === 'pending' ? t.waitingAck :
             t.statusPending}
          </span>
        </div>
      )}

      {showError && !isPending && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
          <span className="text-red-400 text-xs">
            {parseErrorMessage(commandState.error)}
          </span>
        </div>
      )}

      {/* CRITICAL: Offline warning when NOT in AWAY mode */}
      {connectionStatus === 'offline' && !isAway && !isPending && !showError && (
        <div className="flex flex-col gap-2 px-3 py-3 bg-red-500/20 border-2 border-red-500/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-red-300 text-sm font-semibold">
              {t.securityNotMonitored}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
            <span className="text-red-400/80 text-xs">
              {t.errorDeviceOffline}
            </span>
          </div>
        </div>
      )}

      {/* CRITICAL: Sleeping warning when NOT in AWAY mode */}
      {connectionStatus === 'sleeping' && !isAway && !isPending && !showError && (
        <div className="flex flex-col gap-2 px-3 py-3 bg-yellow-500/20 border-2 border-yellow-500/50 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 animate-pulse" />
            <span className="text-yellow-300 text-sm font-semibold">
              {t.securityNotMonitoredSleeping}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Moon className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-yellow-400/80 text-xs">
              {t.errorDeviceSleeping}
            </span>
          </div>
        </div>
      )}

      {/* SENSOR STATUS - Away active and reachable */}
      {isAway && !isAwayButUnreachable && !isPending && !showError && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-amber-400 text-xs flex-1">
              {t.activeMessage}
            </span>
            <SensorStatusIndicator
              motionEnabled={securityStatus.motion_enabled}
              babyMonitorEnabled={securityStatus.baby_monitor_enabled ?? false}
              securityEnabled={securityStatus.security_enabled}
              isArmed={securityStatus.security_enabled}
            />
          </div>
        </div>
      )}

      {/* Away active but unreachable warning */}
      {isAwayButUnreachable && !isPending && !showError && (
        <div className="flex flex-col gap-2 px-3 py-3 bg-orange-500/15 border border-orange-500/40 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-orange-300 text-sm font-semibold">
              {language === 'he' 
                ? 'Away פעיל • המחשב לא זמין' 
                : 'Away Active • PC Unavailable'}
            </span>
          </div>
          <span className="text-orange-400/80 text-xs">
            {language === 'he' 
              ? 'הניטור יחודש אוטומטית כשהמחשב יתחבר מחדש' 
              : 'Monitoring will resume automatically when reconnected'}
          </span>
        </div>
      )}

      {commandState.status === 'acknowledged' && !isPending && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg mt-2">
          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400 text-xs">
            {t.commandSuccess}
          </span>
        </div>
      )}
    </div>
  );
});

// Display name for debugging
MobileAwayModeCard.displayName = 'MobileAwayModeCard';
