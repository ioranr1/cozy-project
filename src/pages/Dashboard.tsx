import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Shield, Laptop, Smartphone, Plus, LogOut, Video } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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

          {/* View Cameras - Always visible, but primary action on mobile */}
          <Link to="/viewer">
            <div className="group bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-2xl p-6 hover:border-green-500/50 transition-all hover:-translate-y-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                  <Smartphone className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {language === 'he' ? 'צפה במצלמות' : 'View Cameras'}
                  </h3>
                  <p className="text-white/60 text-sm">
                    {language === 'he' 
                      ? (isMobile ? 'שלוט וצפה בשידור חי מהמצלמות שלך' : 'צפה בשידור חי מהמצלמות שלך')
                      : (isMobile ? 'Control and watch live stream from your cameras' : 'Watch live stream from your cameras')}
                  </p>
                </div>
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700">
                {language === 'he' ? 'צפה עכשיו' : 'Watch Now'}
              </Button>
            </div>
          </Link>
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
