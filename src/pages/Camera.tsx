import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield, ArrowLeft, ArrowRight, Video, VideoOff, Settings, Maximize, Minimize } from 'lucide-react';

const Camera: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment',
        },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setStream(mediaStream);
      setIsStreaming(true);

      toast({
        title: language === 'he' ? 'תצוגה מקדימה פעילה' : 'Preview Active',
        description: language === 'he' ? 'בודק את המצלמה – ללא זיהוי תנועה' : 'Testing camera – no motion detection',
      });
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(language === 'he' 
        ? 'לא ניתן לגשת למצלמה. אנא אשר הרשאות.'
        : 'Cannot access camera. Please allow permissions.');
      
      toast({
        title: language === 'he' ? 'שגיאה' : 'Error',
        description: language === 'he' ? 'לא ניתן להפעיל את המצלמה' : 'Cannot start camera',
        variant: 'destructive',
      });
    }
  }, [language, toast]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      toast({
        title: language === 'he' ? 'התצוגה המקדימה נסגרה' : 'Preview Closed',
        description: language === 'he' ? 'בדיקת המצלמה הסתיימה' : 'Camera test ended',
      });
    }
  }, [stream, language, toast]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (!stored) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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

            <div className="flex items-center gap-2">
              {isStreaming && (
                <span className="flex items-center gap-2 text-green-400 text-sm">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  {language === 'he' ? 'שידור פעיל' : 'Live'}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Camera View */}
          <div className="relative bg-slate-800 rounded-2xl overflow-hidden aspect-video mb-6 shadow-2xl">
            {/* Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!isStreaming ? 'hidden' : ''}`}
            />

            {/* Placeholder when not streaming */}
            {!isStreaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
                <div className="w-20 h-20 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
                  <VideoOff className="w-10 h-10 text-white/40" />
                </div>
                <p className="text-white/60 text-lg">
                  {language === 'he' ? 'המצלמה כבויה' : 'Camera is off'}
                </p>
                {error && (
                  <p className="text-red-400 text-sm mt-2 max-w-sm text-center px-4">
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* Overlay Controls */}
            {isStreaming && (
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  className="bg-black/50 hover:bg-black/70 backdrop-blur-sm"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </Button>
              </div>
            )}

            {/* Recording Indicator */}
            {isStreaming && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-sm font-medium">REC</span>
              </div>
            )}
          </div>

          {/* Preview Info Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
            <p className="text-amber-400 text-sm text-center">
              {language === 'he' 
                ? 'תצוגה מקדימה בלבד – לא מפעילה זיהוי תנועה או התראות'
                : 'Preview only – does not activate motion detection or alerts'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!isStreaming ? (
              <Button
                size="lg"
                className="bg-slate-600 hover:bg-slate-700 text-white px-8 py-6 text-lg rounded-xl"
                onClick={startCamera}
              >
                <Video className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'בדיקת מצלמה' : 'Camera Preview'}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg rounded-xl border-slate-600 text-white hover:bg-slate-800"
                onClick={stopCamera}
              >
                <VideoOff className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'סגור תצוגה מקדימה' : 'Close Preview'}
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="mt-8 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-bold text-white mb-3">
              {language === 'he' ? 'מידע חשוב' : 'Important Information'}
            </h3>
            <ul className={`space-y-2 text-white/60 ${isRTL ? 'pr-4' : 'pl-4'}`}>
              <li className="list-disc">
                {language === 'he' 
                  ? 'תצוגה מקדימה מיועדת לבדיקת זווית ואיכות המצלמה בלבד'
                  : 'Preview is for testing camera angle and quality only'}
              </li>
              <li className="list-disc">
                {language === 'he'
                  ? 'להפעלת זיהוי תנועה, עבור לעמוד "זיהוי תנועה" בתפריט'
                  : 'To start motion detection, go to "Motion Detection" in the menu'}
              </li>
              <li className="list-disc">
                {language === 'he'
                  ? 'סגירת התצוגה המקדימה לא משפיעה על מצב זיהוי התנועה'
                  : 'Closing preview does not affect motion detection status'}
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Camera;
