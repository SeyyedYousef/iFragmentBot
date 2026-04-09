/**
 * Admin Services Controller
 * Refactored v18.0 — Performance & Clean Management
 */

import { getPoolStats } from "../../Modules/Market/Infrastructure/fragment.repository.js";
import {
	addFrgCredits,
	getAllUsers,
	getSponsorText,
	getStats,
	setSponsorText,
	toggleBlock,
} from "../../Modules/User/Application/user.service.js";
import { getAllCacheStats } from "../../Shared/Infra/Cache/cache.service.js";
import { getLimiterStats } from "../../Shared/Infra/Network/rate-limiter.service.js";
import {
	getStateStats,
	userStates,
} from "../../Shared/Infra/State/state.service.js";

// Import UI Helpers
import * as UI from "./admin.ui.js";

/**
 * Main registration entry point
 */
export function registerAdminHandlers(bot, isAdmin) {
	registerMonitoringRoutes(bot, isAdmin);
	registerModerationRoutes(bot, isAdmin);
	registerCommunicationRoutes(bot, isAdmin);
	registerMarketingRoutes(bot, isAdmin);
}

// -------------------- MONITORING & STATS --------------------

function registerMonitoringRoutes(bot, isAdmin) {
	bot.action("admin_stats", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		const stats = getStats();
		await ctx.replyWithMarkdown(UI.getAdminStatsMessage(stats));
	});

	bot.action("admin_system", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		const limiter = getLimiterStats();
		const cache = getAllCacheStats();
		const state = getStateStats();
		const pool = getPoolStats();
		await ctx.replyWithMarkdown(
			UI.getSystemPerformanceMessage(limiter, cache, state, pool),
		);
	});
}

// -------------------- USER MODERATION --------------------

function registerModerationRoutes(bot, isAdmin) {
	bot.action("admin_block", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "admin_block",
			timestamp: Date.now(),
		});
		await ctx.replyWithMarkdown(UI.getBlockUserPrompt());
	});

	bot.action("admin_unblock", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "admin_unblock",
			timestamp: Date.now(),
		});
		await ctx.replyWithMarkdown(UI.getUnblockUserPrompt());
	});
}

// -------------------- COMMUNICATION & NEWS --------------------

function registerCommunicationRoutes(bot, isAdmin) {
	bot.action("admin_broadcast", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "admin_broadcast",
			timestamp: Date.now(),
		});
		await ctx.replyWithMarkdown(UI.getBroadcastPrompt());
	});

	bot.action("admin_frag_news", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "frag_news_await_photo",
			timestamp: Date.now(),
		});
		await ctx.replyWithMarkdown(UI.getNewsPostPrompt(1));
	});

	bot.action("admin_frag_news_2", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "frag_news_2_await_photo",
			timestamp: Date.now(),
		});
		await ctx.replyWithMarkdown(UI.getNewsPostPrompt(2));
	});
}

// -------------------- MARKETING & CONFIG --------------------

function registerMarketingRoutes(bot, isAdmin) {
	bot.action("admin_edit_sponsor", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const current = getSponsorText();
		userStates.set(ctx.chat.id, {
			action: "admin_edit_sponsor",
			timestamp: Date.now(),
		});
		await ctx.replyWithMarkdown(UI.getEditSponsorPrompt(current));
	});

	bot.action("admin_advanced", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		await ctx.replyWithMarkdown(
			`🚀 *Advanced AI Settings*\n\nCapabilities:\n• 🧠 Model Training (Coming Soon)\n• 🤖 Auto-Response Tuning\n• 📊 Deep Analytics\n\n_This module is currently under development._`,
		);
	});
}

// -------------------- TEXT MESSAGE ROUTING --------------------

