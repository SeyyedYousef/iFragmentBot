/**
 * Report Helper Module v3.0 — SUPREME EDITION
 * World-class report generation for username & gift valuation.
 * Features: Score bars, heatmaps, competitive analysis, confidence gauges.
 * Extracted from bot.entry.js to reduce monolith size.
 */

import { GOLDEN_DICTIONARY } from "../../core/Config/app.config.js";

/**
 * Escape Markdown V1 special characters in text
 * Prevents Telegram "can't parse entities" errors from AI-generated text
 */
export function escapeMD(text) {
	if (!text) return "";
	return String(text)
		.replace(/\\/g, "\\\\") // Escape backslashes first!
		.replace(/\*/g, "\\*")
		.replace(/_/g, "\\_")
		.replace(/`/g, "\\`")
		.replace(/\[/g, "\\[")
		.replace(/\]/g, "\\]");
}

/**
 * Validate Telegram username format
 */
export function isValidUsername(username) {
	return /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username);
}

/**
 * Format number with commas
 */
export function formatNum(num) {
	if (!num && num !== 0) return "—";
	return Math.floor(num).toLocaleString("en-US");
}

/**
 * Format number with K/M suffix for compact display
 */
function _formatCompact(num) {
	if (!num && num !== 0) return "—";
	if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
	if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
	return Math.floor(num).toLocaleString("en-US");
}

/**
 * Draw a text-based progress bar (10 blocks)
 */
export function drawProgressBar(percent) {
	const filledCount = Math.min(10, Math.max(0, Math.round(percent / 10)));
	const emptyCount = 10 - filledCount;
	return "█".repeat(filledCount) + "░".repeat(emptyCount);
}

/**
 * Draw a compact 5-block bar
 */
export function drawBar(score) {
	const filled = Math.min(5, Math.max(0, Math.round((score / 100) * 5)));
	return "▮".repeat(filled) + "▯".repeat(5 - filled);
}

/**
 * Draw a 7-block precision bar with gradient
 */
function _drawGradientBar(score) {
	const blocks = ["░", "▒", "▓", "█"];
	const total = 7;
	const filledFull = Math.floor((score / 100) * total);
	const remainder = (score / 100) * total - filledFull;
	let bar = "█".repeat(filledFull);
	if (filledFull < total) {
		const partialIdx = Math.min(3, Math.floor(remainder * 4));
		bar += blocks[partialIdx];
		bar += "░".repeat(total - filledFull - 1);
	}
	return bar;
}

/**
 * Get human-readable label for a score
 */
export function getScoreLabel(score, type) {
	if (type === "speed") {
		if (score >= 90) return "Instant";
		if (score >= 75) return "Very Fast";
		if (score >= 50) return "Moderate";
		if (score >= 25) return "Slow";
		return "Illiquid";
	}
	if (type === "confidence") {
		if (score >= 90) return "🎯 Certain";
		if (score >= 75) return "✅ High";
		if (score >= 55) return "📊 Good";
		if (score >= 35) return "⚡ Fair";
		return "⚠️ Low";
	}
	if (type === "risk") {
		if (score >= 80) return "🟢 Low Risk";
		if (score >= 60) return "🟡 Moderate";
		if (score >= 40) return "🟠 Elevated";
		return "🔴 High Risk";
	}
	return "";
}

/**
 * Get quality badge based on username characteristics
 */
export function getQualityBadge(username, tier) {
	const len = username.length;
	const hasNumbers = /\d/.test(username);
	const hasUnderscore = /_/.test(username);

	// Premium indicators
	if (tier === "God Tier") return "👑 Godlike";
	if (tier === "Mythic") return "🌟 Legendary";
	if (tier === "Apex") return "💎 Premium";
	if (tier === "Legendary") return "✨ High-Value";
	if (tier === "Grand") return "⭐ Valuable";
	if (tier === "Rare") return "🔷 Quality";
	if (tier === "Uncommon") return "🔹 Standard";
	if (tier === "Common") return "📌 Basic";
	if (tier === "Scrap") return "📉 Low";
	if (tier === "Worthless") return "🗑️ Junk";

	// Legacy tiers (backwards compatibility)
	if (tier === "S-Tier") return "🌟 Legendary";
	if (tier === "A-Tier") return "💎 Premium";
	if (len <= 4 && !hasNumbers && !hasUnderscore) return "✨ Ultra-Rare";
	if (len <= 5 && !hasNumbers) return "⭐ High-Value";
	if (len <= 6) return "🔷 Quality";
	if (hasNumbers || hasUnderscore) return "🔹 Standard";
	return "📌 Basic";
}

