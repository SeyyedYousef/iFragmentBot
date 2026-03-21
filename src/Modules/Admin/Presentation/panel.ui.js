import os from "node:os";
import { Markup } from "telegraf";
import {
	accountStatus,
	orders,
	proxies,
	settings,
} from "../../../database/panelDatabase.js";
import { stripPremiumTags, formatButtonMarkup } from "../../../Shared/Infra/Telegram/telegram.formatter.js";

// ==================== MAIN PANEL ====================

export function getMainPanelKeyboard() {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback("📊 Stats", "admin_stats"),
			Markup.button.callback("⚙️ System", "admin_system"),
		],
		[
			Markup.button.callback("📢 Broadcast", "admin_broadcast"),
			Markup.button.callback("⚡ Features", "admin_features"),
		],
		[Markup.button.callback("📝 Manage Messages (CMS)", "admin_cms")],
		[Markup.button.callback("📊 Market Stats", "admin_market_stats")],
		[
			Markup.button.callback("🖼 News Post", "admin_frag_news"),
			Markup.button.callback("🖼 News Post 2", "admin_frag_news_2"),
		],
		[
			Markup.button.callback("🚫 Block User", "admin_block"),
			Markup.button.callback("✅ Unblock", "admin_unblock"),
		],
		[
			Markup.button.callback("🪙 Add FRG Credits", "admin_add_frg"),
			Markup.button.callback("📉 Remove FRG", "admin_remove_frg"),
		],
		[
			Markup.button.callback("✏️ Edit Sponsor", "admin_edit_sponsor"),
			Markup.button.callback("💎 Dashboard UI", "admin_dashboard_ui"),
		],
		[Markup.button.callback("🔑 API Keys", "admin_api_keys")],
		[Markup.button.callback("🗂 My Accounts", "panel_my_accounts")],
	]);
}

export function getMainPanelMessage() {
	return `🎛️ *Admin Panel*\n\nChoose an action:`.trim();
}

// ==================== MY ACCOUNTS ====================

export function getMyAccountsKeyboard() {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback("📱 مدیریت اکانت", "panel_accounts"),
			Markup.button.callback("📦 Adder (اددر)", "panel_adder_menu"),
		],
		[Markup.button.callback("🌐 پنل فیک", "panel_fake")],
		[Markup.button.callback("🔙 بازگشت به پنل اصلی", "panel_main")],
	]);
}

export function getMyAccountsMessage() {
	return `🗂 *حساب‌های من*\n\nلطفاً ابزار مورد نظر خود را انتخاب کنید:\n\n📱 *مدیریت اکانت* - ابزارهای جدید مدیریت (سشن، سلامت، بکاپ)\n📦 *مدیریت ادر* - عملیات استخراج و اد کردن\n🌐 *پنل فیک* - افزایش آمار و تعاملات`.trim();
}

// ==================== ACCOUNT MANAGEMENT ====================

export function getAccountsKeyboard() {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback("➕ افزودن اکانت", "panel_add_account"),
			Markup.button.callback("➖ حذف اکانت", "panel_remove_account"),
		],
		[
			Markup.button.callback("💾 افزودن Session", "panel_add_session"),
			Markup.button.callback("📋 لیست اکانت‌ها", "panel_list_accounts"),
		],
		[
			Markup.button.callback("📦 بکاپ", "panel_backup_accounts"),
			Markup.button.callback("🔄 بازیابی", "panel_restore_accounts"),
		],
		[Markup.button.callback("⚙️ مدیریت تکی", "panel_manage_selection")],
		[
			Markup.button.callback("👤 تغییر پروفایل", "panel_change_profile"),
			Markup.button.callback("🔑 دریافت کد ورود", "panel_get_code"),
		],
		[
			Markup.button.callback("🔍 چک سلامت", "panel_check_health"),
			Markup.button.callback("📊 وضعیت اکانت‌ها", "panel_account_status"),
		],
		[Markup.button.callback("🔙 بازگشت", "panel_my_accounts")],
	]);
}

