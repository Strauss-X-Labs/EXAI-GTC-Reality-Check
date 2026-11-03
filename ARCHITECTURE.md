# ארכיטקטורה: Reality Check

> כלי סדנה. קובץ HTML אחד. בלי שרת משלנו, בלי build. איסוף נתונים רק בלחיצה, ורק אנונימי.
> הפשטות היא לא מגבלה של הפרויקט, היא הדרישה המרכזית שלו.

## 1. הקשר

משתתף בסדנה פותח קישור בטלפון, עונה על 18 היגדים בשש פרדיגמות, ומקבל:
מיקום על "המסע מהספר הישן לחדש", רדאר של שש הפרדיגמות, והפרק בספר החוקים שבו כדאי להתחיל.

**מי משתמש:** משתתפי סדנה (בעיקר מובייל), מנחה שמציג על מסך.
**מי מתחזק:** יועץ שמעדכן תוכן, ומפתח (אדם או סוכן) שנוגע בקוד לעתים רחוקות.
**אופציונלי:** כפתור "הראה לי איך אני למול הכלל". שולח את התשובות בעילום שם ל-Apps Script, ומצייר את ממוצע כל המשיבים כשכבה נוספת ברדאר (ADR 0006).
**מה לא:** אין חשבונות, אין דוחות, אין מסך מנחה. אם זה ישתנה, זה מוצר אחר (ראו סעיף 7).

## 2. עקרונות

כל עיקרון כאן נאכף אוטומטית. עיקרון בלי אכיפה הוא המלצה, וכאן אין המלצות.

| # | עיקרון | למה | איך נאכף |
|---|--------|-----|----------|
| P1 | **קובץ אחד** | שולחים קישור או קובץ, ועובד. גם בלי אינטרנט, גם ממייל | `tests/architecture.test.mjs`: אין `src`/`href` מקומיים, אין `<script src>`, ה-deploy מעלה רק את `index.html` |
| P2 | **שום דבר לא יוצא בלי לחיצה, ושום דבר מזהה לא יוצא אף פעם** | זו הבטחה שכתובה על המסך הראשון. הבטחה שבורה הורסת אמון בסדנה | סטטי: `fetch`, `localStorage` ו-`crypto` רק ב-`#rc-net`; fetch רק ל-`endpoint`; storage רק למפתח `rc.device`; המטען הוא בדיוק `{v,d,a}`; קריאה אחת ל-`Net.submit`, מהכפתור. Apps Script: דוחה כל שדה אחר, לא מחזיר שורות של אחרים. e2e: אפס בקשות לפני הלחיצה, ובלי endpoint אפס בקשות ואפס storage |
| P3 | **Spec over Body** | יועץ מעדכן תוכן בלי לגעת בקוד | כל התוכן בבלוק JSON אחד (`#content`). בדיקת סכמה. בדיקה שאף טקסט תוכן לא מופיע בקוד |
| P4 | **Ports & Adapters** | הלוגיקה נבדקת בלי דפדפן, ה-UI וה-Net מוחלפים בלי לגעת בחישוב | ה-Domain רץ ב-Node בלי DOM. בדיקה סטטית: אסור `document`, `window`, `navigator`, `Date`, `Math.random` בתוך `#rc-domain`; `#rc-net` לא מצייר ולא מחשב |
| P5 | **אפס תלויות בזמן ריצה** | אין מה לעדכן, אין מה שיישבר בעוד שנתיים | אין `<script src>` חיצוני. מקורות חיצוניים מותרים: Google Fonts (עם fallback מערכתי) ו-Apps Script Web App (אופציונלי, הכלי עובד גם בלעדיו) |
| P6 | **נגיש ו-RTL** | קהל ישראלי, מובייל, גם מי שמנווט במקלדת | e2e: `lang="he"`, `dir="rtl"`, ניווט מקלדת מלא, `prefers-reduced-motion`, בדיקת axe בלי הפרות חמורות |
| P7 | **קטן** | נטען מהר ב-4G באמצע אולם | תקציב: עד 60KB לקובץ |

