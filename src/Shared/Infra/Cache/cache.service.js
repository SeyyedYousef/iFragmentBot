/**
 * Improved Cache Service with LRU eviction and automatic cleanup
 * Designed for scalability with proper memory management
 */

const DEFAULT_TTL_MINUTES = 5;
const MAX_CACHE_SIZE = 10000; // Maximum entries per cache
const CLEANUP_INTERVAL_MS = 60 * 1000; // Run cleanup every minute

/**
 * Enhanced Cache with LRU eviction and automatic cleanup
 */
class Cache {
	constructor(ttlMinutes = DEFAULT_TTL_MINUTES, maxSize = MAX_CACHE_SIZE) {
		this.store = new Map();
		this.ttl = ttlMinutes * 60 * 1000;
		this.maxSize = maxSize;
		this.hits = 0;
		this.misses = 0;

		// Start automatic cleanup
		this.startCleanup();
	}

	/**
	 * Get a value from cache (with TTL check)
	 */
	get(key) {
		const item = this.store.get(key);
		if (!item) {
			this.misses++;
			return null;
		}

		// Check TTL
		if (Date.now() > item.expiry) {
			this.store.delete(key);
			this.misses++;
			return null;
		}

		// Update access time for LRU
		item.lastAccess = Date.now();
		this.hits++;

		return item.value;
	}

	/**
	 * Set a value in cache
	 */
	set(key, value) {
		// Evict if at max size
		if (this.store.size >= this.maxSize) {
			this.evictLRU();
		}

		this.store.set(key, {
			value,
			expiry: Date.now() + this.ttl,
			lastAccess: Date.now(),
		});
	}

	/**
	 * Check if key exists and is not expired
	 */
	has(key) {
		return this.get(key) !== null;
	}

	/**
	 * Delete a specific key
	 */
	delete(key) {
		return this.store.delete(key);
	}

	/**
	 * Clear all entries
	 */
	clear() {
		this.store.clear();
		this.hits = 0;
		this.misses = 0;
	}

	/**
	 * Get cache statistics
	 */
	stats() {
		const hitRate =
			this.hits + this.misses > 0
				? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1)
				: 0;

		return {
			size: this.store.size,
			maxSize: this.maxSize,
			hits: this.hits,
			misses: this.misses,
			hitRate: `${hitRate}%`,
			memoryEstimate: this.estimateMemory(),
		};
	}

	/**
	 * Evict least recently used items
	 */
	evictLRU() {
		// Find entries to evict (oldest 10%)
		const evictCount = Math.max(1, Math.floor(this.store.size * 0.1));

		const entries = Array.from(this.store.entries())
			.sort((a, b) => a[1].lastAccess - b[1].lastAccess)
			.slice(0, evictCount);

		for (const [key] of entries) {
			this.store.delete(key);
		}

		console.log(`♻️ Cache evicted ${evictCount} LRU entries`);
	}

	/**
	 * Clean expired entries
	 */
	cleanup() {
		const now = Date.now();
		let cleaned = 0;

		for (const [key, item] of this.store.entries()) {
			if (now > item.expiry) {
				this.store.delete(key);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			console.log(`🧹 Cache cleaned ${cleaned} expired entries`);
		}
	}

	/**
	 * Start automatic cleanup interval
	 */
	startCleanup() {
		this._cleanupInterval = setInterval(() => {
			this.cleanup();
		}, CLEANUP_INTERVAL_MS);

		// Don't keep process alive just for cleanup
		if (this._cleanupInterval.unref) {
			this._cleanupInterval.unref();
		}
	}

	/**
	 * Stop automatic cleanup
	 */
	stopCleanup() {
		if (this._cleanupInterval) {
			clearInterval(this._cleanupInterval);
		}
	}

	/**
	 * Estimate memory usage
	 */
	estimateMemory() {
		// Rough estimate: assume average 1KB per entry
		const bytes = this.store.size * 1024;
		if (bytes < 1024 * 1024) {
			return `${(bytes / 1024).toFixed(1)} KB`;
		}
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
}

// Create cache instances with appropriate settings
export const fragmentCache = new Cache(10, 5000); // 10 min TTL, max 5000 entries
export const portfolioCache = new Cache(5, 2000); // 5 min TTL, max 2000 entries
export const tonPriceCache = new Cache(30, 10); // 30 min TTL for floor prices & rates
export const giftValuationCache = new Cache(15, 3000); // 15 min TTL for gift valuation API responses

/**
 * Get all cache statistics
 */
export function getAllCacheStats() {
	return {
		fragment: fragmentCache.stats(),
		portfolio: portfolioCache.stats(),
		tonPrice: tonPriceCache.stats(),
		giftValuation: giftValuationCache.stats(),
	};
}

/**
 * Clear all caches
 */
export function clearAllCaches() {
	fragmentCache.clear();
	portfolioCache.clear();
	tonPriceCache.clear();
	console.log("🗑️ All caches cleared");
}

console.log("📦 Cache service initialized (LRU eviction enabled)");