export async function handleAdminTextMessage(ctx, state, bot, isAdmin) {
	if (!isAdmin(ctx.from.id)) return false;
	const input = ctx.message.text.trim();
	const chatId = ctx.chat.id;

	const simpleHandlers = {
		admin_block: async (c, i) => {
			await toggleBlock(i, true);
			c.reply(`🚫 User ${i} blocked.`).catch(() => {});
			return true;
		},
		admin_unblock: async (c, i) => {
			await toggleBlock(i, false);
			c.reply(`✅ User ${i} unblocked.`).catch(() => {});
			return true;
		},
		admin_edit_sponsor: async (c, i) => {
			setSponsorText(i);
			c.reply(`✅ Sponsor updated.`).catch(() => {});
			return true;
		},
	};

	if (simpleHandlers[state.action]) {
		userStates.delete(chatId);
		return simpleHandlers[state.action](ctx, input);
	}

	if (state.action === "admin_broadcast")
		return handleBroadcast(ctx, input, bot);
	if (state.action === "admin_add_frg" || state.action === "admin_remove_frg")
		return handleFrgAdjustment(ctx, input, state.action, bot);
	if (state.action === "frag_news_await_text" || state.action === "frag_news_2_await_text")
		return handleNewsPostText(ctx, state, bot);

	return false;
}

async function handleNewsPostText(ctx, state, bot) {
	const headline = ctx.message.text.trim();
	const chatId = ctx.chat.id;
	const isType2 = state.action === "frag_news_2_await_text";

	userStates.delete(chatId);
	const statusMsg = await ctx.reply(isType2 ? "🎨 Generating News Card (Full)..." : "🎨 Generating News Card (Portrait)...");

	try {
		const module = await import("../../Shared/UI/Components/card-generator.component.js");
		const generator = isType2 ? module.generateNewsCard2 : module.generateNewsCard;
		
		if (!generator) throw new Error("Card generator function not found");

		const imageBuffer = await generator({
			image: state.image,
			headline: headline
		});

		try { await bot.telegram.deleteMessage(chatId, statusMsg.message_id); } catch {}

		await ctx.replyWithPhoto({ source: imageBuffer }, {
			caption: `📰 *Fragment News*\n\nHeadline: *${headline}*\nType: \`${isType2 ? 'V2 (Full)' : 'V1 (Portrait)'}\`\n\n_Generated by @${ctx.botInfo.username}_`,
			parse_mode: "Markdown"
		});
	} catch (error) {
		console.error("News card generation failed:", error);
		await ctx.reply(`❌ Generation failed: ${error.message}`);
	}
	return true;
}
async function handleBroadcast(ctx, input, bot) {
	userStates.delete(ctx.chat.id);
	const users = getAllUsers();
	const status = await ctx.reply(`📢 Broadcasting to ${users.length} users...`);
	let s = 0,
		f = 0;
	for (const u of users) {
		try {
			await bot.telegram.sendMessage(u.id, input, { parse_mode: "Markdown" });
			s++;
		} catch {
			f++;
		}
		await new Promise((r) => setTimeout(r, 50));
	}
	await ctx.telegram.editMessageText(
		ctx.chat.id,
		status.message_id,
		null,
		`✅ Broadcast complete!\n\n• Success: ${s}\n• Failed: ${f}`,
	);
	return true;
}

async function handleFrgAdjustment(ctx, input, action, bot) {
	const [tId, amtStr] = input.split(/\s+/);
	const amt = parseInt(amtStr, 10);
	if (!tId || Number.isNaN(amt))
		return ctx
			.reply("❌ Invalid format. Use: `user_id amount`")
			.then(() => true);

	userStates.delete(ctx.chat.id);
	const finalAmt = action === "admin_remove_frg" ? -amt : amt;
	const balance = await addFrgCredits(tId, finalAmt, "Admin Adjustment");
	await ctx.reply(
		`💰 *Balance Adjusted!*\n📅 User: \`${tId}\`\n📈 New Balance: \`${balance} FRG\``,
		{ parse_mode: "Markdown" },
	);
	try {
		await bot.telegram.sendMessage(
			tId,
			`💰 *Balance Updated*\n\nYour balance is now: **${balance} FRG**`,
			{ parse_mode: "Markdown" },
		);
	} catch {}
	return true;
}

export default { registerAdminHandlers, handleAdminTextMessage };
