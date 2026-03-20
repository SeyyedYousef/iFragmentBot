import { Markup } from "telegraf";

// Utility format number
const formatNum = (num) => new Intl.NumberFormat("en-US").format(num);

// ==================== OVERVIEW ====================

export function getWalletOverviewMessage(wallet, portfolio, tonPrice) {
	const uCount = portfolio.usernames?.length || 0;
	const nCount = portfolio.anonymousNumbers?.length || 0;
	const gCount = portfolio.totalGifts || 0;
	const totalAssets = uCount + nCount + gCount;

	const balance = portfolio.balance || 0;
	const totalValue = portfolio.estimatedValue || 0;
	const _netWorth = balance + totalValue;
	const liquidUsd = balance * tonPrice;

	const uBars = Math.round((uCount / (totalAssets || 1)) * 10);
	const nBars = Math.round((nCount / (totalAssets || 1)) * 10);
	const gBars = Math.max(0, 10 - uBars - nBars);
	const compBar = "💎".repeat(uBars) + "📱".repeat(nBars) + "🎁".repeat(gBars);

	const lastSeen = portfolio.lastActivity
		? new Date(portfolio.lastActivity * 1000).toLocaleDateString("en-GB", {
				day: "numeric",
				month: "short",
				year: "numeric",
			})
		: "Unknown";

	let msg = `🏦 *WALLET OVERVIEW* \`${wallet.substring(0, 8)}...${wallet.slice(-6)}\`\n`;
	msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
	msg += `💎 *Liquid TON:* \`${formatNum(balance.toFixed(2))} TON\` (~$${formatNum(Math.round(liquidUsd))})\n\n`;
	msg += `━━━━━━━ *Assets* ━━━━━━━\n\n`;
	msg += `📦 *Total Items:* \`${totalAssets}\`\n`;
	if (totalAssets > 0) msg += `${compBar}\n`;
	msg += `• Names: \`${uCount}\` | Numbers: \`${nCount}\` | Gifts: \`${gCount}\`\n\n`;
	msg += `🕒 *Last Active:* \`${lastSeen}\`\n`;
	msg += `🚦 *Status:* \`${(portfolio.status || "active").toUpperCase()}\` • \`${portfolio.isWallet ? "Contract" : "Personal"}\`\n`;

	// Badges
	const badges = [];
	if (portfolio.usernames?.some((u) => u.name.length <= 4))
		badges.push("🎖️ 4-Char");
	if (nCount >= 10) badges.push("📱 Hoarder");
	if (uCount >= 50) badges.push("💎 Legend");
	if (gCount >= 10) badges.push("🎁 Gifted");
	if (badges.length > 0) msg += `\n⛓️ *Badges:* ${badges.join(" • ")}\n`;

	msg += `\n━━━━━━━━━━━━━━━━━━━━━━\n_Select an option below for deep analysis._`;
	return msg;
}

export function getWalletMainKeyboard(uCount, nCount, gCount, wallet) {
	return Markup.inlineKeyboard([
		[
			{ text: `💎 Usernames (${uCount})`, callback_data: "wt_view_user" },
			{ text: `📱 Numbers (${nCount})`, callback_data: "wt_view_num" },
		],
		[{ text: `🎁 Official Gifts (${gCount})`, callback_data: "wt_view_gift" }],
		[
			{ text: "🔗 TonViewer", url: `https://tonviewer.com/${wallet}` },
			{ text: "💎 Fragment", url: `https://fragment.com/?query=${wallet}` },
		],
		[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
	]);
}

// ==================== LISTS & PAGINATION ====================

export function getPaginatedList(type, items, statuses, page, itemsPerPage) {
	const total = items.length;
	const start = page * itemsPerPage;
	const end = Math.min(start + itemsPerPage, total);
	const totalPages = Math.ceil(total / itemsPerPage);

	const title =
		type === "user" ? "💎 Telegram Usernames" : "📱 Anonymous Numbers (+888)";
	const legend =
		type === "user"
			? "_✅ = Active | 💤 = Not in use_"
			: "_🟢 = Registered | ⚫ = Not Active_";

	let text = `*${title}* (${total})\n━━━━━━━━━━━━━━━━\n\n`;
	if (total === 0)
		return {
			text: `${text}_No items found._`,
			keyboard: getBackToOverviewKeyboard(),
		};

	items.slice(start, end).forEach((item, i) => {
		const idx = start + i + 1;
		const status = statuses[start + i] || "";
		const val =
			type === "user"
				? `@${item.name.replace(/_/g, "\\_")}`
				: `\`${item.number}\``;
		text += `${idx}. ${val}${status}\n`;
	});

	if (totalPages > 1) text += `\n📄 _Page ${page + 1}/${totalPages}_`;
	text += `\n\n${legend}`;

	const nav = [];
	if (page > 0)
		nav.push({ text: "◀️ Prev", callback_data: `wt_${type}_${page - 1}` });
	if (page < totalPages - 1)
		nav.push({ text: "Next ▶️", callback_data: `wt_${type}_${page + 1}` });

	const rows = nav.length > 0 ? [nav] : [];
	rows.push([{ text: "🔙 Back to Overview", callback_data: "wt_overview" }]);

	return { text, keyboard: Markup.inlineKeyboard(rows) };
}

export function getBackToOverviewKeyboard() {
	return Markup.inlineKeyboard([
		[{ text: "🔙 Back to Overview", callback_data: "wt_overview" }],
	]);
}
