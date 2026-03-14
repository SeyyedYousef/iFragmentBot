/**
 * Cache Helper Module
 * Username report caching and gift hourly rate limiting.
 * Extracted from bot.entry.js to reduce monolith size.
 */

// ==================== USERNAME REPORT CACHE ====================
const usernameReportCache = new Map(); // username -> { data, timestamp }
const REPORT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Get cached username report if available
 */
export function getCachedReport(username) {
	const key = username.toLowerCase();
	const cached = usernameReportCache.get(key);

	if (cached && Date.now() - cached.timestamp < REPORT_CACHE_DURATION) {
		console.log(`📦 Cache HIT for @${username}`);
		return cached.data;
	}

	// Clean up expired entry
	if (cached) {
		usernameReportCache.delete(key);
	}

	return null;
}

/**
 * Cache username report result
 */
export function setCachedReport(username, data) {
	const key = username.toLowerCase();
	usernameReportCache.set(key, {
		data,
		timestamp: Date.now(),
	});

	// Limit cache size to 500 entries
	if (usernameReportCache.size > 500) {
		const entries = Array.from(usernameReportCache.entries());
		entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
		entries.slice(0, 100).forEach(([k]) => usernameReportCache.delete(k));
	}

	console.log(
		`💾 Cached report for @${username} (Total: ${usernameReportCache.size})`,
	);
}

/**
 * Get cache statistics
 */
export function getReportCacheStats() {
	return {
		size: usernameReportCache.size,
		maxSize: 500,
		cacheDurationMinutes: REPORT_CACHE_DURATION / 60000,
	};
}

/**
 * Clear the entire report cache
 */
export function clearAllReportCache() {
	const clearedCount = usernameReportCache.size;
	usernameReportCache.clear();
	console.log(`🧹 Cache cleared manually! Removed ${clearedCount} items.`);
	return clearedCount;
}

// ==================== GIFT HOURLY RATE LIMITER ====================
const giftHourlyLimiter = new Map(); // userId -> { count, resetTime }
const GIFT_HOURLY_LIMIT = 3;
const GIFT_HOUR_MS = 60 * 60 * 1000; // 1 hour

export { GIFT_HOURLY_LIMIT };

/**
 * Check if user can make another gift request this hour
 */
export function checkGiftHourlyLimit(userId) {
	const now = Date.now();
	const id = String(userId);

	if (!giftHourlyLimiter.has(id)) {
		giftHourlyLimiter.set(id, { count: 0, resetTime: now + GIFT_HOUR_MS });
	}

	const limiter = giftHourlyLimiter.get(id);

	// Reset if hour has passed
	if (now >= limiter.resetTime) {
		limiter.count = 0;
		limiter.resetTime = now + GIFT_HOUR_MS;
	}

	if (limiter.count >= GIFT_HOURLY_LIMIT) {
		const waitMs = limiter.resetTime - now;
		const waitMinutes = Math.ceil(waitMs / 60000);
		return { allowed: false, waitMinutes };
	}

	return { allowed: true };
}

/**
 * Record a gift hourly usage
 */
export function useGiftHourlyLimit(userId) {
	const id = String(userId);
	const limiter = giftHourlyLimiter.get(id);
	if (limiter) {
		limiter.count++;
	}
}
