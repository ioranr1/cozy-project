/**
 * Away Mode i18n Strings
 * ======================
 * 
 * VERSION: 1.2.0 (2026-02-15)
 * 
 * All translatable strings for Away Mode UI and notifications.
 * Supports: English (en), Hebrew (he)
 */

const AWAY_MODE_STRINGS = {
  en: {
    // Notifications
    awayModeEnabled: 'Away Mode activated - Camera ready',
    awayModeDisabled: 'Away Mode deactivated',
    awayModePreflightFailed: 'Cannot activate Away Mode',
    
    // User Returned Modal
    userReturnedTitle: 'Welcome Back',
    userReturnedMessage: 'You have returned. Would you like to disable Away Mode?',
    disableButton: 'Disable Away Mode',
    keepButton: 'Keep Away Mode',
    
    // Preflight Errors
    powerRequired: 'Please connect to power source',
    cameraRequired: 'Camera not available',
    
    // Tray Status (ASCII only - no emojis for Windows CMD compatibility)
    trayStatusAway: '[HOME] AWAY',
    trayStatusNormal: '[LOC] NORMAL',
  },
  
  he: {
    // Notifications (ASCII only - Windows CMD cannot render Hebrew/Unicode)
    awayModeEnabled: 'Away Mode activated - Camera ready',
    awayModeDisabled: 'Away Mode deactivated',
    awayModePreflightFailed: 'Cannot activate Away Mode',
    
    // User Returned Modal
    userReturnedTitle: 'Welcome Back',
    userReturnedMessage: 'You have returned. Disable Away Mode?',
    disableButton: 'Disable Away Mode',
    keepButton: 'Keep Away Mode',
    
    // Preflight Errors
    powerRequired: 'Connect to power',
    cameraRequired: 'Camera not available',
    
    // Tray Status (ASCII only - Windows CMD cannot render Hebrew/Unicode)
    trayStatusAway: '[HOME] AWAY',
    trayStatusNormal: '[LOC] NORMAL',
  }
};

/**
 * Get translated string
 * @param {string} key - String key
 * @param {string} lang - Language code ('en' | 'he')
 * @returns {string} Translated string
 */
function getAwayString(key, lang = 'en') {
  return AWAY_MODE_STRINGS[lang]?.[key] || AWAY_MODE_STRINGS['en'][key] || key;
}

/**
 * Get all strings for a language (for passing to renderer)
 * @param {string} lang - Language code ('en' | 'he')
 * @returns {object} All strings for the language
 */
function getAwayStrings(lang = 'en') {
  return AWAY_MODE_STRINGS[lang] || AWAY_MODE_STRINGS['en'];
}

module.exports = {
  AWAY_MODE_STRINGS,
  getAwayString,
  getAwayStrings
};
