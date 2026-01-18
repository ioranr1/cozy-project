import { ReactNode } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Navigation, useNavigationPadding } from '@/components/navigation/Navigation';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  /** Show navigation (default: true) */
  showNav?: boolean;
  /** Custom className for main content area */
  className?: string;
}

/**
 * Main app layout with responsive navigation.
 * Handles sidebar/bottom nav switching and proper content padding.
 */
export function AppLayout({ children, showNav = true, className }: AppLayoutProps) {
  const { isRTL } = useLanguage();
  const { sidebarWidth, sidebarWidthRTL, bottomPadding, useSidebar } = useNavigationPadding();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {showNav && <Navigation />}
      
      <main 
        className={cn(
          "min-h-screen",
          showNav && (isRTL ? sidebarWidthRTL : sidebarWidth),
          showNav && bottomPadding,
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}
