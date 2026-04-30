import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, Monitor, Apple } from 'lucide-react';
import { DESKTOP_AGENT_DOWNLOAD_URLS, detectDesktopPlatform } from '@/lib/desktopAgentDownloads';

export const DownloadButton: React.FC = () => {
  const { isRTL } = useLanguage();
  const os = useMemo(() => detectDesktopPlatform(), []);

  const winUrl = DESKTOP_AGENT_DOWNLOAD_URLS.windows;
  const macUrl = DESKTOP_AGENT_DOWNLOAD_URLS.mac;

  const btnClass =
    'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/30 font-semibold border-0 gap-3';

  if (os === 'windows') {
    return (
      <a href={winUrl} target="_top" rel="noopener noreferrer">
        <Button size="lg" className={btnClass}>
          <Monitor className="w-5 h-5" />
          {isRTL ? 'הורד ל-Windows' : 'Download for Windows'}
        </Button>
      </a>
    );
  }

  if (os === 'mac') {
    return (
      <a href={macUrl} target="_top" rel="noopener noreferrer">
        <Button size="lg" className={btnClass}>
          <Apple className="w-5 h-5" />
          {isRTL ? 'הורד ל-Mac' : 'Download for Mac'}
        </Button>
      </a>
    );
  }

  // Fallback: show both
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <a href={winUrl} target="_top" rel="noopener noreferrer">
        <Button size="lg" className={btnClass}>
          <Monitor className="w-5 h-5" />
          {isRTL ? 'הורד ל-Windows' : 'Download for Windows'}
        </Button>
      </a>
      <a href={macUrl} target="_top" rel="noopener noreferrer">
        <Button size="lg" className={btnClass}>
          <Apple className="w-5 h-5" />
          {isRTL ? 'הורד ל-Mac' : 'Download for Mac'}
        </Button>
      </a>
    </div>
  );
};
