import React, { useState } from 'react';
import { useIsMobileDevice } from '@/hooks/use-platform';
import { AppSidebar } from './AppSidebar';
import { BottomNavigation } from './BottomNavigation';

interface NavigationProps {
  children?: React.ReactNode;
}

export const Navigation: React.FC<NavigationProps> = () => {
  const isMobile = useIsMobileDevice();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isMobile) {
    return <BottomNavigation />;
  }

  return (
    <AppSidebar 
      collapsed={sidebarCollapsed} 
      onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
    />
  );
};

// Export sidebar width for layout calculations
export const useSidebarWidth = () => {
  const isMobile = useIsMobileDevice();
  const [collapsed] = useState(false); // Sync with Navigation state if needed
  
  if (isMobile) return 0;
  return collapsed ? 64 : 256; // 16 = w-16, 64 = w-64 in px
};

export default Navigation;