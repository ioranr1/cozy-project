-- Mark all existing unviewed PRIMARY events as viewed so the system starts fresh
UPDATE public.monitoring_events
SET viewed_at = now()
WHERE notification_sent = true
  AND viewed_at IS NULL
  AND ai_is_real = true;