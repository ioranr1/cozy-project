// DeleteAccountDialog v1.0.0
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, MonitorX, Loader2 } from 'lucide-react';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const d = t.settings.deleteDialog;

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isConfirmed = confirmText.trim().toUpperCase() === d.confirmWord.toUpperCase();

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;
    setIsDeleting(true);

    try {
      const sessionToken = localStorage.getItem('aiguard_session_token');
      if (!sessionToken) {
        throw new Error('No session token');
      }

      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: d.successTitle,
        description: d.successDesc,
      });

      // Clear all local state
      localStorage.removeItem('userProfile');
      localStorage.removeItem('aiguard_session_token');

      // Navigate to login after a short delay
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1200);
    } catch (e: any) {
      console.error('[DeleteAccount] Error:', e);
      toast({
        title: d.errorTitle,
        description: e?.message || d.errorDesc,
        variant: 'destructive',
      });
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (isDeleting) return;
    if (!newOpen) setConfirmText('');
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg bg-slate-900 border-red-500/30 text-white"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <DialogHeader>
          <DialogTitle className="text-red-400 text-xl flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            {d.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <Alert className="bg-red-500/10 border-red-500/30">
            <AlertDescription className="text-white/90 text-sm">
              <p className="mb-2 font-semibold">{d.intro}</p>
              <ul className="list-disc list-inside space-y-1 text-white/80">
                <li>{d.item1}</li>
                <li>{d.item2}</li>
                <li>{d.item3}</li>
                <li>{d.item4}</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Alert className="bg-amber-500/10 border-amber-500/30">
            <AlertDescription className="text-white/90 text-sm">
              {d.whatsappNote}
            </AlertDescription>
          </Alert>

          <Alert className="bg-blue-500/10 border-blue-500/30">
            <AlertDescription className="text-white/90 text-sm">
              <div className="flex items-center gap-2 font-semibold mb-2">
                <MonitorX className="w-4 h-4" />
                {d.electronTitle}
              </div>
              <ol className="space-y-1 text-white/80">
                <li>{d.electronStep1}</li>
                <li>{d.electronStep2}</li>
                <li>{d.electronStep3}</li>
              </ol>
              <p className="mt-2 text-xs text-white/60 italic">
                {d.electronNote}
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="confirm-input" className="text-white/90">
              {d.confirmLabel}{' '}
              <span className="font-mono font-bold text-red-400">
                "{d.confirmWord}"
              </span>
            </Label>
            <Input
              id="confirm-input"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={d.confirmPlaceholder}
              disabled={isDeleting}
              className="bg-slate-800 border-slate-700 text-white"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
            className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
          >
            {d.cancel}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {d.deleting}
              </>
            ) : (
              d.confirmDelete
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteAccountDialog;