/**
 * Analyze word type — Enhanced with more detail
 */
export function analyzeWordType(username) {
	const hasNumbers = /\d/.test(username);
	const hasUnderscore = /_/.test(username);
	const len = username.length;
	const isAllLetters = /^[a-zA-Z]+$/.test(username);

	const vowels = (username.match(/[aeiou]/gi) || []).length;
	const vowelRatio = vowels / len;
	const isPronouceable = vowelRatio >= 0.25 && vowelRatio <= 0.55;

	if (len <= 3 && isAllLetters) return "Ultra-Rare";
	if (len === 4 && isAllLetters && isPronouceable) return "4L Premium";
	if (len === 4 && isAllLetters) return "4L Asset";
	if (len === 5 && isAllLetters && isPronouceable) return "5L Word";
	if (len === 5 && isAllLetters) return "5L Handle";

	if (/^\d+$/.test(username)) return "Numeric";
	if (/^[a-z]+bot$/i.test(username)) return "Bot Handle";
	if (hasNumbers && hasUnderscore) return "Complex";
	if (hasNumbers) return "Alphanum";
	if (hasUnderscore) return "Compound";

	if (len <= 6 && isPronouceable) return "Short Word";
	if (len <= 8 && isPronouceable) return "Dictionary";
	if (len <= 8) return "Handle";
	if (isPronouceable) return "Long Word";

	return "Standard";
}

/**
 * Get trend indicator based on tier
 */
export function getTrendIndicator(tier) {
	switch (tier) {
		case "God Tier":
			return "🔥🔥 Explosive";
		case "Mythic":
			return "🔥 Hot";
		case "Apex":
			return "📈 Rising Fast";
		case "Legendary":
			return "📈 Rising";
		case "Grand":
			return "📊 High Interest";
		case "Rare":
			return "✨ Promising";
		case "Uncommon":
			return "➡️ Stable";
		case "Common":
			return "📊 Normal";
		case "Scrap":
			return "💤 Sleeper";
		case "Worthless":
			return "📉 Low";
		// Legacy
		case "S-Tier":
			return "🔥 Hot";
		case "A-Tier":
			return "📈 Rising";
		case "B-Tier":
			return "➡️ Stable";
		case "C-Tier":
			return "💤 Sleeper";
		case "D-Tier":
			return "📉 Low";
		default:
			return "➖ N/A";
	}
}

/**
 * Get perfect use cases for a username
 */
