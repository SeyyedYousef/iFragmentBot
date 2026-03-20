import * as cardGenerator from "../../../Shared/UI/Components/card-generator.component.js";
import * as marketService from "./market.service.js";

/**
 * Generate and send market statistics report
 */
export async function sendMarketStatsReport(ctx, loadingMsg) {
	try {
		console.log("📊 Market Stats: Starting data fetch...");
		// 90s Timeout Race
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error("Data fetch timed out (90s)")), 90000),
		);

		// Fetch stats with parallelism
		const [tonPrice, giftsData, price888] = await Promise.race([
			Promise.all([
				marketService.getTonPrice().catch(() => 6.5), // Use current fallback from config
				marketService.getGiftStats().catch(() => ({})),
				marketService.get888Stats().catch(() => 1800),
			]),
			timeoutPromise,
		]);

		const safeTonPrice = tonPrice && tonPrice > 0 ? tonPrice : 6.5;
		const safeGiftsData = giftsData || {};
		const giftCount = Object.keys(safeGiftsData).length;

		console.log(
			`✅ Data fetch done. TON: $${safeTonPrice}, Gifts: ${giftCount}, 888: ${price888}`,
		);

		if (giftCount === 0) {
			throw new Error("No gift data found.");
		}

		await ctx.telegram
			.editMessageText(
				ctx.chat.id,
				loadingMsg.message_id,
				undefined,
				"🎨 Generating Market Card...",
			)
			.catch(() => {});

		// Generate Card
		console.log("🎨 Generating Market Card buffer...");
		const cardBuffer = await cardGenerator.generateMarketCard({
			gifts: safeGiftsData,
			tonPrice: safeTonPrice,
			price888: price888 || 0,
		});

		if (!cardBuffer || cardBuffer.length < 100) {
			throw new Error("Card generation returned empty buffer");
		}
		console.log(`✅ Card generated. Buffer size: ${cardBuffer.length}`);

		// Cleanup loading message
		await ctx.telegram
			.deleteMessage(ctx.chat.id, loadingMsg.message_id)
			.catch(() => {});

		// Send final report
		await ctx.replyWithPhoto(
			{ source: Buffer.from(cardBuffer) },
			{
				caption: `📊 *Market Stats Report*\n\n💎 TON: $${safeTonPrice.toFixed(2)}\n🎁 Gifts: ${giftCount} tracked\n🔢 +888 Floor: ${price888 ? `${price888.toLocaleString()} TON` : "N/A"}`,
				parse_mode: "Markdown",
			},
		);
	} catch (e) {
		console.error("Market Stats Error:", e);
		await ctx.telegram
			.editMessageText(
				ctx.chat.id,
				loadingMsg.message_id,
				undefined,
				`❌ Error: ${e.message}`,
			)
			.catch(() => {});
	}
}
