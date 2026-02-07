
-- Create archived_events table (metadata only, no media)
CREATE TABLE public.archived_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_event_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES public.devices(id),
  event_type text NOT NULL,
  severity text,
  ai_is_real boolean,
  ai_confidence real,
  ai_summary text,
  viewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL,
  archived_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.archived_events ENABLE ROW LEVEL SECURITY;

-- RLS: Device owners can view their archived events
CREATE POLICY "Device owners can view archived events"
ON public.archived_events
FOR SELECT
USING (device_id IN (
  SELECT d.id FROM devices d
  WHERE d.profile_id IN (
    SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
  )
));

-- Anon select for edge functions
CREATE POLICY "anon_select_archived_events"
ON public.archived_events
FOR SELECT
USING (true);

-- Anon insert for edge functions
CREATE POLICY "anon_insert_archived_events"
ON public.archived_events
FOR INSERT
WITH CHECK (true);

-- Anon delete for cleanup
CREATE POLICY "anon_delete_archived_events"
ON public.archived_events
FOR DELETE
USING (true);

-- Also need anon delete on monitoring_events for cleanup
CREATE POLICY "anon_delete_monitoring_events"
ON public.monitoring_events
FOR DELETE
USING (true);

-- Index for fast lookups
CREATE INDEX idx_archived_events_device_id ON public.archived_events(device_id);
CREATE INDEX idx_archived_events_created_at ON public.archived_events(created_at DESC);
CREATE INDEX idx_archived_events_original_event_id ON public.archived_events(original_event_id);
