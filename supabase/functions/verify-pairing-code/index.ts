import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, device_name, device_id } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Missing pairing code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Verifying pairing code: ${code}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find the pairing code
    const { data: pairingCodes, error: findError } = await supabaseAdmin
      .from("pairing_codes")
      .select("*, profiles(*)")
      .eq("code", code)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (findError) {
      console.error("Find error:", findError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pairingCodes || pairingCodes.length === 0) {
      console.log("Invalid or expired code");
      return new Response(
        JSON.stringify({ error: "Invalid or expired code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pairingCode = pairingCodes[0];
    const profile = pairingCode.profiles;
    const profileId = pairingCode.profile_id;

    // Create or update device - prefer reusing existing device for this profile
    let finalDeviceId = device_id;

    if (device_id) {
      // Update existing device
      const { error: updateError } = await supabaseAdmin
        .from("devices")
        .update({
          profile_id: profileId,
          device_name: device_name || "Camera Computer",
          is_active: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", device_id);

      if (updateError) {
        console.error("Device update error:", updateError);
      }
    } else {
      // Check if there's already a camera device for this profile
      const { data: existingDevices } = await supabaseAdmin
        .from("devices")
        .select("id, device_name, last_seen_at")
        .eq("profile_id", profileId)
        .eq("device_type", "camera")
        .eq("is_active", true)
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .limit(1);

      if (existingDevices && existingDevices.length > 0) {
        // Reuse existing device
        finalDeviceId = existingDevices[0].id;
        console.log(`Reusing existing device: ${finalDeviceId}`);
        
        const { error: updateError } = await supabaseAdmin
          .from("devices")
          .update({
            device_name: device_name || existingDevices[0].device_name || "Camera Computer",
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", finalDeviceId);

        if (updateError) {
          console.error("Device update error:", updateError);
        }
      } else {
        // Create new device only if none exists
        const { data: newDevice, error: createError } = await supabaseAdmin
          .from("devices")
          .insert({
            profile_id: profileId,
            device_name: device_name || "Camera Computer",
            device_type: "camera",
            is_active: true,
            last_seen_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error("Device create error:", createError);
          return new Response(
            JSON.stringify({ error: "Failed to create device" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        finalDeviceId = newDevice.id;
        console.log(`Created new device: ${finalDeviceId}`);
      }
    }

    // Create session for the device
    const sessionToken = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    const { error: sessionError } = await supabaseAdmin
      .from("user_sessions")
      .insert({
        profile_id: profileId,
        session_token: sessionToken,
        expires_at: expiresAt,
        device_fingerprint: `electron-${finalDeviceId}`,
      });

    if (sessionError) {
      console.error("Session create error:", sessionError);
    }

    // Mark pairing code as used
    await supabaseAdmin
      .from("pairing_codes")
      .update({
        used_at: new Date().toISOString(),
        used_by_device_id: finalDeviceId,
      })
      .eq("id", pairingCode.id);

    console.log(`Pairing successful for profile ${profileId}, device ${finalDeviceId}`);

    return new Response(
      JSON.stringify({
        success: true,
        session_token: sessionToken,
        profile_id: profileId,
        device_id: finalDeviceId,
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          phone_number: profile.phone_number,
          country_code: profile.country_code,
        },
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
