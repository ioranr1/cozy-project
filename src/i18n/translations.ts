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
      readMore: 'קרא עוד',
      detailPage: {
        title: 'תכונות מתקדמות',
        subtitle: 'הכירו את כל היכולות של AIGuard24',
        backToHome: 'חזרה לדף הבית',
        liveStream: {
          title: 'שידור חי',
          description: 'צפו בזמן אמת במה שקורה בבית או במשרד שלכם, מכל מקום בעולם. השידור החי מאפשר לכם לפקח על הנעשה בכל רגע נתון, ישירות מהטלפון הנייד שלכם.',
          bullets: ['שידור בזמן אמת באיכות גבוהה', 'צפייה מכל מקום בעולם', 'ממשק פשוט ונוח לשימוש'],
        },
        motionDetection: {
          title: 'זיהוי תנועה',
          description: 'המערכת מזהה תנועה של בני אדם ושולחת לכם התראה מיידית ישירות לוואטסאפ. כך תדעו בזמן אמת על כל פעילות חשודה.',
          bullets: ['זיהוי תנועת אדם בלבד באמצעות AI (מפחית התראות שווא)', 'התראות מיידיות בוואטסאפ', 'תמונת מצב (snapshot) של הארוע'],
        },
        audioMonitoring: {
          title: 'ניטור קול',
          description: 'האזינו למתרחש גם כשהמצלמה כבויה. מושלם לשימוש כבייבי מוניטור או לניטור כללי של הסביבה.',
          bullets: ['האזנה בזמן אמת', 'מושלם כבייבי מוניטור', 'עובד גם ללא שידור וידאו'],
        },
        eventStorage: {
          title: 'שמירת ארועים',
          description: 'כל ארוע שמזוהה נשמר באופן מאובטח. ההקלטות נשמרות במחשב האישי שלכם ( ראה תקייה במסך הבית של המחשב ) ותמונות ההתראה נשמרות בענן לגישה נוחה.',
          bullets: ['הקלטה מאוחסנת מקומית בתיקיה במחשב בדף הבית', 'תמונות התראה בענן', 'גישה נוחה להיסטוריית ארועים באפליקציה'],
        },
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
          title: 'צימוד מצלמת הלפטופ לאפליקאציה',
          description: 'השלבים  לצימוד  המצלמה:',
          details: [
            '​בדשבורד לחץ על כפתור "מכשירים" כבתמונה',
            'לחץ על כפתור "+ צימוד מצלמה חדשה" כבתמונה',
            '​העתק את הקוד כבתמונה ( חד פעמי ) ',
            'לחץ על האיקון בסרגל המשימות, הדבק הקוד ותתחבר כבתמונה',
            'זהו, המצלמה מחוברת - נא הקפד לא לסגור את הלפטופ. המסך יכבה על פי ההגדרות הקודמות שלך אבל המערכת תעבוד ברקע. עבור לשלב 4 בכדי לבדוק ולהפעיל',
          ],
        },
        connect: {
          title: 'חיבור וצפייה מהטלפון הנייד ',
          description: 'התחבר מהטלפון שלך וצפה בשידור חי',
          details: [
            'כנס מהטלפון הנייד  ל https://aiguard24.com  ',
            'התחבר עם אותו חשבון , קבל קוד אימות בוואטסאפ ואתה יכול להתחיל לצפות',
            'כדי שהאיקון של האפליקאציה יופעי באופן קבוע על מסך הבית שלך  בצעה "הוסף לדף הבית" ( אין צורך להורדה מחנות האפליקאציות ) ',
          ],
        },
        update: {
          title: 'עדכון גרסה',
          description: 'כשגרסה חדשה זמינה, האפליקציה תתריע אוטומטית',
          details: [
            'כאשר יש גרסה חדשה, תג כחול יופיע על האייקון בסרגל המשימות כבתמונה',
            'לחץ קליק ימני על האייקון כבתמונה',
            'לחץ על "Download Update" להורדת הגרסה העדכנית',
            'לאחר ההורדה, לחץ על "Install Update" להתקנה אוטומטית',
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
    // Settings page
    settings: {
      title: 'הגדרות',
      subtitle: 'נהל את ההעדפות והחשבון שלך',
      // Section: General
      general: {
        title: 'כללי',
        appVersion: 'גרסת תוכנה',
        appVersionHint: 'גרסת אפליקציית המחשב (Electron)',
        support: 'צור קשר / תמיכה',
        supportEmail: 'ioranr1@gmail.com',
        supportHint: 'לחץ לשליחת מייל',
      },
      // Section: Account
      account: {
        title: 'חשבון',
        readOnlyNotice: 'פרטי החשבון נקבעים בעת ההרשמה ולא ניתנים לעריכה',
        fullName: 'שם מלא',
        email: 'אימייל',
        phone: 'מספר טלפון',
        language: 'שפה מועדפת',
        languageHe: 'עברית',
        languageEn: 'אנגלית',
        deleteSection: 'אזור מסוכן',
        deleteButton: 'מחק חשבון',
        deleteHint: 'מחיקה מיידית ובלתי הפיכה של כל הנתונים',
      },
      // Section: Plan
      plan: {
        title: 'תוכנית',
        currentPlan: 'התוכנית הנוכחית שלך',
        free: 'חינם',
      },
      // Delete account dialog
      deleteDialog: {
        title: '⚠️ מחיקת חשבון - בלתי הפיכה',
        intro: 'מחיקת החשבון תמחק לצמיתות את כל הפרטים הבאים:',
        item1: 'הפרופיל שלך (שם, מייל, מספר טלפון)',
        item2: 'כל המכשירים המצומדים והגדרות הניטור',
        item3: 'כל היסטוריית האירועים, התמונות והקליפים בענן',
        item4: 'כל הסשנים הפעילים ויש להירשם מחדש מאפס',
        whatsappNote: '📱 כל ההתראות בוואטסאפ הקשורות לחשבון יופסקו מיד.',
        electronTitle: '🖥️ אם התקנת את אפליקציית המחשב (Electron):',
        electronStep1: '1. לחץ קליק ימני על אייקון AIGuard ב-System Tray (שעון)',
        electronStep2: '2. בחר "Unpair Camera" (בטל צימוד מצלמה)',
        electronStep3: '3. הסר את האפליקציה דרך הגדרות Windows / Applications במק',
        electronNote: 'הקליפים המקומיים בתיקיית SecurityClips יישארו במחשב עד שתמחק אותם ידנית.',
        confirmLabel: 'הקלד את המילה',
        confirmWord: 'מחק',
        confirmPlaceholder: 'הקלד "מחק" כדי לאשר',
        cancel: 'ביטול',
        confirmDelete: 'מחק את החשבון שלי',
        deleting: 'מוחק...',
        successTitle: 'החשבון נמחק בהצלחה',
        successDesc: 'מחזיר אותך לדף ההתחברות',
        errorTitle: 'מחיקת החשבון נכשלה',
        errorDesc: 'אנא נסה שוב או צור קשר עם התמיכה',
      },
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
      readMore: 'Read More',
      detailPage: {
        title: 'Advanced Features',
        subtitle: 'Discover all the capabilities of AIGuard24',
        backToHome: 'Back to Home',
        liveStream: {
          title: 'Live Stream',
          description: 'Watch in real-time what\'s happening at your home or office, from anywhere in the world. The live stream lets you monitor everything directly from your mobile phone.',
          bullets: ['High-quality real-time streaming', 'Watch from anywhere in the world', 'Simple and easy-to-use interface'],
        },
        motionDetection: {
          title: 'Motion Detection',
          description: 'The system detects human movement and sends you instant alerts directly to WhatsApp. Stay informed in real-time about any suspicious activity.',
          bullets: ['Human-only motion detection (reduces false alerts)', 'Instant WhatsApp notifications', 'Event snapshot included'],
        },
        audioMonitoring: {
          title: 'Audio Monitoring',
          description: 'Listen to what\'s happening even when the camera is off. Perfect for use as a baby monitor or general environment monitoring.',
          bullets: ['Real-time audio listening', 'Perfect as a baby monitor', 'Works without video streaming'],
        },
        eventStorage: {
          title: 'Event Storage',
          description: 'Every detected event is saved securely. Recordings are stored on your personal computer and alert snapshots are saved in the cloud for easy access.',
          bullets: ['Recording stored locally in a folder on the desktop', 'Alert snapshots in the cloud', 'Easy access to event history in the app'],
        },
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
          title: 'Pairing the Laptop Camera',
          description: 'Register and set up the device as a camera',
          details: [
            'In the dashboard, click on the "Devices" button as in the image',
            'Click on the "+ Pair new camera" button as in the image',
            'Copy the code as in the image (one-time)',
            'Click the icon in the taskbar, paste the code and connect as in the image',
            'That\'s it, the camera is connected - make sure not to close the laptop. The screen will turn off according to your previous settings but the system will work in the background. Go to step 4 to test and activate',
          ],
        },
        connect: {
          title: 'Connect & Watch',
          description: 'Connect from your phone and watch the live stream',
          details: [
            'Go to https://aiguard24.com from your mobile',
            'Log in with the same account',
            'To keep the app icon permanently on your home screen, tap "Add to Home Screen" (no need to download from the app store)',
          ],
        },
        update: {
          title: 'Version Update',
          description: 'When a new version is available, the app will notify you automatically',
          details: [
            'When a new version is available, a blue badge will appear on the taskbar icon as shown',
            'Right-click the icon as shown',
            'Click "Download Update" to download the latest version',
            'After downloading, click "Install Update" to install automatically',
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
    // Settings page
    settings: {
      title: 'Settings',
      subtitle: 'Manage your preferences and account',
      general: {
        title: 'General',
        appVersion: 'App Version',
        appVersionHint: 'Desktop application (Electron) version',
        support: 'Contact / Support',
        supportEmail: 'ioranr1@gmail.com',
        supportHint: 'Click to send an email',
      },
      account: {
        title: 'Account',
        readOnlyNotice: 'Account details are set during registration and cannot be edited',
        fullName: 'Full Name',
        email: 'Email',
        phone: 'Phone Number',
        language: 'Preferred Language',
        languageHe: 'Hebrew',
        languageEn: 'English',
        deleteSection: 'Danger Zone',
        deleteButton: 'Delete Account',
        deleteHint: 'Immediate and irreversible deletion of all data',
      },
      plan: {
        title: 'Plan',
        currentPlan: 'Your current plan',
        free: 'Free',
      },
      deleteDialog: {
        title: '⚠️ Delete Account - Irreversible',
        intro: 'Deleting your account will permanently remove all of the following:',
        item1: 'Your profile (name, email, phone number)',
        item2: 'All paired devices and monitoring settings',
        item3: 'All event history, snapshots, and clips in the cloud',
        item4: 'All active sessions — you will need to register from scratch',
        whatsappNote: '📱 All WhatsApp notifications related to this account will stop immediately.',
        electronTitle: '🖥️ If you installed the desktop app (Electron):',
        electronStep1: '1. Right-click the AIGuard icon in the System Tray (clock area)',
        electronStep2: '2. Select "Unpair Camera"',
        electronStep3: '3. Uninstall the app via Windows Settings / Applications on Mac',
        electronNote: 'Local clips in the SecurityClips folder will remain on your computer until you delete them manually.',
        confirmLabel: 'Type the word',
        confirmWord: 'DELETE',
        confirmPlaceholder: 'Type "DELETE" to confirm',
        cancel: 'Cancel',
        confirmDelete: 'Delete my account',
        deleting: 'Deleting...',
        successTitle: 'Account deleted successfully',
        successDesc: 'Returning you to the login page',
        errorTitle: 'Account deletion failed',
        errorDesc: 'Please try again or contact support',
      },
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
