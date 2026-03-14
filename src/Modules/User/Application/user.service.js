/**
 * User Service - Manages user data with MongoDB persistence
 * Falls back to in-memory cache if MongoDB is unavailable
 */

import { getDB } from "../../../Shared/Infra/Database/mongo.repository.js";
import { getUserGiftsWithValue } from "../../../Shared/Infra/Telegram/telegram.client.js";

const INITIAL_CREDITS = 100;

// ==================== NEW FRG ECONOMIC SYSTEM ====================
// 100 FRG = 1 Report (Username, Gift, +888, Wallet, Compare)
// New user: 100 FRG (resets monthly)
// Message in group: 300 FRG (Enough for 3 reports!)

// Referral milestones removed.

// Daily streak rewards removed.

// In-memory cache for performance
const usersCache = new Map();

// Get current UTC date as YYYY-MM-DD
function _getUTCDate() {
	return new Date().toISOString().split("T")[0];
}

// Default user structure
function createDefaultUser(userId) {
	return {
		id: String(userId),
		username: null,
		firstName: null,
		frgCredits: INITIAL_CREDITS,
		lastFrgReset: new Date().toISOString(), // Monthly reset point
		stats: {
			totalReports: 0,
			messagesSent: 0,
		},
		blocked: false,
		createdAt: new Date().toISOString(),
	};
}

// Get user from MongoDB or cache
export async function getUserAsync(userId) {
	const id = String(userId);
	const db = getDB();

	// Try MongoDB first
	if (db) {
		try {
			let user = await db.collection("userData").findOne({ id });
			if (!user) {
				user = createDefaultUser(id);
				await db.collection("userData").insertOne(user);
			}
			usersCache.set(id, user);
			return user;
		} catch (error) {
			console.error("MongoDB getUserAsync error:", error.message);
		}
	}

	// Fallback to cache
	if (!usersCache.has(id)) {
		usersCache.set(id, createDefaultUser(id));
	}
	return usersCache.get(id);
}

// Sync version for compatibility (uses cache)
function getUser(userId) {
	const id = String(userId);
	if (!usersCache.has(id)) {
		usersCache.set(id, createDefaultUser(id));
		// Schedule async save to MongoDB
		saveUserToDB(id).catch(() => {});
	}
	return usersCache.get(id);
}

// Save user to MongoDB
async function saveUserToDB(userId) {
	const id = String(userId);
	const db = getDB();
	if (!db) return;

	const user = usersCache.get(id);
	if (!user) return;

	try {
		await db
			.collection("userData")
			.updateOne({ id }, { $set: user }, { upsert: true });
	} catch (error) {
		console.error("MongoDB save error:", error.message);
	}
}

/**
 * Check and Reset FRG Credits Monthly
 * Legacy users with old structures are also migrated here
 */
function checkAndResetFRG(user) {
	const now = new Date();
	const lastReset = user.lastFrgReset
		? new Date(user.lastFrgReset)
		: new Date(0);

	// Check if a full month has passed
	const oneMonthMillis = 30 * 24 * 60 * 60 * 1000;

	// Reset condition: 30 days passed OR first time migration
	if (now - lastReset > oneMonthMillis || user.frgCredits === undefined) {
		// If they have less than 1 FRG, top them up to 1
		if ((user.frgCredits || 0) < INITIAL_CREDITS) {
			user.frgCredits = INITIAL_CREDITS;
		}
		user.lastFrgReset = now.toISOString();
		saveUserToDB(user.id).catch(() => {});
		console.log(` Monthly FRG Reset for user ${user.id}`);
	}
}

// Check if user has enough FRG
export function canUseFeature(userId, _feature) {
	const user = getUser(userId);
	checkAndResetFRG(user);
	return (user.frgCredits || 0) >= 100;
}

// Deduct 1 FRG for feature usage
export function useFeature(userId, _feature) {
	const user = getUser(userId);
	checkAndResetFRG(user);

	if ((user.frgCredits || 0) < 100) {
		return { success: false, remaining: { credits: user.frgCredits || 0 } };
	}

	user.frgCredits -= 100;
	user.stats = user.stats || {};
	user.stats.totalReports = (user.stats.totalReports || 0) + 1;

	saveUserToDB(userId).catch(() => {});

	return {
		success: true,
		remaining: {
			credits: user.frgCredits,
		},
	};
}

