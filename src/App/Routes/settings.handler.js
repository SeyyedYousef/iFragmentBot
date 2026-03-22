/**
 * Settings & Proxy Management Controller
 * Refactored v18.0 — Performance & Clean Management
 */

import { settings } from "../../database/panelDatabase.js";
import * as proxyManager from "../../Shared/Infra/Network/proxy-manager.service.js";
import { userStates } from "../../Shared/Infra/State/state.service.js";

// Import UI Helpers
import * as UI from "./settings.ui.js";

/**
 * Main registration entry point
 */
export function registerSettingsHandlers(bot, isAdmin) {
	registerProxyRoutes(bot, isAdmin);
	registerCloudRoutes(bot, isAdmin);
	registerGhostRoutes(bot, isAdmin);
	registerRestRoutes(bot, isAdmin);
}

// -------------------- PROXY MANAGEMENT ROUTES --------------------

function registerProxyRoutes(bot, isAdmin) {
	// Action: Proxy Status
	bot.action("settings_proxy_status", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery("❌ Access denied");
		await ctx.answerCbQuery();
		const stats = await proxyManager.getProxyStats();
		const allProxies = await proxyManager.getAllProxies();
		const preview = allProxies.slice(0, 10);
		await ctx.editMessageText(UI.getProxyStatusMessage(stats, preview), {
			parse_mode: "Markdown",
			...UI.getProxyStatusKeyboard(),
		});
	});

	// Action: Test All Proxies
	bot.action("settings_test_proxies", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery("⏳ در حال تست پروکسی‌ها...");
		const allProxies = await proxyManager.getAllProxies();
		if (allProxies.length === 0)
			return ctx.editMessageText("❌ هیچ پروکسی‌ای ثبت نشده.", {
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Back", callback_data: "settings_proxy_status" }],
					],
				},
			});

		await ctx.editMessageText(`🔍 *نتایج تست پروکسی‌ها*\n\n⏳ در حال تست...\n`, {
			parse_mode: "Markdown",
		});
		const results = await proxyManager.testAllProxies();

		let msg = `🔍 *نتایج تست پروکسی‌ها*\n\n`;
		let working = 0,
			failed = 0;
		for (const r of results) {
			if (r.success) {
				msg += `🟢 ${r.host}:${r.port} - ${r.latency}ms\n`;
				working++;
			} else {
				msg += `🔴 ${r.host}:${r.port} - ${r.error}\n`;
				failed++;
			}
		}
		msg += `\n📊 سالم: ${working} | خراب: ${failed}`;

		await ctx.editMessageText(msg, {
			parse_mode: "Markdown",
			reply_markup: {
				inline_keyboard: [
					[{ text: "🔄 تست مجدد", callback_data: "settings_test_proxies" }],
					[{ text: "🔙 بازگشت", callback_data: "settings_proxy_status" }],
				],
			},
		});
	});

	// Action: Add Proxy Prompt
	bot.action("settings_add_proxy", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		userStates.set(ctx.chat.id, { action: "awaiting_proxy" });
		await ctx.editMessageText(
			`➕ *افزودن پروکسی*\n\nپروکسی‌ها را ارسال کنید (هر خط یک پروکسی)\n\n_مثال:_ \`socks5://user:pass@host:port\``,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "❌ لغو", callback_data: "settings_proxy_status" }],
					],
				},
			},
		);
	});

	bot.action("settings_delete_all_proxies", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		await ctx.editMessageText(
			`⚠️ *تأیید حذف*\n\nآیا از حذف همه پروکسی‌ها مطمئن هستید؟`,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[
							{ text: "✅ بله", callback_data: "confirm_delete_proxies" },
							{ text: "❌ خیر", callback_data: "settings_proxy_status" },
						],
					],
				},
			},
		);
	});

	bot.action("confirm_delete_proxies", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await proxyManager.deleteAllProxies();
		await ctx.answerCbQuery("✅ حذف شدند");
		await ctx.editMessageText("✅ همه پروکسی‌ها حذف شدند.", {
			reply_markup: {
				inline_keyboard: [
					[{ text: "🔙 Back", callback_data: "panel_settings" }],
				],
			},
		});
	});
}

// -------------------- PROXY CLOUD (SCRAPER) ROUTES --------------------

