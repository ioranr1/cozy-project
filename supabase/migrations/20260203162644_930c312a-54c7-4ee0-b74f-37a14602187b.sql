-- Fix the throttle logic to allow notifications correctly for motion detection
-- The throttle should ONLY block when:
-- 1. There's a PRIMARY event (notification_sent = true)
-- 2. That event has NOT been viewed (viewed_at IS NULL)
-- 3. AND the reminder has NOT been sent yet (reminder_sent = false)
-- 
-- After the reminder is sent (reminder_sent = true), the cycle is "exhausted"
-- and NEW events should be allowed to trigger a fresh notification cycle.

CREATE OR REPLACE FUNCTION public.acquire_whatsapp_send_slot(p_device_id uuid, p_cooldown_ms integer DEFAULT 60000)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_active_unresolved_event boolean;
BEGIN
  IF p_device_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if there's an ACTIVE unresolved event that should block new notifications
  -- An event is "active" if:
  -- 1. notification_sent = true (first notification was sent)
  -- 2. viewed_at IS NULL (user hasn't clicked the link)
  -- 3. reminder_sent = false (we haven't sent the second message yet)
  -- 
  -- Once reminder_sent = true, the cycle is "exhausted" and we allow new events
  -- to start a fresh notification cycle.
  SELECT EXISTS (
    SELECT 1
    FROM public.monitoring_events
    WHERE device_id = p_device_id
      AND notification_sent = true
      AND viewed_at IS NULL
      AND reminder_sent = false
      AND ai_is_real = true
      AND created_at > now() - interval '24 hours'
  ) INTO v_active_unresolved_event;

  IF v_active_unresolved_event THEN
    -- There's an active event waiting for either:
    -- a) User to click the link (which resets the cycle)
    -- b) Reminder to be sent (after 1 minute)
    -- Block new PRIMARY notifications during this window
    RETURN false;
  END IF;

  -- No active unresolved events - allow this to be a new PRIMARY notification
  -- This covers:
  -- 1. No previous events at all
  -- 2. Previous event was viewed (viewed_at IS NOT NULL)
  -- 3. Previous event's reminder was already sent (reminder_sent = true)
  RETURN true;
END;
$function$;