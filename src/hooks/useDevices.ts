import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Device {
  id: string;
  device_name: string;
  device_type: 'camera' | 'viewer' | 'controller';
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  profile_id: string;
}

interface UseDevicesReturn {
  devices: Device[];
  selectedDevice: Device | null;
  isLoading: boolean;
  error: string | null;
  selectDevice: (deviceId: string) => void;
  refreshDevices: () => Promise<void>;
  renameDevice: (deviceId: string, newName: string) => Promise<boolean>;
  deleteDevice: (deviceId: string) => Promise<boolean>;
  getDeviceStatus: (device: Device) => 'online' | 'offline' | 'unknown';
}

const SELECTED_DEVICE_KEY = 'aiguard_selected_device_id';

export const useDevices = (profileId: string | undefined): UseDevicesReturn => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_DEVICE_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!profileId) {
      setDevices([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('devices')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      // Type assertion - we trust the database structure
      const typedDevices = (data || []) as Device[];
      setDevices(typedDevices);

      // Auto-select first device if none selected
      if (!selectedDeviceId && typedDevices.length > 0) {
        const firstCameraDevice = typedDevices.find(d => d.device_type === 'camera');
        if (firstCameraDevice) {
          setSelectedDeviceId(firstCameraDevice.id);
          localStorage.setItem(SELECTED_DEVICE_KEY, firstCameraDevice.id);
        }
      }
    } catch (err) {
      console.error('[useDevices] Error fetching devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  }, [profileId, selectedDeviceId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Subscribe to realtime updates for devices
  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel('devices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          console.log('[useDevices] Realtime update:', payload);
          fetchDevices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, fetchDevices]);

  const selectDevice = useCallback((deviceId: string) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem(SELECTED_DEVICE_KEY, deviceId);
  }, []);

  const renameDevice = useCallback(async (deviceId: string, newName: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('devices')
        .update({ device_name: newName })
        .eq('id', deviceId);

      if (updateError) {
        throw updateError;
      }

      await fetchDevices();
      return true;
    } catch (err) {
      console.error('[useDevices] Error renaming device:', err);
      return false;
    }
  }, [fetchDevices]);

  const deleteDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (deleteError) {
        throw deleteError;
      }

      // Clear selection if deleted device was selected
      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId(null);
        localStorage.removeItem(SELECTED_DEVICE_KEY);
      }

      await fetchDevices();
      return true;
    } catch (err) {
      console.error('[useDevices] Error deleting device:', err);
      return false;
    }
  }, [selectedDeviceId, fetchDevices]);

  const getDeviceStatus = useCallback((device: Device): 'online' | 'offline' | 'unknown' => {
    if (!device.last_seen_at) return 'unknown';

    const lastSeen = new Date(device.last_seen_at);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

    if (diffSeconds <= 30 && device.is_active) {
      return 'online';
    }
    return 'offline';
  }, []);

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null;

  return {
    devices,
    selectedDevice,
    isLoading,
    error,
    selectDevice,
    refreshDevices: fetchDevices,
    renameDevice,
    deleteDevice,
    getDeviceStatus,
  };
};

// Helper to get selected device ID without hook
export const getSelectedDeviceId = (): string | null => {
  return localStorage.getItem(SELECTED_DEVICE_KEY);
};