function registerCloudRoutes(bot, isAdmin) {
	bot.action("settings_proxy_cloud", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const status = await proxyManager.getScraperStatus();
		await ctx.editMessageText(UI.getProxyCloudMessage(status), {
			parse_mode: "Markdown",
			...UI.getProxyCloudKeyboard(status),
		});
	});

	bot.action("proxy_cloud_scrape", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const status = await proxyManager.getScraperStatus();
		if (status.isRunning) return ctx.answerCbQuery("⚠️ عملیات در حال اجراست...");
		await ctx.answerCbQuery("⏳ شروع دریافت...");

		proxyManager.scrapeProxies().then(async (res) => {
			const report = `☁️ *گزارش دریافت*\n\n📥 دریافت: \`${res.fetched}\` | 🟢 سالم: \`${res.working}\` | 💾 ذخیره: \`${res.added}\``;
			ctx.reply(report, { parse_mode: "Markdown" }).catch(() => {});
		});

		await ctx.editMessageText(
			`🚀 *عملیات آغاز شد*\n\nربات در حال جستجو است. نتیجه ارسال خواهد شد.`,
			{
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Back", callback_data: "settings_proxy_cloud" }],
					],
				},
			},
		);
	});

	bot.action("proxy_cloud_toggle_auto", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const status = await proxyManager.getScraperStatus();
		if (status.autoEnabled) await proxyManager.stopAutoScraper();
		else await proxyManager.startAutoScraper(60);
		await ctx.answerCbQuery(
			status.autoEnabled ? "🔴 غیرفعال شد" : "🟢 فعال شد",
		);
		const newStatus = await proxyManager.getScraperStatus();
		await ctx.editMessageText(UI.getProxyCloudMessage(newStatus), {
			parse_mode: "Markdown",
			...UI.getProxyCloudKeyboard(newStatus),
		});
	});
}

// -------------------- GHOST MODE ROUTES --------------------

function registerGhostRoutes(bot, isAdmin) {
	bot.action("settings_ghost_mode", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const status = await proxyManager.getGhostStatus();
		await ctx.editMessageText(UI.getGhostModeMessage(status), {
			parse_mode: "Markdown",
			...UI.getGhostModeKeyboard(status),
		});
	});

	bot.action("ghost_mode_toggle", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const status = await proxyManager.getGhostStatus();
		if (status.isEnabled) await proxyManager.stopGhostMode();
		else await proxyManager.startGhostMode(status.interval);
		await ctx.answerCbQuery(status.isEnabled ? "🔴 غیرفعال شد" : "🟢 فعال شد");
		const newStatus = await proxyManager.getGhostStatus();
		await ctx.editMessageText(UI.getGhostModeMessage(newStatus), {
			parse_mode: "Markdown",
			...UI.getGhostModeKeyboard(newStatus),
		});
	});

	bot.action(/^ghost_mode_set:(\d+)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const interval = parseInt(ctx.match[1], 10);
		await proxyManager.startGhostMode(interval);
		await ctx.answerCbQuery(`✅ زمان: هر ${interval} دقیقه`);
		const status = await proxyManager.getGhostStatus();
		await ctx.editMessageText(UI.getGhostModeMessage(status), {
			parse_mode: "Markdown",
			...UI.getGhostModeKeyboard(status),
		});
	});
}

// -------------------- TIMING & MODE ROUTES --------------------

function registerRestRoutes(bot, isAdmin) {
	bot.action("settings_rest_time", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const current = await settings.get("rest_time", 30);
		await ctx.editMessageText(UI.getRestTimeMessage(current), {
			parse_mode: "Markdown",
			...UI.getRestTimeKeyboard(),
		});
	});

	bot.action(/^set_rest:(\d+)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const mins = parseInt(ctx.match[1], 10);
		await settings.set("rest_time", mins);
		await ctx.answerCbQuery(`✅ زمان استراحت: ${mins} دقیقه`);
		await ctx.editMessageText(
			`✅ *زمان استراحت ذخیره شد*\n\nمدت جدید: \`${mins} دقیقه\``,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Back", callback_data: "panel_settings" }],
					],
				},
			},
		);
	});

	bot.action("settings_account_mode", async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		await ctx.answerCbQuery();
		const mode = await settings.get("account_mode", "sequential");
		await ctx.editMessageText(UI.getAccountModeMessage(mode), {
			parse_mode: "Markdown",
			...UI.getAccountModeKeyboard(mode),
		});
	});

	bot.action(/^set_mode:(sequential|concurrent)$/, async (ctx) => {
		if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
		const mode = ctx.match[1];
		await settings.set("account_mode", mode);
		await ctx.answerCbQuery(
			`✅ حالت: ${mode === "sequential" ? "ترتیبی" : "همزمان"}`,
		);
		await ctx.editMessageText(
			`✅ *حالت اکانت ذخیره شد*\n\nحالت جدید: \`${mode === "sequential" ? "ترتیبی" : "همزمان"}\``,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Back", callback_data: "panel_settings" }],
					],
				},
			},
		);
	});
}

export async function handleSettingsTextMessage(ctx, state) {
	const input = ctx.message.text.trim();
	const chatId = ctx.chat.id;

	if (state.action === "awaiting_proxy") {
		userStates.delete(chatId);
		const lines = input.split("\n").filter((l) => l.trim().length > 0);
		let added = 0;
		for (const line of lines) {
			const success = await proxyManager.addProxy(line.trim());
			if (success) added++;
		}
		await ctx.reply(`✅ پروکسی‌ها بررسی شدند.\n📥 تعداد اضافه شده: \`${added}\``, {
			parse_mode: "Markdown",
		});
		return true;
	}

	return false;
}

export default { registerSettingsHandlers, handleSettingsTextMessage };
