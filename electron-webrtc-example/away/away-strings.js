/**
 * Away Mode i18n Strings
 * ======================
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
    
    // Tray Status
    trayStatusAway: '🏠 AWAY',
    trayStatusNormal: '📍 NORMAL',
  },
  
  he: {
    // Notifications
    awayModeEnabled: 'מצב מרוחק הופעל - המצלמה מוכנה',
    awayModeDisabled: 'מצב מרוחק כובה',
    awayModePreflightFailed: 'לא ניתן להפעיל מצב מרוחק',
    
    // User Returned Modal
    userReturnedTitle: 'ברוך שובך',
    userReturnedMessage: 'חזרת הביתה. האם לכבות את מצב מרוחק?',
    disableButton: 'כבה מצב מרוחק',
    keepButton: 'השאר מצב מרוחק',
    
    // Preflight Errors
    powerRequired: 'יש לחבר למקור חשמל',
    cameraRequired: 'המצלמה לא זמינה',
    
    // Tray Status
    trayStatusAway: '🏠 מרוחק',
    trayStatusNormal: '📍 רגיל',
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
