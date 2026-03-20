/**
 * Operations & Advanced Tools Controller
 * Refactored v18.0 — Performance & Clean Management
 */

import * as reportSystem from "../../Modules/Admin/Application/report-system.service.js";
import * as g2g from "../../Modules/Automation/Application/group-to-group.service.js";
import * as receiverService from "../../Modules/Automation/Application/receiver.service.js";
import * as profileManager from "../../Modules/User/Application/profile-manager.service.js";
import { userStates } from "../../Shared/Infra/State/state.service.js";

// Import UI Helpers
import * as UI from "./operations.ui.js";

/**
 * Main registration entry point
 */
export function registerOperationsHandlers(bot, isAdmin) {
	registerProfileRoutes(bot, isAdmin);
	registerReceiverRoutes(bot, isAdmin);
	registerReportRoutes(bot, isAdmin);
	registerExtractionRoutes(bot, isAdmin);
	registerEngagementRoutes(bot, isAdmin);
}

// -------------------- PROFILE SYSTEM ROUTES --------------------

function registerProfileRoutes(bot, isAdmin) {
	// Profile main menu
	bot.action("ops_profile_system", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		const stats = profileManager.getProfileStats();
		await ctx.editMessageText(UI.getProfileSystemMessage(stats), {
			parse_mode: "Markdown",
			...UI.getProfileSystemKeyboard(),
		});
	});

	// Add profile prompt
	bot.action("ops_add_profile", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_profile_data" });
		await ctx.editMessageText(
			`➕ *افزودن پروفایل*\n\nفرمت: \`نام|نام‌خانوادگی|بیو\`\n\nمثال: \`علی|احمدی|برنامه‌نویس\``,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "❌ لغو", callback_data: "ops_profile_system" }],
					],
				},
			},
		);
	});

	// List profiles
	bot.action("ops_list_profiles", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const profiles = profileManager.getAllProfiles();
		if (profiles.length === 0)
			return ctx.editMessageText("❌ هیچ پروفایلی ثبت نشده.", {
				reply_markup: {
					inline_keyboard: [
						[{ text: "➕ افزودن", callback_data: "ops_add_profile" }],
						[{ text: "🔙 بازگشت", callback_data: "ops_profile_system" }],
					],
				},
			});

		let msg =
			`📋 *لیست پروفایل‌ها*\n\n` +
			profiles
				.slice(0, 15)
				.map(
					(p, i) =>
						`${i + 1}. ${p.is_used ? "✅" : "⬜"} ${p.first_name} ${p.last_name || ""}`,
				)
				.join("\n");
		if (profiles.length > 15)
			msg += `\n_و ${profiles.length - 15} مورد دیگر..._`;

		await ctx.editMessageText(msg, {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[{ text: "🗑️ حذف همه", callback_data: "ops_delete_all_profiles" }],
					[{ text: "🔙 بازگشت", callback_data: "ops_profile_system" }],
				],
			},
		});
	});

	// Apply profiles
	bot.action("confirm_apply_profiles", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery("⏳ در حال اعمال...");
		const results = await profileManager.applyRandomProfilesToAllAccounts();
		await ctx.editMessageText(
			`📤 *اعمال پروفایل تکمیل شد*\n\n✅ موفق: ${results.success}\n❌ ناموفق: ${results.failed}`,
			{
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Back", callback_data: "ops_profile_system" }],
					],
				},
			},
		);
	});
}

// -------------------- RECEIVER SYSTEM ROUTES --------------------

function registerReceiverRoutes(bot, isAdmin) {
	bot.action("ops_receiver_system", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const stats = receiverService.getReceiverStats();
		await ctx.editMessageText(UI.getReceiverSystemMessage(stats), {
			parse_mode: "Markdown",
			...UI.getReceiverSystemKeyboard(),
		});
	});

	bot.action("receiver_pending", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const pending = receiverService.getPendingAccounts();
		if (pending.length === 0)
			return ctx.editMessageText("✅ هیچ درخواستی در انتظار تأیید نیست.", {
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Back", callback_data: "ops_receiver_system" }],
					],
				},
			});

		const buttons = pending
			.slice(0, 8)
			.map((acc) => [
				{ text: `📱 ${acc.phone}`, callback_data: `view_receiver:${acc.id}` },
			]);
		buttons.push([{ text: "🔙 Back", callback_data: "ops_receiver_system" }]);
		await ctx.editMessageText(`📋 *درخواست‌های در انتظار تأیید*`, {
			parse_mode: "Markdown",
			reply_markup: { inline_keyboard: buttons },
		});
	});
}

