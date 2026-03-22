/**
 * Admin Panel Controller
 * Refactored v18.0 — Performance & Clean Management
 */

import { Markup } from "telegraf";
import { accountStatus } from "../../../database/panelDatabase.js";
import { userStates } from "../../../Shared/Infra/State/state.service.js";
import * as groupToGroupService from "../../Automation/Application/group-to-group.service.js";
import { sendMarketStatsReport } from "../../Market/Application/market-stats.service.js";
import apifyAPI from "../../Market/Infrastructure/apify.api.js";
import giftAssetAPI from "../../Market/Infrastructure/free_gift_engine.api.js";
import * as accountManager from "../../User/Application/account-manager.service.js";
import {
	getDashboardConfig,
	updateDashboardButton,
	toggleGlobalFeature,
	getTemplates,
	updateTemplate
} from "../../../Shared/Infra/Database/settings.repository.js";
import { formatPremiumText } from "../../../Shared/Infra/Telegram/telegram.formatter.js";

// Import UI Helpers
import * as UI from "./panel.ui.js";

/**
 * Main registration entry point
 */
export function registerPanelHandlers(bot, isAdmin) {
	registerCoreRoutes(bot, isAdmin);
	registerAccountRoutes(bot, isAdmin);
	registerAdderRoutes(bot, isAdmin);
	registerFakePanelRoutes(bot, isAdmin);
	registerApiManagementRoutes(bot, isAdmin);
	registerDashboardRoutes(bot, isAdmin);
}

// -------------------- CORE SYSTEM ROUTES --------------------

function registerCoreRoutes(bot, isAdmin) {
	// Command: /panel
	bot.command("panel", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return;
		try {
			await ctx.replyWithMarkdown(
				UI.getMainPanelMessage(),
				UI.getMainPanelKeyboard(),
			);
		} catch (e) {
			console.error("Panel Error:", e);
			ctx.reply("Error loading panel");
		}
	});

	// Action: Back to Main
	bot.action("panel_main", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		await ctx.editMessageText(UI.getMainPanelMessage(), {
			parse_mode: "Markdown",
			...UI.getMainPanelKeyboard(),
		});
	});

	// Market Stats
	bot.action("admin_market_stats", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		const loadingMsg = await ctx.reply("⏳ Loading Market Data...");
		await sendMarketStatsReport(ctx, loadingMsg);
	});

	// System / Server Info
	bot.action("admin_system", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		await ctx.editMessageText(UI.getServerInfoMessage(), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[Markup.button.callback("🔄 Refresh", "admin_system")],
					[Markup.button.callback("🔙 Back", "panel_main")],
				],
			},
		});
	});
}

// -------------------- ACCOUNT MANAGEMENT ROUTES --------------------

