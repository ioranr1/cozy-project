import React from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

/* -------------------- HEBREW -------------------- */
const PrivacyHe: React.FC = () => (
  <article className="prose prose-slate max-w-none rtl text-right" dir="rtl">
    <h1>מדיניות פרטיות</h1>
    <p><strong>תאריך תחילה:</strong> 01/04/2026</p>

    <p>
      כמוצר אבטחה, AIGuard (להלן גם "אנו", "שלנו" או "אותנו") מתייחסת לנתונים שלכם ברצינות רבה ומחויבת לעשות כל מאמץ
      כדי להבטיח שפרטיותכם תהיה בטוחה ומוגנת. מדיניות פרטיות זו מתארת כיצד אנו אוספים, משתמשים ומעבדים את המידע האישי
      של אנשים המבקרים באתר שלנו ושנרשמים להשתמש ב-AIGuard כמשתמשים. מדיניות זו מתארת גם את הפעולות שתוכלו לנקוט אם יש
      לכם חששות לגבי נהלי הפרטיות שלנו. אנו מתחייבים לאסוף ולעבד את המידע שלכם בהתאם לעקרונות הבאים:
    </p>
    <ol>
      <li>
        אנו נהיה שקופים ככל האפשר, כולל לגבי האופן שבו אנו משתמשים במידע שלכם ועם מי אנו חולקים אותו.
      </li>
      <li>
        אנו נשמור על המידע שלכם בטוח ומאובטח ככל האפשר על ידי יישום אמצעי אבטחה התואמים את תקני התעשייה. נבקש את
        הסכמתכם בכל פעם שיש מידע אישי חדש לאיסוף או לשיתוף.
      </li>
    </ol>
    <p>
      בעצם השימוש שלכם ב-AIGuard, אתם מסכימים לאפשר לנו לאסוף ולעבד את המידע אודותיכם למטרות המתוארות להלן. בשום מקרה
      המוצרים והשירותים שלנו לא יגשו למידע שלכם מבלי לקבל את הסכמתכם תחילה.
    </p>

    <h2>כיצד נאסף המידע וכיצד נעשה בו שימוש</h2>
    <p>
      אנו אוספים מידע אישי מסוים אודותיכם וכן מידע הקשור לחוויית השימוש שלכם במוצרים ובשירותים שלנו. הטבלה שלהלן תסייע
      לכם להבין איזה מידע אנו אוספים וכיצד אנו משתמשים בו:
    </p>

    <div className="overflow-x-auto">
      <table className="w-full border border-slate-300 text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="border border-slate-300 p-2">קטגוריה</th>
            <th className="border border-slate-300 p-2">סוג</th>
            <th className="border border-slate-300 p-2">מקור</th>
            <th className="border border-slate-300 p-2">מטרה</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={5}>פרטי חשבון</td>
            <td className="border border-slate-300 p-2">כתובת דוא"ל</td>
            <td className="border border-slate-300 p-2">המשתמש מספק בתהליך ההרשמה</td>
            <td className="border border-slate-300 p-2">
              <ul className="m-0 pr-4 list-disc">
                <li>שם חשבון המקושר לחשבון מזוהה.</li>
                <li>פרטי קשר של המשתמש לצורך שליחת דוא"ל מערכת ושיווק.</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">מזהה משתמש (User ID)</td>
            <td className="border border-slate-300 p-2">נוצר ע"י המערכת בתהליך ההרשמה</td>
            <td className="border border-slate-300 p-2">מזהה משתמש המקושר לחשבון רשום.</td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">מטרות שימוש</td>
            <td className="border border-slate-300 p-2">המשתמש מספק בתהליך ההרשמה</td>
            <td className="border border-slate-300 p-2">משמש בסטטיסטיקות שימוש.</td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">דוא"ל שבוטלה ההרשמה אליו</td>
            <td className="border border-slate-300 p-2">המשתמש מבטל הרשמה לדיוור</td>
            <td className="border border-slate-300 p-2">הסרה מרשימת התפוצה השיווקית.</td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">שפה</td>
            <td className="border border-slate-300 p-2">מ-API של המכשיר</td>
            <td className="border border-slate-300 p-2">קביעת שפת התצוגה.</td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={2}>מיקום</td>
            <td className="border border-slate-300 p-2">מיקום בעת הרשמה</td>
            <td className="border border-slate-300 p-2">נגזר מכתובת IP</td>
            <td className="border border-slate-300 p-2">
              <ul className="m-0 pr-4 list-disc">
                <li>קביעת ספק שירות ברירת מחדל (שרת API ואחסון).</li>
                <li>שיפור איכות השירות ופתרון תקלות.</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">מיקום התחברות אחרון</td>
            <td className="border border-slate-300 p-2">נגזר מכתובת IP</td>
            <td className="border border-slate-300 p-2">
              <ol className="m-0 pr-4 list-decimal">
                <li>קביעת ספק שירות ברירת מחדל (שרת API ואחסון).</li>
                <li>שיפור איכות השירות ופתרון תקלות.</li>
              </ol>
            </td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={2}>פרטי מכשיר</td>
            <td className="border border-slate-300 p-2">פרטי מכשיר</td>
            <td className="border border-slate-300 p-2">מ-API של המכשיר</td>
            <td className="border border-slate-300 p-2">
              זיהוי מכשיר משויך המשתמש בשירותינו, כגון כתובת MAC, שם דגם, גרסת מערכת הפעלה וכינויי מכשיר.
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">פרטי תשלום של המשתמש</td>
            <td className="border border-slate-300 p-2">מ-Stripe, LLC (רכישה)</td>
            <td className="border border-slate-300 p-2">מידע לעיבוד הזמנת רכישה ובקשות החזר.</td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={3}>מידע וביצועי האפליקציה</td>
            <td className="border border-slate-300 p-2">דיווח מיומן קריסות אפליקציה</td>
            <td className="border border-slate-300 p-2">מ-API של המכשיר</td>
            <td className="border border-slate-300 p-2">
              נתוני יומן קריסות מהאפליקציה, כגון מספר הקריסות, stack traces, או מידע אחר הקשור ישירות לקריסה. משמש
              לשיפור איכות השירות ולפתרון תקלות.
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">דיאגנוסטיקה</td>
            <td className="border border-slate-300 p-2">דיווח מיומן השימוש באפליקציה</td>
            <td className="border border-slate-300 p-2">
              מידע על ביצועי האפליקציה, למשל: חיי סוללה, זמני טעינה, אחזור (latency), קצב פריימים או כל דיאגנוסטיקה
              טכנית. משמש לשיפור איכות השירות ולפתרון תקלות.
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">פרטי האפליקציה</td>
            <td className="border border-slate-300 p-2">דיווח מיומן השימוש באפליקציה</td>
            <td className="border border-slate-300 p-2">
              מידע לאספקת שירותים מתאימים, כגון גרסת אפליקציה והגדרות אפליקציה.
            </td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={2}>פעילות באפליקציה</td>
            <td className="border border-slate-300 p-2">אינטראקציות באפליקציה</td>
            <td className="border border-slate-300 p-2">דיווח מיומן השימוש באפליקציה</td>
            <td className="border border-slate-300 p-2">
              מידע על האופן שבו משתמש מתקשר עם האפליקציה, למשל מספר הביקורים בעמוד או על מה הוא לוחץ. משמש לשיפור איכות
              השירות ולפתרון תקלות.
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">סרטוני אירוע</td>
            <td className="border border-slate-300 p-2">מועלים בעת הקלטת וידאו (מופעל בזיהוי תנועה או ידנית)</td>
            <td className="border border-slate-300 p-2">מידע לעיבוד הזמנת רכישה ובקשות החזר.</td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold">משוב משתמשים</td>
            <td className="border border-slate-300 p-2">משוב</td>
            <td className="border border-slate-300 p-2">נאסף מטופס משוב, סקרים ורשתות חברתיות</td>
            <td className="border border-slate-300 p-2">
              איסוף משוב משתמשים לזיהוי ופתרון בעיות ולמיטוב המוצר שלנו.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p>פירוט נוסף לגבי המידע שאנו אוספים:</p>
    <ul>
      <li>
        סיפוק, פיתוח ושיפור של המוצרים והשירותים עבורכם. לדוגמה, אנו שומרים את הנתונים בשרתינו על מנת לאפשר לכם לשלוח
        תמונות התראה, לשמור תוכן ולשתפו עם אחרים בהסכמתכם.
      </li>
      <li>
        קידום אינטרסים לגיטימיים, לרבות ביצוע מחקר, סיוע בקבלת החלטות עסקיות והתאמה אישית של השירותים על סמך סוגי
        המכשירים בהם אתם משתמשים או הסביבה שבה הוצבו המכשירים.
      </li>
      <li>
        ציות לחובות חוקיות. לדוגמה, ייתכן שנעבד את המידע שלכם בתגובה להליכים משפטיים או לבקשות אכיפת חוק.
      </li>
      <li>תקשורת עמכם, כגון מתן טיפים שימושיים והצעות מיוחדות.</li>
      <li>טיפול בבעיות טכניות שדיווחתם עליהן לשיפור הפונקציונליות והזמינות של השירותים.</li>
      <li>חקירת הפרות אפשריות של תנאי השירות.</li>
      <li>עיבוד ומימוש תביעות והזמנות בקשר למוצרים ולשירותים שלנו ועדכונכם לגבי סטטוס ההזמנה.</li>
    </ul>

    <p>
      ברוב המקרים, הנתונים שאנו משתמשים בהם למטרות מחקר וניתוח מעובדים בצורה לא מזהה, כלומר המידע מעובד באופן אנונימי
      ולעולם לא ישויך אליכם. לדוגמה, אנו עשויים לעקוב אחר מידע מצרפי כגון שיעורי הרשמה ואימות כדי לסייע לנו לעצב עמודי
      כניסה אפקטיביים יותר. ייתכן שנשתמש גם באלגוריתם למידת מכונה לגישה אוטומטית לנתונים ללא הפעלה ידנית, כדי לסייע לנו
      לספק שירותים מותאמים אישית לקבוצות מסוימות. אנו משתמשים במידע כזה כדי להגדיל מכירות, לקבל החלטות שיווקיות ולקדם
      אינטרסים לגיטימיים.
    </p>

    <p>
      עם זאת, אנו עשויים לגשת למידע שלכם בצורה מזהה אישית בנסיבות הבאות: (1) כאשר אתם נתקלים בבעיה טכנית ומבקשים שנטפל
      בה; (2) כאשר אנו חוקרים הפרות אפשריות של תנאי השירות; (3) כאשר עלינו לעמוד בכל חוק, תקנה, הליך משפטי או דרישה
      ממשלתית בת-אכיפה. בכל מקרה כזה, אנו תמיד נבקש את הסכמתכם לפני נקיטת כל פעולה נוספת. כמו כן, עיקרון זה נקבע עבור
      העומדים בתנאי השירות שלנו.
    </p>

    <p>
      אנו עשויים לעבד את המידע על גבי פלטפורמות שמספקים ספקי שירות צד שלישי. למרות שמידע זה משותף עם ספקי השירות לצורך
      אספקת השירותים עבורנו, חל עליהם איסור לשתף אותו לכל מטרה אחרת. אם אינכם מעוניינים שהמידע האישי שלכם ייגש על ידי
      מי מספקי השירות הללו, באפשרותכם לבחור שלא להסכים על ידי פנייה אלינו.
    </p>

    <p>
      אנו מתייחסים לאבטחת הנתונים ברצינות רבה ושומרים על המידע שהושג מכם בטוח ומאובטח בהתאם לתקני התעשייה. המידע האישי
      שלכם מוצפן בעת העברתו לשרתינו על מנת למנוע גישה לא מורשית של צדדים שלישיים או איומים. שימו לב שאנו עשויים לעבד את
      המידע האישי שלכם על שרתים שאינם בהכרח ממוקמים במדינת מגוריכם.
    </p>

    <p>
      המוצרים והשירותים שלנו נועדו להעניק לכם את היכולת לראות, לשמוע ולדבר עם כל אדם דרך מכשיר הניטור שלכם. כדי שמוצרינו
      ושירותינו יפעלו כראוי, אנו אוספים תוכן ומידע קשור הנלכדים ומוקלטים בעת השימוש. לדוגמה, אנו שומרים את האירועים
      שנקלטו על ידי גלאי התנועה בשרתינו על מנת לספק ראיות לזיהוי חשוד. בנוסף, מוצרינו ושירותינו עשויים לאסוף נתונים
      מהסביבה שלהם לצורך ביצוע פונקציות מסוימות (כגון זיהוי תנועה ומסנן אוטומטי לתאורה נמוכה הנדלק אוטומטית בחושך).
    </p>

    <h2>מידע הנאסף אוטומטית</h2>
    <p>
      ייתכן שנשתמש בעוגיות (cookies), יומני שרת אינטרנט, web beacons וטכנולוגיות איסוף מידע אחרות על מנת לקבל מידע
      מסוים שיעזור לנו לזהות אתכם במהירות. סוגי מידע אלה כוללים כתובת IP, מזהים המשויכים למכשיריכם, סוגי המכשירים
      המחוברים לשירותינו, מאפייני דפדפן אינטרנט, מאפייני מכשיר, העדפות שפה, עמודי הפניה/יציאה, נתוני קליקים ותאריכים
      וזמני ביקורים באתר או באפליקציה. טכנולוגיות אלה מסייעות לנו (1) לזהות אתכם ולספור ביקורים באתרינו; (2) לעקוב כיצד
      אתם מתקשרים עם המוצרים והשירותים; (3) להתאים את השירותים על בסיס העדפותיכם; (4) להבין את השימוש במוצרים ואת
      אפקטיביות התקשורת שלנו; ו-(5) לנהל ולשפר את המוצרים והשירותים. עבור משתמשים חינמיים, שותפי הפרסום שלנו עשויים
      לאסוף מידע באמצעים אוטומטיים דרך האפליקציה כדי להציג ולנהל פרסום באפליקציה. לדוגמה, דפוסי השימוש שלכם באפליקציה
      עשויים לשמש כהפניה חשובה עבורם להציע פרסומות מבוססות תחומי עניין. בבטחה - מידע מסוג זה מעובד בצורה לא מזהה ויש להם
      גם כללים מחמירים לעיבוד מידע כזה.
    </p>

    <h2>שיתוף מידע</h2>
    <p>
      לעולם לא נשתף את המידע שלכם לכל מטרה מסחרית או שיווקית שאינה קשורה לאספקת המוצרים והשירותים מבלי לקבל את הסכמתכם
      תחילה. לעולם לא נמכור או נשכיר את רשימת המשתמשים שלנו או כל מידע אחר שעשוי להיות מקושר אליכם. אנו מחויבים למזער את
      חשיפת זהות המשתמשים ועשויים לשתף את המידע האישי שלכם רק במצבים המוגבלים הבאים:
    </p>
    <ul>
      <li>
        אנו עשויים לשתף חלק מהמידע האישי שלכם עם האנשים שאתם מזמינים להצטרף ל"מעגל האמון" (תכונה המאפשרת לכם לשתף את
        המצלמות שלכם עם אחרים). אנשים מורשים אלה ניגשים לנתוני וידאו ושמע הנקלטים והמשודרים במכשיר, וכן למידע על המכשיר
        כגון סטטוס ורמת חשמל. הם גם מורשים ליצור נתונים נוספים (הקלטות).
      </li>
      <li>
        אנו עשויים לעבד את המידע על גבי פלטפורמות שמספקים שותפי צד שלישי. כאמור לעיל, גם אם המידע משותף איתם, חל עליהם
        איסור לחשוף אותו. ניתן לעיין במדיניות הפרטיות שלהם.
      </li>
      <li>
        טכנאים המפקחים על עיבוד הנתונים והאחסון יכולים לגשת למידע מסוים אודותיכם כדי לבצע את משימותיהם ולענות על
        שאלותיכם. יש לנו כללים מחמירים עבור הטכנאים שלנו ובשום מקרה אסור להם לחשוף את המידע שלכם לכל מטרה שאינה קשורה
        ל-AIGuard.
      </li>
      <li>
        אנו עשויים לחשוף את המידע האישי שלכם מהסיבות החוקיות הבאות: (1) להיענות לבקשות אכיפת חוק - לדוגמה, ייתכן שנשתף
        זירות פשע שנקלטו על ידי המוצרים והשירותים כדי לסייע למשטרה לעקוב אחר עבריינים; (2) לציית לחוק או להליך משפטי
        (כגון צו בית משפט או זימון); (3) לחקור הפרות אפשריות של תנאי השירות; (4) להגן מפני פגיעה בזכויות, ברכוש או
        בבטיחות של AIGuard, ככל המותר על פי חוק.
      </li>
    </ul>

    <p>
      אנו מבקשים את הסכמתכם לפני עיבוד המידע שלכם. בנוסף ניתנת לכם הזכות לבטל את הסכמתכם בכל עת. אם יש לכם שאלות נוספות
      לגבי זכויותיכם בפרטיות, ניתן ליצור קשר באמצעות דוא"ל:{' '}
      <a href="mailto:ioranr1@gmail.com" dir="ltr" className="text-cyan-600 underline">ioranr1@gmail.com</a>.
    </p>

    <h2>בחירות המשתמש</h2>
    <p>
      ככלל, אנו שומרים את המידע האישי שלכם בשרתינו כל עוד אתם נשארים משתמשים ב-AIGuard לצורך מתן השירותים וקידום
      האינטרסים הלגיטימיים המפורטים לעיל. עומדת לכם הזכות לבקש גישה למידע שאנו אוספים אודותיכם. בעקבות בקשתכם, אנו גם
      יכולים להסיר את חשבונכם ממסד הנתונים שלנו ולסיים את ההתקשרות בתוך מספר ימים. לשם כך ניתן לפנות לאזור "Danger Zone"
      בהגדרות. אנו מציעים לכם בחירות מסוימות בקשר למידע האישי שאנו אוספים. לעדכון העדפותיכם, להגבלת התקשורת מצדנו או
      להגשת בקשה - ראו את סעיף "צור קשר" להלן. ניתן גם לבטל קבלת תקשורת קידום מכר על ידי ביצוע הוראות הסרת ההרשמה
      בתקשורת שאתם מקבלים, או באמצעות דוא"ל ל-ioranr1@gmail.com. אנו צריכים לשלוח לכם תקשורת מסוימת לגבי המוצרים
      והשירותים שלנו, ולא תוכלו לבטל הצטרפות לאלה.
    </p>

    <h2>דוא"ל קידום מכירות</h2>
    <p>
      תוכלו לבטל קבלת דוא"ל קידום מכירות מ-AIGuard על ידי ביצוע ההוראות באותם הודעות דוא"ל או על ידי פנייה אלינו ב-{' '}
      <a href="mailto:ioranr1@gmail.com" dir="ltr" className="text-cyan-600 underline">ioranr1@gmail.com</a>. אם תבטלו
      קבלה, אנו עשויים עדיין לשלוח לכם דוא"ל שאינו פרסומי, כגון בנושא חשבונכם או יחסי עסקים שוטפים.
    </p>

    <h2>התראות Push לנייד</h2>
    <p>
      בהסכמתכם, אנו עשויים לשלוח התראות פוש או התראות פרסומיות ולא-פרסומיות למכשיר הנייד שלכם. ניתן להפסיק הודעות אלה
      בכל עת על ידי שינוי הגדרות ההתראות במכשיר.
    </p>

    <h2>הרשאת מיקום</h2>
    <p>
      ייתכן ותידרש הרשאת מיקום בנסיבות מסוימות, כגון תהליך השיוך של AIGuardCam או עבור תכונות ספציפיות באפליקציה. אם
      הסכמתם בתחילה לאיסוף מיקום מדויק מהאפליקציה הנייד שלנו, באפשרותכם לעצור איסוף זה בכל עת על ידי שינוי ההעדפות
      במכשיר הנייד.
    </p>

    <h2>מדיניות שמירת נתונים</h2>
    <p>תקופת השמירה של נתונים אישיים תלויה במטרת עיבוד הנתונים:</p>
    <ul>
      <li>מידע הקשור לחשבון: ימחק יחד עם בקשת מחיקת החשבון.</li>
      <li>מידע הקשור למכשיר: ימחק כאשר תמחקו ידנית את המכשירים המשויכים בחשבונכם.</li>
      <li>
        יומן שימוש באפליקציה: נתונים גולמיים יימחקו תוך 60 ימים. אנו משתמשים בסטטיסטיקות שימוש אנונימיות לשיפור איכות
        השירות, ואין בהן נתונים מזהים אישית.
      </li>
      <li>
        סרטוני אירוע: תוכן של משתמש חינמי נשמר למשך 7 ימים. תוכן של משתמשי פרימיום נשמר בין 14 ל-30 ימים, בהתאם לחבילת
        השירות.
      </li>
    </ul>

    <h2>מדיניות בנוגע לקטינים</h2>
    <p>
      רק יחידים מעל גיל 18 רשאים להחזיק בחשבון AIGuard. יחידים מעל גיל 16 ומתחת לגיל 18 נדרשים להיות תחת פיקוח של הורה
      או אפוטרופוס חוקי בעת השימוש במוצרינו ובשירותינו, ורק כאשר ההורה/אפוטרופוס מסכים להיות מחויב לתנאים אלה בשמם. איננו
      אוספים ביודעין מידע מילדים מתחת לגיל 16.
    </p>

    <h2>זכויות יחיד עבור EEA</h2>
    <p>
      אם אתם אזרחים או תושבי האיחוד האירופי, ניתנות לכם זכויות מסוימות הזמינות לכם על פי החוקים החלים. למידע נוסף על
      זכויותיכם, או אם תרצו לבקש גישה למידע האישי שלכם, ראו את סעיף "צור קשר" להלן להגשת בקשת זכויות. תידרש לנו תקופת
      ימים לאמת את זהותכם כדי להגן על פרטיותכם ואבטחתכם לפני שנעבד את בקשתכם. שימו לב שמימוש כל אחת מהזכויות עשוי
      להשפיע על חוויית השימוש שלכם ב-AIGuard.
    </p>

    <h2>העברת נתונים בין-לאומית</h2>
    <p>
      אנו עשויים לאחסן את הנתונים האישיים שלכם במרכזי נתונים מחוץ למדינה שבה אתם חיים. הנתונים עשויים להיות מועברים
      בין-לאומית בהתאם לדרישות התפעול. איננו מאחסנים את הנתונים האישיים שלכם בסין.
    </p>

    <h2>עדכונים למדיניות הפרטיות שלנו</h2>
    <p>
      מדיניות פרטיות זו עשויה להתעדכן מעת לעת, בהתאם לצרכים העסקיים שלנו ו/או שינויים בדרישות הרגולציה. נבקש תמיד את
      עיונכם ואישורכם בעת ביצוע שינויים.
    </p>

    <h2>צור קשר</h2>
    <p>
      פעם נוספת, אנו מתייחסים למידע שאנו אוספים מכם בכובד ראש. ככלל, המידע נאסף לצורך אספקת מוצרים ושירותים טובים יותר
      עבורכם. אם יש לכם שאלות לגבי נהלי הפרטיות שלנו, ניתן להגיש פנייה בדוא"ל:{' '}
      <a href="mailto:ioranr1@gmail.com" dir="ltr" className="text-cyan-600 underline">ioranr1@gmail.com</a>.
    </p>
  </article>
);

