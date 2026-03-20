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

		const config = await getDashboardConfig();
		const templates = await getTemplates();
		const globalVars = await fetchUserVariables(job.userId, bot);
		let threadId = null;
		if (config?.features?.topics_enabled) {
			const ws = await ensurePersonalWorkspace(bot, chatId);
			if (ws) threadId = ws.gifts; // SPECIFIC TOPIC: Gifts Report
		}

		try {
			const result = await generateGiftReport(link, tonPrice);

			// CMS Template Rendering
			const finalCaption = renderTemplate(templates.gifts || result.report, {
				...globalVars,
				collection: result.collection,
				number: String(result.itemNumber),
				verdict: result.verdict,
				price_ton: String(result.estimatedValue),
				price_usd: String(Math.round(result.estimatedValue * tonPrice)),
				color: result.color || "",
				slug: result.slug || "",
				badges: (result.badges || []).join(", ")
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

		const config = await getDashboardConfig();
		const templates = await getTemplates();
		const globalVars = await fetchUserVariables(job.userId, bot);
		let threadId = null;
		if (config?.features?.topics_enabled) {
			const ws = await ensurePersonalWorkspace(bot, chatId);
			if (ws) threadId = ws.numbers; // SPECIFIC TOPIC: +888 Report
		}

		try {
			const result = await generateNumberReport(input, tonPrice);

			// CMS Template Rendering
			const finalCaption = renderTemplate(templates.numbers || result.report, {
				...globalVars,
				number: result.number,
				formatted_number: result.formattedNumber,
				price_ton: String(result.priceTon),
				estimated_value: String(result.estimatedValue),
				floor_ton: String(result.floor),
				vs_floor: String(Math.round(result.vsFloor)),
				status: result.status,
				pattern: result.pattern,
				pattern_label: result.patternLabel,
				owner: result.owner || "",
				url: result.url || "",
				confidence: String(result.confidence),
				rarity_score: String(result.rarityScore),
				rarity_rank: result.rarityRank,
				owner_label: result.ownerLabel,
				other_numbers: String(result.otherNumbersCount || 0)
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
			await processUsernameReport(chatId, username, tonPrice, bot);
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
