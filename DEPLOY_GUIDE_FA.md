# راهنمای Deploy روی Render.com

## � Render چیست؟

Render یک پلتفرم ابری رایگان است که:
- ✅ راحت‌ترین راه deploy
- ✅ اتصال مستقیم به GitHub
- ✅ Auto-deploy با هر push

---

## مرحله ۱: ثبت‌نام

1. به [render.com](https://render.com) بروید
2. روی **Get Started** کلیک کنید
3. با **GitHub** وارد شوید

---

## مرحله ۲: ساخت سرویس جدید

1. روی **New +** در بالای صفحه کلیک کنید
2. گزینه **Web Service** را انتخاب کنید
3. **Connect a repository** → ریپازیتوری **iFragmentBot** را انتخاب کنید

---

## مرحله ۳: تنظیمات سرویس

| فیلد | مقدار |
|------|-------|
| **Name** | `ifragment-bot` |
| **Region** | `Oregon (US West)` |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npx puppeteer browsers install chrome` |
| **Start Command** | `npm start` |

### انتخاب پلن:
- **Free** را انتخاب کنید

---

## مرحله ۴: تنظیم Environment Variables

در بخش **Environment Variables** کلیک کنید و اضافه کنید:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | توکن ربات تلگرام شما |
| `NODE_ENV` | `production` |

---

## مرحله ۵: Deploy

1. روی **Create Web Service** کلیک کنید
2. صبر کنید تا build تمام شود (۵-۱۰ دقیقه)
3. وقتی **Live** شد، ربات آماده است!

---

## مرحله ۶: بررسی لاگ‌ها

1. روی سرویس کلیک کنید
2. به تب **Logs** بروید
3. باید این پیام را ببینید:

```
🚀 Starting iFragment Bot...
```

---

## ⚠️ نکته مهم: جلوگیری از خوابیدن

Web Service رایگان بعد از ۱۵ دقیقه بی‌فعالیتی می‌خوابد.

### راه‌حل: استفاده از UptimeRobot

1. به [uptimerobot.com](https://uptimerobot.com) بروید
2. ثبت‌نام رایگان کنید
3. **New Monitor** بسازید:
   - **Monitor Type:** HTTP(s)
   - **URL:** آدرس Web Service شما از Render
   - **Interval:** 5 minutes

این سرویس هر ۵ دقیقه ربات را ping می‌زند و نمی‌گذارد بخوابد!

---

## آپدیت ربات

هر بار که کد را push کنید:
```bash
git add .
git commit -m "Update"
git push
```

Render **خودکار** ربات را آپدیت می‌کند!

---

## رفع مشکلات

### مشکل ۱: خطای Puppeteer

**راه‌حل:** Build Command را چک کنید:
```
npm install && npx puppeteer browsers install chrome
```

### مشکل ۲: ربات کار نمی‌کند

1. `BOT_TOKEN` را چک کنید
2. لاگ‌ها را بررسی کنید

### مشکل ۳: ربات می‌خوابد

از UptimeRobot استفاده کنید (بالا توضیح داده شد)

---

## ✅ تمام!

ربات شما الان روی Render اجرا می‌شود!

🎉 **تبریک!**
