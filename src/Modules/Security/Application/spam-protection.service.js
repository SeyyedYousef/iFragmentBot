/**
 * Spam Protection Service
 * Provides middleware to prevent flood attacks and spam
 */
import { CONFIG } from '../../../core/Config/app.config.js';

class SpamProtectionService {
    constructor() {
        this.userHistory = new Map(); // userId -> { lastMessageTime, violationCount, bannedUntil }
        this.warningCache = new Map(); // userId -> lastWarningTime

        // Configuration
        this.limits = {
            windowMs: 3000,      // 3 second window
            maxMessages: 4,      // Max 4 messages per window
            banTimes: [          // Ban durations in ms
                60 * 1000,       // Level 1: 1 minute
                15 * 60 * 1000,  // Level 2: 15 minutes
                60 * 60 * 1000,  // Level 3: 1 hour
                24 * 60 * 60 * 1000 // Level 4: 24 hours
            ]
        };

        // Admins who bypass checks
        const adminIds = CONFIG.ADMIN_IDS || (CONFIG.ADMIN_ID ? [CONFIG.ADMIN_ID] : []);
        this.admins = new Set(adminIds);

        // Cleanup interval (every 10 minutes)
        setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }

    /**
     * Check if user is currently banned
     */
    isBanned(userId) {
        const history = this.userHistory.get(userId);
        if (!history) return false;

        if (history.bannedUntil && Date.now() < history.bannedUntil) {
            return true;
        }

        // Auto-expire ban if time passed
        if (history.bannedUntil && Date.now() >= history.bannedUntil) {
            history.bannedUntil = null;
            // Decay violation count slightly so they don't immediately get long ban again
            history.violationCount = Math.max(0, history.violationCount - 1);
        }

        return false;
    }

    /**
     * Middleware function for Telegraf
     */
    middleware() {
        return async (ctx, next) => {
            if (!ctx.from) return next();

            const userId = ctx.from.id;

            // 1. Bypass Admins
            if (this.admins.has(userId)) {
                return next();
            }

            // 2. Check Ban Status
            if (this.isBanned(userId)) {
                // Silently ignore banned users to save resources
                return;
            }

            // 3. Rate Limit Check
            if (this.checkRateLimit(userId)) {
                return next();
            } else {
                // 4. Handle Limit Exceeded
                await this.punishUser(ctx, userId);
            }
        };
    }

    /**
     * Check if user is within rate limits
     * Returns true if allowed, false if limit exceeded
     */
    checkRateLimit(userId) {
        const now = Date.now();

        if (!this.userHistory.has(userId)) {
            this.userHistory.set(userId, {
                messages: [],
                violationCount: 0,
                bannedUntil: null
            });
        }

        const history = this.userHistory.get(userId);

        // Filter messages within current window
        history.messages = history.messages.filter(time => now - time < this.limits.windowMs);

        // Add current message
        history.messages.push(now);

        // Check count
        if (history.messages.length > this.limits.maxMessages) {
            return false;
        }

        return true;
    }

    /**
     * Punish user for spamming
     */
    async punishUser(ctx, userId) {
        const history = this.userHistory.get(userId);

        // Increment violation level
        const level = Math.min(history.violationCount, this.limits.banTimes.length - 1);
        const banDuration = this.limits.banTimes[level];

        history.bannedUntil = Date.now() + banDuration;
        history.violationCount++;

        // Send warning (only if not recently warned to avoid spamming the warning itself)
        const lastWarning = this.warningCache.get(userId) || 0;
        if (Date.now() - lastWarning > 5000) {
            this.warningCache.set(userId, Date.now());

            const minutes = Math.ceil(banDuration / 60000);
            const emoji = ['⚠️', '⛔', '🚫', '🛑'][Math.min(level, 3)];

            try {
                await ctx.reply(
                    `${emoji} *Anti-Spam Protection*\n\n` +
                    `You are sending messages too fast.\n` +
                    `You have been temporarily ignored for *${minutes} minutes*.\n\n` +
                    `_Please slow down to avoid longer bans._`,
                    { parse_mode: 'Markdown' }
                );
            } catch (e) {
                // Ignore errors if can't reply
                console.error('Failed to send spam warning:', e.message);
            }
        }
    }

    /**
     * Clean up stale user data
     */
    cleanup() {
        const now = Date.now();
        for (const [userId, history] of this.userHistory.entries()) {
            // Keep if banned
            if (history.bannedUntil && history.bannedUntil > now) continue;

            // Keep if recently active (last 5 min)
            const lastMsg = history.messages[history.messages.length - 1] || 0;
            if (now - lastMsg < 5 * 60 * 1000) continue;

            // Keep if has violation history (decay over time? for now just keep for a day if violated)
            if (history.violationCount > 0 && now - lastMsg < 24 * 60 * 60 * 1000) continue;

            // Delete safe users
            this.userHistory.delete(userId);
            this.warningCache.delete(userId);
        }
    }
}

export const spamProtection = new SpamProtectionService();
