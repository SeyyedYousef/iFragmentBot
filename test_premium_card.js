import fs from "node:fs";
import { generateNumberFlexCard } from "./src/Modules/Admin/Application/number-flex-card.service.js";
import { closeBrowser } from "./src/Shared/UI/Components/card-generator.component.js";

async function test() {
	const cardData = {
		number: "+88812344321",
		formattedNumber: "+888 1234 4321",
		price: "12,500",
		verdict: "GRAIL",
		status: "FOR SALE",
		floor: "850",
		vsFloor: "+1,470%",
		pattern: "Palindrome",
		confidence: "High",
	};

	console.log("Generating test card...");
	try {
		const buffer = await generateNumberFlexCard(cardData);
		fs.writeFileSync("premium_number_card_test.png", buffer);
		console.log("✅ Test card saved to premium_number_card_test.png");
	} catch (e) {
		console.error("❌ Test failed:", e);
	} finally {
		await closeBrowser();
	}
}

test();
