-- Fix: Mark the blocking event as reminder_sent to unblock new notifications
-- Event dc79e6f7-50a0-4767-86d9-22039cdaff86 is from yesterday and blocking all new alerts
UPDATE public.monitoring_events 
SET reminder_sent = true, 
    reminder_sent_at = now()
WHERE id = 'dc79e6f7-50a0-4767-86d9-22039cdaff86';