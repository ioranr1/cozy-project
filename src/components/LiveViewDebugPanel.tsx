import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Copy, Check, Bug } from 'lucide-react';
import { RtcDebugInfo } from '@/hooks/useRtcSession';
import { toast } from 'sonner';

interface LiveViewDebugPanelProps {
  viewerState: 'idle' | 'connecting' | 'connected' | 'error';
  rtcDebugInfo: RtcDebugInfo;
  errorMessage: string | null;
}

const isDev = import.meta.env.DEV;

export const LiveViewDebugPanel: React.FC<LiveViewDebugPanelProps> = ({
  viewerState,
  rtcDebugInfo,
  errorMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only show in dev mode
  if (!isDev) return null;

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'connecting':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed':
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const debugData = {
    viewerState,
    sessionId: rtcDebugInfo.sessionId,
    rtcStatus: rtcDebugInfo.status,
    connectionState: rtcDebugInfo.connectionState,
    lastSignalType: rtcDebugInfo.lastSignalType,
    signalsProcessed: rtcDebugInfo.signalsProcessed,
    lastError: rtcDebugInfo.lastError || errorMessage,
    timestamp: new Date().toISOString(),
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
      setCopied(true);
      toast.success('Debug info copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-xs">
      <div className="bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl overflow-hidden">
        {/* Header - Always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-slate-300">RTC Debug</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${getStatusColor(viewerState)} text-[10px] px-1.5 py-0`}>
              {viewerState}
            </Badge>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            )}
          </div>
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-1 space-y-2 border-t border-slate-700/50">
            {/* Session ID */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Session ID</span>
              <span className="text-[10px] text-slate-300 font-mono truncate max-w-[140px]">
                {rtcDebugInfo.sessionId || '—'}
              </span>
            </div>

            {/* RTC Status */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">RTC Status</span>
              <Badge className={`${getStatusColor(rtcDebugInfo.status)} text-[10px] px-1.5 py-0`}>
                {rtcDebugInfo.status}
              </Badge>
            </div>

            {/* Connection State */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">PC State</span>
              <Badge className={`${getStatusColor(rtcDebugInfo.connectionState)} text-[10px] px-1.5 py-0`}>
                {rtcDebugInfo.connectionState || 'null'}
              </Badge>
            </div>

            {/* Last Signal */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Last Signal</span>
              <span className="text-[10px] text-slate-300 font-mono">
                {rtcDebugInfo.lastSignalType || '—'}
              </span>
            </div>

            {/* Signals Processed */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500">Signals</span>
              <span className="text-[10px] text-slate-300 font-mono">
                {rtcDebugInfo.signalsProcessed}
              </span>
            </div>

            {/* Last Error */}
            {(rtcDebugInfo.lastError || errorMessage) && (
              <div className="flex justify-between items-start">
                <span className="text-[10px] text-slate-500">Error</span>
                <span className="text-[10px] text-red-400 font-mono max-w-[140px] text-right truncate">
                  {rtcDebugInfo.lastError || errorMessage}
                </span>
              </div>
            )}

            {/* Copy Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="w-full h-6 text-[10px] text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Debug Info
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
