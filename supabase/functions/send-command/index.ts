import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { device_id, command } = body;
    
    // Support session_token from body OR header (for backward compatibility)
    let session_token = body.session_token;
    if (!session_token) {
      session_token = req.headers.get('x-session-token');
    }

    console.log(`[send-command] Received command: ${command} for device: ${device_id}`);

    if (!device_id || !command) {
      console.error('[send-command] Missing required fields');
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields: device_id, command",
          error_code: "MISSING_FIELDS"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!session_token) {
      console.error('[send-command] Missing session token');
      return new Response(
        JSON.stringify({ 
          error: "Missing session token. Please log in again.",
          error_code: "NO_SESSION"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session token
    console.log('[send-command] Validating session token...');
    const { data: sessionData, error: sessionError } = await supabase
      .rpc('validate_user_session', { p_token: session_token });

    if (sessionError) {
      console.error('[send-command] Session validation error:', sessionError);
      return new Response(
        JSON.stringify({ 
          error: "Session validation failed",
          error_code: "SESSION_ERROR",
          details: sessionError.message
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      console.error('[send-command] Invalid or expired session');
      return new Response(
        JSON.stringify({ 
          error: "Invalid or expired session. Please log in again.",
          error_code: "INVALID_SESSION"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileId = sessionData[0].profile_id;
    console.log(`[send-command] Session valid for profile: ${profileId}`);

    // Verify user owns this device
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, profile_id, device_name, is_active, last_seen_at')
      .eq('id', device_id)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (deviceError) {
      console.error('[send-command] Device lookup error:', deviceError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to verify device",
          error_code: "DEVICE_ERROR",
          details: deviceError.message
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!device) {
      console.error('[send-command] Device not found or access denied');
      return new Response(
        JSON.stringify({ 
          error: "Device not found or you don't have permission to control it",
          error_code: "DEVICE_NOT_FOUND"
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-command] Device verified: ${device.device_name}, active: ${device.is_active}`);

    // Insert command with status tracking
    const { data: insertedCommand, error: insertError } = await supabase
      .from('commands')
      .insert({
        device_id: device_id,
        command: command,
        handled: false,
        status: 'pending',
        requester_profile_id: profileId,
        error_message: null
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[send-command] Insert error:', insertError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send command",
          error_code: "INSERT_ERROR",
          details: insertError.message
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-command] Command inserted with ID: ${insertedCommand.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Command sent successfully",
        command_id: insertedCommand.id,
        device_status: {
          is_active: device.is_active,
          last_seen_at: device.last_seen_at
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[send-command] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        error_code: "INTERNAL_ERROR",
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});