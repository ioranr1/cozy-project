// VERSION: 2.52.58 — added Intel (x64) Mac support with auto-detection
const GITHUB_OWNER = 'ioranr1';
const GITHUB_REPO = 'cozy-project';

export const DESKTOP_AGENT_VERSION = '2.52.58';

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
 * Detects Mac CPU architecture. Defaults to 'arm64' (Apple Silicon)
 * when detection is uncertain — safe fallback since most modern Macs are M-series.
 */
export function detectMacArch(): MacArch {
  if (typeof navigator === 'undefined') return 'arm64';
  const ua = navigator.userAgent || '';
  // Intel Macs explicitly report "Intel Mac OS X" in UA
  if (/Intel Mac OS X/i.test(ua)) return 'x64';
  // Apple Silicon Macs report just "Macintosh" without Intel
  if (/Macintosh/i.test(ua) && !/Intel/i.test(ua)) return 'arm64';
  return 'arm64';
}

/**
 * Returns the correct download URL for the current device.
 * For Mac: auto-selects arm64 (Apple Silicon) or x64 (Intel).
 */
export function getMacDownloadUrl(): string {
  return detectMacArch() === 'x64'
    ? DESKTOP_AGENT_DOWNLOAD_URLS.macIntel
    : DESKTOP_AGENT_DOWNLOAD_URLS.macArm64;
}