export function getPerfectFor(username) {
	const lower = username.toLowerCase();

	const categories = [
		{
			keywords: [
				"game",
				"play",
				"gaming",
				"clash",
				"pubg",
				"fortnite",
				"minecraft",
				"roblox",
				"valorant",
				"esport",
				"twitch",
				"stream",
				"gamer",
				"clan",
				"guild",
			],
			result: "🎮 Gaming/Esports",
		},
		{
			keywords: [
				"crypto",
				"bitcoin",
				"nft",
				"token",
				"coin",
				"btc",
				"eth",
				"ton",
				"defi",
				"wallet",
				"web3",
				"chain",
				"swap",
				"stake",
			],
			result: "₿ Crypto/Web3",
		},
		{
			keywords: [
				"shop",
				"store",
				"buy",
				"sell",
				"market",
				"mall",
				"deal",
				"sale",
				"trade",
				"price",
			],
			result: "🛒 E-commerce",
		},
		{
			keywords: [
				"news",
				"media",
				"press",
				"daily",
				"times",
				"post",
				"report",
				"journal",
			],
			result: "📰 Media/News",
		},
		{
			keywords: [
				"tech",
				"dev",
				"code",
				"ai",
				"bot",
				"app",
				"cyber",
				"data",
				"cloud",
				"hack",
				"smart",
				"digital",
			],
			result: "💻 Tech/Dev",
		},
		{
			keywords: [
				"music",
				"art",
				"film",
				"movie",
				"song",
				"beat",
				"studio",
				"dj",
				"record",
				"design",
			],
			result: "🎨 Creative",
		},
		{
			keywords: [
				"travel",
				"tour",
				"fly",
				"hotel",
				"trip",
				"vacation",
				"explore",
				"world",
			],
			result: "✈️ Travel",
		},
		{
			keywords: [
				"food",
				"eat",
				"cook",
				"chef",
				"pizza",
				"burger",
				"coffee",
				"cafe",
				"restaurant",
			],
			result: "🍕 Food/Lifestyle",
		},
		{
			keywords: [
				"fashion",
				"style",
				"wear",
				"brand",
				"luxury",
				"designer",
				"beauty",
			],
			result: "👗 Fashion",
		},
		{
			keywords: [
				"health",
				"fit",
				"gym",
				"sport",
				"yoga",
				"workout",
				"wellness",
			],
			result: "💪 Fitness",
		},
		{
			keywords: [
				"king",
				"queen",
				"god",
				"boss",
				"elite",
				"alpha",
				"legend",
				"master",
				"prince",
				"lord",
			],
			result: "👑 Personal Brand",
		},
		{
			keywords: [
				"wolf",
				"lion",
				"tiger",
				"eagle",
				"dragon",
				"phoenix",
				"fire",
				"storm",
				"shark",
				"hawk",
			],
			result: "🔥 Bold Brands",
		},
		{
			keywords: [
				"love",
				"heart",
				"cute",
				"sweet",
				"angel",
				"beauty",
				"dream",
				"star",
				"moon",
			],
			result: "💖 Lifestyle/Social",
		},
		{
			keywords: [
				"bank",
				"fund",
				"invest",
				"finance",
				"capital",
				"forex",
				"stock",
				"money",
				"cash",
				"pay",
			],
			result: "🏦 Finance",
		},
		{
			keywords: [
				"edu",
				"learn",
				"study",
				"school",
				"course",
				"teach",
				"tutor",
				"academy",
			],
			result: "📚 Education",
		},
	];

	for (const cat of categories) {
		if (cat.keywords.some((w) => lower.includes(w))) {
			return cat.result;
		}
	}

	if (username.length <= 4) return "💎 Premium VIP";
	if (username.length <= 6) return "🏷️ Brand/Personal";
	return "🌐 General Use";
}

function safeNum(n, fallback = null) {
	const x = typeof n === "string" ? parseFloat(n) : n;
	return Number.isFinite(x) ? x : fallback;
}

