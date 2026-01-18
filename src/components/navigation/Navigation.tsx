import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNav } from './BottomNav';
import { AppSidebar } from './AppSidebar';

/**
 * Main navigation component that switches between:
 * - Sidebar: for Electron OR large screens (desktop)
 * - BottomNav: for mobile/web on small screens
 * 
 * Decision logic:
 * - If running in Electron → always show sidebar
 * - If large screen (desktop browser) → show sidebar
 * - Otherwise (mobile/web) → show bottom nav
 */
export function Navigation() {
  const { isElectron } = useCapabilities();
  const isMobile = useIsMobile();

  // Electron always gets sidebar
  // Large screens get sidebar
  // Mobile/small screens get bottom nav
  const useSidebar = isElectron || !isMobile;

  if (useSidebar) {
    return <AppSidebar />;
  }

  return <BottomNav />;
}

/**
 * Hook to get the appropriate content padding based on navigation type.
 * Use this in layouts to offset content from the navigation.
 */
export function useNavigationPadding() {
  const { isElectron } = useCapabilities();
  const isMobile = useIsMobile();
  const useSidebar = isElectron || !isMobile;

  return {
    // Sidebar: add padding to left/right based on RTL
    // Bottom nav: add padding to bottom for safe area
    sidebarWidth: useSidebar ? 'pl-64' : '',
    sidebarWidthRTL: useSidebar ? 'pr-64' : '',
    bottomPadding: !useSidebar ? 'pb-20' : '',
    useSidebar,
  };
}
