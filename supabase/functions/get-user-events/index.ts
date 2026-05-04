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
    const { session_token, device_id, limit } = await req.json().catch(() => ({}));

    if (!session_token || typeof session_token !== "string") {
      return new Response(
        JSON.stringify({ error: "session_token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate session
    const { data: sessionData, error: sessionErr } = await supabase.rpc(
      "validate_user_session",
      { p_token: session_token }
    );

    if (sessionErr || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const profileId = sessionData[0].profile_id;

    // Get user's devices
    const { data: devices, error: devErr } = await supabase
      .from("devices")
      .select("id")
      .eq("profile_id", profileId);

    if (devErr) {
      console.error("Devices fetch error:", devErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch devices" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deviceIds = (devices ?? []).map((d) => d.id);
    if (deviceIds.length === 0) {
      return new Response(
        JSON.stringify({ events: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional device_id filter — must belong to user
    let targetDeviceIds = deviceIds;
    if (device_id && typeof device_id === "string") {
      if (!deviceIds.includes(device_id)) {
        return new Response(
          JSON.stringify({ error: "Forbidden: device does not belong to user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetDeviceIds = [device_id];
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const { data: events, error: evErr } = await supabase
      .from("monitoring_events")
      .select("*")
      .in("device_id", targetDeviceIds)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (evErr) {
      console.error("Events fetch error:", evErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch events" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ events: events ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("get-user-events error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});