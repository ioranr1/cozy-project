/**
 * Mark Event Viewed Edge Function
 * ================================
 * VERSION: 1.1.0 (2026-04-30)
 * 
 * Called when user clicks the event link from WhatsApp notification.
 * Marks the event as viewed, which resets the notification cycle.
 * 
 * This prevents the reminder from being sent if user already saw the event.
 * 
 * v1.1.0: After resetting the cycle, check if there is an "orphaned" real event
 *          (real event that was blocked by the throttle while the previous alert
 *          was unviewed). If so, send a WhatsApp alert for the LATEST one only.
 *          This restores the original 3-step behavior:
 *          1) Block new alerts while previous unviewed
 *          2) Save events silently in DB during block
 *          3) On view → catch-up alert for newest blocked event
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
    // CATCH-UP NOTIFICATION
 //
    // After the cycle reset, look for the LATEST "orphan" event that:
    // - belongs to this device
    // - is a confirmed real event (ai_is_real = true)
    // - was NOT notified (notification_sent = false) — i.e. blocked by throttle
    // - has NOT been viewed yet
    // - is recent (last 24h) so we don't surface stale events
    //
    // If found → send WhatsApp alert + mark notification_sent = true.
    // ====================================================================
    try {
      const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
      const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: orphanEvents, error: orphanErr } = await supabase
        .from('monitoring_events')
        .select(`
          id,
          device_id,
          event_type,
          labels,
          severity,
          ai_summary,
          created_at,
          devices!inner (
            profile_id,
            profiles!inner (
              phone_number,
              country_code,
              preferred_language,
              phone_verified
            )
          )
        `)
        .eq('device_id', deviceId)
        .eq('notification_sent', false)
        .eq('ai_is_real', true)
        .is('viewed_at', null)
        .gte('created_at', since24h)
        .order('created_at', { ascending: false })
        .limit(1);

      if (orphanErr) {
        console.error('[mark-event-viewed] Orphan lookup error:', orphanErr);
      } else if (orphanEvents && orphanEvents.length > 0) {
        const orphan = orphanEvents[0];
        const profile = (orphan.devices as any)?.profiles;

        if (
          profile &&
          profile.phone_verified === true &&
          WHATSAPP_ACCESS_TOKEN &&
          WHATSAPP_PHONE_NUMBER_ID
        ) {
          const phoneNumber = `${profile.country_code}${profile.phone_number}`.replace(/\+/g, '');

          console.log(`[mark-event-viewed] Sending catch-up alert for orphan event ${orphan.id} on device ${deviceId}`);

          const waResp = await fetch(
            `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: phoneNumber,
                type: 'template',
                template: {
                  name: 'security_event_alert',
                  language: { code: 'en_US' },
                  components: [
                    {
                      type: 'button',
                      sub_type: 'url',
                      index: '0',
                      parameters: [{ type: 'text', text: orphan.id }],
                    },
                  ],
                },
              }),
            }
          );

          if (!waResp.ok) {
            const errText = await waResp.text();
            console.error(`[mark-event-viewed] Catch-up WhatsApp send failed: ${waResp.status} - ${errText}`);
          } else {
            await supabase
              .from('monitoring_events')
              .update({
                notification_sent: true,
                notification_sent_at: new Date().toISOString(),
                notification_type: 'whatsapp_catchup',
              })
              .eq('id', orphan.id);

            // Mark all OTHER orphan events for this device as "superseded"
            // (notification_sent=true so they won't be picked up again).
            // We treat them as already viewed since we only surface the latest.
            const nowIso2 = new Date().toISOString();
            await supabase
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
              .is('viewed_at', null);

            console.log(`[mark-event-viewed] Catch-up alert sent for event ${orphan.id}`);
          }
        } else {
          console.log('[mark-event-viewed] Orphan event found but skipping catch-up (no opt-in or WA config)');
        }
      } else {
        console.log('[mark-event-viewed] No orphan real events to catch up on');
      }
    } catch (catchupErr) {
      console.error('[mark-event-viewed] Catch-up notification failed:', catchupErr);
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
