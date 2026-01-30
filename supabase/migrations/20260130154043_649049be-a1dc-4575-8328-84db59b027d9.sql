-- Add motion and sound detection columns to device_status
ALTER TABLE public.device_status
ADD COLUMN motion_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN sound_enabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.device_status.motion_enabled IS 'Whether motion detection is active during monitoring';
COMMENT ON COLUMN public.device_status.sound_enabled IS 'Whether sound detection is active during monitoring';

-- Update the validate_device_mode trigger to also reset monitoring flags when going to NORMAL
CREATE OR REPLACE FUNCTION public.validate_device_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.device_mode NOT IN ('NORMAL', 'AWAY') THEN
    RAISE EXCEPTION 'Invalid device_mode value. Must be NORMAL or AWAY';
  END IF;
  
  -- If transitioning to NORMAL, reset all monitoring flags
  IF NEW.device_mode = 'NORMAL' THEN
    NEW.security_enabled := false;
    NEW.motion_enabled := true;  -- Reset to default for next activation
    NEW.sound_enabled := false;  -- Reset to default for next activation
    NEW.is_armed := false;       -- Also disarm
  END IF;
  
  RETURN NEW;
END;
$function$;