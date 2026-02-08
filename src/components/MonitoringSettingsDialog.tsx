import React from 'react';
import { Eye, Volume2, Camera, CameraOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

/** All available sound detection targets */
export const ALL_SOUND_TARGETS = [
  'glass_breaking',
  'baby_crying',
  'dog_barking',
  'alarm',
  'gunshot',
  'scream',
  'siren',
  'door_knock',
] as const;

export type SoundTarget = typeof ALL_SOUND_TARGETS[number];

/** Sound categories for grouped display */
type SoundCategory = 'security' | 'disturbance' | 'informational';

interface SoundCategoryInfo {
  id: SoundCategory;
  labelHe: string;
  labelEn: string;
  targets: SoundTarget[];
}

const SOUND_CATEGORIES: SoundCategoryInfo[] = [
  {
    id: 'security',
    labelHe: '🔒 אבטחה',
    labelEn: '🔒 Security',
    targets: ['glass_breaking', 'alarm', 'gunshot', 'siren'],
  },
  {
    id: 'disturbance',
    labelHe: '🏠 רעשי בית',
    labelEn: '🏠 Home Noises',
    targets: ['door_knock', 'dog_barking', 'scream'],
  },
  {
    id: 'informational',
    labelHe: '👶 משפחתי',
    labelEn: '👶 Family',
    targets: ['baby_crying'],
  },
];

/** Default: Family category (baby_crying) */
export const DEFAULT_SOUND_TARGETS: SoundTarget[] = ['baby_crying'];

/** Default category */
export const DEFAULT_SOUND_CATEGORY: SoundCategory = 'informational';

export interface MonitoringSettings {
  motionEnabled: boolean;
  soundEnabled: boolean;
  soundTargets: SoundTarget[];
}

interface MonitoringSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: MonitoringSettings;
  onSettingsChange: (settings: MonitoringSettings) => void;
  onConfirm: () => void;
  onDeactivate?: () => void;
  isLoading?: boolean;
  isArmed?: boolean;
  /** Current camera/monitoring status from device_status */
  cameraStatus?: 'active' | 'inactive' | 'loading';
}

const SOUND_TARGET_LABELS: Record<SoundTarget, { he: string; en: string; icon: string; descHe: string; descEn: string }> = {
  glass_breaking: { he: 'שבירת זכוכית', en: 'Glass Breaking', icon: '🪟', descHe: '', descEn: '' },
  baby_crying:    { he: 'בכי תינוק', en: 'Baby Crying', icon: '👶', descHe: 'התראה אינפורמטיבית', descEn: 'Informational alert' },
  dog_barking:    { he: 'נביחת כלב', en: 'Dog Barking', icon: '🐕', descHe: '', descEn: '' },
  alarm:          { he: 'אזעקה', en: 'Alarm', icon: '🚨', descHe: '', descEn: '' },
  gunshot:        { he: 'ירי', en: 'Gunshot', icon: '💥', descHe: '', descEn: '' },
  scream:         { he: 'צעקה / צעקת עזרה', en: 'Scream / Shout', icon: '😱', descHe: '', descEn: '' },
  siren:          { he: 'סירנה', en: 'Siren', icon: '🚑', descHe: '', descEn: '' },
  door_knock:     { he: 'דפיקה בדלת', en: 'Door Knock', icon: '🚪', descHe: '', descEn: '' },
};

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
  onDeactivate,
  isLoading = false,
  isArmed = false,
  cameraStatus = 'inactive',
}) => {
  const { language, isRTL } = useLanguage();
  const [soundExpanded, setSoundExpanded] = React.useState(false);

  // Derive active category from current soundTargets
  const getActiveCategory = (): SoundCategory => {
    for (const cat of SOUND_CATEGORIES) {
      const catTargets = cat.targets;
      if (catTargets.every(t => settings.soundTargets.includes(t)) &&
          settings.soundTargets.every(t => catTargets.includes(t as SoundTarget))) {
        return cat.id;
      }
    }
    return 'informational'; // default
  };

  const activeCategory = getActiveCategory();

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
    soundTargetsLabel: language === 'he' ? 'בחר קטגוריית קול' : 'Choose sound category',
    includes: language === 'he' ? 'כולל:' : 'Includes:',
    activate: language === 'he' ? 'הפעל ניטור' : 'Activate Monitoring',
    deactivate: language === 'he' ? 'כבה ניטור' : 'Deactivate Monitoring',
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

  const handleSoundToggle = (checked: boolean) => {
    onSettingsChange({ 
      ...settings, 
      soundEnabled: checked,
      soundTargets: checked && settings.soundTargets.length === 0 
        ? [...DEFAULT_SOUND_TARGETS] 
        : settings.soundTargets,
    });
  };

  const handleCategoryChange = (categoryId: string) => {
    const category = SOUND_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      onSettingsChange({ ...settings, soundTargets: [...category.targets] });
    }
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

          {/* Sound Detection Toggle */}
          <div className="space-y-2">
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

            {/* Sound Category - Radio selection */}
            {settings.soundEnabled && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden p-3 space-y-2">
                <p className="text-xs text-slate-400 mb-2">{t.soundTargetsLabel}</p>
                <RadioGroup
                  value={activeCategory}
                  onValueChange={handleCategoryChange}
                  className="space-y-2"
                >
                  {SOUND_CATEGORIES.map((category) => {
                    const isSelected = activeCategory === category.id;
                    return (
                      <label
                        key={category.id}
                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                          isSelected 
                            ? 'bg-blue-500/10 border-blue-500/40' 
                            : 'border-transparent hover:bg-slate-700/30'
                        }`}
                      >
                        <RadioGroupItem
                          value={category.id}
                          className="mt-0.5 border-slate-500 data-[state=checked]:border-blue-500 data-[state=checked]:text-blue-500"
                        />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                            {language === 'he' ? category.labelHe : category.labelEn}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {t.includes}{' '}
                            {category.targets.map(target => {
                              const info = SOUND_TARGET_LABELS[target];
                              return `${info.icon} ${language === 'he' ? info.he : info.en}`;
                            }).join(', ')}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {isArmed ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                disabled={isLoading}
              >
                {t.close}
              </Button>
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
                disabled={isLoading || (!settings.motionEnabled && !settings.soundEnabled)}
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
