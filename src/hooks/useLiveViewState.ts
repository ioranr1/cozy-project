import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseLiveViewStateOptions {
  deviceId: string;
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
 * This ensures Supabase is the source of truth for live view state.
 */
export const useLiveViewState = ({ deviceId }: UseLiveViewStateOptions): UseLiveViewStateResult => {
  const [liveViewActive, setLiveViewActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastAckedCommand, setLastAckedCommand] = useState<string | null>(null);

  // Fetch the latest ACKed live view command from Supabase
  const fetchLatestAckedCommand = useCallback(async () => {
    if (!deviceId) {
      setIsLoading(false);
      return;
    }

    try {
      // Get the most recent ACKed live view command
      const { data, error } = await supabase
        .from('commands')
        .select('id, command, status, handled, handled_at, created_at')
        .eq('device_id', deviceId)
        .in('command', ['START_LIVE_VIEW', 'STOP_LIVE_VIEW'])
        .or('status.eq.ack,status.eq.acknowledged,status.eq.completed,handled.eq.true')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[useLiveViewState] Error fetching latest command:', error);
        setIsLoading(false);
        return;
      }

      if (data) {
        console.log('[useLiveViewState] Latest ACKed command:', data.command);
        setLastAckedCommand(data.command);
        setLiveViewActive(data.command === 'START_LIVE_VIEW');
      } else {
        console.log('[useLiveViewState] No ACKed live view commands found');
        setLiveViewActive(false);
        setLastAckedCommand(null);
      }
    } catch (err) {
      console.error('[useLiveViewState] Exception fetching command:', err);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  // Initial fetch
  useEffect(() => {
    fetchLatestAckedCommand();
  }, [fetchLatestAckedCommand]);

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
          console.log('[useLiveViewState] Command change received:', payload);
          
          const row = payload.new as {
            command?: string;
            status?: string;
            handled?: boolean;
            handled_at?: string;
          };

          // Only process live view commands
          if (row.command !== 'START_LIVE_VIEW' && row.command !== 'STOP_LIVE_VIEW') {
            return;
          }

          // Check if this command is ACKed
          const isAcked = 
            row.status === 'ack' || 
            row.status === 'acknowledged' || 
            row.status === 'completed' ||
            row.handled === true ||
            row.handled_at != null;

          if (isAcked) {
            console.log('[useLiveViewState] ACKed live view command detected:', row.command);
            setLastAckedCommand(row.command);
            setLiveViewActive(row.command === 'START_LIVE_VIEW');
          }
        }
      )
      .subscribe((status) => {
        console.log('[useLiveViewState] Subscription status:', status);
      });

    return () => {
      console.log('[useLiveViewState] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  return {
    liveViewActive,
    isLoading,
    lastAckedCommand,
    refreshState: fetchLatestAckedCommand,
  };
};
