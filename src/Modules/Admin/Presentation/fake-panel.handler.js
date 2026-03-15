/**
 * Fake Panel Handlers
 * Telegram bot handlers for fake panel operations
 */

import { orders } from "../../../database/panelDatabase.js";
import { userStates } from "../../../Shared/Infra/State/state.service.js";
import * as fakePanel from "../Application/fake-panel.service.js";

// ==================== MEMBER HANDLERS ====================

export function registerFakePanelHandlers(bot, isAdmin) {
	// Member menu
	bot.action("fake_member", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		await ctx.editMessageText(
			`
👥 *افزودن ممبر*

نوع ممبر را انتخاب کنید:

📌 *ممبر گروه* - افزودن کاربر به گروه
📌 *ممبر کانال* - افزودن کاربر اجباری به کانال

⚠️ نکته: کاربران باید قبلاً ربات را استارت کرده باشند.
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: "👥 ممبر گروه (Add)",
								callback_data: "fake_member_group",
							},
							{
								text: "📢 جوین کانال/گروه (Join)",
								callback_data: "fake_member_channel_join",
							},
						],
						[{ text: "🔙 بازگشت", callback_data: "panel_fake" }],
					],
				},
			},
		);
	});

	// Member to group
	bot.action("fake_member_group", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		userStates.set(ctx.chat.id, { action: "awaiting_member_group_link" });

		await ctx.editMessageText(
			`
👥 *افزودن ممبر به گروه*

لینک یا یوزرنیم گروه مقصد را ارسال کنید:

مثال:
\`@mygroup\`
\`https://t.me/mygroup\`
\`https://t.me/+abcdefg\`
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [[{ text: "❌ لغو", callback_data: "fake_member" }]],
				},
			},
		);
	});

	// Mass Join Channel/Group
	bot.action("fake_member_channel_join", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		userStates.set(ctx.chat.id, { action: "awaiting_join_link" });

		await ctx.editMessageText(
			`
📢 *جوین در کانال/گروه (Mass Join)*
        
لینک کانال یا گروه را ارسال کنید:
(اکانت‌های شما با این لینک جوین می‌شوند)
        
مثال:
\`@mychannel\`
\`https://t.me/mychannel\`
\`https://t.me/+AbCdEfGh\`
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [[{ text: "❌ لغو", callback_data: "fake_member" }]],
				},
			},
		);
	});

	// View menu
	bot.action("fake_view", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		userStates.set(ctx.chat.id, { action: "awaiting_view_link" });

		await ctx.editMessageText(
			`
👁️ *افزایش بازدید پست*

لینک پست را ارسال کنید:

مثال:
\`https://t.me/channel/123\`

سپس تعداد بازدید مورد نظر را وارد کنید.
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [[{ text: "❌ لغو", callback_data: "panel_fake" }]],
				},
			},
		);
	});

	// Reaction menu
	bot.action("fake_reaction", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		userStates.set(ctx.chat.id, { action: "awaiting_reaction_link" });

		await ctx.editMessageText(
			`
👍 *افزودن ری‌اکشن*

لینک پست را ارسال کنید:

مثال:
\`https://t.me/channel/123\`
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [[{ text: "❌ لغو", callback_data: "panel_fake" }]],
				},
			},
		);
	});

	// Comment menu
	bot.action("fake_comment", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		await ctx.editMessageText(
			`
💬 *ارسال کامنت*

روش ارسال را انتخاب کنید:

📝 *کامنت دستی* - متن کامنت را خودتان بنویسید
📋 *کامنت‌های آماده* - از لیست آماده انتخاب کنید
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[
							{ text: "📝 کامنت دستی", callback_data: "fake_comment_manual" },
							{ text: "📋 کامنت آماده", callback_data: "fake_comment_preset" },
						],
						[{ text: "🔙 بازگشت", callback_data: "panel_fake" }],
					],
				},
			},
		);
	});

	// Manual comment
	bot.action("fake_comment_manual", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		userStates.set(ctx.chat.id, { action: "awaiting_comment_link" });

		await ctx.editMessageText(
			`
📝 *کامنت دستی*

لینک پست را ارسال کنید:

مثال: \`https://t.me/channel/123\`
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "❌ لغو", callback_data: "fake_comment" }],
					],
				},
			},
		);
	});

	// Preset comments
	bot.action("fake_comment_preset", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		const positiveComments = fakePanel.predefinedComments.positive.slice(0, 4);
		const neutralComments = fakePanel.predefinedComments.neutral.slice(0, 4);

		let msg = `📋 *کامنت‌های آماده*\n\n`;
		msg += `👍 *مثبت:*\n`;
		positiveComments.forEach((c, i) => {
			msg += `${i + 1}. ${c}\n`;
		});
		msg += `\n😐 *خنثی:*\n`;
		neutralComments.forEach((c, i) => {
			msg += `${i + 1}. ${c}\n`;
		});

		await ctx.editMessageText(msg, {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[
						{
							text: "👍 استفاده از مثبت",
							callback_data: "use_positive_comments",
						},
						{
							text: "😐 استفاده از خنثی",
							callback_data: "use_neutral_comments",
						},
					],
					[{ text: "🔙 بازگشت", callback_data: "fake_comment" }],
				],
			},
		});
	});

	// Start bot menu
	bot.action("fake_start_bot", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		userStates.set(ctx.chat.id, { action: "awaiting_bot_username" });

		await ctx.editMessageText(
			`
🤖 *استارت ربات*

یوزرنیم ربات مقصد را ارسال کنید:

مثال: \`@mybot\`

سپس تعداد استارت مورد نظر را وارد کنید.
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [[{ text: "❌ لغو", callback_data: "panel_fake" }]],
				},
			},
		);
	});

	// Reaction emoji selection
	bot.action(/^select_reaction:(.+)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");

		const emoji = ctx.match[1];
		const state = userStates.get(ctx.chat.id);

		if (!state || !state.reactionData) {
			return ctx.answerCbQuery("خطا: اطلاعات پست یافت نشد");
		}

		await ctx.answerCbQuery(`${emoji} انتخاب شد`);

		state.reactionData.emoji = emoji;
		state.action = "awaiting_reaction_count";
		userStates.set(ctx.chat.id, state);

		await ctx.editMessageText(
			`
👍 *تعداد ری‌اکشن*

ایموجی انتخاب شده: ${emoji}

تعداد ری‌اکشن مورد نظر را ارسال کنید:
        `.trim(),
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [[{ text: "❌ لغو", callback_data: "panel_fake" }]],
				},
			},
		);
	});

	// Order status check
	bot.action("adder_order_status", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("دسترسی ندارید");
		await ctx.answerCbQuery();

		const runningOrders = orders.getRunning();
		const recentOrders = orders.getAll().slice(0, 10);

		let msg = `📊 *وضعیت سفارشات*\n\n`;

		if (runningOrders.length > 0) {
			msg += `🟢 *در حال اجرا (${runningOrders.length}):*\n`;
			runningOrders.forEach((order) => {
				msg += `• ${order.type}: ${order.completed}/${order.count}\n`;
			});
			msg += "\n";
		}

		msg += `📋 *آخرین سفارشات:*\n`;
		if (recentOrders.length === 0) {
			msg += "_هیچ سفارشی ثبت نشده_\n";
		} else {
			recentOrders.forEach((order) => {
				const statusEmoji =
					order.status === "completed"
						? "✅"
						: order.status === "running"
							? "🔄"
							: order.status === "failed"
								? "❌"
								: "⏸️";
				msg += `${statusEmoji} ${order.type} - ${order.completed}/${order.count}\n`;
			});
		}

		await ctx.editMessageText(msg, {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[{ text: "🔄 بروزرسانی", callback_data: "adder_order_status" }],
					[{ text: "🔙 بازگشت", callback_data: "panel_adder" }],
				],
			},
		});
	});

	// Fake panel handlers registered
}

// ==================== TEXT MESSAGE HANDLERS ====================

export function handleFakePanelTextMessage(ctx, state) {
	const text = ctx.message.text;

	switch (state.action) {
		case "awaiting_member_group_link":
			return handleMemberGroupLink(ctx, text);
		case "awaiting_member_userlist":
			return handleMemberUserList(ctx, text, state);
		case "awaiting_view_link":
			return handleViewLink(ctx, text);
		case "awaiting_view_count":
			return handleViewCount(ctx, text, state);
		case "awaiting_reaction_link":
			return handleReactionLink(ctx, text);
		case "awaiting_reaction_count":
			return handleReactionCount(ctx, text, state);
		case "awaiting_comment_link":
			return handleCommentLink(ctx, text);
		case "awaiting_comment_text":
			return handleCommentText(ctx, text, state);
		case "awaiting_join_link":
			return handleJoinLink(ctx, text);
		case "awaiting_join_count":
			return handleJoinCount(ctx, text, state);
		case "awaiting_bot_username":
			return handleBotUsername(ctx, text);
		case "awaiting_bot_count":
			return handleBotCount(ctx, text, state);
		default:
			return false;
	}
}

async function handleMemberGroupLink(ctx, text) {
	const state = { action: "awaiting_member_userlist", groupLink: text };
	userStates.set(ctx.chat.id, state);

	await ctx.reply(
		`
✅ گروه: \`${text}\`

حالا لیست یوزرنیم‌ها یا آیدی‌ها را ارسال کنید.
هر یوزرنیم در یک خط جداگانه.

مثال:
\`@user1\`
\`@user2\`
\`123456789\`
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	return true;
}

async function handleMemberUserList(ctx, text, state) {
	const users = text
		.split("\n")
		.map((u) => u.trim())
		.filter((u) => u);

	if (users.length === 0) {
		await ctx.reply("❌ لیست یوزرنیم خالی است.");
		return true;
	}

	userStates.delete(ctx.chat.id);

	const progressMsg = await ctx.reply(
		`
🔄 *شروع افزودن ممبر*

📌 گروه: \`${state.groupLink}\`
👥 تعداد: ${users.length}

⏳ لطفاً صبر کنید...
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	try {
		const result = await fakePanel.addMembersToGroup(
			state.groupLink,
			users,
			async (progress) => {
				try {
					await ctx.telegram.editMessageText(
						ctx.chat.id,
						progressMsg.message_id,
						null,
						`🔄 *در حال افزودن ممبر*\n\n` +
							`📊 پیشرفت: ${progress.current}/${progress.total}\n` +
							`✅ موفق: ${progress.success}\n` +
							`❌ ناموفق: ${progress.failed}`,
						{ parse_mode: "Markdown" },
					);
				} catch (_e) {}
			},
		);

		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`✅ *عملیات تکمیل شد*\n\n` +
				`✅ موفق: ${result.success}\n` +
				`❌ ناموفق: ${result.failed}\n` +
				(result.errors.length > 0
					? `\n⚠️ خطاها:\n${result.errors.slice(0, 5).join("\n")}`
					: ""),
			{ parse_mode: "Markdown" },
		);
	} catch (error) {
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`❌ خطا: ${error.message}`,
			{ parse_mode: "Markdown" },
		);
	}

	return true;
}

async function handleViewLink(ctx, text) {
	const parsed = parsePostLink(text);
	if (!parsed) {
		await ctx.reply("❌ لینک نامعتبر است. لطفاً لینک صحیح ارسال کنید.");
		return true;
	}

	const state = {
		action: "awaiting_view_count",
		viewData: { channel: parsed.channel, messageId: parsed.messageId },
	};
	userStates.set(ctx.chat.id, state);

	await ctx.reply(
		`
✅ پست: \`${text}\`

تعداد بازدید مورد نظر را ارسال کنید:
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	return true;
}

async function handleViewCount(ctx, text, state) {
	const count = parseInt(text, 10);
	if (Number.isNaN(count) || count <= 0) {
		await ctx.reply("❌ تعداد نامعتبر است.");
		return true;
	}

	userStates.delete(ctx.chat.id);

	const progressMsg = await ctx.reply(
		`
🔄 *شروع افزایش بازدید*

👁️ تعداد: ${count}
⏳ لطفاً صبر کنید...
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	try {
		const result = await fakePanel.addViews(
			state.viewData.channel,
			state.viewData.messageId,
			count,
			async (progress) => {
				try {
					await ctx.telegram.editMessageText(
						ctx.chat.id,
						progressMsg.message_id,
						null,
						`🔄 *در حال افزایش بازدید*\n\n📊 پیشرفت: ${progress.current}/${progress.total}`,
						{ parse_mode: "Markdown" },
					);
				} catch (_e) {}
			},
		);

		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`✅ *بازدید اضافه شد*\n\n✅ موفق: ${result.success}\n❌ ناموفق: ${result.failed}`,
			{ parse_mode: "Markdown" },
		);
	} catch (error) {
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`❌ خطا: ${error.message}`,
			{ parse_mode: "Markdown" },
		);
	}

	return true;
}

