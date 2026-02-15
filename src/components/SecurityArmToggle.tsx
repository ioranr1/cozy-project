import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Shield, ShieldOff, Loader2, Settings } from 'lucide-react';
import { SensorStatusIndicator } from '@/components/SensorStatusIndicator';
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
  baby_monitor_enabled: boolean;
  security_enabled: boolean;
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
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const showSettingsDialogRef = React.useRef(false);
  const setShowSettingsDialogWrapped = useCallback((open: boolean) => {
    showSettingsDialogRef.current = open;
    setShowSettingsDialog(open);
  }, []);
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [monitoringSettings, setMonitoringSettings] = useState<MonitoringSettings>({
    motionEnabled: false,
    babyMonitorEnabled: false,
  });
  const armedSettingsRef = useRef<{ motionEnabled: boolean; babyMonitorEnabled: boolean } | null>(null);

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
        
        if (status.is_armed && !status.security_enabled) {
          const { data: cmdData } = await supabase
            .from('commands')
            .select('id')
            .eq('device_id', deviceId)
            .eq('command', 'SET_MONITORING:ON')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!cmdData || cmdData.length === 0) {
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
        
        const motionVal = status.motion_enabled ?? true;
        const babyVal = status.baby_monitor_enabled ?? false;
        setMonitoringSettings({
          motionEnabled: motionVal,
          babyMonitorEnabled: babyVal,
        });
        if (status.is_armed) {
          armedSettingsRef.current = { motionEnabled: motionVal, babyMonitorEnabled: babyVal };
        }
      } else {
        console.log('[SecurityArmToggle] No status found, creating initial record');
        const { error: insertError } = await supabase
          .from('device_status')
          .insert({
            device_id: deviceId,
            is_armed: false,
            last_command: 'STANDBY',
            motion_enabled: false,
            sound_enabled: false,
            baby_monitor_enabled: false,
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

  useEffect(() => {
    if (!deviceId) return;

    fetchStatus();

    const channelName = `security_arm_status_${deviceId}`;
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
          if (!showSettingsDialogRef.current) {
            setMonitoringSettings(prev => ({
              motionEnabled: newStatus.motion_enabled ?? true,
              babyMonitorEnabled: newStatus.baby_monitor_enabled ?? false,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStatus, deviceId]);

  useEffect(() => {
    if (!showSettingsDialog && deviceId) {
      fetchStatus();
    }
  }, [showSettingsDialog, deviceId, fetchStatus]);

  const ensureAwayModeActive = async (): Promise<boolean> => {
    if (!deviceId) return false;

    try {
      const { data: statusData, error: statusError } = await supabase
        .from('device_status')
        .select('device_mode')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (statusError) return false;

      if (statusData?.device_mode === 'AWAY') return true;

      const { error: awayError } = await supabase
        .from('device_status')
        .update({
          device_mode: 'AWAY',
          last_command: 'ENTER_AWAY',
          last_command_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (awayError) {
        toast.error(language === 'he' ? 'שגיאה בהפעלת מצב Away' : 'Failed to activate Away Mode');
        return false;
      }

      toast.success(
        language === 'he' 
          ? '🌙 מצב Away הופעל אוטומטית' 
          : '🌙 Away Mode activated automatically'
      );
      return true;
    } catch {
      return false;
    }
  };

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
      setMonitoringSettings(prev => ({
        ...prev,
        motionEnabled: false,
        babyMonitorEnabled: false,
      }));
      setShowSettingsDialogWrapped(true);
    } else {
      handleDisarm();
    }
  };

  const handleConfirmActivation = async () => {
    if (!deviceId) return;

    setIsUpdating(true);

    try {
      const awayOk = await ensureAwayModeActive();
      if (!awayOk) {
        setIsUpdating(false);
        return;
      }

      const { error: statusError } = await supabase
        .from('device_status')
        .update({
          is_armed: true,
          motion_enabled: monitoringSettings.motionEnabled,
          sound_enabled: false, // Sound detection removed
          baby_monitor_enabled: monitoringSettings.babyMonitorEnabled,
          last_command: 'ARM',
          last_command_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (statusError) {
        toast.error(language === 'he' ? 'שגיאה בהפעלת הניטור' : 'Failed to activate monitoring');
        return;
      }

      if (profileId) {
        await supabase
          .from('monitoring_config')
          .upsert({
            device_id: deviceId,
            profile_id: profileId,
            config: {
              monitoring_enabled: true,
              ai_validation_enabled: true,
              notification_cooldown_ms: 60000,
              baby_monitor_enabled: monitoringSettings.babyMonitorEnabled,
              sensors: {
                motion: {
                  enabled: monitoringSettings.motionEnabled,
                  targets: ['person', 'animal', 'vehicle'],
                  confidence_threshold: 0.7,
                  debounce_ms: 3000,
                },
                sound: {
                  enabled: false,
                  targets: [],
                  confidence_threshold: 0.6,
                  debounce_ms: 2000,
                },
              },
            },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'device_id' });
      }

      // Send monitoring command for both motion AND baby monitor modes
      // Baby Monitor needs SET_MONITORING:ON to activate the microphone immediately
      if (monitoringSettings.motionEnabled || monitoringSettings.babyMonitorEnabled) {
        const commandId = await sendMonitoringCommand('SET_MONITORING:ON');
        if (!commandId) {
          await supabase
            .from('device_status')
            .update({ is_armed: false })
            .eq('device_id', deviceId);
          toast.error(language === 'he' ? 'שגיאה בשליחת פקודה למכשיר' : 'Failed to send command to device');
          return;
        }
      }

      setIsArmed(true);
      setShowSettingsDialogWrapped(false);

      const sensors = [];
      if (monitoringSettings.motionEnabled) {
        sensors.push(language === 'he' ? 'תנועה' : 'Motion');
      }
      if (monitoringSettings.babyMonitorEnabled) {
        sensors.push(language === 'he' ? 'ניטור תינוק' : 'Baby Monitor');
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

  const handleDisarm = async () => {
    if (!deviceId) return;

    setIsUpdating(true);
    setShowSettingsDialogWrapped(false);

    try {
      // IMPORTANT: Disarm only stops sensors — Away Mode stays ON
      const { error: statusError } = await supabase
        .from('device_status')
        .update({
          is_armed: false,
          security_enabled: false,
          motion_enabled: false,
          sound_enabled: false,
          baby_monitor_enabled: false,
          last_command: 'DISARM',
          last_command_at: new Date().toISOString(),
          // NOTE: device_mode is NOT changed — Away Mode stays active
        })
        .eq('device_id', deviceId);

      if (statusError) {
        toast.error(language === 'he' ? 'שגיאה בכיבוי הניטור' : 'Failed to disarm monitoring');
        return;
      }

      const commandId = await sendMonitoringCommand('SET_MONITORING:OFF');
      if (!commandId) {
        console.error('[SecurityArmToggle] Failed to send SET_MONITORING:OFF');
      }

      setIsArmed(false);
      toast.success(language === 'he' ? '🔓 הניטור כובה • Away פעיל' : '🔓 Monitoring Off • Away Active');
    } catch (err) {
      console.error('[SecurityArmToggle] Unexpected error:', err);
      toast.error(language === 'he' ? 'שגיאה בלתי צפויה' : 'Unexpected error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!deviceId) return;

    setIsUpdating(true);
    try {
      const { error: statusError } = await supabase
        .from('device_status')
        .update({
          motion_enabled: monitoringSettings.motionEnabled,
          sound_enabled: false,
          baby_monitor_enabled: monitoringSettings.babyMonitorEnabled,
          last_command: 'UPDATE_SENSORS',
          last_command_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      if (statusError) {
        toast.error(language === 'he' ? 'שגיאה בעדכון הגדרות' : 'Failed to update settings');
        return;
      }

      if (profileId) {
        await supabase
          .from('monitoring_config')
          .upsert({
            device_id: deviceId,
            profile_id: profileId,
            config: {
              monitoring_enabled: true,
              ai_validation_enabled: true,
              notification_cooldown_ms: 60000,
              baby_monitor_enabled: monitoringSettings.babyMonitorEnabled,
              sensors: {
                motion: {
                  enabled: monitoringSettings.motionEnabled,
                  targets: ['person', 'animal', 'vehicle'],
                  confidence_threshold: 0.7,
                  debounce_ms: 3000,
                },
                sound: {
                  enabled: false,
                  targets: [],
                  confidence_threshold: 0.6,
                  debounce_ms: 2000,
                },
              },
            },
            updated_at: new Date().toISOString(),
          }, { onConflict: 'device_id' });
      }

      if (monitoringSettings.motionEnabled) {
        const commandId = await sendMonitoringCommand('SET_MONITORING:ON');
        if (!commandId) {
          console.warn('[SecurityArmToggle] Failed to send reload command');
        }
      }

      armedSettingsRef.current = {
        motionEnabled: monitoringSettings.motionEnabled,
        babyMonitorEnabled: monitoringSettings.babyMonitorEnabled,
      };

      setShowSettingsDialogWrapped(false);

      const sensors = [];
      if (monitoringSettings.motionEnabled) sensors.push(language === 'he' ? 'תנועה' : 'Motion');
      if (monitoringSettings.babyMonitorEnabled) sensors.push(language === 'he' ? 'ניטור תינוק' : 'Baby Monitor');

      toast.success(
        language === 'he'
          ? `🛡️ הגדרות עודכנו • ${sensors.join(' + ')}`
          : `🛡️ Settings updated • ${sensors.join(' + ')}`
      );
    } catch (err) {
      console.error('[SecurityArmToggle] Unexpected error:', err);
      toast.error(language === 'he' ? 'שגיאה בלתי צפויה' : 'Unexpected error');
    } finally {
      setIsUpdating(false);
    }
  };

  const settingsChanged = isArmed && armedSettingsRef.current != null && (
    armedSettingsRef.current.motionEnabled !== monitoringSettings.motionEnabled ||
    armedSettingsRef.current.babyMonitorEnabled !== monitoringSettings.babyMonitorEnabled
  );

  const getSensorStatusText = () => {
    if (!isArmed) {
      return language === 'he' ? 'מנוטרל • המתנה' : 'Disarmed • Standby';
    }

    const sensors = [];
    if (monitoringSettings.motionEnabled) {
      sensors.push(language === 'he' ? 'תנועה' : 'Motion');
    }
    if (monitoringSettings.babyMonitorEnabled) {
      sensors.push(language === 'he' ? 'ניטור תינוק' : 'Baby Monitor');
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

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              {language === 'he' ? 'מערכת אבטחה' : 'Security System'}
            </h3>
            <p className={`text-sm ${isArmed ? 'text-red-400' : 'text-slate-400'}`}>
              {getSensorStatusText()}
            </p>
          </div>

          {isArmed && (
            <button
              onClick={() => setShowSettingsDialogWrapped(true)}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              aria-label={language === 'he' ? 'הגדרות ניטור' : 'Monitoring settings'}
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

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
            <span className={`text-xs flex-1 ${securityEnabled ? 'text-red-400' : 'text-amber-400'}`}>
              {securityEnabled
                ? (language === 'he' ? 'מנטר פעיל' : 'Monitoring active')
                : (language === 'he' ? 'ממתין להפעלה מהמחשב…' : 'Waiting for computer…')}
            </span>
            <SensorStatusIndicator
              motionEnabled={monitoringSettings.motionEnabled}
              babyMonitorEnabled={monitoringSettings.babyMonitorEnabled}
              securityEnabled={securityEnabled}
              isArmed={isArmed}
            />
          </div>
        )}
      </div>

      <MonitoringSettingsDialog
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialogWrapped}
        settings={monitoringSettings}
        onSettingsChange={setMonitoringSettings}
        onConfirm={handleConfirmActivation}
        onDeactivate={handleDisarm}
        onUpdateSettings={handleUpdateSettings}
        settingsChanged={settingsChanged}
        isLoading={isUpdating}
        isArmed={isArmed}
        cameraStatus={
          isUpdating 
            ? 'loading' 
            : (securityEnabled && isArmed && monitoringSettings.motionEnabled)
              ? 'active' 
              : 'inactive'
        }
      />
    </>
  );
};