function formatPct(p, digits = 0) {
	if (!Number.isFinite(p)) return "—";
	const sign = p > 0 ? "+" : "";
	return `${sign}${p.toFixed(digits)}%`;
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function getConfidenceLabel(score) {
	if (score >= 90) return "🎯 Certain";
	if (score >= 75) return "✅ High";
	if (score >= 55) return "📊 Good";
	if (score >= 35) return "⚡ Fair";
	return "⚠️ Low";
}

/**
 * Calculate Liquidity Score (0-100) based on username characteristics
 */
function calculateLiquidityScore(username, tier, estValue) {
	let score = 50; // Base

	const len = username.replace("@", "").length;
	const isAllLetters = /^[a-zA-Z]+$/.test(username);
	const isPronouceable =
		(username.match(/[aeiou]/gi) || []).length / len >= 0.25;

	// Length bonuses
	if (len <= 4) score += 30;
	else if (len <= 5) score += 20;
	else if (len <= 6) score += 10;
	else if (len >= 10) score -= 15;

	// Quality bonuses
	if (isAllLetters) score += 10;
	if (isPronouceable) score += 10;
	if (/[_]/.test(username)) score -= 15;
	if (/\d/.test(username)) score -= 10;

	// Tier bonuses
	const tierBonuses = {
		"God Tier": 20,
		Mythic: 15,
		Apex: 10,
		Legendary: 8,
		Grand: 5,
		Rare: 3,
		Uncommon: 0,
		Common: -5,
		Scrap: -15,
		Worthless: -25,
	};
	score += tierBonuses[tier] || 0;

	// AI liquidity score override
	if (estValue?.aiScores?.liquidity) {
		score = Math.round(score * 0.4 + estValue.aiScores.liquidity * 0.6);
	}

	return Math.max(0, Math.min(100, score));
}

/**
 * Calculate Risk Score (0-100, higher = safer)
 */
function calculateRiskScore(username, estValue) {
	let score = 50;
	const len = username.replace("@", "").length;

	if (len <= 5) score += 20;
	if (estValue?.confidence >= 80) score += 15;
	else if (estValue?.confidence >= 60) score += 5;
	else score -= 10;

	if (estValue?.isAi) score += 10; // AI-backed valuation is more reliable
	if (estValue?.factors?.length > 3) score += 5;

	// Penalize low-value assets (more speculative)
	if (estValue?.ton < 50) score -= 20;
	else if (estValue?.ton < 500) score -= 10;
	else if (estValue?.ton >= 10000) score += 10;

	return Math.max(0, Math.min(100, score));
}

/**
 * Build FULL detailed caption — SUPREME PREMIUM FORMAT
 */
function resolveDefinition(rawUsername, estValue) {
	const lower = rawUsername.toLowerCase();
	const golden = GOLDEN_DICTIONARY[lower];
	const linguistics = estValue.linguistics?.meaning;
	const aiDef = estValue.aiDefinition;
	const raw = golden || linguistics || aiDef;
	if (raw && raw !== "None" && raw !== "N/A" && raw !== "Gibberish") return raw;
	if (/[0-9_]/.test(rawUsername)) return "Alphanumeric handle";
	if (/^[a-z]{5,}$/.test(lower) && !/[aeiou]{2,}/.test(lower))
		return "Random string";
	return "Personal handle";
}

export function buildFullCaption(
	data,
	_cardData,
	tonPrice,
	rarity,
	estValue,
	_suggestions = [],
) {
	const username = data.username
		.replace("@", "")
		.toUpperCase()
		.split("")
		.join(" ");
	const rawUsername = data.username.replace("@", "");
	const definition = resolveDefinition(rawUsername, estValue);

	const statusIcons = {
		sold: "🔴 Sold",
		for_sale: "🟡 For Sale",
		on_auction: "🔨 Auction",
		available: "🟢 Available",
		taken: "⚫ Taken",
	};

	const valTon = formatNum(estValue.ton);
	const valUsd = formatNum(estValue.usd);
	const _lastSale = data.lastSalePrice
		? `${formatNum(data.lastSalePrice)} TON`
		: "—";
	const tier = rarity.tier || "Unknown";
	const confidence = estValue.confidence || 70;

	// ---- Market data normalization (from Fragment scrape) ----
	const listingTon = safeNum(data.priceTon, null);
	const highestBidTon = safeNum(data.highestBid, null);
	const minBidTon = safeNum(data.minBid, null);

	const marketPriceTon = Number.isFinite(listingTon)
		? listingTon
		: Number.isFinite(highestBidTon)
			? highestBidTon
			: Number.isFinite(minBidTon)
				? minBidTon
				: null;

	// ---- Policy floor: Telegram 4-char minimum 5050 TON ----
	const POLICY_FLOOR_4L = 5050;

	// ---- Comparable baseline (if AI oracle provided) ----
	const baselineMedian = safeNum(estValue.aiScores?.similar_median, null); // optional if AI provides it
	const baselineAvg = safeNum(estValue.aiScores?.similar_avg, null);
	const baseline = Number.isFinite(baselineMedian)
		? baselineMedian
		: Number.isFinite(baselineAvg)
			? baselineAvg
			: null;

	// ---- Gaps ----
	const gapVsMarket =
		Number.isFinite(marketPriceTon) && marketPriceTon > 0
			? (estValue.ton / marketPriceTon - 1) * 100
			: null;
	const gapVsBaseline =
		Number.isFinite(baseline) && baseline > 0
			? (estValue.ton / baseline - 1) * 100
			: null;

	// ---- Data quality score (simple, deterministic) ----
	// (No "historical 7/30/90d" section anymore as requested)
	let dq = 40;
	if (Number.isFinite(marketPriceTon)) dq += 20;
	if (data.lastSalePrice) dq += 20;
	if (baseline) dq += 10;
	if (estValue.isAi) dq += 10;
	dq = clamp(dq, 0, 100);
	const dqLevel =
		dq >= 85 ? "EXCELLENT" : dq >= 70 ? "GOOD" : dq >= 50 ? "FAIR" : "LOW";

	// ---- Liquidity & risk ----
	const liquidity = calculateLiquidityScore(rawUsername, tier, estValue);
	const risk = calculateRiskScore(rawUsername, estValue);

	// 💎 HEADER
	let msg = `💎 *${escapeMD(username)}*\n`;
	msg += `_${escapeMD(definition)}_\n`;
	const dictMeaning =
		GOLDEN_DICTIONARY[rawUsername.toLowerCase()] ||
		estValue.linguistics?.meaning;
	if (dictMeaning) msg += `📖 *Literal Meaning:* _${escapeMD(dictMeaning)}_\n`;
	msg += `\n`;

	// 💰 FAIR VALUE (EST.)
	msg += `――――― 💰 *FAIR VALUE (EST.)* ―――――\n`;
	msg += `▸ 🏷️  *${valTon} TON*  (~$${valUsd})\n`;
	msg += `▸ ${rarity.stars || "⭐"} *${escapeMD(tier)}* • ${escapeMD(rarity.label || "Asset")}\n`;
	msg += `▸ 🎯 Confidence: *${getConfidenceLabel(confidence)}* (${confidence}%)\n`;
	msg += `▸ 🧾 Data Quality: *${dqLevel}* (${dq}/100)\n`;

	// Policy floor line (explicit)
	if (rawUsername.length === 4) {
		msg += `▸ 📌 Hard Floor (Telegram): *${formatNum(POLICY_FLOOR_4L)} TON*\n`;
	}

	if (Number.isFinite(gapVsMarket)) {
		msg += `▸ 📊 Gap vs Listing: *${formatPct(gapVsMarket)}*\n`;
	}
	if (Number.isFinite(gapVsBaseline)) {
		msg += `▸ 📊 Gap vs Comparable Baseline: *${formatPct(gapVsBaseline)}*\n`;
	}
	msg += `\n`;

	// 📊 MARKET SNAPSHOT
	msg += `――――― 📊 *MARKET SNAPSHOT* ―――――\n`;
	msg += `▸ Status: ${statusIcons[data.status] || "⚪ Unknown"}\n`;
	if (Number.isFinite(listingTon))
		msg += `▸ Listing: *${formatNum(listingTon)} TON* (Buy Now)\n`;
	else if (Number.isFinite(highestBidTon) || Number.isFinite(minBidTon)) {
		if (Number.isFinite(highestBidTon))
			msg += `▸ Highest Bid: *${formatNum(highestBidTon)} TON*\n`;
		if (Number.isFinite(minBidTon))
			msg += `▸ Min Bid: *${formatNum(minBidTon)} TON*\n`;
	}
	if (data.lastSalePrice)
		msg += `▸ Last Sale: *${formatNum(data.lastSalePrice)} TON*\n`;
	msg += `▸ Fragment: ${escapeMD(data.url || `https://fragment.com/username/${rawUsername}`)}\n`;
	if (data.ownerWallet)
		msg += `▸ Owner: \`${data.ownerWallet.slice(0, 4)}...${data.ownerWallet.slice(-4)}\`\n`;
	msg += `\n`;

	// 🔍 MARKET POSITION
	msg += `――――― 🔍 *MARKET POSITION* ―――――\n`;
	const segment = getPerfectFor(rawUsername); // coarse but deterministic
	msg += `▸ Segment: *${escapeMD(segment)}*\n`;
	msg += `▸ Liquidity: *${liquidity}/100* (${escapeMD(getScoreLabel(liquidity, "speed"))})  •  Risk: *${risk}/100* (${escapeMD(getScoreLabel(risk, "risk"))})\n`;
	if (estValue.aiScores?.moat)
		msg += `▸ Moat: *${formatNum(estValue.aiScores.moat)}*/100\n`;
	if (estValue.aiTrend) msg += `▸ Momentum: *${escapeMD(estValue.aiTrend)}*\n`;
	msg += `\n`;

	// 🧬 LINGUISTIC DNA
	msg += `――――― 🧬 *LINGUISTIC & BRANDABILITY* ―――――\n`;

	if (estValue.linguistics) {
		const pron = estValue.linguistics.pronunciation;
		const syl = estValue.linguistics.syllables;
		const hasPron = pron && pron !== "N/A" && pron !== "None";
		const hasSyl = syl && syl !== "N/A" && syl !== "None";

		if (hasPron) msg += `🗣 /${escapeMD(pron)}/`;
		if (hasSyl)
			msg += `${hasPron ? " • " : ""}🎼 ${escapeMD(String(syl))} syl\n`;
		else if (hasPron) msg += `\n`;

		const recallVal = Number(estValue.linguistics.recall) || 0;
		const typeVal = Number(estValue.linguistics.typability) || 0;
		if (recallVal > 0) {
			const recallLabel =
				recallVal >= 9
					? "Exceptional"
					: recallVal >= 7
						? "High"
						: recallVal >= 4
							? "Medium"
							: "Low";
			msg += `🧠 Recall: *${recallVal}/10* (${recallLabel})\n`;
		}
		if (typeVal > 0) {
			const typeLabel =
				typeVal >= 9
					? "Effortless"
					: typeVal >= 7
						? "Easy"
						: typeVal >= 4
							? "Moderate"
							: "Clunky";
			msg += `⌨️ Type: *${typeVal}/10* (${typeLabel})\n`;
		}
	} else {
		// Fallback calculations if AI didn't return linguistic data
		const len = rawUsername.length;
		const vowels = (rawUsername.match(/[aeiou]/gi) || []).length;
		const syllables = Math.max(1, Math.round(len / 2.5));
		const isPronounceable = vowels / len >= 0.25;

		msg += `🗣 /${escapeMD(rawUsername).toLowerCase()}/ • 🎼 ${syllables} syl\n`;
		msg += `🧠 Recall: *${isPronounceable ? "High" : "Medium"}*\n`;
		msg += `⌨️ Type: *${/\d/.test(rawUsername) ? "Alphanumeric" : "Standard"}*\n`;
	}
	msg += `\n`;

	// 🎯 STRATEGIC UTILITY
	msg += `――――― 🎯 *STRATEGIC UTILITY* ―――――\n`;
	if (estValue.aura?.archetype)
		msg += `▸ Archetype: *${escapeMD(estValue.aura.archetype)}*\n`;
	if (estValue.best_for && estValue.best_for.length > 0) {
		msg += `▸ Perfect For:\n`;
		estValue.best_for.slice(0, 6).forEach((b) => {
			msg += `   • ${escapeMD(b)}\n`;
		});
	} else {
		msg += `▸ Perfect For: ${escapeMD(getPerfectFor(rawUsername))}\n`;
	}
	msg += `\n`;

	// 🔬 ANALYSIS (Restored/Fixed)
	const lingType = estValue.linguistics?.type || analyzeWordType(rawUsername);
	msg += `――――― 🔬 *ORACLE ANALYSIS* ―――――\n`;
	msg += `▸ Class: *${escapeMD(lingType)}*\n`;

	if (estValue.aiReasoning) {
		let reasoning = estValue.aiReasoning;
		// Smart truncation: try to end at a sentence boundary
		// Keep it verbose (no short version), but still safe for Telegram length:
		if (reasoning.length > 500) reasoning = `${reasoning.substring(0, 497)}...`;
		reasoning = escapeMD(reasoning);
		msg += `▸ AI Verdict:\n_${reasoning}_\n`;
	}
	msg += `\n`;

	// 🔮 VIBE CHECK
	if (estValue.aura?.vibe) {
		msg += `――――― 🔮 *VIBE CHECK* ―――――\n`;
		msg += `_${escapeMD(estValue.aura.vibe)}_\n\n`;
	}

	// 💧 LIQUIDITY & RISK PROFILE
	msg += `――――― 💧 *LIQUIDITY & RISK PROFILE* ―――――\n`;
	msg += `▸ Liquidity Score: *${liquidity}/100* → \`${drawBar(liquidity)}\`\n`;
	msg += `▸ Risk Score: *${risk}/100* → \`${drawBar(risk)}\`\n`;
	msg += `\n`;

	// 🧪 COMPARABLES (only real comparables, never _bot or x suffix)
	const similarSources = estValue.similar || estValue.factors || [];
	const allSimilar = (
		Array.isArray(similarSources) ? similarSources : [similarSources]
	)
		.filter((f) => f && typeof f === "string" && f.startsWith("@"))
		.filter((f) => !/_bot/i.test(f))
		.slice(0, 6);

	if (allSimilar.length > 0) {
		msg += `――――― 📊 *COMPARABLES* ―――――\n`;
		allSimilar.forEach((f) => (msg += `▸ ${escapeMD(f)}\n`));
		msg += `\n`;
	}

	// 🧠 INVESTMENT SIGNAL
	msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
	let signal = "HOLD";
	if (Number.isFinite(gapVsMarket) && gapVsMarket < -10 && confidence >= 60)
		signal = "BUY";
	if (Number.isFinite(gapVsMarket) && gapVsMarket > 25 && confidence >= 60)
		signal = "TAKE PROFIT";
	msg += `MARKET SIGNAL: **${signal}**\n`;
	if (Number.isFinite(gapVsMarket)) {
		msg += `_${gapVsMarket < 0 ? "Undervalued" : "Overvalued"} by ~${Math.abs(Math.round(gapVsMarket))}% vs current listing with ${confidence}% confidence._\n`;
	}
	msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

	// ⚡ FOOTER
	msg += `\n⚡ Generated by @iFragmentBot\n`;
	msg += `💹 TON: $${safeNum(tonPrice, 0)?.toFixed ? tonPrice.toFixed(2) : tonPrice}`;

	return msg;
}

/**
 * Generate professional comparison report — UPGRADED with new tier system
 */
export function generateComparisonReport(item1, item2, tonPrice) {
	const {
		username: u1,
		data: d1,
		rarity: r1,
		estValue: v1,
		insight: i1,
	} = item1;
	const {
		username: u2,
		data: d2,
		rarity: r2,
		estValue: v2,
		insight: i2,
	} = item2;

	// New tier scoring system (matches TheOracle.getTier())
	const tierScores = {
		"God Tier": 10,
		Mythic: 9,
		Apex: 8,
		Legendary: 7,
		Grand: 6,
		Rare: 5,
		Uncommon: 4,
		Common: 3,
		Scrap: 2,
		Worthless: 1,
		// Legacy backward compat
		"S-Tier": 9,
		"A-Tier": 7,
		"B-Tier": 5,
		"C-Tier": 3,
		"D-Tier": 1,
	};

	let msg = `🆚 *USERNAME BATTLE*\n`;
	msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

	// ═══ FIGHTER 1 ═══
	const badge1 = getQualityBadge(u1, r1.tier);
	msg += `🥊 *@${escapeMD(u1)}*  ${badge1}\n`;
	msg += `├ 💰 Value: *${formatNum(v1.ton)} TON* ($${formatNum(v1.usd)})\n`;
	msg += `├ ⭐ Rarity: ${r1.stars} ${escapeMD(r1.tier)}\n`;
	msg += `├ 📏 Length: ${u1.length} chars\n`;
	msg += `├ 📊 Status: ${escapeMD(d1.statusText || "Unknown")}\n`;
	if (i1) msg += `└ 🤖 AI: _${escapeMD(i1)}_\n`;
	else msg += `└ 📈 Trend: ${getTrendIndicator(r1.tier)}\n`;
	msg += `\n`;

	// ═══ FIGHTER 2 ═══
	const badge2 = getQualityBadge(u2, r2.tier);
	msg += `🥊 *@${escapeMD(u2)}*  ${badge2}\n`;
	msg += `├ 💰 Value: *${formatNum(v2.ton)} TON* ($${formatNum(v2.usd)})\n`;
	msg += `├ ⭐ Rarity: ${r2.stars} ${escapeMD(r2.tier)}\n`;
	msg += `├ 📏 Length: ${u2.length} chars\n`;
	msg += `├ 📊 Status: ${escapeMD(d2.statusText || "Unknown")}\n`;
	if (i2) msg += `└ 🤖 AI: _${escapeMD(i2)}_\n`;
	else msg += `└ 📈 Trend: ${getTrendIndicator(r2.tier)}\n`;
	msg += `\n`;

	// ═══ HEAD-TO-HEAD ANALYSIS ═══
	msg += `━━━ 📊 *HEAD-TO-HEAD* ━━━\n\n`;

	// Value comparison
	const valueDiff =
		v2.ton !== 0 ? (((v1.ton - v2.ton) / v2.ton) * 100).toFixed(0) : 0;
	const valueWinner = v1.ton > v2.ton ? u1 : u2;
	const valueSign = v1.ton > v2.ton ? "+" : "";
	const valueRatio =
		v1.ton > 0 && v2.ton > 0
			? (Math.max(v1.ton, v2.ton) / Math.min(v1.ton, v2.ton)).toFixed(1)
			: "∞";
	msg += `💰 *Value:* ${valueSign}${valueDiff}% → @${escapeMD(valueWinner)} (${valueRatio}x)\n`;

	// Rarity comparison
	const r1Score = tierScores[r1.tier] || 0;
	const r2Score = tierScores[r2.tier] || 0;
	const rarityWinner = r1Score >= r2Score ? u1 : u2;
	const rarityDiff = Math.abs(r1Score - r2Score);
	msg += `⭐ *Rarity:* ${rarityDiff > 0 ? `+${rarityDiff} tier${rarityDiff > 1 ? "s" : ""}` : "Tied"} → @${escapeMD(rarityWinner)}\n`;

	// Length comparison
	const lengthWinner = u1.length <= u2.length ? u1 : u2;
	msg += `📏 *Shorter:* @${escapeMD(lengthWinner)} (${Math.min(u1.length, u2.length)} chars)\n`;

	// Liquidity comparison
	const liq1 = calculateLiquidityScore(u1, r1.tier, v1);
	const liq2 = calculateLiquidityScore(u2, r2.tier, v2);
	const liqWinner = liq1 >= liq2 ? u1 : u2;
	msg += `💧 *Liquidity:* ${Math.max(liq1, liq2)}% → @${escapeMD(liqWinner)}\n\n`;

	// ═══ AI VERDICT ═══
	msg += `━━━ 🏆 *AI VERDICT* ━━━\n\n`;

	let score1 = 0,
		score2 = 0;

	// Value (weight: 3)
	if (v1.ton > v2.ton) score1 += 3;
	else if (v2.ton > v1.ton) score2 += 3;

	// Rarity (weight: 2)
	if (r1Score > r2Score) score1 += 2;
	else if (r2Score > r1Score) score2 += 2;

	// Length (weight: 1)
	if (u1.length < u2.length) score1 += 1;
	else if (u2.length < u1.length) score2 += 1;

	// Liquidity (weight: 2)
	if (liq1 > liq2) score1 += 2;
	else if (liq2 > liq1) score2 += 2;

	const totalPoints = score1 + score2 || 1;
	const winPercent = Math.round((Math.max(score1, score2) / totalPoints) * 100);
	const overallWinner = score1 >= score2 ? u1 : u2;
	const _overallLoser = score1 >= score2 ? u2 : u1;

	const winReasons = [];
	if (v1.ton > v2.ton && score1 > score2) winReasons.push("higher valuation");
	else if (v2.ton > v1.ton && score2 > score1)
		winReasons.push("higher valuation");
	if (r1Score > r2Score && score1 > score2) winReasons.push("superior rarity");
	else if (r2Score > r1Score && score2 > score1)
		winReasons.push("superior rarity");
	if (liq1 > liq2 && score1 > score2) winReasons.push("better liquidity");
	else if (liq2 > liq1 && score2 > score1) winReasons.push("better liquidity");

	const winReason =
		winReasons.length > 0 ? winReasons.join(" & ") : "overall advantage";

	msg += `🏅 *Winner:* @${escapeMD(overallWinner)} (${winPercent}% confidence)\n`;
	msg += `📊 Score: @${escapeMD(u1)} ${score1} vs ${score2} @${escapeMD(u2)}\n`;
	msg += `💡 _${winReason} with stronger investment profile._\n\n`;

	msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
	msg += `💹 *TON:* $${tonPrice.toFixed(2)} • @iFragmentBot`;

	return msg;
}