עיקרון שלא נבדק במכונה, ונבדק ב-Code Review: **קודם אנשים.** כל טקסט שמשתתף רואה צריך להיות מכבד, ישיר, ולא שיפוטי. אין "נכשלת", יש "כאן מתחיל האלגוריתם שלך".

## 3. מבנה: מונוליט מודולרי בקובץ אחד

```
index.html
├── STYLE      <style>                       עיצוב, טוקנים ב-:root
├── MARKUP     <div class="wrap">            ארבעה מסכים: intro, step, result, book
├── CONTENT    <script type="application/json" id="content">   ה-Spec
├── CONFIG     <script type="application/json" id="config">    endpoint, minCompare
├── DOMAIN     <script id="rc-domain">       פונקציות טהורות → globalThis.RCDomain
├── NET        <script id="rc-net">          Adapter לרשת ולאחסון → globalThis.RCNet
└── UI         <script id="rc-ui">           Adapter: קורא Spec, שואל Domain, מצייר DOM

apps-script/Code.gs                          Backend אופציונלי, מודבק בגיליון. לא נשלח לדפדפן
```

כיוון התלות חד-כיווני:

```
CONTENT, CONFIG (data) ──► DOMAIN (pure) ──► UI (DOM, SVG, events)
                                  NET (fetch, device id) ──►┘        ──► Apps Script ──► Sheet
```

- **CONTENT** לא יודע כלום. רק נתונים.
- **DOMAIN** מקבל תוכן ותשובות, מחזיר נתונים. לא נוגע בדפדפן. לכן נבדק ב-Node.
- **NET** הוא המקום היחיד שמדבר עם הרשת או שומר משהו במכשיר. יודע לשלוח `{v,d,a}` ולהחזיר את התשובה, ותו לא.
- **UI** מצייר ומחבר אירועים. אין בו חישובי ציון ואין בו גישה לרשת.

למה לא קבצים נפרדים עם build? כי אז הקובץ שנשלח הוא לא הקובץ שנכתב, וצריך כלי כדי לייצר אותו. כאן הקובץ במאגר הוא בדיוק הקובץ שהמשתתף פותח. ה-"מודולים" הם בלוקים עם גבולות ברורים, והבדיקות מוודאות שהגבולות נשמרים.

## 4. מודל התוכן (Spec)

```jsonc
{
  "meta":  { "version": "1.0.0", "title": "...", "maxPerParadigm": 3 },
  "bands": [ { "min": 0, "max": 6, "title": "...", "text": "..." }, ... ],
  "paradigms": [
    {
      "name": "...", "short": "תווית לרדאר",
      "from": "החוק הישן", "to": "החוק החדש",
      "items": ["היגד 1", "היגד 2", "היגד 3"],
      "chapter": {
        "sub": "...",
        "clauses": [ { "old": "...", "new": "...", "tomorrow": "...", "hot": true, "highlight": "כדי לצמוח" } ]
      }
    }
  ]
}
```

אינווריאנטים (נבדקים ב-`tests/content.test.mjs`):
- לכל פרדיגמה אותו מספר היגדים (`maxPerParadigm`), ומספר סעיפים שווה למספר ההיגדים. סעיף N בפרק מקביל להיגד N בשאלון.
- הטווחים ב-`bands` מכסים את 0 עד הציון המקסימלי, ברצף, בלי חפיפות.
- `highlight`, אם קיים, מופיע בתוך `new`.
- לכל פרדיגמה `short` של עד 20 תווים (נכנס כתווית ברדאר).
- בין 3 ל-8 פרדיגמות (פחות מ-3 זה לא רדאר, יותר מ-8 לא קריא בטלפון).

## 5. Domain API

