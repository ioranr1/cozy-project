import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface DashboardHeaderProps {
  userFullName: string;
  subtitle?: string;
  roleBadge?: {
    label: string;
    variant: 'emerald' | 'blue';
  };
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  userFullName, 
  subtitle,
  roleBadge 
}) => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('aiguard_session_token');
    navigate('/login');
  };

  return (
    <header className="bg-slate-800/30 backdrop-blur-sm border-b border-slate-700/30">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-white">
                {language === 'he' ? `שלום, ${userFullName}` : `Hello, ${userFullName}`}
              </h1>
              {roleBadge && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                  roleBadge.variant === 'emerald' 
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {roleBadge.label}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-white/60 text-sm mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
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
  );
};

export default DashboardHeader;