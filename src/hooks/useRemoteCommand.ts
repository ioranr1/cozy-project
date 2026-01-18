import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

export type CommandType = 
  | 'START_MOTION_DETECTION' 
  | 'STOP_MOTION_DETECTION' 
  | 'START_LIVE_VIEW' 
  | 'STOP_LIVE_VIEW'
  | 'START_CAMERA'
  | 'STOP_CAMERA';

export type CommandStatus = 'idle' | 'sending' | 'pending' | 'acknowledged' | 'failed' | 'timeout';

interface CommandState {
  status: CommandStatus;
  commandId: string | null;
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
    error: null,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Subscribe to command status updates
  const subscribeToCommand = useCallback((commandId: string, commandType: CommandType) => {
    cleanup();

    // Set timeout for acknowledgment
    timeoutRef.current = setTimeout(() => {
      console.warn(`[useRemoteCommand] Command ${commandId} timed out after ${timeoutMs}ms`);
      setCommandState({
        status: 'timeout',
        commandId,
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
          const newStatus = (payload.new as { status?: string }).status;
          const errorMessage = (payload.new as { error_message?: string }).error_message;

          if (newStatus === 'acknowledged' || newStatus === 'completed') {
            cleanup();
            setCommandState({
              status: 'acknowledged',
              commandId,
              error: null,
            });
            toast.success(
              language === 'he' ? 'הפקודה התקבלה' : 'Command acknowledged'
            );
            onAcknowledged?.(commandType);
          } else if (newStatus === 'failed') {
            cleanup();
            setCommandState({
              status: 'failed',
              commandId,
              error: errorMessage || (language === 'he' ? 'הפקודה נכשלה' : 'Command failed'),
            });
            toast.error(
              errorMessage || (language === 'he' ? 'הפקודה נכשלה' : 'Command failed')
            );
            onFailed?.(commandType, errorMessage || 'unknown');
          }
        }
      )
      .subscribe((status) => {
        console.log(`[useRemoteCommand] Subscription status for command ${commandId}:`, status);
      });

    subscriptionRef.current = channel;
  }, [cleanup, language, onAcknowledged, onFailed, timeoutMs]);

  // Send a remote command
  const sendCommand = useCallback(async (commandType: CommandType): Promise<boolean> => {
    if (!deviceId) {
      const error = language === 'he' 
        ? 'לא נמצא מחשב מחובר. פתח את האפליקציה במחשב ונסה שוב.'
        : 'No connected computer found. Open the app on your computer and try again.';
      setCommandState({ status: 'failed', commandId: null, error });
      toast.error(error);
      return false;
    }

    setCommandState({ status: 'sending', commandId: null, error: null });
    toast.loading(
      language === 'he' ? 'שולח פקודה...' : 'Sending command...',
      { id: 'command-sending' }
    );

    try {
      const sessionToken = localStorage.getItem('session_token');
      
      if (!sessionToken) {
        const error = language === 'he' 
          ? 'נדרשת התחברות מחדש'
          : 'Please log in again';
        toast.dismiss('command-sending');
        toast.error(error);
        setCommandState({ status: 'failed', commandId: null, error });
        return false;
      }

      console.log(`[useRemoteCommand] Sending ${commandType} to device ${deviceId}`);

      const response = await supabase.functions.invoke('send-command', {
        body: { 
          device_id: deviceId, 
          command: commandType,
          session_token: sessionToken 
        },
      });

      toast.dismiss('command-sending');

      if (response.error) {
        console.error('[useRemoteCommand] Edge function error:', response.error);
        const error = language === 'he' 
          ? 'שליחת הפקודה נכשלה'
          : 'Failed to send command';
        toast.error(error);
        setCommandState({ status: 'failed', commandId: null, error });
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
        }
        
        toast.error(errorMessage);
        setCommandState({ status: 'failed', commandId: null, error: errorMessage });
        return false;
      }

      const commandId = data.command_id;
      console.log(`[useRemoteCommand] Command sent successfully, ID: ${commandId}`);

      setCommandState({ status: 'pending', commandId, error: null });
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
      setCommandState({ status: 'failed', commandId: null, error: errorMessage });
      return false;
    }
  }, [deviceId, language, subscribeToCommand]);

  const resetState = useCallback(() => {
    cleanup();
    setCommandState({ status: 'idle', commandId: null, error: null });
  }, [cleanup]);

  return {
    sendCommand,
    commandState,
    resetState,
    isLoading: commandState.status === 'sending' || commandState.status === 'pending',
  };
}