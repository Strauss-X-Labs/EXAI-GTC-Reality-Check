# ADR 0005: אסטרטגיית בדיקות

**סטטוס:** מאושר · 2026-11-02

## הקשר
צריך לבדוק לוגיקה, תוכן, ארכיטקטורה ו-UX, בלי להפר את ADR 0001 (אין build) ובלי להכניס תלויות לזמן ריצה.

## החלטה
- `node:test` (מובנה ב-Node 20+) לבדיקות Domain, Content ו-Architecture. אפס תלויות.
- Playwright + axe-core ל-e2e ונגישות, כ-devDependencies בלבד.
- הבדיקות קוראות את `index.html` ומחלצות ממנו בלוקים לפי `id`. אין קוד כפול.
- בדיקות הארכיטקטורה הן "fitness functions": כל עיקרון ב-ARCHITECTURE.md ממופה לבדיקה.

## השלכות
- `npm test` מהיר ורץ בלי דפדפן. `npm run test:e2e` מלא.
- הוספת עיקרון חדש = שורה בטבלה ב-ARCHITECTURE.md ובדיקה ב-`tests/architecture.test.mjs`, באותו PR.
