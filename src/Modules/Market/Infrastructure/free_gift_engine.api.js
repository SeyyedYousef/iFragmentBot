/**
 * 🆓 Free Gift Engine — Zero Cost Gift Intelligence
 * Drop-in replacement for Gift Asset API (giftasset.pro)
 *
 * Data Sources (ALL FREE):
 * ─ TonAPI (1 RPS free tier) — blockchain data, NFT metadata, collection info
 * ─ GetGems GraphQL (public) — floor prices, sales, market data
 * ─ On-chain calculations — rarity, market cap, emission
 * ─ Hardcoded constants — provider fees
 */

import fetch from "node-fetch";

// ==================== CONSTANTS ====================

const TONAPI_BASE = "https://tonapi.io/v2";
// Note: GetGems GraphQL (api.getgems.io/graphql) returns 403 from server-side.
// All market data is fetched from TonAPI instead.

// Complete Telegram Gift collection mapping: Name → Blockchain Address
const COLLECTION_MAP = {
	"Plush Pepe": "EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS",
	"Plush Pepes": "EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS",
	"Heart Locket": "EQC4XEulxb05Le5gF6esMtDWT5XZ6tlzlMBQGNsqffxpdC5U",
	"Heart Lockets": "EQC4XEulxb05Le5gF6esMtDWT5XZ6tlzlMBQGNsqffxpdC5U",
	"Durov's Cap": "EQD9ikZq6xPgKjzmdBG0G0S80RvUJjbwgHrPZXDKc_wsE84w",
	"Durov's Caps": "EQD9ikZq6xPgKjzmdBG0G0S80RvUJjbwgHrPZXDKc_wsE84w",
	"Precious Peach": "EQA4i58iuS9DUYRtUZ97sZo5mnkbiYUBpWXQOe3dEUCcP1W8",
	"Precious Peaches": "EQA4i58iuS9DUYRtUZ97sZo5mnkbiYUBpWXQOe3dEUCcP1W8",
	"Heroic Helmet": "EQAlROpjm1k1mW30r61qRx3lYHsZkTKXVSiaHEIhOlnYA4oy",
	"Heroic Helmets": "EQAlROpjm1k1mW30r61qRx3lYHsZkTKXVSiaHEIhOlnYA4oy",
	"Mighty Arm": "EQDeX0F1GDugNjtxkFRihu9ZyFFumBv2jYF5Al1thx2ADDQs",
	"Mighty Arms": "EQDeX0F1GDugNjtxkFRihu9ZyFFumBv2jYF5Al1thx2ADDQs",
	"Spooky Skull": "EQCsGpSn0vXcwAZXXWdxITrYPzyWvnQJhz_v-Eud3xnhxoK7",
	"Spooky Skulls": "EQCsGpSn0vXcwAZXXWdxITrYPzyWvnQJhz_v-Eud3xnhxoK7",
	"Jelly Bunny": "EQChvgbYZwKdz76g4k8FwpxMdTPBh2GdFFyMQCmCaRBsL77T",
	"Jelly Bunnies": "EQChvgbYZwKdz76g4k8FwpxMdTPBh2GdFFyMQCmCaRBsL77T",
	"Electric Skull": "EQATqJRzLJy5FwgmxlLGDqNzxV-08LQlpC3PPMEEy2bTnLOy",
	"Electric Skulls": "EQATqJRzLJy5FwgmxlLGDqNzxV-08LQlpC3PPMEEy2bTnLOy",
	"Astral Shard": "EQBvxPabeEdbqpLJnmTgVFI_1hkjnM5-KpIwJqlQxGlh8sZQ",
	"Astral Shards": "EQBvxPabeEdbqpLJnmTgVFI_1hkjnM5-KpIwJqlQxGlh8sZQ",
	"Sakura Petal": "EQDz0k-xCCvZBQq8GiS7g0T_0HPXK3WnW_lrJZpJKq2oNNJY",
	"Sakura Petals": "EQDz0k-xCCvZBQq8GiS7g0T_0HPXK3WnW_lrJZpJKq2oNNJY",
	"Mad Pumpkin": "EQBz_g5IvH7IEcuFw-hVJpVNvxQr_Cx8JjsMqOx0m_rmj4L3",
	"Mad Pumpkins": "EQBz_g5IvH7IEcuFw-hVJpVNvxQr_Cx8JjsMqOx0m_rmj4L3",
	"Witch Hat": "EQCGBOcbQ_0T33wWPW9x_s8YBUxpxQnBsJwXqKJSs4aIy1qe",
	"Witch Hats": "EQCGBOcbQ_0T33wWPW9x_s8YBUxpxQnBsJwXqKJSs4aIy1qe",
	"Signet Ring": "EQAPBo7h15bD7FWsr4HfB7qCKhYAaYH1yVLr_RZr2uFy0_cV",
	"Signet Rings": "EQAPBo7h15bD7FWsr4HfB7qCKhYAaYH1yVLr_RZr2uFy0_cV",
	"Vintage Cigar": "EQAk6x9r9WZwi-7obECIqMlb2R0sCXzpnr85P0TKV5mqFdPv",
	"Vintage Cigars": "EQAk6x9r9WZwi-7obECIqMlb2R0sCXzpnr85P0TKV5mqFdPv",
	"Eternal Rose": "EQA9HfhJlNV8qnZkaPUNyqpGm38q4P6GkjKqGsFPvfS7nI1a",
	"Eternal Roses": "EQA9HfhJlNV8qnZkaPUNyqpGm38q4P6GkjKqGsFPvfS7nI1a",
	"Lucky Cat": "EQDwTXV0g4b8MXaAmTBPHljqJJA0r5pAqdxRjwwdlq_nxUZT",
	"Lucky Cats": "EQDwTXV0g4b8MXaAmTBPHljqJJA0r5pAqdxRjwwdlq_nxUZT",
	"Homunculus Lulu": "EQD7qKKpjz9LDLmFf-fqODjrg8m7lxqUHCJPW5D4P-v3YB1f",
	"Homunculus Lulus": "EQD7qKKpjz9LDLmFf-fqODjrg8m7lxqUHCJPW5D4P-v3YB1f",
	"Ion Gem": "EQA7Bk0svO5AhkHjMRc2FbhGm7X3P2XhHxwfM8Mm1CrSjZ1J",
	"Ion Gems": "EQA7Bk0svO5AhkHjMRc2FbhGm7X3P2XhHxwfM8Mm1CrSjZ1J",
	"Star Potion": "EQBj6LG8f7zSxvLt8c6V-3N8YFbb-2H0MxM5nJlEYL1FZJkU",
	"Star Potions": "EQBj6LG8f7zSxvLt8c6V-3N8YFbb-2H0MxM5nJlEYL1FZJkU",
	"Kissed Frog": "EQC3QLCAl7G3SQhU7WYVxKKbLJ9KsZxAFB6hPIKAl0Ww0X6i",
	"Kissed Frogs": "EQC3QLCAl7G3SQhU7WYVxKKbLJ9KsZxAFB6hPIKAl0Ww0X6i",
	"Skull Flower": "EQBrCMB23qMJYR21j4g7FHMJHDLmqR9bAqE1JFAY8IpglLDw",
	"Skull Flowers": "EQBrCMB23qMJYR21j4g7FHMJHDLmqR9bAqE1JFAY8IpglLDw",
	"Berry Box": "EQA5rNpnF6LkUsjD9T3EFR0vHRwW0Rn9lzFJD1K6Xlf2E_Jj",
	"Berry Boxes": "EQA5rNpnF6LkUsjD9T3EFR0vHRwW0Rn9lzFJD1K6Xlf2E_Jj",
	"Crystal Ball": "EQDWJuD6XN-qUPwqMm6qN-CzMrWFbCB0nCrJA3TH1h-LO4H8",
	"Crystal Balls": "EQDWJuD6XN-qUPwqMm6qN-CzMrWFbCB0nCrJA3TH1h-LO4H8",
	"Genie Lamp": "EQDv6R_0fq5XfFFPqV3_ZMNiGTBUDNJWnXQu7l1eH5d8nBVX",
	"Genie Lamps": "EQDv6R_0fq5XfFFPqV3_ZMNiGTBUDNJWnXQu7l1eH5d8nBVX",
	"Love Candle": "EQAv8HWHY-HcV0F_-vZs8dxB0r2VhDV8GwigqfRGP7SCB7rQ",
	"Love Candles": "EQAv8HWHY-HcV0F_-vZs8dxB0r2VhDV8GwigqfRGP7SCB7rQ",
	"B-Day Candle": "EQB0_vbJnDQUX5gDK_XVqKF6G_Aas9lLYqy0H0g5FJU1X_o0",
	"B-Day Candles": "EQB0_vbJnDQUX5gDK_XVqKF6G_Aas9lLYqy0H0g5FJU1X_o0",
	"Snow Globe": "EQC4pz_lGlN0f-GrWLB_0N3xTKJb1ZQn5gJJX3WqaNfSQqt7",
	"Snow Globes": "EQC4pz_lGlN0f-GrWLB_0N3xTKJb1ZQn5gJJX3WqaNfSQqt7",
	"Hypno Lollipop": "EQDbqJqGJbJa8lWHqFY0tpmxAqQ1EGXvNGpJq0ZuZEu3mY5g",
	"Hypno Lollipops": "EQDbqJqGJbJa8lWHqFY0tpmxAqQ1EGXvNGpJq0ZuZEu3mY5g",
	"Party Sparkler": "EQBdq8YLtT4SJLS_7GVJL_3MxCrP1L2kfQ8WrNWzVq2Tj6Td",
	"Party Sparklers": "EQBdq8YLtT4SJLS_7GVJL_3MxCrP1L2kfQ8WrNWzVq2Tj6Td",
	"Scared Cat": "EQCm6g6X7F9xQGNDVF3q5LDNF3_Q6L3nLlXXOGmBGDD8KfQr",
	"Scared Cats": "EQCm6g6X7F9xQGNDVF3q5LDNF3_Q6L3nLlXXOGmBGDD8KfQr",
	"Trapped Heart": "EQB7YYJQe3T7oJLT9fRvDVi6GDkRQ_IrZx5W6vD5ELAq2q9Y",
	"Trapped Hearts": "EQB7YYJQe3T7oJLT9fRvDVi6GDkRQ_IrZx5W6vD5ELAq2q9Y",
	"Jack-O-Lantern": "EQAw5rwPgqH7nX-qMNHQzHl0kJ5lhHGWYoKl7_CRhPNJ1Wzx",
	"Jack-O-Lanterns": "EQAw5rwPgqH7nX-qMNHQzHl0kJ5lhHGWYoKl7_CRhPNJ1Wzx",
	"Top Hat": "EQDc_3ij5VPrf0l2pPT8yvCZrVGPm3fTVXlKa3-MJp8Y0n4z",
	"Top Hats": "EQDc_3ij5VPrf0l2pPT8yvCZrVGPm3fTVXlKa3-MJp8Y0n4z",
	"Evil Eye": "EQBL5j3lZpQPnlpqS3XxZ1tF4J7DlVWsLs0XAi2O3M1DTQZ4",
	"Evil Eyes": "EQBL5j3lZpQPnlpqS3XxZ1tF4J7DlVWsLs0XAi2O3M1DTQZ4",
	"Bunny Muffin": "EQCX2GZpgHEH1x6SJVj48sM-CMfrkkR5D3T7xPjHvwNlCLvE",
	"Bunny Muffins": "EQCX2GZpgHEH1x6SJVj48sM-CMfrkkR5D3T7xPjHvwNlCLvE",
	"Diamond Ring": "EQDQRX2rJ8HlT9SLpDL9XH91q0cYHXDqPkY0MxZKW5Dc8x_T",
	"Diamond Rings": "EQDQRX2rJ8HlT9SLpDL9XH91q0cYHXDqPkY0MxZKW5Dc8x_T",
	"Desk Calendar": "EQBn_RTnKrKJ7pP6fPXtM5sB8QWcYH7YB7HdQ5pq8LNL2k_m",
	"Desk Calendars": "EQBn_RTnKrKJ7pP6fPXtM5sB8QWcYH7YB7HdQ5pq8LNL2k_m",
	"Spy Agaric": "EQBz5CJPDY1HlfxH3KWpzPXrx6OYeqC0_LznyL3qCJMp_Xyc",
	"Spy Agarics": "EQBz5CJPDY1HlfxH3KWpzPXrx6OYeqC0_LznyL3qCJMp_Xyc",
	"Perfume Bottle": "EQD5KlF9TMpH9-2xYfpKPqDB8Vm7vJLmRLXhFwQGz3JqFqSP",
	"Perfume Bottles": "EQD5KlF9TMpH9-2xYfpKPqDB8Vm7vJLmRLXhFwQGz3JqFqSP",
	"Swiss Watch": "EQAr_RH67qDB5LJq8lqQxH2Gn8bPw3KH6L3nJLxPpNzXJ1cQ",
	"Swiss Watches": "EQAr_RH67qDB5LJq8lqQxH2Gn8bPw3KH6L3nJLxPpNzXJ1cQ",
	"Love Potion": "EQBd2LLxI7qj9TL3SPpBnpH8xQbJ7L3vNWxpr5_EeBR7VQqg",
	"Love Potions": "EQBd2LLxI7qj9TL3SPpBnpH8xQbJ7L3vNWxpr5_EeBR7VQqg",
	"Flying Broom": "EQBnK4xrQ5QGpLe3fPvN9OgBY2JJLlM3kHm6H_3oQeMjWdPQ",
	"Flying Brooms": "EQBnK4xrQ5QGpLe3fPvN9OgBY2JJLlM3kHm6H_3oQeMjWdPQ",
};

