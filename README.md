# Reality Check: חוקי המשחק החדשים

כלי סדנה מתוך "האלגוריתם של השינוי". 18 היגדים בשש פרדיגמות, ובסוף: איפה אתם בין הספר הישן לחדש, ובאיזה פרק כדאי להתחיל.

**המוצר הוא קובץ אחד: [`index.html`](index.html).** פותחים אותו בדפדפן, וזהו. בלי שרת, בלי התקנה, בלי איסוף נתונים.

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
npm test            # Domain, תוכן וארכיטקטורה. בלי דפדפן, פחות משנייה
npx playwright install chromium
npm run test:e2e    # זרימה מלאה, רשת, נגישות. טלפון ודסקטופ
```

## מבנה
```
index.html              המוצר. STYLE → MARKUP → CONTENT → DOMAIN → UI
ARCHITECTURE.md         עקרונות, מבנה, ומה אוכף כל עיקרון
docs/adr/               החלטות ארכיטקטורה
tests/
  _source.mjs           מחלץ את הבלוקים מ-index.html. בודקים את מה שנשלח
  domain.test.mjs       לוגיקה טהורה
  content.test.mjs      סכמה ואינווריאנטים של התוכן
  architecture.test.mjs fitness functions לכל עיקרון
  e2e.spec.mjs          Playwright + axe
.github/workflows/ci.yml בדיקות על כל PR, deploy רק מ-main ירוק
```

לפני שמשנים משהו שאינו תוכן: [ARCHITECTURE.md](ARCHITECTURE.md).