export function getAccountsMessage(accounts) {
	let stats = { healthy: 0, resting: 0, reported: 0 };
	try {
		const dbStats = accountStatus.getStats();
		if (dbStats) stats = dbStats;
	} catch (e) {
		console.error("Error fetching account stats:", e);
	}

	return `📱 *مدیریت اکانت*\n\n📊 *آمار کلی:*\n• تعداد کل: \`${accounts.length}\`\n• سالم: \`${stats.healthy || 0}\`\n• در استراحت: \`${stats.resting || 0}\`\n• ریپورت شده: \`${stats.reported || 0}\`\n\nاز منوی زیر گزینه مورد نظر را انتخاب کنید:`.trim();
}

// ==================== FAKE PANEL ====================

export function getFakePanelKeyboard() {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback("👥 ممبر", "fake_member"),
			Markup.button.callback("👁️ سین", "fake_view"),
		],
		[
			Markup.button.callback("👍 ری اکشن", "fake_reaction"),
			Markup.button.callback("💬 کامنت", "fake_comment"),
		],
		[Markup.button.callback("🤖 استارت ربات", "fake_start_bot")],
		[Markup.button.callback("🔙 بازگشت", "panel_my_accounts")],
	]);
}

export function getFakePanelMessage() {
	const orderStats = orders.getStats();
	return `🌐 *پنل فیک*\n\nبخش مورد نظر را انتخاب کنید:\n\n👥 *ممبر* - افزودن ممبر اجباری به گروه/کانال\n👁️ *سین* - افزایش بازدید پست\n👍 *ری اکشن* - افزودن واکنش به پست\n💬 *کامنت* - ارسال کامنت به پست\n🤖 *استارت ربات* - استارت دادن ربات‌ها\n\n━━━━━━━━━━━━━━━━\n📊 *آمار سفارشات:*\n• کل: ${orderStats.total || 0}\n• تکمیل شده: ${orderStats.completed || 0}\n• در حال اجرا: ${orderStats.running || 0}`.trim();
}

// ==================== ADDER MENU ====================

export function getAdderMenuKeyboard() {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback("📊 مدیریت (Management)", "panel_adder"),
			Markup.button.callback("⚙️ تنظیمات (Settings)", "panel_settings"),
		],
		[Markup.button.callback("📡 عملیات (Operations)", "panel_operations")],
		[Markup.button.callback("🔙 بازگشت", "panel_my_accounts")],
	]);
}

export function getAdderMenuMessage() {
	return `📦 *بخش جامع اددر (Adder)*\n\nلطفاً بخش مورد نظر را انتخاب کنید:\n\n📊 *مدیریت* - وضعیت سفارشات، لیست استخراج، آمار ربات\n⚙️ *تنظیمات* - تنظیم هش، پروکسی، زمان استراحت\n📡 *عملیات* - استخراج، گروه به گروه، لینک‌های متعدد`.trim();
}

// ==================== ADDER MANAGEMENT ====================

export function getAdderManagementKeyboard() {
	return Markup.inlineKeyboard([
		[Markup.button.callback("📊 وضعیت سفارش", "adder_order_status")],
		[
			Markup.button.callback("📈 آمار ربات", "adder_bot_stats"),
			Markup.button.callback("📋 لیست استخراج", "adder_extraction_list"),
		],
		[
			Markup.button.callback("❌ پاکسازی یوزر", "adder_cleanup_users"),
			Markup.button.callback("♻️ بارگزاری همه", "adder_reload_all"),
		],
		[Markup.button.callback("📥 دریافت لود", "adder_get_load")],
		[
			Markup.button.callback("➕ افزودن فایل یوزر", "adder_add_user_file"),
			Markup.button.callback("➖ حذف فایل استخراج", "adder_delete_extraction"),
		],
		[Markup.button.callback("🔙 بازگشت", "panel_adder_menu")],
	]);
}