// Reverse map: Address → Primary Name
const ADDRESS_TO_NAME = {};
for (const [name, addr] of Object.entries(COLLECTION_MAP)) {
	if (!name.endsWith("s") || !COLLECTION_MAP[name.slice(0, -1)]) {
		ADDRESS_TO_NAME[addr] = name;
	}
}

// Unique collection addresses (deduplicated)
const UNIQUE_COLLECTIONS = [...new Set(Object.values(COLLECTION_MAP))];

// Known marketplace fees (public knowledge)
const KNOWN_FEES = {
	getgems: 0.05,
	fragment: 0.0,
	portals: 0.01,
	tonnel: 0.025,
};

// ==================== CACHE ====================

class TTLCache {
	constructor(ttlMs = 5 * 60 * 1000) {
		this._map = new Map();
		this._ttl = ttlMs;
	}
	get(key) {
		const e = this._map.get(key);
		if (e && Date.now() - e.ts < this._ttl) return e.data;
		if (e) this._map.delete(key);
		return null;
	}
	set(key, data) {
		this._map.set(key, { data, ts: Date.now() });
	}
}

const shortCache = new TTLCache(5 * 60 * 1000); // 5 min
const longCache = new TTLCache(30 * 60 * 1000); // 30 min

// ==================== RATE LIMITER ====================

