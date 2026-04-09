/**
 * Bot Template CMS (v10.0 Supreme CMS Engine) 2026 Smart CMS integration.
 * Manages dynamic message rendering with variable injection and premium emojis.
 */

import { formatPremiumHTML } from "./telegram.formatter.js";
import { tonPriceCache } from "../Cache/cache.service.js";
import { CONFIG } from "../../../core/Config/app.config.js";
import { getRemainingLimits, getUser } from "../../../Modules/User/Application/user.service.js";

/**
 * Render a message template by injecting variables
 * @param {string} template - Raw template string from CMS
 * @param {object} variables - Key-value pair for injection
 * @returns {string} Fully rendered HTML
 */
export function renderTemplate(template, variables = {}) {
	if (!template) return "";

	// 1. Inject Global Market Data
	const market = tonPriceCache.get("marketStats") || { price: 5.5, change: 0 };
	const floor888 = tonPriceCache.get("floor888") || { price: 0 };

	// 1. Inject Global Time & Date Variables
	const now = new Date();
	const monthNames = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];

	const defaultVars = {
		HOUR: String(now.getHours()).padStart(2, "0"),
		MIN: String(now.getMinutes()).padStart(2, "0"),
		SEC: String(now.getSeconds()).padStart(2, "0"),
		YEAR: String(now.getFullYear()),
		MON: String(now.getMonth() + 1).padStart(2, "0"),
		DAY: String(now.getDate()).padStart(2, "0"),
		MONN: monthNames[now.getMonth()],
		BOT_NAME: CONFIG.BOT_NAME || "iFragmentBot",
		
		// Market Data (Lower-case versions)
		ton_price: String(Number(market.tonPrice || market.price || 5.5).toFixed(2)),
		ton_change: String(Number(market.tonChange || market.change24h || market.change || 0).toFixed(2)),
		price_888: floor888.price ? `${Number(floor888.price).toLocaleString()} TON` : "Updating...",
	};

	// Merge all variables
	const allVars = { ...defaultVars, ...variables };

	// 2. Perform Replacement (Case Insensitive Support)
	let rendered = template;
	for (const [key, value] of Object.entries(allVars)) {
		const placeholder = new RegExp(`{${key}}`, "gi");
		rendered = rendered.replace(placeholder, value !== undefined ? String(value) : "");
	}

	// 3. Convert Premium Emojis [12345] -> HTML Tags
	return formatPremiumHTML(rendered);
}

/**
 * Fetch all identity and status variables for a user
 */
export async function fetchUserVariables(userId, ctx = null) {
	try {
		const dbUser = await getUser(userId);
		const limits = await getRemainingLimits(userId);
		
		let firstName = dbUser.firstName || "User";
		let lastName = dbUser.lastName || "";
		let username = dbUser.username || "NoUsername";

		// Try to enrich from Telegram if context is available and is a proper Update context
		if (ctx && ctx.from && typeof ctx.answerCbQuery === 'function') {
			firstName = ctx.from.first_name || firstName;
			lastName = ctx.from.last_name || lastName;
			username = ctx.from.username ? `@${ctx.from.username}` : username;
		}

		return {
			FIRSTNAME: firstName,
			LASTNAME: lastName,
			USERNAME: username,
			USERID: String(userId),
			CREDITS: String(limits.credits || 0),
			FRG: String(limits.credits || 0), // Alias
			TOTAL_REPORTS: String(dbUser.stats?.totalReports || 0),
			GROUPNAME: (ctx && ctx.chat && ctx.chat.title) ? ctx.chat.title : "Direct Chat"
		};
	} catch (e) {
		console.error("fetchUserVariables error:", e.message);
		return {
			FIRSTNAME: "User",
			LASTNAME: "",
			USERNAME: "User",
			USERID: String(userId),
			CREDITS: "0",
			FRG: "0",
			TOTAL_REPORTS: "0",
			GROUPNAME: "Bot"
		};
	}
}

/**
 * List of available Global Variables for Documentation
 */
export const GLOBAL_VARIABLES = [
	{ key: "FIRSTNAME", desc: "User's first name" },
	{ key: "LASTNAME", desc: "User's last name" },
	{ key: "USERID", desc: "Numerical User ID" },
	{ key: "USERNAME", desc: "Telegram @username" },
	{ key: "GROUPNAME", desc: "Current group title" },
	{ key: "HOUR", desc: "Current hour (HH)" },
	{ key: "MIN", desc: "Current minute (MM)" },
	{ key: "SEC", desc: "Current second (SS)" },
	{ key: "YEAR", desc: "Current year (YYYY)" },
	{ key: "MON", desc: "Month number (01-12)" },
	{ key: "DAY", desc: "Day number (01-31)" },
	{ key: "MONN", desc: "Month name (e.g. March)" },
	{ key: "ton_price", desc: "Current TON price in USD" },
	{ key: "price_888", desc: "Current +888 Floor price in TON" },
	{ key: "ton_change", desc: "TON 24h change %" },
	{ key: "BOT_NAME", desc: "The bot's configured name" },
	{ key: "CREDITS", desc: "Current FRG balance of the user" },
	{ key: "FRG", desc: "Alias for {CREDITS}" },
	{ key: "TOTAL_REPORTS", desc: "Total reports user has generated" }
];
