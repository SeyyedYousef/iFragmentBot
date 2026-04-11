import { generateFlexCard as generateGiftFlexCard } from "../../Modules/Admin/Application/flex-card.service.js";
import { generateNumberFlexCard } from "../../Modules/Admin/Application/number-flex-card.service.js";
import {
	JOB_TYPES,
	jobQueue,
} from "../../Modules/Automation/Application/queue.service.js";
import {
	formatNumber,
	generateGiftReport,
} from "../../Modules/Market/Application/marketapp.service.js";
import { generateNumberReport } from "../../Modules/Market/Application/number-report.service.js";
import { processUsernameReport } from "../../Modules/Market/Application/username-report.service.js";
import { handleComparison } from "../Routes/comparison.handler.js";
import { handlePortfolioByWallet } from "../Routes/group.handler.js";
import { formatMarkdownToHTML } from "../../Shared/Infra/Telegram/telegram.formatter.js";
import { getDashboardConfig, getTemplates } from "../../Shared/Infra/Database/settings.repository.js";
import { ensurePersonalWorkspace } from "../../Shared/Infra/Telegram/telegram.topics.js";
import { renderTemplate, fetchUserVariables } from "../../Shared/Infra/Telegram/telegram.cms.js";

import { escapeMD } from "../Helpers/report.helper.js";

/**
 * Initialize and register all job queue handlers
 */
