# iFragmentBot - Telegram Fragment Username Analyzer

## 🚀 Quick Start

```bash
npm install
npm start
```

## 📋 Features

- 💎 Premium Flex Card generation
- 📊 Real-time Fragment.com data scraping
- 💰 Price estimation and rarity calculation
- 💼 Portfolio Tracker (usernames + anonymous numbers)
- 🔍 Inline Mode - search in any chat
- 📦 MongoDB analytics (optional)

## 🔧 Environment Variables

Create a `.env` file:

```env
BOT_TOKEN=your_telegram_bot_token
MONGO_URI=mongodb://localhost:27017
```

## 🌐 Deploy to Render

1. Push code to GitHub
2. Connect repo to [Render.com](https://render.com)
3. Set environment variables:
   - `BOT_TOKEN` - Your Telegram bot token
   - `MONGO_URI` - MongoDB Atlas connection string (optional)
4. Deploy!

### Render Settings

- **Build Command:** `npm install && npx @puppeteer/browsers install chrome@stable --path .cache`
- **Start Command:** `npm start`
- **Instance Type:** Free (or Starter for better performance)

## 📱 Usage

### Direct Message
Send any username to get full analysis with Flex Card

### Inline Mode
Type `@iFragmentBot crypto` in any chat

### Portfolio Tracker
Click the button below any analysis to see all assets

## 🛠️ Tech Stack

- Node.js + Telegraf
- Puppeteer-core for scraping
- Scrapling (Python) bridge for stealth scraping
- Pollinations AI for taglines
- MongoDB for analytics (optional)

## Scrapling Setup

The Scrapling pathway keeps Fragment scraping stable even when Puppeteer is blocked. To enable it:

1. Install Python 3.10+ with `pip`.
2. Run `pip install scrapling`.
3. (Optional) Set `SCRAPLING_PYTHON` if your Python executable is not called `python`.

The bot calls `scripts/scrapling_fragment.py` before falling back to Puppeteer. If Scrapling is missing, it logs a warning and continues with legacy scraping.

## 📄 License

MIT


