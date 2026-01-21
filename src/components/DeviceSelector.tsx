import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDevices, Device } from '@/hooks/useDevices';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Monitor, Wifi, WifiOff, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeviceSelectorProps {
  profileId: string | undefined;
  onDeviceChange?: (device: Device | null) => void;
  className?: string;
}

export const DeviceSelector: React.FC<DeviceSelectorProps> = ({
  profileId,
  onDeviceChange,
  className
}) => {
  const { language } = useLanguage();
  const { devices, selectedDevice, selectDevice, getDeviceStatus, isLoading } = useDevices(profileId);
  
  const cameraDevices = devices.filter(d => d.device_type === 'camera');

  const handleValueChange = (deviceId: string) => {
    selectDevice(deviceId);
    const device = devices.find(d => d.id === deviceId) || null;
    onDeviceChange?.(device);
  };

  const getStatusIndicator = (status: 'online' | 'offline' | 'unknown') => {
    switch (status) {
      case 'online':
        return <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />;
      case 'offline':
        return <div className="w-2 h-2 rounded-full bg-yellow-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-slate-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className={cn("h-10 bg-slate-800/50 rounded-lg animate-pulse", className)} />
    );
  }

  if (cameraDevices.length === 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white/50 text-sm",
        className
      )}>
        <Monitor className="w-4 h-4" />
        {language === 'he' ? 'אין מצלמות רשומות' : 'No cameras registered'}
      </div>
    );
  }

  return (
    <Select
      value={selectedDevice?.id || ''}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className={cn(
        "bg-slate-800/50 border-slate-700/50 text-white",
        className
      )}>
        <SelectValue placeholder={language === 'he' ? 'בחר מצלמה' : 'Select camera'} />
      </SelectTrigger>
      <SelectContent className="bg-slate-900 border-slate-700">
        {cameraDevices.map((device) => {
          const status = getDeviceStatus(device);
          return (
            <SelectItem 
              key={device.id} 
              value={device.id}
              className="text-white hover:bg-slate-800 focus:bg-slate-800"
            >
              <div className="flex items-center gap-2">
                {getStatusIndicator(status)}
                <Monitor className="w-4 h-4 text-slate-400" />
                <span>{device.device_name}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
};

export default DeviceSelector;