async function handleReactionLink(ctx, text) {
	const parsed = parsePostLink(text);
	if (!parsed) {
		await ctx.reply("❌ لینک نامعتبر است.");
		return true;
	}

	const state = {
		action: "awaiting_reaction_emoji",
		reactionData: { channel: parsed.channel, messageId: parsed.messageId },
	};
	userStates.set(ctx.chat.id, state);

	await ctx.reply(
		`
✅ پست: \`${text}\`

ایموجی ری‌اکشن را انتخاب کنید:
    `.trim(),
		{
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[
						{ text: "👍", callback_data: "select_reaction:👍" },
						{ text: "❤️", callback_data: "select_reaction:❤️" },
						{ text: "🔥", callback_data: "select_reaction:🔥" },
						{ text: "👏", callback_data: "select_reaction:👏" },
					],
					[
						{ text: "😍", callback_data: "select_reaction:😍" },
						{ text: "🎉", callback_data: "select_reaction:🎉" },
						{ text: "⭐", callback_data: "select_reaction:⭐" },
						{ text: "💯", callback_data: "select_reaction:💯" },
					],
				],
			},
		},
	);

	return true;
}

async function handleReactionCount(ctx, text, state) {
	const count = parseInt(text, 10);
	if (Number.isNaN(count) || count <= 0) {
		await ctx.reply("❌ تعداد نامعتبر است.");
		return true;
	}

	userStates.delete(ctx.chat.id);

	const progressMsg = await ctx.reply(
		`
🔄 *شروع افزودن ری‌اکشن*

${state.reactionData.emoji} تعداد: ${count}
⏳ لطفاً صبر کنید...
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	try {
		const result = await fakePanel.addReactions(
			state.reactionData.channel,
			state.reactionData.messageId,
			state.reactionData.emoji,
			count,
		);

		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`✅ *ری‌اکشن اضافه شد*\n\n✅ موفق: ${result.success}\n❌ ناموفق: ${result.failed}`,
			{ parse_mode: "Markdown" },
		);
	} catch (error) {
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`❌ خطا: ${error.message}`,
			{ parse_mode: "Markdown" },
		);
	}

	return true;
}

async function handleCommentLink(ctx, text) {
	const parsed = parsePostLink(text);
	if (!parsed) {
		await ctx.reply("❌ لینک نامعتبر است.");
		return true;
	}

	const state = {
		action: "awaiting_comment_text",
		commentData: { channel: parsed.channel, messageId: parsed.messageId },
	};
	userStates.set(ctx.chat.id, state);

	await ctx.reply(
		`
✅ پست: \`${text}\`

کامنت‌ها را ارسال کنید (هر کامنت در یک خط):
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	return true;
}

async function handleCommentText(ctx, text, state) {
	const comments = text
		.split("\n")
		.map((c) => c.trim())
		.filter((c) => c);

	if (comments.length === 0) {
		await ctx.reply("❌ کامنت خالی است.");
		return true;
	}

	userStates.delete(ctx.chat.id);

	const progressMsg = await ctx.reply(
		`
🔄 *شروع ارسال کامنت*

💬 تعداد: ${comments.length}
⏳ لطفاً صبر کنید...
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	try {
		const result = await fakePanel.addComments(
			state.commentData.channel,
			state.commentData.messageId,
			comments,
		);

		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`✅ *کامنت ارسال شد*\n\n✅ موفق: ${result.success}\n❌ ناموفق: ${result.failed}`,
			{ parse_mode: "Markdown" },
		);
	} catch (error) {
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`❌ خطا: ${error.message}`,
			{ parse_mode: "Markdown" },
		);
	}

	return true;
}

