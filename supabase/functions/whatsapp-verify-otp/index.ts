import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SESSION_DURATION_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, country_code, code } = await req.json();

    if (!phone_number || !country_code || !code) {
      return new Response(
        JSON.stringify({ error: "Phone number, country code and OTP code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the OTP code
    const { data: otpData, error: otpError } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("phone_number", phone_number)
      .eq("country_code", country_code)
      .eq("code", code)
      .is("verified_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (otpError || !otpData) {
      // Increment attempts if OTP exists but code is wrong
      await supabase
        .from("otp_codes")
        .update({ attempts: otpData?.attempts ? otpData.attempts + 1 : 1 })
        .eq("phone_number", phone_number)
        .eq("country_code", country_code)
        .is("verified_at", null);

      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check max attempts (5 attempts max)
    if (otpData.attempts >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Please request a new code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("otp_codes")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", otpData.id);

    // Get or create profile
    let { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone_number", phone_number)
      .eq("country_code", country_code)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("Profile query error:", profileError);
    }

    // If profile exists, mark as verified
    if (profile) {
      await supabase
        .from("profiles")
        .update({ phone_verified: true })
        .eq("id", profile.id);
      
      profile.phone_verified = true;

      // Create a 30-day session
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

      const { data: sessionData, error: sessionError } = await supabase
        .from("user_sessions")
        .insert({
          profile_id: profile.id,
          expires_at: expiresAt.toISOString(),
        })
        .select("session_token")
        .single();

      if (sessionError) {
        console.error("Session creation error:", sessionError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          verified: true,
          profile: profile,
          session_token: sessionData?.session_token || null,
          is_new_user: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        verified: true,
        profile: null,
        session_token: null,
        is_new_user: true
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
