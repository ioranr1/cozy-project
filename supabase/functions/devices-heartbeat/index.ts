import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  device_id: string
  app_version?: string
  capabilities?: {
    camera?: boolean
    microphone?: boolean
    webrtc?: boolean
  }
}

// Hash token using SHA-256
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
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
    // Get authorization header (device token)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const deviceToken = authHeader.replace('Bearer ', '')

    // Parse request body
    const body: RequestBody = await req.json()
    const { device_id, app_version, capabilities } = body

    // Validate device_id
    if (!device_id) {
      return new Response(JSON.stringify({ error: 'device_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase admin client (service role to bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get device and verify token
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, device_auth_token_hash, status')
      .eq('id', device_id)
      .maybeSingle()

    if (deviceError) {
      console.error('Device lookup error:', deviceError)
      return new Response(JSON.stringify({ error: 'Database error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!device) {
      return new Response(JSON.stringify({ error: 'Device not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!device.device_auth_token_hash) {
      return new Response(JSON.stringify({ error: 'Device not paired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Hash the provided token and compare
    const providedTokenHash = await hashToken(deviceToken)
    if (providedTokenHash !== device.device_auth_token_hash) {
      return new Response(JSON.stringify({ error: 'Invalid device token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update device status and last_seen_at
    const { error: updateError } = await supabase
      .from('devices')
      .update({ 
        status: 'online',
        last_seen_at: new Date().toISOString()
      })
      .eq('id', device_id)

    if (updateError) {
      console.error('Device update error:', updateError)
      // Non-fatal, continue
    }

    // Check for active live session
    const { data: activeSession, error: sessionError } = await supabase
      .from('live_sessions')
      .select('id, expires_at, status')
      .eq('device_id', device_id)
      .in('status', ['requested', 'active'])
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (sessionError) {
      console.error('Session lookup error:', sessionError)
      // Non-fatal, just report no active session
    }

    // Build response
    const response: Record<string, unknown> = { status: 'ok' }

    if (activeSession) {
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

      response.live = {
        requested: true,
        session_id: activeSession.id,
        channel: `live:${activeSession.id}`,
        expires_at: activeSession.expires_at,
        ice_servers: iceServers,
      }
    } else {
      response.live = {
        requested: false,
      }
    }

    return new Response(JSON.stringify(response), {
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
