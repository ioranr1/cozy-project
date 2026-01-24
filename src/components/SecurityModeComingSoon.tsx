import React from 'react';
import { Shield, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SecurityModeComingSoonProps {
  className?: string;
}

/**
 * Security Mode Placeholder Card
 * Only shown when feature.security_mode is ON.
 * This is a scaffold - no actual detection implemented.
 */
export const SecurityModeComingSoon: React.FC<SecurityModeComingSoonProps> = ({ className }) => {
  const { language } = useLanguage();

  const t = {
    title: language === 'he' ? 'מצב אבטחה' : 'Security Mode',
    comingSoon: language === 'he' ? 'בקרוב...' : 'Coming Soon...',
    description: language === 'he' 
      ? 'זיהוי תנועה וקול אוטומטי כשאתה לא בבית' 
      : 'Automatic motion and sound detection while you\'re away',
    requires: language === 'he' 
      ? 'דורש הפעלת מצב Away' 
      : 'Requires Away Mode to be active',
  };

  return (
    <div className={`bg-gradient-to-br from-slate-700/30 to-slate-800/30 border border-slate-600/30 rounded-2xl p-5 opacity-60 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-700/50 relative">
          <Shield className="w-6 h-6 text-slate-400" />
          <Lock className="w-3 h-3 text-slate-500 absolute -bottom-0.5 -right-0.5" />
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white/70">
              {t.title}
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-600/50 text-slate-400 text-xs font-medium">
              {t.comingSoon}
            </span>
          </div>
          <p className="text-white/40 text-xs">
            {t.description}
          </p>
        </div>
      </div>

      {/* Requirement notice */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
        <Lock className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-slate-500 text-xs">
          {t.requires}
        </span>
      </div>
    </div>
  );
};
