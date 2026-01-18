import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { session_token, device_id, command } = await req.json();

    if (!session_token || !device_id || !command) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: session_token, device_id, command" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate session token
    const { data: sessionData, error: sessionError } = await supabase
      .rpc('validate_user_session', { p_token: session_token });

    if (sessionError || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileId = sessionData[0].profile_id;

    // Verify user owns this device
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, profile_id')
      .eq('id', device_id)
      .eq('profile_id', profileId)
      .maybeSingle();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: "Device not found or access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert command
    const { error: insertError } = await supabase
      .from('commands')
      .insert({
        device_id: device_id,
        command: command,
        handled: false
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to send command" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Command sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
