import { CONFIG } from "../../../core/Config/app.config.js";

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Animate loading messages by editing a message
 * @param {Object} ctx - Telegraf context
 * @param {Object} statusMessage - The message object to edit
 * @param {Function} processTask - The async task to run during animation
 * @returns {Promise<any>} - Result of the process task
 */
export async function animateLoading(ctx, statusMessage, processTask) {
	const messages = CONFIG.LOADING_MESSAGES || [];
	let currentIndex = 0;
	let isProcessing = true;
	let result = null;
	let error = null;
	let lastMessage = "";

	// Start the processing task
	const processPromise = processTask()
		.then((res) => {
			result = res;
			isProcessing = false;
		})
		.catch((err) => {
			error = err;
			isProcessing = false;
		});

	// Animate while processing - only go through messages once (no loop)
	while (isProcessing && currentIndex < messages.length) {
		const newMessage = messages[currentIndex];

		// Only edit if message is different
		if (newMessage !== lastMessage) {
			try {
				await ctx.telegram.editMessageText(
					ctx.chat.id,
					statusMessage.message_id,
					null,
					newMessage,
					{ parse_mode: "Markdown" },
				);
				lastMessage = newMessage;
			} catch (_editError) {
				// Ignore edit errors silently
			}
		}

		currentIndex++;
		await sleep(CONFIG.ANIMATION_DELAY);
	}

	// Wait for process to complete if still running
	await processPromise;

	if (error) {
		throw error;
	}

	return result;
}
