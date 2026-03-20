/**
 * G2G Data Repository
 * Handles persistent storage for extracted contacts and statistics
 */

import { getDB } from "../../../Shared/Infra/Database/mongo.repository.js";

export const G2GRepository = {
	/**
	 * Save an extracted contact (Upsert)
	 */
	async saveContact(contact) {
		const db = getDB();
		if (!db) return;
		return await db.collection("extracted_contacts").updateOne(
			{ username: contact.username },
			{
				$set: { ...contact, updatedAt: new Date() },
				$setOnInsert: { createdAt: new Date() },
			},
			{ upsert: true },
		);
	},

	/**
	 * Track daily account statistics
	 */
	async trackStat(phone, action, success) {
		const db = getDB();
		if (!db) return;
		const today = new Date().toISOString().split("T")[0];
		const key = `${phone}_${today}`;
		return await db.collection("g2g_stats").updateOne(
			{ key },
			{
				$inc: {
					[`${action}_success`]: success ? 1 : 0,
					[`${action}_fail`]: success ? 0 : 1,
					total: 1,
				},
				$set: { phone, date: today, updatedAt: new Date() },
				$setOnInsert: { createdAt: new Date() },
			},
			{ upsert: true },
		);
	},

	/**
	 * Get pending contacts for actions
	 */
	async getPendingContacts(filter = {}) {
		const db = getDB();
		if (!db) return [];
		return await db.collection("extracted_contacts").find(filter).toArray();
	},

	/**
	 * Delete a single contact
	 */
	async deleteContact(username) {
		const db = getDB();
		if (!db) return;
		return await db.collection("extracted_contacts").deleteOne({ username });
	},

	/**
	 * Clear all extracted contacts
	 */
	async clearAll() {
		const db = getDB();
		if (!db) return;
		const res = await db.collection("extracted_contacts").deleteMany({});
		return res.deletedCount;
	},
};
