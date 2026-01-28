/**
 * State Service - Manages user states with memory limits and automatic cleanup
 * Designed for scalability with efficient memory usage
 */

const MAX_STATES = 50000;           // Maximum concurrent states
const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const CLEANUP_INTERVAL_MS = 60 * 1000; // Cleanup every minute

class StateManager {
    constructor() {
        this.states = new Map();
        this.startCleanup();
        console.log(`🧠 State manager initialized (max: ${MAX_STATES} states)`);
    }

    /**
     * Get state for a user/chat
     */
    get(key) {
        const state = this.states.get(String(key));
        if (!state) return null;

        // Check if expired
        if (Date.now() > state.expiry) {
            this.states.delete(String(key));
            return null;
        }

        // Refresh timestamp on access
        state.expiry = Date.now() + STATE_TTL_MS;
        return state.data;
    }

    /**
     * Set state for a user/chat
     */
    set(key, data) {
        // Evict if at max capacity
        if (this.states.size >= MAX_STATES) {
            this.evictOldest();
        }

        this.states.set(String(key), {
            data: { ...data, timestamp: Date.now() },
            expiry: Date.now() + STATE_TTL_MS,
            createdAt: Date.now()
        });
    }

    /**
     * Delete state for a user/chat
     */
    delete(key) {
        return this.states.delete(String(key));
    }

    /**
     * Check if state exists
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Get all state keys
     */
    keys() {
        return Array.from(this.states.keys());
    }

    /**
     * Get current state count
     */
    get size() {
        return this.states.size;
    }

    /**
     * Evict oldest states when at capacity
     */
    evictOldest() {
        const evictCount = Math.max(1, Math.floor(this.states.size * 0.1));

        const entries = Array.from(this.states.entries())
            .sort((a, b) => a[1].createdAt - b[1].createdAt)
            .slice(0, evictCount);

        for (const [key] of entries) {
            this.states.delete(key);
        }

        console.log(`♻️ State manager evicted ${evictCount} old states`);
    }

    /**
     * Cleanup expired states
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, state] of this.states.entries()) {
            if (now > state.expiry) {
                this.states.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 State manager cleaned ${cleaned} expired states (remaining: ${this.states.size})`);
        }
    }

    /**
     * Start automatic cleanup
     */
    startCleanup() {
        this._cleanupInterval = setInterval(() => {
            this.cleanup();
        }, CLEANUP_INTERVAL_MS);

        if (this._cleanupInterval.unref) {
            this._cleanupInterval.unref();
        }
    }

    /**
     * Stop cleanup
     */
    stopCleanup() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
    }

    /**
     * Get statistics
     */
    stats() {
        return {
            size: this.states.size,
            maxSize: MAX_STATES,
            utilization: `${((this.states.size / MAX_STATES) * 100).toFixed(1)}%`,
        };
    }

    /**
     * Clear all states
     */
    clear() {
        this.states.clear();
    }
}

// Create singleton instance
export const stateManager = new StateManager();

/**
 * Compatibility layer: Get userStates Map interface
 * This allows existing code to work with minimal changes
 */
export const userStates = {
    get: (key) => stateManager.get(key),
    set: (key, value) => stateManager.set(key, value),
    delete: (key) => stateManager.delete(key),
    has: (key) => stateManager.has(key),
    entries: () => {
        const result = [];
        for (const key of stateManager.keys()) {
            result.push([key, stateManager.get(key)]);
        }
        return result[Symbol.iterator]();
    },
    get size() {
        return stateManager.size;
    },
};

export function getStateStats() {
    return stateManager.stats();
}
