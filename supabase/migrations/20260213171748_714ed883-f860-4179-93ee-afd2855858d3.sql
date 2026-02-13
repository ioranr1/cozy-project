-- Add baby_monitor_enabled flag to device_status
ALTER TABLE public.device_status 
ADD COLUMN baby_monitor_enabled boolean NOT NULL DEFAULT false;