async function handleBotUsername(ctx, text) {
	const username = text.replace("@", "").trim();

	if (!username) {
		await ctx.reply("❌ یوزرنیم نامعتبر است.");
		return true;
	}

	const state = { action: "awaiting_bot_count", botUsername: username };
	userStates.set(ctx.chat.id, state);

	await ctx.reply(
		`
✅ ربات: @${username}

تعداد استارت مورد نظر را ارسال کنید:
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	return true;
}

async function handleBotCount(ctx, text, state) {
	const count = parseInt(text, 10);
	if (Number.isNaN(count) || count <= 0) {
		await ctx.reply("❌ تعداد نامعتبر است.");
		return true;
	}

	userStates.delete(ctx.chat.id);

	const progressMsg = await ctx.reply(
		`
🔄 *شروع استارت ربات*

🤖 ربات: @${state.botUsername}
📊 تعداد: ${count}
⏳ لطفاً صبر کنید...
    `.trim(),
		{ parse_mode: "Markdown" },
	);

	try {
		const result = await fakePanel.startBot(state.botUsername, count);

		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`✅ *استارت ربات انجام شد*\n\n✅ موفق: ${result.success}\n❌ ناموفق: ${result.failed}`,
			{ parse_mode: "Markdown" },
		);
	} catch (error) {
		await ctx.telegram.editMessageText(
			ctx.chat.id,
			progressMsg.message_id,
			null,
			`❌ خطا: ${error.message}`,
			{ parse_mode: "Markdown" },
		);
	}

	return true;
}

// ==================== HELPERS ====================

function parsePostLink(link) {
	// Parse t.me/channel/123 or t.me/c/123456/789
	const patterns = [
		/t\.me\/([^/]+)\/(\d+)/, // public channel
		/t\.me\/c\/(\d+)\/(\d+)/, // private channel
	];

	for (const pattern of patterns) {
		const match = link.match(pattern);
		if (match) {
			return {
				channel: match[1],
				messageId: parseInt(match[2], 10),
			};
		}
	}

	return null;
}

export default {
	registerFakePanelHandlers,
	handleFakePanelTextMessage,
};
