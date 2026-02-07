// cleanup-events v1.0.0 — 2026-02-07
// Archives events >7 days, deletes events >14 days
// Called by pg_cron daily

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // --- Step 1: Delete archived events older than 14 days ---
    const { data: deletedArchived, error: deleteArchivedErr } = await supabase
      .from("archived_events")
      .delete()
      .lt("created_at", fourteenDaysAgo)
      .select("id");

    if (deleteArchivedErr) {
      console.error("Error deleting old archived events:", deleteArchivedErr);
    }

    // --- Step 2: Delete monitoring_events older than 14 days (safety net) ---
    const { data: deletedOld, error: deleteOldErr } = await supabase
      .from("monitoring_events")
      .delete()
      .lt("created_at", fourteenDaysAgo)
      .select("id");

    if (deleteOldErr) {
      console.error("Error deleting old monitoring events:", deleteOldErr);
    }

    // --- Step 3: Archive events between 7-14 days ---
    // First fetch events to archive
    const { data: toArchive, error: fetchErr } = await supabase
      .from("monitoring_events")
      .select("id, device_id, event_type, severity, ai_is_real, ai_confidence, ai_summary, viewed_at, created_at")
      .lt("created_at", sevenDaysAgo)
      .gte("created_at", fourteenDaysAgo);

    if (fetchErr) {
      console.error("Error fetching events to archive:", fetchErr);
      return new Response(
        JSON.stringify({ error: "Failed to fetch events for archiving" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let archivedCount = 0;

    if (toArchive && toArchive.length > 0) {
      // Check which events are already archived
      const originalIds = toArchive.map((e) => e.id);
      const { data: existing } = await supabase
        .from("archived_events")
        .select("original_event_id")
        .in("original_event_id", originalIds);

      const existingSet = new Set((existing || []).map((e) => e.original_event_id));

      const newArchives = toArchive
        .filter((e) => !existingSet.has(e.id))
        .map((e) => ({
          original_event_id: e.id,
          device_id: e.device_id,
          event_type: e.event_type,
          severity: e.severity,
          ai_is_real: e.ai_is_real,
          ai_confidence: e.ai_confidence,
          ai_summary: e.ai_summary,
          viewed_at: e.viewed_at,
          created_at: e.created_at,
        }));

      if (newArchives.length > 0) {
        const { error: insertErr } = await supabase
          .from("archived_events")
          .insert(newArchives);

        if (insertErr) {
          console.error("Error inserting archived events:", insertErr);
        } else {
          archivedCount = newArchives.length;
        }
      }

      // Delete the archived events from monitoring_events
      const { error: deleteErr } = await supabase
        .from("monitoring_events")
        .delete()
        .in("id", originalIds);

      if (deleteErr) {
        console.error("Error deleting archived monitoring events:", deleteErr);
      }
    }

    const result = {
      success: true,
      timestamp: now.toISOString(),
      archived: archivedCount,
      deleted_archived: deletedArchived?.length || 0,
      deleted_old_events: deletedOld?.length || 0,
    };

    console.log("Cleanup result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
