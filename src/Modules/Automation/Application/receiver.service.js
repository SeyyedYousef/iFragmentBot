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
export async function addReceivedAccount(phone, sessionString, donatedBy) {
	return await receiver.add(phone, sessionString, donatedBy);
}

/**
 * Get all received accounts
 */
export async function getAllReceivedAccounts() {
	return await receiver.getAll();
}

/**
 * Get pending (not approved) accounts
 */
export async function getPendingAccounts() {
	return await receiver.getPending();
}

/**
 * Get approved accounts
 */
export async function getApprovedAccounts() {
	return await receiver.getApproved();
}

/**
 * Approve a received account
 */
export async function approveAccount(id) {
	const all = await receiver.getAll();
	const account = all.find((a) => a.id === id);

	if (!account) {
		return { success: false, error: "اکانت یافت نشد" };
	}

	try {
		// Try to add to main accounts
		if (account.session_string) {
			await accountManager.addAccountBySession(account.session_string);
		}

		// Mark as approved
		await receiver.approve(id);

		return { success: true };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

/**
 * Reject (delete) a received account
 */
export async function rejectAccount(id) {
	await receiver.delete(id);
}

/**
 * Check if phone already exists
 */
export async function phoneExists(phone) {
	const result = await receiver.getByPhone(phone);
	return result !== undefined && result !== null;
}

// ==================== STATISTICS ====================

/**
 * Get receiver statistics
 */
export async function getReceiverStats() {
	const all = await getAllReceivedAccounts();
	const pending = await getPendingAccounts();
	const approved = await getApprovedAccounts();

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
export async function exportReceivedAccounts() {
	const accounts = await getAllReceivedAccounts();
	return JSON.stringify(accounts, null, 2);
}

/**
 * Import received accounts from JSON
 */
export async function importReceivedAccounts(jsonString) {
	try {
		const accounts = JSON.parse(jsonString);
		const results = { success: 0, failed: 0 };

		for (const account of accounts) {
			const result = await addReceivedAccount(
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
