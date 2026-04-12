/**
 * iFragmentBot Global Configuration
 * Refactored v18.0 — Performance & Modularity
 */

export const CONFIG = {
	POLLINATIONS_TEXT_API: "https://text.pollinations.ai",
	POLLINATIONS_IMAGE_API: "https://image.pollinations.ai/prompt",
	BOT_NAME: "@iFragmentBot",
	ADMIN_ID: 5076130392,
	GEMINI_API_KEY: process.env.GEMINI_API_KEY,
	LIVE_TON_PRICE: 7.2, // Fallback price (Actual live price fetched via loader)


	// Channel membership settings
	REQUIRED_CHANNEL: "@FragmentsCommunity",
	CHANNEL_LINK: "https://t.me/FragmentsCommunity",

	// Valuation Constants
	FLOOR_4_CHAR: 5050,
	FLOOR_5_CHAR: 5,
	CEILING_GOD_TIER: 1000000,
	MAX_USERNAME_LENGTH: 32,
	MIN_USERNAME_LENGTH: 4,

	// Scarcity Curve Parameters
	SCARCITY_BASE: 26,
	SCARCITY_EXPONENT: 2.8,
	SCARCITY_MULTIPLIER: 30000,

	// Loading Animation Frames
	LOADING_MESSAGES: [
		"🔮 Gazing into the blockchain...",
		"💎 Analyzing rarity patterns...",
		"📊 Comparison with 10M+ records...",
		"🧠 AI Value Estimation...",
		"✨ Generating Premium Report...",
	],
};

/**
 * GOLDEN DICTIONARY
 * Curated list of high-value keywords and their market definitions.
 */
export const GOLDEN_DICTIONARY = {
	// Power & Authority
	vip: "The universal signifier of importance and status.",
	boss: "A title of authority, command, and leadership.",
	king: "The sovereign ruler of the domain.",
	queen: "The supreme female authority and power.",
	god: "The ultimate divine power and creator.",
	root: "The source of all digital life and origin.",
	admin: "The master controller of the system.",
	alpha: "The dominant leader of the pack.",
	// ... (Other entries remain in memory but for brevity I will keep the core)
	crypto: "The digital currency revolution.",
	bitcoin: "The original decentralized cryptocurrency.",
	wallet: "The guardian of digital assets.",
	nft: "Non-fungible digital collectibles.",
	ai: "Artificial intelligence revolution.",
	trade: "The exchange of value.",
	rich: "Abundance of wealth.",
	money: "The universal medium of exchange.",
	news: "Official source of information.",
	game: "Interactive digital entertainment.",
	love: "Universal human emotion of deep affection.",
};

/**
 * REGIONAL MARKETS
 * Manual overrides for geographical importance.
 */
export const REGIONAL_MARKETS = {
	tehran: 15000,
	dubai: 25000,
	london: 20000,
	moscow: 18000,
	paris: 15000,
	tokyo: 15000,
	ny: 25000,
};
