/**
 * UpdateNotification - Electron Auto-Update UI
 * Shows update availability, download progress, and install prompt.
 * Only renders inside Electron (window.electronAPI exists).
 */

import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

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

const UpdateNotification = () => {
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const { language } = useLanguage();

  const isHe = language === 'he';

  const strings = {
    updateAvailable: isHe ? 'עדכון חדש זמין!' : 'New update available!',
    version: isHe ? 'גרסה' : 'Version',
    downloading: isHe ? 'מוריד עדכון...' : 'Downloading update...',
    downloaded: isHe ? 'העדכון מוכן להתקנה' : 'Update ready to install',
    restartInstall: isHe ? 'הפעל מחדש והתקן' : 'Restart & Install',
    download: isHe ? 'הורד עכשיו' : 'Download Now',
    dismiss: isHe ? 'אחר כך' : 'Later',
    error: isHe ? 'שגיאה בעדכון' : 'Update error',
  };

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

  // Don't render outside Electron or when idle/dismissed
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
