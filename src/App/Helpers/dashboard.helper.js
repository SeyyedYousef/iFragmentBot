/**
 * Dashboard & Initial State Orchestrator
 * Refactored v18.0 — Performance & Clean Management
 */

import { CONFIG } from "../../core/Config/app.config.js";
import * as marketService from "../../Modules/Market/Application/market.service.js";
import { getTonMarketStats } from "../../Modules/Market/Infrastructure/fragment.repository.js";
import { getRemainingLimits, getUser } from "../../Modules/User/Application/user.service.js";
import { tonPriceCache } from "../../Shared/Infra/Cache/cache.service.js";
import * as starsRepo from "../../Modules/Stars/Infrastructure/stars.repository.js";
import { formatPremiumHTML } from "../../Shared/Infra/Telegram/telegram.formatter.js";

// Import UI Helpers
import * as UI from "../Presentation/dashboard.ui.js";
import { getDashboardConfig, getTemplates } from "../../Shared/Infra/Database/settings.repository.js";
import { ensurePersonalWorkspace } from "../../Shared/Infra/Telegram/telegram.topics.js";
import { renderTemplate } from "../../Shared/Infra/Telegram/telegram.cms.js";

/**
 * Orchestrate dashboard rendering: Data fetching -> Formatting -> Delivery
 */
export async function sendDashboard(ctx, isEdit = false) {
	const userId = ctx.from.id;
	const name = ctx.from.first_name || "Trader";

	// Background non-blocking tasks
	updateUserDataInBackground(ctx);

	const config = await getDashboardConfig();
	const templates = await getTemplates();
	const marketData = getMarketPulse();
	const { credits } = await getRemainingLimits(userId);

	// Personal Workspace Check (Topics v9.4+)
	let threadId = null;
	if (config?.features?.topics_enabled && ctx.chat.type === "private") {
		const workspace = await ensurePersonalWorkspace(ctx.telegram, userId);
		if (workspace) threadId = workspace.pulse; // Main dashboard goes to pulse topic
	}

	// CMS Template Rendering
	const message = renderTemplate(templates.start || UI.getDashboardMessage(name, marketData, credits), {
		FIRSTNAME: ctx.from.first_name,
		LASTNAME: ctx.from.last_name || "",
		USERNAME: ctx.from.username ? `@${ctx.from.username}` : "User",
		USERID: String(ctx.from.id),
		BOT_NAME: CONFIG.BOT_NAME,
		...marketData,
		stars_ton: marketData.starsTon || "...",
		price_888: marketData.price888 ? `${marketData.price888.toLocaleString()} TON` : "Updating...",
		ton_price: marketData.tonPrice ? marketData.tonPrice.toFixed(2) : "...",
		CREDITS: String(credits)
	});

	const keyboard = await UI.getDashboardKeyboard();

	try {
		const options = {
			parse_mode: "HTML",
			disable_web_page_preview: true,
			reply_markup: keyboard.reply_markup,
		};
		if (threadId) options.message_thread_id = threadId;
		if (isEdit) {
			await ctx.editMessageText(message, options).catch(async (e) => {
				if (!e.message.includes("not modified"))
					await ctx.reply(message, options);
			});
		} else {
			await ctx.reply(message, options);
		}
	} catch (e) {
		console.error("Dashboard send failed", e.message);
	}
}

// -------------------- DATA ORCHESTRATION --------------------

function getMarketPulse() {
	const ton = tonPriceCache.get("marketStats") || {
		price: 5.5,
		change24h: 0,
		timestamp: 0,
	};
	const floor888 = tonPriceCache.get("floor888");

	// Trigger background sync if stale (staggered)
	if (!ton.timestamp || Date.now() - ton.timestamp > 7200000) syncTonMarket();
	if (!floor888 || Date.now() - floor888.timestamp > 3600000) sync888Floor();

	return {
		tonPrice: ton.price,
		tonChange: ton.change24h,
		price888: floor888?.price,
		starsTon: tonPriceCache.get("starsPrice")?.price,
	};
}

async function updateUserDataInBackground(ctx) {
	const userId = ctx.from.id;
	// Self-correcting user profile
	const user = await getUser(userId);
	user.username = ctx.from.username;
	user.firstName = ctx.from.first_name;

	// TODO: scanUserGiftsIfNeeded(userId) can be added later
}

// -------------------- SYNC HELPERS (Silent) --------------------

async function syncTonMarket() {
	try {
		const fresh = await getTonMarketStats();
		if (fresh?.price > 0) {
			tonPriceCache.set("marketStats", { ...fresh, timestamp: Date.now() });
			tonPriceCache.set("price", fresh.price);
		}
	} catch {}
}

async function sync888Floor() {
	try {
		const price = await marketService.get888Stats();
		if (price) tonPriceCache.set("floor888", { price, timestamp: Date.now() });
		
		// Sync Stars while we are at it
		const stars = await starsRepo.scrapeStarsPricing();
		if (stars && stars.length > 0) {
			const topPackage = stars.sort((a,b) => b.stars - a.stars)[0];
			tonPriceCache.set("starsPrice", { price: topPackage.perStarTon * 100, timestamp: Date.now() }); // Price per 100 stars
		}
	} catch {}
}
