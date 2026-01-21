-- Create device_status table for remote control
CREATE TABLE public.device_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  is_armed BOOLEAN NOT NULL DEFAULT false,
  last_command TEXT,
  last_command_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_id)
);

-- Enable RLS
ALTER TABLE public.device_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies - device owners can manage their device status
CREATE POLICY "Device owners can view their device status"
ON public.device_status FOR SELECT
USING (device_id IN (
  SELECT d.id FROM devices d
  WHERE d.profile_id IN (
    SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
  )
));

CREATE POLICY "Device owners can update their device status"
ON public.device_status FOR UPDATE
USING (device_id IN (
  SELECT d.id FROM devices d
  WHERE d.profile_id IN (
    SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
  )
));

CREATE POLICY "Device owners can insert their device status"
ON public.device_status FOR INSERT
WITH CHECK (device_id IN (
  SELECT d.id FROM devices d
  WHERE d.profile_id IN (
    SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
  )
));

-- Allow anon access for Electron app to read status
CREATE POLICY "anon_select_device_status"
ON public.device_status FOR SELECT
USING (true);

-- Allow anon to update (for Electron to update last_command acknowledgment)
CREATE POLICY "anon_update_device_status"
ON public.device_status FOR UPDATE
USING (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_status;

-- Create trigger for updated_at
CREATE TRIGGER update_device_status_updated_at
BEFORE UPDATE ON public.device_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial status for existing devices
INSERT INTO public.device_status (device_id, is_armed, last_command)
SELECT id, false, 'STANDBY'
FROM public.devices
ON CONFLICT (device_id) DO NOTHING;