/**
 * Add FRG Credits to user (e.g. from Group activity)
 */
export function addFrgCredits(userId, amount, reason = "Activity") {
	const user = getUser(userId);
	user.frgCredits = (user.frgCredits || 0) + amount;
	console.log(` Added ${amount} FRG to user ${userId} [Reason: ${reason}]`);
	saveUserToDB(userId).catch(() => {});
	return user.frgCredits;
}

/**
 * Transfer FRG Credits between users
 */
export async function transferFrgCredits(fromId, toId, amount) {
	if (amount <= 0) throw new Error("Amount must be positive");

	const sender = await getUserAsync(fromId);
	if ((sender.frgCredits || 0) < amount) {
		throw new Error("Insufficient FRG credits");
	}

	const receiver = await getUserAsync(toId);

	sender.frgCredits -= amount;
	receiver.frgCredits = (receiver.frgCredits || 0) + amount;

	await saveUserToDB(fromId);
	await saveUserToDB(toId);

	return {
		senderBalance: sender.frgCredits,
		receiverBalance: receiver.frgCredits,
	};
}

// Get remaining limits
export function getRemainingLimits(userId) {
	const user = getUser(userId);
	checkAndResetFRG(user);
	return { credits: user.frgCredits || 0, isPremium: false };
}

// Get time until next monthly reset
export function getTimeUntilReset(userId) {
	const user = getUser(userId);
	const lastReset = user.lastFrgReset
		? new Date(user.lastFrgReset)
		: new Date();
	const MONTH = 30 * 24 * 60 * 60 * 1000;
	const nextReset = new Date(lastReset.getTime() + MONTH);
	const now = new Date();

	let diff = nextReset - now;
	if (diff < 0) diff = 0;

	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

	return { days, hours, formatted: `${days}d ${hours}h` };
}

// Format remaining credits message
export function formatCreditsMessage(remaining) {
	const credits = remaining.credits !== undefined ? remaining.credits : 0;
	const icon = credits > 0 ? "🪙" : "🪫";

	return `
💰 *Your FRG Balance:* ${credits} ${icon}
_100 FRG = 1 Detailed Report_

🚀 *Need more FRG?*
Participate in our [Investors Club](https://t.me/FragmentInvestors) group!
• Each msg = **+300 FRG** (Enough for 3 reports!)
• Discuss assets, ask questions, and earn credits!`;
}

// Format "out of credits" message
export function formatNoCreditsMessage(_feature, userId) {
	const resetTime = getTimeUntilReset(userId);

	return `🪫 *Insufficient FRG Balance*

You don't have enough credits to generate this report.

💎 *How to get FRG:*
1️⃣ Join [Fragment Investors Club](https://t.me/FragmentInvestors)
2️⃣ Send a message (Discuss, Advertise your assets, etc.)
3️⃣ Earn **+300 FRG** per message instantly!

⏰ Your next free 🪙100 FRG gift arrives in: *${resetTime.formatted}*`;
}

// ==================== ADMIN FUNCTIONS ====================

// Block user
export function blockUser(userId) {
	const user = getUser(userId);
	user.blocked = true;
	saveUserToDB(userId).catch(() => {});
	return true;
}

// Unblock user
export function unblockUser(userId) {
	const user = getUser(userId);
	user.blocked = false;
	saveUserToDB(userId).catch(() => {});
	return true;
}

// Check if user is blocked
export function isBlocked(userId) {
	const id = String(userId);
	if (!usersCache.has(id)) return false;
	return usersCache.get(id).blocked === true;
}

// Get all users (from MongoDB)
export async function getAllUsersAsync() {
	const db = getDB();
	if (!db) {
		return Array.from(usersCache.entries()).map(([id, data]) => ({
			id,
			...data,
		}));
	}

	try {
		const users = await db.collection("userData").find({}).toArray();
		return users;
	} catch (error) {
		console.error("getAllUsers error:", error.message);
		return [];
	}
}

// Sync version for compatibility
export function getAllUsers() {
	return Array.from(usersCache.entries()).map(([id, data]) => ({
		id,
		...data,
	}));
}

// Get stats
export function getStats() {
	const allUsers = getAllUsers();
	const totalUsers = allUsers.length;
	const blockedUsers = allUsers.filter((u) => u.blocked === true).length;

	return {
		totalUsers,
		activeUsers: totalUsers - blockedUsers,
		blockedUsers,
	};
}

