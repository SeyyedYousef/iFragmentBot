import {
	getCachedReport,
	setCachedReport,
} from "../../../App/Helpers/cache.helper.js";
import {
	buildFullCaption,
	escapeMD,
} from "../../../App/Helpers/report.helper.js";
import { generateFlexCard } from "../../../Shared/UI/Components/card-generator.component.js";
import {
	generateShortInsight,
	generateUsernameSuggestions,
	getTonPrice,
	scrapeFragment,
	streamShortInsight
} from "../Infrastructure/fragment.repository.js";
import { calculateRarity, estimateValue } from "./oracle.service.js";
import { getDashboardConfig, getTemplates } from "../../../Shared/Infra/Database/settings.repository.js";
import { formatMarkdownToHTML } from "../../../Shared/Infra/Telegram/telegram.formatter.js";
import { MessageStreamer } from "../../../Shared/Infra/Telegram/telegram.streamer.js";
import { renderTemplate, fetchUserVariables } from "../../../Shared/Infra/Telegram/telegram.cms.js";
import { ensurePersonalWorkspace } from "../../../Shared/Infra/Telegram/telegram.topics.js";

/**
 * Main process for username analysis
 */
export async function processUsernameReport(chatId, username, tonPrice, bot, userId) {
	// 1. Check Cache
	const cached = getCachedReport(username);
	if (cached) {
		const {
			fragmentData,
			cardData,
			tonPrice: cachedTonPrice,
			rarity,
			estValue,
			suggestions,
		} = cached;

		const imageBuffer = await generateFlexCard(cardData);
		const caption = buildFullCaption(
			fragmentData,
			cardData,
			cachedTonPrice,
			rarity,
			estValue,
			suggestions,
		);

		// Send photo if high quality
		if (imageBuffer && imageBuffer.length >= 1000) {
			try {
				await bot.telegram.sendPhoto(
					chatId,
					{ source: Buffer.from(imageBuffer) },
					{
						caption: `💎 *Analysis for @${escapeMD(username)}*`,
						parse_mode: "Markdown",
					},
				);
			} catch (e) {
				console.error("Failed to send cached photo:", e.message);
			}
		}

		// Send full text report
		await bot.telegram.sendMessage(chatId, formatMarkdownToHTML(caption), {
			parse_mode: "HTML",
		});
		return { success: true, cached: true };
	}

	// 2. Fresh Fetch & Analysis
	const config = await getDashboardConfig();
	const isStreaming = config?.features?.streaming_enabled ?? true;

	const [fragmentData, currentTonPrice, suggestions] =
		await Promise.all([
			scrapeFragment(username),
			tonPrice || getTonPrice(),
			generateUsernameSuggestions(username),
		]);

	let insight = "";
	if (isStreaming) {
		const statusMsg = await bot.telegram.sendMessage(chatId, "✨ _Initializing Deep Insight..._", { parse_mode: "Markdown" });
		const streamer = new MessageStreamer(bot, chatId, statusMsg.message_id);
		
		insight = await streamShortInsight(username, async (text) => {
			await streamer.push(text);
		});
		await streamer.finish(insight);
	} else {
		insight = await generateShortInsight(username);
	}

	const estValue = await estimateValue(
		username,
		fragmentData.lastSalePrice,
		currentTonPrice,
		fragmentData.status,
	);
	const rarity = await calculateRarity(username, estValue);

	// 3. Prepare Card Data
	const cardData = {
		username,
		tagline: insight,
		status: fragmentData.status,
		statusText: fragmentData.statusText,
		rarity,
		estValueTon: estValue.ton,
		estValueUsd: estValue.usd,
		lastSalePrice: fragmentData.lastSalePrice,
		lastSaleDate: fragmentData.lastSaleDate || "N/A",
		currentPrice:
			fragmentData.priceTon ||
			fragmentData.highestBid ||
			fragmentData.minBid ||
			estValue.ton,
		priceType: fragmentData.priceTon
			? "Buy Now"
			: fragmentData.highestBid
				? "Highest Bid"
				: fragmentData.minBid
					? "Min Bid"
					: "Estimated",
		ownerWallet: fragmentData.ownerWallet || "Unknown",
	};

	const imageBuffer = await generateFlexCard(cardData);

	// 4. Cache Result
	setCachedReport(username, {
		fragmentData,
		cardData,
		tonPrice: currentTonPrice,
		rarity,
		estValue,
		suggestions,
	});

	// 5. Build Report & UI
	const templates = await getTemplates();
	const globalVars = await fetchUserVariables(userId, bot);

	const caption = buildFullCaption(
		fragmentData,
		cardData,
		currentTonPrice,
		rarity,
		estValue,
		suggestions,
	);
	
	const finalCaption = renderTemplate(templates.usernames || caption, {
		...globalVars,
		username,
		insight,
		rarity_score: String(rarity.score),
		rarity_percent: String(rarity.percent),
		rarity_label: rarity.label,
		price_ton: String(estValue.ton),
		price_usd: String(estValue.usd),
		status: fragmentData.statusText || fragmentData.status,
		last_sale: String(fragmentData.lastSalePrice || ""),
		ends_in: fragmentData.endsIn || "",
		highest_bid: String(fragmentData.highestBid || ""),
		min_bid: String(fragmentData.minBid || ""),
		owner: fragmentData.owner || "",
		url: fragmentData.url || ""
	});

	// 6. Send Result
	let threadId = null;
	if (config?.features?.topics_enabled) {
		const ws = await ensurePersonalWorkspace(bot.telegram, chatId);
		if (ws) threadId = ws.usernames;
	}

	if (imageBuffer && imageBuffer.length >= 1000) {
		try {
			await bot.telegram.sendPhoto(
				chatId,
				{ source: Buffer.from(imageBuffer) },
				{
					caption: formatMarkdownToHTML(`💎 *Analysis for @${escapeMD(username)}*`),
					parse_mode: "HTML",
					message_thread_id: threadId,
				},
			);
		} catch (e) {
			console.error("Failed to send fresh photo:", e.message);
		}
	}

	await bot.telegram.sendMessage(chatId, finalCaption, {
		parse_mode: "HTML",
		message_thread_id: threadId,
	});

	return { success: true, cached: false };
}
