-- Insert monitoring_config for the device
INSERT INTO public.monitoring_config (device_id, profile_id, config) 
VALUES (
  '9b4d46ac-5d00-4867-ba92-1ffdae2b5052',
  '3eee6480-23f2-401b-ab26-72e9ed5b4cf8',
  '{
    "monitoring_enabled": true,
    "ai_validation_enabled": true,
    "notification_cooldown_ms": 60000,
    "event_retention_days": 30,
    "sensors": {
      "motion": {
        "enabled": true,
        "targets": ["person", "animal", "vehicle"],
        "confidence_threshold": 0.6,
        "debounce_ms": 3000
      },
      "sound": {
        "enabled": false,
        "targets": ["glass_breaking", "baby_crying", "alarm", "gunshot", "scream"],
        "confidence_threshold": 0.6,
        "debounce_ms": 2000
      }
    }
  }'::jsonb
)
ON CONFLICT (device_id) DO UPDATE SET 
  config = EXCLUDED.config,
  updated_at = now();