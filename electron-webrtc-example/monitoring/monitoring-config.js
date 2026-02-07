/**
 * Monitoring Configuration Defaults & Schemas
 * ============================================
 * VERSION: 0.1.0 (2026-01-30)
 * 
 * Default configurations and validation schemas for monitoring sensors.
 * Designed for easy extension with new sensor types.
 */

// =============================================================================
// DEFAULT SENSOR CONFIGURATIONS
// =============================================================================

/**
 * Default configuration for motion detection sensor
 */
const MOTION_SENSOR_DEFAULTS = {
  enabled: false,
  targets: ['person', 'animal', 'vehicle'],
  confidence_threshold: 0.7,
  debounce_ms: 60000,
  // MediaPipe specific settings
  model: 'efficientdet_lite0', // or 'efficientdet_lite2' for higher accuracy
  max_results: 5,
  score_threshold: 0.5,
};

/**
 * Default configuration for sound detection sensor
 */
const SOUND_SENSOR_DEFAULTS = {
  enabled: false,
  targets: ['glass_breaking', 'baby_crying', 'dog_barking', 'alarm', 'gunshot'],
  confidence_threshold: 0.6,
  debounce_ms: 60000,
  // YAMNet specific settings
  sample_rate: 16000,
  frame_length_ms: 960,
};

/**
 * Combined default monitoring configuration
 */
const DEFAULT_MONITORING_CONFIG = {
  monitoring_enabled: false,
  sensors: {
    motion: { ...MOTION_SENSOR_DEFAULTS },
    sound: { ...SOUND_SENSOR_DEFAULTS },
  },
  // Global settings
  notification_cooldown_ms: 60000, // 1 minute between notifications
  event_retention_days: 30,
  ai_validation_enabled: false, // Future: send events for AI validation
};

// =============================================================================
// SUPPORTED LABELS (for UI dropdowns)
// =============================================================================

/**
 * Motion detection labels supported by MediaPipe
 */
const MOTION_LABELS = [
  { id: 'person', name_en: 'Person', name_he: 'אדם' },
  { id: 'animal', name_en: 'Animal', name_he: 'חיה' },
  { id: 'vehicle', name_en: 'Vehicle', name_he: 'רכב' },
  { id: 'cat', name_en: 'Cat', name_he: 'חתול' },
  { id: 'dog', name_en: 'Dog', name_he: 'כלב' },
  { id: 'bird', name_en: 'Bird', name_he: 'ציפור' },
];

/**
 * Sound detection labels supported by YAMNet
 * Reference: https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv
 */
const SOUND_LABELS = [
  { id: 'glass_breaking', name_en: 'Glass Breaking', name_he: 'שבירת זכוכית', yamnet_ids: [441, 442] },
  { id: 'baby_crying', name_en: 'Baby Crying', name_he: 'בכי תינוק', yamnet_ids: [22] },
  { id: 'dog_barking', name_en: 'Dog Barking', name_he: 'נביחת כלב', yamnet_ids: [67] },
  { id: 'alarm', name_en: 'Alarm', name_he: 'אזעקה', yamnet_ids: [389, 390, 391, 392] },
  { id: 'gunshot', name_en: 'Gunshot', name_he: 'יריות', yamnet_ids: [427, 428, 429] },
  { id: 'scream', name_en: 'Scream', name_he: 'צעקה', yamnet_ids: [20] },
  { id: 'door_knock', name_en: 'Door Knock', name_he: 'דפיקה בדלת', yamnet_ids: [321] },
  { id: 'siren', name_en: 'Siren', name_he: 'צופר/סירנה', yamnet_ids: [396, 397] },
];

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate a sensor configuration object
 * @param {object} config - Sensor config to validate
 * @param {string} sensorType - 'motion' or 'sound'
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSensorConfig(config, sensorType) {
  const errors = [];
  
  if (typeof config.enabled !== 'boolean') {
    errors.push(`${sensorType}.enabled must be a boolean`);
  }
  
  if (!Array.isArray(config.targets)) {
    errors.push(`${sensorType}.targets must be an array`);
  }
  
  if (typeof config.confidence_threshold !== 'number' || 
      config.confidence_threshold < 0 || 
      config.confidence_threshold > 1) {
    errors.push(`${sensorType}.confidence_threshold must be a number between 0 and 1`);
  }
  
  if (typeof config.debounce_ms !== 'number' || config.debounce_ms < 0) {
    errors.push(`${sensorType}.debounce_ms must be a positive number`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Merge partial config with defaults
 * @param {object} partialConfig - User provided config
 * @returns {object} - Complete config with defaults filled in
 */
function mergeWithDefaults(partialConfig = {}) {
  return {
    monitoring_enabled: partialConfig.monitoring_enabled ?? DEFAULT_MONITORING_CONFIG.monitoring_enabled,
    sensors: {
      motion: {
        ...MOTION_SENSOR_DEFAULTS,
        ...(partialConfig.sensors?.motion || {}),
      },
      sound: {
        ...SOUND_SENSOR_DEFAULTS,
        ...(partialConfig.sensors?.sound || {}),
      },
    },
    notification_cooldown_ms: partialConfig.notification_cooldown_ms ?? DEFAULT_MONITORING_CONFIG.notification_cooldown_ms,
    event_retention_days: partialConfig.event_retention_days ?? DEFAULT_MONITORING_CONFIG.event_retention_days,
    ai_validation_enabled: partialConfig.ai_validation_enabled ?? DEFAULT_MONITORING_CONFIG.ai_validation_enabled,
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Defaults
  DEFAULT_MONITORING_CONFIG,
  MOTION_SENSOR_DEFAULTS,
  SOUND_SENSOR_DEFAULTS,
  
  // Labels
  MOTION_LABELS,
  SOUND_LABELS,
  
  // Helpers
  validateSensorConfig,
  mergeWithDefaults,
};
