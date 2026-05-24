// VERSION: 2.52.59 — fixed public Mac download to latest arm64-safe release
const GITHUB_OWNER = 'ioranr1';
const GITHUB_REPO = 'cozy-project';

export const DESKTOP_AGENT_VERSION = '2.52.59';

const RELEASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${DESKTOP_AGENT_VERSION}`;

export type MacArch = 'arm64' | 'x64';
export type DesktopPlatform = 'windows' | 'mac' | 'unknown';

export const DESKTOP_AGENT_DOWNLOAD_URLS = {
  windows: `${RELEASE_URL}/Security-Camera-Agent-Setup-${DESKTOP_AGENT_VERSION}.exe`,
  mac: `${RELEASE_URL}/Security-Camera-Agent-arm64.dmg`,
  macArm64: `${RELEASE_URL}/Security-Camera-Agent-arm64.dmg`,
  macIntel: `${RELEASE_URL}/Security-Camera-Agent-x64.dmg`,
} as const;

export function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(ua)) return 'mac';
  return 'unknown';
}

/**
 * Detects Mac CPU architecture for optional/manual flows.
 * Public Mac downloads default to arm64 because browsers often report
 * Apple Silicon as "Intel Mac OS X" for compatibility.
 */
export function detectMacArch(): MacArch {
  if (typeof navigator === 'undefined') return 'arm64';
  const userAgentData = (navigator as Navigator & {
    userAgentData?: { architecture?: string; platform?: string };
  }).userAgentData;
  const arch = userAgentData?.architecture?.toLowerCase() || '';
  if (arch === 'arm' || arch === 'arm64') return 'arm64';
  if (arch === 'x86' || arch === 'x64') return 'x64';

  const ua = navigator.userAgent || '';
  // UA is not reliable on modern Macs, so only explicit non-Mac x64 is trusted.
  if (!/Mac/i.test(ua) && /x64|x86_64|Win64|WOW64/i.test(ua)) return 'x64';
  return 'arm64';
}

/**
 * Returns the correct download URL for the current device.
 * For Mac: auto-selects arm64 (Apple Silicon) or x64 (Intel).
 */
export function getMacDownloadUrl(): string {
  return DESKTOP_AGENT_DOWNLOAD_URLS.macArm64;
}
