-- =============================================================================
-- MONITORING SYSTEM TABLES
-- =============================================================================

-- 1. monitoring_config: Per-device sensor configuration (JSONB for flexibility)
CREATE TABLE public.monitoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL UNIQUE REFERENCES public.devices(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- JSONB config for easy extension
  config JSONB NOT NULL DEFAULT '{
    "monitoring_enabled": false,
    "sensors": {
      "motion": {
        "enabled": true,
        "targets": ["person", "animal", "vehicle"],
        "confidence_threshold": 0.7,
        "debounce_ms": 3000
      },
      "sound": {
        "enabled": false,
        "targets": ["glass_breaking", "baby_crying", "alarm", "gunshot", "scream"],
        "confidence_threshold": 0.6,
        "debounce_ms": 2000
      }
    },
    "notification_cooldown_ms": 60000,
    "ai_validation_enabled": true
  }'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. monitoring_events: Event log with AI validation results
CREATE TABLE public.monitoring_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  
  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN ('motion', 'sound')),
  labels JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {label, confidence}
  snapshot_url TEXT, -- URL to storage bucket (for motion events)
  
  -- AI validation results
  ai_validated BOOLEAN DEFAULT NULL, -- NULL = not validated yet
  ai_is_real BOOLEAN DEFAULT NULL, -- TRUE = real event, FALSE = false positive
  ai_summary TEXT, -- AI explanation
  ai_confidence REAL, -- AI confidence score
  ai_validated_at TIMESTAMPTZ,
  
  -- Notification status
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  notification_type TEXT, -- 'push', 'whatsapp', 'both'
  
  -- Metadata
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_monitoring_events_device_id ON public.monitoring_events(device_id);
CREATE INDEX idx_monitoring_events_created_at ON public.monitoring_events(created_at DESC);
CREATE INDEX idx_monitoring_events_event_type ON public.monitoring_events(event_type);
CREATE INDEX idx_monitoring_events_ai_is_real ON public.monitoring_events(ai_is_real) WHERE ai_is_real = true;
CREATE INDEX idx_monitoring_config_device_id ON public.monitoring_config(device_id);

-- Enable RLS
ALTER TABLE public.monitoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for monitoring_config
CREATE POLICY "Device owners can view their monitoring config"
  ON public.monitoring_config FOR SELECT
  USING (device_id IN (
    SELECT d.id FROM devices d 
    WHERE d.profile_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  ));

CREATE POLICY "Device owners can insert their monitoring config"
  ON public.monitoring_config FOR INSERT
  WITH CHECK (device_id IN (
    SELECT d.id FROM devices d 
    WHERE d.profile_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  ));

CREATE POLICY "Device owners can update their monitoring config"
  ON public.monitoring_config FOR UPDATE
  USING (device_id IN (
    SELECT d.id FROM devices d 
    WHERE d.profile_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  ));

-- Anon policies for Electron agent access (uses device token, not auth.uid)
CREATE POLICY "anon_select_monitoring_config"
  ON public.monitoring_config FOR SELECT
  USING (true);

CREATE POLICY "anon_update_monitoring_config"
  ON public.monitoring_config FOR UPDATE
  USING (true);

CREATE POLICY "anon_insert_monitoring_config"
  ON public.monitoring_config FOR INSERT
  WITH CHECK (true);

-- RLS Policies for monitoring_events
CREATE POLICY "Device owners can view their monitoring events"
  ON public.monitoring_events FOR SELECT
  USING (device_id IN (
    SELECT d.id FROM devices d 
    WHERE d.profile_id IN (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  ));

-- Anon policies for edge function and Electron access
CREATE POLICY "anon_select_monitoring_events"
  ON public.monitoring_events FOR SELECT
  USING (true);

CREATE POLICY "anon_insert_monitoring_events"
  ON public.monitoring_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anon_update_monitoring_events"
  ON public.monitoring_events FOR UPDATE
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_monitoring_config_updated_at
  BEFORE UPDATE ON public.monitoring_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for event snapshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-snapshots',
  'event-snapshots',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for event-snapshots bucket
CREATE POLICY "Device owners can view their snapshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-snapshots');

CREATE POLICY "Service role can upload snapshots"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-snapshots');

CREATE POLICY "Service role can delete snapshots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-snapshots');