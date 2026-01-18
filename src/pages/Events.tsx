import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Calendar } from 'lucide-react';

const Events = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) {
      navigate('/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate]);

  if (!isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">
            {language === 'he' ? 'אירועים' : 'Events'}
          </h1>
        </div>

        {/* Empty State */}
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-medium text-white mb-2">
            {language === 'he' ? 'אין אירועים' : 'No events'}
          </h2>
          <p className="text-slate-400 max-w-sm mx-auto">
            {language === 'he' 
              ? 'אירועים יופיעו כאן כשהמצלמה תזהה תנועה'
              : 'Events will appear here when motion is detected'}
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Events;
