/**
 * Report System Service
 * Handles account reporting, rest management, and health monitoring
 */

import { accountStatus, settings } from "../../../database/panelDatabase.js";
import * as accountManager from "../../User/Application/account-manager.service.js";

// ==================== STATUS MANAGEMENT ====================

/**
 * Get account status
 */
export async function getAccountStatus(phone) {
	return (
		await accountStatus.get(phone) || {
			phone,
			is_reported: false,
			is_resting: false,
			rest_until: null,
			report_count: 0,
		}
	);
}

/**
 * Mark account as reported
 */
export async function markAsReported(phone) {
	await accountStatus.markReported(phone);
}

/**
 * Mark account as resting
 */
export async function markAsResting(phone, minutes = null) {
	const restTime = minutes || await settings.get("rest_time", 30);
	await accountStatus.markResting(phone, restTime);
}

/**
 * Clear rest status for an account
 */
export async function clearRest(phone) {
	await accountStatus.clearRest(phone);
}

/**
 * Clear rest for all accounts
 */
export async function clearAllRest() {
	await accountStatus.clearAllRest();
}

/**
 * Delete account status
 */
export async function deleteAccountStatus(phone) {
	await accountStatus.delete(phone);
}

// ==================== QUERIES ====================

/**
 * Get all reported accounts
 */
export async function getReportedAccounts() {
	return await accountStatus.getReported();
}

/**
 * Get all resting accounts
 */
export async function getRestingAccounts() {
	return await accountStatus.getResting();
}

/**
 * Get all healthy accounts
 */
export async function getHealthyAccounts() {
	return await accountStatus.getHealthy();
}

/**
 * Get all account statuses
 */
export async function getAllAccountStatuses() {
	return await accountStatus.getAll();
}

/**
 * Get statistics
 */
export async function getStats() {
	return await accountStatus.getStats();
}

// ==================== HEALTH CHECK ====================

/**
 * Check if an account is healthy (not reported, not resting)
 */
export async function isAccountHealthy(phone) {
	const status = await getAccountStatus(phone);

	if (status.is_reported) return false;

	if (status.is_resting) {
		const restUntil = new Date(status.rest_until);
		if (restUntil > new Date()) {
			return false;
		}
		// Rest time passed, clear it
		await clearRest(phone);
	}

	return true;
}

/**
 * Get next available account (healthy and not resting)
 */
export async function getNextAvailableAccount() {
	const accounts = accountManager.getAccountList();

	for (const account of accounts) {
		if (account.status !== "active") continue;
		if (await isAccountHealthy(account.phone)) {
			return account;
		}
	}

	return null;
}

/**
 * Get all available accounts
 */
export async function getAvailableAccounts() {
	const accounts = accountManager.getAccountList();
    const results = [];
    for (const acc of accounts) {
        if (acc.status === "active" && (await isAccountHealthy(acc.phone))) {
            results.push(acc);
        }
    }
	return results;
}

// ==================== AUTOMATIC DETECTION ====================

/**
 * Detect and mark reported accounts based on error
 */
export async function detectAndMarkReported(phone, error) {
	const message = error.message?.toLowerCase() || "";

	const reportPatterns = [
		"banned",
		"restricted",
		"spam",
		"too many requests",
		"flood",
		"deactivated",
		"deleted",
	];

	const isReported = reportPatterns.some((p) => message.includes(p));

	if (isReported) {
		await markAsReported(phone);
		return true;
	}

	// Check for temporary limits (need rest)
	const restPatterns = ["too many", "wait", "try again later", "seconds"];

	const needsRest = restPatterns.some((p) => message.includes(p));

	if (needsRest) {
		await markAsResting(phone);
		return true;
	}

	return false;
}

// ==================== CLEANUP ====================

/**
 * Remove all reported accounts from the system
 */
export async function removeReportedAccounts() {
	const reported = await getReportedAccounts();
	const results = { removed: 0, failed: 0 };

	for (const acc of reported) {
		try {
			// Note: ensure removeAccount expects to be awaited in its actual usage layer
			await accountManager.removeAccount(acc.phone);
			await deleteAccountStatus(acc.phone);
			results.removed++;
		} catch (_error) {
			results.failed++;
		}
	}

	return results;
}

/**
 * Check and clear expired rest times
 */
export async function clearExpiredRests() {
	const resting = await getRestingAccounts();
	const now = new Date();
	let cleared = 0;

	for (const acc of resting) {
		if (acc.rest_until) {
			const restUntil = new Date(acc.rest_until);
			if (restUntil <= now) {
				await clearRest(acc.phone);
				cleared++;
			}
		}
	}

	return cleared;
}

// ==================== FOLDER MANAGEMENT ====================

/**
 * Set account folder
 */
export async function setAccountFolder(phone, folder) {
	const current = await getAccountStatus(phone);
	await accountStatus.set(phone, { ...current, folder });
}

/**
 * Get accounts by folder
 */
export async function getAccountsByFolder(folder) {
	const all = await getAllAccountStatuses();
	return all.filter((acc) => acc.folder === folder);
}

/**
 * Get available folders
 */
export async function getFolders() {
	const all = await getAllAccountStatuses();
	const folders = new Set(all.map((acc) => acc.folder || "default"));
	return Array.from(folders);
}

// ==================== REPORT GENERATION ====================

/**
 * Generate a detailed status report
 */
export async function generateStatusReport() {
	const stats = await getStats();
	const reported = await getReportedAccounts();
	const resting = await getRestingAccounts();
	const _healthy = await getHealthyAccounts();

	let report = `📊 *گزارش وضعیت اکانت‌ها*\n\n`;
	report += `📈 *آمار کلی:*\n`;
	report += `• کل: \`${stats.total || 0}\`\n`;
	report += `• 🟢 سالم: \`${stats.healthy || 0}\`\n`;
	report += `• 🟡 در استراحت: \`${stats.resting || 0}\`\n`;
	report += `• 🔴 ریپورت شده: \`${stats.reported || 0}\`\n\n`;

	if (resting.length > 0) {
		report += `⏳ *اکانت‌های در استراحت:*\n`;
		const now = new Date();
		resting.slice(0, 5).forEach((acc) => {
			const restUntil = new Date(acc.rest_until);
			const remaining = Math.max(0, Math.ceil((restUntil - now) / 60000));
			report += `• \`${acc.phone}\` - ${remaining} دقیقه باقی‌مانده\n`;
		});
		if (resting.length > 5) {
			report += `_و ${resting.length - 5} مورد دیگر..._\n`;
		}
		report += "\n";
	}

	if (reported.length > 0) {
		report += `🚫 *اکانت‌های ریپورت شده:*\n`;
		reported.slice(0, 5).forEach((acc) => {
			report += `• \`${acc.phone}\` (${acc.report_count || 1}x)\n`;
		});
		if (reported.length > 5) {
			report += `_و ${reported.length - 5} مورد دیگر..._\n`;
		}
	}

	return report;
}

export default {
	getAccountStatus,
	markAsReported,
	markAsResting,
	clearRest,
	clearAllRest,
	deleteAccountStatus,
	getReportedAccounts,
	getRestingAccounts,
	getHealthyAccounts,
	getAllAccountStatuses,
	getStats,
	isAccountHealthy,
	getNextAvailableAccount,
	getAvailableAccounts,
	detectAndMarkReported,
	removeReportedAccounts,
	clearExpiredRests,
	setAccountFolder,
	getAccountsByFolder,
	getFolders,
	generateStatusReport,
};
