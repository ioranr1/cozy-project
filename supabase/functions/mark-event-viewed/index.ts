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

    // Update the event
    const { data, error } = await supabase
      .from('monitoring_events')
      .update({
        viewed_at: new Date().toISOString(),
      })
      .eq('id', event_id)
      .select('id, viewed_at')
      .single();

    if (error) {
      console.error('[mark-event-viewed] Update error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'Event not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[mark-event-viewed] Event ${event_id} marked as viewed at ${data.viewed_at}`);

    return new Response(JSON.stringify({
      success: true,
      event_id: data.id,
      viewed_at: data.viewed_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

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
