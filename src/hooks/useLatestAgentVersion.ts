/**
 * useLatestAgentVersion v1.0.0
 * שולף את הגרסה האחרונה של סוכן האלקטרון מ-GitHub Releases.
 * Fallback בטוח: אם הקריאה נכשלת — מחזיר את DESKTOP_AGENT_VERSION (הקבוע המקומי).
 * Cache של 5 דקות ב-localStorage כדי לא להציף את GitHub API (rate limit 60/h).
 *
 * ⚠️ Display only — לא משפיע על קישורי ההורדה (אלה ממשיכים לעבוד מ-DESKTOP_AGENT_VERSION).
 */
import { useEffect, useState } from 'react';
import { DESKTOP_AGENT_VERSION } from '@/lib/desktopAgentDownloads';

const GITHUB_API_URL = 'https://api.github.com/repos/ioranr1/cozy-project/releases/latest';
const CACHE_KEY = 'aiguard:latest-agent-version';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 דקות

interface CachedVersion {
  version: string;
  fetchedAt: number;
}

function readCache(): CachedVersion | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedVersion;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(version: string) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ version, fetchedAt: Date.now() } satisfies CachedVersion)
    );
  } catch {
    // ignore quota errors
  }
}

export function useLatestAgentVersion() {
  const [version, setVersion] = useState<string>(() => {
    return readCache()?.version || DESKTOP_AGENT_VERSION;
  });
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'github' | 'cache' | 'fallback'>(
    readCache() ? 'cache' : 'fallback'
  );

  useEffect(() => {
    const cached = readCache();
    if (cached) return; // Cache עדיין תקף — לא קוראים שוב

    let cancelled = false;
    setLoading(true);

    fetch(GITHUB_API_URL, { headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        return res.json();
      })
      .then((data: { tag_name?: string }) => {
        if (cancelled) return;
        const tag = (data.tag_name || '').replace(/^v/, '').trim();
        if (tag) {
          setVersion(tag);
          setSource('github');
          writeCache(tag);
        }
      })
      .catch((err) => {
        console.warn('[useLatestAgentVersion] Falling back to constant:', err);
        // נשארים עם DESKTOP_AGENT_VERSION
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { version, loading, source };
}
