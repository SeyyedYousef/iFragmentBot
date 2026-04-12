/**
 * Wallet Tracking Service
 * Refactored v18.0 — Performance & Clean Management
 */

import { tonPriceCache } from "../../../Shared/Infra/Cache/cache.service.js";
import * as telegramClient from "../../../Shared/Infra/Telegram/telegram.client.js";
import { generateWalletCard } from "../../../Shared/UI/Components/card-generator.component.js";
import { getPortfolio } from "../../Market/Application/portfolio.service.js";

// Import UI Helpers
import * as UI from "../Presentation/wallet.ui.js";
import { getTemplates } from "../../../Shared/Infra/Database/settings.repository.js";
import { renderTemplate, fetchUserVariables } from "../../../Shared/Infra/Telegram/telegram.cms.js";
import { CONFIG } from "../../../core/Config/app.config.js";

// Pagination settings
const ITEMS_PER_PAGE = 25;
const paginationCache = new Map();

/**
 * Handle initial wallet scan request
 */
export async function generateWalletReport(ctx, wallet) {
	const loading = await ctx.reply(
		"🔍 *Scanning wallet...*\n_Fetching balance & assets via TonAPI..._",
		{ parse_mode: "Markdown" },
	);

	try {
		const portfolio = await getPortfolio(wallet);
		if (!portfolio || portfolio.error)
			throw new Error("Could not fetch portfolio");

		const uCount = portfolio.usernames?.length || 0;
		const nCount = portfolio.anonymousNumbers?.length || 0;
		const gCount = portfolio.totalGifts || 0;
		const tonPrice = tonPriceCache.get("price") || CONFIG.LIVE_TON_PRICE || 7.2;

		// CMS Logic
		const templates = await getTemplates();
		const globalVars = await fetchUserVariables(ctx.from.id, ctx.telegram);
		const rank = getRank((portfolio.balance || 0) + (portfolio.estimatedValue || 0));
		
		const assetsSummary = `• Names: ${uCount} | Numbers: ${nCount} | Gifts: ${gCount}`;
		
		const msg = renderTemplate(templates.report_portfolio || UI.getWalletOverviewMessage(wallet, portfolio, tonPrice), {
			...globalVars,
			WALLET: `${wallet.substring(0, 8)}...${wallet.slice(-6)}`,
			BALANCE: String(portfolio.balance.toFixed(2)),
			RANK: rank,
			ASSETS: assetsSummary
		});

		const kb = UI.getWalletMainKeyboard(uCount, nCount, gCount, wallet);

		// Store session
		const cacheKey = `${ctx.chat.id}`;
		paginationCache.set(cacheKey, {
			portfolio,
			wallet,
			usernameStatuses: new Array(uCount).fill(""),
			numberStatuses: new Array(nCount).fill(""),
			timestamp: Date.now(),
		});

		await ctx.telegram
			.deleteMessage(ctx.chat.id, loading.message_id)
			.catch(() => {});

		// Card Generation (Visual Mode)
		try {
			const image = await generateWalletCard({
				address: wallet,
				rank: getRank(
					(portfolio.balance || 0) + (portfolio.estimatedValue || 0),
				),
				netWorth: (portfolio.balance || 0) + (portfolio.estimatedValue || 0),
				tonPrice: tonPrice,
				usernameCount: uCount,
				numberCount: nCount,
				giftCount: gCount,
				balance: portfolio.balance || 0,
				lastActivity: portfolio.lastActivity,
				status: portfolio.status || "active",
			});

			if (image) {
				return await ctx.replyWithPhoto(
					{ source: image },
					{ caption: msg, parse_mode: "Markdown", ...kb },
				);
			}
		} catch (e) {
			console.error("CardGen failed", e);
		}

		// Fallback Text Mode
		await ctx.reply(msg, { parse_mode: "Markdown", ...kb });

		// Silent Background Status Scanning
		populateStatuses(cacheKey).catch(() => {});
	} catch (e) {
		console.error("Wallet scanning failed:", e.message);
		await ctx.telegram
			.deleteMessage(ctx.chat.id, loading.message_id)
			.catch(() => {});
		await ctx.reply(`❌ *Failed to scan wallet*:\n${e.message}`, {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [[{ text: "🔙 Menu", callback_data: "back_to_menu" }]],
			},
		});
	}
}

