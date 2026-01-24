import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Home, HomeIcon, Loader2, Plug, Monitor } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDevices } from '@/hooks/useDevices';

type DeviceMode = 'NORMAL' | 'AWAY';
type ChangedBy = 'DESKTOP' | 'MOBILE' | 'SERVER';

interface DeviceStatus {
  id: string;
  device_id: string;
  device_mode: DeviceMode;
  last_mode_changed_at: string | null;
  last_mode_changed_by: ChangedBy | null;
}

interface AwayModeCardProps {
  className?: string;
}

export const AwayModeCard: React.FC<AwayModeCardProps> = ({ className }) => {
  const { language } = useLanguage();
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('NORMAL');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Translations
  const t = {
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
    statusActive: language === 'he' ? 'פעיל' : 'Active',
    statusInactive: language === 'he' ? 'כבוי' : 'Inactive',
    activeMessage: language === 'he' 
      ? 'מצב Away פעיל - המחשב יישאר ער' 
      : 'Away mode active - Computer will stay awake',
    noDevice: language === 'he' ? 'לא נבחר מכשיר' : 'No device selected',
    updateError: language === 'he' ? 'שגיאה בעדכון מצב Away' : 'Failed to update Away mode',
    activatedToast: language === 'he' ? '🏠 מצב Away הופעל!' : '🏠 Away Mode Activated!',
    deactivatedToast: language === 'he' ? '🔌 מצב Away כבוי' : '🔌 Away Mode Deactivated',
  };

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
  const deviceId = selectedDevice?.id;

  // Fetch initial status
  const fetchStatus = useCallback(async () => {
    if (!deviceId) {
      setIsLoading(false);
      return;
    }

    try {
      // Use type assertion for new columns until types are regenerated
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

    // Realtime subscription for status changes
    const channel = supabase
      .channel('device_status_away_mode')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_status',
          filter: `device_id=eq.${deviceId}`
        },
        (payload) => {
          console.log('[AwayModeCard] Realtime update:', payload.new);
          const newStatus = payload.new as any;
          setDeviceMode(newStatus.device_mode || 'NORMAL');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStatus, deviceId]);

  // Toggle away mode
  const handleToggle = async (checked: boolean) => {
    if (!deviceId) {
      toast.error(t.noDevice);
      return;
    }

    setIsUpdating(true);
    
    const newMode: DeviceMode = checked ? 'AWAY' : 'NORMAL';
    
    try {
      // Update device_status with new mode - use type assertion for new columns
      const { error } = await supabase
        .from('device_status')
        .update({
          device_mode: newMode,
          last_mode_changed_at: new Date().toISOString(),
          last_mode_changed_by: 'DESKTOP',
        } as any)
        .eq('device_id', deviceId);

      if (error) {
        console.error('[AwayModeCard] Error updating mode:', error);
        toast.error(t.updateError);
        return;
      }

      // Optimistic update (will be confirmed by realtime)
      setDeviceMode(newMode);
      
      toast.success(checked ? t.activatedToast : t.deactivatedToast);
    } catch (err) {
      console.error('[AwayModeCard] Unexpected error:', err);
      toast.error(t.updateError);
    } finally {
      setIsUpdating(false);
    }
  };

  const isAway = deviceMode === 'AWAY';

  if (isLoading) {
    return (
      <div className={`bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 ${className}`}>
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
    } border rounded-2xl p-6 transition-all duration-300 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isAway 
            ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30' 
            : 'bg-slate-700/50'
        }`}>
          {isAway ? (
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
              disabled={isUpdating}
              className={isAway ? 'data-[state=checked]:bg-amber-500' : ''}
            />
          )}
          <span className={`text-xs ${isAway ? 'text-amber-400' : 'text-slate-500'}`}>
            {isAway ? t.statusActive : t.statusInactive}
          </span>
        </div>
      </div>

      {/* Requirements */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Plug className="w-4 h-4 text-white/50" />
          <span>{t.requirementPower}</span>
        </div>
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Monitor className="w-4 h-4 text-white/50" />
          <span>{t.requirementLid}</span>
        </div>
      </div>

      {/* Active Status Bar */}
      {isAway && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-amber-400 text-xs">
            {t.activeMessage}
          </span>
        </div>
      )}
    </div>
  );
};
