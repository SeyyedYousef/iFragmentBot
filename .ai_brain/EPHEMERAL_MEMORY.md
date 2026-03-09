# حافظه موقت (EPHEMERAL MEMORY) - iFragmentBot

- **مرحله:** پاکسازی و حذف کدهای مرده (The Purge).
- **آخرین اقدام:** اصلاح آدرس Entry Point در `package.json` و `KNOWLEDGE_GRAPH.md`؛ حذف فایل‌های `old_panelHandlers.js`.

## هدف فعلی (Current Objective)
- تکمیل De-Entropy کد پایه و پاکسازی `bot.entry.js` از کدهای کامنت شده و اضافی.

## گام منطقی بعدی (Next Logical Step)
- حذف کدهای کامنت شده در `src/App/bot.entry.js`.
- رفع وارنینگ‌های مربوط به ایمپورت‌های نامعتبر در `app.config.js`.
- ریفکتور کردن (Refactor) فایل‌های بزرگ به ماژول‌های کوچک‌تر برای مقیاس‌پذیری ۱۰۰ میلیون کاربر.

## بدهی فنی (Technical Debt)
- فایل `src/bot.js` بسیار حجیم است (۱۸۹ کیلوبایت) و نیاز به جداسازی هندلرها دارد.
- وابستگی مستقیم به Puppeteer در برخی هندلرها که باید به سرویس‌های مجزا منتقل شوند.
