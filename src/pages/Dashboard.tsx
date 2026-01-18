import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Laptop, Smartphone, Video, Radar, Activity, Bell, Clock, Wifi, WifiOff } from 'lucide-react';
import { useIsMobileDevice } from '@/hooks/use-platform';
import { useCapabilities } from '@/hooks/useCapabilities';
import { FeatureGate } from '@/components/FeatureGate';
import { supabase } from '@/integrations/supabase/client';
import { laptopDeviceId } from '@/config/devices';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';

interface UserProfile {
  id?: string;
  fullName: string;
  email: string;
  phone: string;
}

const Dashboard: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [laptopStatus, setLaptopStatus] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [motionDetectionActive, setMotionDetectionActive] = useState(false);
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

  if (!userProfile) {
    return null;
  }

  // Motion Detection status would typically be fetched from device status/commands table

  // Mobile Dashboard - Controller + Viewer Mode
  if (isMobileDevice) {
    return (
      <AppLayout>
        <DashboardHeader 
          userFullName={userProfile.fullName}
          subtitle={language === 'he' ? 'שלוט במצלמות וצפה בשידור חי' : 'Control cameras and watch live streams'}
          roleBadge={{
            label: language === 'he' ? 'שליטה + צפייה' : 'Controller + Viewer',
            variant: 'emerald'
          }}
        />

        <div className="p-4 space-y-4">
          {/* This Device Card - Controller Mode */}
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {language === 'he' ? 'מכשיר זה' : 'This Device'}
                </h3>
                <p className="text-white/60 text-sm">
                  {language === 'he' ? 'שלט רחוק + צופה' : 'Remote control + Viewer'}
                </p>
              </div>
            </div>

            {/* Primary CTA - View Live */}
            <Link to="/viewer" className="block mb-3">
              <Button className="w-full bg-primary hover:bg-primary/90 text-lg py-5">
                <Video className={`w-5 h-5 ${isRTL ? 'ml-3' : 'mr-3'}`} />
                {language === 'he' ? 'צפה בשידור חי' : 'View Live Stream'}
              </Button>
            </Link>
          </div>

          {/* Motion Detection Status Card */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                motionDetectionActive ? 'bg-amber-500/20' : 'bg-slate-700/50'
              }`}>
                <Radar className={`w-5 h-5 ${motionDetectionActive ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
              <div className="flex-1">
                <h4 className="text-white font-medium">
                  {language === 'he' ? 'זיהוי תנועה' : 'Motion Detection'}
                </h4>
                <span className={`text-xs ${motionDetectionActive ? 'text-amber-400' : 'text-slate-500'}`}>
                  {language === 'he' 
                    ? (motionDetectionActive ? 'פעיל' : 'לא פעיל')
                    : (motionDetectionActive ? 'Active' : 'Inactive')}
                </span>
              </div>
            </div>

            {/* Status indicator only - controls are on /motion-detection page */}
            <div className={`flex items-center justify-center p-3 rounded-xl ${
              motionDetectionActive 
                ? 'bg-amber-500/10 border border-amber-500/30' 
                : 'bg-slate-700/30 border border-slate-600/30'
            }`}>
              <span className={`text-sm ${motionDetectionActive ? 'text-amber-400' : 'text-slate-400'}`}>
                {language === 'he' 
                  ? (motionDetectionActive ? 'המערכת מנטרת תנועה' : 'המערכת אינה פעילה')
                  : (motionDetectionActive ? 'System is monitoring motion' : 'System is inactive')}
              </span>
            </div>
          </div>

          {/* Compact System Status */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
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
        </div>
      </AppLayout>
    );
  }

  // Desktop Dashboard - Operational View
  return (
    <AppLayout>
      <DashboardHeader 
        userFullName={userProfile.fullName}
        subtitle={language === 'he' ? 'לוח בקרה - תחנת מצלמה' : 'Dashboard - Camera Station'}
      />

      <div className="p-6">
        {/* Desktop Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - This Device + Controls */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* This Device Card */}
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

              {/* Motion Detection Status */}
              <div className="bg-slate-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Radar className={`w-5 h-5 ${motionDetectionActive ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-white font-medium">
                      {language === 'he' ? 'זיהוי תנועה' : 'Motion Detection'}
                    </span>
                  </div>
                  <span className={`text-sm px-2 py-0.5 rounded-full ${
                    motionDetectionActive 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : 'bg-slate-600/50 text-slate-400'
                  }`}>
                    {language === 'he' 
                      ? (motionDetectionActive ? 'פעיל' : 'לא פעיל')
                      : (motionDetectionActive ? 'Active' : 'Inactive')}
                  </span>
                </div>
                <Link to="/motion-detection">
                  <Button variant="outline" size="sm" className="w-full border-slate-600 text-white/70 hover:text-white">
                    {language === 'he' ? 'נהל זיהוי תנועה' : 'Manage Motion Detection'}
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
                <FeatureGate requires={['canBackgroundRun']} mode="hide">
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

                <FeatureGate requires={['canRecordSegments']} mode="hide">
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

                <FeatureGate requires={['isElectron']} mode="hide">
                  <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
                    <div>
                      <p className="text-white font-medium">
                        {language === 'he' ? 'הפעלה אוטומטית' : 'Auto-start on Launch'}
                      </p>
                      <p className="text-white/50 text-xs">
                        {language === 'he' ? 'התחל זיהוי תנועה עם הפעלת המערכת' : 'Start motion detection when system boots'}
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                </FeatureGate>

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
      </div>
    </AppLayout>
  );
};

export default Dashboard;