function registerAccountRoutes(bot, isAdmin) {
	// Accounts Main
	bot.action("panel_accounts", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		const accounts = accountManager.getAccountList();
		const stats = await accountStatus.getStats();
		await ctx.editMessageText(UI.getAccountsMessage(accounts, stats), {
			parse_mode: "Markdown",
			...UI.getAccountsKeyboard(),
		});
	});

	// Account List With Pagination
	bot.action(/^panel_list_accounts(_page_(\d+))?$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();

		const accounts = accountManager.getAccountList();
		const page = ctx.match[2] ? parseInt(ctx.match[2], 10) : 1;
		const pageSize = 10;
		const totalPages = Math.ceil(accounts.length / pageSize);
		const startIdx = (page - 1) * pageSize;
		const pageItems = accounts.slice(startIdx, startIdx + pageSize);

		let msg = `📋 *لیست اکانت‌ها (${accounts.length})*\n📑 صفحه ${page} از ${totalPages || 1}\n\n`;
		if (accounts.length === 0) msg += "_هیچ اکانتی متصل نیست._\n";
		else {
			for (let i = 0; i < pageItems.length; i++) {
				const acc = pageItems[i];
				const status = (await accountStatus.get(acc.phone)) || {};
				const icon = status.is_reported
					? "🔴"
					: status.is_resting
						? "🟡"
						: "🟢";
				const role = acc.role === "scanner" ? "🔍" : "👤";
				msg += `${startIdx + i + 1}. ${icon} \`${acc.phone}\`\n   ${role} ${acc.username || "No Username"}\n`;
			}
		}

		const keyboard = [];
		const navRow = [];
		if (page > 1)
			navRow.push(
				Markup.button.callback(
					"⬅️ قبلی",
					`panel_list_accounts_page_${page - 1}`,
				),
			);
		if (page < totalPages)
			navRow.push(
				Markup.button.callback(
					"بعدی ➡️",
					`panel_list_accounts_page_${page + 1}`,
				),
			);
		if (navRow.length) keyboard.push(navRow);
		keyboard.push([
			Markup.button.callback("🔄 Refresh", `panel_list_accounts_page_${page}`),
		]);
		keyboard.push([Markup.button.callback("🔙 Back", "panel_accounts")]);

		await ctx.editMessageText(msg, {
			parse_mode: "Markdown",
			reply_markup: { inline_keyboard: keyboard },
		});
	});

	// Account Status Deep-dive
	bot.action("panel_account_status", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		const stats = (await accountStatus.getStats()) || {};
		const reported = (await accountStatus.getReported()) || [];
		const resting = (await accountStatus.getResting()) || [];

		let msg = `📊 *وضعیت اکانت‌ها*\n\n• کل: \`${stats.total || 0}\`\n• 🟢 سالم: \`${stats.healthy || 0}\`\n• 🟡 در استراحت: \`${stats.resting || 0}\`\n• 🔴 ریپورت شده: \`${stats.reported || 0}\`\n\n`;

		if (resting.length > 0)
			msg +=
				`⏳ *در استراحت:*\n` +
				resting
					.slice(0, 5)
					.map((a) => `• \`${a.phone}\``)
					.join("\n") +
				"\n\n";
		if (reported.length > 0)
			msg +=
				`🚫 *ریپورت شده:*\n` +
				reported
					.slice(0, 5)
					.map((a) => `• \`${a.phone}\``)
					.join("\n") +
				"\n";

		await ctx.editMessageText(msg, {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[{ text: "♻️ پاکسازی استراحت همه", callback_data: "clear_all_rest" }],
					[{ text: "🔄 بروزرسانی", callback_data: "panel_account_status" }],
					[{ text: "🔙 بازگشت", callback_data: "panel_accounts" }],
				],
			},
		});
	});

	bot.action("clear_all_rest", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await accountStatus.clearAllRest();
		await ctx.answerCbQuery("✅ استراحت همه اکانت‌ها پاک شد");
		return ctx.editMessageText("✅ لیست استراحت با موفقیت پاک شد.", {
			reply_markup: {
				inline_keyboard: [
					[Markup.button.callback("🔙 بازگشت", "panel_account_status")],
				],
			},
		});
	});
}

// -------------------- ADDER & OPERATIONS ROUTES --------------------

