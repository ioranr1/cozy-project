import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, ArrowRight, Video, Laptop, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { useLiveViewState } from '@/hooks/useLiveViewState';

type ViewerState = 'idle' | 'connecting' | 'connected' | 'error';

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
  const [primaryDevice, setPrimaryDevice] = useState<Device | null>(null);
  
  // Live View state
  const [viewerState, setViewerState] = useState<ViewerState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Get primary device ID for live view state hook
  const primaryDeviceId = primaryDevice?.id || '';
  const { liveViewActive, isLoading: liveStateLoading } = useLiveViewState({ deviceId: primaryDeviceId });

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) {
      navigate('/login');
      return;
    }

    fetchDevices();
  }, [navigate]);

  // Update viewer state based on liveViewActive
  useEffect(() => {
    if (!primaryDevice) return;
    
    if (liveViewActive && viewerState === 'idle') {
      // Live view is active, we should try to connect
      setViewerState('connecting');
      // TODO: WebRTC connection logic will go here
      // For now, simulate connection attempt
      console.log('[Viewer] Live view active, starting connection...');
    } else if (!liveViewActive && viewerState !== 'idle') {
      // Live view stopped, reset to idle
      cleanupStream();
      setViewerState('idle');
    }
  }, [liveViewActive, viewerState, primaryDevice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
    };
  }, []);

  const cleanupStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

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
      // Set the first device as primary for now
      if (data && data.length > 0) {
        setPrimaryDevice(data[0]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setViewerState('connecting');
    // TODO: Retry WebRTC connection
  };

  const getDeviceStatus = (device: Device) => {
    if (!device.last_seen_at) {
      return { label: language === 'he' ? 'לא מחובר' : 'Never connected', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', isOnline: false };
    }
    
    const lastSeen = new Date(device.last_seen_at);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffSeconds = diffMs / 1000;
    
    if (diffSeconds < 30) {
      return { label: language === 'he' ? 'מחובר' : 'Online', color: 'bg-green-500/20 text-green-400 border-green-500/30', isOnline: true };
    } else if (diffSeconds < 120) {
      return { label: language === 'he' ? 'לאחרונה' : 'Recently', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', isOnline: false };
    }
    return { label: language === 'he' ? 'לא מחובר' : 'Offline', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', isOnline: false };
  };

  // Attach MediaStream to video element (will be called by WebRTC logic)
  const attachStream = (stream: MediaStream) => {
    mediaStreamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      setViewerState('connected');
    }
  };

  // Handle stream error (will be called by WebRTC logic)
  const handleStreamError = (error: string) => {
    setErrorMessage(error);
    setViewerState('error');
    cleanupStream();
  };

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  const renderViewerContent = () => {
    if (loading || liveStateLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-white/60">
            {language === 'he' ? 'טוען...' : 'Loading...'}
          </p>
        </div>
      );
    }

    if (!primaryDevice) {
      return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-600/20 to-slate-800/20 border border-slate-500/30 flex items-center justify-center mx-auto mb-6">
            <Video className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">
            {language === 'he' ? 'אין מצלמות מוגדרות' : 'No Cameras Set Up'}
          </h2>
          <p className="text-white/60 mb-6">
            {language === 'he'
              ? 'הגדר מצלמה במחשב הנייד כדי לצפות בשידור'
              : 'Set up a camera on your laptop to watch the stream'}
          </p>
          <Link to="/dashboard">
            <Button className="bg-primary hover:bg-primary/90">
              {language === 'he' ? 'חזרה לדשבורד' : 'Back to Dashboard'}
            </Button>
          </Link>
        </div>
      );
    }

    const deviceStatus = getDeviceStatus(primaryDevice);

    return (
      <div className="space-y-4">
        {/* Device Status Bar - Always visible, separate from stream state */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 flex items-center justify-center">
              <Laptop className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{primaryDevice.device_name}</h3>
              <Badge className={`${deviceStatus.color} border text-xs mt-0.5`}>
                {deviceStatus.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${deviceStatus.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
          </div>
        </div>

        {/* Live View Container */}
        <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden aspect-video relative">
          {/* Idle State */}
          {viewerState === 'idle' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-600/20 to-slate-800/20 border border-slate-500/30 flex items-center justify-center mb-6">
                <Video className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'אין שידור פעיל' : 'No Active Stream'}
              </h3>
              <p className="text-white/60 text-sm text-center max-w-xs">
                {language === 'he'
                  ? 'הפעל את השידור מהמסך הראשי'
                  : 'Start the stream from the main screen'}
              </p>
              <Link to="/dashboard" className="mt-6">
                <Button variant="outline" className="border-slate-600 text-white hover:bg-slate-700">
                  <ArrowIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {language === 'he' ? 'למסך הראשי' : 'Go to Dashboard'}
                </Button>
              </Link>
            </div>
          )}

          {/* Connecting State */}
          {viewerState === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'מתחבר לשידור...' : 'Connecting to stream...'}
              </h3>
              <p className="text-white/60 text-sm">
                {language === 'he' ? 'אנא המתן' : 'Please wait'}
              </p>
            </div>
          )}

          {/* Error State */}
          {viewerState === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-500/30 flex items-center justify-center mb-6">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'שגיאת חיבור' : 'Connection Error'}
              </h3>
              <p className="text-white/60 text-sm text-center max-w-xs mb-6">
                {errorMessage || (language === 'he' ? 'לא ניתן להתחבר לשידור' : 'Could not connect to stream')}
              </p>
              <Button onClick={handleRetry} className="bg-primary hover:bg-primary/90">
                <RefreshCw className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'נסה שוב' : 'Try Again'}
              </Button>
            </div>
          )}

          {/* Connected State - Video Player */}
          {viewerState === 'connected' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-contain bg-black"
            />
          )}

          {/* Video element for stream attachment (hidden when not connected) */}
          {viewerState !== 'connected' && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              className="hidden"
            />
          )}
        </div>

        {/* Stream Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${
            viewerState === 'connected' ? 'bg-green-500 animate-pulse' :
            viewerState === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            viewerState === 'error' ? 'bg-red-500' :
            'bg-slate-500'
          }`} />
          <span className="text-white/60">
            {viewerState === 'connected' && (language === 'he' ? 'שידור פעיל' : 'Stream Active')}
            {viewerState === 'connecting' && (language === 'he' ? 'מתחבר...' : 'Connecting...')}
            {viewerState === 'error' && (language === 'he' ? 'שגיאה' : 'Error')}
            {viewerState === 'idle' && (language === 'he' ? 'ממתין לשידור' : 'Waiting for stream')}
          </span>
        </div>
      </div>
    );
  };

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

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl md:text-2xl font-bold text-white mb-4 text-center">
            {language === 'he' ? 'צפייה בשידור' : 'Live View'}
          </h1>

          {renderViewerContent()}
        </div>
      </main>
    </div>
  );
};

export default Viewer;
