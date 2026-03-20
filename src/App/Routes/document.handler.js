import fetch from "node-fetch";
import * as g2g from "../../Modules/Automation/Application/group-to-group.service.js";
import { userStates } from "../../Shared/Infra/State/state.service.js";
import { isAdmin } from "../Helpers/bot-init.helper.js";

/**
 * Global Document message router
 */
export async function handleDocumentMessage(ctx, bot) {
	const chatId = ctx.chat?.id;
	if (!chatId) return;

	const userState = userStates.get(chatId);
	if (!userState) return;

	// 1. G2G CSV Import Handler
	if (
		userState.action === "g2g_awaiting_csv" &&
		ctx.message?.document &&
		isAdmin(ctx.from.id)
	) {
		try {
			const doc = ctx.message.document;
			const fileLink = await bot.telegram.getFileLink(doc.file_id);
			const response = await fetch(fileLink);
			const text = await response.text();

			userStates.delete(chatId);
			const loadingMsg = await ctx.reply("🔄 Importing usernames from CSV...");

			const result = await g2g.importFromCSV(text);

			await ctx.telegram.editMessageText(
				chatId,
				loadingMsg.message_id,
				undefined,
				result.success
					? `✅ *Imported:* ${result.imported} usernames!`
					: `❌ *Error:* ${result.error}`,
				{
					parse_mode: "Markdown",
					reply_markup: {
						inline_keyboard: [
							[{ text: "🔙 Back", callback_data: "admin_g2g_menu" }],
						],
					},
				},
			);
		} catch (e) {
			console.error("Document Error (G2G):", e.message);
			await ctx.reply(`❌ CSV parsing failed: ${e.message}`);
		}
		return;
	}
}
