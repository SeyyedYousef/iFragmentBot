// ========================================================================================================
//   ████████╗██╗  ██╗███████╗     ██████╗ ██████╗  █████╗  ██████╗██╗     ███████╗
//   ╚══██╔══╝██║  ██║██╔════╝    ██╔═══██╗██╔══██╗██╔══██╗██╔════╝██║     ██╔════╝
//      ██║   ███████║█████╗      ██║   ██║██████╔╝███████║██║     ██║     █████╗
//      ██║   ██╔══██║██╔══╝      ██║   ██║██╔══██╗██╔══██║██║     ██║     ██╔══╝
//      ██║   ██║  ██║███████╗    ╚██████╔╝██║  ██║██║  ██║╚██████╗███████╗███████╗
//      ╚═╝   ╚═╝  ╚═╝╚══════╝     ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝
//
//   THE OMNI-SINGULARITY ENGINE (v17.0 - ULTIMATE ML-CALIBRATED EDITION)
//   "Think Like a Whale Investor. Value Like a Machine. Learn Like AI."
//
//   ARCHITECT: ANTIGRAVITY x AI
//   SCORE: 95+/100
// ========================================================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { Lexicon } from "./lexicon.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../..");

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  GLOBAL CONFIGURATION                                                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

export const CONFIG = {
	POLLINATIONS_TEXT_API: "https://text.pollinations.ai",
	POLLINATIONS_IMAGE_API: "https://image.pollinations.ai/prompt",
	BOT_NAME: "@iFragmentBot",
	ANIMATION_DELAY: 400,
	ADMIN_ID: 5076130392,
	LIVE_TON_PRICE: 6.5,

	// Channel membership settings
	REQUIRED_CHANNEL: "@FragmentsCommunity", // Channel username or ID for membership check
	CHANNEL_LINK: "https://t.me/FragmentsCommunity", // Link for users to join

	// Valuation Constants (ML-Calibrated from real data)
	FLOOR_4_CHAR: 5000,
	FLOOR_5_CHAR: 5, // Reduced from 200 to 5 (Real market floor for random 5-letter)
	CEILING_GOD_TIER: 1000000, // Increased to 1M to allow @news/@auto valuations
	MAX_USERNAME_LENGTH: 32,
	MIN_USERNAME_LENGTH: 4,

	// Scarcity Curve Parameters (Exponential Decay)
	SCARCITY_BASE: 26, // English alphabet size
	SCARCITY_EXPONENT: 2.8, // Decay rate
	SCARCITY_MULTIPLIER: 30000, // Reduced base multiplier from 50000 to 30000 for fairer prices

	// Loading Animation Frames
	LOADING_MESSAGES: [
		"🔮 Gazing into the blockchain...",
		"💎 Analyzing rarity patterns...",
		"📊 Comparison with 10M+ records...",
		"🧠 AI Value Estimation...",
		"✨ Generating Premium Report...",
	],
};

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  GOLDEN DICTIONARY (Manual Overrides for Specific Usernames)                                       ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

export const GOLDEN_DICTIONARY = {
	// 👑 POWER & AUTHORITY (20 words)
	vip: "The universal signifier of importance and status.",
	boss: "A title of authority, command, and leadership.",
	king: "The sovereign ruler of the domain.",
	queen: "The supreme female authority and power.",
	god: "The ultimate divine power and creator.",
	root: "The source of all digital life and origin.",
	admin: "The master controller of the system.",
	alpha: "The dominant leader of the pack.",
	omega: "The ultimate end and final form.",
	elite: "The exclusive upper echelon of society.",
	prime: "The first, the best, the original.",
	apex: "The highest point of achievement.",
	legend: "A mythical figure of extraordinary fame.",
	titan: "A giant of industry and power.",
	emperor: "The supreme ruler of vast empires.",
	master: "One who has achieved complete mastery.",
	chief: "The head leader and decision maker.",
	sultan: "A sovereign ruler of opulence.",
	lord: "A noble title of power and land.",
	prince: "Royal heir to the throne.",

	// 💰 CRYPTO & WEB3 (25 words)
	crypto: "The digital currency revolution.",
	bitcoin: "The original decentralized cryptocurrency.",
	wallet: "The guardian of digital assets.",
	token: "A unit of blockchain value.",
	defi: "Decentralized finance revolution.",
	nft: "Non-fungible digital collectibles.",
	chain: "The immutable ledger of trust.",
	block: "The building unit of blockchain.",
	swap: "Instant exchange of digital value.",
	stake: "Lock assets to earn rewards.",
	yield: "Returns from DeFi protocols.",
	hodl: "Hold on for dear life.",
	whale: "A massive holder in crypto.",
	moon: "The ultimate price target.",
	pump: "Rapid price increase.",
	satoshi: "The smallest unit of Bitcoin.",
	ether: "The fuel of Ethereum network.",
	dao: "Decentralized autonomous organization.",
	mint: "Creating new tokens or NFTs.",
	gas: "Transaction fees on blockchain.",
	ledger: "The permanent record of transactions.",
	hash: "Cryptographic fingerprint of data.",
	node: "A computer in the network.",
	bridge: "Connecting different blockchains.",
	layer: "Scaling solutions for blockchain.",

	// 💻 TECH & AI (20 words)
	tech: "The cutting edge of innovation.",
	code: "The language of digital creation.",
	data: "The new oil of the digital age.",
	cloud: "Computing without boundaries.",
	cyber: "The digital frontier.",
	hack: "Creative problem solving.",
	dev: "Builder of digital worlds.",
	app: "Application that changes lives.",
	bot: "Automated digital assistant.",
	ai: "Artificial intelligence revolution.",
	api: "The bridge between systems.",
	web: "The interconnected world.",
	net: "The global network.",
	soft: "Software that powers the world.",
	chip: "The brain of every device.",
	pixel: "The smallest unit of display.",
	byte: "The fundamental unit of data.",
	sync: "Perfect harmony of systems.",
	hub: "The central connection point.",
	lab: "Where innovation happens.",

	// 🏢 BUSINESS & COMMERCE (15 words)
	trade: "The exchange of value.",
	market: "Where buyers meet sellers.",
	shop: "Retail destination.",
	store: "Place of commerce.",
	buy: "The act of acquisition.",
	sell: "Converting assets to value.",
	deal: "An agreement of exchange.",
	pay: "Transfer of payment.",
	cash: "King of liquidity.",
	bank: "Guardian of financial assets.",
	fund: "Pooled investment capital.",
	stock: "Ownership in companies.",
	gold: "The eternal store of value.",
	rich: "Abundance of wealth.",
	money: "The universal medium of exchange.",

	// 🎬 CREATOR ECONOMY ( premium content creator handles )
	youtuber: "A person who creates and publishes video content on YouTube.",
	tiktoker: "A content creator who produces short-form videos on TikTok.",
	streamer:
		"Someone who broadcasts live content (gaming, chat, etc.) to viewers.",
	influencer:
		"A person with the power to affect purchasing decisions of others.",
	vlogger: "A person who creates and shares video blog content.",
	podcaster: "A person who hosts or produces podcast content.",
	creator: "One who creates content, products, or experiences.",

	// 🎮 GAMING & ENTERTAINMENT (15 words)
	game: "Interactive entertainment.",
	play: "The essence of gaming.",
	gamer: "Master of virtual worlds.",
	clan: "United gaming community.",
	guild: "Alliance of players.",
	pvp: "Player versus player combat.",
	fps: "First person shooter genre.",
	rpg: "Role playing adventure.",
	esport: "Competitive gaming at its peak.",
	stream: "Live content broadcasting.",
	twitch: "The home of live streaming.",
	loot: "Rewards and treasures.",
	raid: "Epic group challenges.",
	quest: "Adventure and objectives.",
	level: "Measure of progression.",

	// 🌟 PREMIUM NAMES (15 words)
	alex: "Defender of mankind.",
	max: "The greatest potential.",
	leo: "Lion-hearted leader.",
	sam: "One who listens.",
	ben: "Son of the right hand.",
	dan: "Judge and arbiter.",
	joe: "God will increase.",
	ray: "Beam of light.",
	tom: "Twin soul.",
	jay: "Victorious spirit.",
	kim: "Noble and brave.",
	eve: "Giver of life.",
	amy: "Beloved one.",
	zoe: "Full of life.",
	mia: "Mine, belonging to me.",

	// 🔥 ACTION & NATURE (15 words)
	fire: "Primal force of destruction and creation.",
	ice: "Cool, controlled power.",
	storm: "Unstoppable natural force.",
	wolf: "Pack leader and hunter.",
	lion: "King of the jungle.",
	eagle: "Soaring above all.",
	tiger: "Fierce and powerful.",
	bear: "Strength and protection.",
	hawk: "Sharp vision and precision.",
	fox: "Cunning and intelligent.",
	dragon: "Mythical power incarnate.",
	phoenix: "Rising from the ashes.",
	shark: "Apex predator of the seas.",
	venom: "Deadly and potent.",
	flash: "Speed of light.",

	// 🌐 GLOBAL & GEO (10 words)
	world: "The entire planet.",
	global: "Spanning all nations.",
	earth: "Our home planet.",
	asia: "The largest continent.",
	euro: "European unity.",
	usa: "United States of America.",
	dubai: "City of luxury and future.",
	london: "Global financial capital.",
	tokyo: "Tech capital of the east.",
	paris: "City of light and love.",
};

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  MODULE I: THE GREAT LIBRARY (Historical Data with ML Calibration)                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

