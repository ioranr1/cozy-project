-- Add fields for notification reminder tracking
ALTER TABLE public.monitoring_events
ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS viewed_at timestamp with time zone;

-- Add index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_monitoring_events_reminder_pending
ON public.monitoring_events (notification_sent, reminder_sent, notification_sent_at)
WHERE notification_sent = true AND reminder_sent = false AND viewed_at IS NULL;