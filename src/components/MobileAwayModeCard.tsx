import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Home, HomeIcon, Loader2, Plug, Monitor, AlertCircle, CheckCircle, WifiOff, Moon, AlertTriangle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEVICE_ONLINE_THRESHOLD_SECONDS, parseDbTimestamp, useDevices } from '@/hooks/useDevices';
import { useRemoteCommand } from '@/hooks/useRemoteCommand';

type DeviceMode = 'NORMAL' | 'AWAY';
type DeviceConnectionStatus = 'online' | 'offline' | 'sleeping' | 'unknown';

interface MobileAwayModeCardProps {
  className?: string;
}

// Analytics/logging helper
const logAwayModeEvent = (event: string, data?: Record<string, unknown>) => {
  console.log(`[MobileAwayMode:Analytics] ${event}`, data || {});
  // Future: Send to analytics service
};

export const MobileAwayModeCard: React.FC<MobileAwayModeCardProps> = ({ className }) => {
  const { language } = useLanguage();
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('NORMAL');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMode, setPendingMode] = useState<DeviceMode | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<DeviceConnectionStatus>('unknown');

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
    statusNormal: language === 'he' ? 'רגיל' : 'Normal',
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
      ? 'המחשב במצב שינה - הער אותו ונסה שוב' 
      : 'Computer sleeping - wake it and try again',
    errorTimeout: language === 'he' 
      ? 'לא התקבלה תשובה - ודא שהמחשב מחובר' 
      : 'No response - ensure computer is connected',
    // Display off message (non-blocking)
    displayOffNote: language === 'he' 
      ? 'המסך יכבה אוטומטית (אם נתמך)' 
      : 'Display will turn off automatically (if supported)',
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

  // Check device connection status
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

      const lastSeen = parseDbTimestamp(data.last_seen_at);
      if (!lastSeen) {
        setConnectionStatus('offline');
        return;
      }

      const now = new Date();
      const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

      if (diffSeconds <= DEVICE_ONLINE_THRESHOLD_SECONDS) {
        setConnectionStatus('online');
      } else if (diffSeconds <= 300) {
        setConnectionStatus('sleeping');
      } else {
        setConnectionStatus('offline');
      }
    } catch {
      setConnectionStatus('unknown');
    }
  }, [deviceId]);

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

    // Poll connection status every 10 seconds
    const connectionInterval = setInterval(checkConnectionStatus, 10000);

    // Realtime subscription for status changes
    const channel = supabase
      .channel('mobile_away_mode_status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_status',
          filter: `device_id=eq.${deviceId}`
        },
        (payload) => {
          console.log('[MobileAwayMode] Realtime update:', payload.new);
          const newStatus = payload.new as any;
          const newMode = newStatus.device_mode || 'NORMAL';
          
          setDeviceMode(newMode);
          
          if (pendingMode && newMode === pendingMode) {
            setPendingMode(null);
            resetState();
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(connectionInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchStatus, checkConnectionStatus, deviceId, pendingMode, resetState]);

  // Handle toggle - send remote command with analytics
  const handleToggle = async (checked: boolean) => {
    if (!deviceId) {
      toast.error(t.noDevice);
      return;
    }

    // Check connection status before attempting
    if (connectionStatus === 'offline') {
      toast.error(t.errorDeviceOffline);
      return;
    }

    if (connectionStatus === 'sleeping') {
      toast.warning(t.errorDeviceSleeping);
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

  const isAway = deviceMode === 'AWAY';
  const isPending = pendingMode !== null || isCommandLoading;
  const showError = commandState.status === 'failed' || commandState.status === 'timeout';

  // Get status label - must be defined before any conditional returns
  const getStatusLabel = () => {
    if (isPending) return t.statusPending;
    if (connectionStatus === 'offline') return t.statusOffline;
    if (connectionStatus === 'sleeping') return t.statusSleeping;
    if (isAway) return t.statusAwayActive;
    return t.statusNormal;
  };

  // Get status color - must be defined before any conditional returns
  const getStatusColor = () => {
    if (isPending) return 'text-blue-400';
    if (connectionStatus === 'offline') return 'text-red-400';
    if (connectionStatus === 'sleeping') return 'text-yellow-400';
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
        ? 'from-amber-600/20 to-orange-800/20 border-amber-500/30' 
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
          ) : connectionStatus === 'offline' ? (
            <WifiOff className="w-6 h-6 text-red-400" />
          ) : connectionStatus === 'sleeping' ? (
            <Moon className="w-6 h-6 text-yellow-400" />
          ) : isAway ? (
            <Home className="w-6 h-6 text-white" />
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
            disabled={isPending || connectionStatus === 'offline'}
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

      {/* Offline warning */}
      {connectionStatus === 'offline' && !isPending && !showError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <WifiOff className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-400 text-xs">
            {t.errorDeviceOffline}
          </span>
        </div>
      )}

      {/* Sleeping warning */}
      {connectionStatus === 'sleeping' && !isPending && !showError && !isAway && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <Moon className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-400 text-xs">
            {t.errorDeviceSleeping}
          </span>
        </div>
      )}

      {isAway && !isPending && !showError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-amber-400 text-xs">
            {t.activeMessage}
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
};
