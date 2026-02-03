import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  console.log("[Webhook] Request received:", req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

  // GET = Webhook verification (Meta subscription)
  if (req.method === "GET") {
    // Parse URL and extract query parameters
    const url = new URL(req.url);
    
    // Log all query params for debugging
    console.log("[Webhook] Full URL:", req.url);
    console.log("[Webhook] All query params:", Object.fromEntries(url.searchParams.entries()));
    
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    console.log("[Webhook] Verification request:", { 
      mode, 
      token, 
      challenge: challenge?.substring(0, 20),
      expectedToken: VERIFY_TOKEN?.substring(0, 10) + "..." 
    });

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[Webhook] Verification SUCCESS - returning challenge");
      // Return ONLY the challenge as plain text, no headers that might cause issues
      return new Response(challenge!, { 
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    console.log("[Webhook] Verification FAILED - mode:", mode, "token match:", token === VERIFY_TOKEN);
    return new Response("Forbidden", { status: 403 });
  }

  // POST = Incoming webhook events from Meta
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("[Webhook] Received POST:", JSON.stringify(body, null, 2));

      // Extract status updates from the webhook payload
      const entries = body?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          const statuses = change?.value?.statuses || [];
          
          for (const status of statuses) {
            const messageId = status?.id; // wamid.xxx
            const statusValue = status?.status; // sent, delivered, read, failed
            const timestamp = status?.timestamp;
            const recipientId = status?.recipient_id;
            const errors = status?.errors;

            console.log("[Webhook] Status update:", {
              messageId,
              status: statusValue,
              timestamp,
              recipientId,
              errors: errors ? JSON.stringify(errors) : null
            });

            // Update database with delivery status
            if (messageId && statusValue) {
              const supabase = createClient(
                Deno.env.get("SUPABASE_URL")!,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
              );

              // Find event by message_id in metadata and update delivery status
              const { data: events, error: findError } = await supabase
                .from("monitoring_events")
                .select("id, metadata")
                .filter("metadata->whatsapp->message_id", "eq", messageId)
                .limit(1);

              if (findError) {
                console.error("[Webhook] Error finding event:", findError);
                continue;
              }

              if (events && events.length > 0) {
                const event = events[0];
                const currentMetadata = event.metadata || {};
                const whatsappMeta = currentMetadata.whatsapp || {};

                // Add delivery status to metadata
                const updatedMetadata = {
                  ...currentMetadata,
                  whatsapp: {
                    ...whatsappMeta,
                    delivery_status: statusValue,
                    delivery_timestamp: timestamp,
                    delivery_errors: errors || null,
                    webhook_received_at: new Date().toISOString()
                  }
                };

                const { error: updateError } = await supabase
                  .from("monitoring_events")
                  .update({ metadata: updatedMetadata })
                  .eq("id", event.id);

                if (updateError) {
                  console.error("[Webhook] Error updating event:", updateError);
                } else {
                  console.log("[Webhook] Updated event", event.id, "with status:", statusValue);
                }
              } else {
                console.log("[Webhook] No event found for message_id:", messageId);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (error) {
      console.error("[Webhook] Error processing POST:", error);
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
