/**
 * Send Reminder Edge Function
 * ============================
 * VERSION: 1.0.0 (2026-02-02)
 * 
 * Called by pg_cron every minute to check for events needing reminder notifications.
 * Logic:
 * - Find events where notification was sent > 1 minute ago
 * - reminder_sent = false
 * - viewed_at IS NULL (user hasn't clicked the link)
 * - Send second (final) WhatsApp notification
 * - Mark reminder_sent = true
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reminder delay in milliseconds (1 minute)
const REMINDER_DELAY_MS = 60 * 1000;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate the cutoff time (1 minute ago)
    const cutoffTime = new Date(Date.now() - REMINDER_DELAY_MS).toISOString();

    console.log(`[send-reminder] Checking for events needing reminders (cutoff: ${cutoffTime})`);

    // Find events that need reminder
    const { data: pendingEvents, error: queryError } = await supabase
      .from('monitoring_events')
      .select(`
        id,
        device_id,
        event_type,
        labels,
        severity,
        ai_summary,
        notification_sent_at,
        devices!inner (
          profile_id,
          profiles!inner (
            phone_number,
            country_code,
            preferred_language
          )
        )
      `)
      .eq('notification_sent', true)
      .eq('reminder_sent', false)
      .is('viewed_at', null)
      .eq('ai_is_real', true)
      .lt('notification_sent_at', cutoffTime);

    if (queryError) {
      console.error('[send-reminder] Query error:', queryError);
      return new Response(JSON.stringify({ error: queryError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[send-reminder] Found ${pendingEvents?.length || 0} events needing reminders`);

    if (!pendingEvents || pendingEvents.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        reminders_sent: 0,
        message: 'No pending reminders'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let remindersSent = 0;
    const errors: string[] = [];

    for (const event of pendingEvents) {
      try {
        // Type assertion for nested data
        const deviceData = event.devices as any;
        const profile = deviceData?.profiles;

        if (!profile || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
          console.log(`[send-reminder] Skipping event ${event.id} - missing profile or WhatsApp config`);
          continue;
        }

        const phoneNumber = `${profile.country_code}${profile.phone_number}`.replace(/\+/g, '');
        const language = profile.preferred_language || 'he';
        const isHebrew = language === 'he';

        // Send reminder notification
        await sendReminderWhatsApp({
          phoneNumber,
          eventType: event.event_type,
          labels: event.labels as Array<{ label: string; confidence: number }>,
          severity: event.severity || 'medium',
          aiSummary: event.ai_summary || '',
          accessToken: WHATSAPP_ACCESS_TOKEN,
          phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
          language,
          eventId: event.id,
          isReminder: true,
        });

        // Mark reminder as sent
        await supabase
          .from('monitoring_events')
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq('id', event.id);

        remindersSent++;
        console.log(`[send-reminder] Reminder sent for event ${event.id}`);

      } catch (eventError) {
        const errorMsg = eventError instanceof Error ? eventError.message : 'Unknown error';
        console.error(`[send-reminder] Error processing event ${event.id}:`, errorMsg);
        errors.push(`${event.id}: ${errorMsg}`);

        // Still mark as reminder_sent to avoid infinite retries
        await supabase
          .from('monitoring_events')
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq('id', event.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      reminders_sent: remindersSent,
      total_processed: pendingEvents.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[send-reminder] Unexpected error:', error);
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

interface WhatsAppReminderParams {
  phoneNumber: string;
  eventType: string;
  labels: Array<{ label: string; confidence: number }>;
  severity: string;
  aiSummary: string;
  accessToken: string;
  phoneNumberId: string;
  language: string;
  eventId: string;
  isReminder: boolean;
}

async function sendReminderWhatsApp(params: WhatsAppReminderParams): Promise<void> {
  const { phoneNumber, eventType, labels, severity, aiSummary, accessToken, phoneNumberId, language, eventId } = params;

  const isHebrew = language === 'he';
  
  // Severity labels for template {{1}} - with REMINDER prefix
  const severityLabels: Record<string, Record<string, string>> = {
    critical: { he: '🔔 תזכורת: 🚨 קריטי', en: '🔔 Reminder: 🚨 CRITICAL' },
    high: { he: '🔔 תזכורת: ⚠️ גבוה', en: '🔔 Reminder: ⚠️ HIGH' },
    medium: { he: '🔔 תזכורת: 📢 בינוני', en: '🔔 Reminder: 📢 MEDIUM' },
    low: { he: '🔔 תזכורת: ℹ️ נמוך', en: '🔔 Reminder: ℹ️ LOW' },
  };

  // Event type labels for template {{2}}
  const eventTypeLabels: Record<string, Record<string, string>> = {
    motion: { he: 'תנועה', en: 'Motion' },
    sound: { he: 'קול', en: 'Sound' },
  };

  const topLabel = labels[0]?.label || 'unknown';
  const topConfidence = labels[0]?.confidence || 0;

  const alertLevel = severityLabels[severity]?.[isHebrew ? 'he' : 'en'] || `🔔 ${severity}`;
  const eventTypeText = eventTypeLabels[eventType]?.[isHebrew ? 'he' : 'en'] || eventType;
  const detectedText = `${topLabel} ${(topConfidence * 100).toFixed(0)}%`;
  const summaryText = aiSummary || (isHebrew ? 'אין סיכום זמין' : 'No summary available');

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
            code: isHebrew ? 'he' : 'en_US',
          },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: alertLevel },      // {{1}} Alert level (with reminder)
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
                { type: 'text', text: eventId },
              ],
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
  }

  console.log('[WhatsApp Reminder] Message sent to:', phoneNumber);
}
