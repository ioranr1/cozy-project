/**
 * Main.js Additions for WebRTC Live View
 * =======================================
 * 
 * Add these sections to your existing main.js file.
 * This handles the command processing and IPC bridging to the renderer.
 */

// ============================================================
// SECTION 1: Add to your command handler
// ============================================================

/**
 * In your existing handleCommand function, modify the START_LIVE_VIEW case:
 */

/*
case 'START_LIVE_VIEW':
  console.log('[Main] START_LIVE_VIEW command received');
  
  // Extract session_id from the command if available
  // NOTE: The session_id should be passed in the command payload or looked up
  // For now, we subscribe to rtc_sessions to find pending sessions
  
  await subscribeToRtcSessions(deviceId);
  
  // ACK the command
  await acknowledgeCommand(commandId);
  break;

case 'STOP_LIVE_VIEW':
  console.log('[Main] STOP_LIVE_VIEW command received');
  
  // Send stop signal to renderer
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('stop-live-view');
  }
  
  // ACK the command
  await acknowledgeCommand(commandId);
  break;
*/

// ============================================================
// SECTION 2: Subscribe to rtc_sessions for pending sessions
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// Your Supabase client
const supabase = createClient(
  'https://zoripeohnedivxkvrpbi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmlwZW9obmVkaXZ4a3ZycGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODMyMDIsImV4cCI6MjA4NDA1OTIwMn0.I24w1VjEWUNf2jCBnPo4-ypu3aq5rATJldbLgSSt9mo'
);

let rtcSessionChannel = null;

async function subscribeToRtcSessions(deviceId) {
  console.log('[Main] Subscribing to rtc_sessions for device:', deviceId);
  
  // Unsubscribe from previous channel if exists
  if (rtcSessionChannel) {
    await supabase.removeChannel(rtcSessionChannel);
  }
  
  // First, check for any existing pending sessions
  const { data: existingSessions, error } = await supabase
    .from('rtc_sessions')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (!error && existingSessions && existingSessions.length > 0) {
    const session = existingSessions[0];
    console.log('[Main] Found existing pending session:', session.id);
    handleNewSession(session);
  }
  
  // Subscribe to new sessions via Realtime
  rtcSessionChannel = supabase
    .channel('rtc_sessions_monitor')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rtc_sessions',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => {
        console.log('[Main] New rtc_session detected:', payload.new);
        if (payload.new.status === 'pending') {
          handleNewSession(payload.new);
        }
      }
    )
    .subscribe((status) => {
      console.log('[Main] rtc_sessions subscription status:', status);
    });
}

function handleNewSession(session) {
  const sessionId = session.id;
  console.log('[Main] Handling new session:', sessionId);
  
  // Send to renderer to start WebRTC
  if (mainWindow && mainWindow.webContents) {
    console.log('[Main] Sending start-live-view IPC with sessionId:', sessionId);
    mainWindow.webContents.send('start-live-view', sessionId);
  } else {
    console.error('[Main] No mainWindow available to send IPC');
  }
}

// ============================================================
// SECTION 3: Cleanup on app quit
// ============================================================

/*
app.on('before-quit', async () => {
  if (rtcSessionChannel) {
    await supabase.removeChannel(rtcSessionChannel);
  }
});
*/

// ============================================================
// EXAMPLE: Complete command handler integration
// ============================================================

/*
async function processCommand(command) {
  const { id, command: commandType, device_id } = command;
  
  console.log('[Main] Processing command:', commandType);
  
  try {
    switch (commandType) {
      case 'START_LIVE_VIEW':
        // Subscribe to rtc_sessions - this will trigger the WebRTC flow
        await subscribeToRtcSessions(device_id);
        break;
        
      case 'STOP_LIVE_VIEW':
        // Send stop to renderer
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('stop-live-view');
        }
        // Unsubscribe from sessions
        if (rtcSessionChannel) {
          await supabase.removeChannel(rtcSessionChannel);
          rtcSessionChannel = null;
        }
        break;
        
      case 'START_MOTION_DETECTION':
        // Your existing motion detection logic
        break;
        
      case 'STOP_MOTION_DETECTION':
        // Your existing motion detection logic
        break;
    }
    
    // ACK the command
    await supabase
      .from('commands')
      .update({ 
        handled: true, 
        status: 'acknowledged',
        handled_at: new Date().toISOString() 
      })
      .eq('id', id);
      
    console.log('[Main] Command acknowledged:', commandType);
    
  } catch (error) {
    console.error('[Main] Command processing error:', error);
    
    // Update command with error
    await supabase
      .from('commands')
      .update({ 
        handled: true, 
        status: 'failed',
        error_message: error.message,
        handled_at: new Date().toISOString() 
      })
      .eq('id', id);
  }
}
*/
