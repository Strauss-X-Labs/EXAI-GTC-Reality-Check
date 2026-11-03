# Reality Check: חוקי המשחק החדשים

כלי סדנה מתוך "האלגוריתם של השינוי". 18 היגדים בשש פרדיגמות, ובסוף: איפה אתם בין הספר הישן לחדש, ובאיזה פרק כדאי להתחיל.

**המוצר הוא קובץ אחד: [`index.html`](index.html).** פותחים אותו בדפדפן, וזהו. בלי שרת, בלי התקנה.

אופציונלי: כפתור **"הראה לי איך אני למול הכלל"** שמשווה לממוצע כל המשיבים, דרך Apps Script שמחובר ל-Google Sheet. הוראות הפעלה: [`apps-script/README.md`](apps-script/README.md). בלי הגדרה, שום דבר לא יוצא מהמכשיר.

## שימוש בסדנה
- **קישור:** כל push ל-`main` שעובר בדיקות עולה ל-GitHub Pages.
- **קובץ:** אפשר לשלוח את `index.html` במייל או בוואטסאפ. עובד גם בלי אינטרנט (עם גופן מערכת).

## עריכת תוכן
כל התוכן נמצא בבלוק אחד בתוך `index.html`:

```html
<script type="application/json" id="content"> ... </script>
```

משנים שם טקסט, מריצים `npm test`, ואם ירוק אפשר לפרסם. הבדיקות יתפסו היגד חסר, סעיף שלא מקביל להיגד, טווח ציונים עם חור, או סימן קריאה.

## פיתוח
```bash
npm install
npm test            # Domain, תוכן, ארכיטקטורה ו-Apps Script. בלי דפדפן, פחות משנייה
npx playwright install chromium
npm run test:e2e    # זרימה מלאה, רשת, נגישות. טלפון ודסקטופ
```

## מבנה
```
index.html              המוצר. STYLE → MARKUP → CONTENT → CONFIG → DOMAIN → NET → UI
apps-script/            Backend אופציונלי (Code.gs) והוראות הפעלה
ARCHITECTURE.md         עקרונות, מבנה, ומה אוכף כל עיקרון
docs/adr/               החלטות ארכיטקטורה
tests/
  _source.mjs           מחלץ את הבלוקים מ-index.html. בודקים את מה שנשלח
  domain.test.mjs       לוגיקה טהורה
  content.test.mjs      סכמה ואינווריאנטים של התוכן
  architecture.test.mjs fitness functions לכל עיקרון
  apps-script.test.mjs  Code.gs מול שירותי Google מדומים
  e2e.spec.mjs          Playwright + axe
  e2e-compare.spec.mjs  הכפתור וההשוואה, מול Code.gs כ-backend
.github/workflows/ci.yml בדיקות על כל PR, deploy רק מ-main ירוק
```

לפני שמשנים משהו שאינו תוכן: [ARCHITECTURE.md](ARCHITECTURE.md).
