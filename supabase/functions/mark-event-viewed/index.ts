/**
 * Mark Event Viewed Edge Function
 * ================================
 * VERSION: 1.0.0 (2026-02-02)
 * 
 * Called when user clicks the event link from WhatsApp notification.
 * Marks the event as viewed, which resets the notification cycle.
 * 
 * This prevents the reminder from being sent if user already saw the event.
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
