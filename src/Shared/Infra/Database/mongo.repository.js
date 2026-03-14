import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "ifragment_bot";

let client = null;
let db = null;

/**
 * Connect to MongoDB
 */
export async function connectDB() {
	if (db) return db;

	try {
		client = new MongoClient(MONGO_URI, {
			serverSelectionTimeoutMS: 5000,
			connectTimeoutMS: 5000,
		});
		await client.connect();
		db = client.db(DB_NAME);
		console.log("✅ MongoDB connected");

		// Create indexes
		await db.collection("users").createIndex({ odId: 1 }, { unique: true });
		await db.collection("queries").createIndex({ username: 1 });
		await db.collection("queries").createIndex({ timestamp: -1 });

		return db;
	} catch (error) {
		console.error("❌ MongoDB connection failed:", error.message);
		return null;
	}
}

/**
 * Get database instance
 */
export function getDB() {
	return db;
}

/**
 * Track user activity
 */
export async function trackUser(user) {
	if (!db) return;

	try {
		await db.collection("users").updateOne(
			{ odId: user.id },
			{
				$set: {
					odId: user.id,
					firstName: user.first_name,
					lastName: user.last_name || "",
					username: user.username || "",
					lastActive: new Date(),
				},
				$inc: { queryCount: 1 },
				$setOnInsert: { createdAt: new Date() },
			},
			{ upsert: true },
		);
	} catch (error) {
		console.error("User track error:", error.message);
	}
}

/**
 * Log a username query
 */
export async function logQuery(username, fragmentData, userId) {
	if (!db) return;

	try {
		await db.collection("queries").insertOne({
			username,
			status: fragmentData.status,
			lastSalePrice: fragmentData.lastSalePrice,
			ownerWallet: fragmentData.ownerWalletFull,
			userId,
			timestamp: new Date(),
		});
	} catch (error) {
		console.error("Query log error:", error.message);
	}
}

/**
 * Get popular usernames
 */
export async function getPopularUsernames(limit = 10) {
	if (!db) return [];

	try {
		const results = await db
			.collection("queries")
			.aggregate([
				{ $group: { _id: "$username", count: { $sum: 1 } } },
				{ $sort: { count: -1 } },
				{ $limit: limit },
			])
			.toArray();

		return results.map((r) => ({ username: r._id, count: r.count }));
	} catch (error) {
		console.error("Popular query error:", error.message);
		return [];
	}
}

/**
 * Get user stats
 */
export async function getUserStats() {
	if (!db) return { totalUsers: 0, totalQueries: 0 };

	try {
		const totalUsers = await db.collection("users").countDocuments();
		const totalQueries = await db.collection("queries").countDocuments();

		return { totalUsers, totalQueries };
	} catch (_error) {
		return { totalUsers: 0, totalQueries: 0 };
	}
}

/**
 * Save Telegram session to database
 * @param {string} sessionString - The session string from GramJS
 * @param {object} userInfo - Optional user info (id, username, firstName)
 */
export async function saveTelegramSession(sessionString, userInfo = null) {
	if (!db) {
		console.error("❌ Cannot save session: DB not connected");
		return false;
	}

	try {
		await db.collection("settings").updateOne(
			{ key: "telegram_session" },
			{
				$set: {
					key: "telegram_session",
					session: sessionString,
					userInfo: userInfo,
					updatedAt: new Date(),
				},
				$setOnInsert: { createdAt: new Date() },
			},
			{ upsert: true },
		);
		console.log("💾 Telegram session saved to MongoDB");
		return true;
	} catch (error) {
		console.error("❌ Failed to save session:", error.message);
		return false;
	}
}

/**
 * Load Telegram session from database
 * @returns {object|null} - Session data with session string and user info
 */
export async function loadTelegramSession() {
	if (!db) {
		console.warn("⚠️ Cannot load session: DB not connected");
		return null;
	}

	try {
		const result = await db
			.collection("settings")
			.findOne({ key: "telegram_session" });
		if (result?.session) {
			console.log("📱 Telegram session loaded from MongoDB");
			return {
				session: result.session,
				userInfo: result.userInfo,
				updatedAt: result.updatedAt,
			};
		}
		return null;
	} catch (error) {
		console.error("❌ Failed to load session:", error.message);
		return null;
	}
}

/**
 * Delete Telegram session from database
 */
export async function deleteTelegramSession() {
	if (!db) return false;

	try {
		await db.collection("settings").deleteOne({ key: "telegram_session" });
		console.log("🗑️ Telegram session deleted from MongoDB");
		return true;
	} catch (error) {
		console.error("❌ Failed to delete session:", error.message);
		return false;
	}
}

/**
 * Close connection
 */
export async function closeDB() {
	if (client) {
		await client.close();
		console.log("📦 MongoDB disconnected");
	}
}

/**
 * Get /me command cache
 */
export async function getMeCache(userId) {
	if (!db) return null;
	try {
		return await db.collection("me_cache").findOne({ userId: String(userId) });
	} catch (error) {
		console.error("getMeCache error:", error.message);
		return null;
	}
}

/**
 * Save /me command cache
 */
