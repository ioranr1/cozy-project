import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Shield, Laptop, Smartphone, Plus, LogOut, Video, Power, PowerOff } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const isMobile = useIsMobile();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AIGuard</span>
            </Link>

            {/* Actions */}
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
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {language === 'he' ? `שלום, ${userProfile.fullName}` : `Hello, ${userProfile.fullName}`}
          </h1>
          <p className="text-white/60">
            {language === 'he' ? 'ברוך הבא לאיזור האישי שלך' : 'Welcome to your dashboard'}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Set as Camera - Active on Desktop, Disabled on Mobile */}
          {isMobile ? (
            <div className="bg-gradient-to-br from-slate-700/20 to-slate-800/20 border border-slate-600/30 rounded-2xl p-6 opacity-60 cursor-not-allowed">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg">
                  <Laptop className="w-7 h-7 text-white/60" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white/60">
                    {language === 'he' ? 'הגדר כמצלמה' : 'Set as Camera'}
                  </h3>
                  <p className="text-white/40 text-sm">
                    {language === 'he' ? 'מיועד למחשב בלבד' : 'For desktop only'}
                  </p>
                </div>
              </div>
              <Button className="w-full bg-slate-600 cursor-not-allowed" disabled>
                {language === 'he' ? 'לא זמין בנייד' : 'Not available on mobile'}
              </Button>
            </div>
          ) : (
            <Link to="/camera">
              <div className="group bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-6 hover:border-blue-500/50 transition-all hover:-translate-y-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                    <Laptop className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {language === 'he' ? 'הגדר כמצלמה' : 'Set as Camera'}
                    </h3>
                    <p className="text-white/60 text-sm">
                      {language === 'he' ? 'השתמש במכשיר זה כמצלמת אבטחה' : 'Use this device as a security camera'}
                    </p>
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  {language === 'he' ? 'הפעל מצלמה' : 'Start Camera'}
                </Button>
              </div>
            </Link>
          )}

          {/* Control Laptop Camera - Remote control card */}
          <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                <Smartphone className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {language === 'he' ? 'שליטה במצלמת הלפטופ' : 'Control Laptop Camera'}
                </h3>
                <p className="text-white/60 text-sm">
                  {language === 'he' 
                    ? 'שלוט מרחוק במצלמת המחשב שלך. הטלפון אינו מצלם.'
                    : 'Control your computer camera remotely. The phone does not record.'}
                </p>
              </div>
            </div>
            {/* Status text */}
            <p className="text-yellow-400/80 text-xs mb-4">
              {language === 'he' ? 'סטטוס: ממתין למחשב מחובר' : 'Status: Waiting for connected computer'}
            </p>
            <div className="flex flex-col gap-3">
              {/* Primary button - Start Camera */}
              {isMobile ? (
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={async () => {
                    try {
                      // Find user's laptop device
                      const { data: devices, error: deviceError } = await supabase
                        .from('devices')
                        .select('id')
                        .eq('device_type', 'laptop')
                        .limit(1);
                      
                      if (deviceError) throw deviceError;
                      
                      if (!devices || devices.length === 0) {
                        toast.error(language === 'he' ? 'לא נמצא מחשב מחובר' : 'No connected computer found');
                        return;
                      }
                      
                      const deviceId = devices[0].id;
                      
                      const { error } = await supabase
                        .from('commands')
                        .insert({
                          device_id: deviceId,
                          command: 'START_CAMERA',
                          handled: false
                        });
                      if (error) throw error;
                      toast.success(language === 'he' ? 'פקודה נשלחה ללפטופ' : 'Command sent to laptop');
                    } catch (error) {
                      toast.error(language === 'he' ? 'שגיאה בשליחת הפקודה' : 'Error sending command');
                    }
                  }}
                >
                  <Power className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'הפעל מצלמה בלפטופ' : 'Start Camera on Laptop'}
                </Button>
              ) : (
                <Button className="w-full bg-slate-600 cursor-not-allowed" disabled>
                  <Power className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'הפעל מצלמה בלפטופ' : 'Start Camera on Laptop'}
                </Button>
              )}
              
              {/* Secondary button - Stop Camera */}
              {isMobile ? (
                <Button 
                  variant="outline"
                  className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={async () => {
                    try {
                      // TODO: Replace with actual device_id from user's devices
                      const TEMP_DEVICE_ID = '00000000-0000-0000-0000-000000000000';
                      const { error } = await supabase
                        .from('commands')
                        .insert({
                          device_id: TEMP_DEVICE_ID,
                          command: 'STOP_CAMERA',
                          handled: false
                        });
                      if (error) throw error;
                      toast.success(language === 'he' ? 'פקודה נשלחה ללפטופ' : 'Command sent to laptop');
                    } catch (error) {
                      toast.error(language === 'he' ? 'שגיאה בשליחת הפקודה' : 'Error sending command');
                    }
                  }}
                >
                  <PowerOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'כבה מצלמה בלפטופ' : 'Stop Camera on Laptop'}
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  className="w-full border-slate-600/50 text-slate-400 cursor-not-allowed" 
                  disabled
                >
                  <PowerOff className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'כבה מצלמה בלפטופ' : 'Stop Camera on Laptop'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* My Devices */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              {language === 'he' ? 'המכשירים שלי' : 'My Devices'}
            </h2>
            <Button variant="default" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'הוסף מכשיר' : 'Add Device'}
            </Button>
          </div>

          {/* Empty State - Different message based on device type */}
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-white/40" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {language === 'he' ? 'אין מכשירים מחוברים' : 'No devices connected'}
            </h3>
            <p className="text-white/60 mb-6 max-w-sm mx-auto">
              {isMobile 
                ? (language === 'he' 
                    ? 'הפעל מצלמה במחשב כדי לצפות בה מכאן'
                    : 'Activate a camera on your computer to view it from here')
                : (language === 'he' 
                    ? 'חבר את המכשיר הראשון שלך כדי להתחיל לצפות בשידור חי'
                    : 'Connect your first device to start watching live stream')}
            </p>
            {/* Only show camera activation button on desktop */}
            {!isMobile && (
              <Link to="/camera">
                <Button className="bg-primary hover:bg-primary/90">
                  {language === 'he' ? 'הפעל מצלמה במכשיר זה' : 'Activate Camera on This Device'}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
