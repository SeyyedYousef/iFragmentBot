/**
 * Alert Engine — Lightweight in-memory alert system
 * Stores per-user alerts and checks them on background intervals
 * Render-safe: no extra DB, uses Map() with auto-cleanup
 */
import { getTemplates } from "../../../Shared/Infra/Database/settings.repository.js";
import { renderTemplate } from "../../../Shared/Infra/Telegram/telegram.cms.js";

// In-memory alert storage (userId -> Set of alerts)
const userAlerts = new Map();

// Alert types
export const ALERT_TYPES = {
	USERNAME_PRICE: "username_price",    // When a username drops below X TON
	NUMBER_PRICE: "number_price",        // When a +888 number drops below X TON
	STARS_RATE: "stars_rate",            // When Stars per-TON rate changes
	NEW_LISTING: "new_listing",          // When new auctions appear
	AUCTION_ENDING: "auction_ending",    // When an auction has < 1h left
};

/**
 * Add an alert for a user
 */
export function addAlert(userId, alert) {
	const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
	const fullAlert = {
		id,
		userId,
		type: alert.type,
		target: alert.target || null,     // e.g. username or number
		threshold: alert.threshold || 0,  // price threshold
		createdAt: Date.now(),
		triggered: false,
	};

	if (!userAlerts.has(userId)) userAlerts.set(userId, new Map());
	const alerts = userAlerts.get(userId);

	// Max 10 alerts per user (Render memory constraint)
	if (alerts.size >= 10) {
		return { success: false, reason: "Max 10 alerts reached" };
	}

	alerts.set(id, fullAlert);
	console.log(`🔔 Alert added: ${fullAlert.type} for user ${userId}`);
	return { success: true, alert: fullAlert };
}

/**
 * Remove an alert
 */
export function removeAlert(userId, alertId) {
	const alerts = userAlerts.get(userId);
	if (!alerts) return false;
	return alerts.delete(alertId);
}

/**
 * Get all alerts for a user
 */
export function getUserAlerts(userId) {
	const alerts = userAlerts.get(userId);
	if (!alerts) return [];
	return [...alerts.values()].filter(a => !a.triggered);
}

/**
 * Get all alerts of a specific type (for background checker)
 */
export function getAlertsByType(type) {
	const results = [];
	for (const [userId, alerts] of userAlerts) {
		for (const [, alert] of alerts) {
			if (alert.type === type && !alert.triggered) {
				results.push(alert);
			}
		}
	}
	return results;
}

/**
 * Mark alert as triggered
 */
export function triggerAlert(alertId, userId) {
	const alerts = userAlerts.get(userId);
	if (!alerts) return;
	const alert = alerts.get(alertId);
	if (alert) alert.triggered = true;
}

/**
 * Cleanup old / triggered alerts (run periodically)
 */
export function cleanupAlerts() {
	const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
	const now = Date.now();
	let cleaned = 0;

	for (const [userId, alerts] of userAlerts) {
		for (const [id, alert] of alerts) {
			if (alert.triggered || now - alert.createdAt > MAX_AGE) {
				alerts.delete(id);
				cleaned++;
			}
		}
		if (alerts.size === 0) userAlerts.delete(userId);
	}

	if (cleaned > 0) console.log(`🧹 Cleaned ${cleaned} expired alerts`);
}

/**
 * Get alert stats
 */
export function getAlertStats() {
	let total = 0;
	let active = 0;
	for (const [, alerts] of userAlerts) {
		for (const [, alert] of alerts) {
			total++;
			if (!alert.triggered) active++;
		}
	}
	return { total, active, users: userAlerts.size };
}

/**
 * Process all active alerts
 */
export async function processAlerts(bot, marketData) {
	const templates = await getTemplates();
	const alertTemplate = templates.alert_triggered || "🔔 <b>Alert: {TARGET}</b> reached {PRICE} TON!";

	const { tonPrice, price888 } = marketData;

	for (const [userId, alerts] of userAlerts) {
		for (const [id, alert] of alerts) {
			if (alert.triggered) continue;

			let isTriggered = false;
			let currentPrice = 0;

			if (alert.type === ALERT_TYPES.NUMBER_PRICE && price888) {
				if (price888 <= alert.threshold) {
					isTriggered = true;
					currentPrice = price888;
				}
			}

			if (isTriggered) {
				alert.triggered = true;
				console.log(`🔔 Triggering alert ${id} for user ${userId}`);

				const msg = renderTemplate(alertTemplate, {
					TARGET: alert.target || "Market Item",
					PRICE: String(currentPrice),
					THRESHOLD: String(alert.threshold),
					TON_USD: String(tonPrice.toFixed(2))
				});

				bot.telegram.sendMessage(userId, msg, { parse_mode: "HTML" }).catch(e => {
					console.error(`❌ Failed to send alert to ${userId}:`, e.message);
				});
			}
		}
	}
}

// Auto-cleanup every 30 minutes
setInterval(cleanupAlerts, 30 * 60 * 1000);
