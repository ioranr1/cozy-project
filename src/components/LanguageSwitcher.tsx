import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage, isRTL } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
      className={`gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full px-4 backdrop-blur-sm ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      <Globe className="h-4 w-4" />
      {language === 'he' ? 'עברית' : 'English'}
    </Button>
  );
};
