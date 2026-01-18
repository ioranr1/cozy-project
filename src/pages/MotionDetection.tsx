import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Power, PowerOff, Radar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { laptopDeviceId } from '@/config/devices';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';

const MotionDetection: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  // Motion Detection command handler
  const sendMotionDetectionCommand = async (command: 'START_CAMERA' | 'STOP_CAMERA') => {
    if (!laptopDeviceId) {
      toast.error(language === 'he' ? 'לא הוגדר device_id ללפטופ' : 'No device_id configured for laptop');
      return;
    }
    
    const sessionToken = localStorage.getItem('aiguard_session_token');
    if (!sessionToken) {
      toast.error(language === 'he' ? 'לא מחובר - יש להתחבר מחדש' : 'Not logged in - please login again');
      navigate('/login');
      return;
    }
    
    try {
      const response = await fetch('https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          device_id: laptopDeviceId,
          command
        })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send command');
      
      toast.success(
        command === 'START_CAMERA'
          ? (language === 'he' ? 'זיהוי תנועה הופעל' : 'Motion Detection started')
          : (language === 'he' ? 'זיהוי תנועה הופסק' : 'Motion Detection stopped')
      );
    } catch (error) {
      console.error('Command error:', error);
      toast.error(language === 'he' ? 'שגיאה בשליחת הפקודה' : 'Error sending command');
    }
  };

  return (
    <AppLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Radar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {language === 'he' ? 'זיהוי תנועה' : 'Motion Detection'}
              </h1>
              <p className="text-white/60">
                {language === 'he' ? 'שליטה במערכת זיהוי התנועה' : 'Control the motion detection system'}
              </p>
            </div>
          </div>
        </div>

        {/* Main Control Card */}
        <div className="bg-gradient-to-br from-amber-600/20 to-orange-800/20 border border-amber-500/30 rounded-2xl p-6 max-w-xl">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <p className="text-white/80 text-sm">
              {language === 'he' 
                ? 'זיהוי תנועה ישלח התראות כאשר מזוהה תנועה באזור המצלמה'
                : 'Motion detection will send alerts when movement is detected in the camera area'}
            </p>
          </div>

          {/* Control Buttons */}
          <div className="space-y-4">
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg"
              onClick={() => sendMotionDetectionCommand('START_CAMERA')}
            >
              <Power className={`w-5 h-5 ${isRTL ? 'ml-3' : 'mr-3'}`} />
              {language === 'he' ? 'הפעל זיהוי תנועה' : 'Start Motion Detection'}
            </Button>
            
            <Button 
              variant="outline"
              className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 py-6 text-lg"
              onClick={() => sendMotionDetectionCommand('STOP_CAMERA')}
            >
              <PowerOff className={`w-5 h-5 ${isRTL ? 'ml-3' : 'mr-3'}`} />
              {language === 'he' ? 'הפסק זיהוי תנועה' : 'Stop Motion Detection'}
            </Button>
          </div>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-white/60">
                <p className="mb-1">
                  {language === 'he' 
                    ? 'תצוגה מקדימה של מצלמה לא מפעילה זיהוי תנועה'
                    : 'Camera preview does not activate motion detection'}
                </p>
                <p>
                  {language === 'he'
                    ? 'לבדיקת המצלמה, עבור לעמוד "מצלמות"'
                    : 'To test camera, go to "Cameras" page'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default MotionDetection;
