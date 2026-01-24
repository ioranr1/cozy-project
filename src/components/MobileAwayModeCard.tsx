import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Home, HomeIcon, Loader2, Plug, Monitor, AlertCircle, CheckCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDevices } from '@/hooks/useDevices';
import { useRemoteCommand } from '@/hooks/useRemoteCommand';

type DeviceMode = 'NORMAL' | 'AWAY';

interface MobileAwayModeCardProps {
  className?: string;
}

export const MobileAwayModeCard: React.FC<MobileAwayModeCardProps> = ({ className }) => {
  const { language, isRTL } = useLanguage();
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('NORMAL');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMode, setPendingMode] = useState<DeviceMode | null>(null);

  // Translations
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
    statusActive: language === 'he' ? 'פעיל' : 'Active',
    statusInactive: language === 'he' ? 'כבוי' : 'Inactive',
    statusPending: language === 'he' ? 'ממתין...' : 'Pending...',
    activeMessage: language === 'he' 
      ? 'מצב Away פעיל - המחשב ער' 
      : 'Away mode active - Computer awake',
    noDevice: language === 'he' ? 'לא נבחר מכשיר' : 'No device selected',
    sendingCommand: language === 'he' ? 'שולח פקודה...' : 'Sending command...',
    commandSuccess: language === 'he' ? 'הפקודה התקבלה' : 'Command acknowledged',
    commandFailed: language === 'he' ? 'הפקודה נכשלה' : 'Command failed',
    preflightFailed: language === 'he' 
      ? 'המחשב לא עמד בדרישות (חשמל/מצלמה)' 
      : 'Computer failed preflight checks (power/camera)',
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

  // Remote command hook for sending SET_DEVICE_MODE
  const { sendCommand, commandState, isLoading: isCommandLoading, resetState } = useRemoteCommand({
    deviceId,
    onAcknowledged: (cmdType) => {
      if (cmdType === 'SET_DEVICE_MODE') {
        console.log('[MobileAwayMode] Command acknowledged, pending mode:', pendingMode);
        // The actual mode will be updated via realtime subscription
        setPendingMode(null);
      }
    },
    onFailed: (cmdType, error) => {
      if (cmdType === 'SET_DEVICE_MODE') {
        console.log('[MobileAwayMode] Command failed:', error);
        setPendingMode(null);
        
        // Check if it's a preflight failure
        if (error?.includes('preflight') || error?.includes('power') || error?.includes('camera')) {
          toast.error(t.preflightFailed);
        }
      }
    },
    timeoutMs: 15000, // Longer timeout for Away mode (needs preflight)
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
          
          // Update local state from SSOT
          setDeviceMode(newMode);
          
          // Clear pending if we got the expected mode
          if (pendingMode && newMode === pendingMode) {
            setPendingMode(null);
            resetState();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStatus, deviceId, pendingMode, resetState]);

  // Handle toggle - send remote command
  const handleToggle = async (checked: boolean) => {
    if (!deviceId) {
      toast.error(t.noDevice);
      return;
    }

    const newMode: DeviceMode = checked ? 'AWAY' : 'NORMAL';
    setPendingMode(newMode);

    console.log('[MobileAwayMode] Sending SET_DEVICE_MODE command:', newMode);

    // Send command via remote command system
    const success = await sendCommand('SET_DEVICE_MODE', { mode: newMode });
    
    if (!success) {
      console.log('[MobileAwayMode] Command send failed immediately');
      setPendingMode(null);
    }
  };

  const isAway = deviceMode === 'AWAY';
  const isPending = pendingMode !== null || isCommandLoading;
  const showError = commandState.status === 'failed' || commandState.status === 'timeout';

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
        : 'from-slate-700/20 to-slate-800/20 border-slate-600/30'
    } border rounded-2xl p-5 transition-all duration-300 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isAway 
            ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30' 
            : 'bg-slate-700/50'
        }`}>
          {isPending ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
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
            disabled={isPending}
            className={isAway || pendingMode === 'AWAY' ? 'data-[state=checked]:bg-amber-500' : ''}
          />
          <span className={`text-xs ${
            isPending ? 'text-blue-400' :
            isAway ? 'text-amber-400' : 'text-slate-500'
          }`}>
            {isPending ? t.statusPending : isAway ? t.statusActive : t.statusInactive}
          </span>
        </div>
      </div>

      {/* Requirements - compact for mobile */}
      <div className="flex gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5 text-white/60">
          <Plug className="w-3.5 h-3.5" />
          <span>{t.requirementPower}</span>
        </div>
        <div className="flex items-center gap-1.5 text-white/60">
          <Monitor className="w-3.5 h-3.5" />
          <span>{t.requirementLid}</span>
        </div>
      </div>

      {/* Status indicators */}
      {isPending && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
          <span className="text-blue-400 text-xs">
            {commandState.status === 'sending' ? t.sendingCommand : 
             commandState.status === 'pending' ? (language === 'he' ? 'ממתין לאישור...' : 'Waiting for ACK...') :
             t.statusPending}
          </span>
        </div>
      )}

      {showError && !isPending && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-red-400 text-xs">
            {commandState.error || t.commandFailed}
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