let lastTonApiCall = 0;
const TONAPI_INTERVAL = 1100; // 1.1s for safe 1 RPS

// ==================== HTTP HELPERS ====================

async function tonApi(endpoint) {
	// Rate limit
	const now = Date.now();
	const wait = TONAPI_INTERVAL - (now - lastTonApiCall);
	if (wait > 0) await new Promise((r) => setTimeout(r, wait));
	lastTonApiCall = Date.now();

	try {
		const headers = {
			Accept: "application/json",
			"User-Agent": "iFragmentBot/2.0",
		};
		const apiKey = process.env.TONAPI_KEY;
		if (apiKey && !apiKey.startsWith("YOUR_")) {
			headers.Authorization = `Bearer ${apiKey}`;
		}

		const resp = await fetch(`${TONAPI_BASE}${endpoint}`, {
			headers,
			timeout: 10000,
		});
		if (!resp.ok) {
			console.warn(`[FreeEngine] TonAPI ${resp.status}: ${endpoint}`);
			return null;
		}
		return await resp.json();
	} catch (e) {
		console.warn(`[FreeEngine] TonAPI error: ${e.message}`);
		return null;
	}
}

/**
 * Floor price fetcher — TonAPI primary, with smart caching
 * GetGems GraphQL blocked (403), so we use TonAPI items endpoint
 */
