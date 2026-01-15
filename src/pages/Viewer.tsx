import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft, ArrowRight, Video, Wifi } from 'lucide-react';

const Viewer: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) {
      navigate('/login');
    }
  }, [navigate]);

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <ArrowIcon className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">AIGuard</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
            {language === 'he' ? 'צפייה במצלמות' : 'Camera Viewer'}
          </h1>

          {/* Empty State */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
              <Video className="w-10 h-10 text-green-400" />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-3">
              {language === 'he' ? 'אין מצלמות פעילות' : 'No Active Cameras'}
            </h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">
              {language === 'he'
                ? 'כדי לצפות בשידור חי, יש להפעיל מצלמה במכשיר אחר (לפטופ או טלפון ישן)'
                : 'To watch live stream, activate a camera on another device (laptop or old phone)'}
            </p>

            {/* Coming Soon Notice */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 max-w-md mx-auto">
              <Wifi className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'בקרוב: שידור חי' : 'Coming Soon: Live Streaming'}
              </h3>
              <p className="text-white/60 text-sm">
                {language === 'he'
                  ? 'תכונת השידור בזמן אמת בין מכשירים תהיה זמינה בגרסה הבאה עם WebRTC'
                  : 'Real-time streaming between devices will be available in the next version with WebRTC'}
              </p>
            </div>

            <div className="mt-8">
              <Link to="/camera">
                <Button className="bg-primary hover:bg-primary/90">
                  {language === 'he' ? 'הפעל מצלמה במכשיר זה' : 'Activate Camera on This Device'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Viewer;
