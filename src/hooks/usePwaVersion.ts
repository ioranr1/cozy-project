/**
 * usePwaVersion v1.0.0
 * Hook לקריאת גרסת ה-PWA הנוכחית מהמסד.
 * הגרסה מנוהלת מטבלת pwa_versions ע"י אדמין.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PwaVersion {
  id: string;
  version: string;
  released_at: string;
  changelog_he: string;
  changelog_en: string;
  is_current: boolean;
}

const POLL_INTERVAL_MS = 60_000; // בודק כל דקה

export function usePwaVersion(autoPoll = false) {
  const [currentVersion, setCurrentVersion] = useState<PwaVersion | null>(null);
  const [allVersions, setAllVersions] = useState<PwaVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('pwa_versions')
        .select('*')
        .order('released_at', { ascending: false });

      if (error) {
        console.error('[usePwaVersion] Fetch error:', error);
        return;
      }

      const versions = (data || []) as PwaVersion[];
      setAllVersions(versions);
      setCurrentVersion(versions.find((v) => v.is_current) || versions[0] || null);
    } catch (e) {
      console.error('[usePwaVersion] Unexpected error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();

    if (!autoPoll) return;

    const intervalId = window.setInterval(fetchVersions, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [autoPoll]);

  return { currentVersion, allVersions, loading, refetch: fetchVersions };
}
