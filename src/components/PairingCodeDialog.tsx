import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Copy, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SESSION_TOKEN_KEY = 'aiguard_session_token';

interface PairingCodeDialogProps {
  /** External trigger to open the dialog (optional) */
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export const PairingCodeDialog: React.FC<PairingCodeDialogProps> = ({
  externalOpen,
  onExternalOpenChange,
}) => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();

  // Internal state - stable and not affected by parent re-renders
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Use ref to prevent state updates from racing
  const isDialogOpenRef = useRef(false);

  // Sync internal state with ref
  useEffect(() => {
    isDialogOpenRef.current = dialogOpen;
  }, [dialogOpen]);

  // Handle external open trigger
  useEffect(() => {
    if (externalOpen !== undefined && externalOpen !== dialogOpen) {
      setDialogOpen(externalOpen);
    }
  }, [externalOpen]);

  const handleOpenChange = useCallback((open: boolean) => {
    console.log('[PairingCodeDialog] onOpenChange called with:', open);
    setDialogOpen(open);
    onExternalOpenChange?.(open);
  }, [onExternalOpenChange]);

  const handleGeneratePairingCode = useCallback(async () => {
    setIsGeneratingCode(true);
    setPairingCode(null);
    setCodeCopied(false);

    try {
      const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!sessionToken) {
        toast.error(language === 'he' ? 'נא להתחבר מחדש' : 'Please login again');
        navigate('/login');
        return;
      }

      const response = await fetch(
        'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/generate-pairing-code',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-session-token': sessionToken,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate code');
      }

      console.log('[PairingCodeDialog] Code generated, opening dialog');
      setPairingCode(data.code);
      setPairingExpiresAt(data.expires_at);
      setDialogOpen(true);
      onExternalOpenChange?.(true);
    } catch (error) {
      console.error('Generate pairing code error:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת קוד' : 'Failed to generate code');
    } finally {
      setIsGeneratingCode(false);
    }
  }, [language, navigate, onExternalOpenChange]);

  const handleCopyCode = useCallback(async () => {
    if (!pairingCode) return;

    try {
      await navigator.clipboard.writeText(pairingCode);
      setCodeCopied(true);
      toast.success(language === 'he' ? 'הקוד הועתק!' : 'Code copied!');
      setTimeout(() => setCodeCopied(false), 3000);
    } catch {
      toast.error(language === 'he' ? 'שגיאה בהעתקה' : 'Failed to copy');
    }
  }, [pairingCode, language]);

  const handleCloseDialog = useCallback(() => {
    console.log('[PairingCodeDialog] Close button clicked');
    setDialogOpen(false);
    onExternalOpenChange?.(false);
  }, [onExternalOpenChange]);

  return (
    <>
      {/* Trigger Button */}
      <Button
        onClick={handleGeneratePairingCode}
        disabled={isGeneratingCode}
        className="bg-primary hover:bg-primary/90"
      >
        {isGeneratingCode ? (
          <Loader2 className={cn("w-4 h-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
        ) : (
          <Plus className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
        )}
        {language === 'he' ? 'צמד מצלמה חדשה' : 'Pair New Camera'}
      </Button>

      {/* Pairing Code Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="bg-slate-900 border-slate-700"
          onPointerDownOutside={(e) => {
            console.log('[PairingCodeDialog] onPointerDownOutside - preventing');
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            console.log('[PairingCodeDialog] onEscapeKeyDown - preventing');
            e.preventDefault();
          }}
          onInteractOutside={(e) => {
            console.log('[PairingCodeDialog] onInteractOutside - preventing');
            e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-white text-center">
              {language === 'he' ? '🔗 קוד צימוד' : '🔗 Pairing Code'}
            </DialogTitle>
            <DialogDescription className="text-white/60 text-center">
              {language === 'he'
                ? 'הזן את הקוד הזה באפליקציית ה-Desktop'
                : 'Enter this code in the Desktop app'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {/* Large Code Display */}
            <div className="bg-slate-800/80 border-2 border-primary/30 rounded-2xl p-6 text-center">
              <div className="text-4xl font-mono font-bold text-primary tracking-[0.5em] mb-4" dir="ltr">
                {pairingCode || '------'}
              </div>
              <Button
                onClick={handleCopyCode}
                variant="outline"
                size="sm"
                className="border-primary/50 text-primary hover:bg-primary/10"
              >
                {codeCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {language === 'he' ? 'הועתק!' : 'Copied!'}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    {language === 'he' ? 'העתק קוד' : 'Copy Code'}
                  </>
                )}
              </Button>
            </div>

            {/* Expiry Timer */}
            {pairingExpiresAt && (
              <p className="text-center text-white/50 text-sm mt-4">
                {language === 'he' ? 'הקוד תקף ל-10 דקות' : 'Code valid for 10 minutes'}
              </p>
            )}

            {/* Instructions */}
            <div className="mt-6 bg-slate-800/50 rounded-lg p-4">
              <p className="text-white/70 text-sm font-medium mb-2">
                {language === 'he' ? 'הוראות:' : 'Instructions:'}
              </p>
              <ol className={cn(
                "text-white/50 text-sm space-y-1 list-decimal list-inside",
                isRTL && "text-right"
              )}>
                <li>{language === 'he' ? 'הורד והתקן את AIGuard Desktop' : 'Download and install AIGuard Desktop'}</li>
                <li>{language === 'he' ? 'פתח את האפליקציה והזן את הקוד' : 'Open the app and enter the code'}</li>
                <li>{language === 'he' ? 'המצלמה תתחבר אוטומטית!' : 'Camera will connect automatically!'}</li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              className="w-full border-slate-700 text-white bg-slate-800 hover:bg-slate-700"
            >
              {language === 'he' ? 'סגור' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
