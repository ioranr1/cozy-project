import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseLiveViewStateOptions {
  deviceId: string | null | undefined;
}

interface UseLiveViewStateResult {
  liveViewActive: boolean;
  isLoading: boolean;
  lastAckedCommand: string | null;
  refreshState: () => Promise<void>;
}

/**
 * Hook that subscribes to the commands table and derives liveViewActive
 * based on the latest ACKed command (START_LIVE_VIEW or STOP_LIVE_VIEW).
 * Supabase is the SOLE source of truth for live view state.
 */
export function useLiveViewState(options: UseLiveViewStateOptions): UseLiveViewStateResult {
  // Track mount state FIRST to avoid state updates after unmount
  const isMountedRef = useRef<boolean>(true);
  
  const [liveViewActive, setLiveViewActive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastAckedCommand, setLastAckedCommand] = useState<string | null>(null);

  const { deviceId } = options;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetch the latest ACKed live view command from Supabase.
   * Query: status = 'ack', order by handled_at DESC, limit 1.
   */
  const fetchLatestAckedCommand = useCallback(async () => {
    if (!deviceId) {
      if (isMountedRef.current) {
        setIsLoading(false);
        setLiveViewActive(false);
        setLastAckedCommand(null);
      }
      return;
    }

    try {
      // Query the latest ACKed live view command ordered by handled_at DESC
      // Flexibility: Accept 'ack', 'acknowledged', 'completed' OR handled=true OR handled_at IS NOT NULL
      const { data, error } = await supabase
        .from('commands')
        .select('id, command, status, handled, handled_at')
        .eq('device_id', deviceId)
        .in('command', ['START_LIVE_VIEW', 'STOP_LIVE_VIEW'])
        .or('status.in.(ack,acknowledged,completed),handled.eq.true,handled_at.not.is.null')
        .order('handled_at', { ascending: false, nullsFirst: false })
        .limit(1);

      if (!isMountedRef.current) return;

      if (error) {
        console.error('[useLiveViewState] Error fetching commands:', error);
        setIsLoading(false);
        return;
      }

      const latestAcked = data && data.length > 0 ? data[0] : null;

      if (latestAcked) {
        const isActive = latestAcked.command === 'START_LIVE_VIEW';
        // Only update state if value actually changed - prevents infinite re-render loops
        setLastAckedCommand(prev => {
          if (prev !== latestAcked.command) {
            console.log('[useLiveViewState] Latest ACKed command:', latestAcked.command, '→ liveViewActive:', isActive);
            return latestAcked.command;
          }
          return prev;
        });
        setLiveViewActive(prev => prev !== isActive ? isActive : prev);
      } else {
        // Only update if different from current state
        setLiveViewActive(prev => prev !== false ? false : prev);
        setLastAckedCommand(prev => prev !== null ? null : prev);
      }
    } catch (err) {
      console.error('[useLiveViewState] Exception fetching command:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [deviceId]);

  // Initial fetch
  useEffect(() => {
    fetchLatestAckedCommand();
  }, [fetchLatestAckedCommand]);

  // Poll fallback (in case Realtime doesn't fire on some mobile browsers)
  // Only poll when on viewer-related pages to avoid unnecessary DB calls
  useEffect(() => {
    if (!deviceId) return;

    // Check if we're on a page that needs live view polling
    const isViewerPage = (): boolean => {
      const path = window.location.pathname;
      return path.includes('/viewer') || path.includes('/live');
    };

    // Only set up polling on viewer pages
    if (!isViewerPage()) {
      console.log('[useLiveViewState] Not on viewer page, skipping polling');
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible' && isViewerPage()) {
        fetchLatestAckedCommand();
      }
    }, 5000); // Increased to 5 seconds to reduce load

    return () => window.clearInterval(interval);
  }, [deviceId, fetchLatestAckedCommand]);

  // Subscribe to realtime changes on the commands table
  useEffect(() => {
    if (!deviceId) return;

    console.log('[useLiveViewState] Setting up realtime subscription for device:', deviceId);

    const channel = supabase
      .channel(`live-view-state-${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'commands',
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          console.log('[useLiveViewState] Realtime update received, re-fetching state');
          // Always re-fetch from DB to ensure we have the correct latest ACKed command
          fetchLatestAckedCommand();
        }
      )
      .subscribe((status) => {
        console.log('[useLiveViewState] Subscription status:', status);
      });

    return () => {
      console.log('[useLiveViewState] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [deviceId, fetchLatestAckedCommand]);

  return {
    liveViewActive,
    isLoading,
    lastAckedCommand,
    refreshState: fetchLatestAckedCommand,
  };
};
