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
        description: 'קבל התראות מיידיות כשמזוהה תנועה',
      },
      cloudStorage: {
        title: 'אחסון בענן',
        description: 'שמור הקלטות באופן מאובטח בענן',
      },
      multiDevice: {
        title: 'ריבוי מכשירים',
        description: 'חבר כמה מכשירים ושלוט בהם ממקום אחד',
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
      statusActive: 'פעיל',
      statusInactive: 'כבוי',
      statusPending: 'ממתין...',
      activeMessage: 'מצב Away פעיל - המחשב יישאר ער',
      activatedToast: '🏠 מצב Away הופעל!',
      deactivatedToast: '🔌 מצב Away כבוי',
      sendingCommand: 'שולח פקודה...',
      waitingAck: 'ממתין לאישור...',
      commandSuccess: 'הפקודה התקבלה',
      commandFailed: 'הפקודה נכשלה',
      preflightFailed: 'המחשב לא עמד בדרישות (חשמל/מצלמה)',
      noDevice: 'לא נבחר מכשיר',
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
        title: 'Multi-Device',
        description: 'Connect multiple devices and control them from one place',
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
      statusActive: 'Active',
      statusInactive: 'Inactive',
      statusPending: 'Pending...',
      activeMessage: 'Away mode active - Computer will stay awake',
      activatedToast: '🏠 Away Mode Activated!',
      deactivatedToast: '🔌 Away Mode Deactivated',
      sendingCommand: 'Sending command...',
      waitingAck: 'Waiting for ACK...',
      commandSuccess: 'Command acknowledged',
      commandFailed: 'Command failed',
      preflightFailed: 'Computer failed preflight checks (power/camera)',
      noDevice: 'No device selected',
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
