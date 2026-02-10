-- Force update the current monitoring_config record to 60000ms debounce
UPDATE public.monitoring_config
SET config = jsonb_set(config, '{sensors,motion,debounce_ms}', '60000'::jsonb),
    updated_at = now()
WHERE device_id = '9b4d46ac-5d00-4867-ba92-1ffdae2b5052';