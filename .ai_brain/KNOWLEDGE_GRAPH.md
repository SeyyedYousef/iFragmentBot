# نقشه دانش پروژه (KNOWLEDGE_GRAPH) - iFragmentBot

## ساختار کلی سیستم
پروژه یک ربات پیشرفته تلگرام است که وظیفه تحلیل یوزرنیم‌های پلتفرم Fragment را بر عهده دارد.

### ۱. لایه‌های اصلی
- **Entry Point:** `src/App/bot.entry.js` (مدیریت اصلی ربات و رویدادهای Telegraf)
- **Services:** `src/services/` (منطق تجاری، تحلیل قیمت، استخراج داده با Puppeteer)
- **Handlers:** `src/handlers/` (مدیریت دستورات کاربران و تعاملات پنل)
- **Database:** ترکیبی از MongoDB (داده‌های کلان) و SQLite (کش سریع و تنظیمات محلی)
- **Templates:** `src/templates/` (ساختار HTML/Image برای نمایش کارت‌های مارکت)

### ۲. جریان داده (Data Flow)
1. **User Request:** کاربر یوزرنمی را در ربات وارد می‌کند.
2. **Analysis Service:** ربات با استفاده از `Puppeteer` داده‌های لحظه‌ای را از Fragment می‌خواند.
3. **AI Evaluation:** داده‌ها پردازش شده و تخمین قیمت/ارزش انجام می‌شود.
4. **UI Generation:** با استفاده از `templates/` یک تصویر یا پیام فرمت شده (مانند `marketCard.html`) ساخته می‌شود.
5. **Response:** نتیجه به کاربر ارسال می‌شود.

### ۳. وابستگی‌های کلیدی
- **Fragment.com:** منبع اصلی داده.
- **TON Blockchain:** برای بررسی تراکنش‌ها و مالکیت‌ها.
- **Puppeteer Stealth:** برای عبور از سیستم‌های ضد ربات Fragment.