export async function initJobHandlers(bot) {
	// 1. Injected bot for sending messages
	jobQueue.setBot(bot);

	// 2. GIFT REPORT HANDLER
	jobQueue.registerHandler(JOB_TYPES.GIFT_REPORT, async (job) => {
		const { chatId, data } = job;
		const { link, tonPrice } = data;

		const [config, templates, globalVars] = await Promise.all([
			getDashboardConfig(),
			getTemplates(),
			fetchUserVariables(job.userId, bot)
		]);

		let threadId = null;
		if (config?.features?.topics_enabled) {
			const ws = await ensurePersonalWorkspace(bot, chatId);
			if (ws) threadId = ws.gifts; // SPECIFIC TOPIC: Gifts Report
		}

		try {
			const result = await generateGiftReport(link, tonPrice);

			const finalCaption = renderTemplate(templates.report_gift || result.report, {
				...globalVars,
				COLLECTION: result.collection,
				NUMBER: String(result.itemNumber),
				VERDICT: result.verdict,
				PRICE_TON: String(Math.round(result.estimatedValue)),
				VAL_USD: String(Math.round(result.estimatedValue * tonPrice)),
				COLOR: result.color || "",
				SLUG: result.slug || "",
				BADGES: (result.badges || []).join(", "),
				FLOOR_PORTALS: String(result.crossMarket?.portals?.floor || "N/A"),
				FLOOR_TONNEL: String(result.crossMarket?.tonnel?.floor || "N/A"),
				VOLUME_PORTALS: String(result.crossMarket?.portals?.volume || "N/A"),
				VOLUME_TONNEL: String(result.crossMarket?.tonnel?.volume || "N/A"),
				// NEW: Deep Intel
				TOTAL_BIDS: result.TOTAL_BIDS,
				BID_INCREMENT: result.BID_INCREMENT,
				STARS_PRICE: result.STARS_PRICE,
				TOP_BIDDER_WALLET: result.TOP_BIDDER_WALLET,
				HISTORICAL_HOLDERS: result.HISTORICAL_HOLDERS,
				COLLECTION_HOLDERS: result.COLLECTION_HOLDERS,
				MINT_DATE: result.MINT_DATE,
				RARITY_PERCENT: result.RARITY_PERCENT,
				PROFIT_LOSS: result.PROFIT_LOSS,
				// --- Trading & Sniper ---
				DEAL_SCORE: result.DEAL_SCORE,
				UNDERPRICED_BY: result.UNDERPRICED_BY,
				POTENTIAL_PROFIT_TON: result.POTENTIAL_PROFIT_TON,
				POTENTIAL_ROI: result.POTENTIAL_ROI,
				BREAK_EVEN_PRICE: result.BREAK_EVEN_PRICE,
				SPECIFIC_ATTR_FLOOR: result.SPECIFIC_ATTR_FLOOR,
				NEXT_CHEAPEST_PRICE: result.NEXT_CHEAPEST_PRICE,
				SNIPER_STATUS: result.SNIPER_STATUS,
			});

			// Send textual report
			await bot.telegram.sendMessage(chatId, finalCaption, {
				parse_mode: "HTML",
				disable_web_page_preview: true,
				message_thread_id: threadId,
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: "🎁 Analyze Another Gift",
								callback_data: "report_gifts",
							},
						],
						[{ text: "🔙 Main Menu", callback_data: "back_to_menu" }],
					],
				},
			});

			// Generate Card
			try {
				const cardData = {
					collectionName: result.collection,
					itemNumber: result.itemNumber,
					imageUrl: `https://nft.fragment.com/gift/${result.slug.toLowerCase()}-${result.itemNumber}.lottie.json`,
					price: formatNumber(Math.round(result.estimatedValue)),
					verdict: result.verdict || "STANDARD",
					badges: result.badges || [],
					appraiserNote: result.appraiserData?.analysis || "",
					color: result.color,
				};

				let imageBuffer = await generateGiftFlexCard(cardData);
				if (!Buffer.isBuffer(imageBuffer))
					imageBuffer = Buffer.from(imageBuffer);

				if (imageBuffer && imageBuffer.length > 500) {
					await bot.telegram.sendPhoto(
						chatId,
						{ source: imageBuffer },
						{
							caption: formatMarkdownToHTML(`💎 *${escapeMD(result.collection)} #${result.itemNumber}*`),
							parse_mode: "HTML",
							message_thread_id: threadId,
						},
					);
				}
			} catch (cardError) {
				console.error("Queue: Gift Card error:", cardError.message);
			}

			return { success: true, result };
		} catch (error) {
			await bot.telegram.sendMessage(
				chatId,
				`❌ Error generating gift report: ${error.message}`,
				{
					reply_markup: {
						inline_keyboard: [
							[{ text: "🔄 Try Again", callback_data: "report_gifts" }],
							[{ text: "🔙 Menu", callback_data: "back_to_menu" }],
						],
					},
				},
			);
			throw error;
		}
	});

	// 3. NUMBER REPORT HANDLER
	jobQueue.registerHandler(JOB_TYPES.NUMBER_REPORT, async (job) => {
		const { chatId, data } = job;
		const { input, tonPrice } = data;

		const [config, templates, globalVars] = await Promise.all([
			getDashboardConfig(),
			getTemplates(),
			fetchUserVariables(job.userId, bot)
		]);

		let threadId = null;
		if (config?.features?.topics_enabled) {
			const ws = await ensurePersonalWorkspace(bot, chatId);
			if (ws) threadId = ws.numbers; // SPECIFIC TOPIC: +888 Report
		}

		try {
			const result = await generateNumberReport(input, tonPrice);

			// CMS Template Rendering
			const finalCaption = renderTemplate(templates.report_number || result.report, {
				...globalVars,
				FORMATTED_NUMBER: result.formattedNumber,
				VAL_TON: String(Math.round(result.priceTon || result.estimatedValue)),
				VAL_USD: String(Math.round((result.priceTon || result.estimatedValue) * tonPrice)),
				FLOOR_TON: String(result.floor),
				VS_FLOOR: String(Math.round(result.vsFloor)),
				STATUS: result.status,
				RARITY_GRADE: result.rarityRank || "Standard",
				OWNER_WALLET: result.owner ? `${result.owner.substring(0, 8)}...${result.owner.slice(-6)}` : "Private",
				URL: result.url || "",
				// NEW: Deep Intel
				TOTAL_BIDS: result.TOTAL_BIDS,
				BID_INCREMENT: result.BID_INCREMENT,
				STARS_PRICE: result.STARS_PRICE,
				TOP_BIDDER_WALLET: result.TOP_BIDDER_WALLET,
				HISTORICAL_HOLDERS: result.HISTORICAL_HOLDERS,
				COLLECTION_HOLDERS: result.COLLECTION_HOLDERS,
				MINT_DATE: result.MINT_DATE,
				RARITY_PERCENT: result.RARITY_PERCENT,
				PROFIT_LOSS: result.PROFIT_LOSS
			});

			await bot.telegram.sendMessage(chatId, finalCaption, {
				parse_mode: "HTML",
				disable_web_page_preview: true,
				message_thread_id: threadId,
				reply_markup: {
					inline_keyboard: [
						[
							{
								text: "📱 Analyze Another Number",
								callback_data: "report_numbers",
							},
						],
						[{ text: "🔙 Menu", callback_data: "back_to_menu" }],
					],
				},
			});

			// Card Generation
			try {
				const vsFloorVal =
					typeof result.vsFloor === "number" ? result.vsFloor : 0;
				const cardData = {
					number: result.number,
					formattedNumber: result.formattedNumber,
					price: formatNumber(Math.round(result.estimatedValue)),
					verdict: result.rarityRank || result.verdict || "STANDARD",
					status: (result.status || "").toUpperCase(),
					floor: formatNumber(Math.round(result.floor || 0)),
					vsFloor: `${vsFloorVal >= 0 ? "+" : ""}${vsFloorVal.toFixed(0)}%`,
					pattern: result.patternLabel || result.pattern || "",
					confidence:
						result.confidence >= 80
							? "High"
							: result.confidence >= 50
								? "Medium"
								: "Low",
					rarityScore: result.rarityScore || 0,
					whaleStatus: result.ownerLabel || "Standard Holder",
				};

				let imageBuffer = await generateNumberFlexCard(cardData);
				if (!Buffer.isBuffer(imageBuffer))
					imageBuffer = Buffer.from(imageBuffer);

				if (imageBuffer && imageBuffer.length > 500) {
					await bot.telegram.sendPhoto(
						chatId,
						{ source: imageBuffer },
						{
							caption: formatMarkdownToHTML(`📱 *${result.formattedNumber}*`),
							parse_mode: "HTML",
							message_thread_id: threadId,
						},
					);
				}
			} catch (cardError) {
				console.error("Number Flex Card error:", cardError.message);
			}

			return { success: true, result };
		} catch (error) {
			await bot.telegram.sendMessage(
				chatId,
				`❌ Error generating number report: ${error.message}`,
				{
					reply_markup: {
						inline_keyboard: [
							[{ text: "🔄 Try Again", callback_data: "report_numbers" }],
							[{ text: "🔙 Menu", callback_data: "back_to_menu" }],
						],
					},
				},
			);
			throw error;
		}
	});

	// 4. USERNAME REPORT HANDLER
	jobQueue.registerHandler(JOB_TYPES.USERNAME_REPORT, async (job) => {
		const { chatId, data } = job;
		const { username, tonPrice } = data;

		try {
			// Immediate Feedback
			const statusMsg = await bot.telegram.sendMessage(chatId, `🔍 *Initializing analysis for @${escapeMD(username)}*...\n_Please wait while I scan the blockchain._`, { parse_mode: "Markdown" });
			
			await processUsernameReport(chatId, username, tonPrice, bot, job.userId);
			
			// Cleanup status message
			try { await bot.telegram.deleteMessage(chatId, statusMsg.message_id); } catch {}
			
			return { success: true };
		} catch (error) {
			console.error("Queue: Username report error:", error);
			await bot.telegram.sendMessage(
				chatId,
				`❌ Analysis error: ${error.message}`,
			);
			throw error;
		}
	});

	// 5. COMPARISON HANDLER
	jobQueue.registerHandler(JOB_TYPES.COMPARISON, async (job) => {
		const { chatId, data } = job;
		const { user1, user2 } = data;

		const config = await getDashboardConfig();
		let threadId = null;
		if (config?.features?.topics_enabled) {
			const ws = await ensurePersonalWorkspace(bot, chatId);
			if (ws) threadId = ws.compare; // SPECIFIC TOPIC: Compare Names
		}

		try {
			// Mocking ctx for the existing handler
			const ctx = {
				from: { id: job.userId },
				chat: { id: chatId },
				telegram: bot.telegram,
				reply: (t, o) => bot.telegram.sendMessage(chatId, t, { message_thread_id: threadId, ...o }),
				replyWithPhoto: (p, o) => bot.telegram.sendPhoto(chatId, p, { message_thread_id: threadId, ...o }),
				replyWithMarkdown: (t, o) => bot.telegram.sendMessage(chatId, t, { parse_mode: "Markdown", message_thread_id: threadId, ...o }),
			};
			await handleComparison(ctx, user1, user2);
			return { success: true };
		} catch (error) {
			console.error("Queue: Comparison error:", error);
			throw error;
		}
	});

	// 6. PORTFOLIO HANDLER
	jobQueue.registerHandler(JOB_TYPES.PORTFOLIO, async (job) => {
		const { chatId, data } = job;
		const { walletAddress } = data;

		const config = await getDashboardConfig();
		let threadId = null;
		if (config?.features?.topics_enabled) {
			const ws = await ensurePersonalWorkspace(bot, chatId);
			if (ws) threadId = ws.portfolio; // SPECIFIC TOPIC: Wallet Tracker
		}

		try {
			const ctx = {
				from: { id: job.userId },
				chat: { id: chatId },
				telegram: bot.telegram,
				reply: (t, o) => bot.telegram.sendMessage(chatId, t, { message_thread_id: threadId, ...o }),
				replyWithMarkdown: (t, o) => bot.telegram.sendMessage(chatId, t, { parse_mode: "Markdown", message_thread_id: threadId, ...o }),
			};
			await handlePortfolioByWallet(ctx, walletAddress);
			return { success: true };
		} catch (error) {
			console.error("Queue: Portfolio error:", error);
			throw error;
		}
	});

	console.log("✅ Job Queue handlers initialized");
}
