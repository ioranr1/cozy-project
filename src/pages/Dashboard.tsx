import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Shield, Laptop, Smartphone, LogOut, Video, Power, PowerOff, Eye, Activity, Bell, Monitor } from 'lucide-react';
import { useCapabilities } from '@/hooks/useCapabilities';
import { FeatureGate } from '@/components/FeatureGate';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { laptopDeviceId } from '@/config/devices';

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
  const { isElectron } = useCapabilities();

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

  // Existing handlers for remote commands - kept exactly as-is
  const handleStartCamera = async () => {
    if (!laptopDeviceId) {
      toast.error(language === 'he' ? 'לא הוגדר device_id ללפטופ' : 'No device_id configured for laptop');
      return;
    }
    
    const sessionToken = localStorage.getItem('aiguard_session_token');
    if (!sessionToken) {
      toast.error(language === 'he' ? 'לא מחובר - יש להתחבר מחדש' : 'Not logged in - please login again');
      navigate('/login');
      return;
    }
    
    try {
      const response = await fetch('https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          device_id: laptopDeviceId,
          command: 'START_CAMERA'
        })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send command');
      
      toast.success(language === 'he' ? 'פקודה נשלחה ללפטופ' : 'Command sent to laptop');
    } catch (error) {
      console.error('Command error:', error);
      toast.error(language === 'he' ? 'שגיאה בשליחת הפקודה' : 'Error sending command');
    }
  };

  const handleStopCamera = async () => {
    if (!laptopDeviceId) {
      toast.error(language === 'he' ? 'לא הוגדר device_id ללפטופ' : 'No device_id configured for laptop');
      return;
    }
    
    const sessionToken = localStorage.getItem('aiguard_session_token');
    if (!sessionToken) {
      toast.error(language === 'he' ? 'לא מחובר - יש להתחבר מחדש' : 'Not logged in - please login again');
      navigate('/login');
      return;
    }
    
    try {
      const response = await fetch('https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          device_id: laptopDeviceId,
          command: 'STOP_CAMERA'
        })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send command');
      
      toast.success(language === 'he' ? 'פקודה נשלחה ללפטופ' : 'Command sent to laptop');
    } catch (error) {
      console.error('Command error:', error);
      toast.error(language === 'he' ? 'שגיאה בשליחת הפקודה' : 'Error sending command');
    }
  };

  if (!userProfile) {
    return null;
  }

  // Desktop/Electron layout - grid with side panel
  const DesktopLayout = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content - 2 columns */}
      <div className="lg:col-span-2 space-y-6">
        {/* This Device Card - Camera Role */}
        <ThisDeviceCard role="camera" />
        
        {/* System Status Summary */}
        <SystemStatusCard />
      </div>
      
      {/* Side panel - Recent Events */}
      <div className="space-y-6">
        <RecentEventsCard />
      </div>
    </div>
  );

  // Mobile/Web layout - vertical stacked
  const MobileLayout = () => (
    <div className="space-y-6">
      {/* This Device Card - Viewer Role */}
      <ThisDeviceCard role="viewer" />
      
      {/* System Status Summary */}
      <SystemStatusCard />
      
      {/* Recent Events */}
      <RecentEventsCard />
    </div>
  );

  // This Device Card component
  const ThisDeviceCard = ({ role }: { role: 'camera' | 'viewer' }) => {
    if (role === 'camera') {
      // Desktop/Electron - Camera-capable device
      return (
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Monitor className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white">
                {language === 'he' ? 'המכשיר הזה' : 'This Device'}
              </h3>
              <p className="text-white/60 text-sm">
                {language === 'he' ? 'מכשיר מסוגל לשמש כמצלמה' : 'Camera-capable device'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${laptopStatus === 'online' ? 'bg-green-500' : 'bg-slate-500'}`} />
              <span className="text-sm text-white/60">
                {laptopStatus === 'online' 
                  ? (language === 'he' ? 'פעיל' : 'Active')
                  : (language === 'he' ? 'לא פעיל' : 'Inactive')}
              </span>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Link to="/camera" className="flex-1">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                <Power className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'התחל ניטור' : 'Start Monitoring'}
              </Button>
            </Link>
            <Button 
              variant="outline"
              className="border-slate-600/50 text-slate-300 hover:bg-slate-700/50"
              disabled
            >
              <PowerOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'עצור' : 'Stop'}
            </Button>
          </div>
        </div>
      );
    }

    // Mobile/Web - Viewer role
    return (
      <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
            <Smartphone className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white">
              {language === 'he' ? 'המכשיר הזה' : 'This Device'}
            </h3>
            <p className="text-white/60 text-sm">
              {language === 'he' ? 'צופה - שליטה מרחוק' : 'Viewer - Remote Control'}
            </p>
          </div>
        </div>
        
        {/* Remote camera status */}
        <div className={`text-xs mb-4 flex items-center gap-2 ${
          laptopStatus === 'online' 
            ? 'text-green-400' 
            : laptopStatus === 'offline' 
              ? 'text-yellow-400/80' 
              : 'text-slate-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            laptopStatus === 'online' ? 'bg-green-400' : laptopStatus === 'offline' ? 'bg-yellow-400' : 'bg-slate-400'
          }`} />
          {language === 'he' 
            ? `${laptopStatus === 'online' ? 'מחשב מחובר' : laptopStatus === 'offline' ? 'מחשב לא מחובר' : 'לא הוגדר מחשב'}`
            : `${laptopStatus === 'online' ? 'Computer connected' : laptopStatus === 'offline' ? 'Computer not connected' : 'No computer configured'}`}
        </div>

        <div className="space-y-3">
          {/* Primary CTA - Live View */}
          <Link to="/live-view" className="block">
            <Button className="w-full bg-green-600 hover:bg-green-700">
              <Eye className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'צפייה בשידור חי' : 'Live View'}
            </Button>
          </Link>
          
          {/* Remote control buttons */}
          <div className="flex gap-3">
            <Button 
              variant="outline"
              className="flex-1 border-green-500/50 text-green-400 hover:bg-green-500/10"
              onClick={handleStartCamera}
            >
              <Power className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'הפעל מצלמה' : 'Start Camera'}
            </Button>
            <Button 
              variant="outline"
              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
              onClick={handleStopCamera}
            >
              <PowerOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'כבה' : 'Stop'}
            </Button>
          </div>
          
          {/* Camera mode gated for desktop */}
          <FeatureGate
            requires={['isElectron']}
            mode="lock"
            title={language === 'he' ? 'הפעל כמצלמה' : 'Use as Camera'}
            description={language === 'he' ? 'שימוש במכשיר זה כמצלמה דורש את אפליקציית המחשב' : 'Using this device as a camera requires the desktop app'}
          >
            <div />
          </FeatureGate>
        </div>
      </div>
    );
  };

  // System Status Card
  const SystemStatusCard = () => (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="w-5 h-5 text-white/60" />
        <h3 className="text-lg font-semibold text-white">
          {language === 'he' ? 'סטטוס מערכת' : 'System Status'}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-700/30 rounded-xl p-4">
          <p className="text-sm text-white/60 mb-1">
            {language === 'he' ? 'מצלמות פעילות' : 'Active Cameras'}
          </p>
          <p className="text-2xl font-bold text-white">
            {laptopStatus === 'online' ? '1' : '0'}
          </p>
        </div>
        <div className="bg-slate-700/30 rounded-xl p-4">
          <p className="text-sm text-white/60 mb-1">
            {language === 'he' ? 'אירועים היום' : 'Events Today'}
          </p>
          <p className="text-2xl font-bold text-white">0</p>
        </div>
      </div>
    </div>
  );

  // Recent Events Card
  const RecentEventsCard = () => (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-white/60" />
          <h3 className="text-lg font-semibold text-white">
            {language === 'he' ? 'אירועים אחרונים' : 'Recent Events'}
          </h3>
        </div>
        <Link to="/events">
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            {language === 'he' ? 'הכל' : 'View All'}
          </Button>
        </Link>
      </div>
      
      {/* Empty state */}
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center mx-auto mb-3">
          <Video className="w-6 h-6 text-white/40" />
        </div>
        <p className="text-white/60 text-sm">
          {language === 'he' ? 'אין אירועים אחרונים' : 'No recent events'}
        </p>
      </div>
    </div>
  );

  return (
    <AppLayout>
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="px-4 md:px-6">
          <div className="flex items-center justify-end h-14 gap-4">
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
      </header>

      <main className="px-4 md:px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {language === 'he' ? `שלום, ${userProfile.fullName}` : `Hello, ${userProfile.fullName}`}
          </h1>
          <p className="text-white/60">
            {language === 'he' ? 'סקירת המערכת שלך' : 'Your system overview'}
          </p>
        </div>

        {/* Platform-specific layout */}
        {isElectron ? <DesktopLayout /> : <MobileLayout />}
      </main>
    </AppLayout>
  );
};

export default Dashboard;
