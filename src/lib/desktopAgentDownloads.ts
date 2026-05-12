const GITHUB_OWNER = 'ioranr1';
const GITHUB_REPO = 'cozy-project';

export const DESKTOP_AGENT_VERSION = '2.52.54';

const RELEASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${DESKTOP_AGENT_VERSION}`;

export const DESKTOP_AGENT_DOWNLOAD_URLS = {
  windows: `${RELEASE_URL}/Security-Camera-Agent-Setup-${DESKTOP_AGENT_VERSION}.exe`,
  mac: `${RELEASE_URL}/Security-Camera-Agent.dmg`,
} as const;

export type DesktopPlatform = 'windows' | 'mac' | 'unknown';

export function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'mac';
  return 'unknown';
}
