import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Download, Monitor, Apple } from 'lucide-react';

const GITHUB_OWNER = 'ioranr1';
const GITHUB_REPO = 'cozy-project';
const RELEASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download`;
const WIN_FILE = 'Security-Camera-Agent-Setup.exe';
const MAC_FILE = 'Security-Camera-Agent.dmg';

type DetectedOS = 'windows' | 'mac' | 'unknown';

function detectOS(): DetectedOS {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'mac';
  return 'unknown';
}

export const DownloadButton: React.FC = () => {
  const { isRTL } = useLanguage();
  const os = useMemo(() => detectOS(), []);

  const winUrl = `${RELEASE_URL}/${WIN_FILE}`;
  const macUrl = `${RELEASE_URL}/${MAC_FILE}`;

  const btnClass =
    'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/30 font-semibold border-0 gap-3';

  if (os === 'windows') {
    return (
      <a href={winUrl} download>
        <Button size="lg" className={btnClass}>
          <Monitor className="w-5 h-5" />
          {isRTL ? 'הורד ל-Windows' : 'Download for Windows'}
        </Button>
      </a>
    );
  }

  if (os === 'mac') {
    return (
      <a href={macUrl} download>
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
      <a href={winUrl} download>
        <Button size="lg" className={btnClass}>
          <Monitor className="w-5 h-5" />
          {isRTL ? 'הורד ל-Windows' : 'Download for Windows'}
        </Button>
      </a>
      <a href={macUrl} download>
        <Button size="lg" className={btnClass}>
          <Apple className="w-5 h-5" />
          {isRTL ? 'הורד ל-Mac' : 'Download for Mac'}
        </Button>
      </a>
    </div>
  );
};
