import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useIsMobileDevice } from '@/hooks/use-platform';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Shield, ArrowLeft, ArrowRight, Video, VideoOff, Maximize, Minimize, Smartphone, Lock, RefreshCw, Camera as CameraIcon, MousePointer, CheckCircle } from 'lucide-react';

function isRunningInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top can throw
    return true;
  }
}

const Camera: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobileDevice();
  const inIframe = isRunningInIframe();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      // Camera/mic prompts are commonly blocked inside embedded iframes.
      // We guide the user to open the preview in a new tab.
      if (isRunningInIframe()) {
        toast({
          title: language === 'he' ? 'פתח בטאב חדש' : 'Open in a new tab',
          description:
            language === 'he'
              ? 'דפדפנים לרוב חוסמים בקשת מצלמה בתוך iframe. פתח את דף ה-preview בטאב חדש ואז נסה שוב.'
              : 'Browsers often block camera requests inside an iframe. Open the preview in a new tab and try again.',
          variant: 'destructive',
        });
        return;
      }

      // Keep getUserMedia as the first awaited operation in the click-chain
      setIsRequesting(true);
      setError(null);
      setPermissionDenied(false);
      setShowPermissionDialog(false);

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
      setIsRequesting(false);

      toast({
        title: language === 'he' ? 'תצוגה מקדימה פעילה' : 'Preview Active',
        description: language === 'he' ? 'בודק את המצלמה – ללא זיהוי תנועה' : 'Testing camera – no motion detection',
      });
    } catch (err: any) {
      console.error('Camera error:', err);

      setIsRequesting(false);
      
      const isPermissionError = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setPermissionDenied(isPermissionError);
      
      if (isPermissionError) {
        // IMPORTANT UX: when the browser has the permission set to "Block",
        // it won't show the native prompt again. We show a simple blocked state
        // with an optional "Show Instructions" button instead of auto-opening the dialog.
        setShowPermissionDialog(false);
        setError(language === 'he' 
          ? 'הגישה למצלמה ולמיקרופון נחסמה. יש לאשר הרשאות בדפדפן.'
          : 'Camera and microphone access was blocked. Please allow permissions in your browser.');
      } else {
        setError(language === 'he' 
          ? 'לא ניתן לגשת למצלמה. ודא שהמצלמה מחוברת ולא בשימוש.'
          : 'Cannot access camera. Make sure it is connected and not in use.');
      }
      
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

  // Check login status
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

  // Redirect mobile users - camera preview is desktop-only
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-600/20 to-amber-800/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-6">
            <Smartphone className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">
            {language === 'he' ? 'זמין במחשב בלבד' : 'Desktop Only'}
          </h2>
          <p className="text-white/60 mb-6">
            {language === 'he' 
              ? 'בדיקת המצלמה זמינה רק מהמחשב. לצפייה בשידור חי, עבור לעמוד הצפייה.'
              : 'Camera preview is only available on desktop. To watch the live stream, go to the viewer page.'}
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/viewer">
              <Button className="w-full bg-primary hover:bg-primary/90">
                {language === 'he' ? 'צפייה בשידור' : 'Watch Stream'}
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline" className="w-full border-slate-600 text-white hover:bg-slate-700">
                <ArrowIcon className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'חזרה לדשבורד' : 'Back to Dashboard'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
          {inIframe && (
            <div className="mb-4 rounded-xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-sm p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-white/70 text-sm">
                  {language === 'he'
                    ? 'שימו לב: בדיקת מצלמה מתוך חלון ה-Preview (iframe) יכולה להיחסם ולכן לא יופיע פופאפ הרשאות. פתח בטאב חדש כדי לקבל בקשת הרשאה.'
                    : 'Note: Camera test inside the Preview iframe may be blocked, so no permission prompt appears. Open in a new tab to allow permissions.'}
                </p>
                <Button
                  variant="secondary"
                  className="bg-slate-700/60 hover:bg-slate-700 text-white"
                  onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                >
                  {language === 'he' ? 'פתח בטאב חדש' : 'Open in New Tab'}
                </Button>
              </div>
            </div>
          )}

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
            {!isStreaming && !permissionDenied && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
                <div className="w-20 h-20 rounded-2xl bg-slate-700/50 flex items-center justify-center mb-4">
                  <VideoOff className="w-10 h-10 text-white/40" />
                </div>
                <p className="text-white/60 text-lg">
                  {language === 'he' ? 'המצלמה כבויה' : 'Camera is off'}
                </p>
                {error && !permissionDenied && (
                  <p className="text-red-400 text-sm mt-2 max-w-sm text-center px-4">
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* Permission Denied - Simple Message */}
            {!isStreaming && permissionDenied && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 p-6">
                <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-white text-lg font-bold mb-2">
                  {language === 'he' ? 'הגישה למצלמה ומיקרופון נחסמה' : 'Camera & Microphone Access Blocked'}
                </h3>
                <p className="text-white/60 text-sm text-center mb-4 max-w-md">
                  {language === 'he' 
                    ? 'יש לאשר הרשאות מצלמה ומיקרופון כדי להמשיך'
                    : 'Camera and microphone permissions required to continue'}
                </p>
                <Button
                  onClick={() => setShowPermissionDialog(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  {language === 'he' ? 'הצג הוראות' : 'Show Instructions'}
                </Button>
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
                disabled={isRequesting || inIframe}
              >
                <Video className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {isRequesting
                  ? (language === 'he' ? 'מבקש הרשאה…' : 'Requesting permission…')
                  : (language === 'he' ? 'בדיקת מצלמה' : 'Camera Preview')}
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

      {/* Permission Help Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="sm:max-w-lg bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <CameraIcon className="w-5 h-5 text-primary" />
              </div>
              {language === 'he' ? 'אישור גישה למצלמה ומיקרופון' : 'Allow Camera & Microphone Access'}
            </DialogTitle>
            <DialogDescription className="text-white/60 pt-2">
              {language === 'he' 
                ? 'בצע את הצעדים הבאים כדי לאשר גישה למצלמה ולמיקרופון:'
                : 'Follow these steps to allow camera and microphone access:'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Step 1 */}
            <div className={`flex items-start gap-4 p-4 rounded-xl bg-slate-700/50 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">1</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium mb-1">
                  {language === 'he' ? 'לחץ על אייקון המנעול' : 'Click the lock icon'}
                </p>
                <p className="text-white/60 text-sm">
                  {language === 'he' 
                    ? 'נמצא בצד שמאל של שורת הכתובת בדפדפן'
                    : 'Located on the left side of the address bar'}
                </p>
                <div className="mt-2 flex items-center gap-2 bg-slate-600/50 rounded-lg px-3 py-2 w-fit">
                  <Lock className="w-4 h-4 text-white/70" />
                  <span className="text-white/70 text-sm font-mono">🔒</span>
                  <MousePointer className="w-4 h-4 text-amber-400 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`flex items-start gap-4 p-4 rounded-xl bg-slate-700/50 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">2</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium mb-1">
                  {language === 'he' ? 'שנה הרשאות מצלמה ומיקרופון ל"אפשר"' : 'Change Camera & Microphone to "Allow"'}
                </p>
                <p className="text-white/60 text-sm">
                  {language === 'he' 
                    ? 'בחר כל אחד ושנה את ההגדרה'
                    : 'Select each one and change the setting'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2">
                    <CameraIcon className="w-4 h-4 text-green-400" />
                    <span className="text-green-400 text-sm font-medium">
                      {language === 'he' ? 'אפשר' : 'Allow'}
                    </span>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2">
                    <span className="text-green-400 text-sm">🎤</span>
                    <span className="text-green-400 text-sm font-medium">
                      {language === 'he' ? 'אפשר' : 'Allow'}
                    </span>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`flex items-start gap-4 p-4 rounded-xl bg-slate-700/50 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">3</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium mb-1">
                  {language === 'he' ? 'רענן את הדף' : 'Refresh the page'}
                </p>
                <p className="text-white/60 text-sm">
                  {language === 'he' 
                    ? 'לחץ על הכפתור למטה כדי לרענן ולנסות שוב'
                    : 'Click the button below to refresh and try again'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-primary hover:bg-primary/90 py-6 text-lg"
            >
              <RefreshCw className={`w-5 h-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {language === 'he' ? 'רענן דף ונסה שוב' : 'Refresh & Try Again'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowPermissionDialog(false)}
              className="text-white/60 hover:text-white hover:bg-slate-700"
            >
              {language === 'he' ? 'סגור' : 'Close'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Camera;
