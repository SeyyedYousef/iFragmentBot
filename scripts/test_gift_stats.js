import fs from "node:fs";
import {
	get888Stats,
	getGiftStats,
	getTonPrice,
} from "../src/Modules/Market/Application/market.service.js";
import { generateMarketCard } from "../src/Shared/UI/Components/card-generator.component.js";

async function testGiftStats() {
	console.log("🧪 Testing Market Stats...");
	const start = Date.now();

	// Fetch all real data
	const [gifts, price888, tonPrice] = await Promise.all([
		getGiftStats(),
		get888Stats(),
		getTonPrice(),
	]);

	const duration = (Date.now() - start) / 1000;
	console.log(`⏱️ Duration: ${duration.toFixed(2)}s`);
	console.log(`💎 888 Price: ${price888} TON`);
	console.log(`💸 TON Price: $${tonPrice}`);
	console.log("🎁 Gifts:", Object.keys(gifts).join(", "));

	console.log("🖼️ Generating Market Card...");
	try {
		const cardBuffer = await generateMarketCard({
			gifts: gifts,
			tonPrice: tonPrice || 5.5, // Fallback for card gen safety
			price888: price888 || 100,
		});

		fs.writeFileSync("market_card_test.png", cardBuffer);
		console.log("✅ Card saved to market_card_test.png");
	} catch (e) {
		console.error("❌ Card generation failed:", e);
	}
}

testGiftStats();
