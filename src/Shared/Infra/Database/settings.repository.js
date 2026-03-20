import { getDB } from "./firestore.repository.js";
import { settings as localDB } from "../../../database/panelDatabase.js";

const SETTINGS_COLLECTION = "settings";
const DASHBOARD_CONFIG_DOC = "dashboard_config";

/**
 * Get the current dashboard button configuration
 */
export async function getDashboardConfig() {
	const db = getDB();
	const DEFAULT_CONFIG = {
		buttons: {
			report_username: { text: "🔍 Username", style: "primary" },
			report_gifts: { text: "🎁 Gifts", style: "primary" },
			report_numbers: { text: "📱 Numbers", style: "primary" },
			menu_portfolio: { text: "💼 Portfolio", style: "primary" },
			menu_compare: { text: "⚔️ Compare", style: "primary" },
			menu_account: { text: "👤 Account", style: "primary" },
		},
		templates: {
			start: "<b>Hello {FIRSTNAME}!</b> ✨\nWelcome to 👑 <b>{BOT_NAME}</b>.\n\n💎 TON: <code>${ton_price}</code>\n🏴‍☠️ +888: <code>{price_888}</code>",
			profile: "✦ <b>MY PROFILE</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n👤 <b>Name:</b> {FIRSTNAME} {LASTNAME}\n🔗 <b>Username:</b> {USERNAME}\n🪪 <b>ID:</b> <code>{USERID}</code>\n\n🪙 <b>Balance:</b> <code>{credits} FRG</code>\n⏳ <b>Next Reset:</b> {reset_time}",
			username_prompt: "✦ <b>USERNAME SCANNER</b>\n━━━━━━━━━━━━━━━━━━━━━\n\nAnalyze any Telegram username value.\n\n├ 💵 <b>Market Value</b>\n├ 🧠 <b>AI Prediction</b>\n└ 📊 <b>Historical Trends</b>\n\n💬 <i>Please send any @username to begin:</i>",
			gift_prompt: "✦ <b>GIFT VALUATION SCANNER</b>\n━━━━━━━━━━━━━━━━━━━━━\n\nAnalyze Telegram Gift NFTs.\n\n├ 🏦 <b>Floor Prices</b>\n├ 🧬 <b>Rarity Stats</b>\n└ 📈 <b>Live Sales</b>\n\n💬 <i>Please send the link of the Gift below:</i>",
			number_prompt: "✦ <b>+888 SCANNER</b>\n━━━━━━━━━━━━━━━━━━━━━\n\nAnalyze Anonymous Numbers.\n\n├ 📞 <b>Market Price</b>\n├ 💎 <b>Rarity Grade</b>\n└ 📈 <b>Sale Tracking</b>\n\n💬 <i>Please send the +888 number below:</i>",
			portfolio_prompt: "✦ <b>WALLET TRACKER</b>\n━━━━━━━━━━━━━━━━━━━━━\n\nTrack Fragment portfolios.\n\n├ 💎 <b>Usernames</b>\n├ 🏴‍☠️ <b>Numbers</b>\n└ 🎁 <b>Gifts</b>\n\n💬 <i>Please send the wallet or @username:</i>",
			compare_prompt: "✦ <b>COMPARE USERNAMES</b>\n━━━━━━━━━━━━━━━━━━━━━\n\nCompare two usernames side-by-side.\n\n💬 <i>Step 1 — Send the first @username:</i>",
			transfer_prompt: "✦ <b>TRANSFER FRG</b>\n━━━━━━━━━━━━━━━━━━━━━\n\nSend the @username or User ID of the recipient:",

			// Reports
			report_username: "💎 <b>@{USERNAME_RAW}</b>\n<i>{DEFINITION}</i>\n\n💰 <b>Value:</b> {VAL_TON} TON\n✨ <b>Tier:</b> {TIER}\n🎯 <b>Confidence:</b> {CONFIDENCE}%\n\n――――― 🔬 <b>AI VERDICT</b> ―――――\n{REASONING}",
			report_gift: "🎁 <b>{COLLECTION} #{NUMBER}</b>\n\n💰 <b>Value:</b> {PRICE_TON} TON\n🏷 <b>Verdict:</b> {VERDICT}\n📊 <b>Floor:</b> {FLOOR_TON} TON",
			report_number: "📱 <b>{FORMATTED_NUMBER}</b>\n\n💰 <b>Floor:</b> {FLOOR_TON} TON\n💎 <b>Rarity:</b> {RARITY_GRADE}\n📊 <b>Market:</b> {STATUS}",

			// Misc
			loading: "🔄 Analyzing...\n\n⏳ Fetching market data & AI insights...",
			sponsor: "Earn <b>+300 FRG</b> by actively participating in the [Fragment Investors](https://t.me/FragmentInvestors) club.",

			// Economy
			credits_info: "💰 <b>Your Balance:</b> {credits} FRG\n\n🚀 <i>Need more?</i> Post in @FragmentInvestors (+300 FRG!)",
			insufficient_credits: "❌ <b>Insufficient Credits!</b>\n\nYou need at least <b>100 FRG</b> to generate a detailed report.\n\n🚀 <i>How to get more?</i>\n• Participate in @FragmentInvestors (+300 FRG bonus!)\n• Wait for monthly reset",
		},
		features: {
			streaming_enabled: false, // Default: OFF
			topics_enabled: false,    // Default: OFF
		}
	};

	try {
		const localConfig = localDB.get(DASHBOARD_CONFIG_DOC);
		let data = localConfig || {};

		if (db) {
			const doc = await db.collection(SETTINGS_COLLECTION).doc(DASHBOARD_CONFIG_DOC).get();
			if (doc.exists) {
				data = { ...data, ...doc.data() };
			}
		}

		// Ensure DEEP defaults for missing objects
		return {
			...DEFAULT_CONFIG,
			...data,
			buttons: { ...DEFAULT_CONFIG.buttons, ...(data.buttons || {}) },
			templates: { ...DEFAULT_CONFIG.templates, ...(data.templates || {}) },
			features: { ...DEFAULT_CONFIG.features, ...(data.features || {}) }
		};
	} catch (error) {
		console.error("Error getting dashboard config:", error.message);
		return DEFAULT_CONFIG;
	}
}

