export type Language = 'he' | 'en';

export const translations = {
  he: {
    // Navigation
    nav: {
      home: 'בית',
      features: 'תכונות',
      howItWorks: 'איך זה עובד',
      download: 'הורדה',
      login: 'התחברות',
      register: 'הרשמה',
    },
    // Hero Section
    hero: {
      title: 'הפוך את המחשב הנייד למצלמת אבטחה',
      subtitle: 'השתמש בלפטופ או בטלפון הישן שלך כמצלמת אבטחה חכמה. צפה בשידור חי מכל מקום.',
      cta: 'התחל עכשיו - חינם',
      secondaryCta: 'למד עוד',
    },
    // Features
    features: {
      title: 'תכונות מתקדמות',
      liveStream: {
        title: 'שידור חי',
        description: 'צפה בזמן אמת במה שקורה בבית או במשרד',
      },
      motionDetection: {
        title: 'זיהוי תנועה',
        description: 'קבל התראות מיידיות בוואטסאפ כשמזוהה תנועה',
      },
      cloudStorage: {
        title: 'אחסון בענן',
        description: 'שמור הקלטות באופן מאובטח בענן',
      },
      multiDevice: {
        title: 'ניטור קול',
        description: 'מאפשר להאזין למתרחש כשמצלמה כבויה',
      },
    },
    // How it works
    howItWorks: {
      title: 'איך זה עובד',
      step1: {
        title: 'התקן את האפליקציה',
        description: 'הורד והתקן על הלפטופ או הטלפון הישן',
      },
      step2: {
        title: 'הגדר כמצלמה',
        description: 'בחר את המכשיר כמצלמה ומקם אותו',
      },
      step3: {
        title: 'צפה מכל מקום',
        description: 'השתמש בטלפון הראשי שלך לצפייה בשידור חי',
      },
    },
    // Auth
    auth: {
      login: 'התחברות',
      register: 'הרשמה',
      fullName: 'שם מלא',
      email: 'כתובת אימייל',
      phone: 'מספר טלפון',
      password: 'סיסמה',
      confirmPassword: 'אימות סיסמה',
      forgotPassword: 'שכחת סיסמה?',
      noAccount: 'אין לך חשבון?',
      hasAccount: 'יש לך חשבון?',
      orContinueWith: 'או המשך עם',
      whatsapp: 'WhatsApp',
      submit: 'שלח',
      submitting: 'שולח...',
      selectCountry: 'בחר מדינה',
      phoneExample: 'לדוגמה: 501234567',
    },
    // Footer
    footer: {
      rights: 'כל הזכויות שמורות',
      privacy: 'מדיניות פרטיות',
      terms: 'תנאי שימוש',
    },
    // Common
    common: {
      loading: 'טוען...',
      error: 'שגיאה',
      success: 'הצלחה',
      cancel: 'ביטול',
      save: 'שמור',
      delete: 'מחק',
      edit: 'ערוך',
      back: 'חזור',
      next: 'הבא',
      close: 'סגור',
    },
    // Away Mode
    awayMode: {
      title: 'מצב Away',
      description: 'השאר את המחשב דלוק כשאתה לא בבית',
      descriptionMobile: 'השאר את המחשב דלוק מרחוק',
      requirementPower: 'חייב להיות מחובר לחשמל',
      requirementLid: 'השאר את המכסה פתוח',
      // Status labels
      statusNormal: 'רגיל',
      statusAwayActive: 'Away פעיל',
      statusOffline: 'לא מחובר',
      statusSleeping: 'במצב שינה',
      statusActive: 'פעיל',
      statusInactive: 'כבוי',
      statusPending: 'ממתין...',
      statusUnknown: 'לא ידוע',
      updating: 'מעדכן...',
      // Messages
      activeMessage: 'מצב Away פעיל - המחשב יישאר ער',
      activatedToast: '🏠 מצב Away הופעל!',
      deactivatedToast: '🔌 מצב Away כבוי',
      sendingCommand: 'שולח פקודה...',
      waitingAck: 'ממתין לאישור...',
      commandSuccess: 'הפקודה התקבלה',
      commandFailed: 'הפקודה נכשלה',
      // Error messages - detailed guidance
      preflightFailed: 'המחשב לא עמד בדרישות (חשמל/מצלמה)',
      errorPowerRequired: 'נדרש חיבור לחשמל - חבר את המחשב לחשמל ונסה שוב',
      errorCameraNotAvailable: 'המצלמה לא זמינה - בדוק את החיבור',
      errorKeepLidOpen: 'שמור את המכסה פתוח כדי שהמצלמה תפעל',
      errorDisplayOffFailed: 'לא הצלחנו לכבות את המסך (לא קריטי)',
      errorDeviceOffline: 'המחשב לא מחובר - פתח את האפליקציה במחשב',
      errorDeviceSleeping: 'המחשב במצב שינה - הער אותו במחשב ואז הפעל מצב Away',
      errorTimeout: 'לא התקבלה תשובה - ודא שהמחשב מחובר',
      displayOffNote: 'המסך יכבה אוטומטית (אם נתמך)',
      noDevice: 'לא נבחר מכשיר',
      updateError: 'שגיאה בעדכון מצב Away',
    },
    // Security Mode
    securityMode: {
      title: 'מצב אבטחה',
      comingSoon: 'בקרוב...',
      description: 'זיהוי תנועה וקול אוטומטי כשאתה לא בבית',
      requiresAwayMode: 'דורש הפעלת מצב Away',
      notAvailable: 'מצב אבטחה עדיין לא זמין',
    },
    // Validation
    validation: {
      required: 'שדה חובה',
      invalidEmail: 'כתובת אימייל לא תקינה',
      invalidPhone: 'מספר טלפון לא תקין',
      minLength: 'מינימום {min} תווים',
      maxLength: 'מקסימום {max} תווים',
    },
  },
  en: {
    // Navigation
    nav: {
      home: 'Home',
      features: 'Features',
      howItWorks: 'How it Works',
      download: 'Download',
      login: 'Login',
      register: 'Register',
    },
    // Hero Section
    hero: {
      title: 'Turn Your Laptop Into a Security Camera',
      subtitle: 'Use your laptop or old phone as a smart security camera. Watch live from anywhere.',
      cta: 'Get Started - Free',
      secondaryCta: 'Learn More',
    },
    // Features
    features: {
      title: 'Advanced Features',
      liveStream: {
        title: 'Live Stream',
        description: 'Watch real-time what\'s happening at home or office',
      },
      motionDetection: {
        title: 'Motion Detection',
        description: 'Get instant alerts when motion is detected',
      },
      cloudStorage: {
        title: 'Cloud Storage',
        description: 'Save recordings securely in the cloud',
      },
      multiDevice: {
        title: 'Audio Monitoring',
        description: 'Listen to what\'s happening even when the camera is off',
      },
    },
    // How it works
    howItWorks: {
      title: 'How It Works',
      step1: {
        title: 'Install the App',
        description: 'Download and install on your laptop or old phone',
      },
      step2: {
        title: 'Set as Camera',
        description: 'Choose the device as camera and position it',
      },
      step3: {
        title: 'Watch from Anywhere',
        description: 'Use your main phone to watch the live stream',
      },
    },
    // Auth
    auth: {
      login: 'Login',
      register: 'Register',
      fullName: 'Full Name',
      email: 'Email Address',
      phone: 'Phone Number',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      forgotPassword: 'Forgot Password?',
      noAccount: 'Don\'t have an account?',
      hasAccount: 'Already have an account?',
      orContinueWith: 'Or continue with',
      whatsapp: 'WhatsApp',
      submit: 'Submit',
      submitting: 'Submitting...',
      selectCountry: 'Select Country',
      phoneExample: 'Example: 501234567',
    },
    // Footer
    footer: {
      rights: 'All rights reserved',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
    },
    // Common
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      back: 'Back',
      next: 'Next',
      close: 'Close',
    },
    // Away Mode
    awayMode: {
      title: 'Away Mode',
      description: 'Keep your computer running while you\'re away',
      descriptionMobile: 'Keep your computer running remotely',
      requirementPower: 'Must be plugged into power',
      requirementLid: 'Keep the lid open',
      // Status labels
      statusNormal: 'Normal',
      statusAwayActive: 'Away Active',
      statusOffline: 'Offline',
      statusSleeping: 'Sleeping',
      statusActive: 'Active',
      statusInactive: 'Inactive',
      statusPending: 'Pending...',
      statusUnknown: 'Unknown',
      updating: 'Updating...',
      // Messages
      activeMessage: 'Away mode active - Computer will stay awake',
      activatedToast: '🏠 Away Mode Activated!',
      deactivatedToast: '🔌 Away Mode Deactivated',
      sendingCommand: 'Sending command...',
      waitingAck: 'Waiting for ACK...',
      commandSuccess: 'Command acknowledged',
      commandFailed: 'Command failed',
      // Error messages - detailed guidance
      preflightFailed: 'Computer failed preflight checks (power/camera)',
      errorPowerRequired: 'Power connection required - plug in your computer and try again',
      errorCameraNotAvailable: 'Camera not available - check connection',
      errorKeepLidOpen: 'Keep the lid open for the camera to work',
      errorDisplayOffFailed: 'Could not turn off display (non-critical)',
      errorDeviceOffline: 'Computer is offline - open the app on your computer',
      errorDeviceSleeping: 'Computer is sleeping - wake it up on the computer, then activate Away Mode',
      errorTimeout: 'No response - ensure computer is connected',
      displayOffNote: 'Display will turn off automatically (if supported)',
      noDevice: 'No device selected',
      updateError: 'Failed to update Away mode',
    },
    // Security Mode
    securityMode: {
      title: 'Security Mode',
      comingSoon: 'Coming Soon...',
      description: 'Automatic motion and sound detection while you\'re away',
      requiresAwayMode: 'Requires Away Mode to be active',
      notAvailable: 'Security mode is not yet available',
    },
    // Validation
    validation: {
      required: 'Required field',
      invalidEmail: 'Invalid email address',
      invalidPhone: 'Invalid phone number',
      minLength: 'Minimum {min} characters',
      maxLength: 'Maximum {max} characters',
    },
  },
};

