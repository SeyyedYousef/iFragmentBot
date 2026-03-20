// ==================== STATS & SYSTEM ====================

export function getAdminStatsMessage(stats) {
	return `📊 *Detailed Statistics*\n\n👥 *Users:*\n• Total: ${stats.totalUsers}\n• Active: ${stats.totalUsers - stats.blockedUsers}\n• Blocked: ${stats.blockedUsers} 🚫\n\n⏰ _Updated: ${new Date().toLocaleString()}_`.trim();
}

export function getSystemPerformanceMessage(limiter, cache, state, pool) {
	return `🔧 *System Performance*\n\n🏊 *Browser Pool:*\n• Active: ${pool.borrowed}/${pool.max}\n• Available: ${pool.available}\n• Pending: ${pool.pending}\n\n🚦 *Rate Limiter:*\n• Global: ${limiter.global.running} active, ${limiter.global.queued} queued\n• Fragment: ${limiter.fragment.running} active, ${limiter.fragment.queued} queued\n• User limiters: ${limiter.userLimitersCount}\n\n📦 *Caches:*\n• Fragment: ${cache.fragment.size} entries (${cache.fragment.hitRate} hit)\n• Portfolio: ${cache.portfolio.size} entries\n• TON Price: ${cache.tonPrice.size} entries\n\n🧠 *State Manager:*\n• Active states: ${state.size}/${state.maxSize}\n• Utilization: ${state.utilization}\n\n⏰ _Updated: ${new Date().toLocaleString()}_`.trim();
}

// ==================== PROMPTS ====================

export function getBroadcastPrompt() {
	return `📢 *Broadcast Message*\n\nSend the message you want to broadcast to all users.\n\n_Supports Markdown formatting._\n\nType /cancel to cancel.`.trim();
}

export function getBlockUserPrompt() {
	return `🚫 *Block User*\n\nSend the user ID to block.\n\n_Example: 123456789_\n\nType /cancel to cancel.`.trim();
}

export function getUnblockUserPrompt() {
	return `✅ *Unblock User*\n\nSend the user ID to unblock.\n\n_Example: 123456789_\n\nType /cancel to cancel.`.trim();
}

export function getEditSponsorPrompt(current) {
	return `✏️ *Edit Sponsor Text*\n\nCurrent sponsor text:\n━━━━━━━━━━━━━━━━\n${current}\n━━━━━━━━━━━━━━━━\n\n*Send the new sponsor text below.*\n_You can use Markdown formatting._\n\nType /cancel to cancel.`.trim();
}

export function getNewsPostPrompt(type) {
	const desc =
		type === 2 ? "FULL without any cropping." : "square or portrait image.";
	return `🖼️ *News Post ${type}*\n\nFirst, send the *image* you want to use.\n_Image will be displayed in ${desc}_\n\nType /cancel to cancel.`.trim();
}
