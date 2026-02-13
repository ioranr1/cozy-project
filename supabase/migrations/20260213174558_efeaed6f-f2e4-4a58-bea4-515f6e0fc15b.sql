-- Fix motion debounce from 3 seconds to 60 seconds
UPDATE monitoring_config 
SET config = jsonb_set(config, '{sensors,motion,debounce_ms}', '60000')
WHERE device_id = '9b4d46ac-5d00-4867-ba92-1ffdae2b5052';

-- Also update the default value for new configs to ensure 60s debounce
ALTER TABLE monitoring_config 
ALTER COLUMN config SET DEFAULT '{"sensors": {"sound": {"enabled": false, "targets": ["scream"], "debounce_ms": 2000, "confidence_threshold": 0.25}, "motion": {"enabled": true, "targets": ["person", "animal", "vehicle"], "debounce_ms": 60000, "confidence_threshold": 0.7}}, "monitoring_enabled": false, "ai_validation_enabled": true, "notification_cooldown_ms": 60000}'::jsonb;