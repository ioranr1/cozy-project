import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { FeatureGate } from '@/components/FeatureGate';
import { getDesktopOnlyRoutes } from '@/config/navigation';
import { LogOut, User, Bell, Lock } from 'lucide-react';

const Settings = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const desktopOnlyRoutes = getDesktopOnlyRoutes();

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) {
      navigate('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('aiguard_session_token');
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">
          {language === 'he' ? 'הגדרות' : 'Settings'}
        </h1>

        {/* Profile Section */}
        <section className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-white">
              {language === 'he' ? 'פרופיל' : 'Profile'}
            </h2>
          </div>
          <p className="text-slate-400 text-sm">
            {language === 'he' ? 'נהל את פרטי החשבון שלך' : 'Manage your account details'}
          </p>
        </section>

        {/* Language Section */}
        <section className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-white">
                  {language === 'he' ? 'שפה' : 'Language'}
                </h2>
              </div>
              <p className="text-slate-400 text-sm">
                {language === 'he' ? 'בחר את שפת הממשק' : 'Choose interface language'}
              </p>
            </div>
            <LanguageSwitcher />
          </div>
        </section>

        {/* Desktop Features Section - Locked on mobile/web */}
        <section className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-white">
              {language === 'he' ? 'תכונות מתקדמות' : 'Advanced Features'}
            </h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            {language === 'he' 
              ? 'תכונות אלו זמינות רק באפליקציית הדסקטופ'
              : 'These features are only available in the desktop app'}
          </p>
          
          <div className="space-y-4">
            {desktopOnlyRoutes.map((route) => {
              const Icon = route.icon;
              const title = language === 'he' 
                ? getHebrewLabel(route.labelKey)
                : route.labelKey.replace(/([A-Z])/g, ' $1').trim();
              
              return (
                <FeatureGate
                  key={route.path}
                  requires={['isElectron']}
                  mode="lock"
                  title={title}
                  description={language === 'he' 
                    ? 'תכונה זו דורשת את אפליקציית הדסקטופ'
                    : 'This feature requires the desktop app'}
                  ctaText={language === 'he' ? 'הורד אפליקציה' : 'Download Desktop App'}
                  ctaAction={() => window.open('/download', '_blank')}
                >
                  {/* This will only render on Electron */}
                  <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-primary" />
                      <span className="text-white font-medium">{title}</span>
                    </div>
                  </div>
                </FeatureGate>
              );
            })}
          </div>
        </section>

        {/* Logout */}
        <Button
          variant="destructive"
          onClick={handleLogout}
          className="w-full"
        >
          <LogOut className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {language === 'he' ? 'התנתק' : 'Logout'}
        </Button>
      </div>
    </AppLayout>
  );
};

// Helper for Hebrew labels
function getHebrewLabel(key: string): string {
  const labels: Record<string, string> = {
    systemHealth: 'בריאות המערכת',
    recordingBuffer: 'מאגר הקלטות',
    backgroundMode: 'מצב רקע',
  };
  return labels[key] || key;
}

export default Settings;