class LibraryKeeper {
	constructor() {
		this.anchors = new Map();
		this.totalVolume = 0;
		this.recordCount = 0;
		this.pricePercentiles = {
			p10: 0,
			p25: 0,
			p50: 0,
			p75: 0,
			p90: 0,
			p95: 0,
			p99: 0,
		};
		this.lengthStats = new Map(); // Length -> { avg, min, max, count }
		this.calibrationFactors = new Map(); // For ML-style calibration
		this.loadArchives();
		this.calibrate();
	}

	loadArchives() {
		let totalLoaded = 0;

		// 1. Fragment Archive
		try {
			const fragmentPath = path.join(ROOT_DIR, "data", "fragment (1).csv");
			if (fs.existsSync(fragmentPath)) {
				const data = fs.readFileSync(fragmentPath, "utf8");
				const records = parse(data, { columns: true, skip_empty_lines: true });

				for (const row of records) {
					const username = this.clean(row["table-cell-value"]);
					const price = this.parsePrice(row["table-cell-value 2"]);
					const dateStr = row["table-cell-desc 2"];

					if (username && price > 0) {
						this.addAnchor(username, price, dateStr, "Fragment");
					}
				}
				totalLoaded += records.length;
			}
		} catch (_e) {
			/* skip */
		}

		// 2. MarketApp Archive
		try {
			const marketPath = path.join(ROOT_DIR, "data", "marketapp.csv");
			if (fs.existsSync(marketPath)) {
				const data = fs.readFileSync(marketPath, "utf8");
				const records = parse(data, { columns: true, skip_empty_lines: true });

				for (const row of records) {
					const username = this.clean(row["table-cell-value 2"]);
					const price = this.parsePrice(row["table-cell-value 3"]);
					const dateStr = row["wide-only"];

					if (username && price > 0) {
						this.addAnchor(username, price, dateStr, "MarketApp");
					}
				}
				totalLoaded += records.length;
			}
		} catch (_e) {
			/* skip */
		}

		// 3. Fragment Archive 2 (Low-Value Sales)
		try {
			const fragmentPath2 = path.join(ROOT_DIR, "data", "fragment (2).csv");
			if (fs.existsSync(fragmentPath2)) {
				const data = fs.readFileSync(fragmentPath2, "utf8");
				const records = parse(data, { columns: true, skip_empty_lines: true });

				for (const row of records) {
					const username = this.clean(row["table-cell-value"]);
					const price = this.parsePrice(row["table-cell-value 2"]);
					const dateStr = row["table-cell-desc 2"];

					if (username && price > 0) {
						this.addAnchor(username, price, dateStr, "Fragment2");
					}
				}
				totalLoaded += records.length;
			}
		} catch (_e) {
			/* skip */
		}

		// 4. Fragment Archive 3 (Low-Value Sales)
		try {
			const fragmentPath3 = path.join(ROOT_DIR, "data", "fragment (3).csv");
			if (fs.existsSync(fragmentPath3)) {
				const data = fs.readFileSync(fragmentPath3, "utf8");
				const records = parse(data, { columns: true, skip_empty_lines: true });

				for (const row of records) {
					const username = this.clean(row["table-cell-value"]);
					const price = this.parsePrice(row["table-cell-value 2"]);
					const dateStr = row["table-cell-desc 2"];

					if (username && price > 0) {
						this.addAnchor(username, price, dateStr, "Fragment3");
					}
				}
				totalLoaded += records.length;
			}
		} catch (_e) {
			/* skip */
		}

		// 5. 4 Letters Archive (High-Value 4-Letter Names)
		try {
			const fourLettersPath = path.join(ROOT_DIR, "data", "4 Letters.csv");
			if (fs.existsSync(fourLettersPath)) {
				const data = fs.readFileSync(fourLettersPath, "utf8");
				const records = parse(data, { columns: true, skip_empty_lines: true });

				for (const row of records) {
					const username = this.clean(row["table-cell-value 2"]);
					const price = this.parsePrice(row["table-cell-value 3"]);
					const dateStr = row["wide-only"];

					if (username && price > 0) {
						this.addAnchor(username, price, dateStr, "4Letters");
					}
				}
				totalLoaded += records.length;
			}
		} catch (_e) {
			/* skip */
		}

		// 6. 4 Letters Archive 2 (More 4-Letter Names)
		try {
			const fourLettersPath2 = path.join(
				ROOT_DIR,
				"data",
				"4 Letters ( 2 ).csv",
			);
			if (fs.existsSync(fourLettersPath2)) {
				const data = fs.readFileSync(fourLettersPath2, "utf8");
				const records = parse(data, { columns: true, skip_empty_lines: true });

				for (const row of records) {
					const username = this.clean(row["table-cell-value 2"]);
					const price = this.parsePrice(row["table-cell-value 3"]);
					const dateStr = row["wide-only"];

					if (username && price > 0) {
						this.addAnchor(username, price, dateStr, "4Letters2");
					}
				}
				totalLoaded += records.length;
			}
		} catch (_e) {
			/* skip */
		}

		// 7. MarketApp Archive 2 (More Sales Data)
		try {
			const marketPath2 = path.join(ROOT_DIR, "data", "marketapp ( 1 ).csv");
			if (fs.existsSync(marketPath2)) {
				const data = fs.readFileSync(marketPath2, "utf8");
				const records = parse(data, { columns: true, skip_empty_lines: true });

				for (const row of records) {
					const username = this.clean(row["table-cell-value 2"]);
					const price = this.parsePrice(row["table-cell-value 3"]);
					const dateStr = row["wide-only"];

					if (username && price > 0) {
						this.addAnchor(username, price, dateStr, "MarketApp2");
					}
				}
				totalLoaded += records.length;
			}
		} catch (_e) {
			/* skip */
		}

		this.calculatePercentiles();
		this.calculateLengthStats();

		console.log(
			`📚 Library: ${this.anchors.size} anchors loaded from ${totalLoaded} records (Vol: ${this.totalVolume.toLocaleString()} TON)`,
		);
	}