export async function saveMeCache(userId, data) {
	if (!db) return false;
	try {
		await db.collection("me_cache").updateOne(
			{ userId: String(userId) },
			{
				$set: {
					userId: String(userId),
					...data,
					updatedAt: new Date(),
				},
				$setOnInsert: { createdAt: new Date() },
			},
			{ upsert: true },
		);
		return true;
	} catch (error) {
		console.error("saveMeCache error:", error.message);
		return false;
	}
}
/**
 * Save account to MongoDB
 * @param {Object} account - Account object with session, phone, etc.
 */
export async function saveAccount(account) {
	if (!db) return false;

	try {
		await db.collection("accounts").updateOne(
			{ phone: account.phone },
			{
				$set: {
					phone: account.phone,
					user_id: account.id,
					username: account.username,
					firstName: account.firstName,
					lastName: account.lastName,
					session: account.session, // Already encrypted
					isActive: account.isActive,
					status: account.status,
					role: account.role,
					proxy: account.proxy,
					stats: account.stats,
					addedAt: account.addedAt,
					lastConnected: account.lastConnected,
					updatedAt: new Date(),
				},
				$setOnInsert: { createdAt: new Date() },
			},
			{ upsert: true },
		);
		return true;
	} catch (error) {
		console.error("Failed to save account:", error.message);
		return false;
	}
}

/**
 * Load all accounts from MongoDB
 */
export async function loadAccounts() {
	if (!db) {
		// Try to connect if not connected
		await connectDB();
		if (!db) return [];
	}

	try {
		const accounts = await db.collection("accounts").find({}).toArray();
		return accounts;
	} catch (error) {
		console.error("Failed to load accounts:", error.message);
		return [];
	}
}

/**
 * Delete account from MongoDB
 */
export async function deleteAccount(phone) {
	if (!db) return false;

	try {
		await db.collection("accounts").deleteOne({ phone: phone });
		return true;
	} catch (error) {
		console.error("Failed to delete account:", error.message);
		return false;
	}
}

/**
 * Count accounts in MongoDB
 */
export async function countAccounts() {
	if (!db) return 0;

	try {
		return await db.collection("accounts").countDocuments();
	} catch (_error) {
		return 0;
	}
}
/**
 * Save a GiftAsset API token to MongoDB
 */
export async function addGiftAssetToken(token) {
	if (!db) return false;
	try {
		await db.collection("gift_asset_tokens").updateOne(
			{ token },
			{
				$set: { token, createdAt: new Date() },
			},
			{ upsert: true },
		);
		return true;
	} catch (error) {
		console.error("Failed to add GiftAsset token:", error.message);
		return false;
	}
}

/**
 * Load all GiftAsset API tokens from MongoDB
 */
export async function loadGiftAssetTokens() {
	if (!db) {
		await connectDB();
		if (!db) return [];
	}
	try {
		const results = await db.collection("gift_asset_tokens").find({}).toArray();
		return results.map((r) => r.token);
	} catch (error) {
		console.error("Failed to load GiftAsset tokens:", error.message);
		return [];
	}
}

/**
 * Delete a GiftAsset API token from MongoDB
 */
export async function deleteGiftAssetToken(token) {
	if (!db) return false;
	try {
		await db.collection("gift_asset_tokens").deleteOne({ token });
		return true;
	} catch (error) {
		console.error("Failed to delete GiftAsset token:", error.message);
		return false;
	}
}

/**
 * Save an Apify API token to MongoDB
 */
export async function addApifyToken(token) {
	if (!db) return false;
	try {
		await db.collection("apify_tokens").updateOne(
			{ token },
			{
				$set: { token, createdAt: new Date() },
			},
			{ upsert: true },
		);
		return true;
	} catch (error) {
		console.error("Failed to add Apify token:", error.message);
		return false;
	}
}

/**
 * Load all Apify API tokens from MongoDB
 */
export async function loadApifyTokens() {
	if (!db) {
		await connectDB();
		if (!db) return [];
	}
	try {
		const results = await db.collection("apify_tokens").find({}).toArray();
		return results.map((r) => r.token);
	} catch (error) {
		console.error("Failed to load Apify tokens:", error.message);
		return [];
	}
}

/**
 * Delete an Apify API token from MongoDB
 */
export async function deleteApifyToken(token) {
	if (!db) return false;
	try {
		await db.collection("apify_tokens").deleteOne({ token });
		return true;
	} catch (error) {
		console.error("Failed to delete Apify token:", error.message);
		return false;
	}
}
/**
 * Save See.tg API token to MongoDB
 */
export async function saveSeeTgToken(token) {
	if (!db) return false;
	try {
		await db
			.collection("settings")
			.updateOne(
				{ key: "seetg_token" },
				{ $set: { token, updatedAt: new Date() } },
				{ upsert: true },
			);
		return true;
	} catch (error) {
		console.error("Failed to save See.tg token:", error.message);
		return false;
	}
}

/**
 * Load See.tg API token from MongoDB
 */
export async function loadSeeTgToken() {
	if (!db) {
		await connectDB();
		if (!db) return null;
	}
	try {
		const result = await db
			.collection("settings")
			.findOne({ key: "seetg_token" });
		return result ? result.token : null;
	} catch (error) {
		console.error("Failed to load See.tg token:", error.message);
		return null;
	}
}
