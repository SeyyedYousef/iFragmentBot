import { Markup } from "telegraf";
import { getDashboardConfig } from "../../Shared/Infra/Database/settings.repository.js";
import { stripPremiumTags, formatButtonMarkup } from "../../Shared/Infra/Telegram/telegram.formatter.js";

/**
 * Get greeting based on time of day
 */
export function getGreeting(name) {
	const hour = new Date().getHours();
	let period, icon;
	if (hour >= 5 && hour < 12) {
		period = "Good morning";
		icon = "☀️";
	} else if (hour >= 12 && hour < 18) {
		period = "Good afternoon";
		icon = "🌤";
	} else if (hour >= 18 && hour < 22) {
		period = "Good evening";
		icon = "🌙";
	} else {
		period = "Good night (Night owl!)";
		icon = "🌃";
	}
	return { text: `<b>${name}</b>`, icon, period };
}

/**
 * Generate the Main Dashboard message
 */
export function getDashboardMessage(name, data, credits) {
	const g = getGreeting(name);
	const changeIcon = (data.tonChange || 0) >= 0 ? "📈" : "📉";
	const changeText = `${data.tonChange >= 0 ? "+" : ""}${(data.tonChange || 0).toFixed(2)}%`;

	let msg = `✦ <b>iFragment Main Panel</b>\n`;
	msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
	msg += `${g.icon} ${g.period}, ${g.text}\n`;
	msg += `<i>Advanced analysis & real-time valuation of Fragment assets</i>\n\n`;

	msg += `🌍 <b>Live Market Pulse</b>\n`;
	msg += `├ 💎 <b>TON:</b> <code>$${(data.tonPrice || 0).toFixed(2)}</code> ${changeIcon} ${changeText}\n`;
	msg += `└ 🏴‍☠️ <b>+888:</b> <code>${data.price888 ? `${data.price888.toLocaleString()} TON` : "Updating..."}</code>\n\n`;

	// SuperApp Magic: Injecting Live Global API Indexes
	if (data.marketOverview && data.marketOverview.hot.length > 0) {
		const topHot = data.marketOverview.hot.slice(0, 3);
		msg += `🔥 <b>Hot Auctions (Global Picks):</b>\n`;
		topHot.forEach((item, index) => {
			const prefix = index === topHot.length - 1 ? "└ " : "├ ";
			msg += `${prefix}@${item.username}: <code>${item.priceTon} TON</code>\n`;
		});
		msg += `\n🐋 <b>Whale Index (Top 10 Avg):</b> <code>${data.marketOverview.metrics.avgTop10Price} TON</code>\n\n`;
	}

	msg += `💳 <b>Your Balance:</b> <code>${credits} FRG</code>\n\n`;
	msg += `💎 <b>How to get FRG?</b>\n`;
	msg += `Post in <a href="https://t.me/FragmentInvestors">Fragment Investors</a> (+300 FRG per msg!)\n\n`;
	msg += `👇 <b>Please select a service:</b>`;

	return msg;
}

/**
 * Get Main Menu Keyboard (Data-driven from Firestore + Supreme Styles)
 */
export async function getDashboardKeyboard() {
	const config = await getDashboardConfig();
	const b = config.buttons;

	// Helper to apply premium emoji entities to buttons if needed
	const _btn = (id, callback_data) => {
		const data = b[id] || { text: id, style: "primary" };
		const label = data.text || id; 
		// The formatButtonMarkup function is now expected to handle icon_custom_emoji_id natively
		const safeData = formatButtonMarkup(label, data.style, callback_data);
		
		return {
			text: safeData.text,
			callback_data: safeData.callback_data,
			style: safeData.style,
			icon_custom_emoji_id: safeData.icon_custom_emoji_id,
		};
	};

	return Markup.inlineKeyboard([
		[
			_btn("report_username", "report_username"),
			_btn("report_gifts", "report_gifts"),
			_btn("report_numbers", "report_numbers")
		],
		[
			_btn("menu_portfolio", "menu_portfolio"),
			_btn("menu_compare", "menu_compare")
		],
		[
			_btn("menu_account", "menu_account")
		]
	]);
}
