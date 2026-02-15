import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Baby, ArrowLeft, ArrowRight, Camera, CameraOff, Volume2, Mic } from 'lucide-react';

/**
 * Baby Monitor Viewer - v1.0.0
 * Opens with microphone ON (already running in background) and camera OFF.
 * User can manually toggle camera on/off.
 * 
 * NOTE: This page does NOT start a Live View session. 
 * The microphone is already active via the Electron agent when Baby Monitor is armed.
 * Camera activation will reuse the existing Live View flow (START_LIVE_VIEW command).
 */
const BabyMonitorViewer: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [cameraActive, setCameraActive] = useState(false);

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const handleToggleCamera = useCallback(() => {
    if (!cameraActive) {
      // Navigate to regular Viewer to start camera stream
      navigate('/viewer');
    } else {
      setCameraActive(false);
    }
  }, [cameraActive, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link to="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/10"
                >
                  <ArrowIcon className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Baby className="w-5 h-5 text-purple-400" />
                <span className="text-white font-medium">
                  {language === 'he' ? 'ניטור תינוק' : 'Baby Monitor'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
        
        {/* Mic Active Indicator */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center animate-pulse">
            <Mic className="w-12 h-12 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 font-medium text-sm">
              {language === 'he' ? 'מיקרופון פעיל' : 'Microphone Active'}
            </span>
          </div>
          <p className="text-white/50 text-sm text-center max-w-xs">
            {language === 'he' 
              ? 'המיקרופון מאזין ברקע. תקבל התראה אם יזוהה קול.'
              : 'Microphone is listening in the background. You will be alerted if sound is detected.'}
          </p>
        </div>

        {/* Audio Visualization Placeholder */}
        <div className="w-full max-w-sm bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-center gap-1 h-16">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-emerald-500/60 animate-pulse"
                style={{
                  height: `${Math.random() * 40 + 10}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: `${0.8 + Math.random() * 0.4}s`,
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Volume2 className="w-4 h-4 text-white/40" />
            <span className="text-white/40 text-xs">
              {language === 'he' ? 'שמע פעיל' : 'Audio Active'}
            </span>
          </div>
        </div>

        {/* Camera Toggle */}
        <div className="w-full max-w-sm">
          <Button
            onClick={handleToggleCamera}
            variant="outline"
            className="w-full h-14 border-purple-500/50 text-purple-300 hover:bg-purple-500/10 gap-3"
          >
            {cameraActive ? (
              <>
                <CameraOff className="w-5 h-5" />
                {language === 'he' ? 'כבה מצלמה' : 'Turn Off Camera'}
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                {language === 'he' ? 'הפעל מצלמה לצפייה' : 'Turn On Camera to Watch'}
              </>
            )}
          </Button>
          <p className="text-white/30 text-xs text-center mt-2">
            {language === 'he' 
              ? 'המצלמה כבויה כברירת מחדל. הפעל ידנית לצפייה.'
              : 'Camera is off by default. Turn on manually to watch.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BabyMonitorViewer;
