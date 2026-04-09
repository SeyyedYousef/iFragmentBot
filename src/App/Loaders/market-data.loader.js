import fs from "node:fs/promises";
import { get888Stats } from "../../Modules/Market/Application/market.service.js";
import { getTonMarketStats } from "../../Modules/Market/Infrastructure/fragment.repository.js";
import { tonPriceCache } from "../../Shared/Infra/Cache/cache.service.js";
import { processAlerts } from "../../Modules/Alerts/Application/alert.service.js";

const CACHE_FILE = "./market_data_cache.json";
let backgroundUpdatesStarted = false;

/**
 * Load persistent market data from disk
 */
export async function loadPersistentCache() {
	try {
		const data = await fs.readFile(CACHE_FILE, "utf8");
		const json = JSON.parse(data);
		if (json.tonStats) {
			tonPriceCache.set("marketStats", json.tonStats);
			tonPriceCache.set("price", json.tonStats.price);
		}
		if (json.floor888) {
			tonPriceCache.set("floor888", json.floor888);
		}
		console.log("✅ Persistent market cache loaded");
	} catch (_e) {
		console.log("⚠️  No persistent cache found, starting fresh");
	}
}

/**
 * Save current market data to disk
 */
export async function savePersistentCache() {
	try {
		const tonStats = tonPriceCache.get("marketStats");
		const floor888 = tonPriceCache.get("floor888");
		// Only save if we have valid data
		if (tonStats || floor888) {
			const data = { tonStats, floor888 };
			await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
		}
	} catch (e) {
		console.error("Failed to save persistence cache:", e.message);
	}
}

/**
 * Start background refresh of market data
 */
export function startBackgroundUpdates(bot = null) {
	if (backgroundUpdatesStarted) return;
	backgroundUpdatesStarted = true;

	console.log("🔄 Starting background market data updates...");

	// Update TON Price
	const updateMarketData = async () => {
		try {
			const stats = await getTonMarketStats();
			if (stats) {
				const data = { ...stats, timestamp: Date.now() };
				tonPriceCache.set("marketStats", data);
				tonPriceCache.set("price", stats.price);
				savePersistentCache(); // Persist on update
			}
		} catch (e) {
			console.error("Background TON update failed:", e.message);
		}
	};

	// Update +888 Floor
	const update888Data = async () => {
		try {
			const price888 = await get888Stats();
			if (price888) {
				tonPriceCache.set("floor888", {
					price: price888,
					timestamp: Date.now(),
				});
				savePersistentCache(); // Persist on update

				// Process alerts if bot is provided
				if (bot) {
					const data = getDashboardData();
					processAlerts(bot, { ...data, price888 });
				}
			}
		} catch (e) {
			console.error("Background +888 update failed:", e.message);
		}
	};

	// Run initially
	updateMarketData();
	update888Data();

	// Schedule intervals (Every 10 minutes)
	setInterval(updateMarketData, 10 * 60 * 1000);
	setInterval(update888Data, 10 * 60 * 1000);
}

/**
 * Instant cached data for Dashboard
 */
export function getDashboardData() {
	const tonStats = tonPriceCache.get("marketStats") || {
		price: 5.5,
		change24h: 0,
		timestamp: 0,
	};
	const floor888 = tonPriceCache.get("floor888");

	// Trigger async refresh if stale (> 2 hours)
	const TWO_HOURS = 2 * 60 * 60 * 1000;
	if (!tonStats.timestamp || Date.now() - tonStats.timestamp > TWO_HOURS) {
		getTonMarketStats()
			.then((freshStats) => {
				if (freshStats && freshStats.price > 0) {
					tonPriceCache.set("marketStats", {
						...freshStats,
						timestamp: Date.now(),
					});
					tonPriceCache.set("price", freshStats.price);
				}
			})
			.catch(() => {});
	}

	return {
		tonPrice: tonStats.price || 5.5,
		tonChange: tonStats.change24h || 0,
		price888: floor888 ? floor888.price : null,
	};
}
