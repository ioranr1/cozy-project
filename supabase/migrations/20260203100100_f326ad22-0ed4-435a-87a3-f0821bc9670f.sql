-- Fix the acquire_whatsapp_send_slot function to implement proper Dual-Alert logic:
-- 1. Only allow sending if there's NO unviewed, notified PRIMARY event
-- 2. If user hasn't clicked the link (viewed_at IS NULL) - block new notifications
-- 3. Cooldown resets ONLY when user views the event

CREATE OR REPLACE FUNCTION public.acquire_whatsapp_send_slot(p_device_id uuid, p_cooldown_ms integer DEFAULT 60000)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_unviewed_primary boolean;
BEGIN
  IF p_device_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if there's an unviewed PRIMARY event (notification_sent = true, viewed_at IS NULL)
  -- If such event exists, block new notifications until user clicks the link
  SELECT EXISTS (
    SELECT 1
    FROM public.monitoring_events
    WHERE device_id = p_device_id
      AND notification_sent = true
      AND viewed_at IS NULL
      AND ai_is_real = true
      AND created_at > now() - interval '24 hours'  -- Only check last 24 hours for performance
  ) INTO v_has_unviewed_primary;

  IF v_has_unviewed_primary THEN
    -- There's already a PRIMARY event that user hasn't viewed yet
    -- Block new notifications - user must click the link first
    RETURN false;
  END IF;

  -- No unviewed PRIMARY events - allow this to be a new PRIMARY
  -- (The reminder logic is handled separately by send-reminder cron job)
  RETURN true;
END;
$function$;