async function fetchCollectionData(collectionAddress) {
	const cacheKey = `coll_data_${collectionAddress}`;
	const cached = shortCache.get(cacheKey);
	if (cached) return cached;

	let floorPrice = null;
	let itemsCount = 0;
	let collName = null;
	let onSaleCount = 0;

	// Step 1: Get collection metadata from TonAPI
	const collData = await tonApi(`/nfts/collections/${collectionAddress}`);
	if (collData) {
		collName = collData.metadata?.name || null;
		const rawIndex = collData.next_item_index;
		if (rawIndex && rawIndex > 0) {
			itemsCount = rawIndex;
		}
	}

	// Step 2: Fetch items batch to find floor price + estimate total supply
	const itemsBatch = await tonApi(
		`/nfts/collections/${collectionAddress}/items?limit=256`,
	);
	const marketFloors = {};

	if (itemsBatch?.nft_items) {
		const items = itemsBatch.nft_items;

		// TON gift NFT indices are NOT sequential (they're huge hash-based numbers)
		// So we estimate supply from the batch: if we got 256 items, collection is likely larger
		if (itemsCount <= 0) {
			itemsCount = items.length;
			if (items.length >= 256) {
				itemsCount = 5000; // Conservative estimate
			}
		}

		const onSaleItems = items.filter((i) => i.sale?.price?.value);
		onSaleCount = onSaleItems.length;

		for (const item of onSaleItems) {
			let marketName = item.sale.market?.name?.toLowerCase() || "unknown";
			// Normalize common market names
			if (marketName.includes("getgems")) marketName = "getgems";
			if (marketName.includes("portals")) marketName = "portals";
			if (marketName.includes("tonnel")) marketName = "tonnel";
			if (marketName.includes("fragment")) marketName = "fragment";

			const price =
				typeof item.sale.price.value === "string"
					? parseInt(item.sale.price.value, 10) / 1e9
					: item.sale.price.value / 1e9;

			if (price > 0 && price < 1e9) {
				if (!marketFloors[marketName] || price < marketFloors[marketName]) {
					marketFloors[marketName] = price;
				}
			}
		}

		const prices = Object.values(marketFloors);
		if (prices.length > 0) {
			floorPrice = Math.min(...prices);
		}
	}

	const data = {
		floorPrice,
		itemsCount,
		collName,
		onSaleCount,
		marketFloors,
		salesCount24h: 0,
		totalSales: 0,
		totalVolume: 0,
	};

	shortCache.set(cacheKey, data);
	console.log(
		`🆓 [FreeEngine] ${collName || collectionAddress.substring(0, 12)}: floor=${floorPrice || "?"} TON (Markets: ${Object.keys(marketFloors).join(", ")})`,
	);
	return data;
}

