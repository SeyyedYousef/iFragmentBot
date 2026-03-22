/**
 * Fake Panel Engagement Controller
 * Refactored v18.0 — Performance & Clean Management
 */

import { orders } from "../../../database/panelDatabase.js";
import { userStates } from "../../../Shared/Infra/State/state.service.js";
import * as fakePanel from "../Application/fake-panel.service.js";

// Import UI Helpers
import * as UI from "./fake-panel.ui.js";

/**
 * Main registration entry point
 */
export function registerFakePanelHandlers(bot, isAdmin) {
	registerMemberRoutes(bot, isAdmin);
	registerEngagementRoutes(bot, isAdmin);
	registerOrderRoutes(bot, isAdmin);
}

// -------------------- MEMBER MANAGEMENT --------------------

function registerMemberRoutes(bot, isAdmin) {
	bot.action("fake_member", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const { text, keyboard } = UI.getFakeMemberMenu();
		await ctx.editMessageText(text, { parse_mode: "Markdown", ...keyboard });
	});

	bot.action("fake_member_group", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_member_group_link" });
		await ctx.editMessageText(UI.getGroupLinkPrompt(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [[{ text: "❌ لغو", callback_data: "fake_member" }]],
			},
		});
	});

	bot.action("fake_member_channel_join", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_join_link" });
		await ctx.editMessageText(UI.getJoinLinkPrompt(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [[{ text: "❌ لغو", callback_data: "fake_member" }]],
			},
		});
	});
}

// -------------------- ENGAGEMENT SERVICES --------------------

function registerEngagementRoutes(bot, isAdmin) {
	// Views
	bot.action("fake_view", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_view_link" });
		await ctx.editMessageText(UI.getViewPrompt(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [[{ text: "❌ لغو", callback_data: "panel_fake" }]],
			},
		});
	});

	// Reactions
	bot.action("fake_reaction", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_reaction_link" });
		await ctx.editMessageText(UI.getReactionPrompt(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [[{ text: "❌ لغو", callback_data: "panel_fake" }]],
			},
		});
	});

	// Reactions Emoji Selection
	bot.action(/^select_reaction:(.+)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const emoji = ctx.match[1];
		const state = userStates.get(ctx.chat.id);
		if (!state || !state.reactionData)
			return ctx.answerCbQuery("Error: Data lost");

		state.reactionData.emoji = emoji;
		state.action = "awaiting_reaction_count";
		userStates.set(ctx.chat.id, state);
		await ctx.editMessageText(
			`👍 *تعداد ری‌اکشن*\n\nایموجی انتخاب شده: ${emoji}\n\nتعداد ری‌اکشن مورد نظر را ارسال کنید:`,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [[{ text: "❌ لغو", callback_data: "panel_fake" }]],
				},
			},
		);
	});

	// Start Bot
	bot.action("fake_start_bot", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_bot_username" });
		await ctx.editMessageText(UI.getBotStartPrompt(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [[{ text: "❌ لغو", callback_data: "panel_fake" }]],
			},
		});
	});
}

// -------------------- STATUS & ORDERS --------------------

function registerOrderRoutes(bot, isAdmin) {
	bot.action("adder_order_status", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		try {
			const running = await orders.getRunning();
			const all = (await orders.getAll()).slice(0, 10);
			await ctx.editMessageText(UI.getOrderStatusMessage(running, all), {
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔄 بروزرسانی", callback_data: "adder_order_status" }],
						[{ text: "🔙 بازگشت", callback_data: "panel_adder" }],
					],
				},
			});
		} catch (error) {
			console.error("Order Status Error:", error);
			await ctx.reply("❌ خطا در دریافت وضعیت سفارشات. دیتابیس متصل نیست؟");
		}
	});
}

// -------------------- TEXT MESSAGE ROUTING --------------------

