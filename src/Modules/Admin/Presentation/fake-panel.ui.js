import { Markup } from "telegraf";

// ==================== MENUS ====================

export function getFakeMemberMenu() {
	return {
		text: `👥 *افزودن ممبر*\n\nنوع ممبر را انتخاب کنید:\n\n📌 *ممبر گروه* - افزودن کاربر به گروه\n📌 *ممبر کانال* - افزودن کاربر اجباری به کانال\n\n⚠️ نکته: کاربران باید قبلاً ربات را استارت کرده باشند.`,
		keyboard: Markup.inlineKeyboard([
			[
				{ text: "👥 ممبر گروه (Add)", callback_data: "fake_member_group" },
				{
					text: "📢 جوین کانال/گروه (Join)",
					callback_data: "fake_member_channel_join",
				},
			],
			[{ text: "🔙 بازگشت", callback_data: "panel_fake" }],
		]),
	};
}

export function getFakeCommentMenu() {
	return {
		text: `💬 *ارسال کامنت*\n\nروش ارسال را انتخاب کنید:\n\n📝 *کامنت دستی* - متن کامنت را خودتان بنویسید\n📋 *کامنت‌های آماده* - از لیست آماده انتخاب کنید`,
		keyboard: Markup.inlineKeyboard([
			[
				{ text: "📝 کامنت دستی", callback_data: "fake_comment_manual" },
				{ text: "📋 کامنت آماده", callback_data: "fake_comment_preset" },
			],
			[{ text: "🔙 بازگشت", callback_data: "panel_fake" }],
		]),
	};
}

// ==================== PROMPTS ====================

export function getGroupLinkPrompt() {
	return `👥 *افزودن ممبر به گروه*\n\nلینک یا یوزرنیم گروه مقصد را ارسال کنید:\n\nمثال:\n\`@mygroup\`\n\`https://t.me/mygroup\`\n\`https://t.me/+abcdefg\``;
}

export function getJoinLinkPrompt() {
	return `📢 *جوین در کانال/گروه (Mass Join)*\n\nلینک کانال یا گروه را ارسال کنید:\n(اکانت‌های شما با این لینک جوین می‌شوند)\n\nمثال:\n\`@mychannel\`\n\`https://t.me/mychannel\`\n\`https://t.me/+AbCdEfGh\``;
}

export function getViewPrompt() {
	return `👁️ *افزایش بازدید پست*\n\nلینک پست را ارسال کنید:\n\nمثال:\n\`https://t.me/channel/123\`\n\nسپس تعداد بازدید مورد نظر را وارد کنید.`;
}

export function getReactionPrompt() {
	return `👍 *افزودن ری‌اکشن*\n\nلینک پست را ارسال کنید:\n\nمثال:\n\`https://t.me/channel/123\``;
}

export function getBotStartPrompt() {
	return `🤖 *استارت ربات*\n\nیوزرنیم ربات مقصد را ارسال کنید:\n\nمثال: \`@mybot\`\n\nسپس تعداد استارت مورد نظر را وارد کنید.`;
}

// ==================== STATUS & REPORTS ====================

export function getOrderStatusMessage(running, recent) {
	let msg = `📊 *وضعیت سفارشات*\n\n`;

	if (running.length > 0) {
		msg += `🟢 *در حال اجرا (${running.length}):*\n`;
		running.forEach((order) => {
			msg += `• ${order.type}: ${order.completed}/${order.count}\n`;
		});
		msg += "\n";
	}

	msg += `📋 *آخرین سفارشات:*\n`;
	if (recent.length === 0) {
		msg += "_هیچ سفارشی ثبت نشده_\n";
	} else {
		recent.forEach((order) => {
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
	return msg.trim();
}
