import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAllRoutes, NavRoute } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { Shield } from 'lucide-react';

/**
 * Sidebar navigation for desktop/Electron platforms.
 * Shows all routes including desktop-only features in a "System" section.
 */
export function AppSidebar() {
  const { t, isRTL } = useLanguage();
  const location = useLocation();
  const routes = getAllRoutes();

  const mainRoutes = routes.filter(r => r.section === 'main');
  const systemRoutes = routes.filter(r => r.section === 'system');

  const renderNavItem = (route: NavRoute) => {
    const isActive = location.pathname === route.path;
    const Icon = route.icon;
    const navTranslations = t.navigation as Record<string, string>;
    const label = navTranslations[route.labelKey] || route.labelKey;

    return (
      <Link
        key={route.path}
        to={route.path}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
          isActive 
            ? "bg-primary/20 text-primary border-primary/30 border" 
            : "text-slate-300 hover:text-white hover:bg-slate-700/50"
        )}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium truncate">{label}</span>
      </Link>
    );
  };

  return (
    <aside 
      className={cn(
        "fixed top-0 h-screen w-64 z-40",
        "bg-slate-900 border-slate-700/50",
        isRTL ? "right-0 border-l" : "left-0 border-r"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-slate-700/50">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold text-white">AIGuard</span>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-4rem)]">
        {/* Main section */}
        <div className="space-y-1">
          {mainRoutes.map(renderNavItem)}
        </div>

        {/* System section (desktop-only routes) */}
        {systemRoutes.length > 0 && (
          <>
            <div className="pt-6 pb-2">
              <span className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {(t.navigation as Record<string, string>).system || 'System'}
              </span>
            </div>
            <div className="space-y-1">
              {systemRoutes.map(renderNavItem)}
            </div>
          </>
        )}
      </nav>
    </aside>
  );
}
