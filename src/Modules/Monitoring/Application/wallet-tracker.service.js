import { tonPriceCache } from "../../../Shared/Infra/Cache/cache.service.js";
import * as telegramClient from "../../../Shared/Infra/Telegram/telegram.client.js";
import { generateWalletCard } from "../../../Shared/UI/Components/card-generator.component.js";
import { getPortfolio } from "../../Market/Application/portfolio.service.js";

// Store pagination data temporarily (wallet -> data)
const paginationCache = new Map();

// Utility format number
const formatNum = (num) => {
	return new Intl.NumberFormat("en-US").format(num);
};

// Pagination settings
const ITEMS_PER_PAGE = 25; // Adjusted for reliability within 1024-char photo captions

/**
 * Smartly edit a message (handles both photo captions and text messages)
 */
async function smartEdit(ctx, text, reply_markup) {
	try {
		// Try editing as a text message first
		await ctx.editMessageText(text, {
			parse_mode: "Markdown",
			reply_markup,
		});
	} catch (error) {
		// If it was a photo message, edit the caption instead
		if (
			error.message.includes("message is not modifiable") ||
			error.message.includes("there is no text in the message")
		) {
			try {
				await ctx.editMessageCaption(text, {
					parse_mode: "Markdown",
					reply_markup,
				});
			} catch (innerError) {
				// If caption is too long or other error, fallback to resending (rare)
				console.error("SmartEdit Failed:", innerError.message);
				await ctx.reply(text, { parse_mode: "Markdown", reply_markup });
			}
		} else {
			console.error("SmartEdit Error:", error.message);
		}
	}
}

/**
 * Generate and send the Professional Wallet Report
 */
