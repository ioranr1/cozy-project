import React from 'react';
import { Wifi, WifiOff, Signal, SignalLow, SignalMedium, SignalHigh } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface ConnectionIndicatorProps {
  iceConnectionState: RTCIceConnectionState | null;
  connectionState: RTCPeerConnectionState | null;
  className?: string;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  iceConnectionState,
  connectionState,
  className,
}) => {
  const { language } = useLanguage();

  // Determine status based on ICE and connection states
  const getStatus = (): 'connecting' | 'connected' | 'relay' | 'disconnected' | 'failed' | 'idle' => {
    if (!iceConnectionState || iceConnectionState === 'new') {
      return 'idle';
    }
    
    if (iceConnectionState === 'checking') {
      return 'connecting';
    }
    
    if (iceConnectionState === 'connected' || iceConnectionState === 'completed') {
      return 'connected';
    }
    
    if (iceConnectionState === 'disconnected') {
      return 'disconnected';
    }
    
    if (iceConnectionState === 'failed' || iceConnectionState === 'closed') {
      return 'failed';
    }
    
    return 'idle';
  };

  const status = getStatus();

  const getStatusConfig = () => {
    switch (status) {
      case 'connecting':
        return {
          icon: SignalLow,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/20',
          pulse: true,
          label: language === 'he' ? 'מתחבר...' : 'Connecting...',
        };
      case 'connected':
        return {
          icon: SignalHigh,
          color: 'text-green-400',
          bgColor: 'bg-green-500/20',
          pulse: false,
          label: language === 'he' ? 'מחובר' : 'Connected',
        };
      case 'relay':
        return {
          icon: SignalMedium,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/20',
          pulse: false,
          label: language === 'he' ? 'TURN Relay' : 'TURN Relay',
        };
      case 'disconnected':
        return {
          icon: SignalLow,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/20',
          pulse: true,
          label: language === 'he' ? 'מנותק' : 'Disconnected',
        };
      case 'failed':
        return {
          icon: WifiOff,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20',
          pulse: false,
          label: language === 'he' ? 'נכשל' : 'Failed',
        };
      default:
        return {
          icon: Signal,
          color: 'text-slate-400',
          bgColor: 'bg-slate-500/20',
          pulse: false,
          label: language === 'he' ? 'ממתין' : 'Idle',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-sm',
        config.bgColor,
        className
      )}
    >
      <Icon 
        className={cn(
          'w-4 h-4',
          config.color,
          config.pulse && 'animate-pulse'
        )} 
      />
      <span className={cn('text-xs font-medium', config.color)}>
        {config.label}
      </span>
    </div>
  );
};

export default ConnectionIndicator;