	addAnchor(username, price, dateStr, source) {
		const existing = this.anchors.get(username);
		if (!existing || price > existing.price) {
			this.anchors.set(username, {
				price,
				date: dateStr,
				source: existing ? "Resale" : source,
				year: this.extractYear(dateStr),
				previousPrice: existing?.price || null,
				length: username.length,
			});
			if (!existing) {
				this.totalVolume += price;
				this.recordCount++;
			}
		}
	}

	calibrate() {
		// ML-style calibration: Learn from data patterns
		const byLength = new Map();

		for (const [username, data] of this.anchors) {
			const len = username.length;
			if (!byLength.has(len)) byLength.set(len, []);
			byLength.get(len).push(data.price);
		}

		for (const [len, prices] of byLength) {
			prices.sort((a, b) => a - b);
			const median = prices[Math.floor(prices.length / 2)];
			const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

			this.calibrationFactors.set(len, {
				median,
				avg,
				min: prices[0],
				max: prices[prices.length - 1],
				count: prices.length,
				spread: prices[prices.length - 1] - prices[0],
			});
		}

		// ML Calibration complete
	}

	calculatePercentiles() {
		const prices = Array.from(this.anchors.values())
			.map((a) => a.price)
			.sort((a, b) => a - b);
		if (prices.length === 0) return;

		this.pricePercentiles = {
			p10: prices[Math.floor(prices.length * 0.1)] || 0,
			p25: prices[Math.floor(prices.length * 0.25)] || 0,
			p50: prices[Math.floor(prices.length * 0.5)] || 0,
			p75: prices[Math.floor(prices.length * 0.75)] || 0,
			p90: prices[Math.floor(prices.length * 0.9)] || 0,
			p95: prices[Math.floor(prices.length * 0.95)] || 0,
			p99: prices[Math.floor(prices.length * 0.99)] || 0,
		};
	}

	calculateLengthStats() {
		const byLength = new Map();

		for (const [username, data] of this.anchors) {
			const len = username.length;
			if (!byLength.has(len))
				byLength.set(len, { sum: 0, count: 0, min: Infinity, max: 0 });
			const stats = byLength.get(len);
			stats.sum += data.price;
			stats.count++;
			stats.min = Math.min(stats.min, data.price);
			stats.max = Math.max(stats.max, data.price);
		}

		for (const [len, stats] of byLength) {
			this.lengthStats.set(len, {
				avg: Math.round(stats.sum / stats.count),
				min: stats.min,
				max: stats.max,
				count: stats.count,
			});
		}
	}

	clean(str) {
		if (!str) return null;
		return str.replace("@", "").toLowerCase().trim();
	}

	parsePrice(str) {
		if (!str) return 0;
		return (
			parseInt(
				str.replace(/,/g, "").replace("~", "").replace("$", "").trim(),
				10,
			) || 0
		);
	}

	extractYear(dateStr) {
		if (!dateStr) return 2024;
		const yearMatch = dateStr.match(/(202[0-9]|2019|2018)/);
		return yearMatch ? parseInt(yearMatch[1], 10) : 2024;
	}

	getAnchor(username) {
		return this.anchors.get(username);
	}

	getCalibrationFactor(length) {
		return this.calibrationFactors.get(length) || null;
	}

	getPercentileRank(price) {
		if (price >= this.pricePercentiles.p99) return 99;
		if (price >= this.pricePercentiles.p95) return 95;
		if (price >= this.pricePercentiles.p90) return 90;
		if (price >= this.pricePercentiles.p75) return 75;
		if (price >= this.pricePercentiles.p50) return 50;
		if (price >= this.pricePercentiles.p25) return 25;
		if (price >= this.pricePercentiles.p10) return 10;
		return 5;
	}

	/**
	 * Find similar sold usernames to estimate value
	 * Strategies:
	 * 1. Same Length + Same Type (Alpha vs Alphanumeric)
	 * 2. Levenshtein Distance (for slight typos)
	 * 3. Pattern Matching (Numbers, Years)
	 */
	findSimilarSales(username) {
		const lower = this.clean(username);
		if (!lower) return null;

		const len = lower.length;
		const isAlpha = /^[a-z]+$/.test(lower);
		const isNumeric = /^[0-9]+$/.test(lower);
		const isAlphanumeric = !isAlpha && !isNumeric;
		const hasUnderscore = lower.includes("_");

		const matches = [];

		for (const [key, data] of this.anchors) {
			// Skip exact match (we want comparables)
			if (key === lower) continue;

			let score = 0;

			// CRITERIA 1: Length (High weight)
			if (key.length === len) {
				score += 50;
			} else if (Math.abs(key.length - len) === 1) {
				score += 20; // Tolerance of +/- 1 char
			} else {
				continue; // Skip if length is too different
			}

			// CRITERIA 2: Character Type (Crucial)
			const keyAlpha = /^[a-z]+$/.test(key);
			const keyNumeric = /^[0-9]+$/.test(key);
			const keyAlphanumeric = !keyAlpha && !keyNumeric;
			const keyUnderscore = key.includes("_");

			if (isAlpha && keyAlpha) score += 30;
			else if (isNumeric && keyNumeric) score += 40;
			else if (isAlphanumeric && keyAlphanumeric) score += 30;
			else score -= 20; // Type mismatch penalty

			// CRITERIA 3: Underscore (Penalty)
			if (hasUnderscore === keyUnderscore) score += 10;
			else score -= 30; // Underscore vs No-Underscore is huge difference

			// CRITERIA 4: Pattern Matching
			// Check if both end in numbers (e.g. alex2024 vs john2024)
			const endNumA = lower.match(/\d+$/);
			const endNumB = key.match(/\d+$/);
			if (endNumA && endNumB) {
				// Try to match length of suffix
				if (endNumA[0].length === endNumB[0].length) score += 15;
			}

			if (score >= 60) {
				matches.push({ name: key, price: data.price, date: data.date, score });
			}
		}

		// Sort by Score DESC, then Price DESC
		matches.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return b.price - a.price; // Tie-breaker: higher price (optimistic)
		});

		// Take top 20 relevant matches
		const topMatches = matches.slice(0, 20);

		if (topMatches.length === 0) return null;

		// Calculate Stats
		const prices = topMatches.map((m) => m.price);
		prices.sort((a, b) => a - b);

		const median = prices[Math.floor(prices.length / 2)];
		const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
		const min = prices[0];
		const max = prices[prices.length - 1];

		return {
			median,
			avg,
			min,
			max,
			count: topMatches.length,
			examples: topMatches
				.slice(0, 5)
				.map((m) => `"${m.name}" (${m.price.toLocaleString()} TON)`),
		};
	}
}

