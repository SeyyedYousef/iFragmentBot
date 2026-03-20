/**
 * Telegram Topics Manager (v9.4+ Personal Workspace)
 */

export const TOPIC_NAMES = {
	PULSE: "📊 Market Pulse",
	USERNAMES: "💎 Usernames Report",
	NUMBERS: "📱 +888 Report",
	GIFTS: "🎁 Gifts Report",
	COMPARE: "⚔️ Compare Names",
	PORTFOLIO: "💼 Wallet Tracker",
	SUPPORT: "🆘 Help & Support"
};

/**
 * Ensure the current chat is a forum and topics are created
 * @param {object} bot - Telegraf instance
 * @param {number|string} chatId - User's private chat ID
 * @returns {object} Map of topic keys to thread IDs
 */
export async function ensurePersonalWorkspace(bot, chatId) {
	try {
		const chat = await bot.telegram.getChat(chatId);
		
		if (!chat.is_forum) {
			try {
				await bot.telegram.setChatForum(chatId, true);
			} catch (e) {
				return null;
			}
		}

		// Initialize workspace object
		const workspace = {};
		
		// Create/Resolve all topics
		const tasks = Object.entries(TOPIC_NAMES).map(async ([key, name]) => {
			workspace[key.toLowerCase()] = await getOrCreateTopic(bot, chatId, name);
		});

		await Promise.all(tasks);
		return workspace;
	} catch (error) {
		console.error("Workspace Error:", error.message);
		return null;
	}
}

async function getOrCreateTopic(bot, chatId, name) {
	try {
		const topic = await bot.telegram.createForumTopic(chatId, name);
		return topic.message_thread_id;
	} catch (e) {
		return null;
	}
}
