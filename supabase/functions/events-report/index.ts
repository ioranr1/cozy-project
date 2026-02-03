/**
 * Events Report Edge Function
 * ===========================
 * VERSION: 2.3.0 (2026-02-03)
 * 
 * CHANGELOG:
 * - v2.3.0: SEPARATION OF CONCERNS - First event in cooldown window gets AI
 *           validation + WhatsApp. Subsequent events are stored as "follow-up"
 *           without AI processing (saves resources).
 * - v2.2.0: ATOMIC COOLDOWN - Uses acquire_whatsapp_send_slot() DB function
 *           to prevent race conditions between parallel event reports.
 * - v2.1.0: Added WhatsApp cooldown (had race condition bug)
 * - v2.0.0: AI validation with Gemini, Hebrew/English support
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// AI Gateway URL
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Notification cooldown: 60 seconds between WhatsApp messages per device
const NOTIFICATION_COOLDOWN_MS = 60000;

// Severity mapping based on labels
const SEVERITY_MAP: Record<string, string> = {
  person: 'high',
  gunshot: 'critical',
  scream: 'critical',
  glass_breaking: 'high',
  alarm: 'high',
  siren: 'high',
  baby_crying: 'medium',
  animal: 'low',
  vehicle: 'low',
  dog_barking: 'low',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const {
      device_id,
      event_type,
      labels,
      snapshot, // base64 encoded image for motion events
      timestamp,
      metadata = {},
    } = body;

    console.log(`[events-report] Received ${event_type} event for device ${device_id}`);
    console.log(`[events-report] Labels:`, labels);

    // Validate required fields
    if (!device_id || !event_type || !labels) {
      return new Response(JSON.stringify({ error: 'Missing required fields: device_id, event_type, labels' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate device token from header
    const deviceToken = req.headers.get('x-device-token');
    if (!deviceToken) {
      return new Response(JSON.stringify({ error: 'Missing device authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify device token
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, profile_id, device_auth_token')
      .eq('id', device_id)
      .single();

    if (deviceError || !device) {
      console.error('[events-report] Device not found:', deviceError);
      return new Response(JSON.stringify({ error: 'Device not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (device.device_auth_token !== deviceToken) {
      console.error('[events-report] Invalid device token');
      return new Response(JSON.stringify({ error: 'Invalid device authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine severity from labels
    let severity = 'low';
    for (const labelObj of labels) {
      const label = labelObj.label || labelObj;
      if (SEVERITY_MAP[label] && getSeverityRank(SEVERITY_MAP[label]) > getSeverityRank(severity)) {
        severity = SEVERITY_MAP[label];
      }
    }

    // Upload snapshot if provided (motion events)
    let snapshotUrl: string | null = null;
    if (snapshot && event_type === 'motion') {
      try {
        // Decode base64 and upload to storage
        const base64Data = snapshot.replace(/^data:image\/\w+;base64,/, '');
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        const fileName = `${device_id}/${Date.now()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from('event-snapshots')
          .upload(fileName, binaryData, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          console.error('[events-report] Snapshot upload error:', uploadError);
        } else {
          // Get signed URL (valid for 7 days)
          const { data: signedUrl } = await supabase.storage
            .from('event-snapshots')
            .createSignedUrl(fileName, 60 * 60 * 24 * 7);
          
          snapshotUrl = signedUrl?.signedUrl || null;
          console.log('[events-report] Snapshot uploaded:', fileName);
        }
      } catch (uploadErr) {
        console.error('[events-report] Snapshot processing error:', uploadErr);
      }
    }

    // Create initial event record
    const { data: eventRecord, error: insertError } = await supabase
      .from('monitoring_events')
      .insert({
        device_id,
        event_type,
        labels,
        snapshot_url: snapshotUrl,
        severity,
        metadata: {
          ...metadata,
          original_timestamp: timestamp,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[events-report] Failed to create event:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to create event record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[events-report] Event created:', eventRecord.id);

    // =========================================================
    // STEP 1: TRY TO ACQUIRE WHATSAPP SLOT FIRST
    // This determines if this is the "primary" event or a "follow-up"
    // =========================================================
    const { data: canSend, error: slotError } = await supabase
      .rpc('acquire_whatsapp_send_slot', {
        p_device_id: device_id,
        p_cooldown_ms: NOTIFICATION_COOLDOWN_MS,
      });

    if (slotError) {
      console.error('[events-report] Error acquiring slot:', slotError);
    }

    const isPrimaryEvent = canSend === true;

    // =========================================================
    // STEP 2: BRANCH LOGIC - PRIMARY vs FOLLOW-UP
    // =========================================================
    if (!isPrimaryEvent) {
      // -------------------------------------------------------
      // FOLLOW-UP EVENT: Skip AI validation, mark as follow-up
      // -------------------------------------------------------
      console.log(`[events-report] 📎 FOLLOW-UP EVENT - Within cooldown window`);
      console.log(`[events-report] Skipping AI validation for event ${eventRecord.id}`);

      await supabase
        .from('monitoring_events')
        .update({
          ai_validated: false,
          ai_is_real: null,
          ai_summary: 'Follow-up detection within cooldown window',
          metadata: {
            ...metadata,
            original_timestamp: timestamp,
            is_followup: true,
          },
        })
        .eq('id', eventRecord.id);

      return new Response(JSON.stringify({
        success: true,
        event_id: eventRecord.id,
        is_followup: true,
        ai_validated: false,
        notification_sent: false,
        message: 'Event stored as follow-up (within cooldown window)',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------
    // PRIMARY EVENT: Full AI validation + WhatsApp notification
    // -------------------------------------------------------
    console.log(`[events-report] 🎯 PRIMARY EVENT - Running AI validation`);

    // Get profile for language preference (needed for AI summary)
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_number, country_code, full_name, preferred_language')
      .eq('id', device.profile_id)
      .single();

    const userLanguage = profile?.preferred_language || 'he';

    // Run AI validation
    let aiIsReal = false;
    let aiSummary = '';
    let aiConfidence = 0;

    try {
      const aiResult = await validateWithAI({
        eventType: event_type,
        labels,
        snapshotUrl,
        snapshot, // Pass base64 for vision
        apiKey: LOVABLE_API_KEY,
        language: userLanguage, // Pass user language preference
      });

      aiIsReal = aiResult.isReal;
      aiSummary = aiResult.summary;
      aiConfidence = aiResult.confidence;

      console.log(`[events-report] AI validation: isReal=${aiIsReal}, confidence=${aiConfidence}`);

      // Update event with AI results
      await supabase
        .from('monitoring_events')
        .update({
          ai_validated: true,
          ai_is_real: aiIsReal,
          ai_summary: aiSummary,
          ai_confidence: aiConfidence,
          ai_validated_at: new Date().toISOString(),
          severity: aiIsReal ? severity : 'low', // Downgrade false positives
          metadata: {
            ...metadata,
            original_timestamp: timestamp,
            is_followup: false,
          },
        })
        .eq('id', eventRecord.id);

    } catch (aiError) {
      console.error('[events-report] AI validation error:', aiError);
      // Continue without AI validation - treat as real for safety
      aiIsReal = true;
      aiSummary = userLanguage === 'he' 
        ? 'אימות AI לא זמין - מטופל כאירוע אמיתי'
        : 'AI validation unavailable - treating as real event';
    }

    // If event is real, send WhatsApp notification
    const notificationTypes: string[] = [];

    if (aiIsReal) {
      console.log('[events-report] Event validated as REAL - sending WhatsApp notification');

      if (WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID && profile) {
        try {
          const phoneTo = `${profile.country_code}${profile.phone_number}`.replace(/\+/g, '');
          const waResult = await sendWhatsAppNotification({
            phoneNumber: phoneTo,
            eventType: event_type,
            labels,
            severity,
            aiSummary,
            accessToken: WHATSAPP_ACCESS_TOKEN,
            phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
            language: profile.preferred_language || 'he',
            eventId: eventRecord.id,
          });

          // Persist WhatsApp API response in DB for later debugging (delivery issues, wrong recipient, etc.)
          const { data: metaRow } = await supabase
            .from('monitoring_events')
            .select('metadata')
            .eq('id', eventRecord.id)
            .single();

          const mergedMetadata = {
            ...(typeof metaRow?.metadata === 'object' && metaRow?.metadata !== null ? metaRow.metadata : {}),
            whatsapp: {
              message_id: waResult.messageId,
              sent_to: phoneTo,
              api_response: waResult.responseBody,
              stored_at: new Date().toISOString(),
            },
          };

          await supabase
            .from('monitoring_events')
            .update({ metadata: mergedMetadata })
            .eq('id', eventRecord.id);

          notificationTypes.push('whatsapp');
          console.log('[events-report] ✅ WhatsApp notification sent successfully');
        } catch (waError) {
          console.error('[events-report] WhatsApp notification failed:', waError);

          // Persist error for debugging
          try {
            const { data: metaRow } = await supabase
              .from('monitoring_events')
              .select('metadata')
              .eq('id', eventRecord.id)
              .single();

            const mergedMetadata = {
              ...(typeof metaRow?.metadata === 'object' && metaRow?.metadata !== null ? metaRow.metadata : {}),
              whatsapp: {
                error: waError instanceof Error ? waError.message : String(waError),
                stored_at: new Date().toISOString(),
              },
            };

            await supabase
              .from('monitoring_events')
              .update({ metadata: mergedMetadata })
              .eq('id', eventRecord.id);
          } catch {
            // Ignore secondary logging failures
          }
        }
      }

      // Update notification status
      if (notificationTypes.length > 0) {
        await supabase
          .from('monitoring_events')
          .update({
            notification_sent: true,
            notification_sent_at: new Date().toISOString(),
            notification_type: notificationTypes.join(','),
          })
          .eq('id', eventRecord.id);
      }
    } else {
      console.log('[events-report] Event validated as FALSE POSITIVE - no notification');
    }

    return new Response(JSON.stringify({
      success: true,
      event_id: eventRecord.id,
      ai_validated: true,
      ai_is_real: aiIsReal,
      ai_summary: aiSummary,
      ai_confidence: aiConfidence,
      severity,
      notification_sent: notificationTypes.length > 0,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[events-report] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function getSeverityRank(severity: string): number {
  const ranks: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  return ranks[severity] || 0;
}

interface AIValidationParams {
  eventType: string;
  labels: Array<{ label: string; confidence: number }>;
  snapshotUrl: string | null;
  snapshot: string | null;
  apiKey: string;
  language: string; // 'he' or 'en'
}

interface AIValidationResult {
  isReal: boolean;
  summary: string;
  confidence: number;
}

async function validateWithAI(params: AIValidationParams): Promise<AIValidationResult> {
  const { eventType, labels, snapshot, apiKey, language } = params;

  const isHebrew = language === 'he';
  const summaryLanguage = isHebrew ? 'Hebrew' : 'English';

  // Build prompt based on event type
  let messages: Array<{ role: string; content: any }>;
  
  if (eventType === 'motion' && snapshot) {
    // Vision-based validation for motion events WITH snapshot
    messages = [
      {
        role: 'system',
        content: `You are a security AI assistant analyzing camera snapshots for a home security system.
Your job is to determine if detected objects/people represent a real security concern.

Rules:
- A person near doors/windows = HIGH concern
- A person inside the home = CRITICAL concern
- Animals or pets = LOW concern (unless specified as alert-worthy)
- Vehicles in driveways = LOW concern
- Shadows, reflections, or camera artifacts = FALSE POSITIVE

IMPORTANT: Your summary MUST be written in ${summaryLanguage}. Keep it brief (1-2 sentences).

Respond in JSON format:
{
  "is_real": boolean,
  "confidence": number (0-1),
  "summary": "Brief explanation in ${summaryLanguage}"
}`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Detected labels: ${JSON.stringify(labels)}. Analyze this security camera snapshot and determine if this is a real security event or false positive.`
          },
          {
            type: 'image_url',
            image_url: {
              url: snapshot // base64 data URL
            }
          }
        ]
      }
    ];
  } else if (eventType === 'motion') {
    // Motion event WITHOUT snapshot - use labels only
    // CRITICAL: If person detected with high confidence, treat as REAL for safety
    const labelsText = labels.map(l => `${l.label} (${(l.confidence * 100).toFixed(0)}%)`).join(', ');
    
    console.log(`[AI Validation] Motion without snapshot - labels: ${labelsText}`);
    
    messages = [
      {
        role: 'system',
        content: `You are a security AI assistant analyzing motion detection events for a home security system.
Your job is to determine if detected motion represents a real security concern.

CRITICAL RULES:
- If "person" is detected with confidence >= 70%, this is ALWAYS a REAL security event. Err on the side of caution.
- If "person" is detected with confidence >= 50%, this is likely a REAL event.
- "animal" or "pet" = LOW concern (usually not a security threat)
- "vehicle" = MEDIUM concern (depends on location)
- Unknown objects with low confidence = possible FALSE POSITIVE

IMPORTANT: For "person" detection, you should almost ALWAYS return is_real: true to avoid missing real threats.
Your summary MUST be written in ${summaryLanguage}. Keep it brief (1-2 sentences).

Respond in JSON format:
{
  "is_real": boolean,
  "confidence": number (0-1),
  "summary": "Brief explanation in ${summaryLanguage}"
}`
      },
      {
        role: 'user',
        content: `Motion detected. Classified objects: ${labelsText}. Note: No camera snapshot available for this detection. Based only on the motion detection labels, is this a real security concern?`
      }
    ];
  } else {
    // Sound events
    const labelsText = labels.map(l => `${l.label} (${(l.confidence * 100).toFixed(0)}%)`).join(', ');
    
    messages = [
      {
        role: 'system',
        content: `You are a security AI assistant analyzing audio detection events for a home security system.
Your job is to determine if detected sounds represent a real security concern.

Sound classifications:
- glass_breaking, gunshot, scream = CRITICAL (likely real threat)
- alarm, siren = HIGH (investigate immediately)
- baby_crying = MEDIUM (may need attention)
- dog_barking = LOW (usually normal)

Consider:
- High confidence scores (>0.8) are more reliable
- Multiple detections of same sound = more reliable
- Context matters (time of day, typical household sounds)

IMPORTANT: Your summary MUST be written in ${summaryLanguage}. Keep it brief (1-2 sentences).

Respond in JSON format:
{
  "is_real": boolean,
  "confidence": number (0-1),
  "summary": "Brief explanation in ${summaryLanguage}"
}`
      },
      {
        role: 'user',
        content: `Audio event detected. Classified sounds: ${labelsText}. Is this a real security concern or a false positive?`
      }
    ];
  }

  // Call Lovable AI Gateway
  const response = await fetch(AI_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash', // Fast + multimodal
      messages,
      temperature: 0.3, // Lower for more consistent results
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI Validation] API error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  console.log('[AI Validation] Raw response:', content);

  // Parse JSON response
  try {
    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isReal: parsed.is_real === true,
        summary: parsed.summary || 'No summary provided',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    }
  } catch (parseError) {
    console.error('[AI Validation] Parse error:', parseError);
  }

  // Fallback: treat as real for safety
  return {
    isReal: true,
    summary: 'לא ניתן לפענח תגובת AI - מטופל כאירוע אמיתי',
    confidence: 0.5,
  };
}

interface WhatsAppParams {
  phoneNumber: string;
  eventType: string;
  labels: Array<{ label: string; confidence: number }>;
  severity: string;
  aiSummary: string;
  accessToken: string;
  phoneNumberId: string;
  language: string;
  eventId: string;
}

type WhatsAppSendResult = {
  messageId: string | null;
  responseBody: unknown;
};

async function sendWhatsAppNotification(params: WhatsAppParams): Promise<WhatsAppSendResult> {
  const { phoneNumber, eventType, labels, severity, aiSummary, accessToken, phoneNumberId, language, eventId } = params;
  // Event view URL - using custom domain
  const eventUrl = `https://aiguard24.com/event/${eventId}`;

  const isHebrew = language === 'he';
  
  // Severity labels for template {{1}}
  const severityLabels: Record<string, Record<string, string>> = {
    critical: { he: '🚨 קריטי', en: '🚨 CRITICAL' },
    high: { he: '⚠️ גבוה', en: '⚠️ HIGH' },
    medium: { he: '📢 בינוני', en: '📢 MEDIUM' },
    low: { he: 'ℹ️ נמוך', en: 'ℹ️ LOW' },
  };

  // Event type labels for template {{2}}
  const eventTypeLabels: Record<string, Record<string, string>> = {
    motion: { he: 'תנועה', en: 'Motion' },
    sound: { he: 'קול', en: 'Sound' },
  };

  // Build template parameters
  const topLabel = labels[0]?.label || 'unknown';
  const topConfidence = labels[0]?.confidence || 0;

  // {{1}} Alert level
  const alertLevel = severityLabels[severity]?.[isHebrew ? 'he' : 'en'] || severity;
  
  // {{2}} Event type
  const eventTypeText = eventTypeLabels[eventType]?.[isHebrew ? 'he' : 'en'] || eventType;
  
  // {{3}} What was detected (label + confidence)
  const detectedText = isHebrew 
    ? `${topLabel} ${(topConfidence * 100).toFixed(0)}%`
    : `${topLabel} ${(topConfidence * 100).toFixed(0)}%`;
  
  // {{4}} AI Summary (already in the appropriate language from the AI)
  const summaryText = aiSummary || (isHebrew ? 'אין סיכום זמין' : 'No summary available');

  // Send via WhatsApp Template API
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: 'security_alert',
          language: {
            code: 'en_US', // Template is registered in English (US), content is localized via parameters
          },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: alertLevel },      // {{1}} Alert level
                { type: 'text', text: eventTypeText },   // {{2}} Event type
                { type: 'text', text: detectedText },    // {{3}} What was detected
                { type: 'text', text: summaryText },     // {{4}} AI Summary
              ],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: 0,
              parameters: [
                { type: 'text', text: eventId },  // Dynamic URL suffix - just the event ID
              ],
            },
          ],
        },
      }),
    }
  );

  const responseBody = await response.json();
  
  if (!response.ok) {
    console.error('[WhatsApp] API error response:', JSON.stringify(responseBody));
    throw new Error(`WhatsApp API error: ${response.status} - ${JSON.stringify(responseBody)}`);
  }

  // Log the full response including message_id for delivery verification
  console.log('[WhatsApp] API Response:', JSON.stringify(responseBody));
  console.log('[WhatsApp] Message ID:', responseBody?.messages?.[0]?.id || 'unknown');
  console.log('[WhatsApp] Template message sent to:', phoneNumber);
  console.log('[WhatsApp] Template params:', { alertLevel, eventTypeText, detectedText, summaryText, eventUrl });

  return {
    messageId: responseBody?.messages?.[0]?.id ?? null,
    responseBody,
  };
}
