/**
 * Monitoring Configuration Defaults & Schemas
 * ============================================
 * VERSION: 0.2.0 (2026-02-08)
 * 
 * CHANGELOG:
 * - v0.2.0: Added per-category sound policies (informational/disturbance/security)
 *           Per-label thresholds, persistence, debounce, and severity
 * - v0.1.0: Initial configuration with flat defaults
 * 
 * Default configurations and validation schemas for monitoring sensors.
 * Designed for easy extension with new sensor types.
 */

// =============================================================================
// SOUND CATEGORY POLICIES
// =============================================================================

/**
 * Per-label sound detection policies.
 * The detector applies these automatically - users only pick which sounds to detect.
 */
const SOUND_LABEL_POLICIES = {
  // ── A) Informational / Family (non-security) ──────────────────────────────
  baby_crying: {
    category: 'informational',
    event_type: 'sound_baby_cry',
    threshold: 0.60,
    persistence: 3,       // consecutive windows required
    debounce_ms: 180000,  // 3 minutes
    severity: 'info',
    whatsapp_default: false, // WhatsApp only if user explicitly enables
  },

  // ── B) Disturbance (home noises) ───────────────────────────────────────────
  door_knock: {
    category: 'disturbance',
    event_type: 'sound_disturbance',
    threshold: 0.50,
    persistence: 2,
    debounce_ms: 60000,   // 1 minute
    severity: 'medium',
    whatsapp_default: false,
  },
  dog_barking: {
    category: 'disturbance',
    event_type: 'sound_disturbance',
    threshold: 0.50,
    persistence: 2,
    debounce_ms: 120000,  // 2 minutes
    severity: 'medium',
    whatsapp_default: false,
  },
  scream: {
    category: 'disturbance',
    event_type: 'sound_disturbance',
    threshold: 0.45,
    persistence: 2,
    debounce_ms: 60000,
    severity: 'medium',
    whatsapp_default: false,
  },

  // ── C) Security ────────────────────────────────────────────────────────────
  glass_breaking: {
    category: 'security',
    event_type: 'sound',
    threshold: 0.45,
    persistence: 1,
    debounce_ms: 30000,
    severity: 'high',
    whatsapp_default: true,
  },
  alarm: {
    category: 'security',
    event_type: 'sound',
    threshold: 0.50,
    persistence: 1,
    debounce_ms: 30000,
    severity: 'high',
    whatsapp_default: true,
  },
  gunshot: {
    category: 'security',
    event_type: 'sound',
    threshold: 0.40,
    persistence: 1,
    debounce_ms: 30000,
    severity: 'critical',
    whatsapp_default: true,
  },
  siren: {
    category: 'security',
    event_type: 'sound',
    threshold: 0.50,
    persistence: 1,
    debounce_ms: 60000,
    severity: 'high',
    whatsapp_default: true,
  },
};

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
  model: 'efficientdet_lite0',
  max_results: 5,
  score_threshold: 0.5,
};

/**
 * Default configuration for sound detection sensor
 */
const SOUND_SENSOR_DEFAULTS = {
  enabled: false,
  targets: ['glass_breaking', 'alarm', 'gunshot', 'scream', 'siren'],
  // Global fallback (overridden by per-label policies)
  confidence_threshold: 0.5,
  debounce_ms: 60000,
  // YAMNet specific settings
  sample_rate: 16000,
  frame_length_ms: 960,
  // RMS gate: skip near-silence frames
  rms_threshold: 0.01,
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
  notification_cooldown_ms: 60000,
  event_retention_days: 30,
  ai_validation_enabled: false,
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
 */
const SOUND_LABELS = [
  { id: 'glass_breaking', name_en: 'Glass Breaking', name_he: 'שבירת זכוכית', yamnet_ids: [441, 442], category: 'security' },
  { id: 'baby_crying', name_en: 'Baby Crying', name_he: 'בכי תינוק', yamnet_ids: [22, 23, 24], category: 'informational' },
  { id: 'dog_barking', name_en: 'Dog Barking', name_he: 'נביחת כלב', yamnet_ids: [67], category: 'disturbance' },
  { id: 'alarm', name_en: 'Alarm', name_he: 'אזעקה', yamnet_ids: [389, 390, 391, 392], category: 'security' },
  { id: 'gunshot', name_en: 'Gunshot', name_he: 'ירי', yamnet_ids: [427, 428, 429], category: 'security' },
  { id: 'scream', name_en: 'Scream', name_he: 'צעקה', yamnet_ids: [20], category: 'disturbance' },
  { id: 'door_knock', name_en: 'Door Knock', name_he: 'דפיקה בדלת', yamnet_ids: [321], category: 'disturbance' },
  { id: 'siren', name_en: 'Siren', name_he: 'צופר/סירנה', yamnet_ids: [396, 397], category: 'security' },
];

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

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

function mergeWithDefaults(partialConfig = {}) {
  return {
    monitoring_enabled: partialConfig.monitoring_enabled ?? DEFAULT_MONITORING_CONFIG.monitoring_enabled,
    baby_monitor_enabled: partialConfig.baby_monitor_enabled ?? false,
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

/**
 * Get the policy for a specific sound label.
 * Falls back to security defaults if label not found.
 */
function getSoundLabelPolicy(label) {
  return SOUND_LABEL_POLICIES[label] || {
    category: 'security',
    event_type: 'sound',
    threshold: 0.50,
    persistence: 1,
    debounce_ms: 60000,
    severity: 'medium',
    whatsapp_default: true,
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
  
  // Per-label policies
  SOUND_LABEL_POLICIES,
  
  // Labels
  MOTION_LABELS,
  SOUND_LABELS,
  
  // Helpers
  validateSensorConfig,
  mergeWithDefaults,
  getSoundLabelPolicy,
};
