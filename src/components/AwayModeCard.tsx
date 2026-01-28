import React, { useEffect, useState, useCallback, useMemo, forwardRef } from 'react';
import { Home, HomeIcon, Loader2, Plug, Monitor, WifiOff, Moon, AlertTriangle, CheckCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEVICE_ONLINE_THRESHOLD_SECONDS, parseDbTimestamp, useDevices } from '@/hooks/useDevices';
import { useRemoteCommand } from '@/hooks/useRemoteCommand';
type DeviceMode = 'NORMAL' | 'AWAY';
type ChangedBy = 'DESKTOP' | 'MOBILE' | 'SERVER';
type DeviceConnectionStatus = 'online' | 'offline' | 'sleeping' | 'unknown';

interface AwayModeCardProps {
  className?: string;
}

// Analytics/logging helper
const logAwayModeEvent = (event: string, data?: Record<string, unknown>) => {
  console.log(`[AwayMode:Analytics] ${event}`, data || {});
  // Future: Send to analytics service
};

// Use forwardRef to avoid React warnings when this component receives a ref
export const AwayModeCard = forwardRef<HTMLDivElement, AwayModeCardProps>(({ className }, ref) => {
  const { language } = useLanguage();
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('NORMAL');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<DeviceConnectionStatus>('unknown');
  const [lastError, setLastError] = useState<string | null>(null);

  // Translations - comprehensive i18n
  const t = useMemo(() => ({
    title: language === 'he' ? 'מצב Away' : 'Away Mode',
    description: language === 'he' 
      ? 'השאר את המחשב דלוק כשאתה לא בבית' 
      : 'Keep your computer running while you\'re away',
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
    statusUnknown: language === 'he' ? 'לא ידוע' : 'Unknown',
    // Messages
    activeMessage: language === 'he' 
      ? 'מצב Away פעיל - המחשב יישאר ער' 
      : 'Away mode active - Computer will stay awake',
    noDevice: language === 'he' ? 'לא נבחר מכשיר' : 'No device selected',
    updateError: language === 'he' ? 'שגיאה בעדכון מצב Away' : 'Failed to update Away mode',
    activatedToast: language === 'he' ? '🏠 מצב Away הופעל!' : '🏠 Away Mode Activated!',
    deactivatedToast: language === 'he' ? '🔌 מצב Away כבוי' : '🔌 Away Mode Deactivated',
    // Error messages - detailed guidance
    errorPowerRequired: language === 'he' 
      ? 'נדרש חיבור לחשמל - חבר את המחשב לחשמל ונסה שוב' 
      : 'Power connection required - plug in your computer and try again',
    errorKeepLidOpen: language === 'he' 
      ? 'שמור את המכסה פתוח כדי שהמצלמה תפעל' 
      : 'Keep the lid open for the camera to work',
    errorDisplayOffFailed: language === 'he' 
      ? 'לא הצלחנו לכבות את המסך (לא קריטי)' 
      : 'Could not turn off display (non-critical)',
    errorDeviceOffline: language === 'he' 
      ? 'המחשב לא מחובר - פתח את האפליקציה במחשב' 
      : 'Computer is offline - open the app on your computer',
    errorDeviceSleeping: language === 'he' 
      ? 'המחשב במצב שינה - הער אותו ונסה שוב' 
      : 'Computer is sleeping - wake it up and try again',
    // Updating state
    updating: language === 'he' ? 'מעדכן...' : 'Updating...',
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

  // Remote command hook for sending SET_DEVICE_MODE to Electron
  const { sendCommand, commandState, isLoading: isCommandLoading, resetState } = useRemoteCommand({
    deviceId,
    onAcknowledged: (cmdType) => {
      if (cmdType === 'SET_DEVICE_MODE') {
        console.log('[AwayModeCard] Command acknowledged');
        logAwayModeEvent('mode_change_succeeded', {
          to: deviceMode === 'NORMAL' ? 'AWAY' : 'NORMAL',
          deviceId,
          source: 'DESKTOP',
        });
        setIsUpdating(false);
      }
    },
    onFailed: (cmdType, error) => {
      if (cmdType === 'SET_DEVICE_MODE') {
        console.log('[AwayModeCard] Command failed:', error);
        logAwayModeEvent('mode_change_failed', {
          error,
          deviceId,
        });
        setLastError(error || t.updateError);
        setIsUpdating(false);
      }
    },
    timeoutMs: 15000,
  });

  // Check device connection status - updates locally, Realtime handles live sync
  const updateConnectionStatus = useCallback((data: { last_seen_at: string | null; is_active: boolean } | null) => {
    if (!data) {
      setConnectionStatus('unknown');
      return;
    }

    // If is_active is false, device is offline immediately
    if (!data.is_active) {
      console.log('[AwayModeCard] Device is_active=false, setting offline');
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

    if (diffSeconds <= DEVICE_ONLINE_THRESHOLD_SECONDS) {
      setConnectionStatus('online');
    } else if (diffSeconds <= 300) {
      // Beyond online threshold but still recent: might be sleeping / throttled.
      setConnectionStatus('sleeping');
    } else {
      setConnectionStatus('offline');
    }
  }, []);

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

      updateConnectionStatus(data);
    } catch {
      setConnectionStatus('unknown');
    }
  }, [deviceId, updateConnectionStatus]);

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
        console.error('[AwayModeCard] Error fetching status:', error);
        return;
      }

      if (data) {
        const status = data as any;
        setDeviceMode(status.device_mode || 'NORMAL');
      }
    } catch (err) {
      console.error('[AwayModeCard] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!deviceId) return;

    fetchStatus();
    checkConnectionStatus();

    // Realtime subscription for device_status changes - CRITICAL for instant Away Mode sync
    const statusChannelName = `device_status_away_mode_${deviceId}`;
    console.log('[AwayModeCard] Setting up Realtime subscription for device_status:', statusChannelName);
    
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
          console.log('[AwayModeCard] 🔔 Realtime device_status update:', payload.new);
          const newStatus = payload.new as any;
          const newMode = newStatus.device_mode || 'NORMAL';
          console.log('[AwayModeCard] Setting deviceMode from Realtime:', newMode);
          setDeviceMode(newMode);
          setLastError(null); // Clear error on successful update
        }
      )
      .subscribe((status) => {
        console.log('[AwayModeCard] device_status subscription status:', status);
      });

    // Realtime subscription for devices table - CRITICAL for immediate offline detection
    const devicesChannelName = `away_mode_devices_${deviceId}`;
    console.log('[AwayModeCard] Setting up Realtime subscription for devices:', devicesChannelName);
    
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
          console.log('[AwayModeCard] 🔔 Realtime devices update:', payload.new);
          const updated = payload.new as { last_seen_at: string | null; is_active: boolean };
          updateConnectionStatus(updated);
        }
      )
      .subscribe((status) => {
        console.log('[AwayModeCard] devices subscription status:', status);
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
  }, [fetchStatus, checkConnectionStatus, updateConnectionStatus, deviceId]);

  // Toggle away mode - send command to Electron via commands table
  const handleToggle = async (checked: boolean) => {
    if (!deviceId) {
      toast.error(t.noDevice);
      return;
    }

    // Check connection status before attempting
    if (connectionStatus === 'offline') {
      toast.error(t.errorDeviceOffline);
      setLastError(t.errorDeviceOffline);
      return;
    }

    if (connectionStatus === 'sleeping') {
      toast.error(t.errorDeviceSleeping);
      setLastError(t.errorDeviceSleeping);
      return; // BLOCK - do not allow AWAY activation when sleeping!
    }

    setIsUpdating(true);
    setLastError(null);
    
    const newMode: DeviceMode = checked ? 'AWAY' : 'NORMAL';
    
    // Log analytics event
    logAwayModeEvent('mode_change_requested', {
      from: deviceMode,
      to: newMode,
      deviceId,
      source: 'DESKTOP',
    });
    
    console.log('[AwayModeCard] Sending SET_DEVICE_MODE command:', newMode);

    // CRITICAL: Send command to Electron via commands table so it activates powerSaveBlocker
    const success = await sendCommand('SET_DEVICE_MODE', { mode: newMode });
    
    if (!success) {
      console.log('[AwayModeCard] Command send failed immediately');
      setIsUpdating(false);
      // Error already shown by useRemoteCommand
    }
    // On success, the DB will be updated by Electron and we'll get the realtime update
  };

  // CRITICAL FIX: Away mode is only valid when device is online
  // If device is offline/sleeping, show the unavailability status instead
  const isDeviceReachable = connectionStatus === 'online';
  const isAway = deviceMode === 'AWAY' && isDeviceReachable;

  // Get status label based on current state
  const getStatusLabel = () => {
    if (isUpdating) return t.updating;
    if (connectionStatus === 'offline') return t.statusOffline;
    if (connectionStatus === 'sleeping') return t.statusSleeping;
    // Only show "Away Active" if device is actually reachable
    if (deviceMode === 'AWAY' && isDeviceReachable) return t.statusAwayActive;
    return t.statusNormal;
  };

  // Get status color
  const getStatusColor = () => {
    if (connectionStatus === 'offline') return 'text-red-400';
    if (connectionStatus === 'sleeping') return 'text-yellow-400';
    if (isAway) return 'text-amber-400';
    return 'text-slate-500';
  };

  // Get status icon
  const getStatusIcon = () => {
    if (connectionStatus === 'offline') return <WifiOff className="w-3 h-3" />;
    if (connectionStatus === 'sleeping') return <Moon className="w-3 h-3" />;
    if (isAway) return <CheckCircle className="w-3 h-3" />;
    return null;
  };

  // Loading state - render early but AFTER all hooks
  if (isLoading) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className={`bg-gradient-to-br ${
      isAway 
        ? 'from-amber-600/20 to-orange-800/20 border-amber-500/30' 
        : connectionStatus === 'offline'
          ? 'from-red-900/20 to-slate-800/20 border-red-500/30'
          : connectionStatus === 'sleeping'
            ? 'from-yellow-900/20 to-slate-800/20 border-yellow-500/30'
            : 'from-slate-700/20 to-slate-800/20 border-slate-600/30'
    } border rounded-2xl p-6 transition-all duration-300 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isAway 
            ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30'
            : connectionStatus === 'offline'
              ? 'bg-red-900/50'
              : connectionStatus === 'sleeping'
                ? 'bg-yellow-900/50'
                : 'bg-slate-700/50'
        }`}>
          {isUpdating ? (
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          ) : connectionStatus === 'offline' ? (
            <WifiOff className="w-7 h-7 text-red-400" />
          ) : connectionStatus === 'sleeping' ? (
            <Moon className="w-7 h-7 text-yellow-400" />
          ) : isAway ? (
            <Home className="w-7 h-7 text-white" />
          ) : (
            <HomeIcon className="w-7 h-7 text-slate-400" />
          )}
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            {t.title}
          </h3>
          <p className="text-white/60 text-sm">
            {t.description}
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="flex flex-col items-center gap-1">
          {isUpdating ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : (
            <Switch
              checked={isAway}
              onCheckedChange={handleToggle}
              disabled={isUpdating || connectionStatus === 'offline'}
              className={isAway ? 'data-[state=checked]:bg-amber-500' : ''}
            />
          )}
          <div className={`flex items-center gap-1 text-xs ${getStatusColor()}`}>
            {getStatusIcon()}
            <span>{getStatusLabel()}</span>
          </div>
        </div>
      </div>

      {/* Requirements with icons */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Plug className="w-4 h-4 text-amber-500/70" />
          <span>{t.requirementPower}</span>
        </div>
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Monitor className="w-4 h-4 text-amber-500/70" />
          <span>{t.requirementLid}</span>
        </div>
      </div>

      {/* Error message display */}
      {lastError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-xs">{lastError}</span>
        </div>
      )}

      {/* Active Status Bar */}
      {isAway && !lastError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-amber-400 text-xs">
            {t.activeMessage}
          </span>
        </div>
      )}

      {/* Offline warning */}
      {connectionStatus === 'offline' && !isAway && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <WifiOff className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-400 text-xs">
            {t.errorDeviceOffline}
          </span>
        </div>
      )}

      {/* Sleeping warning */}
      {connectionStatus === 'sleeping' && !isAway && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <Moon className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-yellow-400 text-xs">
            {t.errorDeviceSleeping}
          </span>
        </div>
      )}
    </div>
  );
});

// Display name for debugging
AwayModeCard.displayName = 'AwayModeCard';
