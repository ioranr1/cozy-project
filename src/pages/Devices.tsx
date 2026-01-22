import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { useDevices, Device } from '@/hooks/useDevices';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Laptop, 
  Smartphone, 
  Camera, 
  Check, 
  Pencil, 
  Trash2, 
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  HelpCircle,
  Monitor,
  Plus,
  Copy,
  CheckCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SESSION_TOKEN_KEY = 'aiguard_session_token';

const Devices: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState<string | undefined>();
  
  // Get profile from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('userProfile');
    if (stored) {
      const profile = JSON.parse(stored);
      setProfileId(profile.id);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const { 
    devices, 
    selectedDevice, 
    isLoading, 
    selectDevice, 
    refreshDevices,
    renameDevice,
    deleteDevice,
    getDeviceStatus 
  } = useDevices(profileId);

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deviceToRename, setDeviceToRename] = useState<Device | null>(null);
  const [newName, setNewName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pairing code dialog state
  const [pairingDialogOpen, setPairingDialogOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleGeneratePairingCode = async () => {
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

      setPairingCode(data.code);
      setPairingExpiresAt(data.expires_at);
      setPairingDialogOpen(true);
    } catch (error) {
      console.error('Generate pairing code error:', error);
      toast.error(language === 'he' ? 'שגיאה ביצירת קוד' : 'Failed to generate code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCodeCopied(true);
      toast.success(language === 'he' ? 'הקוד הועתק!' : 'Code copied!');
      setTimeout(() => setCodeCopied(false), 3000);
    } catch {
      toast.error(language === 'he' ? 'שגיאה בהעתקה' : 'Failed to copy');
    }
  };

  const handleRenameClick = (device: Device) => {
    setDeviceToRename(device);
    setNewName(device.device_name);
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = async () => {
    if (!deviceToRename || !newName.trim()) return;
    
    setIsRenaming(true);
    const success = await renameDevice(deviceToRename.id, newName.trim());
    setIsRenaming(false);
    
    if (success) {
      toast.success(language === 'he' ? 'השם עודכן בהצלחה' : 'Device renamed successfully');
      setRenameDialogOpen(false);
    } else {
      toast.error(language === 'he' ? 'שגיאה בעדכון השם' : 'Failed to rename device');
    }
  };

  const handleDeleteClick = (device: Device) => {
    setDeviceToDelete(device);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deviceToDelete) return;
    
    setIsDeleting(true);
    const success = await deleteDevice(deviceToDelete.id);
    setIsDeleting(false);
    
    if (success) {
      toast.success(language === 'he' ? 'המכשיר נמחק בהצלחה' : 'Device deleted successfully');
      setDeleteDialogOpen(false);
    } else {
      toast.error(language === 'he' ? 'שגיאה במחיקת המכשיר' : 'Failed to delete device');
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'camera':
        return Monitor;
      case 'viewer':
        return Smartphone;
      default:
        return Laptop;
    }
  };

  const getStatusIcon = (status: 'online' | 'offline' | 'unknown') => {
    switch (status) {
      case 'online':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-yellow-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusText = (status: 'online' | 'offline' | 'unknown') => {
    if (language === 'he') {
      switch (status) {
        case 'online': return 'מחובר';
        case 'offline': return 'לא מחובר';
        default: return 'לא ידוע';
      }
    }
    switch (status) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const cameraDevices = devices.filter(d => d.device_type === 'camera');

  return (
    <AppLayout>
      <DashboardHeader 
        userFullName=""
        subtitle={language === 'he' ? 'נהל את המכשירים שלך' : 'Manage your devices'}
        title={language === 'he' ? 'מכשירים' : 'Devices'}
      />

      <div className="p-4 space-y-4">
        {/* Actions Row */}
        <div className="flex justify-between items-center">
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
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshDevices()}
            disabled={isLoading}
            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
          >
            {isLoading ? (
              <Loader2 className={cn("w-4 h-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
            ) : (
              <RefreshCw className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
            )}
            {language === 'he' ? 'רענן' : 'Refresh'}
          </Button>
        </div>

        {/* Camera Devices Section */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {language === 'he' ? 'מצלמות' : 'Cameras'}
            <span className="text-sm text-white/50">({cameraDevices.length})</span>
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : cameraDevices.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center">
              <Monitor className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {language === 'he' ? 'אין מצלמות רשומות' : 'No cameras registered'}
              </h3>
              <p className="text-white/60 text-sm mb-4">
                {language === 'he' 
                  ? 'התקן את אפליקציית AIGuard Desktop במחשב שלך'
                  : 'Install AIGuard Desktop app on your computer'}
              </p>
              <div className="bg-slate-900/50 rounded-lg p-4 text-left">
                <p className="text-white/70 text-xs font-mono mb-2">
                  {language === 'he' ? 'הוראות התקנה:' : 'Installation steps:'}
                </p>
                <ol className={cn(
                  "text-white/50 text-xs space-y-1",
                  isRTL ? "list-decimal list-inside" : "list-decimal list-inside"
                )}>
                  <li>{language === 'he' ? 'הורד את AIGuard Desktop' : 'Download AIGuard Desktop'}</li>
                  <li>{language === 'he' ? 'התחבר עם אותו חשבון' : 'Login with the same account'}</li>
                  <li>{language === 'he' ? 'המכשיר ירשם אוטומטית' : 'Device will register automatically'}</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {cameraDevices.map((device) => {
                const DeviceIcon = getDeviceIcon(device.device_type);
                const status = getDeviceStatus(device);
                const isSelected = selectedDevice?.id === device.id;

                return (
                  <div
                    key={device.id}
                    className={cn(
                      "bg-slate-800/50 border rounded-xl p-4 transition-all",
                      isSelected 
                        ? "border-primary/50 bg-primary/5" 
                        : "border-slate-700/50 hover:border-slate-600"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          isSelected 
                            ? "bg-primary/20 text-primary" 
                            : "bg-slate-700/50 text-slate-400"
                        )}>
                          <DeviceIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">
                              {device.device_name}
                            </span>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                                {language === 'he' ? 'נבחר' : 'Selected'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusIcon(status)}
                            <span className={cn(
                              "text-xs",
                              status === 'online' ? "text-green-400" :
                              status === 'offline' ? "text-yellow-400" : "text-slate-400"
                            )}>
                              {getStatusText(status)}
                            </span>
                            <span className="text-white/30 text-xs">•</span>
                            <span className="text-white/40 text-xs">
                              ID: {device.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isSelected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectDevice(device.id)}
                            className="border-primary/50 text-primary hover:bg-primary/10"
                          >
                            <Check className={cn("w-4 h-4", isRTL ? "ml-1" : "mr-1")} />
                            {language === 'he' ? 'בחר' : 'Select'}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRenameClick(device)}
                          className="text-white/60 hover:text-white hover:bg-slate-700"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(device)}
                          className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Electron Code Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mt-6">
          <h3 className="text-blue-400 font-medium mb-2">
            {language === 'he' ? '💻 קוד Electron לפרודקשן' : '💻 Electron Production Code'}
          </h3>
          <p className="text-white/60 text-sm">
            {language === 'he' 
              ? 'האפליקציית Desktop רושמת את עצמה אוטומטית לאחר login. ה-Device ID נשמר מקומית ומשתמש באותו profile_id.'
              : 'The Desktop app registers itself automatically after login. Device ID is stored locally and uses the same profile_id.'}
          </p>
        </div>

        {/* Re-open last pairing code (in case the dialog was closed) */}
        {pairingCode && !pairingDialogOpen && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-medium">
                  {language === 'he' ? 'קוד צימוד אחרון' : 'Last pairing code'}
                </p>
                <p className="text-white/60 text-sm" dir="ltr">
                  {pairingCode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Copy className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                  {language === 'he' ? 'העתק' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setPairingDialogOpen(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  {language === 'he' ? 'הצג חלון' : 'Show'}
                </Button>
              </div>
            </div>
            {pairingExpiresAt && (
              <p className="text-white/40 text-xs mt-2">
                {language === 'he' ? 'אם פג תוקף הקוד, צור חדש' : 'If the code expired, generate a new one'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {language === 'he' ? 'שנה שם מכשיר' : 'Rename Device'}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {language === 'he' 
                ? 'הזן שם חדש למכשיר'
                : 'Enter a new name for this device'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={language === 'he' ? 'שם המכשיר' : 'Device name'}
            className="bg-slate-800 border-slate-700 text-white"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              className="border-slate-600 text-white"
            >
              {language === 'he' ? 'ביטול' : 'Cancel'}
            </Button>
            <Button
              onClick={handleRenameConfirm}
              disabled={isRenaming || !newName.trim()}
              className="bg-primary"
            >
              {isRenaming && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {language === 'he' ? 'שמור' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {language === 'he' ? 'מחק מכשיר?' : 'Delete Device?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {language === 'he' 
                ? `האם אתה בטוח שברצונך למחוק את "${deviceToDelete?.device_name}"? פעולה זו לא ניתנת לביטול.`
                : `Are you sure you want to delete "${deviceToDelete?.device_name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 text-white bg-transparent hover:bg-slate-800">
              {language === 'he' ? 'ביטול' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {language === 'he' ? 'מחק' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pairing Code Dialog */}
      <Dialog open={pairingDialogOpen} onOpenChange={setPairingDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
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
              onClick={() => setPairingDialogOpen(false)}
              className="w-full border-slate-700 text-white bg-slate-800 hover:bg-slate-700"
            >
              {language === 'he' ? 'סגור' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Devices;
