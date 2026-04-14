DROP FUNCTION IF EXISTS public.get_diagnostics_with_profiles();

CREATE OR REPLACE FUNCTION public.get_diagnostics_with_profiles()
RETURNS TABLE(
  id uuid,
  device_id uuid,
  agent_version text,
  uptime_seconds integer,
  monitoring_active boolean,
  camera_status text,
  motion_detector_status text,
  sound_detector_status text,
  system_info jsonb,
  recent_errors jsonb,
  updated_at timestamp with time zone,
  device_name text,
  last_seen_at timestamp with time zone,
  user_full_name text,
  user_phone text,
  user_country_code text,
  device_mode text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    dd.id,
    dd.device_id,
    dd.agent_version,
    dd.uptime_seconds,
    dd.monitoring_active,
    dd.camera_status,
    dd.motion_detector_status,
    dd.sound_detector_status,
    dd.system_info,
    dd.recent_errors,
    dd.updated_at,
    d.device_name,
    d.last_seen_at,
    p.full_name,
    p.phone_number,
    p.country_code,
    ds.device_mode
  FROM device_diagnostics dd
  LEFT JOIN devices d ON d.id = dd.device_id
  LEFT JOIN profiles p ON p.id = d.profile_id
  LEFT JOIN device_status ds ON ds.device_id = dd.device_id
  ORDER BY dd.updated_at DESC;
$$;
