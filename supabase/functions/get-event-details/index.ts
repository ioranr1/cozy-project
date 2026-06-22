// get-event-details v2.1.0 (2026-06-22)
// Accepts session_token (logged-in user) OR view_token (one-time link from WhatsApp).
// View tokens let the user open the event in ANY browser (e.g. iPhone in-app WhatsApp
// browser) without re-authenticating. Tokens are bound to a single event and expire
// 24h after creation. Existing session_token flow is unchanged.
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
    const { session_token, view_token, event_id } = await req.json().catch(() => ({}));

    if (!event_id || typeof event_id !== "string") {
      return new Response(
        JSON.stringify({ error: "event_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if ((!session_token || typeof session_token !== "string") &&
        (!view_token || typeof view_token !== "string")) {
      return new Response(
        JSON.stringify({ error: "session_token or view_token required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let profileId: string | null = null;

    // 1) Preferred path — regular logged-in user with session_token (UNCHANGED behavior).
    if (session_token && typeof session_token === "string") {
      const { data: sessionData, error: sessionErr } = await supabase.rpc(
        "validate_user_session",
        { p_token: session_token }
      );
      if (!sessionErr && sessionData && sessionData.length > 0 && sessionData[0].is_valid) {
        profileId = sessionData[0].profile_id as string;
      }
    }

    // 2) Fallback path — one-time view_token from WhatsApp link.
    //    Only grants access to THIS specific event, and only while not expired.
    if (!profileId && view_token && typeof view_token === "string") {
      const { data: tokenRow } = await supabase
        .from("event_view_tokens")
        .select("event_id, profile_id, expires_at")
        .eq("token", view_token)
        .maybeSingle();
      if (
        tokenRow &&
        tokenRow.event_id === event_id &&
        new Date(tokenRow.expires_at as string).getTime() > Date.now()
      ) {
        profileId = tokenRow.profile_id as string;
        // Mark used (best-effort, non-blocking).
        await supabase
          .from("event_view_tokens")
          .update({ used_at: new Date().toISOString() })
          .eq("token", view_token);
      }
    }

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch event
    const { data: event, error: evErr } = await supabase
      .from("monitoring_events")
      .select("*")
      .eq("id", event_id)
      .maybeSingle();

    if (evErr) {
      console.error("Event fetch error:", evErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!event) {
      return new Response(
        JSON.stringify({ error: "Event not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ownership check — event.device_id must belong to this profile
    const { data: device, error: devErr } = await supabase
      .from("devices")
      .select("id, profile_id")
      .eq("id", event.device_id)
      .maybeSingle();

    if (devErr || !device || device.profile_id !== profileId) {
      return new Response(
        JSON.stringify({ error: "Forbidden: event does not belong to this user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL for snapshot if present
    let signedSnapshotUrl: string | null = null;
    if (event.snapshot_url && typeof event.snapshot_url === "string") {
      try {
        // snapshot_url may be a full URL or a storage path. Extract path after bucket name.
        const bucket = "event-snapshots";
        let path = event.snapshot_url as string;
        const marker = `/object/public/${bucket}/`;
        const signMarker = `/object/sign/${bucket}/`;
        if (path.includes(marker)) {
          path = path.split(marker)[1];
        } else if (path.includes(signMarker)) {
          path = path.split(signMarker)[1].split("?")[0];
        } else if (path.startsWith(`${bucket}/`)) {
          path = path.substring(bucket.length + 1);
        }
        const { data: signed } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 15);
        signedSnapshotUrl = signed?.signedUrl ?? null;
      } catch (e) {
        console.error("Signed URL error:", e);
      }
    }

    return new Response(
      JSON.stringify({ event, signed_snapshot_url: signedSnapshotUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("get-event-details error:", error);
    const msg = error instanceof Error ? error.message : "Internal error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});