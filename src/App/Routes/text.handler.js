/**
 * Global Text Message Orchestrator
 * Refactored v18.0 — Performance & Clean Management
 */

import { handleFakePanelTextMessage } from "../../Modules/Admin/Presentation/fake-panel.handler.js";
import { parseGiftLink } from "../../Modules/Market/Application/marketapp.service.js";
import { handleAccountTextMessage } from "../../Modules/User/Presentation/account.handler.js";
import { handleLoginTextMessage } from "../../Modules/User/Presentation/login.handler.js";
import { userStates } from "../../Shared/Infra/State/state.service.js";
import { isAdmin } from "../Helpers/bot-init.helper.js";
import { handleAdminTextMessage } from "./admin.handler.js";
import { handleGroupCommand } from "./group.handler.js";
import { handleMenuTextMessage } from "./menu.handler.js";
import { handleOperationsTextMessage } from "./operations.handler.js";
import { handleSettingsTextMessage } from "./settings.handler.js";
import { GiftVariableService } from "../../Modules/Market/Application/gift-indexer.service.js";

/**
 * Global text routing entry point
 */
export async function routeTextMessage(ctx, next, bot, getTelegramClient) {
	try {
		console.log(`💬 Routing text from ${ctx.from.id}: ${ctx.message.text?.substring(0, 20)}`);
		const userId = ctx.from.id;
		const input = ctx.message.text ? ctx.message.text.trim() : "";
		if (!input || input.startsWith("/")) return next();

		const chatId = ctx.chat.id;
		const isPrivate = ctx.chat.type === "private";
		const state = userStates.get(chatId);

		// 1. Group Commands (!) - High Priority
		if (
			(ctx.chat.type === "group" || ctx.chat.type === "supergroup") &&
			input.startsWith("!")
		) {
			return handleGroupCommand(ctx, input, null, getTelegramClient);
		}

		// 2. State-Based Routing (Handles Multi-step Flows)
		if (state) {
			// Special Flow: Login (Admin Only)
			if (
				isAdmin(userId) &&
				(await handleLoginTextMessage(ctx, state, getTelegramClient))
			)
				return;

			// General Handlers (Dynamic Routing)
			if (await handleAdminTextMessage(ctx, state, bot, isAdmin)) return;
			if (await handleFakePanelTextMessage(ctx, state, bot, isAdmin)) return;
			if (await handleAccountTextMessage(ctx, state, bot)) return;
			if (await handleSettingsTextMessage(ctx, state, bot)) return;
			if (await handleOperationsTextMessage(ctx, state, bot)) return;
			if (
				await handleMenuTextMessage(ctx, state, bot, isAdmin, getTelegramClient)
			)
				return;
		}

		// 3. Smart Search (Private Only, No State)
		if (isPrivate && !state) {
			// Wallet Pattern
			if (
				input.length > 40 &&
				(input.startsWith("EQ") || input.startsWith("UQ"))
			) {
				return handleGroupCommand(
					ctx,
					`!wallet ${input}`,
					null,
					getTelegramClient,
				);
			}

			// Gift Link Pattern
			const giftAnalysis = await GiftVariableService.analyzeLink(input);
			if (giftAnalysis.isValid) {
				return handleGroupCommand(
					ctx,
					`!gift ${input}`,
					null,
					getTelegramClient,
				);
			}

			// Username Pattern
			if (/^[a-zA-Z0-9_]{4,32}$/.test(input.replace("@", ""))) {
				return handleGroupCommand(
					ctx,
					`!u ${input.replace("@", "")}`,
					null,
					getTelegramClient,
				);
			}
		}
	} catch (e) {
		console.error("❌ routeTextMessage error:", e);
		await ctx.reply("⚠️ Routing error occurred.").catch(() => {});
	}
}
