import { 
  LayoutDashboard, 
  Camera, 
  Shield, 
  Calendar, 
  Settings,
  Activity,
  HardDrive,
  Moon
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface NavRoute {
  path: string;
  labelKey: string;
  icon: LucideIcon;
  desktopOnly?: boolean;
  section?: 'main' | 'system';
}

// All navigation routes
export const navRoutes: NavRoute[] = [
  // Main routes (available on all platforms)
  { path: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, section: 'main' },
  { path: '/cameras', labelKey: 'cameras', icon: Camera, section: 'main' },
  { path: '/rules', labelKey: 'rules', icon: Shield, section: 'main' },
  { path: '/events', labelKey: 'events', icon: Calendar, section: 'main' },
  { path: '/settings', labelKey: 'settings', icon: Settings, section: 'main' },
  
  // Desktop-only routes (Electron gated)
  { path: '/system-health', labelKey: 'systemHealth', icon: Activity, section: 'system', desktopOnly: true },
  { path: '/recording-buffer', labelKey: 'recordingBuffer', icon: HardDrive, section: 'system', desktopOnly: true },
  { path: '/background-mode', labelKey: 'backgroundMode', icon: Moon, section: 'system', desktopOnly: true },
];

// Get main routes (for bottom nav on mobile)
export const getMainRoutes = () => navRoutes.filter(r => r.section === 'main');

// Get desktop-only routes (for settings locked cards)
export const getDesktopOnlyRoutes = () => navRoutes.filter(r => r.desktopOnly);

// Get all routes for sidebar
export const getAllRoutes = () => navRoutes;
