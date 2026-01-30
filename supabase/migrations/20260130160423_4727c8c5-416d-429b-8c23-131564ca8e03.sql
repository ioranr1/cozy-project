-- Add local clip metadata to monitoring_events
ALTER TABLE public.monitoring_events
ADD COLUMN IF NOT EXISTS has_local_clip BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS local_clip_duration_seconds INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS local_clip_filename TEXT DEFAULT NULL;