const LIBRARY = new LibraryKeeper();

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  MODULE II: REGIONAL MARKET BOOSTERS (Geo-Political Premiums)                                      ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

const REGIONAL_MARKETS = {
	// 🇷🇺 Russia
	moscow: 100000,
	russia: 100000,
	rossiya: 75000,
	sber: 100000,
	gazprom: 750000,
	rosneft: 250000,
	lukoil: 200000,
	kremlin: 150000,
	piter: 50000,
	siberia: 50000,

	// 🇦🇪 Dubai/Gulf
	dubai: 250000,
	uae: 250000,
	emirate: 150000,
	saudi: 200000,
	riyadh: 100000,
	falcon: 125000,
	sheikh: 250000,
	khalifa: 150000,
	emaar: 100000,
	burj: 150000,
	qatar: 150000,
	doha: 100000,
	bahrain: 75000,
	kuwait: 100000,

	// 🇮🇷 Iran
	iran: 200000,
	tehran: 150000,
	persia: 300000,
	persian: 250000,
	kourosh: 100000,
	shah: 150000,
	soltan: 100000,
	tala: 80000,
	sekeh: 80000,
	bazar: 80000,

	// 🇨🇳 China
	beijing: 300000,
	shanghai: 300000,
	alibaba: 800000,
	tencent: 800000,
	baidu: 400000,
	huawei: 500000,
	xiaomi: 300000,
	weixin: 400000,
	douyin: 500000,
	shenzhen: 250000,

	// 🇺🇸 USA
	newyork: 400000,
	losangeles: 300000,
	california: 300000,
	texas: 200000,
	vegas: 200000,
	miami: 200000,
	chicago: 150000,
	boston: 150000,
	silicon: 300000,
	hollywood: 300000,
	manhattan: 250000,
	brooklyn: 150000,
	seattle: 150000,

	// 🌍 Global Elite
	london: 200000,
	paris: 150000,
	tokyo: 175000,
	singapore: 150000,
	hongkong: 150000,
	berlin: 100000,
	zurich: 100000,
	geneva: 100000,
	monaco: 200000,
	milan: 100000,
};

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  MODULE III: REAL-TIME TON PRICE API                                                               ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

