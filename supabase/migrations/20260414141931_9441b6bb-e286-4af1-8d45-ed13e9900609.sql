
CREATE TABLE public.device_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  agent_version TEXT NOT NULL DEFAULT '0.0.0',
  uptime_seconds INTEGER NOT NULL DEFAULT 0,
  monitoring_active BOOLEAN NOT NULL DEFAULT false,
  camera_status TEXT NOT NULL DEFAULT 'unknown',
  motion_detector_status TEXT NOT NULL DEFAULT 'unknown',
  sound_detector_status TEXT NOT NULL DEFAULT 'unknown',
  system_info JSONB DEFAULT '{}'::jsonb,
  recent_errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (device_id)
);

ALTER TABLE public.device_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow edge functions to manage diagnostics"
  ON public.device_diagnostics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Device owners can read diagnostics"
  ON public.device_diagnostics
  FOR SELECT
  TO anon, authenticated
  USING (
    device_id IN (
      SELECT d.id FROM public.devices d
    )
  );

CREATE TRIGGER update_device_diagnostics_updated_at
  BEFORE UPDATE ON public.device_diagnostics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
