-- Update existing monitoring_config records: set motion debounce to 60s
UPDATE public.monitoring_config
SET config = jsonb_set(config, '{sensors,motion,debounce_ms}', '60000'::jsonb),
    updated_at = now();

-- Update the column default so new devices also get 60s
ALTER TABLE public.monitoring_config
ALTER COLUMN config SET DEFAULT '{"sensors": {"sound": {"enabled": false, "targets": ["scream"], "debounce_ms": 2000, "confidence_threshold": 0.25}, "motion": {"enabled": true, "targets": ["person", "animal", "vehicle"], "debounce_ms": 60000, "confidence_threshold": 0.7}}, "monitoring_enabled": false, "ai_validation_enabled": true, "notification_cooldown_ms": 60000}'::jsonb;