/* -------------------- ENGLISH -------------------- */
const PrivacyEn: React.FC = () => (
  <article className="prose prose-slate max-w-none" dir="ltr">
    <h1>Privacy Policy</h1>
    <p><strong>Effective:</strong> 01/04/2026</p>

    <p>
      As a security product, AIGuard (also referred to as "we" or "us" or "our") treats your data seriously and is
      committed to putting every effort in to ensure your privacy is safe and secure. This privacy policy describes how
      we collect, use and process the personal information of individuals who visit our Website and who register to use
      AIGuard as a user. This policy also describes the action you can take when you have concerns about our privacy
      practices. We pledge to collect and process your information under these principles:
    </p>
    <ol>
      <li>We will be as transparent as possible, including how we use your information and whom we share it with.</li>
      <li>
        We will keep your information as secure and safe as possible by implementing security measures in line with
        industry standards. We will ask for your consent when there is new personal data to be collected/shared.
      </li>
    </ol>
    <p>
      By using AIGuard, you agree to allow us to collect and process the information about you for the purposes
      described below. Under no circumstances do our products and services access your information without receiving
      your consent first.
    </p>

    <h2>How Is The Information Collected and Used</h2>
    <p>
      We obtain certain personal information about you and information that is related to your experience with our
      products and services. The below table will help you know more about what information we collect, and how we use
      it:
    </p>

    <div className="overflow-x-auto">
      <table className="w-full border border-slate-300 text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="border border-slate-300 p-2">Category</th>
            <th className="border border-slate-300 p-2">Type</th>
            <th className="border border-slate-300 p-2">Source</th>
            <th className="border border-slate-300 p-2">Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={5}>Account info</td>
            <td className="border border-slate-300 p-2">Email address</td>
            <td className="border border-slate-300 p-2">User provides in the registration process</td>
            <td className="border border-slate-300 p-2">
              <ul className="m-0 pl-4 list-disc">
                <li>Account name that relates to an identifiable account.</li>
                <li>A user's contact info to send system and marketing email.</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">User ID</td>
            <td className="border border-slate-300 p-2">System generated in the registration process</td>
            <td className="border border-slate-300 p-2">User ID that relates to a registered account.</td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">Usage Purposes</td>
            <td className="border border-slate-300 p-2">User provides in the registration process</td>
            <td className="border border-slate-300 p-2">Used in usage statistics.</td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">Unsubscribed Email</td>
            <td className="border border-slate-300 p-2">User unsubscribes marketing email</td>
            <td className="border border-slate-300 p-2">Remove from marketing email list.</td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">Language</td>
            <td className="border border-slate-300 p-2">From device API</td>
            <td className="border border-slate-300 p-2">Determine the display language.</td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={2}>Location</td>
            <td className="border border-slate-300 p-2">Registered location</td>
            <td className="border border-slate-300 p-2">Derived from an IP address</td>
            <td className="border border-slate-300 p-2">
              <ul className="m-0 pl-4 list-disc">
                <li>Determine default service provider (API and storage server).</li>
                <li>Used to improve service quality and resolve issues.</li>
              </ul>
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">Last login location</td>
            <td className="border border-slate-300 p-2">Derived from an IP address</td>
            <td className="border border-slate-300 p-2">
              <ol className="m-0 pl-4 list-decimal">
                <li>Determine the default service provider (API and storage server).</li>
                <li>Used to improve service quality and resolve issues.</li>
              </ol>
            </td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={2}>Device info</td>
            <td className="border border-slate-300 p-2">Device info</td>
            <td className="border border-slate-300 p-2">From device API</td>
            <td className="border border-slate-300 p-2">
              Identify a paired device using our services, such as MAC address, model name, OS version, and device
              aliases.
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">User payment info</td>
            <td className="border border-slate-300 p-2">From Stripe, LLC (purchase)</td>
            <td className="border border-slate-300 p-2">Information to process the purchase order and refund request.</td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={3}>App info and performance</td>
            <td className="border border-slate-300 p-2">Report from App crash log</td>
            <td className="border border-slate-300 p-2">From device API</td>
            <td className="border border-slate-300 p-2">
              Crash log data from your app. For example, the number of times your app has crashed, stack traces, or
              other information directly related to a crash. Used to improve service quality and resolve issues.
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">Diagnostics</td>
            <td className="border border-slate-300 p-2">Report from App usage log</td>
            <td className="border border-slate-300 p-2">
              Information about the performance of your app. For example: battery life, loading time, latency, frame
              rate, or any technical diagnostics. Used to improve service quality and resolve issues.
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">App info</td>
            <td className="border border-slate-300 p-2">Report from App usage log</td>
            <td className="border border-slate-300 p-2">
              Information to provide corresponding services, such as app version, and app settings.
            </td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold" rowSpan={2}>App activity</td>
            <td className="border border-slate-300 p-2">App interactions</td>
            <td className="border border-slate-300 p-2">Report from App usage log</td>
            <td className="border border-slate-300 p-2">
              Information about how a user interacts with your app. For example, the number of times they visit a page,
              or what they tap on. Used to improve service quality and resolve issues.
            </td>
          </tr>
          <tr>
            <td className="border border-slate-300 p-2">Event video</td>
            <td className="border border-slate-300 p-2">Uploaded when video recorded (triggered by motion detection or manually)</td>
            <td className="border border-slate-300 p-2">Information to process the purchase order and refund request.</td>
          </tr>

          <tr>
            <td className="border border-slate-300 p-2 font-semibold">User feedback</td>
            <td className="border border-slate-300 p-2">Feedback</td>
            <td className="border border-slate-300 p-2">Collected from Feedback Form, surveys, and social media</td>
            <td className="border border-slate-300 p-2">
              Collect user feedback to identify or resolve issues for users, and to optimize our product.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p>More details on the information we collect:</p>
    <ul>
      <li>
        Provide, develop, and improve our products and services for you. For example, we store your data on our servers
        in order to allow you to send alarm pictures, save content and share it with others with your permission.
      </li>
      <li>
        Pursue legitimate interests, including conducting research, helping us form business decisions, personalizing
        the services for you based on the types of devices you are using or the environment where you have your devices
        set up.
      </li>
      <li>
        Comply with legal obligations. For example, we may process your information in response to legal processes or
        law enforcement requests.
      </li>
      <li>Communicate with you, such as providing potentially practical tips and special offers for you.</li>
      <li>Address technical issues reported by you to improve functionalities and availabilities of the services.</li>
      <li>Investigate potential violations of Terms of Service.</li>
      <li>
        Process and fulfill claims and orders in connection with our products and services and keep you informed about
        the status of your order.
      </li>
    </ul>

    <p>
      In most cases, the data we use for research and analyzing purposes are processed in a non-identifiable form,
      which means the information is processed anonymously and will never be associated with you. For example, we may
      track aggregated information like registration and validation rates to help us design more effective onboarding
      pages. We may also use a machine-learning algorithm to access the data automatically without manual operation and
      help us provide personalized services for specific groups of individuals. We use such information to help us
      increase sales, make marketing decisions, and pursue legitimate interests.
    </p>

    <p>
      However, we may access your information in a personally identifiable way under the following circumstances: (1)
      when you encounter any technical issue and request that we address such issue; (2) when we investigate potential
      violations of Terms of Service; (3) when we have to meet any applicable law, regulation, legal process or
      enforceable governmental request. Whenever your personal information is involved in any case stated above, we
      will always ask for your consent before taking any further action. Please also note that this principle is
      established for those who are in compliance with our Terms of Service.
    </p>

    <p>
      We may process the information on the platforms provided by third-party service providers. Though these service
      providers are shared with your personal information for the purpose of providing the services for us, they are
      restricted from sharing it for any other purpose. If you are not willing to have your personal information
      accessed by any of these service providers, you may opt-out by contacting us.
    </p>

    <p>
      We take data security very seriously and keep the information obtained from you safe and secure in line with
      industry standards. Your personal information is encrypted while it is transmitted to our servers in order to
      prevent any unauthorized third parties or threats from accessing the data. Please note that we may process your
      personal information on servers not necessarily located in your home country.
    </p>

    <p>
      Our products and services are designed to provide you with the ability to see, hear, and speak to anyone on your
      monitoring device. In order for our products and services to function properly, we obtain content and related
      information that is captured and recorded when you use our products and services. For example, we store the
      events captured by the motion detector in our servers in order to provide evidence to identify the suspect. In
      addition, our products and services may also collect data from their surrounding environment to perform certain
      functions (such as Motion Detection and Auto Low-Light Filter that is activated automatically when it's unlit).
    </p>

    <h2>Information Collected Automatically</h2>
    <p>
      We may use cookies, web server logs, web beacons, and other information-gathering technologies to obtain certain
      information that helps us identify you quickly. These types of information include IP address, identifiers
      associated with your devices, types of devices connected to our services, web browser characteristics, device
      characteristics, language preferences, referring/exit pages, clickstream data, and dates and times of website or
      app visits. These technologies help us (1) identify you and count visits to our websites; (2) keep track on how
      you interact with our products and services; (3) customize the services based on your preferences; (4) understand
      the usage of our products and effectiveness of our communications; and (5) manage and improve our products and
      services. For free users, our advertising partners may collect information by automatic means through our app to
      display and manage advertising on our app. For example, your usage patterns on our app may serve as an important
      reference for them to suggest interest-based advertisements to you. Please rest assured that this type of
      information is processed in a non-identifiable way and that they also have strict rules for processing such
      information.
    </p>

    <h2>Information Sharing</h2>
    <p>
      We will never share your information for any commercial and marketing purpose unrelated to the delivery of our
      products and services without receiving your consent first. We will never sell or rent our user list or any other
      related information that can possibly be associated with you. We are dedicated to minimizing the exposure of our
      users' identities and may only share your personal information in the following limited situations:
    </p>
    <ul>
      <li>
        We may share some of your personal information with the individuals you invite to join the trust circle (a
        feature allowing you to share your cameras with others). These authorized individuals have access to the visual
        and audio data captured and streamed on the device, information of the device such as the status and power
        level. They are also authorized to generate additional data (recordings).
      </li>
      <li>
        We may process the information obtained from you on the platforms our third-party partners provide. As stated
        above, though these service providers are shared with the information, they are restricted from disclosing it.
        Check their privacy policies here.
      </li>
      <li>
        The technicians who oversee data processing and storage are able to access certain information about you in
        order to complete their tasks and answer your questions. We have strict rules for our technicians and under no
        circumstances are they allowed to disclose your information for any non-AIGuard purpose.
      </li>
      <li>
        We may disclose your personal information for the following legal reasons: (1) to respond to law enforcement
        requests. For example, we may share crime scenes captured by our products and services to help the police
        track down criminals; (2) to comply with law or legal process (such as a court order or subpoena); (3) to
        investigate potential violations of Terms of Service; (4) to protect against harm to the rights, property or
        safety of AIGuard as permitted by law.
      </li>
    </ul>

    <p>
      We ask for your consent before processing your information. You are also given the right to opt out or withdraw
      that consent at any time. Should you have any further questions about your rights to privacy, please reach out to
      us via email:{' '}
      <a href="mailto:ioranr1@gmail.com" className="text-cyan-600 underline">ioranr1@gmail.com</a>.
    </p>

    <h2>User Choices</h2>
    <p>
      We generally retain your personal information on our servers as long as you remain an AIGuard user for the
      purpose of offering you the services and pursuing the legitimate interests outlined above. You have the right to
      request access to the information we collect about you. Upon your request, we can also remove your account from
      our database and cease the contract within a few days. To do so, you can navigate to the Danger Zone (settings).
      We offer you certain choices in connection with the personal information we obtain about you. To update your
      preferences, limit the communications you receive from us, or submit a request, please refer to the Contact Us
      section below. You also may opt out of receiving promotional communications from us by following the unsubscribe
      instructions in the communications you receive or email{' '}
      <a href="mailto:ioranr1@gmail.com" className="text-cyan-600 underline">ioranr1@gmail.com</a>. We do need to send
      you certain communications about our products and services, and you will not be able to opt out of those
      communications.
    </p>

    <h2>Promotional Emails</h2>
    <p>
      You may opt out of receiving promotional emails from AIGuard by following the instructions in those emails or by
      contacting us at{' '}
      <a href="mailto:ioranr1@gmail.com" className="text-cyan-600 underline">ioranr1@gmail.com</a>. If you opt out, we
      may still send you non-promotional emails, such as those about your account or our ongoing business relations.
    </p>

    <h2>Mobile Push Notifications/Alerts</h2>
    <p>
      With your consent, we may send promotional and non-promotional push notifications or alerts to your mobile
      device. You can deactivate these messages at any time by changing the notification settings on your mobile
      device.
    </p>

    <h2>Location Permission</h2>
    <p>
      Location permission may be required during certain circumstances, such as the AIGuardCam pairing process or for
      specific features in the app. If you initially consent to our collection of precise location from our mobile app,
      you may subsequently stop this collection by changing the preferences on your mobile device.
    </p>

    <h2>Retention Policy</h2>
    <p>The retention period for storing personal data is depending on the purpose of data processed:</p>
    <ul>
      <li>Account-related information: data will be deleted along with your account deletion request.</li>
      <li>Device-related information: data will be deleted when you manually delete the paired devices in your account.</li>
      <li>
        App usage log: Raw data will be deleted in 60 days. We use anonymous usage statistics to help improve the
        quality of our service, and no personally identifiable data is contained.
      </li>
      <li>
        Event videos: free user's content will be kept for 7 days. Premium users' content will be kept from 14 to 30
        days, depending on the service package.
      </li>
    </ul>

    <h2>Policy for Children</h2>
    <p>
      Only individuals aged above 18 are permitted to own an AIGuard account. Individuals aged above 16 but below 18
      are requested to be under the supervision of a parent or legal guardian while using our products and services and
      only when they agree to be bound by these Terms on your behalf. We do not knowingly obtain information from
      children aged below 16.
    </p>

    <h2>Individual Rights for EEA</h2>
    <p>
      If you are an EU citizen or resident, you are given certain rights that are available to you under applicable
      laws. To see more details on your rights, or if you would like to request access to your personal data, please
      refer to the Contact Us section below to submit a rights request. It would take a few days for us to verify your
      identity so as to protect your privacy and security before we process your request. Please beware that exercising
      any of the rights may have an impact on your experience with AIGuard.
    </p>

    <h2>International Data Transmission</h2>
    <p>
      We may store your personal data in data centers outside the country you live in. The data may be transferred
      internationally depending on the service operation requirements. We do not store your personal data in China.
    </p>

    <h2>Updates To Our Privacy Notice</h2>
    <p>
      This Privacy Policy may be updated from time to time, depending on our business demands and/or changes to
      regulatory requirements. We will always ask for your review and approval when we make any changes.
    </p>

    <h2>Contact Us</h2>
    <p>
      Once again, we take the information we gather from you rather seriously. Generally, the information is collected
      to serve as an important reference to provide you with better products and services. If you have any questions
      about our privacy practices, you may submit an inquiry via{' '}
      <a href="mailto:ioranr1@gmail.com" className="text-cyan-600 underline">ioranr1@gmail.com</a>.
    </p>
  </article>
);

const Privacy: React.FC = () => {
  const { language } = useLanguage();
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        {language === 'he' ? <PrivacyHe /> : <PrivacyEn />}
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
