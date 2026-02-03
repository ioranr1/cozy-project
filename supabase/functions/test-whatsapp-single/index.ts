import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single test message to your number
    const phoneNumber = '972522750907';
    const testEventId = 'a25e7041-a5ad-47fd-9b64-6a02a0a7f40b'; // Most recent event

    console.log('[TEST] Sending single WhatsApp message to:', phoneNumber);

    // Test WITHOUT button - just body parameters
    const response = await fetch(
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
            name: 'security_alert',
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: '🧪 TEST 6 - Base URL = /event/' },
                  { type: 'text', text: 'Motion' },
                  { type: 'text', text: 'person 85%' },
                  { type: 'text', text: 'שנה Base URL ל-https://aiguard24.com/event/' },
                ],
              },
              // Button sends ONLY UUID - Base URL should be https://aiguard24.com/event/
              {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [
                  { type: 'text', text: testEventId },  // Just UUID!
                ],
              },
            ],
          },
        }),
      }
    );

    const responseBody = await response.json();
    
    console.log('[TEST] WhatsApp API Status:', response.status);
    console.log('[TEST] WhatsApp API Response:', JSON.stringify(responseBody));

    if (!response.ok) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: responseBody,
        status: response.status 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message_id: responseBody?.messages?.[0]?.id,
      message_status: responseBody?.messages?.[0]?.message_status,
      sent_to: phoneNumber,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[TEST] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
