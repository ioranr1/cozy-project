import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSessionToken } from '@/hooks/useSession';
import { toast } from 'sonner';

export type CommandType = 
  | 'START_MOTION_DETECTION' 
  | 'STOP_MOTION_DETECTION' 
  | 'START_LIVE_VIEW' 
  | 'STOP_LIVE_VIEW'
  | 'START_CAMERA'
  | 'STOP_CAMERA'
  | 'SET_DEVICE_MODE';

export interface CommandPayload {
  mode?: 'AWAY' | 'NORMAL';
  // Future: security_enabled?: boolean;
}

export type CommandStatus = 'idle' | 'sending' | 'pending' | 'acknowledged' | 'failed' | 'timeout';

interface CommandState {
  status: CommandStatus;
  commandId: string | null;
  commandType: CommandType | null;
  error: string | null;
}

interface UseRemoteCommandOptions {
  deviceId: string | null;
  onAcknowledged?: (commandType: CommandType) => void;
  onFailed?: (commandType: CommandType, error: string) => void;
  timeoutMs?: number;
}

export function useRemoteCommand({ 
  deviceId, 
  onAcknowledged, 
  onFailed,
  timeoutMs = 8000 
}: UseRemoteCommandOptions) {
  const { language } = useLanguage();
  const [commandState, setCommandState] = useState<CommandState>({
    status: 'idle',
    commandId: null,
    commandType: null,
    error: null,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentCommandTypeRef = useRef<CommandType | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (subscriptionRef.current) {
      // IMPORTANT: Use removeChannel instead of just unsubscribe to fully release resources
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Subscribe to command status updates
  const subscribeToCommand = useCallback((commandId: string, commandType: CommandType) => {
    cleanup();
    currentCommandTypeRef.current = commandType;

    // Set timeout for acknowledgment
    timeoutRef.current = setTimeout(() => {
      console.warn(`[useRemoteCommand] Command ${commandId} timed out after ${timeoutMs}ms`);
      setCommandState({
        status: 'timeout',
        commandId,
        commandType,
        error: language === 'he' 
          ? 'לא התקבלה תשובה מהמחשב. ודא שהאפליקציה פתוחה ומחוברת לרשת.'
          : 'No response from computer. Make sure the app is open and connected.',
      });
      onFailed?.(commandType, 'timeout');
      cleanup();
    }, timeoutMs);

    // Subscribe to realtime updates for this command
    const channel = supabase
      .channel(`command-${commandId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'commands',
          filter: `id=eq.${commandId}`,
        },
        (payload) => {
          console.log(`[useRemoteCommand] Command update received:`, payload.new);
          const row = payload.new as { 
            status?: string; 
            handled?: boolean; 
            handled_at?: string;
            error_message?: string;
          };
          const newStatus = row.status;
          const handled = row.handled;
          const handledAt = row.handled_at;
          const errorMessage = row.error_message;

          // Check for failed status first
          if (newStatus === 'failed') {
            cleanup();
            setCommandState({
              status: 'failed',
              commandId,
              commandType,
              error: errorMessage || (language === 'he' ? 'הפקודה נכשלה' : 'Command failed'),
            });
            toast.error(
              errorMessage || (language === 'he' ? 'הפקודה נכשלה' : 'Command failed')
            );
            onFailed?.(commandType, errorMessage || 'unknown');
            return;
          }

          // Treat as acknowledged if ANY of these conditions are met:
          // - status is 'acknowledged', 'ack', or 'completed'
          // - handled is true
          // - handled_at is set
          const isAcknowledged = 
            newStatus === 'acknowledged' || 
            newStatus === 'ack' || 
            newStatus === 'completed' ||
            handled === true ||
            handledAt != null;

          if (isAcknowledged) {
            cleanup();
            setCommandState({
              status: 'acknowledged',
              commandId,
              commandType,
              error: null,
            });
            toast.success(
              language === 'he' ? 'הפקודה התקבלה' : 'Command acknowledged'
            );
            onAcknowledged?.(commandType);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[useRemoteCommand] Subscription status for command ${commandId}:`, status);
      });

    subscriptionRef.current = channel;
  }, [cleanup, language, onAcknowledged, onFailed, timeoutMs]);

  // Send a remote command with optional payload
  const sendCommand = useCallback(async (commandType: CommandType, payload?: CommandPayload): Promise<boolean> => {
    if (!deviceId) {
      const error = language === 'he' 
        ? 'לא נמצא מחשב מחובר. פתח את האפליקציה במחשב ונסה שוב.'
        : 'No connected computer found. Open the app on your computer and try again.';
      setCommandState({ status: 'failed', commandId: null, commandType, error });
      toast.error(error);
      return false;
    }

    currentCommandTypeRef.current = commandType;
    setCommandState({ status: 'sending', commandId: null, commandType, error: null });
    toast.loading(
      language === 'he' ? 'שולח פקודה...' : 'Sending command...',
      { id: 'command-sending' }
    );

    try {
      const sessionToken = getSessionToken();

      if (!sessionToken) {
        const error = language === 'he'
          ? 'נדרשת התחברות מחדש'
          : 'Please log in again';
        toast.dismiss('command-sending');
        toast.error(error);
        setCommandState({ status: 'failed', commandId: null, commandType, error });
        return false;
      }

      // Build command string - for SET_DEVICE_MODE, include mode in command name
      let commandString = commandType;
      if (commandType === 'SET_DEVICE_MODE' && payload?.mode) {
        commandString = `SET_DEVICE_MODE:${payload.mode}` as CommandType;
      }

      console.log(`[useRemoteCommand] Sending ${commandString} to device ${deviceId}`, payload);

      const response = await supabase.functions.invoke('send-command', {
        body: { 
          device_id: deviceId, 
          command: commandString,
          payload: payload,
          session_token: sessionToken 
        },
      });

      toast.dismiss('command-sending');

      if (response.error) {
        console.error('[useRemoteCommand] Edge function error:', response.error);
        const details = (response.error as { message?: string }).message;
        const error = language === 'he'
          ? `שליחת הפקודה נכשלה${details ? `: ${details}` : ''}`
          : `Failed to send command${details ? `: ${details}` : ''}`;
        toast.error(error);
        setCommandState({ status: 'failed', commandId: null, commandType, error });
        return false;
      }

      const data = response.data;
      
      if (!data.success) {
        console.error('[useRemoteCommand] Command failed:', data);
        let errorMessage = data.error || (language === 'he' ? 'שגיאה לא ידועה' : 'Unknown error');
        
        // Map error codes to user-friendly messages
        if (data.error_code === 'DEVICE_NOT_FOUND') {
          errorMessage = language === 'he' 
            ? 'לא נמצא מחשב מחובר. פתח את האפליקציה במחשב ונסה שוב.'
            : 'No connected computer found. Open the app on your computer and try again.';
        } else if (data.error_code === 'INVALID_SESSION' || data.error_code === 'NO_SESSION') {
          errorMessage = language === 'he' 
            ? 'נדרשת התחברות מחדש'
            : 'Please log in again';
          // Clear invalid session and redirect to login
          localStorage.removeItem('aiguard_session_token');
          localStorage.removeItem('userProfile');
          window.location.href = '/login';
        }
        
        toast.error(errorMessage);
        setCommandState({ status: 'failed', commandId: null, commandType, error: errorMessage });
        return false;
      }

      const commandId = data.command_id;
      console.log(`[useRemoteCommand] Command sent successfully, ID: ${commandId}`);

      setCommandState({ status: 'pending', commandId, commandType, error: null });
      toast.info(
        language === 'he' ? 'ממתין לאישור מהמחשב...' : 'Waiting for computer acknowledgment...',
        { duration: 3000 }
      );

      // Subscribe to status updates
      subscribeToCommand(commandId, commandType);

      return true;

    } catch (error) {
      console.error('[useRemoteCommand] Unexpected error:', error);
      toast.dismiss('command-sending');
      const errorMessage = language === 'he' 
        ? 'שגיאה בשליחת הפקודה'
        : 'Error sending command';
      toast.error(errorMessage);
      setCommandState({ status: 'failed', commandId: null, commandType, error: errorMessage });
      return false;
    }
  }, [deviceId, language, subscribeToCommand]);

  const resetState = useCallback(() => {
    cleanup();
    currentCommandTypeRef.current = null;
    setCommandState({ status: 'idle', commandId: null, commandType: null, error: null });
  }, [cleanup]);

  return {
    sendCommand,
    commandState,
    resetState,
    isLoading: commandState.status === 'sending' || commandState.status === 'pending',
  };
}