// -------------------- REPORT SYSTEM ROUTES --------------------

function registerReportRoutes(bot, isAdmin) {
	bot.action("ops_report_system", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const report = reportSystem.generateStatusReport();
		await ctx.editMessageText(report, {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[
						{ text: "🔄 Refresh", callback_data: "ops_report_system" },
						{ text: "⏰ Clear Rests", callback_data: "clear_all_rests" },
					],
					[{ text: "🗑️ Remove Reported", callback_data: "remove_reported" }],
					[{ text: "🔙 Back", callback_data: "panel_operations" }],
				],
			},
		});
	});

	bot.action("remove_reported", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		await ctx.editMessageText(
			`⚠️ *تأیید حذف*\n\nآیا می‌خواهید همه اکانت‌های ریپورت شده حذف شوند؟`,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[
							{ text: "✅ بله", callback_data: "confirm_remove_reported" },
							{ text: "❌ خیر", callback_data: "ops_report_system" },
						],
					],
				},
			},
		);
	});

	bot.action("confirm_remove_reported", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery("⏳ در حال حذف...");
		const res = await reportSystem.removeReportedAccounts();
		await ctx.editMessageText(
			`✅ *حذف اکانت‌های ریپورت شده*\n\n🗑️ حذف: ${res.removed} | ❌ ناموفق: ${res.failed}`,
			{
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Back", callback_data: "ops_report_system" }],
					],
				},
			},
		);
	});
}

// -------------------- EXTRACTION & TOOLS ROUTES --------------------

function registerExtractionRoutes(bot, isAdmin) {
	bot.action("ops_gift_extraction", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_gift_links" });
		await ctx.editMessageText(UI.getGiftExtractionMessage(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[{ text: "❌ لغو", callback_data: "panel_operations" }],
				],
			},
		});
	});

	bot.action("ops_extract_range", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_range_data" });
		await ctx.editMessageText(UI.getRangeExtractionMessage(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[{ text: "❌ لغو", callback_data: "panel_operations" }],
				],
			},
		});
	});

	bot.action("ops_extract_comments", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_comment_post_link" });
		await ctx.editMessageText(UI.getCommentExtractionMessage(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[{ text: "❌ لغو", callback_data: "panel_operations" }],
				],
			},
		});
	});
}

function registerEngagementRoutes(bot, isAdmin) {
	bot.action("ops_multi_invite", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_invite_links" });
		await ctx.editMessageText(
			`🔗 *لینک‌های دعوت متعدد*\n\nلینک‌های دعوت را ارسال کنید (هر خط یک لینک)`,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "❌ لغو", callback_data: "panel_operations" }],
					],
				},
			},
		);
	});
}

// -------------------- TEXT MESSAGE ROUTING --------------------

export function handleOperationsTextMessage(ctx, state) {
	const text = ctx.message?.text;
	if (!text) return false;

	const strategies = {
		awaiting_profile_data: async (c, t) => {
			const res = profileManager.addProfilesFromText(t);
			c.reply(
				`📊 *نتیجه*\n\n✅ موفق: ${res.success} | ❌ ناموفق: ${res.failed}`,
				{ parse_mode: "Markdown" },
			);
			return true;
		},
		awaiting_range_data: async (c, t) => {
			const [slug, start, end] = t.split("|").map((p) => p.trim());
			if (!slug || Number.isNaN(Number.parseInt(start, 10))) {
				c.reply("❌ فرمت غلط است. مثال: `pepe|1|50`").catch(() => {});
				return true;
			}
			const pMsg = await c.reply(`⏳ شروع استخراج از *${slug}*...`, {
				parse_mode: "Markdown",
			});
			g2g
				.extractOwnersFromCollection(
					slug,
					parseInt(start, 10),
					parseInt(end, 10),
					(cur, tot, suc) => {
						if (cur % 10 === 0)
							c.telegram
								.editMessageText(
									c.chat.id,
									pMsg.message_id,
									null,
									`⏳ *${slug}*: \`${cur}/${tot}\` | ✅ یافت شده: \`${suc}\``,
									{ parse_mode: "Markdown" },
								)
								.catch(() => {});
					},
				)
				.then((res) =>
					c.reply(
						`✅ *اتمام استخراج ${slug}*\n\n📊 کل: ${res.total} | ✅ یافت: ${res.success}`,
						{ parse_mode: "Markdown" },
					),
				);
			return true;
		},
	};

	const strategy = strategies[state.action];
	if (strategy) {
		userStates.delete(ctx.chat.id);
		return strategy(ctx, text);
	}
	return false;
}

export default { registerOperationsHandlers, handleOperationsTextMessage };
