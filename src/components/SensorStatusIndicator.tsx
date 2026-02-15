import React from 'react';
import { Camera, CameraOff, Baby, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SensorStatusIndicatorProps {
  motionEnabled: boolean;
  babyMonitorEnabled: boolean;
  /** True when Electron confirms hardware is active */
  securityEnabled: boolean;
  /** Only show when system is armed */
  isArmed: boolean;
  className?: string;
}

/**
 * Compact sensor status indicator showing camera, baby monitor, and microphone icons
 * Green = active & confirmed, Purple = baby monitor, Gray = off
 */
export const SensorStatusIndicator: React.FC<SensorStatusIndicatorProps> = ({
  motionEnabled,
  babyMonitorEnabled,
  securityEnabled,
  isArmed,
  className,
}) => {
  if (!isArmed) return null;

  const cameraActive = securityEnabled && motionEnabled;
  const babyActive = babyMonitorEnabled;
  const micActive = securityEnabled && babyMonitorEnabled;

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

      {/* Baby Monitor indicator */}
      <div className="flex items-center gap-1.5">
        {babyActive ? (
          <>
            <Baby className="w-4 h-4 text-purple-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          </>
        ) : (
          <Baby className="w-4 h-4 text-slate-500" />
        )}
      </div>

      {/* Microphone indicator - only shown when Baby Monitor is armed & active */}
      {babyActive && (
        <div className="flex items-center gap-1.5">
          {micActive ? (
            <>
              <Mic className="w-4 h-4 text-emerald-400" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </>
          ) : (
            <Mic className="w-4 h-4 text-amber-400 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
};

export default SensorStatusIndicator;
