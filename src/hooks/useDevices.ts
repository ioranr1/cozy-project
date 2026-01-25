import { useState, useEffect, useCallback, useMemo } from 'react';
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
export const DEVICE_ONLINE_THRESHOLD_SECONDS = 120;

// Supabase/PostgREST can return timestamps in formats that Safari doesn't parse reliably
// (e.g. "YYYY-MM-DD HH:mm:ss+00"). This normalizes to ISO 8601.
export const parseDbTimestamp = (value: string | null): Date | null => {
  if (!value) return null;

  let s = value.trim();
  // Convert "YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(' ', 'T');
  }
  // Convert "+00" or "-05" -> "+00:00" / "-05:00" (Safari requirement)
  if (/([+-]\d{2})$/.test(s)) {
    s = `${s}:00`;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const secondsSince = (lastSeen: Date, now: Date) => (now.getTime() - lastSeen.getTime()) / 1000;

export const useDevices = (profileId: string | undefined): UseDevicesReturn => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    return localStorage.getItem(SELECTED_DEVICE_KEY);
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  // Counter to force re-render when realtime updates arrive
  const [realtimeUpdateCounter, setRealtimeUpdateCounter] = useState(0);

  // Update "now" every 10 seconds to keep status fresh
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading !== false;
    if (!profileId) {
      setDevices([]);
      setIsLoading(false);
      return;
    }

    try {
      if (showLoading) setIsLoading(true);
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
      const typedDevices = (data || []) as Device[];
      setDevices(typedDevices);

      // Auto-select a camera when needed.
      const cameraDevices = typedDevices.filter(d => d.device_type === 'camera');
      const currentSelectionValid = selectedDeviceId && cameraDevices.some(d => d.id === selectedDeviceId);

      const connectedCamera = cameraDevices.find(d => {
        const lastSeen = parseDbTimestamp(d.last_seen_at);
        if (!lastSeen) return false;
        return secondsSince(lastSeen, new Date()) <= DEVICE_ONLINE_THRESHOLD_SECONDS;
      });

      const selectedCamera = cameraDevices.find(d => d.id === selectedDeviceId) || null;
      const selectedIsConnected = !!(
        selectedCamera?.last_seen_at &&
        (() => {
          const lastSeen = parseDbTimestamp(selectedCamera.last_seen_at);
          if (!lastSeen) return false;
          return secondsSince(lastSeen, new Date()) <= DEVICE_ONLINE_THRESHOLD_SECONDS;
        })()
      );

      // If we have a connected camera, and the current selection is missing or disconnected,
      // switch selection to the connected one.
      if (connectedCamera && (!currentSelectionValid || !selectedIsConnected)) {
        if (selectedDeviceId !== connectedCamera.id) {
          setSelectedDeviceId(connectedCamera.id);
          localStorage.setItem(SELECTED_DEVICE_KEY, connectedCamera.id);
          console.log('[useDevices] Auto-selected connected camera:', connectedCamera.device_name, connectedCamera.id);
        }
        return;
      }
      
      if (!currentSelectionValid && cameraDevices.length > 0) {
        // Select the camera with most recent last_seen_at
        const newestCamera = cameraDevices[0];
        setSelectedDeviceId(newestCamera.id);
        localStorage.setItem(SELECTED_DEVICE_KEY, newestCamera.id);
        console.log('[useDevices] Auto-selected newest camera:', newestCamera.device_name, newestCamera.id);
      }
    } catch (err) {
      console.error('[useDevices] Error fetching devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]); // Removed selectedDeviceId dependency to prevent re-subscribe loops

  useEffect(() => {
    fetchDevices({ showLoading: true });
  }, [fetchDevices]);

  // Fallback: periodic refresh in case Realtime is unavailable or the tab slept.
  // This prevents false "Not Linked" due to stale last_seen_at in the UI.
  useEffect(() => {
    if (!profileId) return;
    const interval = setInterval(() => {
      fetchDevices({ showLoading: false });
    }, 30000);
    return () => clearInterval(interval);
  }, [profileId, fetchDevices]);

  // Refresh when returning to the tab/window (common case on mobile/when backgrounded)
  useEffect(() => {
    if (!profileId) return;

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') {
        fetchDevices({ showLoading: false });
      }
    };

    document.addEventListener('visibilitychange', refreshOnFocus);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnFocus);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [profileId, fetchDevices]);

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
          const updatedDevice = payload.new as Device;
          
          // Force "now" to update so status recalculates immediately
          setNow(new Date());
          setRealtimeUpdateCounter(prev => prev + 1);
          
          // Update device in state directly for faster UI response
          setDevices(prev => {
            const newDevices = prev.map(d => 
              d.id === updatedDevice.id ? { ...d, ...updatedDevice } as Device : d
            );
            
            // Check if we should auto-switch to a newly connected camera
            const currentSelectedId = localStorage.getItem(SELECTED_DEVICE_KEY);
            if (updatedDevice.device_type === 'camera' && updatedDevice.last_seen_at) {
              const updatedLastSeen = parseDbTimestamp(updatedDevice.last_seen_at);
              const isUpdatedOnline = !!(
                updatedLastSeen && secondsSince(updatedLastSeen, new Date()) <= DEVICE_ONLINE_THRESHOLD_SECONDS
              );
              
              // If the updated device is now online and it's NOT the currently selected one
              if (isUpdatedOnline && currentSelectedId !== updatedDevice.id) {
                // Check if the currently selected device is offline
                const currentSelected = newDevices.find(d => d.id === currentSelectedId);
                const currentLastSeen = parseDbTimestamp(currentSelected?.last_seen_at ?? null);
                const isCurrentOffline = !currentLastSeen ||
                  secondsSince(currentLastSeen, new Date()) > DEVICE_ONLINE_THRESHOLD_SECONDS;
                
                if (isCurrentOffline) {
                  console.log('[useDevices] Auto-switching to connected camera:', updatedDevice.device_name, updatedDevice.id);
                  setSelectedDeviceId(updatedDevice.id);
                  localStorage.setItem(SELECTED_DEVICE_KEY, updatedDevice.id);
                }
              }
            }
            
            return newDevices;
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
          const newDevice = payload.new as Device;
          
          // Auto-select new camera device immediately
          if (newDevice.device_type === 'camera') {
            console.log('[useDevices] Auto-selecting new camera:', newDevice.device_name, newDevice.id);
            setSelectedDeviceId(newDevice.id);
            localStorage.setItem(SELECTED_DEVICE_KEY, newDevice.id);
          }
          
          fetchDevices({ showLoading: false });
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
          fetchDevices({ showLoading: false });
        }
      )
      .subscribe((status) => {
        console.log('[useDevices] Subscription status:', status);
      });

    return () => {
      console.log('[useDevices] Cleaning up subscription');
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

  // Status is determined ONLY by last_seen_at
  const getDeviceStatus = useCallback((device: Device): 'online' | 'offline' | 'unknown' => {
    const lastSeen = parseDbTimestamp(device.last_seen_at);
    if (!lastSeen) return 'unknown';

    const diffSeconds = secondsSince(lastSeen, now);
    if (diffSeconds <= DEVICE_ONLINE_THRESHOLD_SECONDS) {
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
      const lastSeen = parseDbTimestamp(d.last_seen_at);
      if (!lastSeen) return false;
      return secondsSince(lastSeen, now) <= DEVICE_ONLINE_THRESHOLD_SECONDS;
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

  const refreshDevices = useCallback(async () => {
    await fetchDevices({ showLoading: true });
  }, [fetchDevices]);

  return {
    devices,
    selectedDevice,
    isLoading,
    error,
    selectDevice,
    refreshDevices,
    renameDevice,
    deleteDevice,
    getDeviceStatus,
    primaryDevice,
    oldDevices,
    hasOldDevices,
    refreshKey: now.getTime() + realtimeUpdateCounter,
  };
};

// Helper to get selected device ID without hook
export const getSelectedDeviceId = (): string | null => {
  return localStorage.getItem(SELECTED_DEVICE_KEY);
};
