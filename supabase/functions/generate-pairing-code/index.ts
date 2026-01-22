import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get session token from header or body
    let sessionToken = req.headers.get("x-session-token");
    
    if (!sessionToken) {
      const body = await req.json().catch(() => ({}));
      sessionToken = body.session_token;
    }

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: "Missing session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Validate session and get profile
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .rpc("validate_user_session", { p_token: sessionToken });

    if (sessionError || !sessionData?.[0]?.is_valid) {
      console.error("Session validation failed:", sessionError);
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileId = sessionData[0].profile_id;

    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete any existing unused codes for this profile
    await supabaseAdmin
      .from("pairing_codes")
      .delete()
      .eq("profile_id", profileId)
      .is("used_at", null);

    // Insert new pairing code
    const { data: pairingCode, error: insertError } = await supabaseAdmin
      .from("pairing_codes")
      .insert({
        profile_id: profileId,
        code: code,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to generate code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generated pairing code ${code} for profile ${profileId}`);

    return new Response(
      JSON.stringify({
        code: code,
        expires_at: expiresAt,
      }),
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
