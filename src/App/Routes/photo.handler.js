/**
 * Global Photo Message Orchestrator
 * Refactored v18.0 — Performance & Clean Management
 */

import fetch from "node-fetch";
import { handleAccountFileMessage } from "../../Modules/User/Presentation/account.handler.js";
import { userStates } from "../../Shared/Infra/State/state.service.js";
import { isAdmin } from "../Helpers/bot-init.helper.js";

/**
 * Global photo routing entry point
 */
export async function handlePhotoMessage(ctx, bot) {
	const chatId = ctx.chat.id;
	const userId = ctx.from.id;
	const userState = userStates.get(chatId);

	if (!userState) return;

	// 1. Admin News Post Image (Portait or Full)
	const newsActions = ["frag_news_await_photo", "frag_news_2_await_photo"];
	if (newsActions.includes(userState.action) && isAdmin(userId)) {
		try {
			const photo = ctx.message.photo[ctx.message.photo.length - 1];
			const fileLink = await bot.telegram.getFileLink(photo.file_id);

			const response = await fetch(fileLink);
			const base64 = `data:image/jpeg;base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;

			const nextAction =
				userState.action === "frag_news_await_photo"
					? "frag_news_await_text"
					: "frag_news_2_await_text";
			userStates.set(chatId, {
				action: nextAction,
				image: base64,
				timestamp: Date.now(),
			});

			await ctx.reply(
				"✅ Image received!\n\nNow send the *Headline* text for the news card:",
				{ parse_mode: "Markdown" },
			);
		} catch (e) {
			console.error("❌ Photo error:", e.message);
			await ctx.reply(`❌ Download error: ${e.message}`);
		}
		return;
	}

	// 2. User Account / Session Files
	try {
		await handleAccountFileMessage(ctx, userState, bot);
	} catch (_e) {
		// Not for account manager
	}
}
