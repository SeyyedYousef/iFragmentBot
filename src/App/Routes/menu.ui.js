import { Markup } from "telegraf";
import { renderTemplate } from "../../Shared/Infra/Telegram/telegram.cms.js";

// ==================== MY ACCOUNT ====================

export function getAccountKeyboard() {
	return Markup.inlineKeyboard([
		[{ text: "💸 Transfer FRG", callback_data: "menu_transfer" }],
		[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
	]);
}

export function getAccountMessage(user, limits, resetTime, templates) {
	return renderTemplate(templates.profile, {
		...user,
		credits: String(limits.credits || 0),
		reset_time: resetTime.formatted || "00:00"
	});
}

// ==================== SERVICE PROMPTS ====================

export function getServicePromptKeyboard(cancelAction) {
	return Markup.inlineKeyboard([
		[{ text: "❌ Cancel", callback_data: cancelAction }],
	]);
}

export function getUsernamePrompt(templates) {
	return renderTemplate(templates.username_prompt);
}

export function getGiftPrompt(templates) {
	return renderTemplate(templates.gift_prompt);
}

export function getNumberPrompt(templates) {
	return renderTemplate(templates.number_prompt);
}

export function getPortfolioPrompt(templates) {
	return renderTemplate(templates.portfolio_prompt);
}

export function getComparePrompt(templates) {
	return renderTemplate(templates.compare_prompt);
}

// ==================== CANCELLATION ====================

export function getCancelMenuKeyboard() {
	return Markup.inlineKeyboard([
		[{ text: "👤 Username", callback_data: "report_username" }],
		[{ text: "🎁 Gifts", callback_data: "report_gifts" }],
		[{ text: "📱 Anonymous Numbers", callback_data: "report_numbers" }],
		[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
	]);
}

export function getCancelMenuMessage() {
	return `✦ *OPERATION CANCELLED*\n━━━━━━━━━━━━━━━━━━━━━\n\nYou have cancelled the current operation and returned to the menu\\.\n\n├ 👤 *Username Scan* — Analyze username prices\n├ 🎁 *Gift Valuation* — Check gift NFT values\n└ 🏴‍☠️ *\\+888 Numbers* — Analyze anonymous numbers\n\n✧ _Please select a service below to continue:_`.trim();
}
