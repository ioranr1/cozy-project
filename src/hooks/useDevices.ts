import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  primaryDevice: Device | null;
  oldDevices: Device[];
  hasOldDevices: boolean;
  /** Changes every 10 seconds to force re-render for status updates */
  refreshKey: number;
}

const SELECTED_DEVICE_KEY = 'aiguard_selected_device_id';
const CONNECTION_THRESHOLD_SECONDS = 120;

export const useDevices = (profileId: string | undefined): UseDevicesReturn => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_DEVICE_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Keep latest selection in a ref so realtime callbacks and fetchDevices can always read it
  // without being forced into dependency loops.
  const selectedDeviceIdRef = useRef<string | null>(selectedDeviceId);
  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  const isConnected = useCallback((d: Device, at: Date) => {
    if (!d.last_seen_at) return false;
    const lastSeen = new Date(d.last_seen_at);
    const diffSeconds = (at.getTime() - lastSeen.getTime()) / 1000;
    return diffSeconds <= CONNECTION_THRESHOLD_SECONDS;
  }, []);

  const sortByLastSeenDesc = useCallback((list: Device[]) => {
    return [...list].sort((a, b) => {
      const ta = a.last_seen_at ? new Date(a.last_seen_at).getTime() : Number.NEGATIVE_INFINITY;
      const tb = b.last_seen_at ? new Date(b.last_seen_at).getTime() : Number.NEGATIVE_INFINITY;
      return tb - ta;
    });
  }, []);

  const reconcileSelectedCameraId = useCallback(
    (allDevices: Device[], currentSelectedId: string | null, at: Date): string | null => {
      const cameraDevices = allDevices.filter((d) => d.device_type === 'camera');
      if (cameraDevices.length === 0) return null;

      const currentSelectionValid = !!(currentSelectedId && cameraDevices.some((d) => d.id === currentSelectedId));
      const selectedCamera = cameraDevices.find((d) => d.id === currentSelectedId) || null;
      const selectedIsConnected = !!(selectedCamera && isConnected(selectedCamera, at));

      const connectedCameras = sortByLastSeenDesc(cameraDevices.filter((d) => isConnected(d, at)));
      const bestConnected = connectedCameras[0] || null;

      // If there is any connected camera and our current selection is missing/offline,
      // automatically switch to the connected one. This prevents the Dashboard from
      // turning yellow after 120s when another device is actually heartbeating.
      if (bestConnected && (!currentSelectionValid || !selectedIsConnected)) {
        return bestConnected.id;
      }

      // If selection doesn't exist anymore, fallback to newest camera.
      if (!currentSelectionValid) {
        return sortByLastSeenDesc(cameraDevices)[0].id;
      }

      return currentSelectedId;
    },
    [isConnected, sortByLastSeenDesc]
  );

  // Update "now" every 10 seconds to keep status fresh
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = useCallback(async () => {
    if (!profileId) {
      setDevices([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch only active devices, sorted by last_seen_at descending
      const { data, error: fetchError } = await supabase
        .from('devices')
        .select('*')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .order('last_seen_at', { ascending: false, nullsFirst: false });

      if (fetchError) {
        throw fetchError;
      }

      // Type assertion - we trust the database structure
      const typedDevices = sortByLastSeenDesc((data || []) as Device[]);
      setDevices(typedDevices);

      // Auto-select a camera when needed.
      const desiredId = reconcileSelectedCameraId(typedDevices, selectedDeviceIdRef.current, new Date());
      if (desiredId && desiredId !== selectedDeviceIdRef.current) {
        setSelectedDeviceId(desiredId);
        localStorage.setItem(SELECTED_DEVICE_KEY, desiredId);
        console.log('[useDevices] Reconciled selected camera:', desiredId);
      }
    } catch (err) {
      console.error('[useDevices] Error fetching devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  }, [profileId, reconcileSelectedCameraId, sortByLastSeenDesc]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Subscribe to realtime updates for devices
  useEffect(() => {
    if (!profileId) return;

    console.log('[useDevices] Setting up realtime subscription for profile:', profileId);
    
    const channel = supabase
      .channel(`devices-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          console.log('[useDevices] Realtime UPDATE:', payload);
          const at = new Date();

          // Update device in state directly for faster UI response
          setDevices(prev => {
            const updated = sortByLastSeenDesc(
              prev.map(d => (d.id === payload.new.id ? ({ ...d, ...payload.new } as Device) : d))
            );

            // Reconcile selection on heartbeat updates too (critical when multiple camera rows exist)
            const desiredId = reconcileSelectedCameraId(updated, selectedDeviceIdRef.current, at);
            if (desiredId && desiredId !== selectedDeviceIdRef.current) {
              selectedDeviceIdRef.current = desiredId; // keep ref in sync immediately
              setSelectedDeviceId(desiredId);
              localStorage.setItem(SELECTED_DEVICE_KEY, desiredId);
              console.log('[useDevices] Auto-switched selection to connected camera:', desiredId);
            }

            return updated;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'devices',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          console.log('[useDevices] Realtime INSERT:', payload);
          fetchDevices();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'devices',
          filter: `profile_id=eq.${profileId}`,
        },
        (payload) => {
          console.log('[useDevices] Realtime DELETE:', payload);
          fetchDevices();
        }
      )
      .subscribe((status) => {
        console.log('[useDevices] Subscription status:', status);
      });

    return () => {
      console.log('[useDevices] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [profileId, fetchDevices, reconcileSelectedCameraId, sortByLastSeenDesc]);

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

  // Status is determined ONLY by last_seen_at (within 30 seconds = online)
  const getDeviceStatus = useCallback((device: Device): 'online' | 'offline' | 'unknown' => {
    if (!device.last_seen_at) return 'unknown';

    const lastSeen = new Date(device.last_seen_at);
    const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;

    if (diffSeconds <= CONNECTION_THRESHOLD_SECONDS) {
      return 'online';
    }
    return 'offline';
  }, [now]);

  const selectedDevice = useMemo(() => {
    return devices.find(d => d.id === selectedDeviceId) || null;
  }, [devices, selectedDeviceId]);

  // Compute primary and old devices for camera type using useMemo
  const { primaryDevice, oldDevices, hasOldDevices } = useMemo(() => {
    const cameraDevices = devices.filter(d => d.device_type === 'camera');
    
    // Find connected devices (last_seen_at within threshold)
    const connectedCameras = cameraDevices.filter(d => {
      if (!d.last_seen_at) return false;
      const lastSeen = new Date(d.last_seen_at);
      const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
      return diffSeconds <= CONNECTION_THRESHOLD_SECONDS;
    });
    
    let primary: Device | null = null;
    let old: Device[] = [];
    
    if (connectedCameras.length > 0) {
      // If there's at least one connected camera, show only the most recently connected
      primary = connectedCameras[0]; // Already sorted by last_seen_at desc
      // Old devices are all others (both connected and disconnected, except primary)
      old = cameraDevices.filter(d => d.id !== primary!.id);
    } else {
      // No connected cameras - show all as disconnected
      primary = cameraDevices.length > 0 ? cameraDevices[0] : null;
      old = cameraDevices.slice(1);
    }

    return {
      primaryDevice: primary,
      oldDevices: old,
      hasOldDevices: old.length > 0,
    };
  }, [devices, now]);

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
    primaryDevice,
    oldDevices,
    hasOldDevices,
    refreshKey: now.getTime(),
  };
};

// Helper to get selected device ID without hook
export const getSelectedDeviceId = (): string | null => {
  return localStorage.getItem(SELECTED_DEVICE_KEY);
};