function registerAdderRoutes(bot, isAdmin) {
	bot.action("panel_my_accounts", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		await ctx.editMessageText(UI.getMyAccountsMessage(), {
			parse_mode: "Markdown",
			...UI.getMyAccountsKeyboard(),
		});
	});

	bot.action("panel_adder_menu", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		await ctx.editMessageText(UI.getAdderMenuMessage(), {
			parse_mode: "Markdown",
			...UI.getAdderMenuKeyboard(),
		});
	});

	bot.action("panel_adder", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		const orderStats = await orders.getStats();
		await ctx.editMessageText(UI.getAdderManagementMessage(orderStats), {
			parse_mode: "Markdown",
			...UI.getAdderManagementKeyboard(),
		});
	});

	bot.action("adder_bot_stats", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const status = groupToGroupService.getStatus();
		const extracted = await groupToGroupService.getExtractedList(1, 0);
		const msg = `📈 *آمار ربات اددر*\n\n⚙️ **وضعیت:** ${status.isExtracting ? "در حال استخراج" : status.isAddingToGroup ? "در حال اد" : "غیرفعال"}\n📊 **استخراج:** کل: ${extracted.stats.total} | موفق: ${extracted.stats.addedToGroup}\n`;
		const keyboard = Markup.inlineKeyboard([
			[
				status.isPaused
					? Markup.button.callback("▶️ ادامه", "process_resume")
					: Markup.button.callback("⏸️ توقف", "process_pause"),
			],
			[{ text: "🔙 بازگشت", callback_data: "panel_adder" }],
		]);
		await ctx.editMessageText(msg, { parse_mode: "Markdown", ...keyboard });
	});

	bot.action("panel_operations", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		await ctx.editMessageText(UI.getOperationsMessage(), {
			parse_mode: "Markdown",
			...UI.getOperationsKeyboard(),
		});
	});

	bot.action("panel_settings", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const proxyCount = await proxies.count();
		const restTime = await settings.get("rest_time", 30);
		await ctx.editMessageText(UI.getSettingsMessage(proxyCount, restTime), {
			parse_mode: "Markdown",
			...UI.getSettingsKeyboard(),
		});
	});
}

// -------------------- FAKE PANEL ROUTES --------------------

function registerFakePanelRoutes(bot, isAdmin) {
	bot.action("panel_fake", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const orderStats = await orders.getStats();
		await ctx.editMessageText(UI.getFakePanelMessage(orderStats), {
			parse_mode: "Markdown",
			...UI.getFakePanelKeyboard(),
		});
	});
}

// -------------------- API MANAGEMENT ROUTES --------------------

function registerApiManagementRoutes(bot, isAdmin) {
	bot.action("admin_api_keys", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const tokens = giftAssetAPI.getTokenList();
		const apifyTokens = apifyAPI.getTokenList();
		let msg = `🔑 *API Key Management*\n━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Gift-Asset API*: *${giftAssetAPI.getTokenCount()}* Active\n🧩 *Apify*: *${apifyAPI.getTokenCount()}* Active\n\n`;

		if (tokens.length)
			msg +=
				`📋 *Gift-Asset:*\n` +
				tokens
					.map(
						(t, i) =>
							`  ${t.cooldown ? "🔴" : "🟢"} #${i + 1} \`${t.preview}\``,
					)
					.join("\n") +
				"\n\n";
		if (apifyTokens.length)
			msg +=
				`📋 *Apify:*\n` +
				apifyTokens.map((t, i) => `  🟢 #${i + 1} \`${t.preview}\``).join("\n");

		await ctx.editMessageText(msg, {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[
						Markup.button.callback("➕ Add GiftAsset", "admin_add_ga_token"),
						Markup.button.callback("➕ Add Apify", "admin_add_apify_token"),
					],
					[
						Markup.button.callback(
							"➖ Remove GiftAsset",
							"admin_remove_ga_token",
						),
						Markup.button.callback(
							"➖ Remove Apify",
							"admin_remove_apify_token",
						),
					],
					[Markup.button.callback("🔙 Back", "panel_main")],
				],
			},
		});
	});

	// FRG Credits
	bot.action(["admin_add_frg", "admin_remove_frg"], async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const action = ctx.match[0];
		userStates.set(ctx.chat.id, { action, timestamp: Date.now() });
		const msg =
			action === "admin_add_frg"
				? "🪙 *Add FRG Credits*"
				: "📉 *Remove FRG Credits*";
		await ctx.replyWithMarkdown(
			`${msg}\n\nSend: \`User ID amount\`\n_Example: 123456789 20_`,
		);
	});
}

// -------------------- DASHBOARD CUSTOMIZATION --------------------

