import { getUserGiftsWithValue } from "../../../Shared/Infra/Telegram/telegram.client.js";
import { getGiftStats } from "../../Market/Application/market.service.js";
import { getTonPrice } from "../../Market/Infrastructure/fragment.repository.js";

// Configuration
const _CURRENCY = "€";
const STARS_TO_TON_RATE = 0.0013;
const _TON_TO_EUR_RATE = 4.6;

/**
 * Helper: Generate visual progress bar
 */
function getProgressBar(value, max, length = 10) {
	const percent = Math.min(value / max, 1);
	const filled = Math.floor(percent * length);
	const empty = length - filled;
	return "▓".repeat(filled) + "░".repeat(empty);
}

/**
 * Helper: Get User Rank based on Value
 */
function getPortfolioRank(totalTon) {
	if (totalTon >= 10000) return { title: "🐋 WHALE KING", icon: "👑" };
	if (totalTon >= 5000) return { title: "🦈 SHARK", icon: "⚔️" };
	if (totalTon >= 1000) return { title: "🐬 DOLPHIN", icon: "🌊" };
	if (totalTon >= 500) return { title: "🦑 SQUID", icon: "🌪️" };
	if (totalTon >= 100) return { title: "🐢 TURTLE", icon: "🛡️" };
	if (totalTon >= 50) return { title: "🦀 CRAB", icon: "🐚" };
	return { title: "🦐 SHRIMP", icon: "🌱" };
}

/**
 * Handle /me command - Super Edition
 */
