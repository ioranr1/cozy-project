import React from 'react';
import { Eye, Volume2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';

export interface MonitoringSettings {
  motionEnabled: boolean;
  soundEnabled: boolean;
}

interface MonitoringSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: MonitoringSettings;
  onSettingsChange: (settings: MonitoringSettings) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

/**
 * Dialog for configuring monitoring detection sensors.
 * Opens when user activates the Security/Monitoring toggle.
 * Motion is ON by default, Sound is OFF by default.
 */
export const MonitoringSettingsDialog: React.FC<MonitoringSettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  onConfirm,
  isLoading = false,
}) => {
  const { language, isRTL } = useLanguage();

  const t = {
    title: language === 'he' ? 'הגדרות ניטור' : 'Monitoring Settings',
    description: language === 'he' 
      ? 'בחר אילו חיישנים להפעיל במצב ניטור' 
      : 'Choose which sensors to activate in monitoring mode',
    motionDetection: language === 'he' ? 'זיהוי תנועה' : 'Motion Detection',
    motionDesc: language === 'he' 
      ? 'מזהה תנועה במצלמה ושולח התראות' 
      : 'Detects movement in camera and sends alerts',
    soundDetection: language === 'he' ? 'זיהוי קול' : 'Sound Detection',
    soundDesc: language === 'he' 
      ? 'מזהה קולות חריגים ושולח התראות' 
      : 'Detects unusual sounds and sends alerts',
    activate: language === 'he' ? 'הפעל ניטור' : 'Activate Monitoring',
    cancel: language === 'he' ? 'ביטול' : 'Cancel',
    on: language === 'he' ? 'פעיל' : 'On',
    off: language === 'he' ? 'כבוי' : 'Off',
  };

  const handleMotionToggle = (checked: boolean) => {
    onSettingsChange({ ...settings, motionEnabled: checked });
  };

  const handleSoundToggle = (checked: boolean) => {
    onSettingsChange({ ...settings, soundEnabled: checked });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-slate-900 border-slate-700 text-white max-w-sm mx-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white">
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            {t.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Motion Detection Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                settings.motionEnabled 
                  ? 'bg-emerald-500/20 text-emerald-400' 
                  : 'bg-slate-700/50 text-slate-400'
              }`}>
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{t.motionDetection}</p>
                <p className="text-xs text-slate-400">{t.motionDesc}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Switch
                checked={settings.motionEnabled}
                onCheckedChange={handleMotionToggle}
                className={settings.motionEnabled ? 'data-[state=checked]:bg-emerald-500' : ''}
              />
              <span className={`text-xs ${settings.motionEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                {settings.motionEnabled ? t.on : t.off}
              </span>
            </div>
          </div>

          {/* Sound Detection Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                settings.soundEnabled 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-slate-700/50 text-slate-400'
              }`}>
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{t.soundDetection}</p>
                <p className="text-xs text-slate-400">{t.soundDesc}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={handleSoundToggle}
                className={settings.soundEnabled ? 'data-[state=checked]:bg-blue-500' : ''}
              />
              <span className={`text-xs ${settings.soundEnabled ? 'text-blue-400' : 'text-slate-500'}`}>
                {settings.soundEnabled ? t.on : t.off}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
            disabled={isLoading}
          >
            {t.cancel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || (!settings.motionEnabled && !settings.soundEnabled)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isLoading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              t.activate
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
