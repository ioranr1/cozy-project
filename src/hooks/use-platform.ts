/**
 * Platform detection based on User Agent
 * iOS/Android = Mobile device
 * Everything else (including browser on desktop, Electron) = Desktop
 */
export function useIsMobileDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  
  // Check for iOS devices
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  
  // Check for Android devices
  const isAndroid = /android/i.test(userAgent);
  
  // Mobile = iOS or Android only
  // Desktop = everything else (Windows, Mac, Linux browsers, Electron, etc.)
  return isIOS || isAndroid;
}

/**
 * Returns true if running on a desktop platform
 * This includes regular browsers on desktop and Electron
 */
export function useIsDesktopDevice(): boolean {
  return !useIsMobileDevice();
}
