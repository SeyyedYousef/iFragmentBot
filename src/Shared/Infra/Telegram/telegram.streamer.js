/**
 * Telegram Streamer - Progressive Message Updates (v9.5 Supreme Style)
 */

/**
 * Stream a message update to Telegram
 * Uses high-performance edits to simulate streaming.
 * @param {object} bot - Telegraf instance
 * @param {number|string} chatId - Chat ID
 * @param {number} messageId - Message to update
 * @param {string} fullText - The total text generated so far
 * @param {object} options - Extra options (parse_mode, reply_markup)
 */
export async function updateStream(bot, chatId, messageId, fullText, options = {}) {
	try {
		await bot.telegram.editMessageText(chatId, messageId, null, fullText, {
			parse_mode: "HTML",
			...options,
		});
	} catch (e) {
		// Ignore "message is not modified" errors which are common in streaming
		if (!e.message.includes("not modified")) {
			console.error("Stream update error:", e.message);
		}
	}
}

/**
 * A throttled version of the streamer to avoid hitting Telegram Rate Limits
 */
export class MessageStreamer {
	constructor(bot, chatId, messageId, options = {}) {
		this.bot = bot;
		this.chatId = chatId;
		this.messageId = messageId;
		this.options = options;
		this.lastUpdate = 0;
		this.minInterval = 1200; // 1.2s to be safe with rate limits
		this.pendingText = "";
		this.isFinished = false;
	}

	async push(text) {
		this.pendingText = text;
		const now = Date.now();
		if (now - this.lastUpdate > this.minInterval) {
			await this.flush();
		}
	}

	async flush() {
		if (this.isFinished || !this.pendingText) return;
		this.lastUpdate = Date.now();
		await updateStream(this.bot, this.chatId, this.messageId, this.pendingText, this.options);
	}

	async finish(finalText = null) {
		this.isFinished = true;
		const text = finalText || this.pendingText;
		await updateStream(this.bot, this.chatId, this.messageId, text, this.options);
	}
}
