-- Mark the pending event as reminder_sent to unblock new notifications
-- This is a one-time data fix for the stuck event
UPDATE public.monitoring_events 
SET reminder_sent = true, 
    reminder_sent_at = now()
WHERE id = '4a032579-89e6-4931-9525-622b40ccd40d';