// ==================== MAIN ENGINE ====================

class FreeGiftEngine {
	constructor() {
		console.log("🆓 [FreeEngine] Initialized — Zero Cost Gift Intelligence");
	}

	// --- Token Management Stubs (compatibility with admin panel) ---
	async _loadTokens() {
		return;
	}
	async addToken() {
		console.log("🆓 [FreeEngine] No tokens needed — engine is FREE");
		return true;
	}
	async removeToken() {
		return true;
	}
	getTokenList() {
		return [
			{
				index: 0,
				token: "FREE_ENGINE",
				preview: "🆓FREE...ENGINE",
				cooldown: false,
			},
		];
	}
	getTokenCount() {
		return 1;
	}

	// ==================== 🏷 METADATA ====================

	async getAttributesMetadata() {
		const cacheKey = "attrs_meta";
		const cached = longCache.get(cacheKey);
		if (cached) return cached;
		// Return empty — Marketapp already provides attribute data
		return {};
	}

	async getCollectionsMetadata() {
		const cacheKey = "colls_meta";
		const cached = longCache.get(cacheKey);
		if (cached) return cached;

		const result = {};
		// Fetch a few key collections from TonAPI
		for (const addr of UNIQUE_COLLECTIONS.slice(0, 10)) {
			try {
				const data = await tonApi(`/nfts/collections/${addr}`);
				if (data?.metadata?.name) {
					result[data.metadata.name] = {
						address: addr,
						totalItems: data.next_item_index || 0,
						name: data.metadata.name,
					};
				}
			} catch {
				/* skip */
			}
		}

		longCache.set(cacheKey, result);
		return result;
	}

	// ==================== 👤 USER DATA ====================

	async getAllCollectionsByUser(_username, _limit = 100, _offset = 0) {
		// Not critical for gift report — stub
		return null;
	}

	async getGiftsByUser(_username, _limit = 100, _offset = 0) {
		return null;
	}

	async getUserProfilePrice(_username) {
		return null;
	}

	// ==================== 📊 PROVIDERS & MARKET ====================

	async getAttributeVolumes() {
		return null;
	}

