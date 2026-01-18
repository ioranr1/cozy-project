import { useMemo } from 'react';

export type Platform = 'electron' | 'web';

export interface Capabilities {
  platform: Platform;
  isElectron: boolean;
  canBackgroundRun: boolean;
  canUseUsbCamera: boolean;
  canRecordSegments: boolean;
  canWebPush: boolean;
  canPiP: boolean;
  hasMediaDevices: boolean;
  notes: string[];
}

/**
 * Single source of truth for platform detection and capability gating.
 * Detects Electron vs Web and feature-detects available APIs.
 */
export function useCapabilities(): Capabilities {
  return useMemo(() => {
    const notes: string[] = [];

    // Platform detection - check for Electron
    // Electron apps should expose window.__APP_PLATFORM__ = "electron"
    // Also check for common Electron indicators as fallback
    const windowAny = window as any;
    const isElectron = 
      windowAny.__APP_PLATFORM__ === 'electron' ||
      typeof windowAny.electron !== 'undefined' ||
      (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Electron'));

    const platform: Platform = isElectron ? 'electron' : 'web';

    if (!isElectron) {
      notes.push('Running in web browser (not Electron)');
    }

    // Electron-only capabilities
    const canBackgroundRun = isElectron;
    const canUseUsbCamera = isElectron;
    const canRecordSegments = isElectron;

    if (!canBackgroundRun) {
      notes.push('Background running requires desktop app');
    }
    if (!canUseUsbCamera) {
      notes.push('USB camera access requires desktop app');
    }
    if (!canRecordSegments) {
      notes.push('Local recording requires desktop app');
    }

    // Web Push API detection
    const canWebPush = !isElectron && 
      typeof window !== 'undefined' && 
      'PushManager' in window && 
      'serviceWorker' in navigator;

    if (!canWebPush && !isElectron) {
      notes.push('Push notifications not supported in this browser');
    }

    // Picture-in-Picture detection
    const canPiP = typeof document !== 'undefined' && (
      'pictureInPictureEnabled' in document ||
      // Check for video element PiP support
      (typeof HTMLVideoElement !== 'undefined' && 
       'requestPictureInPicture' in HTMLVideoElement.prototype)
    );

    if (!canPiP) {
      notes.push('Picture-in-Picture not supported');
    }

    // MediaDevices API detection
    const hasMediaDevices = typeof navigator !== 'undefined' && 
      typeof navigator.mediaDevices !== 'undefined' && 
      typeof navigator.mediaDevices.getUserMedia === 'function';

    if (!hasMediaDevices) {
      notes.push('Media devices API not available');
    }

    return {
      platform,
      isElectron,
      canBackgroundRun,
      canUseUsbCamera,
      canRecordSegments,
      canWebPush,
      canPiP,
      hasMediaDevices,
      notes,
    };
  }, []);
}

// Export capability keys for type-safe requires prop
export type CapabilityKey = keyof Omit<Capabilities, 'platform' | 'notes'>;
