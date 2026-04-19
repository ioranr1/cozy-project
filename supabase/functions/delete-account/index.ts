// delete-account v1.0.0
// Permanently deletes a user's account and all associated data.
// Requires a valid session token (Bearer auth) belonging to the profile being deleted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Auth: extract Bearer token from header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing session token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate session and get profile_id
    const { data: sessionData, error: sessionErr } = await admin.rpc(
      "validate_user_session",
      { p_token: token },
    );
    if (sessionErr || !sessionData || sessionData.length === 0 || !sessionData[0].is_valid) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const profileId: string = sessionData[0].profile_id;
    console.log(`[delete-account] Starting purge for profile ${profileId}`);

    // 1. Get all device IDs for this profile (for cascade-aware ordering)
    const { data: devices } = await admin
      .from("devices")
      .select("id")
      .eq("profile_id", profileId);
    const deviceIds = (devices || []).map((d) => d.id);
    console.log(`[delete-account] Found ${deviceIds.length} devices to clean`);

    // 2. Delete event snapshots from storage bucket
    if (deviceIds.length > 0) {
      try {
        const { data: events } = await admin
          .from("monitoring_events")
          .select("snapshot_url")
          .in("device_id", deviceIds)
          .not("snapshot_url", "is", null);

        const filesToDelete: string[] = [];
        for (const ev of events || []) {
          if (ev.snapshot_url) {
            // snapshot_url is typically a public URL; extract path after bucket name
            const m = ev.snapshot_url.match(/event-snapshots\/(.+)$/);
            if (m) filesToDelete.push(m[1]);
          }
        }
        if (filesToDelete.length > 0) {
          await admin.storage.from("event-snapshots").remove(filesToDelete);
          console.log(`[delete-account] Removed ${filesToDelete.length} snapshots from storage`);
        }
      } catch (e) {
        console.warn(`[delete-account] Storage cleanup warning:`, e);
      }
    }

    // 3. Delete dependent rows (order matters due to FKs)
    if (deviceIds.length > 0) {
      const tablesToCleanByDevice = [
        "monitoring_events",
        "archived_events",
        "monitoring_config",
        "device_status",
        "device_diagnostics",
        "device_notification_state",
        "access_tokens",
        "live_sessions",
        "rtc_sessions",
        "rtc_signals",
        "commands",
        "camera_desync_reports",
      ];

      for (const tbl of tablesToCleanByDevice) {
        try {
          if (tbl === "rtc_signals") {
            // rtc_signals has session_id, not device_id — clean via session FK cascade
            continue;
          }
          const { error } = await admin.from(tbl).delete().in("device_id", deviceIds);
          if (error) console.warn(`[delete-account] ${tbl} delete warning:`, error.message);
        } catch (e) {
          console.warn(`[delete-account] ${tbl} delete error:`, e);
        }
      }
    }

    // 4. Delete pairing codes
    await admin.from("pairing_codes").delete().eq("profile_id", profileId);

    // 5. Delete devices
    await admin.from("devices").delete().eq("profile_id", profileId);

    // 6. Delete user sessions
    await admin.from("user_sessions").delete().eq("profile_id", profileId);

    // 7. Finally, delete the profile
    const { error: profileErr } = await admin
      .from("profiles")
      .delete()
      .eq("id", profileId);

    if (profileErr) {
      console.error(`[delete-account] Profile delete failed:`, profileErr);
      return new Response(
        JSON.stringify({ error: "Failed to delete profile", details: profileErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[delete-account] ✅ Profile ${profileId} fully purged`);
    return new Response(
      JSON.stringify({ success: true, profileId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[delete-account] Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
