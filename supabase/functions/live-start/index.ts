import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  device_id: string
  event_id?: string
  ttl_seconds?: number
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
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const body: RequestBody = await req.json()
    const { device_id, event_id } = body
    let ttl_seconds = body.ttl_seconds ?? 60

    // Validate device_id
    if (!device_id) {
      return new Response(JSON.stringify({ error: 'device_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate and clamp ttl_seconds
    if (typeof ttl_seconds !== 'number' || ttl_seconds < 1) {
      ttl_seconds = 60
    }
    if (ttl_seconds > 120) {
      ttl_seconds = 120
    }

    // Check if user owns the device
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('id', device_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (deviceError) {
      console.error('Device lookup error:', deviceError)
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!device) {
      return new Response(JSON.stringify({ error: 'Device not found or not owned by user' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check for existing active session (status in 'requested' or 'active')
    const { data: existingSession, error: sessionCheckError } = await supabase
      .from('live_sessions')
      .select('id, status')
      .eq('device_id', device_id)
      .in('status', ['requested', 'active'])
      .maybeSingle()

    if (sessionCheckError) {
      console.error('Session check error:', sessionCheckError)
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (existingSession) {
      return new Response(JSON.stringify({ 
        error: 'An active session already exists for this device',
        existing_session_id: existingSession.id,
        existing_status: existingSession.status
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Calculate expires_at
    const expiresAt = new Date(Date.now() + ttl_seconds * 1000).toISOString()

    // Create the live session
    const { data: session, error: insertError } = await supabase
      .from('live_sessions')
      .insert({
        device_id,
        user_id: user.id,
        event_id: event_id || null,
        status: 'requested',
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single()

    if (insertError) {
      console.error('Session insert error:', insertError)
      // Check if it's a unique constraint violation (concurrent request)
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ 
          error: 'An active session already exists for this device (concurrent request)'
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build ICE servers configuration
    const turnHost = Deno.env.get('TURN_HOST') || 'turn.example.com'
    const turnUsername = Deno.env.get('TURN_USERNAME') || 'placeholder_user'
    const turnPassword = Deno.env.get('TURN_PASSWORD') || 'placeholder_password'

    const iceServers = [
      { urls: ['stun:stun.l.google.com:19302'] },
      {
        urls: [
          `turn:${turnHost}:3478?transport=udp`,
          `turn:${turnHost}:3478?transport=tcp`,
          `turns:${turnHost}:5349?transport=tcp`,
        ],
        username: turnUsername,
        credential: turnPassword,
      },
    ]

    // Return success response
    return new Response(JSON.stringify({
      session_id: session.id,
      channel: `live:${session.id}`,
      expires_at: session.expires_at,
      ttl_seconds,
      ice_servers: iceServers,
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