export const countries = [
  { code: '+972', name: 'ישראל', nameEn: 'Israel', flag: '🇮🇱' },
  { code: '+1', name: 'ארה"ב', nameEn: 'USA', flag: '🇺🇸' },
  { code: '+44', name: 'בריטניה', nameEn: 'UK', flag: '🇬🇧' },
  { code: '+49', name: 'גרמניה', nameEn: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'צרפת', nameEn: 'France', flag: '🇫🇷' },
  { code: '+39', name: 'איטליה', nameEn: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'ספרד', nameEn: 'Spain', flag: '🇪🇸' },
  { code: '+7', name: 'רוסיה', nameEn: 'Russia', flag: '🇷🇺' },
  { code: '+86', name: 'סין', nameEn: 'China', flag: '🇨🇳' },
  { code: '+81', name: 'יפן', nameEn: 'Japan', flag: '🇯🇵' },
  { code: '+91', name: 'הודו', nameEn: 'India', flag: '🇮🇳' },
  { code: '+55', name: 'ברזיל', nameEn: 'Brazil', flag: '🇧🇷' },
  { code: '+61', name: 'אוסטרליה', nameEn: 'Australia', flag: '🇦🇺' },
  { code: '+971', name: 'איחוד האמירויות', nameEn: 'UAE', flag: '🇦🇪' },
];
