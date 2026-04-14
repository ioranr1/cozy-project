import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      device_id,
      agent_version,
      uptime_seconds,
      monitoring_active,
      camera_status,
      motion_detector_status,
      sound_detector_status,
      system_info,
      recent_errors,
    } = body;

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('device_diagnostics')
      .upsert(
        {
          device_id,
          agent_version: agent_version || '0.0.0',
          uptime_seconds: uptime_seconds || 0,
          monitoring_active: monitoring_active ?? false,
          camera_status: camera_status || 'unknown',
          motion_detector_status: motion_detector_status || 'unknown',
          sound_detector_status: sound_detector_status || 'unknown',
          system_info: system_info || {},
          recent_errors: (recent_errors || []).slice(-10),
        },
        { onConflict: 'device_id' }
      );

    if (error) {
      console.error('[agent-health-report] DB error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[agent-health-report] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
