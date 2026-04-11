/**
 * Global Error Handling Service
 * Prevents silent crashes and handles user notification
 */

export const ErrorHandler = {
	/**
	 * Log error with context and severity
	 */
	log(error, context = "Global", level = "error") {
		const message = error.message || error;
		const stack = error.stack || "";

		const timestamp = new Date().toISOString();
		const logLine = `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;

		if (level === "error") {
			console.error(logLine);
			if (stack) console.error(stack.split("\n").slice(0, 3).join("\n"));
		} else {
			console.warn(logLine);
		}
	},

	/**
	 * Safe Catch for Telegraf Handlers
	 */
	handleBotError(err, ctx) {
		const msg = err.message || "";

		// 1. Silent Errors (Common Telegram API side-effects)
		const silentErrors = [
			"query is too old",
			"message is not modified",
			"bot was blocked",
			"message to edit not found",
			"chat not found",
			"user is not a member of the guild",
		];

		if (silentErrors.some((s) => msg.toLowerCase().includes(s))) return;

		// 2. Log important errors
		this.log(err, `Telegraf[${ctx.updateType}]`);

		// 3. User feedback for failures
		try {
			if (ctx.callbackQuery) {
				ctx
					.answerCbQuery("⚠️ System Congestion. Retrying...")
					.catch(() => {});
			}

			const friendlyMsg =
				`✦ <b>Premium System Status</b>\n` +
				`━━━━━━━━━━━━━━━━━━━━\n\n` +
				`⚠️ <b>Temporary Interruption</b>\n` +
				`An unexpected technical anomaly occurred while processing your request.\n\n` +
				`<i>Our engineering team has been dispatched. Please return to the menu and try again in a moment.</i>`;
			
			ctx.reply(friendlyMsg, { 
				parse_mode: "HTML",
				reply_markup: {
					inline_keyboard: [
						[{ text: "🔙 Return Home", callback_data: "back_to_menu" }]
					]
				}
			}).catch(() => {});
		} catch (_e) {
			// Deep fail
		}
	},

	/**
	 * Wrap an async function with error handling
	 */
	wrap(fn, context = "Async") {
		return async (...args) => {
			try {
				return await fn(...args);
			} catch (error) {
				this.log(error, context);
				throw error;
			}
		};
	},
};
