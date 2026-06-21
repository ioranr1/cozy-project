// VERSION: 2.52.60 — restored real Mac arch detection (Intel vs Apple Silicon)
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
 * Synchronous best-effort detection (used as fallback).
 * For accurate detection use detectMacArchAsync() which uses
 * navigator.userAgentData.getHighEntropyValues({architecture}).
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
  if (!/Mac/i.test(ua) && /x64|x86_64|Win64|WOW64/i.test(ua)) return 'x64';
  return 'arm64';
}

/**
 * Async accurate Mac CPU detection using High-Entropy Client Hints.
 * Works on Chrome/Edge/Brave. Returns 'arm64' or 'x64' reliably.
 * Falls back to sync detection on Safari/Firefox.
 */
export async function detectMacArchAsync(): Promise<MacArch> {
  if (typeof navigator === 'undefined') return 'arm64';
  const uaData = (navigator as Navigator & {
    userAgentData?: {
      getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; bitness?: string }>;
    };
  }).userAgentData;

  if (uaData?.getHighEntropyValues) {
    try {
      const hints = await uaData.getHighEntropyValues(['architecture', 'bitness']);
      const arch = (hints.architecture || '').toLowerCase();
      if (arch === 'arm' || arch === 'arm64') return 'arm64';
      if (arch === 'x86' || arch === 'x86_64' || arch === 'x64') return 'x64';
    } catch {
      // fall through to sync fallback
    }
  }
  return detectMacArch();
}

/**
 * Returns the correct Mac download URL based on detected CPU.
 * - Apple Silicon (M1/M2/M3/M4) → arm64.dmg
 * - Intel Mac → x64.dmg
 */
export async function getMacDownloadUrl(): Promise<string> {
  const arch = await detectMacArchAsync();
  return arch === 'x64'
    ? DESKTOP_AGENT_DOWNLOAD_URLS.macIntel
    : DESKTOP_AGENT_DOWNLOAD_URLS.macArm64;
}
