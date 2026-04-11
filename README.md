# 💎 iFragmentBot SuperApp
### Next-Gen Telegram Asset Indexer & Market Intelligence

[![TON Blockchain](https://img.shields.io/badge/Blockchain-TON-blue?style=flat-square&logo=blueprint)](https://ton.org)
[![Platform](https://img.shields.io/badge/Platform-Telegram-0088cc?style=flat-square&logo=telegram)](https://t.me)
[![Status](https://img.shields.io/badge/Mode-On--chain%20Indexing-success?style=flat-square)](https://tonapi.io)

**iFragmentBot** is a high-performance, real-time indexer for Telegram assets (Usernames, Numbers, and Gifts). Unlike traditional bots that rely on unstable web scraping, iFragmentBot connects directly to the **TON Blockchain** to provide accurate, non-blockable market data.

---

## 🚀 Key Features

*   **⚡ Real-time Indexing:** Zero dependency on fragment.com frontend. Data is fetched directly from on-chain indexers (TonAPI).
*   **🎁 Gift Market Mastery:** Accurate floor prices for every specific Telegram Gift model (Doge, Cake, Pepe, etc.) across multiple marketplaces.
*   **🧩 Dynamic Template Engine:** Full control over bot reports using custom placeholders like `{Floor-tonnel}` or `{Gift-Name}`.
*   **🖼️ Premium Flex Cards:** Auto-generated, high-fidelity visual reports for high-value assets.
*   **📊 Cross-Market Analytics:** Aggregated data from **Tonnel.network**, **Portals**, and **GetGems**.
*   **🧠 Intelligent Resolver:** Simply paste a `t.me/nft/...` link or a contract address, and the bot automatically resolves the model and its live floor.

---

## 🛠️ Dynamic Variable Guide (Template Engine)

Customize your bot's responses using these live placeholders:

| Variable | Description | Example Output |
| :--- | :--- | :--- |
| `{Floor-global}` | Lowest price of any gift in the entire TON network | `45.5 TON` |
| `{Floor-tonnel}` | Lowest price specifically on Tonnel.network marketplace | `46.0 TON` |
| `{Gift-Name}` | The resolved name of a specific gift link | `Plush Pepe` |
| `{Specific-Floor-Global}` | The floor price for the specific model you linked | `17500 TON` |
| `{Market-Name}` | The source marketplace of the cheapest item | `Getgems` |

---

## 🔧 Technical Architecture

The bot is built with a modular, **Event-Driven** architecture:
- **Core:** Node.js + Telegraf (Telegram Bot API)
- **Data Layer:** SQLite (via Better-SQLite3) for local persistence.
- **Intelligence Layer:** Custom **GiftIndexer** service with Regex-based Link Resolution.
- **Provider:** Powered by **TonAPI.io** for reliable on-chain data retrieval.
- **Styling:** Premium SVG-to-Image generation for Flex Cards.

---

## 📥 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YourRepo/iFragmentBot.git
   cd iFragmentBot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file based on `.env.example`:
   ```bash
   BOT_TOKEN="your_telegram_bot_token"
   ADMIN_ID="your_telegram_id"
   DATABASE_PATH="./data/panel.db"
   ```

4. **Launch:**
   ```bash
   npm start
   ```

---

## 🌐 Deployment Logic

The bot is optimized for 24/7 uptime on **Render**, **Railway**, or **VPS (PM2)**.

- **Non-Scraping:** No need for costly proxies or browser-management overhead.
- **Stateless Intelligence:** The mapping logic is algorithmic, ensuring ultra-low memory usage even with high concurrent traffic.

---

## 📄 License
Proudly developed as a premium tool for the TON ecosystem. Under MIT License.

---
*Created by Antigravity for iFragment SuperApp Ecosystem.*