/**
 * Update a specific button in the dashboard config
 */
export async function updateDashboardButton(buttonId, updates) {
	const db = getDB();

	try {
		// 1. Get current FULL config (with defaults)
		const config = await getDashboardConfig();

		// 2. Apply Update
		config.buttons[buttonId] = { ...(config.buttons[buttonId] || {}), ...updates };

		// 3. Save to Local
		localDB.set(DASHBOARD_CONFIG_DOC, config);

		// 4. Save to Cloud
		if (db) {
			await db.collection(SETTINGS_COLLECTION).doc(DASHBOARD_CONFIG_DOC).set(config, { merge: true });
		}

		return true;
	} catch (error) {
		console.error("Error updating dashboard button:", error.message);
		return false;
	}
}

/**
 * Toggle a global feature (Streaming, Topics)
 */
export async function toggleGlobalFeature(featureKey) {
	const db = getDB();

	try {
		// 1. Get FULL config
		const config = await getDashboardConfig();
		if (!config.features) config.features = {};
		
		const current = config.features[featureKey];
		const newState = (typeof current === 'boolean') ? !current : true;
		config.features[featureKey] = newState;
		
		// 2. Save Local
		localDB.set(DASHBOARD_CONFIG_DOC, config);

		// 3. Save Cloud
		if (db) {
			await db.collection(SETTINGS_COLLECTION).doc(DASHBOARD_CONFIG_DOC).set(config, { merge: true });
		}
		
		return newState;
	} catch (error) {
		console.error("Error toggling feature:", error.message);
		return false;
	}
}

/**
 * Update a CMS template
 */
export async function updateTemplate(key, content) {
	const db = getDB();

	try {
		// 1. Get FULL config
		const config = await getDashboardConfig();
		if (!config.templates) config.templates = {};

		config.templates[key] = content;

		// 2. Save Local
		localDB.set(DASHBOARD_CONFIG_DOC, config);

		// 3. Save Cloud
		if (db) {
			await db.collection(SETTINGS_COLLECTION).doc(DASHBOARD_CONFIG_DOC).set(config, { merge: true });
		}

		return true;
	} catch (error) {
		console.error("Error updating template:", error.message);
		return false;
	}
}

/**
 * Get all current templates
 */
export async function getTemplates() {
	const config = await getDashboardConfig();
	return config.templates;
}
