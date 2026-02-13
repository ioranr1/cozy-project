import React from 'react';
import { Eye, Baby, Camera, CameraOff, Loader2 } from 'lucide-react';
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
  babyMonitorEnabled: boolean;
}

interface MonitoringSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: MonitoringSettings;
  onSettingsChange: (settings: MonitoringSettings) => void;
  onConfirm: () => void;
  onDeactivate?: () => void;
  onUpdateSettings?: () => void;
  isLoading?: boolean;
  isArmed?: boolean;
  settingsChanged?: boolean;
  cameraStatus?: 'active' | 'inactive' | 'loading';
}

export const MonitoringSettingsDialog: React.FC<MonitoringSettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  onConfirm,
  onDeactivate,
  onUpdateSettings,
  isLoading = false,
  isArmed = false,
  settingsChanged = false,
  cameraStatus = 'inactive',
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
    babyMonitor: language === 'he' ? 'ניטור תינוק' : 'Baby Monitor',
    babyMonitorDesc: language === 'he' 
      ? 'שידור חי עם קול ווידאו להורים • ללא התראות' 
      : 'Live audio & video stream for parents • No alerts',
    babyMonitorNote: language === 'he'
      ? 'כשמופעל, ההורה יכול לצפות ולשמוע בזמן אמת דרך הנייד'
      : 'When enabled, parent can watch & listen in real-time from mobile',
    activate: language === 'he' ? 'הפעל ניטור' : 'Activate Monitoring',
    deactivate: language === 'he' ? 'כבה ניטור' : 'Deactivate Monitoring',
    updateSettings: language === 'he' ? 'עדכן הגדרות' : 'Update Settings',
    cancel: language === 'he' ? 'ביטול' : 'Cancel',
    close: language === 'he' ? 'סגור' : 'Close',
    on: language === 'he' ? 'פעיל' : 'On',
    off: language === 'he' ? 'כבוי' : 'Off',
    cameraActive: language === 'he' ? 'מצלמה פעילה ומנטרת' : 'Camera active & monitoring',
    cameraInactive: language === 'he' ? 'המצלמה תופעל לאחר שליחת פקודה למחשב' : 'Camera will activate after sending a command to the computer',
    cameraLoading: language === 'he' ? 'מפעיל מצלמה...' : 'Activating camera...',
    cameraWaitingAck: language === 'he' ? 'ממתין לאישור מהמחשב…' : 'Waiting for computer acknowledgment…',
  };

  const handleMotionToggle = (checked: boolean) => {
    onSettingsChange({ ...settings, motionEnabled: checked });
  };

  const handleBabyMonitorToggle = (checked: boolean) => {
    onSettingsChange({ ...settings, babyMonitorEnabled: checked });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="bg-slate-900 border-slate-700 text-white max-w-sm mx-auto max-h-[90vh] overflow-y-auto"
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

        {/* Camera Status Indicator */}
        <div className={`flex items-center gap-3 p-3 rounded-xl ${
          cameraStatus === 'active' 
            ? 'bg-emerald-500/10 border border-emerald-500/30' 
            : cameraStatus === 'loading'
            ? 'bg-amber-500/10 border border-amber-500/30'
            : 'bg-slate-800/50 border border-slate-700'
        }`}>
          <div className={`relative w-10 h-10 rounded-lg flex items-center justify-center ${
            cameraStatus === 'active' 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : cameraStatus === 'loading'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-slate-700/50 text-slate-400'
          }`}>
            {cameraStatus === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : cameraStatus === 'active' ? (
              <Camera className="w-5 h-5" />
            ) : (
              <CameraOff className="w-5 h-5" />
            )}
            {cameraStatus === 'active' && (
              <span className="absolute inset-0 rounded-lg bg-emerald-500/30 animate-ping opacity-50" />
            )}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              cameraStatus === 'active' 
                ? 'text-emerald-400' 
                : cameraStatus === 'loading'
                ? 'text-amber-400'
                : 'text-slate-400'
            }`}>
              {cameraStatus === 'active' 
                ? t.cameraActive 
                : cameraStatus === 'loading' 
                ? t.cameraLoading 
                : isArmed
                  ? t.cameraWaitingAck
                  : t.cameraInactive}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${
            cameraStatus === 'active' 
              ? 'bg-emerald-500 animate-pulse' 
              : cameraStatus === 'loading'
              ? 'bg-amber-500 animate-pulse'
              : 'bg-slate-600'
          }`} />
        </div>

        <div className="space-y-4 py-2">
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

          {/* Baby Monitor Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  settings.babyMonitorEnabled 
                    ? 'bg-purple-500/20 text-purple-400' 
                    : 'bg-slate-700/50 text-slate-400'
                }`}>
                  <Baby className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{t.babyMonitor}</p>
                  <p className="text-xs text-slate-400">{t.babyMonitorDesc}</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Switch
                  checked={settings.babyMonitorEnabled}
                  onCheckedChange={handleBabyMonitorToggle}
                  className={settings.babyMonitorEnabled ? 'data-[state=checked]:bg-purple-500' : ''}
                />
                <span className={`text-xs ${settings.babyMonitorEnabled ? 'text-purple-400' : 'text-slate-500'}`}>
                  {settings.babyMonitorEnabled ? t.on : t.off}
                </span>
              </div>
            </div>

            {/* Baby Monitor Info Note */}
            {settings.babyMonitorEnabled && (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2.5">
                <p className="text-xs text-purple-300 flex items-center gap-2">
                  <span>👶</span>
                  <span>{t.babyMonitorNote}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {isArmed ? (
            <>
              {settingsChanged && onUpdateSettings ? (
                <Button
                  onClick={onUpdateSettings}
                  disabled={isLoading || (!settings.motionEnabled && !settings.babyMonitorEnabled)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    t.updateSettings
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                  disabled={isLoading}
                >
                  {t.close}
                </Button>
              )}
              <Button
                onClick={onDeactivate}
                disabled={isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  t.deactivate
                )}
              </Button>
            </>
          ) : (
            <>
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
                disabled={isLoading || (!settings.motionEnabled && !settings.babyMonitorEnabled)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  t.activate
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
