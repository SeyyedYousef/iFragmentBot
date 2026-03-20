import { Markup } from "telegraf";

// ==================== PROXY STATUS ====================

export function getProxyStatusKeyboard() {
	return Markup.inlineKeyboard([
		[
			{ text: "➕ افزودن", callback_data: "settings_add_proxy" },
			{ text: "🗑️ حذف همه", callback_data: "settings_delete_all_proxies" },
		],
		[{ text: "🔍 تست همه", callback_data: "settings_test_proxies" }],
		[{ text: "🛡️ وضعیت سلامت اکانت‌ها", callback_data: "settings_health_guard" }],
		[{ text: "🔙 بازگشت", callback_data: "panel_settings" }],
	]);
}

export function getProxyStatusMessage(stats, proxiesPreview) {
	let msg = `📡 *وضعیت پروکسی‌ها*\n\n📊 *آمار:*\n• کل: \`${stats.total}\`\n• فعال: \`${stats.active}\`\n• غیرفعال: \`${stats.inactive}\`\n\n`;

	if (proxiesPreview.length > 0) {
		msg += `📋 *لیست پروکسی‌ها:*\n`;
		proxiesPreview.forEach((p, i) => {
			const status = p.is_active ? "🟢" : "🔴";
			msg += `${i + 1}. ${status} ${p.type}://${p.host}:${p.port}\n`;
		});
	} else {
		msg += `_هیچ پروکسی‌ای ثبت نشده_\n`;
	}
	return msg.trim();
}

// ==================== PROXY CLOUD ====================

export function getProxyCloudKeyboard(status) {
	return Markup.inlineKeyboard([
		[
			{
				text: "🚀 دریافت سریع (همین حالا)",
				callback_data: "proxy_cloud_scrape",
			},
		],
		[
			{
				text: "👻 حالت روح (Ghost Mode)",
				callback_data: "settings_ghost_mode",
			},
		],
		[
			{
				text: status.autoEnabled
					? "🔴 توقف دانلود خودکار"
					: "🟢 شروع دانلود خودکار",
				callback_data: "proxy_cloud_toggle_auto",
			},
		],
		[{ text: "🔙 بازگشت", callback_data: "panel_settings" }],
	]);
}

export function getProxyCloudMessage(status) {
	const autoIcon = status.autoEnabled ? "✅" : "🔴";
	const runningIcon = status.isRunning ? "⏳ در حال اجرا..." : "آماده";
	return `☁️ *پروکسی کلود (Proxy Cloud)*\n\nدریافت خودکار پروکسی‌های سالم از سراسر اینترنت.\n\n📊 *وضعیت سرویس:*\n• وضعیت: \`${runningIcon}\`\n• دانلود خودکار: \`${autoIcon}\`\n• منابع فعال: \`${status.sources || 8}\`\n\nبا استفاده از این قابلیت، ربات به طور خودکار پروکسی‌های جدید را پیدا، تست و ذخیره می‌کند.`.trim();
}

// ==================== GHOST MODE ====================

export function getGhostModeKeyboard(status) {
	return Markup.inlineKeyboard([
		[
			{
				text: status.isEnabled ? "🔴 غیرفعال کردن" : "🟢 فعال کردن",
				callback_data: "ghost_mode_toggle",
			},
		],
		[
			{ text: "⏱️ تنظیم زمان (15 دقیقه)", callback_data: "ghost_mode_set:15" },
			{ text: "⏱️ تنظیم زمان (60 دقیقه)", callback_data: "ghost_mode_set:60" },
		],
		[{ text: "🔙 بازگشت", callback_data: "settings_proxy_cloud" }],
	]);
}

export function getGhostModeMessage(status) {
	const stateIcon = status.isEnabled ? "✅ فعال" : "🔴 غیرفعال";
	return `👻 *حالت روح (Ghost Mode)*\n\nدر این حالت، اکانت‌ها به صورت خودکار فعالیت‌های انسانی انجام می‌دهند تا از بن شدن جلوگیری شود.\n\nفعالیت‌ها:\n• 👁️ بازدید از کانال‌ها\n• 📜 اسکرول کردن پیام‌ها\n• ⌨️ تایپ کردن (بدون ارسال)\n\nوضعیت فعلی: \`${stateIcon}\`\nفاصله زمانی: \`${status.interval} دقیقه\``.trim();
}

// ==================== ACCOUNT MODE ====================

export function getAccountModeKeyboard(mode) {
	return Markup.inlineKeyboard([
		[
			{
				text: mode === "sequential" ? "✅ ترتیبی" : "ترتیبی",
				callback_data: "set_mode:sequential",
			},
			{
				text: mode === "concurrent" ? "✅ همزمان" : "همزمان",
				callback_data: "set_mode:concurrent",
			},
		],
		[{ text: "🔙 بازگشت", callback_data: "panel_settings" }],
	]);
}

export function getAccountModeMessage(mode) {
	return `⚙️ *حالت اکانت*\n\nحالت فعلی: \`${mode === "sequential" ? "ترتیبی" : "همزمان"}\`\n\n• *ترتیبی:* اکانت‌ها به نوبت استفاده می‌شوند\n• *همزمان:* چند اکانت همزمان کار می‌کنند`.trim();
}

// ==================== REST TIME ====================

export function getRestTimeKeyboard() {
	return Markup.inlineKeyboard([
		[
			{ text: "15 دقیقه", callback_data: "set_rest:15" },
			{ text: "30 دقیقه", callback_data: "set_rest:30" },
			{ text: "60 دقیقه", callback_data: "set_rest:60" },
		],
		[
			{ text: "2 ساعت", callback_data: "set_rest:120" },
			{ text: "4 ساعت", callback_data: "set_rest:240" },
			{ text: "8 ساعت", callback_data: "set_rest:480" },
		],
		[{ text: "🔙 بازگشت", callback_data: "panel_settings" }],
	]);
}

export function getRestTimeMessage(current) {
	return `⏳ *تنظیم زمان استراحت*\n\nزمان فعلی: \`${current} دقیقه\`\n\nمدت زمان استراحت پس از فعالیت زیاد را انتخاب کنید:`.trim();
}