export function handleFakePanelTextMessage(ctx, state) {
	const text = ctx.message?.text?.trim();
	if (!text) return false;

	const handlers = {
		awaiting_member_group_link: async (c, t) => {
			userStates.set(c.chat.id, {
				action: "awaiting_member_userlist",
				groupLink: t,
			});
			await c.reply(`✅ گروه: \`${t}\`\n\nحالا لیست یوزرنیم‌ها را ارسال کنید.`, {
				parse_mode: "Markdown",
			});
			return true;
		},
		awaiting_view_link: async (c, t) => {
			const parsed = parsePostLink(t);
			if (!parsed) return c.reply("❌ لینک نامعتبر.").then(() => true);
			userStates.set(c.chat.id, {
				action: "awaiting_view_count",
				viewData: { channel: parsed.channel, messageId: parsed.messageId },
			});
			await c.reply(`✅ پست: \`${t}\`\n\nتعداد بازدید را ارسال کنید:`, {
				parse_mode: "Markdown",
			});
			return true;
		},
		awaiting_bot_username: async (c, t) => {
			const u = t.replace("@", "");
			userStates.set(c.chat.id, {
				action: "awaiting_bot_count",
				botUsername: u,
			});
			await c.reply(`✅ ربات: @${u}\n\nتعداد استارت را ارسال کنید:`, {
				parse_mode: "Markdown",
			});
			return true;
		},
	};

	if (handlers[state.action]) return handlers[state.action](ctx, text);

	// Fallback Switch for complex multi-step ones
	switch (state.action) {
		case "awaiting_member_userlist":
			return handleMassMemberAdd(ctx, text, state);
		case "awaiting_view_count":
			return handleViewAdd(ctx, text, state);
		case "awaiting_bot_count":
			return handleBotAdd(ctx, text, state);
	}
	return false;
}

// Logic implementations (Delegated)
async function handleMassMemberAdd(ctx, text, state) {
	const users = text
		.split("\n")
		.map((u) => u.trim())
		.filter((u) => u);
	userStates.delete(ctx.chat.id);
	const prog = await ctx.reply("🔄 *شروع افزودن ممبر*...", {
		parse_mode: "Markdown",
	});
	try {
		const res = await fakePanel.addMembersToGroup(
			state.groupLink,
			users,
			(p) => {
				ctx.telegram
					.editMessageText(
						ctx.chat.id,
						prog.message_id,
						null,
						`🔄 *در حال افزودن ممبر*\n\n📊 ${p.current}/${p.total} | ✅ ${p.success}`,
						{ parse_mode: "Markdown" },
					)
					.catch(() => {});
			},
		);
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			prog.message_id,
			null,
			`✅ تکمیل شد!\n\n✅ ${res.success} | ❌ ${res.failed}`,
			{ parse_mode: "Markdown" },
		);
	} catch (e) {
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			prog.message_id,
			null,
			`❌ Error: ${e.message}`,
		);
	}
	return true;
}

async function handleViewAdd(ctx, text, state) {
	const count = parseInt(text, 10);
	if (Number.isNaN(count))
		return ctx.reply("❌ تعداد نامعتبر").then(() => true);
	userStates.delete(ctx.chat.id);
	const prog = await ctx.reply("🔄 *شروع افزایش بازدید*...", {
		parse_mode: "Markdown",
	});
	try {
		const res = await fakePanel.addViews(
			state.viewData.channel,
			state.viewData.messageId,
			count,
			(p) => {
				ctx.telegram
					.editMessageText(
						ctx.chat.id,
						prog.message_id,
						null,
						`🔄 بازدید: ${p.current}/${p.total}`,
						{ parse_mode: "Markdown" },
					)
					.catch(() => {});
			},
		);
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			prog.message_id,
			null,
			`✅ تکمیل: ${res.success}`,
			{ parse_mode: "Markdown" },
		);
	} catch (e) {
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			prog.message_id,
			null,
			`❌ Error: ${e.message}`,
		);
	}
	return true;
}

async function handleBotAdd(ctx, text, state) {
	const count = parseInt(text, 10);
	if (Number.isNaN(count))
		return ctx.reply("❌ تعداد نامعتبر").then(() => true);
	userStates.delete(ctx.chat.id);
	const prog = await ctx.reply("🔄 *شروع استارت ربات*...", {
		parse_mode: "Markdown",
	});
	try {
		const res = await fakePanel.startBot(state.botUsername, count);
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			prog.message_id,
			null,
			`✅ تکمیل: ${res.success}`,
			{ parse_mode: "Markdown" },
		);
	} catch (e) {
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			prog.message_id,
			null,
			`❌ Error: ${e.message}`,
		);
	}
	return true;
}

function parsePostLink(link) {
	const match = link.match(/t\.me\/([a-zA-Z0-9_]+)\/(\d+)/);
	return match
		? { channel: match[1], messageId: parseInt(match[2], 10) }
		: null;
}

export default { registerFakePanelHandlers, handleFakePanelTextMessage };
