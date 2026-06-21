/**
 * Mark Event Viewed Edge Function
 * ================================
 * VERSION: 1.2.0 (2026-04-30)
 * 
 * Called when user clicks the event link from WhatsApp notification.
 * Marks the event as viewed, which resets the notification cycle.
 * 
 * This prevents the reminder from being sent if user already saw the event.
 * 
 * v1.2.0: NO catch-up alert from archive. The correct behavior is:
 *          1) Block new alerts while previous unviewed
 *          2) Events during block are saved silently (video + snapshot only)
 *          3) On view → cycle is RESET. Only NEW future detections trigger
 *             a fresh WhatsApp alert. Old archived events are NOT re-sent.
 *          To prevent old un-notified events from blocking the next slot,
 *          we mark them all as superseded (viewed + notification_sent).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse request body
    const body = await req.json();
    const { event_id } = body;

    if (!event_id) {
      return new Response(JSON.stringify({ error: 'Missing event_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[mark-event-viewed] Marking event ${event_id} as viewed`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the event to resolve device_id
    const { data: event, error: eventError } = await supabase
      .from('monitoring_events')
      .select('id, device_id')
      .eq('id', event_id)
      .maybeSingle();

    if (eventError) {
      console.error('[mark-event-viewed] Fetch event error:', eventError);
      return new Response(JSON.stringify({ error: eventError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!event?.device_id) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowIso = new Date().toISOString();
    const deviceId = event.device_id;

    // IMPORTANT:
    // The throttle blocks if ANY unviewed PRIMARY event exists for the device.
    // If marking single event only, older unviewed notifications would keep the device blocked.
    // So we mark all unviewed PRIMARY events for this device as viewed to truly "reset the cycle".
    const { data: updatedRows, error: updateError } = await supabase
      .from('monitoring_events')
      .update({ viewed_at: nowIso })
      .eq('device_id', deviceId)
      .eq('notification_sent', true)
      .eq('ai_is_real', true)
      .is('viewed_at', null)
      .select('id');

    if (updateError) {
      console.error('[mark-event-viewed] Update error:', updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const markedCount = updatedRows?.length ?? 0;
    console.log(`[mark-event-viewed] Marked ${markedCount} events as viewed for device ${deviceId}`);

    // ====================================================================
    // SUPERSEDE ORPHAN EVENTS (no catch-up alert from archive)
    //
    // Events that occurred while the previous alert was unviewed were saved
    // silently (video + snapshot). They must NOT be sent now as a stale alert.
    // We just mark them as superseded so they don't block the next real-time
    // detection from acquiring a WhatsApp send slot.
    // ====================================================================
    try {
      const nowIso2 = new Date().toISOString();
      const { data: supersededRows, error: supersedeErr } = await supabase
        .from('monitoring_events')
        .update({
          notification_sent: true,
          notification_sent_at: nowIso2,
          notification_type: 'superseded',
          viewed_at: nowIso2,
        })
        .eq('device_id', deviceId)
        .eq('notification_sent', false)
        .eq('ai_is_real', true)
        .is('viewed_at', null)
        .select('id');

      if (supersedeErr) {
        console.error('[mark-event-viewed] Supersede error:', supersedeErr);
      } else {
        console.log(`[mark-event-viewed] Superseded ${supersededRows?.length ?? 0} archived orphan events (no alert sent — only future real-time detections will alert)`);
      }
    } catch (supErr) {
      console.error('[mark-event-viewed] Supersede step failed:', supErr);
      // Do not fail the request — the primary mark-as-viewed already succeeded.
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id,
        device_id: deviceId,
        marked_count: markedCount,
        viewed_at: nowIso,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[mark-event-viewed] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