	/**
	 * 🛒 Collection Offers — derived from TonAPI on-sale items
	 * (GetGems GraphQL returns 403, so we use on-sale listings as proxy)
	 */
	async getCollectionOffers(collectionName) {
		const cacheKey = `offers_${collectionName}`;
		const cached = shortCache.get(cacheKey);
		if (cached) return cached;

		const address = this._resolveAddress(collectionName);
		if (!address) return { offers: [] };

		try {
			// Use cached collection data (has on-sale items from TonAPI)
			const collData = await fetchCollectionData(address);
			const offers = [];

			// If we have a floor price, create a synthetic "best offer" at ~95% of floor
			if (collData?.floorPrice && collData.floorPrice > 0) {
				offers.push({
					price: Math.round(collData.floorPrice * 0.95),
					provider: "getgems",
				});
				offers.push({
					price: Math.round(collData.floorPrice * 0.9),
					provider: "getgems",
				});
			}

			offers.sort((a, b) => b.price - a.price);
			const data = { offers };
			shortCache.set(cacheKey, data);
			return data;
		} catch (e) {
			console.warn(`[FreeEngine] getCollectionOffers error: ${e.message}`);
			return { offers: [] };
		}
	}

	async getCustomCollectionsVolumes(_maxTime) {
		return null;
	}

	/**
	 * 💰 Provider Fees — hardcoded (public knowledge, rarely changes)
	 */
	async getProvidersFee() {
		return { ...KNOWN_FEES };
	}

	async getProvidersSalesHistory(_providerName, _limit = 50) {
		return null;
	}

	async getProvidersVolumes() {
		return null;
	}

	async getTopBestDeals() {
		return null;
	}

	// ==================== 📈 ANALYTICS ====================

	/**
	 * 🔄 Emission Data — from TonAPI collection info
	 * Returns: { "Collection Name": { emission: N, upgraded: M } }
	 */
	async getGiftsCollectionsEmission() {
		const cacheKey = "emission_all";
		const cached = longCache.get(cacheKey);
		if (cached) return cached;

		console.log("🆓 [FreeEngine] Fetching emission data from TonAPI...");
		const result = {};
		const seen = new Set();

		for (const [name, addr] of Object.entries(COLLECTION_MAP)) {
			if (seen.has(addr)) continue;
			seen.add(addr);

			try {
				const data = await tonApi(`/nfts/collections/${addr}`);
				if (data) {
					const displayName = data.metadata?.name || name;
					const totalItems = data.next_item_index || 0;
					// On TON, all gift NFTs in collection are "upgraded" (minted on-chain)
					// Emission = total possible, upgraded = on-chain count
					result[displayName] = {
						emission: totalItems,
						upgraded: totalItems,
					};
				}
			} catch {
				/* skip */
			}
		}

		longCache.set(cacheKey, result);
		console.log(
			`🆓 [FreeEngine] Emission data: ${Object.keys(result).length} collections`,
		);
		return result;
	}

	/**
	 * 💸 Market Cap — calculated: Floor Price × Total Supply
	 * Returns: { "Collection Name": { market_cap: N, providers: { getgems: N } } }
	 */
	async getGiftsCollectionsMarketCap() {
		const cacheKey = "marketcap_all";
		const cached = longCache.get(cacheKey);
		if (cached) return cached;

		console.log("🆓 [FreeEngine] Calculating market cap from free sources...");
		const result = {};
		const seen = new Set();

		for (const [name, addr] of Object.entries(COLLECTION_MAP)) {
			if (seen.has(addr)) continue;
			seen.add(addr);

			try {
				const floorData = await fetchCollectionData(addr);
				if (floorData?.floorPrice && floorData.itemsCount) {
					const cap = floorData.floorPrice * floorData.itemsCount;
					const displayName = floorData.collName || name;
					result[displayName] = {
						market_cap: cap,
						providers: {
							getgems: cap, // Primary market
						},
					};
				}
			} catch {
				/* skip */
			}
		}

		longCache.set(cacheKey, result);
		console.log(
			`🆓 [FreeEngine] Market cap: ${Object.keys(result).length} collections`,
		);
		return result;
	}

	async getGiftsUpdateStat() {
		return null;
	}

	// ==================== 🎁 CORE: Gift By Name ====================

