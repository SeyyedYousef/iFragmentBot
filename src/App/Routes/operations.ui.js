import { Markup } from "telegraf";

// ==================== PROFILE SYSTEM ====================

export function getProfileSystemKeyboard() {
	return Markup.inlineKeyboard([
		[
			{ text: "➕ افزودن پروفایل", callback_data: "ops_add_profile" },
			{ text: "📋 لیست پروفایل‌ها", callback_data: "ops_list_profiles" },
		],
		[
			{ text: "📥 استخراج از اکانت‌ها", callback_data: "ops_extract_profiles" },
			{ text: "📤 اعمال به اکانت‌ها", callback_data: "ops_apply_profiles" },
		],
		[{ text: "🔙 بازگشت", callback_data: "panel_operations" }],
	]);
}

export function getProfileSystemMessage(stats) {
	return `👤 *سیستم پروفایل*\n\n📊 *آمار:*\n• کل پروفایل‌ها: \`${stats.total}\`\n• استفاده نشده: \`${stats.unused}\`\n• استفاده شده: \`${stats.used}\``.trim();
}

// ==================== RECEIVER SYSTEM ====================

export function getReceiverSystemKeyboard() {
	return Markup.inlineKeyboard([
		[{ text: "📋 درخواست‌های جدید", callback_data: "receiver_pending" }],
		[{ text: "✅ تأیید شده‌ها", callback_data: "receiver_approved" }],
		[{ text: "🔙 بازگشت", callback_data: "panel_operations" }],
	]);
}

export function getReceiverSystemMessage(stats) {
	return `📥 *سیستم ریسیور*\n\n📊 *آمار:*\n• کل: \`${stats.total}\`\n• در انتظار تأیید: \`${stats.pending}\`\n• تأیید شده: \`${stats.approved}\``.trim();
}

// ==================== OPERATIONS MAIN ====================

export function getOperationsMainKeyboard() {
	return Markup.inlineKeyboard([
		[
			{ text: "🎁 استخراج گیفت", callback_data: "ops_gift_extraction" },
			{ text: "🔢 استخراج رنج", callback_data: "ops_extract_range" },
		],
		[
			{ text: "👤 سیستم پروفایل", callback_data: "ops_profile_system" },
			{ text: "📥 سیستم ریسیور", callback_data: "ops_receiver_system" },
		],
		[
			{ text: "📊 سیستم گزارش", callback_data: "ops_report_system" },
			{ text: "💬 استخراج کامنت", callback_data: "ops_extract_comments" },
		],
		[
			{ text: "🔗 لینک دعوت", callback_data: "ops_multi_invite" },
			{ text: "🏃 اجرای همزمان", callback_data: "ops_concurrent_run" },
		],
		[{ text: "🔙 بازگشت", callback_data: "panel_adder_menu" }],
	]);
}

export function getOperationsMainMessage() {
	return `📡 *عملیات ادر*\n\nبخش مورد نظر را انتخاب کنید:`.trim();
}

// ==================== EXTRACTION PROMPTS ====================

export function getGiftExtractionMessage() {
	return `🎁 *استخراج از لینک گیفت (تکی)*\n\nلینک‌های گیفت را ارسال کنید (هر خط یک لینک):\n\nمثال:\n\`https://t.me/nft/slug-123\`\n\nاطلاعات مالک هر گیفت استخراج خواهد شد.`.trim();
}

export function getRangeExtractionMessage() {
	return `🔢 *استخراج از کالکشن (رنج عدد)*\n\nلطفاً نام مجموعه و رنج عددی را وارد کنید.\n\n📝 *فرمت:* \`slug|start|end\`\n\n✅ *مثال:*\n\`SignetRing|14400|14500\``.trim();
}

export function getCommentExtractionMessage() {
	return `💬 *استخراج از کامنت‌ها*\n\nلینک پست را ارسال کنید:\n\nمثال: \`https://t.me/channel/123\`\n\nیوزرنیم کاربرانی که کامنت گذاشته‌اند استخراج خواهد شد.`.trim();
}
