/**
 * User Service - Professional Management
 * v18.0 Refined Logic & Economic System
 */

import { getDB } from "../../../Shared/Infra/Database/firestore.repository.js";

const INITIAL_CREDITS = 100;
const COST_PER_REPORT = 100;
const RESET_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

// Internal active memory cache
const usersCache = new Map();

/**
 * Initialize Service: Load active users into memory
 */
export async function initUserService() {
	const db = getDB();
	if (!db) return console.log("⚠️ Database offline, user data will be temporary");

	try {
		// Fetch all user docs (for 2026, we might want to limit this or use a cache layer)
		const snapshot = await db.collection("userData").get();
		snapshot.forEach((doc) => {
			const u = doc.data();
			usersCache.set(String(u.id), u);
		});
		console.log(`✅ User Service ready: ${snapshot.size} profiles cached from Firestore`);
	} catch (e) {
		console.error("User Service Init Fail:", e.message);
	}
}

/**
 * Get User Profile (Cache-first with DB fallback)
 */
export async function getUser(userId) {
	const id = String(userId);
	if (usersCache.has(id)) return usersCache.get(id);

	const db = getDB();
	let user = null;
	
	if (db) {
		const doc = await db.collection("userData").doc(id).get();
		if (doc.exists) user = doc.data();
	}

	if (!user) {
		user = {
			id,
			username: null,
			firstName: null,
			frgCredits: INITIAL_CREDITS,
			lastFrgReset: new Date().toISOString(),
			stats: { totalReports: 0, messagesSent: 0 },
			blocked: false,
			createdAt: new Date().toISOString(),
		};
		if (db) {
			await db.collection("userData").doc(id).set(user).catch(() => {});
		}
	}

	usersCache.set(id, user);
	return user;
}

/**
 * Persist user changes to Firestore
 */
async function syncUser(userId) {
	const user = usersCache.get(String(userId));
	if (!user) return;
	const db = getDB();
	if (db) {
		await db.collection("userData").doc(String(user.id)).set(user, { merge: true }).catch(() => {});
	}
}

// ==================== ECONOMY & CREDITS ====================

function checkReset(user) {
	const now = new Date();
	const last = new Date(user.lastFrgReset || 0);
	if (now - last > RESET_PERIOD_MS || user.frgCredits === undefined) {
		if ((user.frgCredits || 0) < INITIAL_CREDITS)
			user.frgCredits = INITIAL_CREDITS;
		user.lastFrgReset = now.toISOString();
		syncUser(user.id);
	}
}

export async function useFeature(userId, featureKey = "credits", defaultState = null) {
	const user = await getUser(userId);
	checkReset(user);

	// Special case for global credits
	if (featureKey === "credits") {
		if ((user.frgCredits || 0) < COST_PER_REPORT)
			return { success: false, credits: user.frgCredits };

		user.frgCredits -= COST_PER_REPORT;
		user.stats.totalReports++;
		syncUser(userId);
		return { success: true, credits: user.frgCredits };
	}

	// For specific features, check user.features or return success
	if (!user.features) user.features = {};
	
	const featureVal = user.features[featureKey];
	if (featureVal === undefined) {
		// New feature? Initialize with default
		if (defaultState !== null) {
			user.features[featureKey] = defaultState;
			syncUser(userId);
			return { success: true, state: defaultState };
		}
		// If no default, assume it's free/allowed for now but don't persist
		return { success: true, state: true };
	}

	return { success: !!featureVal, state: featureVal };
}


export async function addFrgCredits(userId, amount, reason = "Activity") {
	const user = await getUser(userId);
	user.frgCredits = (user.frgCredits || 0) + amount;
	console.log(`💰 +${amount} FRG to ${userId} [${reason}]`);
	syncUser(userId);
	return user.frgCredits;
}

export async function getRemainingLimits(userId) {
	const user = await getUser(userId);
	checkReset(user);
	return { credits: user.frgCredits || 0 };
}

/**
 * Check if user has enough credits
 */
export async function canUseFeature(userId) {
	const user = await getUser(userId);
	checkReset(user);
	return (user.frgCredits || 0) >= COST_PER_REPORT;
}

/**
 * Get time until next monthly reset
 */
export async function getTimeUntilReset(userId) {
	const user = await getUser(userId);
	const now = new Date();
	const last = new Date(user.lastFrgReset || 0);
	const elapsed = now - last;
	const remaining = Math.max(0, RESET_PERIOD_MS - elapsed);

	const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
	const hours = Math.floor(
		(remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000),
	);

	return {
		days,
		hours,
		formatted: remaining > 0 ? `${days}d ${hours}h` : "Ready to Reset",
	};
}

export function getAllUsers() {
	return Array.from(usersCache.values());
}

export function getStats() {
	return {
		totalUsers: usersCache.size,
		totalReports: Array.from(usersCache.values()).reduce(
			(acc, u) => acc + (u.stats?.totalReports || 0),
			0,
		),
	};
}

// -------------------- SPONSOR HANDLING --------------------
let sponsorText = "Check out @FragmentInvestors for the latest trends!";

export function getSponsorText() {
	return sponsorText;
}

export function setSponsorText(text) {
	sponsorText = text;
	return true;
}

// ==================== PORTFOLIO & RANKINGS ====================

export async function updateNetWorth(userId, portfolioVal) {
	const user = await getUser(userId);
	user.portfolioValue = portfolioVal;
	user.netWorth = (portfolioVal || 0) + (user.realGiftValue || 0);
	syncUser(userId);
}

export async function getLeaderboard(limit = 30) {
	const db = getDB();
	if (!db)
		return Array.from(usersCache.values())
			.sort((a, b) => (b.netWorth || 0) - (a.netWorth || 0))
			.slice(0, limit);
	
	try {
		const snapshot = await db.collection("userData")
			.where("netWorth", ">", 0)
			.orderBy("netWorth", "desc")
			.limit(limit)
			.get();
		
		const results = [];
		snapshot.forEach(doc => results.push(doc.data()));
		return results;
	} catch (e) {
		console.error("Leaderboard Error:", e.message);
		return [];
	}
}

// ==================== MODERATION ====================

export async function toggleBlock(userId, status) {
	const user = await getUser(userId);
	user.blocked = status;
	syncUser(userId);
	return true;
}

export async function isBlocked(userId) {
	const user = await getUser(userId);
	return user.blocked === true;
}

// ==================== UI HELPERS ====================

export function formatCreditsMessage(credits, _userId) {
	const icon = credits > 0 ? "🪙" : "🪫";
	return `💰 *Your Balance:* ${credits} ${icon}\n_100 FRG = 1 Detailed Report_\n\n🚀 *Need more?* Post in [Investors Club](https://t.me/FragmentInvestors) (+300 FRG per msg!)`;
}

export function formatNoCreditsMessage(_type, _userId) {
	return "❌ *Insufficient Credits!*\n\nYou need at least **100 FRG** to generate a detailed report.\n\n🚀 *How to get more?*\n• Type /credits to see your status\n• Participate in @FragmentInvestors (+300 FRG bonus!)\n• Wait for monthly reset";
}

export default {
	getUser,
	useFeature,
	addFrgCredits,
	updateNetWorth,
	isBlocked,
	toggleBlock,
	getAllUsers,
	getStats,
	getSponsorText,
	setSponsorText,
	formatCreditsMessage,
	formatNoCreditsMessage,
};
