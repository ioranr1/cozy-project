-- Add device_mode and security_enabled columns to device_status table
-- These are required for Away Mode functionality

ALTER TABLE public.device_status 
ADD COLUMN IF NOT EXISTS device_mode text NOT NULL DEFAULT 'NORMAL';

ALTER TABLE public.device_status 
ADD COLUMN IF NOT EXISTS security_enabled boolean NOT NULL DEFAULT false;

-- Add a check constraint for valid device_mode values
-- Using a trigger instead of CHECK constraint for flexibility
CREATE OR REPLACE FUNCTION public.validate_device_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.device_mode NOT IN ('NORMAL', 'AWAY') THEN
    RAISE EXCEPTION 'Invalid device_mode value. Must be NORMAL or AWAY';
  END IF;
  
  -- If transitioning to NORMAL, reset security_enabled to false
  IF NEW.device_mode = 'NORMAL' THEN
    NEW.security_enabled := false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for validation
DROP TRIGGER IF EXISTS validate_device_mode_trigger ON public.device_status;
CREATE TRIGGER validate_device_mode_trigger
BEFORE INSERT OR UPDATE ON public.device_status
FOR EACH ROW
EXECUTE FUNCTION public.validate_device_mode();