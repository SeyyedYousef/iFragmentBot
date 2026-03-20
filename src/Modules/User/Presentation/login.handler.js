/**
 * Telegram Login Flow Handler
 * Handles multi-step login for bot accounts (MTProto)
 */

import { userStates } from "../../../Shared/Infra/State/state.service.js";

/**
 * Handle login-related text messages
 */
export async function handleLoginTextMessage(ctx, state, getTelegramClient) {
	const chatId = ctx.chat.id;
	const input = ctx.message.text.trim();

	// 1. Awaiting Phone
	if (state.action === "awaiting_phone") {
		const phonePattern = /^\+?\d{10,15}$/;
		if (!phonePattern.test(input)) return false;

		userStates.set(chatId, { action: "phone_processing", phone: input });
		const msg = await ctx.reply("📱 Sending verification code...");
		try {
			const tc = await getTelegramClient();
			const result = tc
				? await tc.startLogin(input)
				: { success: false, error: "Client unavailable" };

			if (result.success) {
				userStates.set(chatId, { action: "awaiting_code", phone: input });
				await ctx.telegram.editMessageText(
					chatId,
					msg.message_id,
					null,
					"✅ Code sent!\n\n🔐 Please enter the verification code:",
					{
						reply_markup: {
							inline_keyboard: [
								[
									{
										text: "🔄 Resend Code",
										callback_data: "panel_resend_code",
									},
								],
								[{ text: "❌ Cancel", callback_data: "panel_cancel_login" }],
							],
						},
					},
				);
			} else {
				userStates.delete(chatId);
				await ctx.telegram.editMessageText(
					chatId,
					msg.message_id,
					null,
					`❌ Login failed: ${result.error}`,
				);
			}
		} catch (e) {
			userStates.delete(chatId);
			await ctx.reply(`❌ Error: ${e.message}`);
		}
		return true;
	}

	// 2. Awaiting Code
	if (state.action === "awaiting_code") {
		const tc = await getTelegramClient();
		const res = tc ? await tc.submitCode(input) : { success: false };
		if (res.success) {
			userStates.delete(chatId);
			await ctx.reply(`✅ *Connected:* ${res.user.firstName}`, {
				parse_mode: "Markdown",
			});
		} else if (res.needs2FA) {
			userStates.set(chatId, { action: "awaiting_2fa" });
			await ctx.reply("🔐 2FA Required! Enter password:");
		} else {
			await ctx.reply(`❌ Failed: ${res.error}`);
		}
		return true;
	}

	// 3. Awaiting 2FA
	if (state.action === "awaiting_2fa") {
		const tc = await getTelegramClient();
		const res = tc ? await tc.submit2FA(input) : { success: false };
		if (res.success) {
			userStates.delete(chatId);
			await ctx.reply("✅ Connected!");
		} else {
			await ctx.reply(`❌ 2FA Error: ${res.error}`);
		}
		return true;
	}

	return false;
}
