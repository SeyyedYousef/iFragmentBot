/**
 * Group To Group Service v18.0
 * Refactored into a scalable automation orchestrator
 */

import { Api } from "telegram";
import { scrapeGiftOwner } from "../../Market/Infrastructure/fragment.repository.js";
import healthGuard from "../../Security/Application/health-guard.service.js";
import * as accountManager from "../../User/Application/account-manager.service.js";
import { G2GRepository as DB } from "../Infrastructure/g2g.repository.js";

// ==================== GLOBAL STATE ====================
const state = {
	isExtracting: false,
	isAdding: false,
	isPaused: false,
	schedule: { enabled: false, start: 9, end: 21 },
	currentTask: null,
	stats: { added: 0, failed: 0, total: 0 },
};

const accountUsage = new Map(); // phone -> { adds: number, lastUsed: Date }

// ==================== TASK CONTROLS ====================

export const controls = {
	pause: () => {
		state.isPaused = true;
		return { success: true };
	},
	resume: () => {
		state.isPaused = false;
		return { success: true };
	},
	stop: () => {
		state.isExtracting = false;
		state.isAdding = false;
		state.isPaused = false;
		state.currentTask = null;
		return { success: true };
	},
	isWithinSchedule: () => {
		if (!state.schedule?.enabled) return true;
		const hour = new Date().getHours();
		return hour >= state.schedule.start && hour < state.schedule.end;
	},
};

// ==================== EXTRACTION CORE ====================

/**
 * Extract owner details using native MTProto or scraper fallback
 */
async function extractOwner(client, slug, num) {
	const giftId = `${slug}-${num}`;
	try {
		// Try Native MTProto Collectible Info first
		const res = await client.invoke(
			new Api.messages.GetCollectibleInfo({
				collectible: new Api.InputCollectibleUsername({ username: giftId }),
			}),
		);
		if (res?.user) return createContactObject(res.user, giftId, true);
	} catch {}

	// Fallback to Scraper
	const sc = await scrapeGiftOwner(slug, num);
	if (sc?.username) {
		try {
			const entity = await client.getEntity(sc.username);
			return createContactObject(entity, giftId, false);
		} catch {
			return { username: sc.username, source: "fallback" };
		}
	}
	return null;
}

function createContactObject(u, giftId, isNative) {
	return {
		id: u.id?.toString(),
		username: u.username || null,
		firstName: u.firstName || "User",
		accessHash: u.accessHash?.toString(),
		source: "gift",
		sourceDetail: giftId,
		isNative,
		extractedAt: new Date(),
	};
}

// -------------------- MAIN PROCESSES --------------------

export async function extractOwnersFromCollection(slug, start, end, callback) {
	if (state.isExtracting) return { error: "Already active" };
	state.isExtracting = true;
	state.isPaused = false;

	let processed = 0;
	const count = end - start + 1;
	state.currentTask = { slug, total: count, found: 0 };

	for (let i = start; i <= end; i++) {
		if (state.isPaused) await new Promise((r) => setTimeout(r, 2000));
		if (!state.isExtracting) break;

		try {
			await accountManager.executeWithSmartRetry(async (client) => {
				const owner = await extractOwner(client, slug, i);
				if (owner?.username) {
					await DB.saveContact(owner);
					state.currentTask.found++;
				}
			}, "scanner");
		} catch (e) {
			console.warn(`Extraction skip #${i}:`, e.message);
		}

		processed++;
		callback?.({ processed, total: count, found: state.currentTask.found });
		await new Promise((r) => setTimeout(r, 1000));
	}
	state.isExtracting = false;
	return { success: true };
}

// -------------------- MASS INVITATION (GROUP ADD) --------------------

export async function addContactsToGroup(inviteLink, callback) {
	if (state.isAdding) return { error: "Adding ongoing" };
	const pending = await DB.getPendingContacts({ addedToGroup: { $ne: true } });
	if (!pending.length) return { error: "No pending contacts" };

	state.isAdding = true;
	state.stats = { added: 0, failed: 0, total: pending.length };
	const hash = inviteLink.split("/").pop().replace("+", "");

	for (const contact of pending) {
		if (state.isPaused) await new Promise((r) => setTimeout(r, 2000));
		if (!state.isAdding) break;

		const acc = await getAvailableAccount();
		if (!acc) {
			console.warn("Limits hit for all accounts");
			break;
		}

		try {
			const client = await accountManager.getClientByPhone(acc.phone);
			const user = await client.getEntity(contact.username);

			// Join and Invite
			let chat;
			try {
				chat = (
					await client.invoke(new Api.messages.ImportChatInvite({ hash }))
				).chats[0];
			} catch {}
			if (chat) {
				await client.invoke(
					new Api.channels.InviteToChannel({ channel: chat, users: [user] }),
				);
				await DB.saveContact({
					...contact,
					addedToGroup: true,
					addedBy: acc.phone,
					addedAt: new Date(),
				});
				state.stats.added++;
				recordAccountUsage(acc.phone);
			}
		} catch (e) {
			state.stats.failed++;
			await DB.trackStat(acc.phone, "group", false);
			if (e.message?.includes("FLOOD"))
				await new Promise((r) => setTimeout(r, 60000));
		}
		callback?.(state.stats);
		await new Promise((r) => setTimeout(r, 15000));
	}
	state.isAdding = false;
}

// -------------------- HELPERS --------------------

async function getAvailableAccount() {
	const accounts = accountManager.getAccountList().filter((a) => a.connected);
	const today = new Date().toDateString();
    
    for (const acc of accounts) {
		const key = `${acc.phone}_${today}`;
		const usage = accountUsage.get(key) || { adds: 0 };
		const limit = await healthGuard.getDailyLimit(acc);
		if (usage.adds < limit) {
            return acc;
        }
	}
	return null;
}

function recordAccountUsage(phone) {
	const today = new Date().toDateString();
	const key = `${phone}_${today}`;
	const current = accountUsage.get(key) || { adds: 0 };
	accountUsage.set(key, { adds: current.adds + 1, lastUsed: new Date() });
}

export const stats = {
	getStatus: () => ({
		...state,
		accountCount: accountManager.getAccountList().length,
	}),
	clearList: async () => await DB.clearAll(),
};

// ... Backward compatibility functions (if needed) ...
export async function importFromCSV(text) {
	const usernames = text
		.split(/[\n,]/)
		.map((t) => t.trim().replace("@", ""))
		.filter((u) => u.length > 3);
	for (const username of usernames) {
		await DB.saveContact({
			username,
			firstName: username,
			source: "csv",
			extractedAt: new Date(),
		});
	}
	return { success: true, imported: usernames.length };
}

export default {
	controls,
	extractOwnersFromCollection,
	addContactsToGroup,
	stats,
	importFromCSV,
};