export async function handleMeCommand(ctx) {
	// State management for pagination (Simple Memory Cache)
	// در محیط پروداکشن واقعی باید از Redis استفاده کرد
	if (!ctx.session) ctx.session = {};
	if (!ctx.session.meCache) ctx.session.meCache = {};

	let page = 1;
	const PAGE_SIZE = 10;

	// اگر کالبک پیجینگ باشد، شماره صفحه را می‌خوانیم
	if (isCallback && ctx.callbackQuery.data.startsWith("me_page_")) {
		page = parseInt(ctx.callbackQuery.data.split("_")[2], 10);
	}

	if (isCallback) {
		try {
			await ctx.answerCbQuery("🔄 Loading...");

			// اگر تغییر صفحه است، نیازی به پیام لودینگ کامل نیست، فقط ادیت می‌کنیم
			if (ctx.callbackQuery.data.startsWith("me_page_")) {
				loadingMsg = messageObj;
			} else {
				// رفرش کامل
				loadingMsg = messageObj;
				await ctx.telegram.editMessageText(
					messageObj.chat.id,
					messageObj.message_id,
					null,
					"⏳ *Consulting the Oracle...* \nScanning blockchain for assets...",
					{ parse_mode: "Markdown" },
				);
			}
		} catch (_e) {
			// اگر پیام قدیمی بود، پیام جدید ارسال می‌کنیم
			loadingMsg = await ctx.reply(
				"⏳ *Consulting the Oracle...* \nScanning blockchain for assets...",
				{ parse_mode: "Markdown" },
			);
		}
	} else {
		// دریافت دقیق پیام ارسال شده برای جلوگیری از خطای ویرایش
		loadingMsg = await ctx.reply(
			"⏳ *Consulting the Oracle...* \nScanning blockchain for assets...",
			{ parse_mode: "Markdown" },
		);
	}

	try {
		// کش کردن نتایج برای استفاده در صفحات بعدی (فقط برای ۵ دقیقه)
		// اگر دیتا تازه است (رفرش نیست) و کش داریم، از کش استفاده کن
		let gifts = [];
		let tonPriceData, marketStats;
		let userGiftsResult; // Declare userGiftsResult here

		const cacheKey = `me_${userId}`;
		const isFreshRequest =
			!isCallback || ctx.callbackQuery.data === "refresh_me";
		const loadingMsgId = loadingMsg ? loadingMsg.message_id : undefined; // Define loadingMsgId here

		if (
			!isFreshRequest &&
			ctx.session.meCache[cacheKey] &&
			Date.now() - ctx.session.meCache[cacheKey].timestamp < 300 * 1000
		) {
			// 5 minutes cache
			// خواندن از کش برای تغییر صفحه
			const cached = ctx.session.meCache[cacheKey];
			gifts = cached.gifts;
			tonPriceData = cached.tonPriceData;
			marketStats = cached.marketStats;
		} else {
			// درخواست جدید به سرویس‌ها
			const results = await Promise.all([
				getUserGiftsWithValue(userId),
				getTonPrice(),
				getGiftStats(),
			]);

			userGiftsResult = results[0];
			tonPriceData = results[1];
			marketStats = results[2];

			if (!userGiftsResult.success) {
				// Error handling block (kept same logic as before)
				// Re-implementing error logic inside this block for safety
				let errorText = `❌ *System Error*\nCould not retrieve assets: ${userGiftsResult.error || "Unknown error"}`;
				if (userGiftsResult.error === "no_accounts") {
					errorText = `⚠️ *Action Required*\n\nNo Telegram accounts are connected to scan gifts.\n👉 Use /panel to add a 'Scanner' account (or any account).`;
				}
				if (loadingMsgId) {
					try {
						await ctx.telegram.editMessageText(
							ctx.chat.id,
							loadingMsgId,
							null,
							errorText,
							{ parse_mode: "Markdown" },
						);
					} catch (_e) {
						await ctx.reply(errorText, { parse_mode: "Markdown" });
					}
				} else {
					await ctx.reply(errorText, { parse_mode: "Markdown" });
				}
				return;
			}

			gifts = userGiftsResult.gifts;

			// ذخیره در کش
			ctx.session.meCache[cacheKey] = {
				gifts,
				tonPriceData,
				marketStats,
				timestamp: Date.now(),
			};
		}
		const tonPrice = tonPriceData?.price || 5.5;
		const euroRate = 0.92;

		// --- Processing & Logic ---
		let totalTonValue = 0;
		let _nftCount = 0;

		const groupedGifts = {};
		let crownJewel = null; // Most valuable item

		for (const gift of gifts) {
			// BURNED Check (API 9.4)
			if (gift.isBurned) continue;

			let valueTon = 0;

			// دسترسی به دیتای ویژگی‌های این کالکشن
			// marketStats الان حاوی کل آبجکت attributes.json است
			const collectionData = marketStats[gift.name];

			if (collectionData) {
				// استراتژی قیمت‌گذاری بر اساس ویژگی: اولویت با Backdrop است، سپس Model
				if (gift.backdrop && collectionData.Backdrop?.[gift.backdrop]) {
					valueTon = collectionData.Backdrop[gift.backdrop];
				} else if (gift.model && collectionData.Model?.[gift.model]) {
					valueTon = collectionData.Model[gift.model];
				} else if (collectionData.floorPrice) {
					// در صورت تعریف یک قیمت کلی برای کالکشن
					valueTon = collectionData.floorPrice;
				}
			} else {
				// اگر دیتایی نبود، از تبدیل استار استفاده کن
				valueTon = gift.value * STARS_TO_TON_RATE;
			}

			// اگر قیمت پیدا نشد، حداقل مقدار استار را لحاظ کن
			if (valueTon === 0) valueTon = gift.value * STARS_TO_TON_RATE;

			totalTonValue += valueTon;
			if (gift.isNft) _nftCount++;

			// Track Crown Jewel
			if (!crownJewel || valueTon > crownJewel.valueTon) {
				crownJewel = { ...gift, valueTon };
			}

			// Grouping
			const key = `${gift.name}-${gift.model}-${gift.backdrop}`;
			if (!groupedGifts[key]) {
				groupedGifts[key] = {
					count: 0,
					name: gift.name,
					slug: gift.slug,
					model: gift.model,
					backdrop: gift.backdrop,
					symbol: gift.symbol,
					valueTon: valueTon,
					isNft: gift.isNft,
					rarityPermille: gift.rarityPermille || 0,
				};
			}
			groupedGifts[key].count++;
		}

		const totalEuroValue = totalTonValue * tonPrice * euroRate;
		const _tonInEur = tonPrice * euroRate;

		// Rank Calculation
		const rank = getPortfolioRank(totalTonValue);

		// --- Report Generation with Pagination ---
		const now = new Date();
		const dateStr = now.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
		});

		// تبدیل آبجکت گروه‌بندی شده به آرایه برای صفحه‌بندی
		const sortedGroups = Object.values(groupedGifts).sort(
			(a, b) => b.valueTon - a.valueTon,
		);

		// منطق صفحه‌بندی
		const totalItems = sortedGroups.length;
		const totalPages = Math.ceil(totalItems / PAGE_SIZE);
		const startIndex = (page - 1) * PAGE_SIZE;
		const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
		const pageItems = sortedGroups.slice(startIndex, endIndex);

		let report = `╭─── 👤 *PORTFOLIO REPORT* ───╮\n`;
		report += `│ Owner: *${username}*\n`;
		report += `│ Rank: ${rank.icon} *${rank.title}*\n`;
		report += `│ Date: ${dateStr}\n`;
		report += `╰──────────────────────────╯\n\n`;

		report += `💰 *NET WORTH*\n`;
		// محاسبه یورو
		report += `💎 \`${totalTonValue.toFixed(2)} TON\` ≈ €${totalEuroValue.toFixed(2)}\n`;
		report += `${getProgressBar(totalTonValue, 1000, 15)} ${Math.min((totalTonValue / 1000) * 100, 100).toFixed(0)}%\n\n`;

		if (crownJewel) {
			report += `👑 *CROWN JEWEL* (Most Valuable)\n`;
			report += `└─ *${crownJewel.name || "Unknown"}* #${crownJewel.itemNumber || "???"}\n`;
			report += `   └─ Value: \`${crownJewel.valueTon.toFixed(2)} TON\`\n\n`;
		}

		report += `📊 *ASSET BREAKDOWN* (Page ${page}/${totalPages || 1})\n`;

		if (pageItems.length > 0) {
			pageItems.forEach((item, _index) => {
				const link = item.slug
					? `https://fragment.com/gift/${item.slug}`
					: `https://fragment.com`;

				// Icon logic same as before
				let icon = "🎁";
				if (item.name.toLowerCase().includes("pepe")) icon = "🐸";
				else if (item.name.toLowerCase().includes("cake")) icon = "🎂";
				else if (item.name.toLowerCase().includes("star")) icon = "⭐";
				else if (item.name.toLowerCase().includes("heart")) icon = "❤️";
				else {
					if (item.backdrop?.toLowerCase().includes("brown")) icon = "🟫";
					else if (item.backdrop?.toLowerCase().includes("purple")) icon = "🟪";
					else if (item.backdrop?.toLowerCase().includes("blue")) icon = "🟦";
				}

				// Rarity Badge (New Feature)
				let rarityBadge = "";
				if (item.rarityPermille > 0) {
					if (item.rarityPermille < 1) rarityBadge = "🔥 MYTHIC";
					else if (item.rarityPermille < 10) rarityBadge = "✨ RARE";
					else rarityBadge = "🔹 COMMON";
				}

				const displayName = item.model
					? `${item.name} (${item.model})`
					: item.name;

				// نمایش کامپکت برای هر آیتم
				report += `${icon} [${displayName}](${link}) ${rarityBadge}\n`;
				report += `   📦 x${item.count} | 💎 \`${item.valueTon.toFixed(1)} TON\`\n\n`;
			});
		} else {
			report += `_No items found._\n`;
		}

		report += `\n_⚡ Powered by iFragmentBot_`;

		// Buttons
		const keyboard = {
			inline_keyboard: [],
		};

		// Paging Buttons Row
		const navRow = [];
		if (page > 1)
			navRow.push({ text: "⬅️ Previous", callback_data: `me_page_${page - 1}` });
		if (page < totalPages)
			navRow.push({ text: "➡️ Next", callback_data: `me_page_${page + 1}` });
		if (navRow.length > 0) keyboard.inline_keyboard.push(navRow);

		// Actions Row
		keyboard.inline_keyboard.push([
			{ text: "🔄 Refresh Assets", callback_data: "refresh_me" },
		]);

		// Send/Edit Message
		const msgIdToEdit = loadingMsg ? loadingMsg.message_id : undefined;
		if (msgIdToEdit) {
			try {
				await ctx.telegram.editMessageText(
					ctx.chat.id,
					msgIdToEdit,
					null,
					report,
					{
						parse_mode: "Markdown",
						disable_web_page_preview: true,
						reply_markup: keyboard,
					},
				);
			} catch (e) {
				// If edit fails (e.g. content same), ignore
				console.log("Edit failed or content same:", e.message);
			}
		} else {
			await ctx.reply(report, {
				parse_mode: "Markdown",
				disable_web_page_preview: true,
				reply_markup: keyboard,
			});
		}
	} catch (error) {
		console.error("❌ /me command error:", error);
		const errorText = `❌ *Fatal Error*\nSomething went wrong: ${error.message}`;
		if (loadingMsg?.message_id) {
			try {
				await ctx.telegram.editMessageText(
					ctx.chat.id,
					loadingMsg.message_id,
					null,
					errorText,
					{ parse_mode: "Markdown" },
				);
			} catch (_e) {}
		} else {
			await ctx.reply(errorText, { parse_mode: "Markdown" });
		}
	}
}

// Share Text