// Get user by ID (for admin)
export function getUserById(userId) {
	const id = String(userId);
	if (!usersCache.has(id)) return null;
	return { id, ...usersCache.get(id) };
}

// Initialize cache from MongoDB
export async function initUserService() {
	const db = getDB();
	if (!db) {
		console.log(" MongoDB not available, using in-memory storage");
		return;
	}

	try {
		// Create index for faster queries
		await db.collection("userData").createIndex({ id: 1 }, { unique: true });

		// Load all users into cache
		const users = await db.collection("userData").find({}).toArray();
		users.forEach((user) => {
			usersCache.set(user.id, user);
		});
		console.log(` Loaded ${users.length} users from MongoDB`);
	} catch (error) {
		console.error("User service init error:", error.message);
	}
}

// ==================== UPDATE USER INFO ====================

/**
 * Save user's Telegram profile info (username, firstName) on interaction
 * Should be called from sendDashboard so we always have fresh data
 */
export function updateUserInfo(userId, username, firstName) {
	const user = getUser(userId);
	let changed = false;
	if (username && user.username !== username) {
		user.username = username;
		changed = true;
	}
	if (firstName && user.firstName !== firstName) {
		user.firstName = firstName;
		changed = true;
	}
	if (changed) saveUserToDB(userId).catch(() => {});
}

// ==================== GIFT VALUE TRACKING ====================

/**
 * Update user info (username, firstName) and add gift value
 */
export function updateUserGiftValue(userId, username, firstName, giftValue) {
	const user = getUser(userId);

	// Update user info
	if (username) user.username = username;
	if (firstName) user.firstName = firstName;

	// Add gift value to total
	user.giftValue = (user.giftValue || 0) + giftValue;

	// Update Net Worth (Portfolio + Gifts)
	const portfolioVal = user.portfolioValue || 0;
	user.netWorth = portfolioVal + user.giftValue;

	saveUserToDB(userId).catch(() => {});

	// Also update MongoDB directly for netWorth to be sure
	const db = getDB();
	if (db) {
		db.collection("userData")
			.updateOne(
				{ id: String(userId) },
				{ $set: { giftValue: user.giftValue, netWorth: user.netWorth } },
				{ upsert: true },
			)
			.catch(() => {});
	}

	return user.giftValue;
}

/**
 * Get top gift holders sorted by total gift value
 */
export function getTopGiftHolders(limit = 30) {
	const allUsers = getAllUsers();

	return allUsers
		.filter((u) => (u.giftValue || 0) > 0)
		.sort((a, b) => (b.giftValue || 0) - (a.giftValue || 0))
		.slice(0, limit)
		.map((u, index) => ({
			rank: index + 1,
			userId: u.id,
			username: u.username,
			firstName: u.firstName,
			giftValue: u.giftValue || 0,
		}));
}

/**
 * Get user's rank among all gift holders
 */
export function getUserRank(userId) {
	const allUsers = getAllUsers();
	const id = String(userId);

	const sorted = allUsers
		.filter((u) => (u.giftValue || 0) > 0)
		.sort((a, b) => (b.giftValue || 0) - (a.giftValue || 0));

	const userIndex = sorted.findIndex((u) => u.id === id);

	if (userIndex === -1) {
		return { rank: null, total: 0 };
	}

	return {
		rank: userIndex + 1,
		total: sorted[userIndex].giftValue || 0,
	};
}

/**
 * Get user's total gift value
 */
export function getUserGiftValue(userId) {
	const user = getUser(userId);
	return user.giftValue || 0;
}

// ==================== SPONSOR TEXT ====================

let sponsorText = `
 *Our Sponsors*

 Want to advertise here?
Contact @YourAdminUsername

_Your brand could be featured to thousands of users!_
`;

export function getSponsorText() {
	return sponsorText;
}

export function setSponsorText(text) {
	sponsorText = text;
	// Also save to MongoDB for persistence
	const db = getDB();
	if (db) {
		db.collection("settings")
			.updateOne(
				{ key: "sponsorText" },
				{ $set: { key: "sponsorText", value: text } },
				{ upsert: true },
			)
			.catch(() => {});
	}
	return true;
}

