import { Markup } from "telegraf";

/**
 * Get message for FRG credit status
 */
export function getCreditsMessage(credits, resetInfo = null) {
	const icon = credits > 0 ? "🪙" : "🪫";
	let msg = `💰 *تراز FRG شما:* ${credits} ${icon}\n`;
	msg += `_۱۰۰ FRG = ۱ گزارش کامل_\n\n`;
	msg += `🚀 *چگونه FRG کسب کنیم؟*\n`;
	msg += `در گروه [Fragment Investors Club](https://t.me/FragmentInvestors) فعالیت کنید!\n`;
	msg += `• هر پیام = **+۳۰۰ FRG** (شارژ آنی!)\n`;
	msg += `• گفتگو کنید، سوال بپرسید و اعتبار بگیرید.`;

	if (resetInfo) {
		msg += `\n\n⏰ هدیه ۱۰۰ FRG بعدی شما در: *${resetInfo.formatted}*`;
	}
	return msg;
}

/**
 * Get "Out of Credits" message
 */
export function getNoCreditsMessage(_userId) {
	return `🪫 *اعتبار FRG کافی نیست*

شما برای تهیه این گزارش اعتبار کافی ندارید.

💎 *راه‌های دریافت اعتبار:*
۱. عضویت در [Fragment Investors Club](https://t.me/FragmentInvestors)
۲. ارسال پیام در گروه (بحث، تبلیغ دارایی‌ها و ...)
۳. دریافت آنی **+۳۰۰ FRG** به ازای هر پیام!`;
}

/**
 * Get credits keyboard
 */
export function getCreditsKeyboard() {
	return Markup.inlineKeyboard([
		[
			{
				text: "💎 دریافت اعتبار رایگان (گروه ادمین)",
				url: "https://t.me/FragmentInvestors",
			},
		],
		[{ text: "🔙 بازگشت", callback_data: "back_to_menu" }],
	]);
}
