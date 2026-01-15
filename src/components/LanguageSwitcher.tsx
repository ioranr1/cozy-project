import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === 'he' ? 'en' : 'he')}
      className="gap-2 text-white hover:text-white hover:bg-white/20 border border-white/30 rounded-full px-4"
    >
      <Globe className="h-4 w-4" />
      {language === 'he' ? 'עברית' : 'English'}
    </Button>
  );
};
