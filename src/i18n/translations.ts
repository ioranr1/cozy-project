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
        description: 'קבל התראות מיידיות בוואטסאפ כשמזוהה תנועת אדם',
      },
      cloudStorage: {
        title: 'שמירת ארועים',
        description: 'שומר הקלטות באופן מאובטח במחשב האישי\nואת  תמונת ההתראה בענן  ',
      },
      multiDevice: {
        title: 'ניטור קול',
        description: ' מאפשר להאזין למתרחש כשמצלמה כבויה( למשל : בכי תינוק )',
      },
    },
    // How it works
    howItWorks: {
      title: 'איך זה עובד',
      step1: {
        title: 'התקן את האפליקציה',
        description: 'בלפטופ כנס https://aiguard24.com לאחר רישום ואימות הורד והתקן  את האפליקאציה. ( מותאם ל MAC ול WIN) ',
      },
      step2: {
        title: 'צימוד מצלמה ',
        description: 'בלאפטופ בצעו את ההוראות הפשוטות לאחר ההתקנה (פעם אחת) בכדי לצמד את    המצלמה של הלפטופ  לאפליקאציה',
      },
      step3: {
        title: 'צפה מכל מקום',
        description: 'כנס מטלפון הנייד ל https://aiguard24.com ולאחר רישום ואימות אתה מחובר.\nכדי שהאיקון של האפליקאציה  יופעי באופן קבוע בצעה "הוסף לדף הבית"',
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
    // Installation Guide
    installationGuide: {
      title: 'הוראות התקנה',
      subtitle: 'מדריך שלב אחר שלב להתקנה והפעלה של המערכת',
      backToHome: 'חזרה לדף הבית',
      button: 'הוראות התקנה',
      steps: {
        download: {
          title: 'הורדת האפליקציה',
          description: 'הורד את האפליקציה מהאתר שלנו https://aiguard24.com והרשם באמצעות כפתור "התחל עכשיו " ',
          details: [
            'הכנס שם מלא, אימייל, מספר טלפון נייד וקבל באמצעות וואטסאפ מספר אימות',
            'בדף "לוח הבקרה לחץ על כפתור ההורדה ( זיהוי אוטמטי עבור WIN או MAC ) \n',
            'בחר את הגרסה המתאימה למערכת ההפעלה שלך (Windows)',
            'המתן לסיום ההורדה',
          ],
        },
        install: {
          title: 'התקנה על המחשב',
          description: 'התקן את האפליקציה על המחשב שישמש כמצלמה',
          details: [
            'פתח את קובץ ההתקנה שהורדת',
            'עקוב אחר הוראות ההתקנה',
            'אפשר גישה למצלמה ולמיקרופון כשתתבקש',
          ],
        },
        setup: {
          title: 'הגדרה ורישום',
          description: 'הירשם למערכת והגדר את המכשיר כמצלמה',
          details: [
            'פתח את האפליקציה והירשם עם מספר טלפון',
            'הגדר את המכשיר כמצלמת אבטחה',
            'מקם את המחשב במיקום הרצוי',
          ],
        },
        connect: {
          title: 'חיבור וצפייה',
          description: 'התחבר מהטלפון שלך וצפה בשידור חי',
          details: [
            'פתח את האתר בטלפון הראשי שלך',
            'התחבר עם אותו חשבון',
            'לחץ על צפייה בשידור חי',
          ],
        },
      },
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
        description: 'Get instant alerts via WhatsApp when human motion is detected',
      },
      cloudStorage: {
        title: 'Event Storage',
        description: 'Saves recordings securely on your computer\nand alert snapshots in the cloud',
      },
      multiDevice: {
        title: 'Audio Monitoring',
        description: 'Listen to what\'s happening even when the camera is off (For example: a baby crying)',
      },
    },
    // How it works
    howItWorks: {
      title: 'How It Works',
      step1: {
        title: 'Install the App',
        description: 'On your laptop go to https://aiguard24.com after registration and verification download and install the app. (Compatible with MAC and WIN)',
      },
      step2: {
        title: 'Camera Pairing',
        description: 'On the laptop follow the simple instructions after installation (one time) to pair the laptop camera to the app',
      },
      step3: {
        title: 'Watch from Anywhere',
        description: 'On your mobile go to https://aiguard24.com after registration and verification you are connected.\nTo keep the app icon permanently tap "Add to Home Screen"',
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
    // Installation Guide
    installationGuide: {
      title: 'Installation Guide',
      subtitle: 'Step-by-step guide to install and set up the system',
      backToHome: 'Back to Home',
      button: 'Installation Guide',
      steps: {
        download: {
          title: 'Download the App',
          description: 'Download the application from our website https://aiguard24.com and register using the "Get Started" button',
          details: [
            'Enter full name, email, mobile phone number and receive a verification code via WhatsApp',
            'In the "Control Panel" click the download button (automatic detection for WIN or MAC)',
            'Choose the version for your operating system (Windows)',
            'Wait for the download to complete',
          ],
        },
        install: {
          title: 'Install on Computer',
          description: 'Install the app on the computer that will serve as a camera',
          details: [
            'Open the downloaded installation file',
            'Follow the installation instructions',
            'Allow access to camera and microphone when prompted',
          ],
        },
        setup: {
          title: 'Setup & Registration',
          description: 'Register and set up the device as a camera',
          details: [
            'Open the app and register with your phone number',
            'Set the device as a security camera',
            'Position the computer in the desired location',
          ],
        },
        connect: {
          title: 'Connect & Watch',
          description: 'Connect from your phone and watch the live stream',
          details: [
            'Open the website on your main phone',
            'Log in with the same account',
            'Click to watch the live stream',
          ],
        },
      },
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
