import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, ArrowRight, Mic } from 'lucide-react';
import MicrophoneTest from '@/components/MicrophoneTest';

const MicrophoneTestPage: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link to="/dashboard" className="text-white/60 hover:text-white transition-colors">
          <BackArrow className="w-5 h-5" />
        </Link>
        <Mic className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">
          {language === 'he' ? 'בדיקת מיקרופון' : 'Microphone Test'}
        </h1>
      </div>

      {/* Description */}
      <p className="text-white/60 text-sm mb-6 max-w-lg">
        {language === 'he'
          ? 'בדוק שהמיקרופון של המכשיר פועל כראוי. לחץ על "בדוק" ודבר — אם הפס מגיב, המיקרופון תקין.'
          : 'Test that your device microphone is working properly. Click "Test" and speak — if the bar reacts, the microphone is working.'}
      </p>

      {/* Microphone Test Component */}
      <div className="max-w-md">
        <MicrophoneTest />
      </div>
    </div>
  );
};

export default MicrophoneTestPage;