function registerDashboardRoutes(bot, isAdmin) {
	// 1. Show Dashboard Editor
	bot.action("admin_dashboard_ui", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const config = await getDashboardConfig();
		await ctx.editMessageText(UI.getDashboardEditorMessage(), {
			parse_mode: "Markdown",
			...UI.getDashboardEditorKeyboard(config),
		});
	});

	// 2. Button Editing Mode (Prompt for new name)
	bot.action(/^edit_btn_(.+)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const buttonId = ctx.match[1];
		
		userStates.set(ctx.from.id, { 
			action: "edit_dashboard_button_name", 
			buttonId,
			timestamp: Date.now() 
		});

		await ctx.replyWithMarkdown(`✨ *Set New Button Name*\n\nSend the new text for \`${buttonId}\`.\nYou can use Premium Emoji IDs like \`[12345]\`.\n\n_Example: [5253] My Custom Button_`);
	});

	// 3. Style Change Selection
	bot.action(/^set_style_(.+)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const match = ctx.match[1].split("_");
		const style = match.pop(); // primary, positive, destructive
		const buttonId = match.join("_");
		
		await updateDashboardButton(buttonId, { style });
		await ctx.answerCbQuery(`✅ Style set to ${style}`);
		
		const config = await getDashboardConfig();
		await ctx.editMessageText(UI.getDashboardEditorMessage(), {
			parse_mode: "Markdown",
			...UI.getDashboardEditorKeyboard(config),
		});
	});

	// 4. Show Features Editor
	bot.action("admin_features", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const config = await getDashboardConfig();
		await ctx.editMessageText(UI.getFeaturesMessage(), {
			parse_mode: "Markdown",
			...UI.getFeaturesKeyboard(config.features || {}),
		});
	});

	// 5. Toggle Feature
	bot.action(/^toggle_feature_(.+)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const featureKey = ctx.match[1];
		const newState = await toggleGlobalFeature(featureKey);
		await ctx.answerCbQuery(`✅ ${featureKey} is now ${newState ? "ON" : "OFF"}`);
		
		const config = await getDashboardConfig();
		await ctx.editMessageText(UI.getFeaturesMessage(), {
			parse_mode: "Markdown",
			...UI.getFeaturesKeyboard(config.features || {}),
		});
	});

	// 6. CMS Entry
	bot.action("admin_cms", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const templates = await getTemplates();
		await ctx.editMessageText(UI.getCMSMessage(), {
			parse_mode: "Markdown",
			...UI.getCMSKeyboard(templates),
		});
	});

	// 7. Edit Template Select
	bot.action(/^edit_tpl_(.+)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const tplKey = ctx.match[1];
		const templates = await getTemplates();
		const current = templates[tplKey] || "";

		userStates.set(ctx.from.id, {
			action: "edit_cms_template",
			tplKey,
			timestamp: Date.now()
		});

		await ctx.editMessageText(UI.getTplEditorMessage(tplKey, current), {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [[Markup.button.callback("🔙 Cancel", "admin_cms")]]
			}
		});
	});

	// 8. Handle Text Replies for Names & Templates
	bot.on("text", async (ctx, next) => {
		const state = userStates.get(ctx.from.id);
		if (!state) return next();

		// Handle Button Name
		if (state.action === "edit_dashboard_button_name") {
			const newName = ctx.message.text.trim();
			const buttonId = state.buttonId;
			await updateDashboardButton(buttonId, { text: newName });
			userStates.delete(ctx.from.id);
			return ctx.replyWithMarkdown(`✅ *Button Updated!*\n\nButton \`${buttonId}\` is now: \`${newName}\`.\nYou can also set its color below:`, {
				...UI.getButtonStyleKeyboard(buttonId)
			});
		}

		// Handle CMS Template
		if (state.action === "edit_cms_template") {
			const newContent = ctx.message.text.trim();
			const tplKey = state.tplKey;
			await updateTemplate(tplKey, newContent);
			userStates.delete(ctx.from.id);
			const templates = await getTemplates();
			return ctx.replyWithMarkdown(`✅ *Template Updated!*`, {
				...UI.getCMSKeyboard(templates)
			});
		}

		return next();
	});
}

export default { registerPanelHandlers };