| פונקציה | קלט | פלט |
|---------|-----|-----|
| `emptyAnswers(paradigms)` | spec | `boolean[][]` |
| `perParadigm(answers)` | תשובות | ציון לכל פרדיגמה |
| `total(per)`, `maxScore(paradigms)` | | מספר |
| `bandFor(score, bands)` | | band, או `RangeError` אם אין כיסוי |
| `bandEdges(bands, max)` | | גבולות האזורים על הדרך, 0..1 |
| `weakest(per)` | | `{ min, indices, allEqual }` |
| `weakestMessage(per, paradigms)` | | טקסט ההמלצה |
| `startChapter(per)` | | הפרק שנפתח ראשון |
| `radarPoint(i, r, count, cx, cy)` | | `[x, y]` |
| `splitHighlight(text, highlight)` | | 1 או 3 חלקים |
| `encodeAnswers(answers)` / `decodeAnswers(bits, paradigms)` | | פורמט ההעברה: 18 תווים `0`/`1` |
| `averagePerParadigm(itemAverages, paradigms)` | ממוצע לכל היגד | ממוצע לכל פרדיגמה (0..3) |
| `compare(per, avgPer, paradigms)` | | `{ above, below, myTotal, avgTotal, message }` |
| `result(answers, content)` | | כל מה שמסך התוצאה צריך |

## 6. בדיקות

| שכבה | כלי | קובץ | מה נבדק |
|------|-----|------|---------|
| Domain | `node:test` | `tests/domain.test.mjs` | ציון, טווחים, החלשה, גאומטריה, מקרי קצה |
| Content | `node:test` | `tests/content.test.mjs` | סכמה ואינווריאנטים |
| Architecture | `node:test` | `tests/architecture.test.mjs` | P1, P2 (סטטי), P3, P4, P5, P7 |
| Backend | `node:test` + vm | `tests/apps-script.test.mjs` | Code.gs האמיתי מול שירותי Google מדומים: ולידציה, ממוצע, מכשיר אחד = קול אחד, סף |
| E2E | Playwright | `tests/e2e.spec.mjs` | זרימה מלאה, P2 (רשת), P6 (נגישות), מובייל ודסקטופ |
| E2E compare | Playwright | `tests/e2e-compare.spec.mjs` | הכפתור, המטען, מזהה מכשיר יציב, שכבת הממוצע, offline. Code.gs משמש backend מדומה |

הבדיקות מחלצות את הבלוקים מתוך `index.html` עצמו. אין עותק נפרד של הקוד לבדיקה, כך שמה שנבדק הוא מה שנשלח.

CI (`.github/workflows/ci.yml`) מריץ הכל על כל PR. Deploy ל-GitHub Pages רק מ-`main` ורק אם הבדיקות עברו.

## 7. מתי לשבור את הארכיטקטורה הזו

הארכיטקטורה מתאימה כל עוד המוצר הוא כלי סדנה אישי. סימנים שהגיע הזמן למוצר אחר:
- יותר מסדנה אחת, מסך מנחה, או השוואה לפי ארגון (ADR 0006 הוא פיילוט לסדנה אחת)
- ממוצע שצריך להיות אמין מול מי שמנסה לעוות אותו (דורש אימות, לא רק כתובת גלויה)
- כמה גרסאות תוכן ללקוחות שונים (שקלו כמה קבצי JSON ו-build קטן שמזריק אותם, P1 נשמר בתוצר)
- יותר מ-60KB או יותר מ-1,500 שורות ב-UI

החלטה כזו נכתבת קודם כ-ADR, ורק אז קוד.

## 8. החלטות (ADR)

- [0001 קובץ HTML אחד](docs/adr/0001-single-html-file.md)
- [0002 התוכן כ-Spec בבלוק JSON](docs/adr/0002-content-as-json-spec.md)
- [0003 הפרדת Domain ו-UI בתוך הקובץ](docs/adr/0003-domain-ui-separation.md)
- [0004 בלי שמירה ובלי אנליטיקס](docs/adr/0004-no-persistence-no-analytics.md)
- [0005 אסטרטגיית בדיקות](docs/adr/0005-testing-strategy.md)
- [0006 איך אני למול הכלל, דרך Apps Script](docs/adr/0006-compare-with-everyone.md)