export function getAdderManagementMessage() {
	const orderStats = orders.getStats();
	return `📦 *مدیریت ادر*\n\n📊 *آمار سفارشات:*\n• کل سفارشات: \`${orderStats.total || 0}\`\n• تکمیل شده: \`${orderStats.completed || 0}\`\n• در حال اجرا: \`${orderStats.running || 0}\`\n• ناموفق: \`${orderStats.failed || 0}\`\n\nاز منوی زیر گزینه مورد نظر را انتخاب کنید:`.trim();
}

// ==================== SETTINGS ====================

export function getSettingsKeyboard() {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback("⚙️ حالت اکانت", "settings_account_mode"),
			Markup.button.callback("🔧 تنظیم هش", "settings_api_hash"),
		],
		[
			Markup.button.callback("📡 بروزرسانی پروکسی", "settings_update_proxy"),
			Markup.button.callback("⏳ تنظیم استراحت", "settings_rest_time"),
		],
		[
			Markup.button.callback("📡 وضعیت پروکسی", "settings_proxy_status"),
			Markup.button.callback("➕ افزودن پروکسی", "settings_add_proxy"),
		],
		[
			Markup.button.callback("🔄 ریستارت ربات", "settings_restart"),
			Markup.button.callback("💻 مشخصات سرور", "settings_server_info"),
		],
		[
			Markup.button.callback(
				"🔀 جداسازی استخراج گروه",
				"settings_separate_extraction",
			),
		],
		[Markup.button.callback("🔙 بازگشت", "panel_adder_menu")],
	]);
}

export function getSettingsMessage() {
	const proxyCount = proxies.count();
	const restTime = settings.get("rest_time", 30);
	return `⚙️ *تنظیمات ادر*\n\n📊 *وضعیت فعلی:*\n• تعداد پروکسی فعال: \`${proxyCount}\`\n• زمان استراحت: \`${restTime} دقیقه\`\n\nاز منوی زیر گزینه مورد نظر را انتخاب کنید:`.trim();
}

// ==================== OPERATIONS ====================

export function getOperationsKeyboard() {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback("🎁 استخراج از گیفت (تکی)", "ops_gift_extraction"),
			Markup.button.callback("🔢 استخراج از کالکشن (رنج)", "ops_extract_range"),
		],
		[Markup.button.callback("💬 استخراج از کامنت", "ops_extract_comments")],
		[Markup.button.callback("👥 گروه به گروه", "ops_group_to_group")],
		[
			Markup.button.callback("🔗 لینک‌های متعدد", "ops_multi_invite"),
			Markup.button.callback("🏃 ران همزمان", "ops_concurrent_run"),
		],
		[
			Markup.button.callback("🚪 خروج خودکار", "ops_auto_exit"),
			Markup.button.callback("✅ چکر یوزرنیم", "ops_username_checker"),
		],
		[Markup.button.callback("🔙 بازگشت", "panel_adder_menu")],
	]);
}

export function getOperationsMessage() {
	return `📡 *عملیات ادر*\n\n🎁 *استخراج از گیفت* - استخراج Owner از لینک گیفت NFT\n💬 *استخراج از کامنت* - جمع‌آوری یوزرنیم از کامنت‌ها\n👥 *گروه به گروه* - انتقال اعضا بین گروه‌ها\n🔗 *لینک‌های متعدد* - ایجاد چند لینک دعوت\n🏃 *ران همزمان* - اجرای چند اکانت همزمان\n🚪 *خروج خودکار* - ترک گروه پس از استخراج\n✅ *چکر یوزرنیم* - بررسی یوزرنیم قبل از اد\n\nاز منوی زیر گزینه مورد نظر را انتخاب کنید:`.trim();
}

// ==================== SYSTEM INFO ====================

