/**
 * Main Menu & User Services Controller
 * Refactored v18.0 — Performance & Clean Management
 */

import {
	formatQueueMessage,
	JOB_TYPES,
	jobQueue,
	PRIORITIES,
} from "../../Modules/Automation/Application/queue.service.js";
import {
	handleGiftPagination,
	handleNumberPagination,
	handleUsernamePagination,
} from "../../Modules/Monitoring/Application/wallet-tracker.service.js";
import {
	canUseFeature,
	formatNoCreditsMessage,
	getRemainingLimits,
	getSponsorText,
	getTimeUntilReset,
	useFeature,
} from "../../Modules/User/Application/user.service.js";
import { getDashboardConfig, getTemplates } from "../../Shared/Infra/Database/settings.repository.js";
import { userStates } from "../../Shared/Infra/State/state.service.js";
import { sendDashboard } from "../Helpers/dashboard.helper.js";
import { checkMembershipOrStop } from "../Helpers/membership.helper.js";
import { handleComparison } from "./comparison.handler.js";
import { handleGroupCommand } from "./group.handler.js";

// Import UI Helpers
import * as UI from "./menu.ui.js";

/**
 * Main registration entry point
 */
export function registerMenuHandlers(bot, isAdmin) {
	registerCoreRoutes(bot, isAdmin);
	registerAccountRoutes(bot, isAdmin);
	registerReportingRoutes(bot, isAdmin);
	registerEngagementRoutes(bot, isAdmin);
	registerPortfolioRoutes(bot, isAdmin);
}

// -------------------- CORE SYSTEMS --------------------

function registerCoreRoutes(bot, _isAdmin) {
	bot.action("back_to_menu", async (ctx) => {
		await ctx.answerCbQuery();
		userStates.delete(ctx.chat.id);
		await sendDashboard(ctx, true);
	});

	bot.action("menu_sponsors", async (ctx) => {
		await ctx.answerCbQuery();
		const text = getSponsorText();
		const kb = Markup.inlineKeyboard([
			[{ text: "🔙 Back", callback_data: "back_to_menu" }],
		]);
		ctx
			.editMessageText(text, {
				parse_mode: "Markdown",
				reply_markup: kb.reply_markup,
				disable_web_page_preview: true,
			})
			.catch(() =>
				ctx.replyWithMarkdown(text, {
					reply_markup: kb.reply_markup,
					disable_web_page_preview: true,
				}),
			);
	});
}

// -------------------- USER ACCOUNT SYSTEMS --------------------

function registerAccountRoutes(bot, _isAdmin) {
	bot.action("menu_account", async (ctx) => {
		await ctx.answerCbQuery();
		const user = ctx.from;
		const [limits, resetTime, templates] = await Promise.all([
			getRemainingLimits(user.id),
			getTimeUntilReset(user.id),
			getTemplates()
		]);

		const msg = UI.getAccountMessage(user, limits, resetTime, templates);
		const kb = UI.getAccountKeyboard();

		ctx
			.editMessageText(msg, {
				parse_mode: "Markdown",
				reply_markup: kb.reply_markup,
				disable_web_page_preview: true,
			})
			.catch(() =>
				ctx.replyWithMarkdown(msg, {
					reply_markup: kb.reply_markup,
					disable_web_page_preview: true,
				}),
			);
	});

	bot.action("menu_transfer", async (ctx) => {
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "transfer_frg_target",
			timestamp: Date.now(),
		});
		const prompt = `✦ *TRANSFER FRG BALANCE*\n\nSend the @username or User ID of the recipient:`;
		const cancel = Markup.inlineKeyboard([
			[{ text: "❌ Cancel", callback_data: "back_to_menu" }],
		]);
		ctx
			.editMessageText(prompt, {
				parse_mode: "Markdown",
				reply_markup: cancel.reply_markup,
			})
			.catch(() =>
				ctx.replyWithMarkdown(prompt, { reply_markup: cancel.reply_markup }),
			);
	});
}

