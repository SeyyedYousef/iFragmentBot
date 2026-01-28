/**
 * Rate Limiter Service
 * Controls request rates to prevent overloading the bot
 */
import Bottleneck from 'bottleneck';

// ==================== GLOBAL RATE LIMITER ====================
// Controls overall system throughput
export const globalLimiter = new Bottleneck({
    maxConcurrent: 20,           // Max 20 concurrent operations
    minTime: 50,                 // Min 50ms between operations
    reservoir: 200,              // 200 requests per minute
    reservoirRefreshInterval: 60000,  // Refresh every minute
    reservoirRefreshAmount: 200,
    highWater: 50,               // Queue size warning
    strategy: Bottleneck.strategy.OVERFLOW_PRIORITY,
    penalty: 1000,               // Penalty for rejected requests
});

// ==================== FRAGMENT SCRAPING LIMITER ====================
// Controls Puppeteer operations (heavy resource usage)
export const fragmentLimiter = new Bottleneck({
    maxConcurrent: 5,            // Max 5 concurrent browser tabs
    minTime: 500,                // Min 500ms between scrapes
    reservoir: 60,               // 60 scrapes per minute max
    reservoirRefreshInterval: 60000,
    reservoirRefreshAmount: 60,
});

// ==================== PER-USER RATE LIMITER ====================
// Tracks per-user request rates using a Map of limiters
const userLimiters = new Map();
const USER_LIMITER_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get or create a rate limiter for a specific user
 */
export function getUserLimiter(userId) {
    const key = String(userId);

    if (userLimiters.has(key)) {
        const { limiter, lastUsed } = userLimiters.get(key);
        userLimiters.set(key, { limiter, lastUsed: Date.now() });
        return limiter;
    }

    const limiter = new Bottleneck({
        maxConcurrent: 2,        // Max 2 concurrent requests per user
        minTime: 1000,           // Min 1 second between requests
        reservoir: 10,           // 10 requests per minute per user
        reservoirRefreshInterval: 60000,
        reservoirRefreshAmount: 10,
    });

    userLimiters.set(key, { limiter, lastUsed: Date.now() });
    return limiter;
}

// Cleanup old user limiters every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, { lastUsed }] of userLimiters.entries()) {
        if (now - lastUsed > USER_LIMITER_TTL) {
            userLimiters.delete(key);
        }
    }
}, 5 * 60 * 1000);

// ==================== HELPER FUNCTIONS ====================

/**
 * Wrap a function with global rate limiting
 */
export function withGlobalLimit(fn) {
    return globalLimiter.wrap(fn);
}

/**
 * Wrap a function with fragment-specific rate limiting
 */
export function withFragmentLimit(fn) {
    return fragmentLimiter.wrap(fn);
}

/**
 * Execute a function with per-user rate limiting
 */
export async function withUserLimit(userId, fn) {
    const limiter = getUserLimiter(userId);
    return limiter.schedule(fn);
}

/**
 * Get current limiter statistics
 */
export function getLimiterStats() {
    return {
        global: {
            running: globalLimiter.running(),
            queued: globalLimiter.queued(),
            done: globalLimiter.done(),
        },
        fragment: {
            running: fragmentLimiter.running(),
            queued: fragmentLimiter.queued(),
            done: fragmentLimiter.done(),
        },
        userLimitersCount: userLimiters.size,
    };
}

/**
 * Check if system is overloaded
 */
export function isOverloaded() {
    return globalLimiter.queued() > 30 || fragmentLimiter.queued() > 10;
}

/**
 * Get estimated wait time in seconds
 */
export function getEstimatedWaitTime() {
    const fragmentQueued = fragmentLimiter.queued();
    const avgTimePerRequest = 5; // 5 seconds average for fragment scraping
    return Math.ceil(fragmentQueued * avgTimePerRequest);
}

// ==================== LOGGING ====================

// Log limiter events for debugging
globalLimiter.on('error', (error) => {
    console.error('🚦 Global limiter error:', error.message);
});

fragmentLimiter.on('error', (error) => {
    console.error('🚦 Fragment limiter error:', error.message);
});

globalLimiter.on('dropped', (dropped) => {
    console.warn('🚦 Request dropped due to high water:', dropped);
});

console.log('🚦 Rate limiters initialized');
