/**
 * See.tg API Service
 * For fetching enhanced gift data from see.tg platform
 * API Docs: https://poso.see.tg/api/docs/
 */

import fetch from "node-fetch";
import {
	loadSeeTgToken,
	saveSeeTgToken,
} from "../../../Shared/Infra/Database/mongo.repository.js";

// API Configuration
const SEETG_API_BASE = "https://poso.see.tg/api";
let cachedToken = process.env.SEETG_API_TOKEN || "";

/**
 * Initialize See.tg token from DB
 */
async function initToken() {
	const dbToken = await loadSeeTgToken();
	if (dbToken) {
		cachedToken = dbToken;
		console.log("📊 See.tg token loaded from MongoDB");
	}
}

// Auto-init token
initToken().catch((e) => console.error("Failed to init See.tg token:", e));

/**
 * Make authenticated API request to See.tg
 */
async function apiRequest(endpoint, options = {}) {
	const url = `${SEETG_API_BASE}${endpoint}`;

	const headers = {
		Authorization: cachedToken,
		"Content-Type": "application/json",
		...options.headers,
	};

	if (!cachedToken) {
		// Silently fail if no token provided to avoid errors
		return null;
	}

	console.log(`🔗 See.tg API: ${url}`);
	console.log(`🔑 Token present: ${cachedToken ? "Yes" : "No"}`);

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
		const response = await fetch(url, {
			...options,
			headers,
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		console.log(
			`📥 See.tg Response: ${response.status} ${response.statusText}`,
		);

		if (!response.ok) {
			console.warn(
				`See.tg API error: ${response.status} ${response.statusText}`,
			);
			return null;
		}

		const data = await response.json();
		console.log(`📦 See.tg Data keys: ${Object.keys(data || {}).join(", ")}`);
		return data;
	} catch (error) {
		console.warn(`See.tg API request failed: ${endpoint}`, error.message);
		return null;
	}
}

/**
 * Get gift information from See.tg
 * @param {string} collectionSlug - Collection slug (e.g., "PlushPepe")
 * @param {number} itemNumber - Item number
 */
async function getGiftInfo(collectionSlug, itemNumber) {
	// Use slug and num parameters as per API docs
	const data = await apiRequest(
		`/gift?slug=${collectionSlug}&num=${itemNumber}`,
	);
	if (!data) return null;

	return {
		id: data.id,
		number: data.number,
		collection: data.collection,
		owner: data.owner,
		ownerUsername: data.owner?.username || null,
		ownerName: data.owner?.name || null,
		ownerId: data.owner?.id || null,
		model: data.model,
		backdrop: data.backdrop,
		symbol: data.symbol,
		price: data.price,
		floor: data.floor,
		rarity: data.rarity,
		rank: data.rank,
		raw: data,
	};
}

/**
 * Get owner information from See.tg
 * @param {string} ownerId - Owner ID or username
 */
async function getOwnerInfo(ownerIdentifier) {
	// Try owner_address first (for wallet addresses)
	let data = await apiRequest(`/owner?owner_address=${ownerIdentifier}`);

	// If not found, try username
	if (!data && ownerIdentifier.startsWith("@")) {
		data = await apiRequest(`/owner?username=${ownerIdentifier.substring(1)}`);
	}

	if (!data) return null;

	return {
		id: data.id,
		username: data.username,
		name: data.name,
		giftsCount: data.gifts_count,
		totalValue: data.total_value,
		avatar: data.avatar,
		raw: data,
	};
}

/**
 * Get collection information from See.tg
 * @param {string} collectionSlug - Collection slug
 */
async function getCollectionInfo(collectionSlug) {
	const data = await apiRequest(`/collection?slug=${collectionSlug}`);
	if (!data) return null;

	return {
		slug: data.slug,
		name: data.name,
		floor: data.floor,
		totalItems: data.total_items,
		ownersCount: data.owners_count,
		volume24h: data.volume_24h,
		volume7d: data.volume_7d,
		floorChange24h: data.floor_change_24h,
		floorChange7d: data.floor_change_7d,
		raw: data,
	};
}

/**
 * Get floor changes for a gift/collection
 * @param {string} collectionSlug - Collection slug
 */
async function getFloorChanges(collectionSlug) {
	// Use slug parameter and request 24h and 7d periods
	const data24h = await apiRequest(
		`/floors/changes?slug=${collectionSlug}&period=24h`,
	);
	const data7d = await apiRequest(
		`/floors/changes?slug=${collectionSlug}&period=7d`,
	);

	if (!data24h && !data7d) return null;

	return {
		change24h: data24h?.change || data24h?.percent || null,
		change7d: data7d?.change || data7d?.percent || null,
		change30d: null,
		currentFloor: data24h?.floor || data7d?.floor || null,
		raw: { data24h, data7d },
	};
}

/**
 * Get leaderboard/ranking data
 * @param {string} collectionSlug - Collection slug (optional)
 */
async function getLeaderboard(collectionSlug = null) {
	const endpoint = collectionSlug
		? `/leaderboard?collection=${collectionSlug}`
		: "/leaderboard";

	const data = await apiRequest(endpoint);
	if (!data) return null;

	return data;
}

/**
 * Get transaction history for a gift
 * @param {string} collectionSlug - Collection slug
 * @param {number} itemNumber - Item number
 */
async function getGiftHistory(collectionSlug, itemNumber) {
	// Use slug and num parameters
	const data = await apiRequest(
		`/history?slug=${collectionSlug}&num=${itemNumber}`,
	);
	if (!data) return null;

	return {
		transfers: data.transfers || [],
		totalTransfers: data.total || 0,
		lastTransfer: data.transfers?.[0] || null,
		raw: data,
	};
}

/**
 * Get TON to USD rate
 */
async function getTonRate() {
	const data = await apiRequest("/rate");
	if (!data) return null;

	return {
		tonUsd: data.ton_usd || data.rate,
		raw: data,
	};
}

/**
 * Get user avatar URL
 * @param {string} username - Telegram username
 */
function getAvatarUrl(username) {
	if (!username) return null;
	return `${SEETG_API_BASE}/avatar/${username}`;
}

/**
 * Get general stats
 */
async function getStats() {
	const data = await apiRequest("/stats");
	return data;
}

/**
 * Get market floors across different platforms
 * @param {string} collectionSlug - Collection slug
 */
async function getMarketFloors(collectionSlug) {
	const data = await apiRequest(`/market/floors?collection=${collectionSlug}`);
	if (!data) return null;

	return data;
}

/**
 * Update See.tg token
 */
async function updateToken(newToken) {
	const saved = await saveSeeTgToken(newToken);
	if (saved) {
		cachedToken = newToken;
		return true;
	}
	return false;
}

export {
	getAvatarUrl,
	getCollectionInfo,
	getFloorChanges,
	getGiftHistory,
	getGiftInfo,
	getLeaderboard,
	getMarketFloors,
	getOwnerInfo,
	getStats,
	getTonRate,
	initToken,
	updateToken,
};