// -------------------- ANALYTICS & REPORTING ROUTES --------------------

function registerReportingRoutes(bot, isAdmin) {
	bot.action("report_username", async (ctx) => {
		const [isMember, templates] = await Promise.all([
			checkMembershipOrStop(ctx, bot, isAdmin),
			getTemplates()
		]);
		if (!isMember) return;
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "username_report",
			timestamp: Date.now(),
		});
		ctx
			.editMessageText(UI.getUsernamePrompt(templates), {
				parse_mode: "HTML",
				reply_markup: UI.getServicePromptKeyboard("cancel_username_report")
					.reply_markup,
			})
			.catch(() =>
				ctx.replyWithMarkdown(
					UI.getUsernamePrompt(templates),
					UI.getServicePromptKeyboard("cancel_username_report"),
				),
			);
	});

	bot.action("report_gifts", async (ctx) => {
		const [isMember, templates] = await Promise.all([
			checkMembershipOrStop(ctx, bot, isAdmin),
			getTemplates()
		]);
		if (!isMember) return;
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "gift_report",
			timestamp: Date.now(),
		});
		ctx
			.editMessageText(UI.getGiftPrompt(templates), {
				parse_mode: "HTML",
				reply_markup: UI.getServicePromptKeyboard("cancel_gift_report")
					.reply_markup,
			})
			.catch(() =>
				ctx.replyWithMarkdown(
					UI.getGiftPrompt(templates),
					UI.getServicePromptKeyboard("cancel_gift_report"),
				),
			);
	});

	bot.action("report_numbers", async (ctx) => {
		const [isMember, templates] = await Promise.all([
			checkMembershipOrStop(ctx, bot, isAdmin),
			getTemplates()
		]);
		if (!isMember) return;
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, {
			action: "number_report",
			timestamp: Date.now(),
		});
		ctx
			.editMessageText(UI.getNumberPrompt(templates), {
				parse_mode: "HTML",
				reply_markup: UI.getServicePromptKeyboard("cancel_number_report")
					.reply_markup,
			})
			.catch(() =>
				ctx.replyWithMarkdown(
					UI.getNumberPrompt(templates),
					UI.getServicePromptKeyboard("cancel_number_report"),
				),
			);
	});

	// Cancellation Generic Logic
	bot.action(/cancel_(username|gift|number)_report/, async (ctx) => {
		await ctx.answerCbQuery("❌ Cancelled");
		userStates.delete(ctx.chat.id);
		const msg = UI.getCancelMenuMessage();
		const kb = { reply_markup: UI.getCancelMenuKeyboard() };
		ctx
			.editMessageText(msg, {
				parse_mode: "Markdown",
				reply_markup: kb.reply_markup,
			})
			.catch(() => ctx.replyWithMarkdown(msg, { reply_markup: kb.reply_markup }));
	});
}

// -------------------- COMPARISON & ENGAGEMENT --------------------

function registerEngagementRoutes(bot, isAdmin) {
	bot.action("menu_compare", async (ctx) => {
		const [isMember, canUse, templates] = await Promise.all([
			checkMembershipOrStop(ctx, bot, isAdmin),
			canUseFeature(ctx.from.id, "compare"),
			getTemplates()
		]);
		
		if (!isMember) return;
		await ctx.answerCbQuery();

		if (!canUse)
			return ctx.editMessageText(formatNoCreditsMessage("compare"), {
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "🌟 Buy Premium", callback_data: "buy_premium" }],
						[{ text: "🔙 Back", callback_data: "back_to_menu" }],
					],
				},
			});

		userStates.set(ctx.chat.id, {
			action: "compare",
			step: 1,
			timestamp: Date.now(),
		});
		ctx.editMessageText(UI.getComparePrompt(templates), {
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: [
					[{ text: "❌ Cancel", callback_data: "cancel_compare" }],
				],
			},
		});
	});

	bot.action("cancel_compare", async (ctx) => {
		await ctx.answerCbQuery("❌ Cancelled");
		userStates.delete(ctx.chat.id);
		await sendDashboard(ctx, true);
	});
}

