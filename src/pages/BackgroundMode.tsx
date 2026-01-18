import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { FeatureGate } from '@/components/FeatureGate';
import { Moon } from 'lucide-react';

const BackgroundMode = () => {
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
        <FeatureGate
          requires={['isElectron']}
          mode="lock"
          title={language === 'he' ? 'מצב רקע' : 'Background Mode'}
          description={language === 'he' 
            ? 'תכונה זו זמינה רק באפליקציית הדסקטופ'
            : 'This feature is only available in the desktop app'}
          ctaText={language === 'he' ? 'הורד אפליקציה' : 'Download Desktop App'}
          ctaAction={() => window.open('/download', '_blank')}
        >
          {/* Electron-only content */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-8">
              {language === 'he' ? 'מצב רקע' : 'Background Mode'}
            </h1>
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Moon className="w-5 h-5 text-primary" />
                <span className="text-white">
                  {language === 'he' ? 'הגדרות הרצה ברקע' : 'Background running settings'}
                </span>
              </div>
            </div>
          </div>
        </FeatureGate>
      </div>
    </AppLayout>
  );
};

export default BackgroundMode;
