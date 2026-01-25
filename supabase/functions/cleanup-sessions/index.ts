import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get session token from header or body
    const sessionToken = req.headers.get('x-session-token')
    let body: { session_token?: string; device_id?: string } = {}
    
    try {
      body = await req.json()
    } catch {
      // Body might be empty
    }

    const token = sessionToken || body.session_token

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing session token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate session token
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .rpc('validate_user_session', { p_token: token })

    if (sessionError || !sessionData || sessionData.length === 0) {
      console.error('Session validation error:', sessionError)
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { profile_id, is_valid } = sessionData[0]

    if (!is_valid || !profile_id) {
      return new Response(JSON.stringify({ error: 'Session expired or invalid' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[cleanup-sessions] Cleaning up for profile: ${profile_id}`)

    // Get all devices for this profile
    const { data: devices, error: devicesError } = await supabaseAdmin
      .from('devices')
      .select('id')
      .eq('profile_id', profile_id)

    if (devicesError) {
      console.error('Devices lookup error:', devicesError)
      return new Response(JSON.stringify({ error: 'Failed to fetch devices' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const deviceIds = devices?.map(d => d.id) || []

    if (deviceIds.length === 0) {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        message: 'No devices found',
        cleanedSessions: 0,
        cleanedCommands: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Clean up stuck RTC sessions
    const { data: cleanedSessions, error: sessionsError } = await supabaseAdmin
      .from('rtc_sessions')
      .update({ 
        status: 'ended', 
        ended_at: new Date().toISOString(),
        fail_reason: 'manual_cleanup'
      })
      .in('device_id', deviceIds)
      .in('status', ['pending', 'active'])
      .select('id')

    if (sessionsError) {
      console.error('RTC sessions cleanup error:', sessionsError)
    }

    // Clean up stuck commands
    const { data: cleanedCommands, error: commandsError } = await supabaseAdmin
      .from('commands')
      .update({ 
        handled: true, 
        handled_at: new Date().toISOString(),
        status: 'cleanup'
      })
      .in('device_id', deviceIds)
      .eq('handled', false)
      .select('id')

    if (commandsError) {
      console.error('Commands cleanup error:', commandsError)
    }

    const sessionsCount = cleanedSessions?.length || 0
    const commandsCount = cleanedCommands?.length || 0

    console.log(`[cleanup-sessions] Cleaned ${sessionsCount} sessions, ${commandsCount} commands`)

    return new Response(JSON.stringify({ 
      status: 'ok',
      cleanedSessions: sessionsCount,
      cleanedCommands: commandsCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
