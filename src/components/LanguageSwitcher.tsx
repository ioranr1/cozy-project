import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'light' | 'dark';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'light' }) => {
  const { language, setLanguage, isRTL } = useLanguage();

  const classes = variant === 'dark'
    ? 'gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 rounded-full px-4'
    : 'gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full px-4 backdrop-blur-sm';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
      className={`${classes} ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      <Globe className="h-4 w-4" />
      {language === 'he' ? 'עברית' : 'English'}
    </Button>
  );
};
