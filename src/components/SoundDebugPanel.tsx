import React, { useState, useMemo } from 'react';
import { Bug, Mic, Cpu, RotateCcw, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDevices } from '@/hooks/useDevices';
import { getSessionToken } from '@/hooks/useSession';

type TestPhase = 1 | 6 | null;

export const SoundDebugPanel: React.FC = () => {
  const { language } = useLanguage();
  const [activePhase, setActivePhase] = useState<TestPhase>(null);
  const [isRunning, setIsRunning] = useState(false);

  const profileId = useMemo(() => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      try { return JSON.parse(stored).id; } catch { return undefined; }
    }
    return undefined;
  }, []);

  const { selectedDevice } = useDevices(profileId);
  const deviceId = selectedDevice?.id;

  const runTest = async (phase: TestPhase) => {
    if (!deviceId || !profileId) {
      toast.error(language === 'he' ? 'לא נמצא מכשיר' : 'No device found');
      return;
    }

    setIsRunning(true);
    setActivePhase(phase);

    try {
      // Step 1: Update monitoring_config with debug_phase
      const config: Record<string, any> = {
        monitoring_enabled: true,
        ai_validation_enabled: false,
        notification_cooldown_ms: 60000,
        sensors: {
          motion: { enabled: false, targets: [], confidence_threshold: 0.7, debounce_ms: 60000 },
          sound: {
            enabled: true,
            targets: ['scream'],
            confidence_threshold: 0.25,
            debounce_ms: 2000,
            ...(phase !== null ? { debug_phase: phase } : {}),
          },
        },
      };

      // Remove debug_phase key entirely when resetting
      if (phase === null) {
        delete config.sensors.sound.debug_phase;
      }

      const { error: configError } = await supabase
        .from('monitoring_config')
        .upsert({
          device_id: deviceId,
          profile_id: profileId,
          config,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'device_id' });

      if (configError) {
        console.error('[SoundDebug] Config update error:', configError);
        toast.error(language === 'he' ? 'שגיאה בעדכון הגדרות' : 'Config update failed');
        setIsRunning(false);
        return;
      }

      if (phase === null) {
        // Just resetting - no need to send command
        toast.success(language === 'he' ? '✅ הוחזר למצב רגיל' : '✅ Reset to normal mode');
        setActivePhase(null);
        setIsRunning(false);
        return;
      }

      // Step 2: Update device_status
      await supabase
        .from('device_status')
        .update({
          is_armed: true,
          motion_enabled: false,
          sound_enabled: true,
          last_command: 'ARM',
          last_command_at: new Date().toISOString(),
        })
        .eq('device_id', deviceId);

      // Step 3: Send SET_MONITORING:ON command
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        toast.error(language === 'he' ? 'נדרשת התחברות מחדש' : 'Please log in again');
        setIsRunning(false);
        return;
      }

      const response = await supabase.functions.invoke('send-command', {
        body: { device_id: deviceId, command: 'SET_MONITORING:ON', session_token: sessionToken },
      });

      if (response.error || !response.data?.success) {
        toast.error(language === 'he' ? 'שגיאה בשליחת פקודה' : 'Command failed');
        setIsRunning(false);
        return;
      }

      const phaseLabel = phase === 1
        ? (language === 'he' ? 'מיקרופון בלבד' : 'Mic only')
        : (language === 'he' ? 'מודל בלבד' : 'Model only');

      toast.success(
        language === 'he'
          ? `🧪 בדיקה הופעלה: ${phaseLabel}`
          : `🧪 Test started: ${phaseLabel}`
      );
    } catch (err) {
      console.error('[SoundDebug] Error:', err);
      toast.error(language === 'he' ? 'שגיאה' : 'Error');
    } finally {
      setIsRunning(false);
    }
  };

  if (!deviceId) return null;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-400">
        <Bug className="w-5 h-5" />
        <h3 className="font-bold text-sm">
          {language === 'he' ? '🧪 בדיקת קול — איתור קריסה' : '🧪 Sound Debug — Crash Isolation'}
        </h3>
      </div>

      <p className="text-white/50 text-xs">
        {language === 'he'
          ? 'לחץ על אחת הבדיקות, ואז עבור לאלקטרון וחכה 20 שניות. אם לא קרס — הבדיקה עברה ✅'
          : 'Click a test, then go to Electron and wait 20 seconds. No crash = test passed ✅'}
      </p>

      <div className="flex flex-col gap-2">
        {/* Test A: Mic only */}
        <Button
          variant={activePhase === 1 ? 'default' : 'outline'}
          size="sm"
          className="justify-start gap-2"
          disabled={isRunning}
          onClick={() => runTest(1)}
        >
          {isRunning && activePhase === 1 ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : activePhase === 1 && !isRunning ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          {language === 'he' ? 'בדיקה A — מיקרופון בלבד (בלי מודל)' : 'Test A — Mic only (no model)'}
        </Button>

        {/* Test B: Model only */}
        <Button
          variant={activePhase === 6 ? 'default' : 'outline'}
          size="sm"
          className="justify-start gap-2"
          disabled={isRunning}
          onClick={() => runTest(6)}
        >
          {isRunning && activePhase === 6 ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : activePhase === 6 && !isRunning ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <Cpu className="w-4 h-4" />
          )}
          {language === 'he' ? 'בדיקה B — מודל בלבד (בלי מיקרופון)' : 'Test B — Model only (no mic)'}
        </Button>

        {/* Reset */}
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-white/40 hover:text-white/80"
          disabled={isRunning}
          onClick={() => runTest(null)}
        >
          <RotateCcw className="w-4 h-4" />
          {language === 'he' ? 'החזר למצב רגיל' : 'Reset to normal'}
        </Button>
      </div>
    </div>
  );
};
