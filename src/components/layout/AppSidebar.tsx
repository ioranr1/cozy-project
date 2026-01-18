import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCapabilities } from '@/hooks/useCapabilities';
import { FeatureGate } from '@/components/FeatureGate';
import { 
  LayoutDashboard, 
  Video, 
  Camera, 
  Bell, 
  Activity, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Radar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItem {
  key: string;
  labelHe: string;
  labelEn: string;
  icon: React.ElementType;
  path: string;
  desktopOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: 'dashboard', labelHe: 'לוח בקרה', labelEn: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'live', labelHe: 'שידור חי', labelEn: 'Live View', icon: Video, path: '/viewer' },
  { key: 'cameras', labelHe: 'מצלמות', labelEn: 'Cameras', icon: Camera, path: '/camera' },
  { key: 'motion', labelHe: 'זיהוי תנועה', labelEn: 'Motion Detection', icon: Radar, path: '/motion-detection', desktopOnly: true },
  { key: 'events', labelHe: 'אירועים', labelEn: 'Events', icon: Bell, path: '/events' },
  { key: 'system', labelHe: 'בריאות מערכת', labelEn: 'System Health', icon: Activity, path: '/system', desktopOnly: true },
  { key: 'settings', labelHe: 'הגדרות', labelEn: 'Settings', icon: Settings, path: '/settings' },
];

interface AppSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ collapsed = false, onToggle }) => {
  const { language, isRTL } = useLanguage();
  const location = useLocation();
  const capabilities = useCapabilities();

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside 
      className={cn(
        "fixed top-0 h-screen bg-slate-900 border-slate-700/50 flex flex-col transition-all duration-300 z-40",
        isRTL ? "right-0 border-l" : "left-0 border-r",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "h-16 flex items-center border-b border-slate-700/50 px-4",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <span className="text-xl font-bold text-white">AIGuard</span>
          )}
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          // Desktop-only items need FeatureGate
          if (item.desktopOnly) {
            return (
              <FeatureGate
                key={item.key}
                requires={['isElectron']}
                mode="hide"
              >
                <NavItemButton
                  item={item}
                  isActive={isActive(item.path)}
                  collapsed={collapsed}
                  language={language}
                  isRTL={isRTL}
                />
              </FeatureGate>
            );
          }

          return (
            <NavItemButton
              key={item.key}
              item={item}
              isActive={isActive(item.path)}
              collapsed={collapsed}
              language={language}
              isRTL={isRTL}
            />
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-slate-700/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full text-white/60 hover:text-white hover:bg-slate-800",
            collapsed ? "justify-center" : isRTL ? "justify-start" : "justify-end"
          )}
        >
          {collapsed ? (
            isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </aside>
  );
};

interface NavItemButtonProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  language: string;
  isRTL: boolean;
}

const NavItemButton: React.FC<NavItemButtonProps> = ({ 
  item, 
  isActive, 
  collapsed, 
  language, 
  isRTL 
}) => {
  const Icon = item.icon;
  const label = language === 'he' ? item.labelHe : item.labelEn;

  return (
    <Link
      to={item.path}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
        isActive
          ? "bg-primary/20 text-primary border border-primary/30"
          : "text-white/70 hover:text-white hover:bg-slate-800/50",
        collapsed && "justify-center",
        isRTL && !collapsed && "flex-row-reverse"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && (
        <span className="font-medium text-sm">{label}</span>
      )}
    </Link>
  );
};

export default AppSidebar;