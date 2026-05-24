// DownloadButton — v5 (2026-05-24): auto-detect Mac arch (arm64/x64) for Intel support
import React, { useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Monitor, Apple, ShieldAlert } from 'lucide-react';
import { DESKTOP_AGENT_DOWNLOAD_URLS, detectDesktopPlatform, getMacDownloadUrl } from '@/lib/desktopAgentDownloads';
import { Link } from 'react-router-dom';

export const DownloadButton: React.FC = () => {
  const { isRTL } = useLanguage();
  const os = useMemo(() => detectDesktopPlatform(), []);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const winUrl = DESKTOP_AGENT_DOWNLOAD_URLS.windows;
  const macUrl = useMemo(() => getMacDownloadUrl(), []);

  const triggerDownload = (url: string) => {
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
  };

  const btnClass =
    'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/30 font-semibold border-0 gap-3';

  const hiddenIframe = (
    <iframe ref={iframeRef} title="download" style={{ display: 'none' }} />
  );

  const macHint = (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 max-w-sm">
      <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
      <div className={isRTL ? 'text-right' : 'text-left'}>
        {isRTL ? (
          <>
            <strong>Mac:</strong> אם הדפדפן חוסם — לחץ <strong>"שמור"</strong>. אם פתיחת ה-DMG נחסמת — <strong>System Settings → Privacy &amp; Security → Open Anyway</strong>.{' '}
            <Link to="/installation-guide" className="underline">מדריך מלא</Link>
          </>
        ) : (
          <>
            <strong>Mac:</strong> If the browser blocks the file, click <strong>"Keep"</strong>. If the DMG won't open, go to <strong>System Settings → Privacy &amp; Security → Open Anyway</strong>.{' '}
            <Link to="/installation-guide" className="underline">Full guide</Link>
          </>
        )}
      </div>
    </div>
  );

  if (os === 'windows') {
    return (
      <>
        <Button size="lg" className={btnClass} onClick={() => triggerDownload(winUrl)}>
          <Monitor className="w-5 h-5" />
          {isRTL ? 'הורד ל-Windows' : 'Download for Windows'}
        </Button>
        {hiddenIframe}
      </>
    );
  }

  if (os === 'mac') {
    return (
      <div className="flex flex-col items-center">
        <Button size="lg" className={btnClass} onClick={() => triggerDownload(macUrl)}>
          <Apple className="w-5 h-5" />
          {isRTL ? 'הורד ל-Mac' : 'Download for Mac'}
        </Button>
        {macHint}
        {hiddenIframe}
      </div>
    );
  }

  // Fallback: show both
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <Button size="lg" className={btnClass} onClick={() => triggerDownload(winUrl)}>
          <Monitor className="w-5 h-5" />
          {isRTL ? 'הורד ל-Windows' : 'Download for Windows'}
        </Button>
        <Button size="lg" className={btnClass} onClick={() => triggerDownload(macUrl)}>
          <Apple className="w-5 h-5" />
          {isRTL ? 'הורד ל-Mac' : 'Download for Mac'}
        </Button>
      </div>
      {macHint}
      {hiddenIframe}
    </div>
  );
};
