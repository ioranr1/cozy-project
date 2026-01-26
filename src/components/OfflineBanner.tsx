import React, { forwardRef } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface OfflineBannerProps {
  className?: string;
}

/**
 * A persistent warning banner displayed when the computer/camera is offline.
 * Blocks user interaction awareness - all controls should be disabled when this shows.
 */
export const OfflineBanner = forwardRef<HTMLDivElement, OfflineBannerProps>(
  ({ className }, ref) => {
    const { language, isRTL } = useLanguage();
    
    const t = {
      title: language === 'he' ? 'המחשב לא מחובר' : 'Computer Offline',
      message: language === 'he' 
        ? 'פתח את האפליקציה במחשב כדי לאפשר שליטה מרחוק' 
        : 'Open the app on your computer to enable remote control',
    };

    return (
      <div 
        ref={ref}
        className={`bg-amber-500/20 border border-amber-500/50 rounded-xl p-3 ${className || ''}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/30 flex items-center justify-center flex-shrink-0">
            <WifiOff className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-amber-300 font-semibold text-sm">
              {t.title}
            </h4>
            <p className="text-amber-200/70 text-xs mt-0.5">
              {t.message}
            </p>
          </div>
        </div>
      </div>
    );
  }
);

OfflineBanner.displayName = 'OfflineBanner';
