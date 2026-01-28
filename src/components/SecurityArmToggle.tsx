import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Shield, ShieldOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDevices } from '@/hooks/useDevices';
interface DeviceStatus {
  id: string;
  device_id: string;
  is_armed: boolean;
  last_command: string | null;
  updated_at: string;
}

export interface SecurityArmToggleProps {
  className?: string;
  disabled?: boolean;
}

export const SecurityArmToggle: React.FC<SecurityArmToggleProps> = ({ className, disabled = false }) => {
  const { language, isRTL } = useLanguage();
  const [isArmed, setIsArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

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
      const { data, error } = await supabase
        .from('device_status')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error) {
        console.error('[SecurityArmToggle] Error fetching status:', error);
        return;
      }

      if (data) {
        setIsArmed((data as DeviceStatus).is_armed);
      } else {
        // No status record exists - create one
        console.log('[SecurityArmToggle] No status found, creating initial record');
        const { error: insertError } = await supabase
          .from('device_status')
          .insert({
            device_id: deviceId,
            is_armed: false,
            last_command: 'STANDBY'
          });
        
        if (insertError) {
          console.error('[SecurityArmToggle] Error creating status:', insertError);
        }
      }
    } catch (err) {
      console.error('[SecurityArmToggle] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!deviceId) return;

    fetchStatus();

    // Realtime subscription for status changes - unique channel name per device
    const channelName = `security_arm_status_${deviceId}`;
    console.log('[SecurityArmToggle] Setting up Realtime subscription:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_status',
          filter: `device_id=eq.${deviceId}`
        },
        (payload) => {
          console.log('[SecurityArmToggle] 🔔 Realtime update:', payload.new);
          const newStatus = payload.new as DeviceStatus;
          setIsArmed(newStatus.is_armed);
        }
      )
      .subscribe((status) => {
        console.log('[SecurityArmToggle] Subscription status:', status);
      });

    return () => {
      console.log('[SecurityArmToggle] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [fetchStatus, deviceId]);

  // Toggle armed status
  const handleToggle = async (checked: boolean) => {
    if (disabled) {
      toast.error(language === 'he' ? 'המחשב לא מחובר' : 'Computer offline');
      return;
    }

    if (!deviceId) {
      toast.error(language === 'he' ? 'לא נבחר מכשיר' : 'No device selected');
      return;
    }

    setIsUpdating(true);
    
    const newCommand = checked ? 'ARM' : 'DISARM';
    
    try {
      const { error } = await supabase
        .from('device_status')
        .update({
          is_armed: checked,
          last_command: newCommand,
          last_command_at: new Date().toISOString()
        })
        .eq('device_id', deviceId);

      if (error) {
        console.error('[SecurityArmToggle] Error updating status:', error);
        toast.error(language === 'he' ? 'שגיאה בעדכון הסטטוס' : 'Failed to update status');
        return;
      }

      // Optimistic update (will be confirmed by realtime)
      setIsArmed(checked);
      
      toast.success(
        checked 
          ? (language === 'he' ? '🛡️ המערכת מזוינת!' : '🛡️ System Armed!')
          : (language === 'he' ? '🔓 המערכת מנוטרלת' : '🔓 System Disarmed')
      );
    } catch (err) {
      console.error('[SecurityArmToggle] Unexpected error:', err);
      toast.error(language === 'he' ? 'שגיאה בלתי צפויה' : 'Unexpected error');
    } finally {
      setIsUpdating(false);
    }
  };

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
      isArmed 
        ? 'from-red-600/20 to-red-800/20 border-red-500/30' 
        : 'from-slate-700/20 to-slate-800/20 border-slate-600/30'
    } border rounded-2xl p-5 transition-all duration-300 ${className}`}>
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300 ${
          isArmed 
            ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/30' 
            : 'bg-slate-700/50'
        }`}>
          {isArmed ? (
            <Shield className="w-7 h-7 text-white" />
          ) : (
            <ShieldOff className="w-7 h-7 text-slate-400" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            {language === 'he' ? 'מערכת אבטחה' : 'Security System'}
          </h3>
          <p className={`text-sm ${isArmed ? 'text-red-400' : 'text-slate-400'}`}>
            {isArmed 
              ? (language === 'he' ? 'מזוינת • מצלמה + זיהוי תנועה' : 'Armed • Camera + Motion Detection')
              : (language === 'he' ? 'מנוטרלת • המתנה' : 'Disarmed • Standby')}
          </p>
        </div>

        {/* Toggle Switch */}
        <div className="flex flex-col items-center gap-1">
          {isUpdating ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : (
            <Switch
              checked={isArmed}
              onCheckedChange={handleToggle}
              disabled={isUpdating || disabled}
              className={isArmed ? 'data-[state=checked]:bg-red-500' : ''}
            />
          )}
          <span className={`text-xs ${disabled ? 'text-slate-500' : isArmed ? 'text-red-400' : 'text-slate-500'}`}>
            {disabled 
              ? (language === 'he' ? 'לא זמין' : 'Unavailable')
              : isArmed 
                ? (language === 'he' ? 'מזוין' : 'Armed')
                : (language === 'he' ? 'כבוי' : 'Off')}
          </span>
        </div>
      </div>

      {/* Status Bar */}
      {isArmed && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-red-500/10 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-xs">
            {language === 'he' 
              ? 'המערכת פעילה ומנטרת' 
              : 'System active and monitoring'}
          </span>
        </div>
      )}
    </div>
  );
};
