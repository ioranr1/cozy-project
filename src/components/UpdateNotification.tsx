/**
 * UpdateNotification v2.54.0
 * Unified updater for Electron and Web PWA.
 * Web: בודק גרסה מול pwa_versions בכל דקה, מציג Toast כשמזוהה גרסה חדשה.
 *      גם משתמש ב-Service Worker (vite-plugin-pwa) כגיבוי.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/components/ui/sonner';
import { registerSW } from 'virtual:pwa-register';
import { usePwaVersion } from '@/hooks/usePwaVersion';

const PWA_VERSION_STORAGE_KEY = 'aiguard_pwa_acknowledged_version';

interface UpdateEvent {
  type: 'update-available' | 'update-not-available' | 'download-progress' | 'update-downloaded' | 'error';
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  message?: string;
  releaseDate?: string;
}

type UpdateState = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';

const WEB_UPDATE_TOAST_ID = 'aiguard-web-update-ready';
const WEB_UPDATE_CHECK_INTERVAL_MS = 60_000;
const WEB_UPDATE_AUTO_REFRESH_MS = 5 * 60_000;
const WEB_UPDATE_BLOCKED_ROUTE_PREFIXES = ['/viewer', '/live/', '/baby-monitor'];

const UpdateNotification = () => {
  const location = useLocation();
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [webUpdateReady, setWebUpdateReady] = useState(false);
  const [webToastDismissed, setWebToastDismissed] = useState(false);
  const { language } = useLanguage();
  const updateWebAppRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  // DB-driven version check (polls every 60s)
  const { currentVersion: dbVersion } = usePwaVersion(true);

  const isHe = language === 'he';
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).electronAPI?.onAutoUpdate);
  const isProtectedLiveRoute = useMemo(
    () => WEB_UPDATE_BLOCKED_ROUTE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix)),
    [location.pathname]
  );

  const strings = {
    updateAvailable: isHe ? 'עדכון חדש זמין!' : 'New update available!',
    version: isHe ? 'גרסה' : 'Version',
    downloading: isHe ? 'מוריד עדכון...' : 'Downloading update...',
    downloaded: isHe ? 'העדכון מוכן להתקנה' : 'Update ready to install',
    restartInstall: isHe ? 'הפעל מחדש והתקן' : 'Restart & Install',
    download: isHe ? 'הורד עכשיו' : 'Download Now',
    dismiss: isHe ? 'אחר כך' : 'Later',
    error: isHe ? 'שגיאה בעדכון' : 'Update error',
    webUpdateTitle: isHe ? 'גרסה חדשה זמינה' : 'New version available',
    webUpdateDescription: isHe
      ? 'האפליקציה תתרענן אוטומטית בעוד 5 דקות.'
      : 'The app will refresh automatically in 5 minutes.',
    refreshNow: isHe ? 'רענן עכשיו' : 'Refresh now',
  };

  const applyWebUpdate = useCallback(async () => {
    toast.dismiss(WEB_UPDATE_TOAST_ID);

    // עדכון הגרסה המאושרת לפני רענון, כדי שלא נראה Toast שוב מיד
    if (dbVersion) {
      try {
        localStorage.setItem(PWA_VERSION_STORAGE_KEY, dbVersion.version);
      } catch {
        /* ignore */
      }
    }

    if (!updateWebAppRef.current) {
      window.location.reload();
      return;
    }

    try {
      await updateWebAppRef.current(true);
    } catch (error) {
      console.error('[PWA Update] Failed to apply update:', error);
      window.location.reload();
      return;
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 2000);
  }, [dbVersion]);

  useEffect(() => {
    if (isElectron || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const isPreviewHost = window.location.hostname.includes('id-preview--');

    if (isInIframe || isPreviewHost) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      }).catch(() => undefined);
      return;
    }

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setWebUpdateReady(true);
        setWebToastDismissed(false);
      },
      onRegisterError(error) {
        console.error('[PWA Update] Service worker registration failed:', error);
      },
    });

    updateWebAppRef.current = updateSW;

    let isMounted = true;
    let intervalId: number | null = null;

    navigator.serviceWorker.ready.then((registration) => {
      if (!isMounted) return;

      if (registration.waiting) {
        setWebUpdateReady(true);
        setWebToastDismissed(false);
      }

      intervalId = window.setInterval(() => {
        void registration.update();
      }, WEB_UPDATE_CHECK_INTERVAL_MS);
    }).catch((error) => {
      console.error('[PWA Update] Failed to access service worker registration:', error);
    });

    return () => {
      isMounted = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [isElectron]);

  // ============================================================
  // DB-driven version check (Web only) — independent from Service Worker.
  // אם הגרסה ב-pwa_versions שונה מהגרסה שהמשתמש כבר אישר, נציג Toast.
  // ============================================================
  useEffect(() => {
    if (isElectron || !dbVersion) return;

    const acknowledged = localStorage.getItem(PWA_VERSION_STORAGE_KEY);
    if (!acknowledged) {
      localStorage.setItem(PWA_VERSION_STORAGE_KEY, dbVersion.version);
      return;
    }

    if (acknowledged !== dbVersion.version) {
      setWebUpdateReady(true);
      setWebToastDismissed(false);
    }
  }, [dbVersion, isElectron]);

  useEffect(() => {
    if (isElectron) return;

    if (!webUpdateReady || isProtectedLiveRoute || webToastDismissed) {
      toast.dismiss(WEB_UPDATE_TOAST_ID);
      return;
    }

    toast.custom(
      (toastId) => (
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{strings.webUpdateTitle}</p>
              <p className="text-xs text-muted-foreground">{strings.webUpdateDescription}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                toast.dismiss(toastId);
                void applyWebUpdate();
              }}
            >
              {strings.refreshNow}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setWebToastDismissed(true);
                toast.dismiss(toastId);
              }}
            >
              {strings.dismiss}
            </Button>
          </div>
        </div>
      ),
      {
        id: WEB_UPDATE_TOAST_ID,
        duration: Infinity,
        closeButton: false,
      }
    );
  }, [applyWebUpdate, isElectron, isProtectedLiveRoute, strings.dismiss, strings.refreshNow, strings.webUpdateDescription, strings.webUpdateTitle, webToastDismissed, webUpdateReady]);

  useEffect(() => {
    if (isElectron || !webUpdateReady || isProtectedLiveRoute) return;

    const timerId = window.setTimeout(() => {
      void applyWebUpdate();
    }, WEB_UPDATE_AUTO_REFRESH_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [applyWebUpdate, isElectron, isProtectedLiveRoute, webUpdateReady]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onAutoUpdate) return;

    api.onAutoUpdate((event: UpdateEvent) => {
      switch (event.type) {
        case 'update-available':
          setState('available');
          setVersion(event.version || '');
          setDismissed(false);
          break;
        case 'download-progress':
          setState('downloading');
          setProgress(event.percent || 0);
          break;
        case 'update-downloaded':
          setState('downloaded');
          setVersion(event.version || '');
          setDismissed(false);
          break;
        case 'error':
          setState('error');
          setErrorMsg(event.message || 'Unknown error');
          break;
        case 'update-not-available':
          setState('idle');
          break;
      }
    });
  }, []);

  const handleDownload = useCallback(() => {
    const api = (window as any).electronAPI;
    api?.downloadUpdate?.();
    setState('downloading');
    setProgress(0);
  }, []);

  const handleInstall = useCallback(() => {
    const api = (window as any).electronAPI;
    api?.installUpdate?.();
  }, []);

  // Web PWA notifications are handled via sonner toast above.
  // Visual card below remains Electron-only.
  if (!(window as any).electronAPI?.onAutoUpdate) return null;
  if (state === 'idle' || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] sm:left-auto sm:right-4 sm:max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-xl border border-border bg-card p-4 shadow-xl">
        {/* Available */}
        {state === 'available' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{strings.updateAvailable}</p>
                <p className="text-xs text-muted-foreground">{strings.version} {version}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleDownload} className="flex-1">
                {strings.download}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                {strings.dismiss}
              </Button>
            </div>
          </div>
        )}

        {/* Downloading */}
        {state === 'downloading' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{strings.downloading}</p>
                <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Downloaded */}
        {state === 'downloaded' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{strings.downloaded}</p>
                <p className="text-xs text-muted-foreground">{strings.version} {version}</p>
              </div>
            </div>
            <Button size="sm" onClick={handleInstall} className="w-full">
              {strings.restartInstall}
            </Button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{strings.error}</p>
                <p className="text-xs text-muted-foreground truncate">{errorMsg}</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} className="w-full">
              {strings.dismiss}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdateNotification;
