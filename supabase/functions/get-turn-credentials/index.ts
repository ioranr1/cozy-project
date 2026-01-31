import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const METERED_SECRET_KEY = Deno.env.get('METERED_SECRET_KEY');
    
    if (!METERED_SECRET_KEY) {
      console.error('METERED_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'TURN server not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Metered.ca API endpoint for getting ICE servers
    const meteredDomain = 'aiguard.metered.live';
    const apiUrl = `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${METERED_SECRET_KEY}`;

    console.log('Fetching TURN credentials from Metered.ca...');

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('Metered API error:', response.status, await response.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch TURN credentials' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meteredResponse = await response.json();

    // Metered can return either:
    // 1) an array of RTCIceServer objects
    // 2) an object { iceServers: RTCIceServer[] }
    const iceServers = Array.isArray(meteredResponse)
      ? meteredResponse
      : Array.isArray((meteredResponse as any)?.iceServers)
        ? (meteredResponse as any).iceServers
        : [];

    if (!iceServers.length) {
      console.error('Metered response did not contain iceServers array:', meteredResponse);
      return new Response(
        JSON.stringify({ error: 'Invalid TURN response' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully retrieved ICE servers:', iceServers.length, 'servers');

    return new Response(
      JSON.stringify({ iceServers }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error fetching TURN credentials:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