export async function generateWalletReport(ctx, walletAddress) {
	const loadingMsg = await ctx.reply(
		"🔍 *Scanning wallet...*\n_Fetching balance & assets via TonAPI..._",
		{ parse_mode: "Markdown" },
	);

	try {
		let portfolio;
		try {
			portfolio = await getPortfolio(walletAddress);
		} catch (fetchErr) {
			console.error("❌ Portfolio fetch crashed:", fetchErr.message);
			await ctx.telegram
				.deleteMessage(ctx.chat.id, loadingMsg.message_id)
				.catch(() => {});
			await ctx.reply(
				`❌ *Could not connect to TonAPI.*\n\nPlease try again in a few seconds.\n_Error: ${fetchErr.message}_`,
				{
					parse_mode: "Markdown",
					reply_markup: {
						inline_keyboard: [
							[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
						],
					},
				},
			);
			return;
		}

		// Handle error response from getPortfolio
		if (portfolio?.error) {
			console.warn("⚠️ Portfolio returned error:", portfolio.error);
			await ctx.telegram
				.deleteMessage(ctx.chat.id, loadingMsg.message_id)
				.catch(() => {});
			await ctx.reply(
				`⚠️ *Could not read this wallet.*\n\nPossible reasons:\n• Invalid wallet address\n• Wallet has never been activated\n• TonAPI is temporarily unavailable\n\n_Tip: Make sure the address starts with UQ or EQ._`,
				{
					parse_mode: "Markdown",
					reply_markup: {
						inline_keyboard: [
							[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
						],
					},
				},
			);
			return;
		}

		const uCount = portfolio?.usernames?.length || 0;
		const nCount = portfolio?.anonymousNumbers?.length || 0;
		const gCount = portfolio?.totalGifts || 0;
		const totalAssets = uCount + nCount + gCount;

		// ===== WHALE RANK =====
		const totalValue = portfolio?.estimatedValue || 0;
		const balance = portfolio?.balance || 0;
		const netWorth = balance + totalValue;

		let rank = "🦐 Shrimp";
		if (netWorth > 100000) rank = "🐋 MEGA WHALE";
		else if (netWorth > 50000) rank = "🐋 Whale";
		else if (netWorth > 10000) rank = "🦈 Shark";
		else if (netWorth > 1000) rank = "🐬 Dolphin";
		else if (netWorth > 100) rank = "🦀 Crab";
		else if (netWorth > 10) rank = "🐟 Fish";

		// ===== FORMAT DATES =====
		const lastSeen = portfolio?.lastActivity
			? new Date(portfolio.lastActivity * 1000).toLocaleDateString("en-GB", {
					day: "numeric",
					month: "short",
					year: "numeric",
				})
			: "Unknown";

		// ===== PRICE CALCULATIONS =====
		const tonPrice = tonPriceCache.get("price") || 1.5;
		const _netWorthUsd = netWorth * tonPrice;
		const liquidUsd = balance * tonPrice;

		// ===== COMPOSITION BAR =====
		const total = totalAssets || 1;
		const uBars = Math.round((uCount / total) * 10);
		const nBars = Math.round((nCount / total) * 10);
		const gBars = Math.max(0, 10 - uBars - nBars);
		const compBar =
			"💎".repeat(uBars) + "📱".repeat(nBars) + "🎁".repeat(gBars);

		// ===== INSIGHT LOGIC =====
		let _insight = "Standard Portfolio";
		if (uCount > nCount && uCount > gCount) _insight = "Username Mogul";
		else if (nCount > uCount && nCount > gCount) _insight = "Number Collector";
		else if (gCount > uCount && gCount > nCount) _insight = "Gift Curator";
		else if (netWorth > 5000) _insight = "Elite Investor";

		// ===== BUILD OVERVIEW CAPTION =====
		let caption = `🏦 *WALLET OVERVIEW* \`${walletAddress.substring(0, 8)}...${walletAddress.slice(-6)}\`\n`;
		caption += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

		caption += `💎 *Liquid TON:* \`${formatNum(balance.toFixed(2))} TON\` (~$${formatNum(Math.round(liquidUsd))})\n\n`;

		caption += `━━━━━━━ *Assets* ━━━━━━━\n\n`;
		caption += `📦 *Total Items:* \`${totalAssets}\`\n`;
		if (totalAssets > 0) {
			caption += `${compBar}\n`;
		}
		caption += `• Names: \`${uCount}\` | Numbers: \`${nCount}\` | Gifts: \`${gCount}\`\n\n`;

		caption += `🕒 *Last Active:* \`${lastSeen}\`\n`;
		const walletStatus = portfolio?.status
			? portfolio.status.toUpperCase()
			: "ACTIVE";
		const walletType = portfolio?.isWallet ? "Contract" : "Personal";
		caption += `🚦 *Status:* \`${walletStatus}\` • \`${walletType}\`\n`;

		// Collector Badges logic
		const badges = [];
		if (portfolio?.usernames?.some((u) => u.name.length <= 4))
			badges.push("🎖️ 4-Char");
		if (nCount >= 10) badges.push("📱 Hoarder");
		if (uCount >= 50) badges.push("💎 Legend");
		if (gCount >= 10) badges.push("🎁 Gifted");
		if (uCount > 0 && nCount > 0 && gCount > 0) badges.push("🌈 Diversified");

		if (badges.length > 0) {
			caption += `\n⛓️ *Badges:* ${badges.join(" • ")}\n`;
		}

		caption += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
		caption += `_Select an option below for deep analysis._`;

		// Store for details & pagination
		const cacheKey = `${ctx.chat.id}`;
		paginationCache.set(cacheKey, {
			portfolio,
			walletAddress,
			usernameStatuses: new Array(uCount).fill(""),
			numberStatuses: new Array(nCount).fill(""),
			timestamp: Date.now(),
		});

		const mainKeyboard = {
			inline_keyboard: [
				[
					{ text: `💎 Usernames (${uCount})`, callback_data: "wt_view_user" },
					{ text: `📱 Numbers (${nCount})`, callback_data: "wt_view_num" },
				],
				[
					{
						text: `🎁 Official Gifts (${gCount})`,
						callback_data: "wt_view_gift",
					},
				],
				[
					{
						text: "🔗 TonViewer",
						url: `https://tonviewer.com/${walletAddress}`,
					},
					{
						text: "💎 Fragment",
						url: `https://fragment.com/?query=${walletAddress}`,
					},
				],
				[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
			],
		};

		await ctx.telegram
			.deleteMessage(ctx.chat.id, loadingMsg.message_id)
			.catch(() => {});

		// Try to generate and send with image card, fallback to text-only
		let cardSent = false;
		try {
			const cardData = {
				address: walletAddress,
				rank: rank.split(" ")[1] || rank,
				netWorth: netWorth,
				tonPrice: tonPrice,
				usernameCount: uCount,
				numberCount: nCount,
				giftCount: gCount,
				balance: balance,
				lastActivity: lastSeen,
				status: walletStatus,
			};

			console.log(
				`📸 (WT) Attempting to generate card for ${walletAddress}...`,
			);
			const imageBuffer = await generateWalletCard(cardData);

			if (imageBuffer) {
				// Telegram caption limit is 1024. If caption too long, we might need to send it separately
				const safeCaption =
					caption.length > 1000 ? `${caption.substring(0, 1000)}...` : caption;

				await ctx.replyWithPhoto(
					{ source: imageBuffer },
					{
						caption: safeCaption,
						parse_mode: "Markdown",
						reply_markup: mainKeyboard,
					},
				);
				cardSent = true;
				console.log(`✅ (WT) Card sent successfully to ${ctx.from.id}`);
			} else {
				console.warn(
					`⚠️ (WT) generateWalletCard returned null for ${walletAddress}`,
				);
			}
		} catch (cardErr) {
			console.error("❌ (WT) Card generation/send failed:", cardErr.message);
		}

		// Fallback: send as text message if card generation failed
		if (!cardSent) {
			await ctx.reply(caption, {
				parse_mode: "Markdown",
				reply_markup: mainKeyboard,
				disable_web_page_preview: true,
			});
		}

		// Start background scanning in silent mode
		populateAllRemainingStatuses(cacheKey).catch((e) =>
			console.error("BG Scan error:", e),
		);
	} catch (error) {
		console.error("Wallet Report Error:", error);
		await ctx.telegram
			.deleteMessage(ctx.chat.id, loadingMsg.message_id)
			.catch(() => {});
		await ctx.reply(
			`❌ *An unexpected error occurred.*\n\n_${error.message}_`,
			{
				parse_mode: "Markdown",
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
					],
				},
			},
		);
	}
}

// ======================================================
// NEW DETAIL VIEW HANDLERS
// ======================================================

export async function handleViewUsernames(ctx) {
	const cached = paginationCache.get(`${ctx.chat.id}`);
	if (!cached) return ctx.answerCbQuery("⚠️ Session expired.");

	const { text, keyboard } = formatUsernamesPage(
		cached.portfolio.usernames,
		cached.usernameStatuses,
		0,
	);
	return smartEdit(ctx, text, keyboard);
}

export async function handleViewNumbers(ctx) {
	const cached = paginationCache.get(`${ctx.chat.id}`);
	if (!cached) return ctx.answerCbQuery("⚠️ Session expired.");

	const { text, keyboard } = formatNumbersPage(
		cached.portfolio.anonymousNumbers,
		cached.numberStatuses,
		0,
	);
	return smartEdit(ctx, text, keyboard);
}

export async function handleViewGifts(ctx) {
	const cached = paginationCache.get(`${ctx.chat.id}`);
	if (!cached) return ctx.answerCbQuery("⚠️ Session expired.");

	const { text, keyboard } = formatGiftsPage(cached.portfolio.gifts, 0);
	return smartEdit(ctx, text, keyboard);
}

export async function handleOverviewBack(ctx) {
	const cached = paginationCache.get(`${ctx.chat.id}`);
	if (!cached) return ctx.answerCbQuery("⚠️ Session expired.");

	// We can't easily "un-edit" text back to photo+caption if it was a photo message.
	// If we want to return from list view (text) to overview (photo), we better resend or
	// just change the text of the existing message to the overview text.
	// However, the original overview had a photo.
	// Let's just update the text for now, or re-generate.

	const { portfolio, walletAddress } = cached;
	const uCount = portfolio.usernames.length;
	const nCount = portfolio.anonymousNumbers.length;
	const gCount = portfolio.totalGifts || 0;
	const totalAssets = uCount + nCount + gCount;

	const netWorth = (portfolio.balance || 0) + (portfolio.estimatedValue || 0);

	let _rank = "🦐 Shrimp";
	if (netWorth > 100000) _rank = "🐋 MEGA WHALE";
	else if (netWorth > 50000) _rank = "🐋 Whale";
	else if (netWorth > 10000) _rank = "🦈 Shark";
	else if (netWorth > 1000) _rank = "🐬 Dolphin";
	else if (netWorth > 100) _rank = "🦀 Crab";
	else if (netWorth > 10) _rank = "🐟 Fish";

	const lastSeen = portfolio.lastActivity
		? new Date(portfolio.lastActivity * 1000).toLocaleDateString("en-GB", {
				day: "numeric",
				month: "short",
				year: "numeric",
			})
		: "Unknown";

	const tonPrice = tonPriceCache.get("price") || 5.5;
	const balance = portfolio.balance || 0;
	const liquidUsd = balance * tonPrice;
	const _netWorthUsd = netWorth * tonPrice;

	const total = totalAssets || 1;
	const uBars = Math.round((uCount / total) * 10);
	const nBars = Math.round((nCount / total) * 10);
	const gBars = Math.max(0, 10 - uBars - nBars);
	const compBar = "💎".repeat(uBars) + "📱".repeat(nBars) + "🎁".repeat(gBars);

	let _insight = "Standard Portfolio";
	if (uCount > nCount && uCount > gCount) _insight = "Username Mogul";
	else if (nCount > uCount && nCount > gCount) _insight = "Number Collector";
	else if (gCount > uCount && gCount > nCount) _insight = "Gift Curator";

	let caption = `🏦 *WALLET OVERVIEW* \`${walletAddress.substring(0, 8)}...${walletAddress.slice(-6)}\`\n`;
	caption += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
	caption += `💎 *Liquid TON:* \`${formatNum(balance.toFixed(2))} TON\` (~$${formatNum(Math.round(liquidUsd))})\n\n`;

	caption += `━━━━━━━ *Assets* ━━━━━━━\n\n`;
	caption += `📦 *Total Items:* \`${totalAssets}\`\n`;
	caption += `${compBar}\n`;
	caption += `• Names: \`${uCount}\` | Numbers: \`${nCount}\` | Gifts: \`${gCount}\`\n\n`;

	caption += `🕒 *Last Activity:* \`${lastSeen}\`\n`;
	const walletStatus = portfolio?.status
		? portfolio.status.toUpperCase()
		: "ACTIVE";
	const walletType = portfolio?.isWallet ? "Contract" : "Personal";
	caption += `🚦 *Status:* \`${walletStatus}\` • \`${walletType}\`\n`;
	caption += `━━━━━━━━━━━━━━━━━━━━━━\n`;
	caption += `_Select an option below for deep analysis._`;

	const mainKeyboard = {
		inline_keyboard: [
			[
				{ text: `💎 Usernames (${uCount})`, callback_data: "wt_view_user" },
				{ text: `📱 Numbers (${nCount})`, callback_data: "wt_view_num" },
			],
			[
				{
					text: `🎁 Official Gifts (${gCount})`,
					callback_data: "wt_view_gift",
				},
			],
			[
				{ text: "🔗 TonViewer", url: `https://tonviewer.com/${walletAddress}` },
				{
					text: "💎 Fragment",
					url: `https://fragment.com/?query=${walletAddress}`,
				},
			],
			[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
		],
	};

	return smartEdit(ctx, caption, mainKeyboard);
}

// ======================================================
// FORMATTING FUNCTIONS
// ======================================================

function formatUsernamesPage(usernames, statuses, page) {
	const total = usernames.length;
	const start = page * ITEMS_PER_PAGE;
	const end = Math.min(start + ITEMS_PER_PAGE, total);
	const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

	let text = `💎 *Telegram Usernames* (${total})\n`;
	text += `━━━━━━━━━━━━━━━━\n\n`;

	if (total === 0) {
		text += "_No usernames found in this wallet._";
		return { text };
	}

	const pageItems = usernames.slice(start, end);
	pageItems.forEach((u, i) => {
		const globalIndex = start + i + 1;
		const status = statuses[start + i] || "";
		text += `${globalIndex}. @${u.name.replace(/_/g, "\\_")}${status}\n`;
	});

	if (totalPages > 1) {
		text += `\n📄 _Page ${page + 1}/${totalPages}_`;
	}

	text += `\n\n_✅ = Active | 💤 = Not in use_`;

	const keyboard = getUsernamesKeyboard(total, page);
	return { text, keyboard };
}

function formatNumbersPage(numbers, statuses, page) {
	const total = numbers.length;
	const start = page * ITEMS_PER_PAGE;
	const end = Math.min(start + ITEMS_PER_PAGE, total);
	const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

	let text = `📱 *Anonymous Numbers (+888)* (${total})\n`;
	text += `━━━━━━━━━━━━━━━━\n\n`;

	if (total === 0) {
		text += "_No anonymous numbers found._";
		return { text };
	}

	const pageItems = numbers.slice(start, end);
	pageItems.forEach((n, i) => {
		const globalIndex = start + i + 1;
		const status = statuses[start + i] || "";
		text += `${globalIndex}. \`${n.number}\`${status}\n`;
	});

	if (totalPages > 1) {
		text += `\n📄 _Page ${page + 1}/${totalPages}_`;
	}

	text += `\n\n_🟢 = Registered | ⚫ = Not Active_`;

	const keyboard = getNumbersKeyboard(total, page);
	return { text, keyboard };
}

function formatGiftsPage(gifts, page) {
	const total = gifts.length;
	const start = page * ITEMS_PER_PAGE;
	const end = Math.min(start + ITEMS_PER_PAGE, total);
	const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

	let text = `🎁 *Official Gifts* (${total})\n`;
	text += `━━━━━━━━━━━━━━━━\n\n`;

	if (total === 0) {
		text += "_No official gifts found in this wallet._";
		return { text };
	}

	const pageItems = gifts.slice(start, end);
	const buttons = [];

	pageItems.forEach((g, i) => {
		const globalIndex = start + i + 1;
		text += `${globalIndex}. *${g.name}*\n`;
		if (g.collection?.name) text += `   └ _${g.collection.name}_\n`;

		// Button for each gift on the page
		buttons.push([
			{
				text: `🔍 Details: ${g.name}`,
				callback_data: `wt_gift_det_${start + i}`,
			},
		]);
	});

	if (totalPages > 1) {
		text += `\n📄 _Page ${page + 1}/${totalPages}_`;
	}

	const navButtons = [];
	if (page > 0)
		navButtons.push({ text: "◀️ Prev", callback_data: `wt_gift_${page - 1}` });
	if (page < totalPages - 1)
		navButtons.push({ text: "Next ▶️", callback_data: `wt_gift_${page + 1}` });

	const keyboard = {
		inline_keyboard: [
			...buttons,
			navButtons.length > 0 ? navButtons : [],
			[{ text: "🔙 Back to Overview", callback_data: "wt_overview" }],
		],
	};

	return { text, keyboard };
}

export async function handleGiftDetail(ctx, index) {
	const cacheKey = `${ctx.chat.id}`;
	const cached = paginationCache.get(cacheKey);
	if (!cached) return ctx.answerCbQuery("⚠️ Session expired.");

	const gift = cached.portfolio.gifts[index];
	if (!gift) return ctx.answerCbQuery("⚠️ Gift not found.");

	let report = `🎁 *Gift Detail: ${gift.name}*\n`;
	report += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

	if (gift.collection) {
		report += `📦 *Collection:* \`${gift.collection.name}\`\n`;
		if (gift.collection.description) {
			const desc =
				gift.collection.description.length > 200
					? `${gift.collection.description.substring(0, 200)}...`
					: gift.collection.description;
			report += `📝 *Description:* _${desc}_\n`;
		}
	}

	if (gift.metadata?.attributes && Array.isArray(gift.metadata.attributes)) {
		const attrs = gift.metadata.attributes
			.map((a) => `• ${a.trait_type}: *${a.value}*`)
			.join("\n");
		if (attrs) report += `\n🧬 *Attributes:*\n${attrs}\n`;
	}

	report += `\n🔗 [View on TonViewer](https://tonviewer.com/${gift.address})`;

	const keyboard = {
		inline_keyboard: [
			[{ text: "⬅️ Back to List", callback_data: "wt_view_gift" }],
		],
	};

	return smartEdit(ctx, report, keyboard);
}

// ======================================================
// KEYBOARD FUNCTIONS (with pagination buttons)
// ======================================================

function getUsernamesKeyboard(total, page) {
	const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
	const buttons = [];
	if (page > 0) {
		buttons.push({ text: "◀️ Prev", callback_data: `wt_user_${page - 1}` });
	}
	if (page < totalPages - 1) {
		buttons.push({ text: "Next ▶️", callback_data: `wt_user_${page + 1}` });
	}

	const rows = [];
	if (buttons.length > 0) rows.push(buttons);
	rows.push([{ text: "🔙 Back to Overview", callback_data: "wt_overview" }]);

	return { inline_keyboard: rows };
}

function getNumbersKeyboard(total, page) {
	const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
	const buttons = [];
	if (page > 0) {
		buttons.push({ text: "◀️ Prev", callback_data: `wt_num_${page - 1}` });
	}
	if (page < totalPages - 1) {
		buttons.push({ text: "Next ▶️", callback_data: `wt_num_${page + 1}` });
	}

	const rows = [];
	if (buttons.length > 0) rows.push(buttons);
	rows.push([{ text: "🔙 Back to Overview", callback_data: "wt_overview" }]);

	return { inline_keyboard: rows };
}

function _getGiftsKeyboard(total, page) {
	const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
	const buttons = [];
	if (page > 0) {
		buttons.push({ text: "◀️ Prev", callback_data: `wt_gift_${page - 1}` });
	}
	if (page < totalPages - 1) {
		buttons.push({ text: "Next ▶️", callback_data: `wt_gift_${page + 1}` });
	}

	const rows = [];
	if (buttons.length > 0) rows.push(buttons);
	rows.push([{ text: "🔙 Back to Overview", callback_data: "wt_overview" }]);

	return { inline_keyboard: rows };
}

// ======================================================
// PAGINATION HANDLERS (to be called from bot.js)
// ======================================================

// ======================================================
// PAGINATION HANDLERS (to be called from bot.js)
// ======================================================

export async function handleUsernamePagination(ctx, page) {
	const cacheKey = `${ctx.chat.id}`;
	const cached = paginationCache.get(cacheKey);

	if (!cached) {
		return ctx.answerCbQuery("⚠️ Session expired. Please scan again.");
	}

	const { portfolio } = cached;
	let { usernameStatuses } = cached;

	if (!usernameStatuses) {
		usernameStatuses = new Array(portfolio.usernames.length).fill("");
	}

	const start = page * ITEMS_PER_PAGE;
	const end = Math.min(start + ITEMS_PER_PAGE, portfolio.usernames.length);

	const needsChecking = [];
	for (let i = start; i < end; i++) {
		if (!usernameStatuses[i]) {
			needsChecking.push(i);
		}
	}

	if (needsChecking.length > 0) {
		await ctx.answerCbQuery("⏳ Checking status...");
		for (const index of needsChecking) {
			try {
				const check = await telegramClient.checkUsername(
					portfolio.usernames[index].name,
				);
				usernameStatuses[index] = check.active ? " ✅" : " 💤";
			} catch (_e) {
				usernameStatuses[index] = " ❓";
			}
		}
		cached.usernameStatuses = usernameStatuses;
		paginationCache.set(cacheKey, cached);
	}

	const { text, keyboard } = formatUsernamesPage(
		portfolio.usernames,
		usernameStatuses,
		page,
	);
	return smartEdit(ctx, text, keyboard);
}

export async function handleNumberPagination(ctx, page) {
	const cacheKey = `${ctx.chat.id}`;
	const cached = paginationCache.get(cacheKey);

	if (!cached) {
		return ctx.answerCbQuery("⚠️ Session expired. Please scan again.");
	}

	const { portfolio } = cached;
	let { numberStatuses } = cached;

	if (!numberStatuses) {
		numberStatuses = new Array(portfolio.anonymousNumbers.length).fill("");
	}

	const start = page * ITEMS_PER_PAGE;
	const end = Math.min(
		start + ITEMS_PER_PAGE,
		portfolio.anonymousNumbers.length,
	);

	const needsChecking = [];
	for (let i = start; i < end; i++) {
		if (!numberStatuses[i]) {
			needsChecking.push(i);
		}
	}

	if (needsChecking.length > 0) {
		await ctx.answerCbQuery(
			"⏳ Checking registration of numbers on this page...",
		);

		for (const index of needsChecking) {
			try {
				const check = await telegramClient.checkPhoneNumber(
					portfolio.anonymousNumbers[index].number,
				);
				numberStatuses[index] = check.registered ? " 🟢" : " ⚫";
			} catch (_e) {
				numberStatuses[index] = " ❓";
			}
		}

		cached.numberStatuses = numberStatuses;
		paginationCache.set(cacheKey, cached);
	}

	const { text, keyboard } = formatNumbersPage(
		portfolio.anonymousNumbers,
		numberStatuses,
		page,
	);
	return smartEdit(ctx, text, keyboard);
}

export function handleGiftPagination(ctx, page) {
	const cacheKey = `${ctx.chat.id}`;
	const cached = paginationCache.get(cacheKey);

	if (!cached) {
		return ctx.answerCbQuery("⚠️ Session expired. Please scan again.");
	}

	const { portfolio } = cached;
	const gifts = portfolio.gifts || [];
	const { text, keyboard } = formatGiftsPage(gifts, page);

	return smartEdit(ctx, text, keyboard);
}

// ======================================================
// BACKGROUND PROCESSING
// ======================================================

/**
 * Checks all remaining usernames and numbers in the background
 */
async function populateAllRemainingStatuses(cacheKey) {
	// Wait a bit to let initial messages send
	await new Promise((r) => setTimeout(r, 5000));

	const cached = paginationCache.get(cacheKey);
	if (!cached) return;

	const { portfolio } = cached;

	// 1. Process Usernames
	for (let i = 0; i < portfolio.usernames.length; i++) {
		const fresh = paginationCache.get(cacheKey);
		if (!fresh) return; // Cache cleared

		if (!fresh.usernameStatuses[i]) {
			try {
				const check = await telegramClient.checkUsername(
					portfolio.usernames[i].name,
				);
				fresh.usernameStatuses[i] = check.active ? " ✅" : " 💤";
				paginationCache.set(cacheKey, fresh);
			} catch (_e) {}
			// Small delay to respect rate limits
			await new Promise((r) => setTimeout(r, 300));
		}
	}

	// 2. Process Numbers
	for (let i = 0; i < portfolio.anonymousNumbers.length; i++) {
		const fresh = paginationCache.get(cacheKey);
		if (!fresh) return;

		if (!fresh.numberStatuses[i]) {
			try {
				const check = await telegramClient.checkPhoneNumber(
					portfolio.anonymousNumbers[i].number,
				);
				fresh.numberStatuses[i] = check.registered ? " 🟢" : " ⚫";
				paginationCache.set(cacheKey, fresh);
			} catch (_e) {}
			// Longer delay for numbers (sensitive)
			await new Promise((r) => setTimeout(r, 1000));
		}
	}

	console.log(`✅ Background scan completed for wallet in chat ${cacheKey}`);
}

// Cleanup old cache entries (older than 30 minutes)
setInterval(
	() => {
		const now = Date.now();
		const THIRTY_MINUTES = 30 * 60 * 1000;
		for (const [key, value] of paginationCache.entries()) {
			if (now - value.timestamp > THIRTY_MINUTES) {
				paginationCache.delete(key);
			}
		}
	},
	5 * 60 * 1000,
); // Run every 5 minutes
