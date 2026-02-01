import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Shield, ShieldOff, Loader2, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDevices } from '@/hooks/useDevices';
import { MonitoringSettingsDialog, MonitoringSettings } from '@/components/MonitoringSettingsDialog';
import { getSessionToken } from '@/hooks/useSession';

interface DeviceStatus {
  id: string;
  device_id: string;
  is_armed: boolean;
  device_mode: string;
  motion_enabled: boolean;
  sound_enabled: boolean;
  security_enabled: boolean;
  last_command: string | null;
  updated_at: string;
}

export interface SecurityArmToggleProps {
  className?: string;
  disabled?: boolean;
}

/**
 * Security/Monitoring Toggle Card
 * - When toggled ON: Opens settings dialog, ensures Away Mode is active
 * - Motion detection ON by default, Sound OFF by default
 * - Monitoring requires Away Mode to be active
 */
export const SecurityArmToggle: React.FC<SecurityArmToggleProps> = ({ className, disabled = false }) => {
  const { language, isRTL } = useLanguage();
  const [isArmed, setIsArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [securityEnabled, setSecurityEnabled] = useState(false); // True when Electron confirms camera is active
  const [monitoringSettings, setMonitoringSettings] = useState<MonitoringSettings>({
    motionEnabled: true,
    soundEnabled: false,
  });

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

  const sendMonitoringCommand = useCallback(
    async (command: 'SET_MONITORING:ON' | 'SET_MONITORING:OFF'): Promise<string | null> => {
      if (!deviceId) return null;

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        toast.error(language === 'he' ? 'נדרשת התחברות מחדש' : 'Please log in again');
        return null;
      }

      console.log('[SecurityArmToggle] Sending command via Edge Function:', command, { deviceId });

      const response = await supabase.functions.invoke('send-command', {
        body: {
          device_id: deviceId,
          command,
          session_token: sessionToken,
        },
      });

      if (response.error) {
        console.error('[SecurityArmToggle] send-command error:', response.error);
        return null;
      }

      const data = response.data as { success?: boolean; command_id?: string; error?: string; error_code?: string };
      if (!data?.success || !data?.command_id) {
        console.error('[SecurityArmToggle] send-command failed:', data);
        return null;
      }

      console.log('[SecurityArmToggle] ✅ Command inserted:', data.command_id);
      return data.command_id;
    },
    [deviceId, language]
  );

  // Fetch initial status and sync commands
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
        const status = data as DeviceStatus;
        
        // Check if is_armed but security_enabled is false - means command never reached Electron
        // This can happen if state was set before the Edge Function logic was deployed
        if (status.is_armed && !status.security_enabled) {
          console.log('[SecurityArmToggle] ⚠️ State mismatch detected: is_armed=true but security_enabled=false');
          
          // Check if SET_MONITORING:ON command exists
          const { data: cmdData } = await supabase
            .from('commands')
            .select('id')
            .eq('device_id', deviceId)
            .eq('command', 'SET_MONITORING:ON')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!cmdData || cmdData.length === 0) {
            console.log('[SecurityArmToggle] 🔄 No SET_MONITORING:ON found, resetting is_armed to false');
            // Reset is_armed since the command was never sent
            await supabase
              .from('device_status')
              .update({ is_armed: false })
              .eq('device_id', deviceId);
            setIsArmed(false);
          } else {
            setIsArmed(status.is_armed);
          }
        } else {
          setIsArmed(status.is_armed);
        }
        
        setSecurityEnabled(status.security_enabled ?? false);
        setMonitoringSettings({
          motionEnabled: status.motion_enabled ?? true,
          soundEnabled: status.sound_enabled ?? false,
        });
      } else {
        // No status record exists - create one
        console.log('[SecurityArmToggle] No status found, creating initial record');
        const { error: insertError } = await supabase
          .from('device_status')
          .insert({
            device_id: deviceId,
            is_armed: false,
            last_command: 'STANDBY',
            motion_enabled: true,
            sound_enabled: false,
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
          setSecurityEnabled(newStatus.security_enabled ?? false);
          setMonitoringSettings({
            motionEnabled: newStatus.motion_enabled ?? true,
            soundEnabled: newStatus.sound_enabled ?? false,
          });
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

  // Check and activate Away Mode if needed
  const ensureAwayModeActive = async (): Promise<boolean> => {
    if (!deviceId) return false;

    try {
      // Check current device_mode
      const { data: statusData, error: statusError } = await supabase
        .from('device_status')
        .select('device_mode')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (statusError) {
        console.error('[SecurityArmToggle] Error checking device_mode:', statusError);
        return false;
      }

      // If already in AWAY mode, we're good
      if (statusData?.device_mode === 'AWAY') {
        console.log('[SecurityArmToggle] Away mode already active');
        return true;
      }

      // Need to activate Away Mode first
      console.log('[SecurityArmToggle] Activating Away mode automatically...');
      
      const { error: awayError } = await supabase
        .from('device_status')
        .update({
          device_mode: 'AWAY',
          last_command: 'ENTER_AWAY',
          last_command_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (awayError) {
        console.error('[SecurityArmToggle] Error activating Away mode:', awayError);
        toast.error(language === 'he' ? 'שגיאה בהפעלת מצב Away' : 'Failed to activate Away Mode');
        return false;
      }

      toast.success(
        language === 'he' 
          ? '🌙 מצב Away הופעל אוטומטית' 
          : '🌙 Away Mode activated automatically'
      );

      return true;
    } catch (err) {
      console.error('[SecurityArmToggle] Unexpected error ensuring Away mode:', err);
      return false;
    }
  };

  // Handle toggle click - opens dialog for activation
  const handleToggleClick = (checked: boolean) => {
    if (disabled) {
      toast.error(language === 'he' ? 'המחשב לא מחובר' : 'Computer offline');
      return;
    }

    if (!deviceId) {
      toast.error(language === 'he' ? 'לא נבחר מכשיר' : 'No device selected');
      return;
    }

    if (checked) {
      // Opening - show settings dialog
      setShowSettingsDialog(true);
    } else {
      // Closing - directly disarm
      handleDisarm();
    }
  };

  // Confirm activation with settings
  const handleConfirmActivation = async () => {
    if (!deviceId) return;

    setIsUpdating(true);

    try {
      // Step 1: Ensure Away Mode is active
      const awayOk = await ensureAwayModeActive();
      if (!awayOk) {
        setIsUpdating(false);
        return;
      }

      // Step 2: Update device_status with armed state and sensor settings
      const { error: statusError } = await supabase
        .from('device_status')
        .update({
          is_armed: true,
          motion_enabled: monitoringSettings.motionEnabled,
          sound_enabled: monitoringSettings.soundEnabled,
          last_command: 'ARM',
          last_command_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (statusError) {
        console.error('[SecurityArmToggle] Error updating status:', statusError);
        toast.error(language === 'he' ? 'שגיאה בהפעלת הניטור' : 'Failed to activate monitoring');
        return;
      }

      // Step 3: CRITICAL - Send SET_MONITORING:ON via Edge Function (RLS-safe)
      const commandId = await sendMonitoringCommand('SET_MONITORING:ON');
      if (!commandId) {
        console.error('[SecurityArmToggle] Failed to send SET_MONITORING:ON');
        // Revert status since command failed
        await supabase
          .from('device_status')
          .update({ is_armed: false })
          .eq('device_id', deviceId);
        toast.error(language === 'he' ? 'שגיאה בשליחת פקודה למכשיר' : 'Failed to send command to device');
        return;
      }

      console.log('[SecurityArmToggle] ✅ SET_MONITORING:ON command sent', { commandId });
      setIsArmed(true);
      setShowSettingsDialog(false);

      // Build toast message based on active sensors
      const sensors = [];
      if (monitoringSettings.motionEnabled) {
        sensors.push(language === 'he' ? 'תנועה' : 'Motion');
      }
      if (monitoringSettings.soundEnabled) {
        sensors.push(language === 'he' ? 'קול' : 'Sound');
      }

      toast.success(
        language === 'he' 
          ? `🛡️ מפעיל ניטור • ${sensors.join(' + ')}` 
          : `🛡️ Activating Monitoring • ${sensors.join(' + ')}`
      );
    } catch (err) {
      console.error('[SecurityArmToggle] Unexpected error:', err);
      toast.error(language === 'he' ? 'שגיאה בלתי צפויה' : 'Unexpected error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Disarm monitoring
  const handleDisarm = async () => {
    if (!deviceId) return;

    setIsUpdating(true);
    setShowSettingsDialog(false); // Close dialog immediately

    try {
      // Step 1: Update device_status
      const { error: statusError } = await supabase
        .from('device_status')
        .update({
          is_armed: false,
          last_command: 'DISARM',
          last_command_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (statusError) {
        console.error('[SecurityArmToggle] Error updating status:', statusError);
        toast.error(language === 'he' ? 'שגיאה בכיבוי הניטור' : 'Failed to disarm monitoring');
        return;
      }

      // Step 2: CRITICAL - Send SET_MONITORING:OFF via Edge Function (RLS-safe)
      const commandId = await sendMonitoringCommand('SET_MONITORING:OFF');
      if (!commandId) {
        console.error('[SecurityArmToggle] Failed to send SET_MONITORING:OFF');
      } else {
        console.log('[SecurityArmToggle] ✅ SET_MONITORING:OFF command sent', { commandId });
      }

      setIsArmed(false);
      toast.success(language === 'he' ? '🔓 הניטור כובה' : '🔓 Monitoring Disabled');
    } catch (err) {
      console.error('[SecurityArmToggle] Unexpected error:', err);
      toast.error(language === 'he' ? 'שגיאה בלתי צפויה' : 'Unexpected error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Build sensor status text
  const getSensorStatusText = () => {
    if (!isArmed) {
      return language === 'he' ? 'מנוטרל • המתנה' : 'Disarmed • Standby';
    }

    const sensors = [];
    if (monitoringSettings.motionEnabled) {
      sensors.push(language === 'he' ? 'תנועה' : 'Motion');
    }
    if (monitoringSettings.soundEnabled) {
      sensors.push(language === 'he' ? 'קול' : 'Sound');
    }

    if (sensors.length === 0) {
      return language === 'he' ? 'פעיל • ללא חיישנים' : 'Active • No sensors';
    }

    return `${language === 'he' ? 'פעיל' : 'Active'} • ${sensors.join(' + ')}`;
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
    <>
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
              {getSensorStatusText()}
            </p>
          </div>

          {/* Settings Button (only when armed) */}
          {isArmed && (
            <button
              onClick={() => setShowSettingsDialog(true)}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              aria-label={language === 'he' ? 'הגדרות ניטור' : 'Monitoring settings'}
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          {/* Toggle Switch */}
          <div className="flex flex-col items-center gap-1">
            {isUpdating ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            ) : (
              <Switch
                checked={isArmed}
                onCheckedChange={handleToggleClick}
                disabled={isUpdating || disabled}
                className={isArmed ? 'data-[state=checked]:bg-red-500' : ''}
              />
            )}
            <span className={`text-xs ${disabled ? 'text-slate-500' : isArmed ? 'text-red-400' : 'text-slate-500'}`}>
              {disabled 
                ? (language === 'he' ? 'לא זמין' : 'Unavailable')
                : isArmed 
                  ? (language === 'he' ? 'פעיל' : 'Active')
                  : (language === 'he' ? 'כבוי' : 'Off')}
            </span>
          </div>
        </div>

        {/* Status Bar */}
        {isArmed && (
          <div
            className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg ${
              securityEnabled ? 'bg-red-500/10' : 'bg-amber-500/10'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                securityEnabled ? 'bg-red-500' : 'bg-amber-500'
              }`}
            />
            <span className={`text-xs ${securityEnabled ? 'text-red-400' : 'text-amber-400'}`}>
              {securityEnabled
                ? (language === 'he' ? 'המצלמה פעילה ומנטרת' : 'Camera active & monitoring')
                : (language === 'he' ? 'ממתין להפעלת מצלמה מהמחשב…' : 'Waiting for computer to activate camera…')}
            </span>
          </div>
        )}
      </div>

      {/* Monitoring Settings Dialog */}
      <MonitoringSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        settings={monitoringSettings}
        onSettingsChange={setMonitoringSettings}
        onConfirm={handleConfirmActivation}
        onDeactivate={handleDisarm}
        isLoading={isUpdating}
        isArmed={isArmed}
        cameraStatus={
          isUpdating 
            ? 'loading' 
            : securityEnabled 
              ? 'active' 
              : 'inactive'
        }
      />
    </>
  );
};
