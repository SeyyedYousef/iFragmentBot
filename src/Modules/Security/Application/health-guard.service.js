/**
 * Health Guard Service v2
 * Protects accounts by calculating trust scores, dynamic limits, and anti-flood prediction.
 */

import { accounts } from "../../../database/panelDatabase.js";

// Configuration
const CONFIG = {
	BASE_SCORE: 50,
	BONUS: { USERNAME: 10, PHOTO: 10, BIO: 10, NAME: 10, PREMIUM: 20 },
	AGE_BONUS_PER_DAY: 1,
	MAX_AGE_BONUS: 30,
	LIMITS: {
		LOW: { SCORE: 40, LIMIT: 5 },
		MEDIUM: { SCORE: 70, LIMIT: 20 },
		HIGH: { SCORE: 100, LIMIT: 50 },
	},
	COOLDOWN: {
		JOIN_PER_HOUR: 3, // Safe joins per hour per account
		MSG_PER_MINUTE: 10,
		REST_TIME_MINUTES: 60,
	},
};

// In-memory action tracking
const actionTracker = new Map(); // phone -> { lastReset: timestamp, joins: count, messages: count }

/**
 * Calculate Trust Score for an account
 */
export function calculateTrustScore(account) {
	if (!account) return CONFIG.BASE_SCORE;
	let score = CONFIG.BASE_SCORE;
	if (account.username) score += CONFIG.BONUS.USERNAME;
	if (account.firstName && account.lastName) score += CONFIG.BONUS.NAME;
	if (account.addedAt) {
		const addedDate = new Date(account.addedAt);
		const daysOld = Math.floor(
			(Date.now() - addedDate.getTime()) / (1000 * 60 * 60 * 24),
		);
		score += Math.min(daysOld * CONFIG.AGE_BONUS_PER_DAY, CONFIG.MAX_AGE_BONUS);
	}
	return Math.min(score, 100);
}

/**
 * Get Daily Limit based on score
 */
export function getDailyLimit(accountOrPhone) {
	let account = accountOrPhone;
	if (typeof account === "string") {
		account = accounts.getAll().find((a) => a.phone === account);
	}
	if (!account) return CONFIG.LIMITS.LOW.LIMIT;
	const score = calculateTrustScore(account);
	if (score < CONFIG.LIMITS.LOW.SCORE) return CONFIG.LIMITS.LOW.LIMIT;
	if (score < CONFIG.LIMITS.MEDIUM.SCORE) return CONFIG.LIMITS.MEDIUM.LIMIT;
	return CONFIG.LIMITS.HIGH.LIMIT;
}

/**
 * Get Health Report for an account
 */
export function getHealthReport(accountOrPhone) {
	let account = accountOrPhone;
	if (typeof account === "string") {
		account = accounts.getAll().find((a) => a.phone === account);
	}
	if (!account) return null;

	const score = calculateTrustScore(account);
	let status = "🔴 پرخطر";
	if (score >= CONFIG.LIMITS.LOW.SCORE) status = "⚠️ متوسط";
	if (score >= CONFIG.LIMITS.MEDIUM.SCORE) status = "✅ امن";

	return {
		phone: account.phone,
		score,
		limit: getDailyLimit(account),
		status,
		age: account.addedAt
			? Math.floor(
					(Date.now() - new Date(account.addedAt).getTime()) /
						(1000 * 60 * 60 * 24),
				)
			: 0,
	};
}

/**
 * Record an action for an account
 */
export function recordAction(accountOrPhone, action = "message") {
	const phone =
		typeof accountOrPhone === "string" ? accountOrPhone : accountOrPhone?.phone;
	if (!phone) return;

	if (!actionTracker.has(phone)) {
		actionTracker.set(phone, { lastReset: Date.now(), joins: 0, messages: 0 });
	}

	const stats = actionTracker.get(phone);
	const now = Date.now();

	// Reset if cooldown passed
	if (now - stats.lastReset > CONFIG.COOLDOWN.REST_TIME_MINUTES * 60 * 1000) {
		stats.joins = 0;
		stats.messages = 0;
		stats.lastReset = now;
	}

	if (action === "join") stats.joins++;
	else stats.messages++;
}

/**
 * Check if account is exhausted for a type of action
 */
export function isExhausted(accountOrPhone, action = "message") {
	const phone =
		typeof accountOrPhone === "string" ? accountOrPhone : accountOrPhone?.phone;
	if (!phone) return false;

	if (!actionTracker.has(phone)) return false;

	const stats = actionTracker.get(phone);
	const now = Date.now();

	if (now - stats.lastReset > CONFIG.COOLDOWN.REST_TIME_MINUTES * 60 * 1000) {
		return false;
	}

	if (action === "join") {
		return stats.joins >= CONFIG.COOLDOWN.JOIN_PER_HOUR;
	}
	return stats.messages >= CONFIG.COOLDOWN.MSG_PER_MINUTE;
}

export default {
	calculateTrustScore,
	getDailyLimit,
	getHealthReport,
	recordAction,
	isExhausted,
};
