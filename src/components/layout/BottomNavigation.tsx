import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  LayoutDashboard, 
  Video, 
  Bell, 
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  key: string;
  labelHe: string;
  labelEn: string;
  icon: React.ElementType;
  path: string;
}

// Mobile navigation is minimal - only essential items
const mobileNavItems: NavItem[] = [
  { key: 'dashboard', labelHe: 'בית', labelEn: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'live', labelHe: 'שידור', labelEn: 'Live', icon: Video, path: '/viewer' },
  { key: 'events', labelHe: 'אירועים', labelEn: 'Events', icon: Bell, path: '/events' },
  { key: 'settings', labelHe: 'הגדרות', labelEn: 'Settings', icon: Settings, path: '/settings' },
];

export const BottomNavigation: React.FC = () => {
  const { language } = useLanguage();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-700/50 safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const label = language === 'he' ? item.labelHe : item.labelEn;
          const active = isActive(item.path);

          return (
            <Link
              key={item.key}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-2 transition-colors",
                active ? "text-primary" : "text-white/60"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 mb-1",
                active && "text-primary"
              )} />
              <span className={cn(
                "text-[10px] font-medium",
                active && "text-primary"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;