// -------------------- PORTFOLIO TRACKING --------------------

function registerPortfolioRoutes(bot, isAdmin) {
	bot.action("menu_portfolio", async (ctx) => {
		const [isMember, canUse, templates] = await Promise.all([
			checkMembershipOrStop(ctx, bot, isAdmin),
			canUseFeature(ctx.from.id, "portfolio"),
			getTemplates()
		]);
		
		if (!isMember) return;
		await ctx.answerCbQuery();

		if (!canUse)
			return ctx.editMessageText(formatNoCreditsMessage("portfolio"), {
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "🌟 Buy Premium", callback_data: "buy_premium" }],
						[{ text: "🔙 Back", callback_data: "back_to_menu" }],
					],
				},
			});

		userStates.set(ctx.chat.id, { action: "portfolio", timestamp: Date.now() });
		ctx.editMessageText(UI.getPortfolioPrompt(templates), {
			parse_mode: "HTML",
			reply_markup: {
				inline_keyboard: [
					[{ text: "❌ Cancel", callback_data: "cancel_portfolio" }],
				],
			},
		});
	});

	bot.action(/^wt_(user|num|gift)_(\d+)/, async (ctx) => {
		const type = ctx.match[1];
		const page = parseInt(ctx.match[2], 10);
		try {
			if (type === "user") await handleUsernamePagination(ctx, page);
			else if (type === "num") await handleNumberPagination(ctx, page);
			else await handleGiftPagination(ctx, page);
			await ctx.answerCbQuery();
		} catch (_e) {
			await ctx.answerCbQuery("⚠️ Error");
		}
	});
}

// -------------------- TEXT MESSAGE ROUTING --------------------

export async function handleMenuTextMessage(
	ctx,
	state,
	_bot,
	_isAdmin,
	getTelegramClient,
) {
	const input = ctx.message.text.trim();
	const chatId = ctx.chat.id;

	const reportActions = {
		username_report: `!u ${input.replace("@", "")}`,
		gift_report: `!gift ${input}`,
		number_report: `!number ${input}`,
	};

	if (reportActions[state.action]) {
		userStates.delete(chatId);
		await handleGroupCommand(
			ctx,
			reportActions[state.action],
			handleComparison,
			getTelegramClient,
		);
		return true;
	}

	if (state.action === "compare")
		return handleComparisonFlow(ctx, state, input);
	return false;
}

async function handleComparisonFlow(ctx, state, input) {
	const chatId = ctx.chat.id;
	if (state.step === 1) {
		userStates.set(chatId, {
			action: "compare",
			step: 2,
			user1: input.replace("@", ""),
			timestamp: Date.now(),
		});
		await ctx.replyWithMarkdown(
			`✅ *First username saved:* \`@${input.replace("@", "")}\`\n\n💬 *Step 2: Now send the second @username to compare with:*`,
			{
				reply_markup: {
					inline_keyboard: [
						[{ text: "❌ Cancel", callback_data: "cancel_compare" }],
					],
				},
			},
		);
		return true;
	} else {
		// Consuming limit
		if (!(await useFeature(ctx.from.id, "compare")).success) {
			userStates.delete(chatId);
			return ctx.reply(formatNoCreditsMessage("compare"), {
				parse_mode: "Markdown",
			});
		}
		userStates.delete(chatId);
		const wait = jobQueue.getEstimatedWait(null);
		await jobQueue.add({
			type: JOB_TYPES.COMPARISON,
			userId: ctx.from.id,
			chatId,
			data: { user1: state.user1, user2: input.replace("@", "") },
			priority: PRIORITIES.NORMAL,
		});
		await ctx.reply(
			wait > 5
				? formatQueueMessage(jobQueue.getPosition(null) + 1, wait, false)
				: `⚔️ Comparing @${state.user1} vs @${input.replace("@", "")}...`,
			{ parse_mode: "Markdown" },
		);
		return true;
	}
}

export default { registerMenuHandlers, handleMenuTextMessage };
