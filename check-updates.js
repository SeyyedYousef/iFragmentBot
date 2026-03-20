import { Telegraf } from "telegraf";

async function checkUpdates() {
	const token = "6108683141:AAEohrJLcf0gqwzA06PtnRsfUseeFQSH_44";
	const bot = new Telegraf(token);
	try {
		const updates = await bot.telegram.getUpdates(100, 10, -1, []);
		console.log(`Found ${updates.length} pending updates.`);
		for (const u of updates) {
			console.log(`Update ${u.update_id}: type ${Object.keys(u).find(k => k !== 'update_id')}`);
			if (u.message) console.log(`Text: ${u.message.text}`);
		}
	} catch (e) {
		console.log("Error:", e.message);
	}
}

checkUpdates();
