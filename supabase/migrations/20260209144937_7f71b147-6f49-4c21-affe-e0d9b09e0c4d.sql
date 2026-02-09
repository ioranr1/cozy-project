-- Update monitoring_config default to reflect simplified sound categories with max sensitivity
ALTER TABLE public.monitoring_config 
ALTER COLUMN config SET DEFAULT '{
  "sensors": {
    "sound": {
      "enabled": false,
      "targets": ["scream"],
      "debounce_ms": 2000,
      "confidence_threshold": 0.25
    },
    "motion": {
      "enabled": true,
      "targets": ["person", "animal", "vehicle"],
      "debounce_ms": 3000,
      "confidence_threshold": 0.7
    }
  },
  "monitoring_enabled": false,
  "ai_validation_enabled": true,
  "notification_cooldown_ms": 60000
}'::jsonb;