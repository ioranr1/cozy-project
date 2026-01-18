import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Shield, Laptop, Smartphone, LogOut, Video, Activity, Bell, Clock, Settings, Wifi, WifiOff } from 'lucide-react';
import { useIsMobileDevice } from '@/hooks/use-platform';
import { useCapabilities } from '@/hooks/useCapabilities';
import { FeatureGate } from '@/components/FeatureGate';
import { supabase } from '@/integrations/supabase/client';
import { laptopDeviceId } from '@/config/devices';
import { Switch } from '@/components/ui/switch';

interface UserProfile {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
}

const Dashboard: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [laptopStatus, setLaptopStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const isMobileDevice = useIsMobileDevice();
  const capabilities = useCapabilities();

  // Check laptop connection status
  useEffect(() => {
    const checkLaptopStatus = async () => {
      if (!laptopDeviceId) {
        setLaptopStatus('unknown');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('devices')
          .select('last_seen_at, is_active')
          .eq('id', laptopDeviceId)
          .maybeSingle();

        if (error || !data) {
          setLaptopStatus('unknown');
          return;
        }

        // Check if last_seen_at is within 30 seconds
        if (data.last_seen_at) {
          const lastSeen = new Date(data.last_seen_at);
          const now = new Date();
          const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
          
          if (diffSeconds <= 30 && data.is_active) {
            setLaptopStatus('online');
          } else {
            setLaptopStatus('offline');
          }
        } else {
          setLaptopStatus('offline');
        }
      } catch {
        setLaptopStatus('unknown');
      }
    };

    // Check immediately and then every 10 seconds
    checkLaptopStatus();
    const interval = setInterval(checkLaptopStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      setUserProfile(JSON.parse(stored));
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('aiguard_session_token');
    navigate('/login');
  };

  if (!userProfile) {
    return null;
  }

  // Mobile Dashboard - Viewer-Only Mode
  if (isMobileDevice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">AIGuard</span>
              </Link>
              <div className="flex items-center gap-4">
                <LanguageSwitcher />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          {/* Welcome with Viewer Role */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">
                {language === 'he' ? `שלום, ${userProfile.fullName}` : `Hello, ${userProfile.fullName}`}
              </h1>
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                {language === 'he' ? 'צופה' : 'Viewer'}
              </span>
            </div>
            <p className="text-white/60 text-sm">
              {language === 'he' ? 'צפה בשידור חי מהמצלמות שלך' : 'Watch live streams from your cameras'}
            </p>
          </div>

          {/* This Device Card - Viewer Mode */}
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {language === 'he' ? 'מכשיר זה' : 'This Device'}
                </h3>
                <p className="text-white/60 text-sm">
                  {language === 'he' ? 'מצב צפייה בלבד' : 'Viewing mode only'}
                </p>
              </div>
            </div>

            {/* Single Primary CTA - View Live */}
            <Link to="/viewer" className="block">
              <Button className="w-full bg-primary hover:bg-primary/90 text-lg py-6">
                <Video className={`w-5 h-5 ${isRTL ? 'ml-3' : 'mr-3'}`} />
                {language === 'he' ? 'צפה בשידור חי' : 'View Live Stream'}
              </Button>
            </Link>
          </div>

          {/* Camera Status Card */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                laptopStatus === 'online' 
                  ? 'bg-green-500/20' 
                  : 'bg-slate-700/50'
              }`}>
                <Laptop className={`w-5 h-5 ${laptopStatus === 'online' ? 'text-green-400' : 'text-slate-500'}`} />
              </div>
              <div className="flex-1">
                <h4 className="text-white font-medium">
                  {language === 'he' ? 'מצלמת הלפטופ' : 'Laptop Camera'}
                </h4>
                <div className="flex items-center gap-2">
                  {laptopStatus === 'online' ? (
                    <Wifi className="w-3 h-3 text-green-400" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-slate-500" />
                  )}
                  <span className={`text-xs ${laptopStatus === 'online' ? 'text-green-400' : 'text-slate-500'}`}>
                    {language === 'he' 
                      ? (laptopStatus === 'online' ? 'מחובר ומשדר' : 'לא מחובר')
                      : (laptopStatus === 'online' ? 'Connected & streaming' : 'Disconnected')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact System Status */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-white/60" />
              <h3 className="text-base font-semibold text-white">
                {language === 'he' ? 'סטטוס מערכת' : 'System Status'}
              </h3>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">
                {language === 'he' ? 'חיבור לשרת' : 'Server Connection'}
              </span>
              <span className="text-green-400">
                {language === 'he' ? 'מחובר' : 'Connected'}
              </span>
            </div>
          </div>

          {/* Recent Events Card */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">
                {language === 'he' ? 'אירועים אחרונים' : 'Recent Events'}
              </h3>
              <Bell className="w-4 h-4 text-white/40" />
            </div>
            <div className="text-center py-6">
              <Clock className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-white/40 text-sm">
                {language === 'he' ? 'אין אירועים אחרונים' : 'No recent events'}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Desktop Dashboard - Operational View
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AIGuard</span>
            </Link>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">
            {language === 'he' ? `שלום, ${userProfile.fullName}` : `Hello, ${userProfile.fullName}`}
          </h1>
          <p className="text-white/60">
            {language === 'he' ? 'לוח בקרה - תחנת מצלמה' : 'Dashboard - Camera Station'}
          </p>
        </div>

        {/* Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - This Device + Controls */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* This Device Card - EXISTING START/STOP LOGIC PRESERVED */}
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <Laptop className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {language === 'he' ? 'מכשיר זה' : 'This Device'}
                    </h3>
                    <p className="text-white/60 text-sm">
                      {language === 'he' ? 'תחנת מצלמה ראשית' : 'Primary Camera Station'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${laptopStatus === 'online' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                  <span className={`text-sm ${laptopStatus === 'online' ? 'text-green-400' : 'text-slate-400'}`}>
                    {language === 'he' 
                      ? (laptopStatus === 'online' ? 'פעיל' : 'לא פעיל')
                      : (laptopStatus === 'online' ? 'Active' : 'Inactive')}
                  </span>
                </div>
              </div>

              {/* Camera Controls - Link to /camera page */}
              <div className="flex gap-3">
                <Link to="/camera" className="flex-1">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <Video className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {language === 'he' ? 'פתח מצלמה' : 'Open Camera'}
                  </Button>
                </Link>
                <Link to="/camera">
                  <Button variant="outline" size="icon" className="border-slate-600 hover:border-slate-500">
                    <Settings className="w-4 h-4 text-white/60" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Desktop-only Toggles - FeatureGated */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                {language === 'he' ? 'הגדרות מתקדמות' : 'Advanced Settings'}
              </h3>
              
              <div className="space-y-4">
                {/* Background Mode Toggle */}
                <FeatureGate 
                  requires={['canBackgroundRun']} 
                  mode="hide"
                >
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                    <div>
                      <p className="text-white font-medium">
                        {language === 'he' ? 'מצב רקע' : 'Background Mode'}
                      </p>
                      <p className="text-white/50 text-xs">
                        {language === 'he' ? 'המשך הקלטה כשהחלון ממוזער' : 'Keep recording when minimized'}
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                </FeatureGate>

                {/* Record on Alert Toggle */}
                <FeatureGate 
                  requires={['canRecordSegments']} 
                  mode="hide"
                >
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                    <div>
                      <p className="text-white font-medium">
                        {language === 'he' ? 'הקלט באירוע' : 'Record on Alert'}
                      </p>
                      <p className="text-white/50 text-xs">
                        {language === 'he' ? 'שמור קליפים לדיסק המקומי' : 'Save clips to local disk'}
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                </FeatureGate>

                {/* Auto-start Toggle */}
                <FeatureGate 
                  requires={['isElectron']} 
                  mode="hide"
                >
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                    <div>
                      <p className="text-white font-medium">
                        {language === 'he' ? 'הפעלה אוטומטית' : 'Auto-start on Launch'}
                      </p>
                      <p className="text-white/50 text-xs">
                        {language === 'he' ? 'התחל ניטור עם הפעלת המערכת' : 'Start monitoring when system boots'}
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                </FeatureGate>

                {/* Show message if no Electron features available */}
                {!capabilities.isElectron && (
                  <div className="text-center py-4 text-white/40 text-sm">
                    {language === 'he' 
                      ? 'הגדרות מתקדמות זמינות באפליקציית Desktop בלבד'
                      : 'Advanced settings available in Desktop app only'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Status & Events */}
          <div className="space-y-6">
            
            {/* System Status */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-white/60" />
                <h3 className="text-lg font-semibold text-white">
                  {language === 'he' ? 'סטטוס מערכת' : 'System Status'}
                </h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">
                    {language === 'he' ? 'חיבור לשרת' : 'Server Connection'}
                  </span>
                  <span className="text-green-400 text-sm">
                    {language === 'he' ? 'מחובר' : 'Connected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">
                    {language === 'he' ? 'שירות TURN' : 'TURN Service'}
                  </span>
                  <span className="text-green-400 text-sm">
                    {language === 'he' ? 'זמין' : 'Available'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">
                    {language === 'he' ? 'פלטפורמה' : 'Platform'}
                  </span>
                  <span className="text-white/80 text-sm capitalize">
                    {capabilities.platform}
                  </span>
                </div>
              </div>
            </div>

            {/* Recent Events */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-white/60" />
                  <h3 className="text-lg font-semibold text-white">
                    {language === 'he' ? 'אירועים אחרונים' : 'Recent Events'}
                  </h3>
                </div>
                <Link to="/events" className="text-primary text-sm hover:underline">
                  {language === 'he' ? 'הכל' : 'All'}
                </Link>
              </div>
              
              <div className="text-center py-8">
                <Clock className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">
                  {language === 'he' ? 'אין אירועים אחרונים' : 'No recent events'}
                </p>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