export function getServerInfoMessage() {
	const totalMem = os.totalmem();
	const freeMem = os.freemem();
	const usedMem = totalMem - freeMem;
	const cpuLoad = os.loadavg();
	const uptime = process.uptime();

	const formatBytes = (bytes) =>
		`${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	const formatUptime = (seconds) => {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return `${days}d ${hours}h ${minutes}m`;
	};

	return `💻 *مشخصات سرور*\n\n🖥️ *سیستم:*\n• پلتفرم: \`${os.platform()}\`\n• آرشیتکچر: \`${os.arch()}\`\n• هسته‌ها: \`${os.cpus().length}\`\n\n💾 *حافظه:*\n• کل: \`${formatBytes(totalMem)}\`\n• استفاده شده: \`${formatBytes(usedMem)}\`\n• آزاد: \`${formatBytes(freeMem)}\`\n\n⏱️ *آپتایم:*\n• سرور: \`${formatUptime(os.uptime())}\`\n• ربات: \`${formatUptime(uptime)}\`\n\n📊 *بار CPU:* \`${cpuLoad[0].toFixed(2)}\``.trim();
}

// ==================== DASHBOARD UI EDITOR ====================

export function getDashboardEditorKeyboard(config) {
	const b = config.buttons;
	
	const _adminBtn = (id, callback_data) => {
		const data = b[id] || { text: id, style: "primary" };
		const safe = formatButtonMarkup(`✏️ ${data.text || id}`, data.style, callback_data);
		return {
			text: safe.text,
			callback_data: safe.callback_data,
			style: safe.style,
			icon_custom_emoji_id: safe.icon_custom_emoji_id
		};
	};

	return Markup.inlineKeyboard([
		[_adminBtn("report_username", "edit_btn_report_username")],
		[_adminBtn("report_gifts", "edit_btn_report_gifts")],
		[_adminBtn("report_numbers", "edit_btn_report_numbers")],
		[_adminBtn("menu_portfolio", "edit_btn_menu_portfolio")],
		[_adminBtn("menu_compare", "edit_btn_menu_compare")],
		[_adminBtn("menu_account", "edit_btn_menu_account")],
		[Markup.button.callback("🔙 Back", "panel_main")],
	]);
}

export function getDashboardEditorMessage() {
	return `💎 *Dashboard UI Editor*\n\nSelect a button to change its **Name** and **Style** (Color).\nYou can use Premium Emoji IDs like \`[12345]\` in the name.`.trim();
}

export function getButtonStyleKeyboard(buttonId) {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback("🔵 Primary (Blue)", `set_style_${buttonId}_primary`),
			Markup.button.callback("🟢 Success (Green)", `set_style_${buttonId}_success`),
		],
		[
			Markup.button.callback("🔴 Danger (Red)", `set_style_${buttonId}_danger`),
		],
		[Markup.button.callback("🔙 Back", "admin_dashboard_ui")],
	]);
}
/**
 * CMS Template Management UI
 */
export function getCMSMessage() {
	return `📝 *Message CMS Engine*
━━━━━━━━━━━━━━━━━━━━━
Edit any bot response dynamically. Use markers like \`{FIRSTNAME}\` or \`{HOUR}\` as placeholders.

*Support:* HTML Tags & Premium Emojis \`[id]\` are fully supported in **Messages**. 
⚠️ *Note:* Telegram Buttons only support plain text; Premium Emojis in buttons will be shown as \`✨\`.`;
}

export function getCMSKeyboard(templates) {
	const templateKeys = Object.keys(templates);
	console.log(`[CMS] Rendering keyboard with ${templateKeys.length} keys:`, templateKeys);
	const keyboard = [];

	// Group templates into rows
	for (let i = 0; i < templateKeys.length; i += 2) {
		const row = [
			Markup.button.callback(`✏️ ${templateKeys[i].toUpperCase()}`, `edit_tpl_${templateKeys[i]}`)
		];
		if (templateKeys[i+1]) {
			row.push(Markup.button.callback(`✏️ ${templateKeys[i+1].toUpperCase()}`, `edit_tpl_${templateKeys[i+1]}`));
		}
		keyboard.push(row);
	}

	keyboard.push([Markup.button.callback("🔙 Back", "admin_dashboard_ui")]);

	return { reply_markup: { inline_keyboard: keyboard } };
}

