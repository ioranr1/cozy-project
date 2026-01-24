import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FeatureFlags {
  away_mode: boolean;
  security_mode: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  away_mode: false,
  security_mode: false,
};

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    try {
      // Query feature_flags table - columns are 'name' and 'enabled'
      const { data, error } = await supabase
        .from('feature_flags')
        .select('name, enabled')
        .in('name', ['away_mode', 'security_mode']);

      if (error) {
        console.error('[useFeatureFlags] Error fetching flags:', error);
        return;
      }

      if (data && Array.isArray(data)) {
        const newFlags = { ...DEFAULT_FLAGS };
        data.forEach((row) => {
          if (row.name === 'away_mode') {
            newFlags.away_mode = row.enabled;
          } else if (row.name === 'security_mode') {
            newFlags.security_mode = row.enabled;
          }
        });
        setFlags(newFlags);
      }
    } catch (err) {
      console.error('[useFeatureFlags] Unexpected error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('feature_flags_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'feature_flags',
        },
        () => {
          console.log('[useFeatureFlags] Realtime update detected');
          fetchFlags();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFlags]);

  return { flags, isLoading, refetch: fetchFlags };
};
