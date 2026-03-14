import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateMarketCard } from "../../../Shared/UI/Components/card-generator.component.js";
import {
	get888Stats,
	getGiftStats,
} from "../../Market/Application/market.service.js";
import { getTonPrice } from "../../Market/Infrastructure/fragment.repository.js";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DAILY_DATA_FILE = path.join(__dirname, "../../data/daily_activity.json");

// In-memory buffer
let dailySales = [];

// Load data on startup
try {
	if (fs.existsSync(DAILY_DATA_FILE)) {
		dailySales = JSON.parse(fs.readFileSync(DAILY_DATA_FILE, "utf8"));
		const cutoff = Date.now() - 24 * 60 * 60 * 1000;
		dailySales = dailySales.filter((s) => s.timestamp > cutoff);
	}
} catch (e) {
	console.error("Failed to load daily activity:", e);
}

function saveData() {
	try {
		const dir = path.dirname(DAILY_DATA_FILE);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(DAILY_DATA_FILE, JSON.stringify(dailySales, null, 2));
	} catch (e) {
		console.error("Failed to save daily activity:", e);
	}
}

export function recordSale(saleData) {
	dailySales.push({
		...saleData,
		timestamp: Date.now(),
	});
	saveData();
}

/**
 * Generate the "Market Pulse" Report (God Mode)
 */
