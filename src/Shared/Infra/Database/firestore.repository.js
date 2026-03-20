import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let db = null;
let _initialized = false;

/**
 * Initialize Firestore with strict validation
 */
export async function connectDB() {
	if (db && _initialized) return db;

	try {
		// 1. Check if we have PROJECT_ID or JSON. If not, don't even try native auth
		const projectId = process.env.FIREBASE_PROJECT_ID;
		const hasServiceAccount = await import("../../../../serviceAccount.json", { assert: { type: "json" } }).then(() => true).catch(() => false);

		if (!projectId && !hasServiceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
			console.log("ℹ️ No Firebase credentials detected. Running in Safe Mode.");
			_initialized = false;
			db = null;
			return null;
		}

		// 2. Try Native Auth (Google Cloud)
		const nativeAuth = (async () => {
			if (getApps().length === 0) {
				if (projectId) initializeApp({ projectId });
				else initializeApp();
			}
			const tempDb = getFirestore();
			// VERIFY - This is the secret sauce. Does it actually work?
			await tempDb.collection("_health").limit(1).get().catch(e => {
				if (e.message.includes("Project Id")) throw e;
				// Other errors (like network) are acceptable for "initialized" state, 
				// but "Project Id" means it's fundamentally broken
			});
			db = tempDb;
			_initialized = true;
			return true;
		})();

		const timeout = new Promise((_r, reject) => setTimeout(() => reject(new Error("Timeout")), 3000));
		await Promise.race([nativeAuth, timeout]);
		
		console.log("✅ Firestore connected");
		return db;
	} catch (error) {
		_initialized = false;
		db = null;
		console.log(`⚠️ Firestore failed or timed out: ${error.message}. Using Memory Cache.`);
		return null;
	}
}

/**
 * Get Firestore instance
 */
export function getDB() {
	return _initialized ? db : null;
}

/**
 * Track user activity
 */
export async function trackUser(user) {
	const currentDb = getDB();
	if (!currentDb) return;
	try {
		const userRef = currentDb.collection("users").doc(String(user.id));
		await userRef.set({
			odId: user.id,
			firstName: user.first_name,
			lastName: user.last_name || "",
			username: user.username || "",
			lastActive: new Date().toISOString(),
		}, { merge: true });
	} catch (error) {
		console.error("User track error:", error.message);
	}
}

/**
 * Log a username query
 */
export async function logQuery(username, fragmentData, userId) {
	const currentDb = getDB();
	if (!currentDb) return;
	try {
		await currentDb.collection("queries").add({
			username,
			status: fragmentData.status,
			lastSalePrice: fragmentData.lastSalePrice,
			ownerWallet: fragmentData.ownerWalletFull,
			userId: String(userId),
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		console.error("Query log error:", error.message);
	}
}

/**
 * Get popular usernames
 */
export async function getPopularUsernames(limit = 10) {
	const currentDb = getDB();
	if (!currentDb) return [];
	try {
		const snapshot = await currentDb.collection("queries")
			.orderBy("timestamp", "desc")
			.limit(100)
			.get();
		
		const counts = {};
		snapshot.forEach(doc => {
			const u = doc.data().username;
			counts[u] = (counts[u] || 0) + 1;
		});

		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([username, count]) => ({ username, count }));
	} catch (error) {
		console.error("Popular query error:", error.message);
		return [];
	}
}

/**
 * Save /me command cache
 */
export async function saveMeCache(userId, data) {
	const currentDb = getDB();
	if (!currentDb) return false;
	try {
		await currentDb.collection("me_cache").doc(String(userId)).set({
			...data,
			updatedAt: new Date().toISOString()
		}, { merge: true });
		return true;
	} catch (error) {
		console.error("saveMeCache error:", error.message);
		return false;
	}
}

/**
 * Get /me command cache
 */
export async function getMeCache(userId) {
	const currentDb = getDB();
	if (!currentDb) return null;
	try {
		const doc = await currentDb.collection("me_cache").doc(String(userId)).get();
		return doc.exists ? doc.data() : null;
	} catch (error) {
		console.error("getMeCache error:", error.message);
		return null;
	}
}

/**
 * Close connection
 */
export async function closeDB() {
	db = null;
	_initialized = false;
}
