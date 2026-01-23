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
  ChevronDown,
  ChevronUp,
  Archive
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PairingCodeDialog } from '@/components/PairingCodeDialog';
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
  const [showOldDevices, setShowOldDevices] = useState(false);
  
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
    getDeviceStatus,
    primaryDevice,
    oldDevices,
    hasOldDevices,
    refreshKey // Used to force re-render every 10 seconds for status updates
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
        case 'online': return 'מקוון';
        case 'offline': return 'לא מקוון';
        default: return 'לא ידוע';
      }
    }
    switch (status) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const renderDeviceCard = (device: Device, isOldDevice: boolean = false) => {
    const DeviceIcon = getDeviceIcon(device.device_type);
    const status = getDeviceStatus(device);
    const isSelected = selectedDevice?.id === device.id;

    return (
      <div
        key={device.id}
        className={cn(
          "bg-slate-800/50 border rounded-xl p-4 transition-all",
          isOldDevice && "opacity-70",
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
  };

  const cameraDevices = devices.filter(d => d.device_type === 'camera');
  const hasCameras = cameraDevices.length > 0;

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
          {/* PairingCodeDialog handles its own button and dialog */}
          <PairingCodeDialog />
          
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
            <span className="text-sm text-white/50">
              ({hasCameras ? (primaryDevice ? 1 : 0) : 0}{hasOldDevices ? ` + ${oldDevices.length}` : ''})
            </span>
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !hasCameras ? (
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
            <div className="space-y-3" key={refreshKey}>
              {/* Primary Device */}
              {primaryDevice && (
                <div className="space-y-2">
                  {renderDeviceCard(primaryDevice)}
                </div>
              )}

              {/* Old Devices Toggle */}
              {hasOldDevices && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOldDevices(!showOldDevices)}
                    className="text-white/60 hover:text-white hover:bg-slate-800 w-full justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Archive className="w-4 h-4" />
                      <span>
                        {language === 'he' ? 'מכשירים ישנים' : 'Old devices'}
                        <span className="text-white/40 ml-2">({oldDevices.length})</span>
                      </span>
                    </div>
                    {showOldDevices ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>

                  {showOldDevices && (
                    <div className="mt-2 space-y-2 border-t border-slate-700/50 pt-3">
                      <p className="text-white/40 text-xs px-2">
                        {language === 'he' 
                          ? 'מכשירים שלא שלחו עדכון לאחרונה'
                          : 'Devices that haven\'t sent updates recently'}
                      </p>
                      {oldDevices.map(device => renderDeviceCard(device, true))}
                    </div>
                  )}
                </div>
              )}

              {/* Status explanation */}
              <p className="text-white/40 text-xs text-center pt-2">
                {language === 'he' 
                  ? 'מכשיר נחשב מקוון אם שלח עדכון ב-2 הדקות האחרונות'
                  : 'A device is considered online if it reported in the last 2 minutes'}
              </p>
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
    </AppLayout>
  );
};

export default Devices;
