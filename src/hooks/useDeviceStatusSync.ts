import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export interface MonitoringSettings {
  motionEnabled: boolean;
  babyMonitorEnabled: boolean;
}

interface UseDeviceStatusSyncResult {
  isArmed: boolean;
  setIsArmed: (v: boolean) => void;
  securityEnabled: boolean;
  monitoringSettings: MonitoringSettings;
  setMonitoringSettings: React.Dispatch<React.SetStateAction<MonitoringSettings>>;
  armedSettingsRef: React.MutableRefObject<{ motionEnabled: boolean; babyMonitorEnabled: boolean } | null>;
  isLoading: boolean;
  fetchStatus: () => Promise<void>;
}

/**
 * Isolated device status synchronization hook.
 * 
 * CRITICAL DESIGN: Each monitoring mode owns ONLY its own flags.
 * The sanity check logic is mode-aware and will NEVER reset flags
 * belonging to another active mode:
 * 
 * - Motion mode owns: motion_enabled, security_enabled
 * - Baby Monitor mode owns: baby_monitor_enabled
 * - Live View: does NOT touch any flags
 * 
 * This prevents the root cause of regressions where fixing one mode
 * breaks another through shared sanity check logic.
 */
export const useDeviceStatusSync = (
  deviceId: string | undefined,
  dialogOpenRef: React.MutableRefObject<boolean>
): UseDeviceStatusSyncResult => {
  const [isArmed, setIsArmed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(false);
  const [monitoringSettings, setMonitoringSettings] = useState<MonitoringSettings>({
    motionEnabled: false,
    babyMonitorEnabled: false,
  });
  const armedSettingsRef = useRef<{ motionEnabled: boolean; babyMonitorEnabled: boolean } | null>(null);

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
        console.error('[useDeviceStatusSync] Error fetching status:', error);
        return;
      }

      if (data) {
        const status = data as DeviceStatus;

        // ─── MODE-AWARE SANITY CHECK ───────────────────────────
        // Only reset if ALL of these are true:
        //   1. is_armed is true
        //   2. security_enabled is false (Electron hasn't confirmed hardware)
        //   3. baby_monitor_enabled is false (NOT in baby monitor mode)
        //   4. motion_enabled is false OR no recent ARM command exists
        //
        // If baby_monitor_enabled is true → Baby Monitor flow is active,
        // do NOT touch anything — that flow manages its own lifecycle.
        //
        // If security_enabled is true → Electron confirmed hardware,
        // do NOT reset — motion detection is running.
        // ─────────────────────────────────────────────────────────
        
        const isOrphanedArm = 
          status.is_armed && 
          !status.security_enabled && 
          !status.baby_monitor_enabled && 
          !status.motion_enabled;

        if (isOrphanedArm) {
          // Check if there's a recent ARM command — if so, Electron may still be processing
          const { data: cmdData } = await supabase
            .from('commands')
            .select('id')
            .eq('device_id', deviceId)
            .eq('command', 'SET_MONITORING:ON')
            .order('created_at', { ascending: false })
            .limit(1);

          if (!cmdData || cmdData.length === 0) {
            console.log('[useDeviceStatusSync] Orphaned arm detected — resetting flags (no active mode)');
            await supabase
              .from('device_status')
              .update({
                is_armed: false,
                security_enabled: false,
                motion_enabled: false,
                sound_enabled: false,
                baby_monitor_enabled: false,
              })
              .eq('device_id', deviceId);
            setIsArmed(false);
          } else {
            // Command exists — Electron is likely still processing
            setIsArmed(status.is_armed);
          }
        } else {
          // Normal state — trust the DB values
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
        console.log('[useDeviceStatusSync] No status found, creating initial record');
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
          console.error('[useDeviceStatusSync] Error creating status:', insertError);
        }
      }
    } catch (err) {
      console.error('[useDeviceStatusSync] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  // ─── REALTIME SUBSCRIPTION ──────────────────────────────────
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
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          console.log('[useDeviceStatusSync] 🔔 Realtime update:', payload.new);
          const newStatus = payload.new as DeviceStatus;
          setIsArmed(newStatus.is_armed);
          setSecurityEnabled(newStatus.security_enabled ?? false);
          // Don't overwrite user selections while settings dialog is open
          if (!dialogOpenRef.current) {
            setMonitoringSettings({
              motionEnabled: newStatus.motion_enabled ?? true,
              babyMonitorEnabled: newStatus.baby_monitor_enabled ?? false,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStatus, deviceId, dialogOpenRef]);

  return {
    isArmed,
    setIsArmed,
    securityEnabled,
    monitoringSettings,
    setMonitoringSettings,
    armedSettingsRef,
    isLoading,
    fetchStatus,
  };
};
