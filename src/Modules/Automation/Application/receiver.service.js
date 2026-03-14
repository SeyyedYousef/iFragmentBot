/**
 * Receiver Service
 * Handles receiving accounts from non-admin users
 */

import { receiver } from "../../../database/panelDatabase.js";
import * as accountManager from "../../User/Application/account-manager.service.js";

// ==================== RECEIVER CRUD ====================

/**
 * Add a received account
 */
export function addReceivedAccount(phone, sessionString, donatedBy) {
	return receiver.add(phone, sessionString, donatedBy);
}

/**
 * Get all received accounts
 */
export function getAllReceivedAccounts() {
	return receiver.getAll();
}

/**
 * Get pending (not approved) accounts
 */
export function getPendingAccounts() {
	return receiver.getPending();
}

/**
 * Get approved accounts
 */
export function getApprovedAccounts() {
	return receiver.getApproved();
}

/**
 * Approve a received account
 */
export async function approveAccount(id) {
	const account = receiver.getByPhone
		? null
		: receiver.getAll().find((a) => a.id === id);

	if (!account) {
		return { success: false, error: "اکانت یافت نشد" };
	}

	try {
		// Try to add to main accounts
		if (account.session_string) {
			await accountManager.addAccountBySession(account.session_string);
		}

		// Mark as approved
		receiver.approve(id);

		return { success: true };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Reject (delete) a received account
 */
export function rejectAccount(id) {
	receiver.delete(id);
}

/**
 * Check if phone already exists
 */
export function phoneExists(phone) {
	return receiver.getByPhone(phone) !== undefined;
}

// ==================== STATISTICS ====================

/**
 * Get receiver statistics
 */
export function getReceiverStats() {
	const all = getAllReceivedAccounts();
	const pending = getPendingAccounts();
	const approved = getApprovedAccounts();

	return {
		total: all.length,
		pending: pending.length,
		approved: approved.length,
	};
}

// ==================== BACKUP/RESTORE ====================

/**
 * Export all received accounts as JSON
 */
export function exportReceivedAccounts() {
	const accounts = getAllReceivedAccounts();
	return JSON.stringify(accounts, null, 2);
}

/**
 * Import received accounts from JSON
 */
export function importReceivedAccounts(jsonString) {
	try {
		const accounts = JSON.parse(jsonString);
		const results = { success: 0, failed: 0 };

		for (const account of accounts) {
			const result = addReceivedAccount(
				account.phone,
				account.session_string,
				account.donated_by,
			);

			if (result.success) {
				results.success++;
			} else {
				results.failed++;
			}
		}

		return results;
	} catch (error) {
		return { success: 0, failed: 0, error: error.message };
	}
}

export default {
	addReceivedAccount,
	getAllReceivedAccounts,
	getPendingAccounts,
	getApprovedAccounts,
	approveAccount,
	rejectAccount,
	phoneExists,
	getReceiverStats,
	exportReceivedAccounts,
	importReceivedAccounts,
};
