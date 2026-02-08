import React from 'react';
import { Camera, CameraOff, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SensorStatusIndicatorProps {
  motionEnabled: boolean;
  soundEnabled: boolean;
  /** True when Electron confirms hardware is active */
  securityEnabled: boolean;
  /** Only show when system is armed */
  isArmed: boolean;
  className?: string;
}

/**
 * Compact sensor status indicator showing camera and microphone icons
 * Green = active & confirmed, Gray = off
 */
export const SensorStatusIndicator: React.FC<SensorStatusIndicatorProps> = ({
  motionEnabled,
  soundEnabled,
  securityEnabled,
  isArmed,
  className,
}) => {
  if (!isArmed) return null;

  const cameraActive = securityEnabled && motionEnabled;
  const micActive = securityEnabled && soundEnabled;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Camera indicator */}
      <div className="flex items-center gap-1.5">
        {cameraActive ? (
          <>
            <Camera className="w-4 h-4 text-green-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </>
        ) : (
          <CameraOff className="w-4 h-4 text-slate-500" />
        )}
      </div>

      {/* Microphone indicator */}
      <div className="flex items-center gap-1.5">
        {micActive ? (
          <>
            <Mic className="w-4 h-4 text-green-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </>
        ) : (
          <MicOff className="w-4 h-4 text-slate-500" />
        )}
      </div>
    </div>
  );
};

export default SensorStatusIndicator;
