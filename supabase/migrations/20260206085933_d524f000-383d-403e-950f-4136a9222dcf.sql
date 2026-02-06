
-- Fix acquire_whatsapp_send_slot to block notifications until user views the event
-- Previously: Allowed new notifications after reminder was sent (reminder_sent=true)
-- Fixed: Block until user clicks the link (viewed_at IS NOT NULL)

CREATE OR REPLACE FUNCTION public.acquire_whatsapp_send_slot(p_device_id uuid, p_cooldown_ms integer DEFAULT 60000)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unviewed_notified_event boolean;
BEGIN
  IF p_device_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if there's ANY unviewed event that already had a notification sent.
  -- This blocks ALL new notifications until the user clicks the link.
  -- 
  -- The cycle is:
  -- 1. Event detected → PRIMARY notification sent (notification_sent=true)
  -- 2. 2 minutes later → REMINDER sent (reminder_sent=true)
  -- 3. User clicks link → viewed_at is set → CYCLE RESETS
  --
  -- Until step 3 happens, NO new notifications are allowed.
  SELECT EXISTS (
    SELECT 1
    FROM public.monitoring_events
    WHERE device_id = p_device_id
      AND notification_sent = true
      AND viewed_at IS NULL
      AND ai_is_real = true
      AND created_at > now() - interval '24 hours'
  ) INTO v_unviewed_notified_event;

  IF v_unviewed_notified_event THEN
    -- There's an unviewed event - block new notifications
    -- User must click the WhatsApp link to reset the cycle
    RETURN false;
  END IF;

  -- No unviewed notified events - allow new notifications
  RETURN true;
END;
$function$;
