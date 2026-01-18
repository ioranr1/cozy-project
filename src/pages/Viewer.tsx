import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, ArrowRight, Video, Wifi, Laptop, Play } from 'lucide-react';
import { toast } from 'sonner';

interface Device {
  id: string;
  device_name: string;
  device_type: string;
  is_active: boolean;
  last_seen_at: string | null;
}

const Viewer: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingDevice, setStartingDevice] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) {
      navigate('/login');
      return;
    }

    fetchDevices();
  }, [navigate]);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('id, device_name, device_type, is_active, last_seen_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching devices:', error);
        return;
      }

      setDevices(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewLive = async (device: Device) => {
    // Viewer screen must not create a separate start flow.
    // Starting the stream is done from the main screen (Dashboard) using the unified remote command.
    toast.info(
      language === 'he'
        ? 'אין שידור פעיל. הפעל מהמסך הראשי'
        : 'No active stream. Start it from the main screen.'
    );
    navigate('/dashboard');
  };

  const getDeviceStatus = (device: Device) => {
    if (!device.last_seen_at) {
      return { label: language === 'he' ? 'לא מחובר' : 'Never connected', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
    }
    
    const lastSeen = new Date(device.last_seen_at);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = diffMs / (1000 * 60);
    
    if (diffMins < 2) {
      return { label: language === 'he' ? 'מחובר' : 'Online', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
    } else if (diffMins < 10) {
      return { label: language === 'he' ? 'לאחרונה' : 'Recently', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
    }
    return { label: language === 'he' ? 'לא מחובר' : 'Offline', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
  };

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
              >
                <ArrowIcon className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">AIGuard</span>
              </div>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 text-center">
            {language === 'he' ? 'צפייה במצלמות' : 'Camera Viewer'}
          </h1>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : devices.length > 0 ? (
            <div className="space-y-4">
              {devices.map((device) => {
                const status = getDeviceStatus(device);
                const isOnline = status.label === (language === 'he' ? 'מחובר' : 'Online');
                const isStarting = startingDevice === device.id;

                return (
                  <div
                    key={device.id}
                    className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 flex items-center justify-center">
                        <Laptop className="w-7 h-7 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{device.device_name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={`${status.color} border text-xs`}>
                            {status.label}
                          </Badge>
                          <span className="text-xs text-white/40">{device.device_type}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleViewLive(device)}
                      disabled={isStarting}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isStarting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      ) : (
                        <>
                          <Play className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          {language === 'he' ? 'הפעל מהמסך הראשי' : 'Start from Dashboard'}
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                <Video className="w-10 h-10 text-green-400" />
              </div>
              
              <h2 className="text-xl font-bold text-white mb-3">
                {language === 'he' ? 'אין מצלמות מוגדרות' : 'No Cameras Set Up'}
              </h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto">
                {language === 'he'
                  ? 'כדי לצפות בשידור חי, יש להפעיל מצלמה במכשיר אחר (לפטופ או טלפון ישן)'
                  : 'To watch live stream, activate a camera on another device (laptop or old phone)'}
              </p>

              {/* WebRTC Notice */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 max-w-md mx-auto">
                <Wifi className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-white mb-2">
                  {language === 'he' ? 'WebRTC מוכן!' : 'WebRTC Ready!'}
                </h3>
                <p className="text-white/60 text-sm">
                  {language === 'he'
                    ? 'הסיגנלינג מוכן. ברגע שתפעיל את סוכן המצלמה, תוכל לצפות בשידור חי'
                    : 'Signaling is ready. Once you activate the camera agent, you can watch the live stream'}
                </p>
              </div>

              <div className="mt-8">
                <Link to="/camera">
                  <Button className="bg-primary hover:bg-primary/90">
                    {language === 'he' ? 'הפעל מצלמה במכשיר זה' : 'Activate Camera on This Device'}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Viewer;