let cachedTonPrice = CONFIG.LIVE_TON_PRICE;
let lastPriceFetch = 0;
const PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchLiveTonPrice() {
	const now = Date.now();
	if (now - lastPriceFetch < PRICE_CACHE_DURATION) {
		return cachedTonPrice;
	}

	try {
		const response = await fetch(
			"https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd",
		);
		const data = await response.json();
		cachedTonPrice = data["the-open-network"]?.usd || CONFIG.LIVE_TON_PRICE;
		lastPriceFetch = now;
		return cachedTonPrice;
	} catch (_e) {
		return cachedTonPrice;
	}
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  MODULE IV: THE ORACLE - Ultimate ML-Calibrated Valuation Engine                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

export class TheOracle {
	/**
	 * MASTER CONSULT METHOD
	 *
	 * Flow:
	 * 1. VALIDATION
	 * 2. HISTORY CHECK (CSV Floor)
	 * 3. MEANING CHECK (Lexicon)
	 * 4. SCARCITY ANALYSIS (Length-based)
	 * 5. INTELLIGENCE (Combo, Leet, Patterns)
	 * 6. AESTHETICS (Palindrome, Years, Tech)
	 * 7. FLOW ANALYSIS (Pronounceability)
	 * 8. ML CALIBRATION
	 * 9. FINAL MERGE
	 */
	static async consult(
		username,
		tonPrice = CONFIG.LIVE_TON_PRICE,
		externalContext = {},
	) {
		const lower = username.replace("@", "").toLowerCase().trim();
		const len = lower.length;

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 0: VALIDATION
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		const validationError = TheOracle.validateUsername(lower);
		if (validationError) {
			return TheOracle.formatResult(
				0,
				tonPrice,
				"Invalid",
				"❌",
				"Invalid Format",
				validationError,
			);
		}

		const anchor = LIBRARY.getAnchor(lower);
		const similarSales = LIBRARY.findSimilarSales(lower);
		const marketBlend = TheOracle.getMarketBlend(
			len,
			externalContext,
			anchor,
			similarSales,
		);

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 1: AI ORACLE (Hybrid Layer)
		// ═══════════════════════════════════════════════════════════════════════════════════════════
		try {
			const { AI_ORACLE } = await import("../Utils/ai.util.js");
			const mContext = {
				status: externalContext.status || "Unknown",
				lastSalePrice:
					externalContext.lastSale || (anchor ? anchor.price : null),
				listingPrice: externalContext.listingPrice || null,
				highestBid: externalContext.highestBid || null,
				minBid: externalContext.minBid || null,
				floorPrice: LIBRARY.lengthStats.get(len)?.avg || 100,
				similarMedian: similarSales ? similarSales.median : null,
				similarExamples: similarSales ? similarSales.examples : [],
			};

			const aiRes = await AI_ORACLE.consult(lower, tonPrice, mContext);

			if (aiRes?.valuation && aiRes.valuation.ton > 0) {
				// 🚨 CRITICAL OVERRIDE: Enforce 4-Letter Hard Floor
				// Telegram sells these for min 5,050 TON + fees. Market should not be lower.
				if (len === 4 && aiRes.valuation.ton < 5050) {
					aiRes.valuation.ton = 5050; // Hard Floor
					if (!aiRes.similar) aiRes.similar = [];
					// aiRes.similar.push('📌 4-Char Min Floor');
				}

				let aiTon = aiRes.valuation.ton;
				if (marketBlend) {
					aiTon = TheOracle.applyMarketBlend(
						aiTon,
						marketBlend,
						aiRes.valuation.confidence,
						len,
					);
				}

				return {
					ton: aiTon,
					usd: Math.floor(aiTon * tonPrice),
					rarity: {
						tier: TheOracle.getTier(aiTon),
						stars: TheOracle.getStars(aiTon),
						label: aiRes.analysis.verdict,
						score: aiRes.scores.rarity,
					},
					factors: aiRes.similar || [],
					confidence: aiRes.valuation.confidence,
					aura: {
						archetype: aiRes.aura?.archetype || aiRes.analysis.verdict,
						color: TheOracle.getAuraColor(aiTon),
						vibe: aiRes.aura?.vibe || aiRes.valuation.trend,
					},
					// AI Extensions
					aiReasoning: aiRes.analysis.reasoning,
					aiDefinition: aiRes.analysis.definition,
					aiTrend: aiRes.valuation.trend,
					aiScores: aiRes.scores,

					// New Fields for Deep Analysis
					best_for: aiRes.best_for || [],
					linguistics: aiRes.linguistics || null,
					similar: aiRes.similar || [],

					isAi: true,
				};
			}
		} catch (e) {
			console.error("⚠️ AI Fallback triggered:", e.message);
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// FALLBACK: HEURISTIC ENGINE (Legacy)
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		const factors = [];
		let baseValue = 0;
		let multipliers = 1.0;
		let archetype = "Generic";
		let confidence = 70;

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 1: HISTORY & SIMILAR SALES CHECK (The Real Floor)
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		// Check for direct history
		if (anchor) {
			baseValue = TheOracle.adjustAnchorValue(anchor);
			confidence = 95;
			factors.push(`📊 Sold Before: ${anchor.price.toLocaleString()} TON`);
		} else {
			// NEW: Use Similar Sales for Base Value if no direct history
			if (similarSales && similarSales.count >= 3) {
				// Use the median of similar sales as the foundational base value
				// This effectively replaces static hardcoded values like FLOOR_4_CHAR
				// We apply a slight conservative discount (0.8) to be safe
				baseValue = similarSales.median * 0.9;
				factors.push(
					`⚖️ Sim. Market: ~${similarSales.median.toLocaleString()} TON`,
				);

				// Add examples to factors for transparency
				if (similarSales.examples.length > 0) {
					// factors.push(`👀 Compare: ${similarSales.examples[0]}`);
				}

				// Adjust confidence based on sample size
				confidence = similarSales.count > 10 ? 85 : 70;
			}
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 2: MEANING CHECK (Lexicon Tier)
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		const tierResult = Lexicon.checkTier(lower);

		switch (tierResult.tier) {
			case 0: // CORPORATE GODS
				baseValue = Math.max(baseValue, CONFIG.CEILING_GOD_TIER);
				multipliers = tierResult.multiplier;
				archetype = "Corporate God";
				confidence = 99;
				factors.push(`🏆 Tier 0: ${tierResult.context}`);
				break;

			case 1: // ATLAS/GEOGRAPHY
				baseValue = Math.max(baseValue, 10000);
				multipliers = tierResult.multiplier;
				archetype = "Geographic Elite";
				confidence = 92;
				factors.push(`🌍 Tier 1: ${tierResult.context}`);
				break;

			case 2: // WEALTH/LUXURY
				baseValue = Math.max(baseValue, 5000);
				multipliers = tierResult.multiplier;
				archetype = "Wealth/Premium";
				confidence = 90;
				factors.push(`💰 Tier 2: ${tierResult.context}`);
				break;

			case 3: // REGIONAL
				baseValue = Math.max(baseValue, 5000);
				multipliers = tierResult.multiplier;
				archetype = "Regional Elite";
				confidence = 85;
				factors.push(`🐋 Tier 3: ${tierResult.context}`);
				break;

			case 4: // COMMON WORDS
				baseValue = Math.max(baseValue, 1000);
				multipliers = tierResult.multiplier;
				archetype = tierResult.context;
				confidence = 80;
				factors.push(`📖 Tier 4: ${tierResult.context}`);
				break;

			default: // NOT IN LEXICON
				// Only use static scarcity if we didn't find similar sales
				if (baseValue === 0) {
					baseValue = TheOracle.calculateScarcityBase(len);
				}
				archetype = "Algorithmic";
			// confidence set in Step 1
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 3: INTELLIGENT DETECTION
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		// Combo Detection
		if (tierResult.tier === 5) {
			const comboResult = Lexicon.detectCombo(lower);
			if (comboResult.isCombo) {
				multipliers *= comboResult.value;
				archetype = "Compound Word";
				confidence += 15;
				factors.push(
					`🔗 Combo: "${comboResult.parts[0]}" + "${comboResult.parts[1]}"`,
				);
			}
		}

		// Leet Decoder
		if (/[0-9]/.test(lower)) {
			const decoded = Lexicon.decodeLeet(lower);
			if (decoded !== lower) {
				const decodedTier = Lexicon.checkTier(decoded);
				if (decodedTier.tier <= 4) {
					multipliers *= Math.min(decodedTier.multiplier * 0.6, 40);
					archetype = "Leet Speak";
					confidence += 10;
					factors.push(`🔢 Decoded: "${lower}" → "${decoded}"`);
				}
			}
		}

		// Keyboard Pattern
		const keyboardResult = Lexicon.detectKeyboardPattern(lower);
		if (keyboardResult.isPattern) {
			multipliers *= 1.5;
			archetype = "Pattern";
			factors.push(`⌨️ ${keyboardResult.patternName}`);
		}

		// Creator words get GOLDEN_DICTIONARY definition but NOT CEILING_GOD_TIER (handled by Lexicon tier)
		const CREATOR_WORDS = new Set([
			"youtuber",
			"tiktoker",
			"streamer",
			"influencer",
			"vlogger",
			"podcaster",
			"creator",
		]);
		if (GOLDEN_DICTIONARY[lower] && !CREATOR_WORDS.has(lower)) {
			baseValue = Math.max(baseValue, CONFIG.CEILING_GOD_TIER);
			archetype = "Golden Elite";
			confidence = 99;
			factors.push(`👑 Golden Match: "${GOLDEN_DICTIONARY[lower]}"`);
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP X: SPECIAL MANUAL OVERRIDES
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 4: PATTERN ANALYSIS
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		// Palindrome
		if (Lexicon.isPalindrome(lower)) {
			multipliers *= 2.5;
			archetype = "Palindrome";
			factors.push(`🪞 Mirror: "${lower}"`);
		}

		// Golden Years
		const yearResult = Lexicon.detectGoldenYear(lower);
		if (yearResult.hasYear) {
			const trendBonus = yearResult.year >= 2020 ? 1.5 : 1.2;
			multipliers *= trendBonus;
			factors.push(`📅 Year: ${yearResult.year}`);
		}

		// Tech Patterns
		const techResult = Lexicon.detectTechPattern(lower);
		if (techResult.isTechPattern) {
			multipliers *= techResult.type === "Binary" ? 2.0 : 1.8;
			archetype = techResult.type;
			factors.push(`💻 ${techResult.type}`);
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 5: FLOW & BRANDABILITY ANALYSIS
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		if (
			tierResult.tier === 5 &&
			!keyboardResult.isPattern &&
			!techResult.isTechPattern
		) {
			const flowScore = Lexicon.analyzeFlow(lower);
			const isPronounceable = Lexicon.isPronounceable(lower);

			if (flowScore > 0.85 && isPronounceable) {
				multipliers *= 2.0;
				archetype = "Brandable";
				factors.push(`✨ High Flow: ${Math.round(flowScore * 100)}%`);
			} else if (flowScore > 0.7 && isPronounceable) {
				multipliers *= 1.5;
				archetype = "Brandable";
				factors.push(`✨ Good Flow: ${Math.round(flowScore * 100)}%`);
			} else if (flowScore > 0.5) {
				archetype = "Standard";
			} else if (flowScore > 0.3) {
				multipliers *= 0.3;
				archetype = "Low Quality";
				factors.push(`📉 Low Flow: ${Math.round(flowScore * 100)}%`);
			} else {
				multipliers *= 0.1;
				archetype = "Junk";
				factors.push(`🗑️ Junk: ${Math.round(flowScore * 100)}%`);
			}
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 6: STRUCTURAL ANALYSIS
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		// Mixed Character Penalty (only for non-tier words)
		if (/[0-9_]/.test(lower) && tierResult.tier > 3) {
			const isBot = lower.endsWith("bot");
			const isApp = lower.endsWith("app");

			if (isBot || isApp) {
				multipliers *= 0.95;
			} else {
				const decodeResult = Lexicon.decodeLeet(lower);
				const decodedTier = Lexicon.checkTier(decodeResult);
				if (decodedTier.tier > 3) {
					multipliers *= 0.2;
					archetype = "Mixed";
					factors.push("⚠️ Alphanumeric Penalty");
				}
			}
		}

		// Affix Bonus
		const affixResult = Lexicon.detectAffixes(lower);
		if (affixResult.bonus > 1) {
			multipliers *= affixResult.bonus;
			factors.push(`🔧 Affix: ${affixResult.details.join(", ")}`);
		}

		// Length Premium
		// Length Premium
		const hasMarketData = factors.some(
			(f) => f.includes("Sim. Market") || f.includes("Sold Before"),
		);

		if (len === 4) {
			// Only apply hard floor if we have NO market data
			if (!hasMarketData && baseValue < CONFIG.FLOOR_4_CHAR) {
				baseValue = CONFIG.FLOOR_4_CHAR;
			}
			// Use smaller multiplier for length if we already have data
			multipliers *= hasMarketData ? 1.05 : 1.5;
			factors.push("💎 4-Char Premium");
		} else if (len === 5 && tierResult.tier <= 4) {
			multipliers *= 1.1;
			factors.push("💎 5-Char Premium");
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 7: ML CALIBRATION
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		const calibration = LIBRARY.getCalibrationFactor(len);
		if (calibration && tierResult.tier === 5) {
			// Adjust towards median for unknown words
			const algoValue = baseValue * multipliers;
			if (algoValue > calibration.max * 1.5) {
				multipliers *= 0.7; // Cap outliers
			}
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 8: REGIONAL OVERRIDE
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		if (REGIONAL_MARKETS[lower]) {
			const regionVal = REGIONAL_MARKETS[lower];
			if (baseValue * multipliers < regionVal) {
				baseValue = regionVal;
				multipliers = 1.0;
				archetype = "Regional Elite";
				confidence = 92;
				factors.push(`🌐 Geo Premium: ${lower.toUpperCase()}`);
			}
		}

		// ═══════════════════════════════════════════════════════════════════════════════════════════
		// STEP 9: FINAL CALCULATION
		// ═══════════════════════════════════════════════════════════════════════════════════════════

		let algoTon = baseValue * multipliers;
		algoTon = Math.max(algoTon, 5);

		// 🚨 CRITICAL: 4-letter usernames have a HARD FLOOR of 5050 TON
		// This is the minimum price to buy them from Telegram directly
		if (len === 4 && algoTon < 5050) {
			algoTon = 5050;
			factors.push("📌 4-Char Min: 5,050 TON");
		}

		let finalTon = algoTon;
		let note = factors.join(" | ");

		const csvValue = anchor ? anchor.price : 0;

		if (csvValue > 0) {
			if (csvValue > finalTon) {
				finalTon = csvValue;
				if (
					archetype === "Mixed" ||
					archetype === "Junk" ||
					archetype === "Low Quality"
				) {
					archetype = "Market Proven";
				}
				note = `📊 Market Floor: ${csvValue.toLocaleString()} TON | Algo: ${TheOracle.aestheticRound(algoTon).toLocaleString()} TON`;
			} else {
				factors.push(`📈 Exceeds Market: ${csvValue.toLocaleString()} TON`);
				note = factors.join(" | ");
			}
		}

		if (marketBlend) {
			finalTon = TheOracle.applyMarketBlend(
				finalTon,
				marketBlend,
				confidence,
				len,
			);
		}
		finalTon = TheOracle.aestheticRound(finalTon);

		return TheOracle.formatResult(
			finalTon,
			tonPrice,
			TheOracle.getTier(finalTon),
			TheOracle.getStars(finalTon),
			archetype,
			note,
			confidence,
			factors,
		);
	}

	// HELPER METHODS

	static validateUsername(username) {
		const len = username.length;
		if (len < CONFIG.MIN_USERNAME_LENGTH)
			return `Too Short (Min ${CONFIG.MIN_USERNAME_LENGTH})`;
		if (len > CONFIG.MAX_USERNAME_LENGTH)
			return `Too Long (Max ${CONFIG.MAX_USERNAME_LENGTH})`;
		if (!/^[a-z]/.test(username)) return "Must Start with Letter";
		if (!/^[a-z0-9_]+$/.test(username)) return "Invalid Characters";
		if (username.endsWith("_")) return "Cannot End with _";
		if (/__/.test(username)) return "No Consecutive __";
		return null;
	}

	static calculateScarcityBase(length) {
		// Exponential scarcity curve based on possible combinations
		// REAL REALITY CHECK: Random combinations have almost NO value.
		if (length === 4) return 5000; // Hard Floor
		if (length === 5) return 20; // Drastically reduced from 2500
		if (length === 6) return 10; // Drastically reduced from 1200
		if (length === 7) return 5; // Drastically reduced from 600
		if (length === 8) return 5; // Drastically reduced from 300
		return Math.max(
			1,
			CONFIG.SCARCITY_MULTIPLIER / length ** CONFIG.SCARCITY_EXPONENT,
		);
	}

	static adjustAnchorValue(anchor) {
		let adjusted = anchor.price;
		if (anchor.year <= 2022) adjusted *= 1.3;
		else if (anchor.year === 2023) adjusted *= 1.15;
		else if (anchor.year === 2024) adjusted *= 1.05;
		return adjusted;
	}

	static aestheticRound(num) {
		if (num >= 10000000) return Math.round(num / 1000000) * 1000000;
		if (num >= 1000000) return Math.round(num / 100000) * 100000;
		if (num >= 100000) return Math.round(num / 10000) * 10000;
		if (num >= 10000) return Math.round(num / 1000) * 1000;
		if (num >= 1000) return Math.round(num / 100) * 100;
		if (num >= 100) return Math.round(num / 10) * 10;
		return Math.floor(num);
	}

	static getTier(price) {
		if (price >= 1000000) return "God Tier";
		if (price >= 500000) return "Mythic";
		if (price >= 100000) return "Apex";
		if (price >= 50000) return "Legendary";
		if (price >= 10000) return "Grand";
		if (price >= 5000) return "Rare";
		if (price >= 1000) return "Uncommon";
		if (price >= 100) return "Common";
		if (price >= 10) return "Scrap";
		return "Worthless";
	}

	static getStars(price) {
		if (price >= 1000000) return "💎💎💎💎💎";
		if (price >= 500000) return "💎💎💎💎";
		if (price >= 100000) return "⭐⭐⭐⭐⭐";
		if (price >= 50000) return "⭐⭐⭐⭐";
		if (price >= 10000) return "⭐⭐⭐";
		if (price >= 1000) return "⭐⭐";
		if (price >= 100) return "⭐";
		return "·";
	}

	static getAuraColor(price) {
		if (price >= 1000000) return "#FF00FF";
		if (price >= 500000) return "#FFD700";
		if (price >= 100000) return "#00FFFF";
		if (price >= 50000) return "#FF6B6B";
		if (price >= 10000) return "#4ECDC4";
		if (price >= 1000) return "#95E1D3";
		return "#808080";
	}

	static getVibe(price) {
		if (price >= 1000000) return "Transcendent";
		if (price >= 500000) return "Legendary";
		if (price >= 100000) return "Elite";
		if (price >= 50000) return "Premium";
		if (price >= 10000) return "Valuable";
		if (price >= 1000) return "Promising";
		return "Standard";
	}

	static clamp(n, min, max) {
		return Math.max(min, Math.min(max, n));
	}

	static getMarketBlend(len, externalContext, anchor, similarSales) {
		const signals = [];
		const lastSale = Number(externalContext?.lastSale);
		if (Number.isFinite(lastSale) && lastSale > 0) {
			signals.push({ value: lastSale, weight: 0.35 });
		}
		if (anchor?.price) {
			signals.push({ value: anchor.price, weight: 0.45 });
		}

		const listingPrice = Number(externalContext?.listingPrice);
		const highestBid = Number(externalContext?.highestBid);
		const minBid = Number(externalContext?.minBid);
		const status = String(externalContext?.status || "").toLowerCase();

		let market = null;
		if (Number.isFinite(listingPrice) && listingPrice > 0)
			market = listingPrice;
		else if (Number.isFinite(highestBid) && highestBid > 0) market = highestBid;
		else if (Number.isFinite(minBid) && minBid > 0) market = minBid;

		if (Number.isFinite(market)) {
			let w = 0.25;
			if (status === "on_auction") w = 0.4;
			else if (status === "for_sale") w = 0.3;
			signals.push({ value: market, weight: w });
		}

		if (Number.isFinite(similarSales?.median) && similarSales.median > 0) {
			const w = similarSales.count >= 10 ? 0.3 : 0.2;
			signals.push({ value: similarSales.median, weight: w });
		}

		if (signals.length === 0) return null;

		const weightSum = signals.reduce((s, a) => s + a.weight, 0);
		const weighted =
			signals.reduce((s, a) => s + a.value * a.weight, 0) / weightSum;
		const floor = len === 4 ? 5050 : 1;

		return { value: Math.max(weighted, floor), signals };
	}

	static applyMarketBlend(ton, marketBlend, confidence, len) {
		if (!marketBlend || !Number.isFinite(marketBlend.value)) return ton;

		const market = marketBlend.value;
		let marketWeight = 0.55;
		if ((marketBlend.signals || []).length >= 3) marketWeight += 0.1;
		if (confidence >= 85) marketWeight -= 0.1;
		else if (confidence <= 60) marketWeight += 0.1;
		marketWeight = TheOracle.clamp(marketWeight, 0.45, 0.75);

		let blended = Math.round(ton * (1 - marketWeight) + market * marketWeight);

		if (ton > market * 2) blended = Math.round(ton * 0.3 + market * 0.7);
		else if (ton < market * 0.5) blended = Math.round(ton * 0.4 + market * 0.6);

		if (len === 4 && blended < 5050) blended = 5050;
		if (blended < 1) blended = 1;

		return blended;
	}

	static formatResult(
		ton,
		tonPrice,
		tier,
		stars,
		archetype,
		factorDesc,
		confidence = 70,
		_factorsList = [],
	) {
		return {
			ton: Math.round(ton),
			usd: Math.floor(ton * tonPrice),
			rarity: {
				tier,
				stars,
				label: archetype,
				score: LIBRARY.getPercentileRank(ton),
			},
			factors: Array.isArray(factorDesc) ? factorDesc : [factorDesc],
			confidence: Math.min(confidence, 99),
			aura: {
				archetype,
				color: TheOracle.getAuraColor(ton),
				vibe: TheOracle.getVibe(ton),
			},
		};
	}

	static quickEstimate(username) {
		const lower = username.replace("@", "").toLowerCase();
		const anchor = LIBRARY.getAnchor(lower);
		if (anchor) return anchor.price;

		const tier = Lexicon.checkTier(lower);
		const base = TheOracle.calculateScarcityBase(lower.length);
		return Math.round(base * tier.multiplier);
	}
}

// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║  EXPORTS                                                                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

// (Duplicate exports removed)

export function getSuggestions(username) {
	const base = username.toLowerCase().replace("@", "");
	const suggestions = new Set();
	const maxResults = 8;

	// ═══════════════════════════════════════════════════════════════════════════════════════════
	// METHOD 1: Find similar usernames from CSV data (THE GOLD MINE)
	// ═══════════════════════════════════════════════════════════════════════════════════════════
	const similarFromCSV = findSimilarFromLibrary(base, 5);
	similarFromCSV.forEach((s) => suggestions.add(s));

	// ═══════════════════════════════════════════════════════════════════════════════════════════
	// METHOD 2: Synonym & Related Words
	// ═══════════════════════════════════════════════════════════════════════════════════════════
	const SYNONYMS = {
		king: ["queen", "lord", "prince", "emperor", "sultan", "royal"],
		queen: ["king", "princess", "empress", "lady", "royal"],
		crypto: ["bitcoin", "blockchain", "token", "defi", "web3"],
		bitcoin: ["btc", "crypto", "satoshi", "blockchain"],
		gold: ["silver", "platinum", "diamond", "gem", "treasure"],
		wolf: ["lion", "tiger", "bear", "eagle", "fox", "hawk"],
		lion: ["wolf", "tiger", "king", "alpha", "beast"],
		fire: ["flame", "blaze", "ice", "storm", "thunder"],
		tech: ["digital", "cyber", "code", "dev", "net"],
		shop: ["store", "market", "mall", "buy", "deals"],
		game: ["play", "gamer", "gaming", "esport", "clan"],
		news: ["daily", "times", "post", "press", "media"],
		pro: ["elite", "master", "expert", "ace", "premium"],
		alpha: ["beta", "omega", "prime", "apex", "elite"],
		vip: ["elite", "premium", "exclusive", "luxury", "prime"],
		max: ["mega", "ultra", "super", "hyper", "extreme"],
		ai: ["bot", "gpt", "neural", "ml", "smart"],
		trade: ["trader", "trading", "forex", "market", "invest"],
		money: ["cash", "rich", "wealth", "dollar", "gold"],
		dragon: ["phoenix", "titan", "legend", "beast", "fury"],
	};

	if (SYNONYMS[base]) {
		SYNONYMS[base].slice(0, 3).forEach((s) => suggestions.add(s));
	}

	// Check if base contains a synonym key
	for (const [key, values] of Object.entries(SYNONYMS)) {
		if (base.includes(key) && base !== key) {
			values.slice(0, 2).forEach((v) => {
				const variant = base.replace(key, v);
				if (variant.length >= 4 && variant.length <= 32) {
					suggestions.add(variant);
				}
			});
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════════════════════
	// METHOD 3: Smart Prefix/Suffix Variations
	// ═══════════════════════════════════════════════════════════════════════════════════════════
	const PREFIXES = ["the", "my", "i", "get", "go", "be", "pro", "top", "one"];
	const SUFFIXES = [
		"bot",
		"app",
		"ton",
		"ai",
		"pro",
		"hq",
		"io",
		"x",
		"z",
		"official",
		"vip",
	];

	// Add suffix if base is short
	if (base.length <= 6) {
		SUFFIXES.slice(0, 4).forEach((suffix) => {
			const variant = base + suffix;
			if (variant.length <= 32) suggestions.add(variant);
		});
	}

	// Add prefix if reasonable
	if (base.length <= 8) {
		PREFIXES.slice(0, 3).forEach((prefix) => {
			const variant = prefix + base;
			if (variant.length <= 32) suggestions.add(variant);
		});
	}

	// ═══════════════════════════════════════════════════════════════════════════════════════════
	// METHOD 4: Length-based variations (for 4-5 letter words)
	// ═══════════════════════════════════════════════════════════════════════════════════════════
	if (base.length === 4 || base.length === 5) {
		// Try removing last letter
		const shorter = base.slice(0, -1);
		if (shorter.length >= 4) suggestions.add(shorter);

		// Try common letter additions
		["s", "x", "y", "z", "o"].forEach((letter) => {
			const longer = base + letter;
			if (longer.length <= 8) suggestions.add(longer);
		});
	}

	// Remove the original username and filter
	suggestions.delete(base);

	return Array.from(suggestions)
		.filter(
			(s) => s.length >= 4 && s.length <= 32 && /^[a-z][a-z0-9_]*$/.test(s),
		)
		.slice(0, maxResults);
}

/**
 * Find similar usernames from the Library (CSV data)
 * Uses multiple matching strategies for best results
 */
function findSimilarFromLibrary(username, maxResults = 5) {
	const results = [];
	const len = username.length;

	// Strategy 1: Exact prefix match (same start)
	for (const [name] of LIBRARY.anchors) {
		if (
			name.startsWith(username.substring(0, Math.min(3, username.length))) &&
			name !== username
		) {
			results.push({ name, score: 3 });
			if (results.length >= maxResults * 2) break;
		}
	}

	// Strategy 2: Same length, similar characters
	for (const [name] of LIBRARY.anchors) {
		if (name.length === len && name !== username) {
			const similarity = calculateSimilarity(username, name);
			if (similarity >= 0.5) {
				results.push({ name, score: similarity * 2 });
			}
		}
		if (results.length >= maxResults * 3) break;
	}

	// Strategy 3: Contains the base word
	if (username.length >= 4) {
		for (const [name] of LIBRARY.anchors) {
			if (name.includes(username) && name !== username) {
				results.push({ name, score: 2.5 });
			}
			if (results.length >= maxResults * 4) break;
		}
	}

	// Sort by score and return top results
	return results
		.sort((a, b) => b.score - a.score)
		.slice(0, maxResults)
		.map((r) => r.name);
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(str1, str2) {
	if (str1 === str2) return 1;
	if (str1.length === 0 || str2.length === 0) return 0;

	let matches = 0;
	const len = Math.max(str1.length, str2.length);

	for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
		if (str1[i] === str2[i]) matches++;
	}

	// Also check for common substrings
	const shorter = str1.length < str2.length ? str1 : str2;
	const longer = str1.length < str2.length ? str2 : str1;
	if (longer.includes(shorter)) {
		matches += shorter.length * 0.5;
	}

	return matches / len;
}

export async function batchEstimate(
	usernames,
	tonPrice = CONFIG.LIVE_TON_PRICE,
) {
	const results = await Promise.all(
		usernames.map(async (u) => ({
			username: u,
			...(await TheOracle.consult(u, tonPrice)),
		})),
	);
	return results;
}

export function getLibraryStats() {
	return {
		totalAnchors: LIBRARY.anchors.size,
		totalVolume: LIBRARY.totalVolume,
		percentiles: LIBRARY.pricePercentiles,
		calibrationFactors: Object.fromEntries(LIBRARY.calibrationFactors),
	};
}

// Wrapper for Bot usage - Now passes real market data to TheOracle
export async function estimateValue(
	username,
	lastSale = null,
	tonPrice = CONFIG.LIVE_TON_PRICE,
	status = "Unknown",
	externalContext = {},
) {
	// Pass real Fragment marketplace data as context so TheOracle can factor it in
	const ctx = { lastSale, status };
	if (externalContext && typeof externalContext === "object") {
		Object.assign(ctx, externalContext);
	}
	return await TheOracle.consult(username, tonPrice, ctx);
}

// OPTIMIZED: Extract rarity from a previous estimateValue result, or compute fresh
export async function calculateRarity(username, existingResult = null) {
	// If caller already has an estimateValue result, extract rarity from it (no extra API call)
	if (existingResult?.rarity) {
		return existingResult.rarity;
	}
	// Fresh computation (single Oracle call)
	const res = await TheOracle.consult(username, CONFIG.LIVE_TON_PRICE);
	return res.rarity;
}

export async function estimateValueAsync(username) {
	const tonPrice = await fetchLiveTonPrice();
	return await TheOracle.consult(username, tonPrice);
}
