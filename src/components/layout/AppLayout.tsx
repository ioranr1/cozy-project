import React, { useState } from 'react';
import { useIsMobileDevice } from '@/hooks/use-platform';
import { AppSidebar } from './AppSidebar';
import { BottomNavigation } from './BottomNavigation';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface AppLayoutProps {
  children: React.ReactNode;
  /** Hide navigation entirely (for full-screen views like live video) */
  hideNavigation?: boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, hideNavigation = false }) => {
  const isMobile = useIsMobileDevice();
  const { isRTL } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (hideNavigation) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <AppSidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
      )}

      {/* Main Content */}
      <main 
        className={cn(
          "min-h-screen transition-all duration-300",
          !isMobile && (isRTL 
            ? (sidebarCollapsed ? "mr-16" : "mr-64")
            : (sidebarCollapsed ? "ml-16" : "ml-64")
          ),
          isMobile && "pb-20" // Space for bottom navigation
        )}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <BottomNavigation />}
    </div>
  );
};

export default AppLayout;