export function getTplEditorMessage(key, currentContent) {
	// 2026 Supreme variable mapping engine
	const variableMap = {
		global: [
			"{FIRSTNAME} - User's first name",
			"{USERNAME} - Telegram @username",
			"{USERID} - Numerical ID",
			"{CREDITS} / {FRG} - Balance",
			"{ton_price} - Live TON Market Price",
			"{price_888} - +888 Floor price",
			"{HOUR}:{MIN}:{SEC} - Current time",
			"{DAY}/{MON}/{YEAR} - Current date",
			"{BOT_NAME} - Bot identity"
		],
		start: [
			"{FIRSTNAME} - Welcome name",
			"{ton_price} - Featured market price",
			"{CREDITS} - User balance"
		],
		report_username: [
			"{username} - Target username",
			"{insight} - AI generated insight",
			"{price_ton} - Estimated value in TON",
			"{price_usd} - Estimated value in USD",
			"{rarity_label} - Tier (Common, Elite, etc.)",
			"{status} - Fragment status",
			"{owner} - Current owner wallet",
			"{url} - Fragment link"
		],
		report_gift: [
			"{collection} - Gift collection name",
			"{number} - Item number (e.g. #123)",
			"{price_ton} - Valuation in TON",
			"{verdict} - AI verdict (Undervalued, etc.)",
			"{color} - Collection theme color",
			"{badges} - Special attributes list",
			"---------- Cross Market ----------",
			"{floor_portals} - Floor price on Portals.tg",
			"{floor_tonnel} - Floor price on Tonnel Network",
			"{volume_portals} - Total volume on Portals.tg",
			"{volume_tonnel} - Total volume on Tonnel Network",
			"{last_sale_portals} - Last sale price on Portals.tg",
			"{last_sale_tonnel} - Last sale price on Tonnel Network"
		],
		report_number: [
			"{formatted_number} - Visual number (+888...)",
			"{estimated_value} - Market value in TON",
			"{floor_ton} - Current floor price",
			"{status} - Market status (On Sale, etc.)",
			"{pattern_label} - Logic pattern (Triple, etc.)"
		],
		profile: [
			"{FIRSTNAME} - Account name",
			"{FRG} - Credits balance",
			"{total_reports} - User activity count",
			"{reset_time} - Next free credit time"
		]
	};

	const specificVars = variableMap[key] || [];
	const globalVars = variableMap.global;

	let msg = `✨ *Editing Template:* \`${key.toUpperCase()}\`
━━━━━━━━━━━━━━━━━━━━━

*Current Content:*
\`\`\`html
${currentContent}
\`\`\`

💡 *Section-Specific Variables:*
${specificVars.length > 0 ? specificVars.map(v => `• \`${v}\``).join("\n") : "_No specific variables for this section._"}

🌍 *Global Variables (Work Everywhere):*
${globalVars.slice(0, 6).map(v => `• \`${v}\``).join("\n")}...

⚠️ *Tips:*
1. Send the **NEW** content as a reply to this message.
2. Use \`[ID]\` for Premium Emojis (e.g. \`[5254]\`) — *New 2026 Support*.
3. HTML supported: \`<b>\`, \`<i>\`, \`<pre>\`, \`<code>\`.`;

	return msg;
}

// ==================== FEATURES EDITOR ====================

export function getFeaturesKeyboard(f) {
	return Markup.inlineKeyboard([
		[
			Markup.button.callback(
				`🌊 Streaming: ${f?.streaming_enabled ? "✅ ON" : "❌ OFF"}`,
				"toggle_feature_streaming_enabled",
			),
		],
		[
			Markup.button.callback(
				`🗂 Topics: ${f?.topics_enabled ? "✅ ON" : "❌ OFF"}`,
				"toggle_feature_topics_enabled",
			),
		],
		[Markup.button.callback("🔙 Back", "panel_main")],
	]);
}

export function getFeaturesMessage() {
	return `⚡ *Supreme Feature Management*\n\n**Streaming:** Show AI analysis live part-by-part.\n**Topics:** Organizes user chat into Forum Topics.\n\n_Note: Workspace Topics require the bot to be admin in its own private chat (automated)._`.trim();
}