export async function loadSponsorText() {
	const db = getDB();
	if (!db) return;

	try {
		const setting = await db
			.collection("settings")
			.findOne({ key: "sponsorText" });
		if (setting?.value) {
			sponsorText = setting.value;
			console.log(" Loaded sponsor text from MongoDB");
		}
	} catch (error) {
		console.error("Load sponsor text error:", error.message);
	}
}
// ==================== NET WORTH LEADERBOARD ====================

/**
 * Update user's total portfolio value and Net Worth
 * @param {number} userId
 * @param {number} value
 */
export async function updateUserPortfolioValue(userId, value) {
	const user = await getUserAsync(userId);
	const strId = String(userId);

	user.portfolioValue = value;

	// Update Net Worth
	const giftVal = user.giftValue || 0;
	user.netWorth = value + giftVal;

	// Save
	usersCache.set(strId, user);
	const db = getDB();
	if (db) {
		await db
			.collection("userData")
			.updateOne(
				{ id: strId },
				{ $set: { portfolioValue: value, netWorth: user.netWorth } },
				{ upsert: true },
			);
	}
}

/**
 * Get top 30 users by Net Worth
 */
export async function getTopTraders(limit = 30) {
	const db = getDB();
	if (!db) return [];

	try {
		return await db
			.collection("userData")
			.find({ netWorth: { $gt: 0 } })
			.sort({ netWorth: -1 })
			.limit(limit)
			.toArray();
	} catch (e) {
		console.error("Error fetching top traders:", e);
		return [];
	}
}

/**
 * Get user rank by Net Worth
 */
export async function getUserPortfolioRank(userId) {
	const db = getDB();
	if (!db) return 0;
	const user = await getUserAsync(userId);
	if (!user || !user.netWorth) return 0;

	try {
		const count = await db.collection("userData").countDocuments({
			netWorth: { $gt: user.netWorth },
		});
		return count + 1;
	} catch (_e) {
		return 0;
	}
}

/**
 * Scans user's gifts from Telegram API if needed (once per week)
 * Updates realGiftValue and netWorth
 * @param {string|number} userId
 */
export async function scanUserGiftsIfNeeded(userId) {
	const user = await getUserAsync(userId);
	const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

	// Check if scan needed (never scanned OR older than 1 week)
	// We also scan if realGiftValue is undefined to initialize it
	const shouldScan =
		!user.lastGiftScan ||
		Date.now() - new Date(user.lastGiftScan).getTime() > ONE_WEEK ||
		user.realGiftValue === undefined;

	if (shouldScan) {
		console.log(` Scanning real gifts for user ${userId}...`);

		const result = await getUserGiftsWithValue(userId);

		if (result.success) {
			user.realGiftValue = result.totalValue;
			user.lastGiftScan = new Date().toISOString();

			// Update Net Worth
			// Default portfolioValue to 0 if missing
			const portfolioVal = user.portfolioValue || 0;
			user.netWorth = portfolioVal + result.totalValue;

			// Save to DB
			const db = getDB();
			if (db) {
				await db.collection("userData").updateOne(
					{ id: String(userId) },
					{
						$set: {
							realGiftValue: user.realGiftValue,
							lastGiftScan: user.lastGiftScan,
							netWorth: user.netWorth,
						},
					},
				);
			}
			// Update cache
			usersCache.set(String(userId), user);

			console.log(
				` User ${userId} updated: Gifts=${user.realGiftValue}, NetWorth=${user.netWorth}`,
			);
			return { scanned: true, value: result.totalValue };
		} else {
			console.log(` Scan failed for ${userId}: ${result.error}`);
		}
	}

	return { scanned: false, value: user.realGiftValue || 0 };
}

export const PREMIUM_DAYS = 30;
export const PREMIUM_PRICE = 1000;
export const PREMIUM_TIERS = {};
export const REFERRAL_MILESTONES = [];
export const STREAK_REWARDS = [];
export const claimDailyReward = () => {};
export const activatePremium = () => {};
export const processSpin = () => {};
export const getTopReferrers = () => [];
export const getReferralStats = () => ({ count: 0, pending: 0, badges: [] });
export const getPremiumTier = () => null;
export const getPremiumExpiry = () => null;
export const getStreakInfo = () => ({
	current: 0,
	totalDays: 0,
	weekNumber: 0,
});
export const isPremium = () => false;
