import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const InstallationGuideButton: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4 text-center">
        <Link to="/installation-guide">
          <Button
            size="lg"
            className="bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-xl transition-all"
          >
            <BookOpen className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
            {t.installationGuide.button}
          </Button>
        </Link>
      </div>
    </section>
  );
};