// -------------------- PAGINATION HANDLERS --------------------

export async function handleUsernamePagination(ctx, page) {
	const cached = paginationCache.get(`${ctx.chat.id}`);
	if (!cached) return ctx.answerCbQuery("⚠️ Session expired.");

	const start = page * ITEMS_PER_PAGE;
	const end = Math.min(
		start + ITEMS_PER_PAGE,
		cached.portfolio.usernames.length,
	);

	// On-demand verification for current page
	for (let i = start; i < end; i++) {
		if (!cached.usernameStatuses[i]) {
			try {
				const res = await telegramClient.checkUsername(
					cached.portfolio.usernames[i].name,
				);
				cached.usernameStatuses[i] = res.active ? " ✅" : " 💤";
			} catch {
				cached.usernameStatuses[i] = " ❓";
			}
		}
	}

	const { text, keyboard } = UI.getPaginatedList(
		"user",
		cached.portfolio.usernames,
		cached.usernameStatuses,
		page,
		ITEMS_PER_PAGE,
	);
	return smartEdit(ctx, text, keyboard);
}

export async function handleNumberPagination(ctx, page) {
	const cached = paginationCache.get(`${ctx.chat.id}`);
	if (!cached) return ctx.answerCbQuery("⚠️ Session expired.");

	const start = page * ITEMS_PER_PAGE;
	const end = Math.min(
		start + ITEMS_PER_PAGE,
		cached.portfolio.anonymousNumbers.length,
	);

	for (let i = start; i < end; i++) {
		if (!cached.numberStatuses[i]) {
			try {
				const res = await telegramClient.checkPhoneNumber(
					cached.portfolio.anonymousNumbers[i].number,
				);
				cached.numberStatuses[i] = res.registered ? " 🟢" : " ⚫";
			} catch {
				cached.numberStatuses[i] = " ❓";
			}
		}
	}

	const { text, keyboard } = UI.getPaginatedList(
		"num",
		cached.portfolio.anonymousNumbers,
		cached.numberStatuses,
		page,
		ITEMS_PER_PAGE,
	);
	return smartEdit(ctx, text, keyboard);
}

export function handleGiftPagination(ctx, page) {
	const cached = paginationCache.get(`${ctx.chat.id}`);
	if (!cached) return ctx.answerCbQuery("⚠️ Session expired.");

	const { text, keyboard } = UI.getPaginatedList(
		"gift",
		cached.portfolio.gifts || [],
		[],
		page,
		ITEMS_PER_PAGE,
	);
	return smartEdit(ctx, text, keyboard);
}

// -------------------- BACKGROUND UPDATES --------------------

async function populateStatuses(key) {
	await new Promise((r) => setTimeout(r, 5000));
	const c = paginationCache.get(key);
	if (!c) return;

	for (let i = 0; i < c.portfolio.usernames.length; i++) {
		if (!c.usernameStatuses[i]) {
			try {
				const res = await telegramClient.checkUsername(
					c.portfolio.usernames[i].name,
				);
				c.usernameStatuses[i] = res.active ? " ✅" : " 💤";
				paginationCache.set(key, c);
			} catch {}
			await new Promise((r) => setTimeout(r, 1000));
		}
	}
}

// -------------------- HELPERS --------------------

function getRank(val) {
	if (val > 100000) return "MEGA WHALE";
	if (val > 10000) return "Shark";
	if (val > 1000) return "Dolphin";
	return "Shrimp";
}

async function smartEdit(ctx, text, keyboard) {
	try {
		await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
	} catch {
		await ctx
			.editMessageCaption(text, { parse_mode: "Markdown", ...keyboard })
			.catch(() => {});
	}
}
