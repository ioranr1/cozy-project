import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getMainRoutes } from '@/config/navigation';
import { cn } from '@/lib/utils';

/**
 * Bottom navigation bar for mobile/web platforms.
 * Shows only main routes (not desktop-only features).
 */
export function BottomNav() {
  const { t, isRTL } = useLanguage();
  const location = useLocation();
  const routes = getMainRoutes();

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50",
        "safe-area-bottom"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {routes.map((route) => {
          const isActive = location.pathname === route.path;
          const Icon = route.icon;
          const navTranslations = t.navigation as Record<string, string>;
          const label = navTranslations[route.labelKey] || route.labelKey;

          return (
            <Link
              key={route.path}
              to={route.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium truncate max-w-[60px]">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