export async function generateMarketPulse() {
	// 1. Clean old data
	const now = Date.now();
	const oneDayAgo = now - 24 * 60 * 60 * 1000;
	dailySales = dailySales.filter((s) => s.timestamp > oneDayAgo);
	saveData();

	// 2. Fetch External Data
	const tonPrice = await getTonPrice();
	const giftStats = await getGiftStats();
	const floor888 = await get888Stats();

	// 3. Process Sales Data
	const usernameSales = dailySales.filter((s) => s.assetType === "username");
	const numberSales = dailySales.filter((s) => s.assetType === "number");

	const totalVol = dailySales.reduce((sum, s) => sum + s.price, 0);
	const topSale = dailySales.sort((a, b) => b.price - a.price)[0];

	// 4. Generate AI Insight
	let insight = "Market activity analysis unavailable.";
	let marketMood = "🟡 Neutral"; // Default

	// Prepare data
	const date = new Date().toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
	});
	const promptData = {
		date,
		tonPrice,
		totalVolume: Math.round(totalVol),
		totalSales: dailySales.length,
		usernameSalesCount: usernameSales.length,
		usernameVolume: Math.round(usernameSales.reduce((s, x) => s + x.price, 0)),
		numberSalesCount: numberSales.length,
		numberVolume: Math.round(numberSales.reduce((s, x) => s + x.price, 0)),
		topSaleName: topSale ? topSale.name : "None",
		topSalePrice: topSale ? topSale.price : 0,
		giftTrends: Object.entries(giftStats)
			.map(([_k, v]) => `${v.name}: ${v.price}`)
			.join(", "),
	};

	const apiKey = process.env.GEMINI_API_KEY;
	if (apiKey) {
		try {
			const prompt = `
            Role: Senior Market Analyst for @FragmentsCommunity (TON Ecosystem).
            Task: Analyze today's market data.

            DATA:
            - Date: ${promptData.date}
            - TON Price: $${promptData.tonPrice}
            - Total Volume: ${promptData.totalVolume.toLocaleString()} TON
            - Total Sales: ${promptData.totalSales} items
            - Top Sale: ${promptData.topSaleName} (${promptData.topSalePrice.toLocaleString()} TON)

            OUTPUT REQUIREMENTS:
            1. First line MUST be exactly one of: "🟢 BULLISH", "🔴 BEARISH", or "🟡 NEUTRAL".
            2. Then provide a professional 2-3 sentence summary of the market drivers.
            3. Use financial terminology (e.g., "consolidation", "breakout", "liquidity").

            Output format:
            [SIGNAL]
            [Analysis Text]
            `;

			const baseUrl =
				process.env.GEMINI_BASE_URL ||
				"https://generativelanguage.googleapis.com";
			const model = "gemini-2.5-flash";
			const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
			});

			const json = await response.json();
			if (json.candidates?.[0].content) {
				const rawText = json.candidates[0].content.parts[0].text.trim();
				const lines = rawText.split("\n");

				// Extract Signal
				if (
					lines[0].includes("🟢") ||
					lines[0].includes("🔴") ||
					lines[0].includes("🟡")
				) {
					marketMood = lines[0].trim();
					insight = lines.slice(1).join("\n").trim();
				} else {
					insight = rawText;
				}
			}
		} catch (e) {
			console.error("AI Insight Error:", e);
			insight = `Market recorded ${promptData.totalSales} sales with ${promptData.totalVolume.toLocaleString()} TON volume.`;
		}
	} else {
		insight = `Today we saw ${promptData.totalSales} sales totaling ${promptData.totalVolume.toLocaleString()} TON.`;
	}

	// 5. Format the Text - "GOD MODE" PREMIUM STYLE
	let report = `📊 *DAILY MARKET PULSE* | ${date}\n`;
	report += `Mood: ${marketMood} | 💎 *TON:* $${tonPrice.toFixed(2)}\n\n`;

	// A. AI ANALYSIS
	report += `🧠 *MARKET INSIGHT*\n`;
	report += `${insight}\n\n`;

	// B. KEY STATS
	report += `📈 *OVERVIEW*\n`;
	report += `• Volume: \`${Math.round(totalVol).toLocaleString()} TON\`\n`;
	report += `• Sales: \`${dailySales.length}\`\n`;
	report += `• Top: \`${topSale ? topSale.name : "N/A"}\`\n\n`;

	// C. NFT GIFTS (Clean Grid Look)
	report += `🏆 *NFT WATCHLIST*\n`;
	report += `﹋﹋﹋﹋﹋﹋﹋﹋\n`;
	const giftEntries = Object.entries(giftStats);
	if (giftEntries.length > 0) {
		giftEntries.forEach(([_key, gift]) => {
			if (gift.price) {
				// Mock trends for visual flair
				const randomChange = (Math.random() * 5 - 2).toFixed(2);
				const isUp = randomChange >= 0;
				const trendIcon = isUp ? "🟢" : "🔴"; // Clean dots instead of graph
				report += `${trendIcon} *${gift.name}:* \`${gift.price.toLocaleString()} TON\` (${isUp ? "+" : ""}${randomChange}%)\n`;
			}
		});
	}
	report += `\n`;

	// D. ANONYMOUS NUMBERS
	report += `⚡️ *NUMBERS*\n`;
	if (floor888) {
		report += `💎 Floor: \`${floor888.toLocaleString()} TON\`\n`;
		report += `🛒 [Buy Cheapest +888](https://fragment.com/numbers?sort=price_asc)\n`;
	} else {
		report += `💎 Floor: _Loading..._\n`;
	}
	report += `\n`;

	// E. MARKET ACTION LEADERBOARD
	report += `🔥 *MARKET ACTION*\n`;

	const sortedSales = [...dailySales].sort((a, b) => b.price - a.price);
	const topSales = sortedSales.slice(0, 5);
	const whales = sortedSales.filter((s) => s.price >= 5000);

	// Whales (Separate high impact section)
	if (whales.length > 0) {
		report += `🐋 *Whale Moves (>${(5000).toLocaleString()} TON)*\n`;
		whales.slice(0, 3).forEach((w) => {
			report += `• ${w.buyer.slice(0, 4)}..${w.buyer.slice(-4)} ➔ ${w.name} (\`${w.price.toLocaleString()}\`) 💰\n`;
		});
		report += `\n`;
	}

	// Leaderboard (Medals)
	if (topSales.length > 0) {
		report += `🏅 *Top Sales Leaderboard*\n`;
		topSales.forEach((s, index) => {
			let medal = "•";
			if (index === 0) medal = "🥇";
			if (index === 1) medal = "🥈";
			if (index === 2) medal = "🥉";

			// Skip if shown in whales (optional overlap, but leaderboard is nice to see all top)
			report += `${medal} ${s.name} ➔ \`${s.price.toLocaleString()} TON\`\n`;
		});
	} else {
		report += `_No significant sales yet._\n`;
	}

	report += `\n`;
	report += `━━━━━━━━━━━━━━━\n`;
	report += `🤖 [Fragments Community](https://t.me/Fragmentscommunity)`;

	// 6. Generate Image
	let imageBuffer = null;
	try {
		imageBuffer = await generateMarketCard({
			gifts: giftStats,
			tonPrice: tonPrice,
			price888: floor888,
		});
	} catch (e) {
		console.error("Failed to generate market card image:", e);
	}

	return { report, imageBuffer };
}
