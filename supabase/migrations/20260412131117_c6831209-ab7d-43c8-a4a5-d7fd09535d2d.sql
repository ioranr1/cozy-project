-- Trigger: auto-create device_status when a new device is inserted
CREATE OR REPLACE FUNCTION public.create_device_status_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.device_status (device_id, device_mode, is_armed, security_enabled, motion_enabled, sound_enabled, baby_monitor_enabled)
  VALUES (NEW.id, 'NORMAL', false, false, false, false, false)
  ON CONFLICT (device_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_device_status ON public.devices;
CREATE TRIGGER trg_create_device_status
  AFTER INSERT ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.create_device_status_on_insert();

-- Fix: insert missing device_status for existing device
INSERT INTO public.device_status (device_id, device_mode, is_armed, security_enabled, motion_enabled, sound_enabled, baby_monitor_enabled)
SELECT d.id, 'NORMAL', false, false, false, false, false
FROM public.devices d
LEFT JOIN public.device_status ds ON ds.device_id = d.id
WHERE ds.device_id IS NULL;