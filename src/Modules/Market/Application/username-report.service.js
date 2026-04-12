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
import { fragmentApiClient } from "../Infrastructure/fragment-api.client.js";
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
			rarity,
			estValue,
			suggestions,
		} = cached;

		// 🚀 LIVE PRICE UPDATE (GPU-STYLE)
		const currentLiveTon = tonPrice || await getTonPrice();
		const liveEstValue = {
			...estValue,
			usd: Math.round(estValue.ton * currentLiveTon)
		};

		const imageBuffer = await generateFlexCard({ ...cardData, estValueUsd: liveEstValue.usd });
		const caption = buildFullCaption(
			fragmentData,
			cardData,
			currentLiveTon, // Live TON Price
			rarity,
			liveEstValue, // Updated USD Value
			suggestions,
		);

		// Send photo if high quality
		if (imageBuffer && imageBuffer.length >= 1000) {
			try {
				await bot.telegram.sendPhoto(
					chatId,
					{ source: Buffer.from(imageBuffer) },
					{
						caption: formatMarkdownToHTML(`💎 *Analysis for @${escapeMD(username)}* (Live Market: $${currentLiveTon.toFixed(2)})`),
						parse_mode: "HTML",
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

	// 2. Fresh Fetch & Analysis (Parallel Execution)
	const [config, templates, globalVars, tonPriceData, fragmentData, suggestions, auctionDetails, bidHistory, assetHistory] = await Promise.all([
		getDashboardConfig(),
		getTemplates(),
		fetchUserVariables(userId, bot),
		tonPrice || getTonPrice(),
		scrapeFragment(username),
		generateUsernameSuggestions(username),
		fragmentApiClient.getAuctionDetails(username).catch(() => null),
		fragmentApiClient.getBidHistory(username).catch(() => null),
		fragmentApiClient.getAssetHistory(username).catch(() => null),
	]);

	const currentTonPrice = tonPriceData;
	const isStreaming = config?.features?.streaming_enabled ?? true;

	// 3. AI Insight & Oracle (Parallel)
	const [insight, estValue] = await Promise.all([
		isStreaming 
			? (async () => {
				const statusMsg = await bot.telegram.sendMessage(chatId, "✨ _Initializing Deep Insight..._", { parse_mode: "Markdown" });
				const streamer = new MessageStreamer(bot, chatId, statusMsg.message_id);
				const text = await streamShortInsight(username, async (t) => await streamer.push(t));
				await streamer.finish(text);
				return text;
			})()
			: generateShortInsight(username),
		estimateValue(username, fragmentData.lastSalePrice, currentTonPrice, fragmentData.status)
	]);

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
	const caption = buildFullCaption(
		fragmentData,
		cardData,
		currentTonPrice,
		rarity,
		estValue,
		suggestions,
	);
	
	const finalCaption = renderTemplate(templates.report_username || caption, {
		...globalVars,
		USERNAME_RAW: username,
		DEFINITION: insight,
		VAL_TON: String(estValue.ton),
		VAL_USD: String(estValue.usd),
		TIER: rarity.label,
		CONFIDENCE: String(estValue.confidence || 75), // Use actual model confidence
		REASONING: insight, // Reasoning and definition often overlap in our AI logic
		STATUS: fragmentData.statusText || fragmentData.status,
		LAST_SALE: String(fragmentData.lastSalePrice || ""),
		ENDS_IN: fragmentData.endsIn || "",
		HIGHEST_BID: String(fragmentData.highestBid || ""),
		MIN_BID: String(fragmentData.minBid || ""),
		OWNER: fragmentData.owner || "",
		URL: fragmentData.url || "",
		// NEW: Deep Intel
		TOTAL_BIDS: String(bidHistory?.bids?.length || 0),
		BID_INCREMENT: String(auctionDetails?.min_step || 5),
		STARS_PRICE: String(Math.round(estValue.ton * 40)),
		TOP_BIDDER_WALLET: bidHistory?.bids?.[0]?.owner || "None",
		HISTORICAL_HOLDERS: String((assetHistory?.transfers?.length || 0) + 1),
		COLLECTION_HOLDERS: "1M+", // Standard for usernames
		MINT_DATE: (assetHistory?.transfers && assetHistory.transfers.length > 0) 
			? assetHistory.transfers[assetHistory.transfers.length - 1].date 
			: "Genesis",
		RARITY_PERCENT: String((100 - (rarity.score || 0)).toFixed(1)) + "%",
		PROFIT_LOSS: (fragmentData.lastSalePrice && fragmentData.lastSalePrice > 0) 
			? `${Math.round(((estValue.ton || 0) - fragmentData.lastSalePrice) / fragmentData.lastSalePrice * 100)}%` 
			: "0%"
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