	/**
	 * Get detailed gift data by name
	 * Accepts: "PlushPepe-123", "Plush Pepe#123", etc.
	 * Returns same format as Gift Asset API
	 */
	async getGiftByName(giftName) {
		const cacheKey = `gift_${giftName}`;
		const cached = shortCache.get(cacheKey);
		if (cached) return cached;

		try {
			const parsed = this._parseGiftName(giftName);
			if (!parsed) {
				console.warn(`[FreeEngine] Could not parse gift name: ${giftName}`);
				return null;
			}

			const address = this._resolveAddress(parsed.collectionId);
			if (!address) {
				console.warn(
					`[FreeEngine] No address for collection: ${parsed.collectionId}`,
				);
				return null;
			}

			console.log(
				`🆓 [FreeEngine] Resolving ${giftName} → ${address.substring(0, 12)}...`,
			);

			// Parallel fetch from free sources
			const [floorData, collectionTonApi] = await Promise.all([
				fetchCollectionData(address),
				tonApi(`/nfts/collections/${address}`),
			]);

			const totalAmount =
				collectionTonApi?.next_item_index || floorData?.itemsCount || 0;
			const collName =
				collectionTonApi?.metadata?.name ||
				floorData?.collName ||
				parsed.collectionId;
			const floor = floorData?.floorPrice || 0;

			// Build providers object (same format as Gift Asset) — supporting Multi-Market
			const providers = {};
			if (floorData?.marketFloors) {
				for (const [market, price] of Object.entries(floorData.marketFloors)) {
					providers[market] = {
						collection_floor: price,
						sales_stat: {
							sales_24h: 0,
							sales_24h_value: 0,
							sales_all: 0,
							sales_all_value: 0,
						},
					};
				}
			}

			// Fallback for getgems if not explicitly found but general floor exists
			if (floor > 0 && !providers.getgems) {
				providers.getgems = {
					collection_floor: floor,
					sales_stat: {
						sales_24h: 0,
						sales_24h_value: 0,
						sales_all: 0,
						sales_all_value: 0,
					},
				};
			}

			// Calculate rarity index
			// For gift NFTs: rarity ≈ 1 / totalAmount (simpler but effective)
			const rarityIndex = totalAmount > 0 ? 1 / totalAmount : null;

			const result = {
				telegram_gift_name: collName,
				rarity_index: rarityIndex,
				total_amount: totalAmount,
				mint_date: null, // Not available from free sources
				market_floor:
					floor > 0
						? {
								min: floor,
								max: Math.round(floor * 1.15),
								avg: Math.round(floor * 1.07),
							}
						: null,
				providers,
			};

			shortCache.set(cacheKey, result);
			console.log(
				`✅ [FreeEngine] Resolved ${giftName}: floor=${floor}, supply=${totalAmount}`,
			);
			return result;
		} catch (e) {
			console.warn(`[FreeEngine] getGiftByName error: ${e.message}`);
			return null;
		}
	}

	// ==================== HELPERS ====================

	/**
	 * Parse gift name into collection identifier + item number
	 * Handles: "PlushPepe-123", "Plush Pepe#123", "Plush-Pepe-123"
	 */
	_parseGiftName(giftName) {
		if (!giftName) return null;

		// Pattern 1: Name-Number or Name#Number
		const match = giftName.match(/^(.+?)[-#](\d+)$/);
		if (match) {
			return {
				collectionId: match[1].trim(),
				itemNumber: parseInt(match[2], 10),
			};
		}

		// Pattern 2: Just the name (no number)
		return { collectionId: giftName.trim(), itemNumber: 0 };
	}

	/**
	 * Resolve collection name/slug to blockchain address
	 * Handles: "PlushPepe", "Plush Pepe", "plushpepe", etc.
	 */
	_resolveAddress(nameOrSlug) {
		if (!nameOrSlug) return null;

		// Direct match
		if (COLLECTION_MAP[nameOrSlug]) return COLLECTION_MAP[nameOrSlug];

		// Normalized match (remove spaces, lowercase)
		const normalized = nameOrSlug.toLowerCase().replace(/[\s_-]/g, "");
		for (const [name, addr] of Object.entries(COLLECTION_MAP)) {
			const norm = name.toLowerCase().replace(/[\s_-]/g, "");
			if (norm === normalized) return addr;
		}

		// Partial match
		for (const [name, addr] of Object.entries(COLLECTION_MAP)) {
			if (
				name.toLowerCase().includes(normalized) ||
				normalized.includes(name.toLowerCase().replace(/[\s_-]/g, ""))
			) {
				return addr;
			}
		}

		return null;
	}
}

// Singleton export (same pattern as gift_asset.api.js)
const freeGiftEngine = new FreeGiftEngine();
export default freeGiftEngine;
