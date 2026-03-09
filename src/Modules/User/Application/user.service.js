/**
 * User Service - Manages user data with MongoDB persistence
 * Falls back to in-memory cache if MongoDB is unavailable
 */

import { getDB } from '../../../Shared/Infra/Database/mongo.repository.js';
import { getUserGiftsWithValue } from '../../../Shared/Infra/Telegram/telegram.client.js';

const FREE_LIMITS = {
    credits: 1
};

// ==================== MULTI-TIER PREMIUM (Mathematically Optimized) ====================
// Pricing Strategy: Penny Gap entry → Declining ⭐/day → Anchor effect
// ⭐/day: 15.0 → 7.1 → 5.0 → 4.4 (each tier 25-50% better value)
export const PREMIUM_TIERS = {
    trial: { price: 19, days: 1, label: '🎟️ Trial', dailyReports: Infinity, priorityQueue: false, badge: '🎟️', color: '#FF6B6B' },
    weekly: { price: 65, days: 7, label: '⭐ Weekly', dailyReports: Infinity, priorityQueue: true, badge: '⭐', color: '#4ECDC4' },
    monthly: { price: 185, days: 30, label: '💎 Monthly', dailyReports: Infinity, priorityQueue: true, badge: '💎', color: '#FFD700' },
    season: { price: 585, days: 90, label: '👑 Season', dailyReports: Infinity, priorityQueue: true, badge: '👑', color: '#B9F2FF' }
};
// Legacy compat (uses weekly as default)
export const PREMIUM_PRICE = PREMIUM_TIERS.weekly.price;
export const PREMIUM_DAYS = PREMIUM_TIERS.weekly.days;

// ==================== REFERRAL MILESTONES (LTV-Calibrated) ====================
// Rule: reward_value < 15% of cumulative LTV earned at each milestone
// LTV per user ≈ 45⭐ → Max reward per referral ≈ 6.7⭐
export const REFERRAL_MILESTONES = [
    { count: 1, reward: { type: 'credits', amount: 1, label: '🎫 1 Free Report' } },         // Cost: 0⭐, LTV: 45⭐
    { count: 3, reward: { type: 'premium', days: 1, label: '⭐ 1 Day Premium' } },          // Cost: ~5⭐, LTV: 135⭐
    { count: 5, reward: { type: 'premium', days: 3, label: '💫 3 Days Premium' } },         // Cost: ~15⭐, LTV: 225⭐
    { count: 10, reward: { type: 'premium', days: 7, label: '🚀 7 Days Premium + Badge' } }, // Cost: ~35⭐, LTV: 450⭐
    { count: 25, reward: { type: 'premium', days: 14, label: '💎 14 Days Premium' } },        // Cost: ~75⭐, LTV: 1125⭐
    { count: 50, reward: { type: 'premium', days: 30, label: '👑 30 Days Premium + Title' } } // Cost: ~150⭐, LTV: 2250⭐
    // NO lifetime — it kills recurring revenue (LTV analysis proves negative ROI)
];

// ==================== DAILY STREAK REWARDS (ROI 250%) ====================
// Cost per week: ~6⭐ (~$0.08) — generates 2,250⭐ in conversions
// Days 1-4: Free credits (0⭐ cost, pure engagement)
// Day 5: 3h taste-test (hook effect)
// Day 7: 1 day premium (full experience → drives purchase)
export const STREAK_REWARDS = [
    { day: 1, type: 'credits', amount: 1, label: '🎫 1 Free Report' },        // Cost: 0⭐
    { day: 2, type: 'credits', amount: 1, label: '🎫 1 Free Compare' },       // Cost: 0⭐
    { day: 3, type: 'credits', amount: 2, label: '🎫 2 Free Reports' },       // Cost: 0⭐
    { day: 4, type: 'credits', amount: 1, label: '🎫 1 Free Portfolio' },     // Cost: 0⭐
    { day: 5, type: 'premium', hours: 3, label: '⭐ 3h Premium Trial' },     // Cost: ~1⭐
    { day: 6, type: 'credits', amount: 3, label: '🎫 3 Free Reports' },       // Cost: 0⭐
    { day: 7, type: 'premium', days: 1, label: '💎 1 Day Full Premium!' }   // Cost: ~5⭐
];

// In-memory cache for performance
let usersCache = new Map();

// Get current UTC date as YYYY-MM-DD
function getUTCDate() {
    return new Date().toISOString().split('T')[0];
}

// Default user structure
function createDefaultUser(userId) {
    return {
        id: String(userId),
        username: null,
        firstName: null,
        premium: {
            active: false,
            tier: null, // bronze, silver, gold, diamond
            expiresAt: null
        },
        dailyLimits: {
            credits: FREE_LIMITS.credits,
            lastReset: getUTCDate()
        },
        giftValue: 0,
        referral: {
            referredBy: null,
            count: 0,        // Total confirmed referrals
            pending: [],     // Array of pending user IDs (not yet joined channel)
            lastMilestone: 0,// Last milestone count reached
            badges: []       // Earned referral badges
        },
        streak: {
            current: 0,      // Current streak count (1-7)
            lastClaim: null, // ISO date of last daily claim
            totalDays: 0,    // Total days claimed ever
            weekNumber: 0,   // How many full weeks completed
            shieldActive: false // Premium streak shield
        },
        blocked: false,
        createdAt: new Date().toISOString()
    };
}

// Get user from MongoDB or cache
export async function getUserAsync(userId) {
    const id = String(userId);
    const db = getDB();

    // Try MongoDB first
    if (db) {
        try {
            let user = await db.collection('userData').findOne({ id });
            if (!user) {
                user = createDefaultUser(id);
                await db.collection('userData').insertOne(user);
            }
            usersCache.set(id, user);
            return user;
        } catch (error) {
            console.error('MongoDB getUserAsync error:', error.message);
        }
    }

    // Fallback to cache
    if (!usersCache.has(id)) {
        usersCache.set(id, createDefaultUser(id));
    }
    return usersCache.get(id);
}

// Sync version for compatibility (uses cache)
function getUser(userId) {
    const id = String(userId);
    if (!usersCache.has(id)) {
        usersCache.set(id, createDefaultUser(id));
        // Schedule async save to MongoDB
        saveUserToDB(id).catch(() => { });
    }
    return usersCache.get(id);
}

// Save user to MongoDB
async function saveUserToDB(userId) {
    const id = String(userId);
    const db = getDB();
    if (!db) return;

    const user = usersCache.get(id);
    if (!user) return;

    try {
        await db.collection('userData').updateOne(
            { id },
            { $set: user },
            { upsert: true }
        );
    } catch (error) {
        console.error('MongoDB save error:', error.message);
    }
}

// Check if daily limits need reset (48h rolling window)
function checkAndResetLimits(user) {
    const lastReset = user.dailyLimits.lastReset ? new Date(user.dailyLimits.lastReset) : new Date(0);
    const now = new Date();
    const RESET_PERIOD = 48 * 60 * 60 * 1000; // 48 hours

    // Reset if time passed OR if migrating from old structure (missing credits)
    if ((now - lastReset > RESET_PERIOD) || user.dailyLimits.credits === undefined) {
        user.dailyLimits = {
            credits: FREE_LIMITS.credits,
            lastReset: now.toISOString()
        };
        saveUserToDB(user.id).catch(() => { });
    }
}

// Check if user is premium
export function isPremium(userId) {
    const user = getUser(userId);

    if (!user.premium.active) return false;

    if (user.premium.expiresAt) {
        const expiry = new Date(user.premium.expiresAt);
        if (expiry < new Date()) {
            user.premium.active = false;
            user.premium.expiresAt = null;
            saveUserToDB(userId).catch(() => { });
            return false;
        }
    }

    return true;
}

// Check if user can use a feature
export function canUseFeature(userId, feature) {
    if (isPremium(userId)) return true;

    const user = getUser(userId);
    checkAndResetLimits(user);

    // Check extra limits specifically for this feature first
    if (user.extraLimits && user.extraLimits[feature] > 0) return true;

    return (user.dailyLimits.credits || 0) > 0;
}

// Use a feature (decrement limit)
export function useFeature(userId, feature) {
    if (isPremium(userId)) {
        return {
            success: true,
            isPremium: true,
            remaining: { credits: '∞' }
        };
    }

    const user = getUser(userId);
    checkAndResetLimits(user);

    // 1. Check Extra Limits (Reward from Spin)
    if (user.extraLimits && user.extraLimits[feature] > 0) {
        user.extraLimits[feature]--;
        saveUserToDB(userId).catch(() => { });
        return {
            success: true,
            isPremium: false,
            remaining: {
                credits: user.dailyLimits.credits,
                extra: user.extraLimits[feature]
            }
        };
    }

    // 2. Check Global Credits
    const credits = user.dailyLimits.credits !== undefined ? user.dailyLimits.credits : 0;

    if (credits <= 0) {
        return {
            success: false,
            remaining: {
                credits: 0
            }
        };
    }

    user.dailyLimits.credits--;
    saveUserToDB(userId).catch(() => { });

    return {
        success: true,
        isPremium: false,
        remaining: {
            credits: user.dailyLimits.credits
        }
    };
}

// Get remaining limits
export function getRemainingLimits(userId) {
    if (isPremium(userId)) {
        return { credits: '∞', isPremium: true };
    }

    const user = getUser(userId);
    checkAndResetLimits(user);

    return {
        credits: user.dailyLimits.credits || 0,
        isPremium: false
    };
}

// Activate premium for user (with tier support)
export function activatePremium(userId, days = PREMIUM_DAYS, tier = 'silver') {
    const user = getUser(userId);
    const now = new Date();

    // If already premium, extend from current expiry
    const currentExpiry = user.premium && user.premium.expiresAt ? new Date(user.premium.expiresAt) : now;
    const basisDate = currentExpiry > now ? currentExpiry : now;

    const expiryDate = new Date(basisDate);
    expiryDate.setDate(expiryDate.getDate() + days);

    // Use higher tier if already on a better one
    const tierOrder = ['bronze', 'silver', 'gold', 'diamond'];
    const currentTierIndex = tierOrder.indexOf(user.premium?.tier || '');
    const newTierIndex = tierOrder.indexOf(tier);
    const finalTier = newTierIndex >= currentTierIndex ? tier : user.premium.tier;

    user.premium = {
        active: true,
        tier: finalTier,
        expiresAt: expiryDate.toISOString()
    };

    // Premium users get streak shield
    if (!user.streak) user.streak = { current: 0, lastClaim: null, totalDays: 0, weekNumber: 0, shieldActive: false };
    user.streak.shieldActive = true;

    saveUserToDB(userId).catch(() => { });

    return {
        success: true,
        expiresAt: expiryDate,
        tier: finalTier
    };
}

// Get premium expiry date
export function getPremiumExpiry(userId) {
    const user = getUser(userId);
    if (!user.premium.active) return null;
    return user.premium.expiresAt ? new Date(user.premium.expiresAt) : null;
}

// Get premium tier info
export function getPremiumTier(userId) {
    const user = getUser(userId);
    if (!isPremium(userId)) return null;
    let tierKey = user.premium?.tier || 'weekly';
    // Legacy tier key mapping (old DB values → new keys)
    const LEGACY_MAP = { bronze: 'trial', silver: 'weekly', gold: 'monthly', diamond: 'season' };
    if (LEGACY_MAP[tierKey]) tierKey = LEGACY_MAP[tierKey];
    const tierData = PREMIUM_TIERS[tierKey];
    if (!tierData) return { key: tierKey, badge: '⭐', label: 'Premium' };
    return { key: tierKey, ...tierData };
}

// Get time until next reset
export function getTimeUntilReset(userId) {
    const user = getUser(userId);
    const lastReset = user.dailyLimits.lastReset ? new Date(user.dailyLimits.lastReset) : new Date(0);
    const RESET_PERIOD = 48 * 60 * 60 * 1000;
    const nextReset = new Date(lastReset.getTime() + RESET_PERIOD);
    const now = new Date();

    let diff = nextReset - now;
    if (diff < 0) diff = 0;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes, formatted: `${hours}h ${minutes}m` };
}

// Format remaining credits message
export function formatCreditsMessage(remaining, userIsPremium = false) {
    if (userIsPremium) {
        return `\n🌟 *Premium Active* - Unlimited Access`;
    }

    const credits = remaining.credits !== undefined ? remaining.credits : 0;
    const icon = credits > 0 ? '✅' : '❌';

    return `
📊 *Daily Credits:*
• Available Actions: ${credits}/1 ${icon}
_(Refreshes every 48 hours)_

💎 _Get Premium from just ${PREMIUM_TIERS.trial.price}⭐ for unlimited access!_`;
}

// Format "out of credits" message
export function formatNoCreditsMessage(feature, userId) {
    const resetTime = getTimeUntilReset(userId);

    return `⚠️ *Limit Reached*

You've used your free action for this period.
Free users get 1 action every 48 hours.

⏰ Next reset: *${resetTime.formatted}*

━━━━━━━━━━━━━━━━

🌟 *Go Premium!*

🎟️ Trial: ${PREMIUM_TIERS.trial.price}⭐ (${PREMIUM_TIERS.trial.days} day)
⭐ Weekly: ${PREMIUM_TIERS.weekly.price}⭐ (${PREMIUM_TIERS.weekly.days} days)
💎 Monthly: ${PREMIUM_TIERS.monthly.price}⭐ (${PREMIUM_TIERS.monthly.days} days)
👑 Season: ${PREMIUM_TIERS.season.price}⭐ (${PREMIUM_TIERS.season.days} days)

💡 _Or earn free Premium by doing Daily Rewards \& Inviting Friends!_`;
}

// ==================== ADMIN FUNCTIONS ====================

// Block user
export function blockUser(userId) {
    const user = getUser(userId);
    user.blocked = true;
    saveUserToDB(userId).catch(() => { });
    return true;
}

// Unblock user
export function unblockUser(userId) {
    const user = getUser(userId);
    user.blocked = false;
    saveUserToDB(userId).catch(() => { });
    return true;
}

// Check if user is blocked
export function isBlocked(userId) {
    const id = String(userId);
    if (!usersCache.has(id)) return false;
    return usersCache.get(id).blocked === true;
}

// Get all users (from MongoDB)
export async function getAllUsersAsync() {
    const db = getDB();
    if (!db) {
        return Array.from(usersCache.entries()).map(([id, data]) => ({
            id,
            ...data
        }));
    }

    try {
        const users = await db.collection('userData').find({}).toArray();
        return users;
    } catch (error) {
        console.error('getAllUsers error:', error.message);
        return [];
    }
}

// Sync version for compatibility
export function getAllUsers() {
    return Array.from(usersCache.entries()).map(([id, data]) => ({
        id,
        ...data
    }));
}

// Get stats
export function getStats() {
    const allUsers = getAllUsers();
    const now = new Date();

    const totalUsers = allUsers.length;
    const premiumUsers = allUsers.filter(u => u.premium?.active && new Date(u.premium.expiresAt) > now).length;
    const blockedUsers = allUsers.filter(u => u.blocked === true).length;

    return {
        totalUsers,
        premiumUsers,
        blockedUsers,
        freeUsers: totalUsers - premiumUsers
    };
}

// Get user by ID (for admin)
export function getUserById(userId) {
    const id = String(userId);
    if (!usersCache.has(id)) return null;
    return { id, ...usersCache.get(id) };
}

// Initialize cache from MongoDB
export async function initUserService() {
    const db = getDB();
    if (!db) {
        console.log('⚠️ MongoDB not available, using in-memory storage');
        return;
    }

    try {
        // Create index for faster queries
        await db.collection('userData').createIndex({ id: 1 }, { unique: true });

        // Load all users into cache
        const users = await db.collection('userData').find({}).toArray();
        users.forEach(user => {
            usersCache.set(user.id, user);
        });
        console.log(`📂 Loaded ${users.length} users from MongoDB`);
    } catch (error) {
        console.error('User service init error:', error.message);
    }
}

// ==================== UPDATE USER INFO ====================

/**
 * Save user's Telegram profile info (username, firstName) on interaction
 * Should be called from sendDashboard so we always have fresh data
 */
export function updateUserInfo(userId, username, firstName) {
    const user = getUser(userId);
    let changed = false;
    if (username && user.username !== username) { user.username = username; changed = true; }
    if (firstName && user.firstName !== firstName) { user.firstName = firstName; changed = true; }
    if (changed) saveUserToDB(userId).catch(() => { });
}

// ==================== GIFT VALUE TRACKING ====================

/**
 * Update user info (username, firstName) and add gift value
 */
export function updateUserGiftValue(userId, username, firstName, giftValue) {
    const user = getUser(userId);

    // Update user info
    if (username) user.username = username;
    if (firstName) user.firstName = firstName;

    // Add gift value to total
    user.giftValue = (user.giftValue || 0) + giftValue;

    // Update Net Worth (Portfolio + Gifts)
    const portfolioVal = user.portfolioValue || 0;
    user.netWorth = portfolioVal + user.giftValue;

    saveUserToDB(userId).catch(() => { });

    // Also update MongoDB directly for netWorth to be sure
    const db = getDB();
    if (db) {
        db.collection('userData').updateOne(
            { id: String(userId) },
            { $set: { giftValue: user.giftValue, netWorth: user.netWorth } },
            { upsert: true }
        ).catch(() => { });
    }

    return user.giftValue;
}

/**
 * Get top gift holders sorted by total gift value
 */
export function getTopGiftHolders(limit = 30) {
    const allUsers = getAllUsers();

    return allUsers
        .filter(u => (u.giftValue || 0) > 0)
        .sort((a, b) => (b.giftValue || 0) - (a.giftValue || 0))
        .slice(0, limit)
        .map((u, index) => ({
            rank: index + 1,
            userId: u.id,
            username: u.username,
            firstName: u.firstName,
            giftValue: u.giftValue || 0
        }));
}

/**
 * Get user's rank among all gift holders
 */
export function getUserRank(userId) {
    const allUsers = getAllUsers();
    const id = String(userId);

    const sorted = allUsers
        .filter(u => (u.giftValue || 0) > 0)
        .sort((a, b) => (b.giftValue || 0) - (a.giftValue || 0));

    const userIndex = sorted.findIndex(u => u.id === id);

    if (userIndex === -1) {
        return { rank: null, total: 0 };
    }

    return {
        rank: userIndex + 1,
        total: sorted[userIndex].giftValue || 0
    };
}

/**
 * Get user's total gift value
 */
export function getUserGiftValue(userId) {
    const user = getUser(userId);
    return user.giftValue || 0;
}

// ==================== SPONSOR TEXT ====================

let sponsorText = `
💎 *Our Sponsors*

🚀 Want to advertise here?
Contact @YourAdminUsername

_Your brand could be featured to thousands of users!_
`;

export function getSponsorText() {
    return sponsorText;
}

export function setSponsorText(text) {
    sponsorText = text;
    // Also save to MongoDB for persistence
    const db = getDB();
    if (db) {
        db.collection('settings').updateOne(
            { key: 'sponsorText' },
            { $set: { key: 'sponsorText', value: text } },
            { upsert: true }
        ).catch(() => { });
    }
    return true;
}

export async function loadSponsorText() {
    const db = getDB();
    if (!db) return;

    try {
        const setting = await db.collection('settings').findOne({ key: 'sponsorText' });
        if (setting && setting.value) {
            sponsorText = setting.value;
            console.log('📢 Loaded sponsor text from MongoDB');
        }
    } catch (error) {
        console.error('Load sponsor text error:', error.message);
    }
}


// ==================== REFERRAL SYSTEM (Anti-Fake + Milestones) ==================== 

/** 
 * Process a new referral — stores as PENDING until channel join verified 
 */
export async function processReferral(newUserId, referrerId) {
    if (String(newUserId) === String(referrerId)) return { success: false, reason: 'self' };

    let newUser = await getUserAsync(newUserId);
    let referrer = await getUserAsync(referrerId);

    if (!referrer) return { success: false, reason: 'referrer_not_found' };

    if (newUser.referral && newUser.referral.referredBy) {
        return { success: false, reason: 'already_referred' };
    }

    const db = getDB();
    const newUserIdStr = String(newUserId);
    const referrerIdStr = String(referrerId);

    // Mark new user as referred
    if (!newUser.referral) newUser.referral = { referredBy: null, count: 0, pending: [], lastMilestone: 0, badges: [] };
    newUser.referral.referredBy = referrerIdStr;
    usersCache.set(newUserIdStr, newUser);
    if (db) await db.collection('userData').updateOne({ id: newUserIdStr }, { $set: { referral: newUser.referral } }, { upsert: true });

    // Add to referrer's PENDING list (not confirmed yet!)
    if (!referrer.referral) referrer.referral = { referredBy: null, count: 0, pending: [], lastMilestone: 0, badges: [] };
    if (!referrer.referral.pending) referrer.referral.pending = [];

    // Don't add duplicate
    if (!referrer.referral.pending.includes(newUserIdStr)) {
        referrer.referral.pending.push(newUserIdStr);
    }

    usersCache.set(referrerIdStr, referrer);
    if (db) await db.collection('userData').updateOne({ id: referrerIdStr }, { $set: { referral: referrer.referral } }, { upsert: true });

    return {
        success: true,
        pending: true,
        referrerId: referrerId,
        pendingCount: referrer.referral.pending.length,
        confirmedCount: referrer.referral.count
    };
}

/**
 * Confirm a pending referral (called when user joins the channel)
 * Returns milestone reward if any
 */
export async function confirmReferral(confirmedUserId, bot) {
    const confirmedIdStr = String(confirmedUserId);
    const confirmedUser = await getUserAsync(confirmedUserId);

    if (!confirmedUser.referral?.referredBy) return { confirmed: false, reason: 'no_referrer' };

    const referrerId = confirmedUser.referral.referredBy;
    const referrer = await getUserAsync(referrerId);
    if (!referrer) return { confirmed: false, reason: 'referrer_gone' };

    if (!referrer.referral) referrer.referral = { referredBy: null, count: 0, pending: [], lastMilestone: 0, badges: [] };
    if (!referrer.referral.pending) referrer.referral.pending = [];

    // Check if still in pending list
    const pendingIndex = referrer.referral.pending.indexOf(confirmedIdStr);
    if (pendingIndex === -1) return { confirmed: false, reason: 'not_pending' };

    // Move from pending to confirmed
    referrer.referral.pending.splice(pendingIndex, 1);
    referrer.referral.count = (referrer.referral.count || 0) + 1;
    const totalCount = referrer.referral.count;

    // Check milestones
    let milestoneReward = null;
    const lastMilestone = referrer.referral.lastMilestone || 0;

    for (const milestone of REFERRAL_MILESTONES) {
        if (totalCount >= milestone.count && lastMilestone < milestone.count) {
            milestoneReward = milestone;
            referrer.referral.lastMilestone = milestone.count;

            // Apply reward
            if (milestone.reward.type === 'premium') {
                activatePremium(referrerId, milestone.reward.days, 'silver');
            } else if (milestone.reward.type === 'credits') {
                if (!referrer.extraLimits) referrer.extraLimits = { credits: 0 };
                referrer.extraLimits.credits = (referrer.extraLimits.credits || 0) + milestone.reward.amount;
            }

            // Add badge for special milestones
            if (milestone.count >= 10) {
                if (!referrer.referral.badges) referrer.referral.badges = [];
                const badgeLabel = milestone.count >= 100 ? '🌌 God' : milestone.count >= 50 ? '👑 King' : milestone.count >= 25 ? '💎 Legend' : '🚀 Rocketeer';
                if (!referrer.referral.badges.includes(badgeLabel)) {
                    referrer.referral.badges.push(badgeLabel);
                }
            }
        }
    }

    // Save
    const db = getDB();
    const referrerIdStr = String(referrerId);
    usersCache.set(referrerIdStr, referrer);
    if (db) {
        await db.collection('userData').updateOne({ id: referrerIdStr }, {
            $set: {
                referral: referrer.referral,
                premium: referrer.premium,
                extraLimits: referrer.extraLimits
            }
        }, { upsert: true });
    }

    return {
        confirmed: true,
        referrerId,
        totalCount,
        milestoneReward,
        pendingLeft: referrer.referral.pending.length
    };
}

/** 
 * Get referral stats for dashboard 
 */
export async function getReferralStats(userId) {
    const user = await getUserAsync(userId);
    const ref = user.referral || { count: 0, pending: [], lastMilestone: 0, badges: [] };

    // Find next milestone
    const nextMilestone = REFERRAL_MILESTONES.find(m => m.count > (ref.count || 0)) || REFERRAL_MILESTONES[REFERRAL_MILESTONES.length - 1];
    const progress = ref.count || 0;
    const target = nextMilestone.count;

    return {
        count: ref.count || 0,
        pending: (ref.pending || []).length,
        progress,
        target,
        nextReward: nextMilestone.reward.label,
        badges: ref.badges || [],
        lastMilestone: ref.lastMilestone || 0,
        link: 'https://t.me/' + (process.env.BOT_USERNAME || 'iFragmentBot') + '?start=ref_' + userId
    };
}

/**
 * Get top referrers leaderboard
 */
export async function getTopReferrers(limit = 10) {
    const db = getDB();
    if (!db) {
        const all = getAllUsers();
        return all.filter(u => (u.referral?.count || 0) > 0)
            .sort((a, b) => (b.referral?.count || 0) - (a.referral?.count || 0))
            .slice(0, limit)
            .map((u, i) => ({ rank: i + 1, userId: u.id, username: u.username, firstName: u.firstName, count: u.referral?.count || 0, badges: u.referral?.badges || [] }));
    }
    try {
        const users = await db.collection('userData')
            .find({ 'referral.count': { $gt: 0 } })
            .sort({ 'referral.count': -1 })
            .limit(limit)
            .toArray();
        return users.map((u, i) => ({ rank: i + 1, userId: u.id, username: u.username, firstName: u.firstName, count: u.referral?.count || 0, badges: u.referral?.badges || [] }));
    } catch (e) {
        return [];
    }
}


// ==================== DAILY STREAK SYSTEM (Replaces Spin) ==================== 

/**
 * Claim daily streak reward
 * @returns {Promise<object>} Streak result with guaranteed reward
 */
export async function claimDailyReward(userId) {
    const user = await getUserAsync(userId);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    // Initialize streak if missing (migration)
    if (!user.streak) user.streak = { current: 0, lastClaim: null, totalDays: 0, weekNumber: 0, shieldActive: false };

    // Check if already claimed today
    if (user.streak.lastClaim) {
        const lastClaimDate = user.streak.lastClaim.split('T')[0];
        if (lastClaimDate === todayStr) {
            // Calculate next claim time
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            return { success: false, reason: 'already_claimed', nextClaim: tomorrow, streak: user.streak };
        }
    }

    // Check streak continuity
    let streakBroken = false;
    if (user.streak.lastClaim) {
        const lastDate = new Date(user.streak.lastClaim);
        const diffHours = (now - lastDate) / (1000 * 60 * 60);

        if (diffHours > 48) {
            // Streak broken!
            if (user.streak.shieldActive && isPremium(userId)) {
                // Premium shield: don't reset, just continue
                user.streak.shieldActive = false; // Shield used
                streakBroken = false;
            } else if (user.streak.current <= 3) {
                // Early streak: full reset
                user.streak.current = 0;
                streakBroken = true;
            } else {
                // Late streak (day 4+): go back 1 day only (forgiving)
                user.streak.current = Math.max(0, user.streak.current - 1);
                streakBroken = true;
            }
        }
    }

    // Advance streak
    user.streak.current = (user.streak.current || 0) + 1;
    user.streak.totalDays = (user.streak.totalDays || 0) + 1;
    user.streak.lastClaim = now.toISOString();

    // Check if completed a full week
    if (user.streak.current > 7) {
        user.streak.weekNumber = (user.streak.weekNumber || 0) + 1;
        user.streak.current = 1; // Start new week
    }

    // Restore shield for premium users
    if (isPremium(userId)) {
        user.streak.shieldActive = true;
    }

    // Get today's reward
    const dayIndex = user.streak.current - 1; // 0-indexed
    const streakReward = STREAK_REWARDS[dayIndex] || STREAK_REWARDS[0];

    // Apply reward
    if (streakReward.type === 'credits') {
        if (!user.extraLimits) user.extraLimits = { credits: 0 };
        user.extraLimits.credits = (user.extraLimits.credits || 0) + streakReward.amount;
    } else if (streakReward.type === 'premium') {
        if (streakReward.days) {
            activatePremium(userId, streakReward.days, 'bronze');
        } else if (streakReward.hours) {
            // Add hours to premium
            const currentExpiry = user.premium && user.premium.expiresAt ? new Date(user.premium.expiresAt) : now;
            const basisDate = currentExpiry > now ? currentExpiry : now;
            const newExpiry = new Date(basisDate.getTime() + streakReward.hours * 60 * 60 * 1000);
            user.premium = { active: true, tier: user.premium?.tier || 'bronze', expiresAt: newExpiry.toISOString() };
        }
    }

    // Save
    const strId = String(userId);
    usersCache.set(strId, user);
    const db = getDB();
    if (db) {
        await db.collection('userData').updateOne({ id: strId }, {
            $set: {
                streak: user.streak,
                premium: user.premium,
                extraLimits: user.extraLimits
            }
        }, { upsert: true });
    }

    return {
        success: true,
        streakDay: user.streak.current,
        reward: streakReward,
        weekNumber: user.streak.weekNumber || 0,
        totalDays: user.streak.totalDays,
        streakBroken,
        shieldUsed: !streakBroken && user.streak.shieldActive === false && isPremium(userId),
        allRewards: STREAK_REWARDS
    };
}

/**
 * Get streak info without claiming
 */
export async function getStreakInfo(userId) {
    const user = await getUserAsync(userId);
    if (!user.streak) user.streak = { current: 0, lastClaim: null, totalDays: 0, weekNumber: 0, shieldActive: false };

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const claimedToday = user.streak.lastClaim && user.streak.lastClaim.split('T')[0] === todayStr;

    return {
        current: user.streak.current || 0,
        lastClaim: user.streak.lastClaim,
        totalDays: user.streak.totalDays || 0,
        weekNumber: user.streak.weekNumber || 0,
        claimedToday,
        shieldActive: user.streak.shieldActive && isPremium(userId),
        allRewards: STREAK_REWARDS
    };
}

// Legacy compat: processSpin now calls claimDailyReward
export async function processSpin(userId) {
    return claimDailyReward(userId);
}


// ==================== NET WORTH LEADERBOARD ====================

/** 
 * Update user's total portfolio value and Net Worth
 * @param {number} userId 
 * @param {number} value 
 */
export async function updateUserPortfolioValue(userId, value) {
    const user = await getUserAsync(userId);
    const strId = String(userId);

    user.portfolioValue = value;

    // Update Net Worth
    const giftVal = user.giftValue || 0;
    user.netWorth = value + giftVal;

    // Save 
    usersCache.set(strId, user);
    const db = getDB();
    if (db) {
        await db.collection('userData').updateOne(
            { id: strId },
            { $set: { portfolioValue: value, netWorth: user.netWorth } },
            { upsert: true }
        );
    }
}

/** 
 * Get top 30 users by Net Worth
 */
export async function getTopTraders(limit = 30) {
    const db = getDB();
    if (!db) return [];

    try {
        return await db.collection('userData')
            .find({ netWorth: { $gt: 0 } })
            .sort({ netWorth: -1 })
            .limit(limit)
            .toArray();
    } catch (e) {
        console.error('Error fetching top traders:', e);
        return [];
    }
}

/** 
 * Get user rank by Net Worth
 */
export async function getUserPortfolioRank(userId) {
    const db = getDB();
    if (!db) return 0;
    const user = await getUserAsync(userId);
    if (!user || !user.netWorth) return 0;

    try {
        const count = await db.collection('userData').countDocuments({
            netWorth: { $gt: user.netWorth }
        });
        return count + 1;
    } catch (e) {
        return 0;
    }
}

/**
 * Scans user's gifts from Telegram API if needed (once per week)
 * Updates realGiftValue and netWorth
 * @param {string|number} userId
 */
export async function scanUserGiftsIfNeeded(userId) {
    const user = await getUserAsync(userId);
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

    // Check if scan needed (never scanned OR older than 1 week)
    // We also scan if realGiftValue is undefined to initialize it
    const shouldScan = !user.lastGiftScan ||
        (Date.now() - new Date(user.lastGiftScan).getTime() > ONE_WEEK) ||
        user.realGiftValue === undefined;

    if (shouldScan) {
        console.log(`🔍 Scanning real gifts for user ${userId}...`);

        const result = await getUserGiftsWithValue(userId);

        if (result.success) {
            user.realGiftValue = result.totalValue;
            user.lastGiftScan = new Date().toISOString();

            // Update Net Worth
            // Default portfolioValue to 0 if missing
            const portfolioVal = user.portfolioValue || 0;
            user.netWorth = portfolioVal + result.totalValue;

            // Save to DB
            const db = getDB();
            if (db) {
                await db.collection('userData').updateOne(
                    { id: String(userId) },
                    {
                        $set: {
                            realGiftValue: user.realGiftValue,
                            lastGiftScan: user.lastGiftScan,
                            netWorth: user.netWorth
                        }
                    }
                );
            }
            // Update cache
            usersCache.set(String(userId), user);

            console.log(`✅ User ${userId} updated: Gifts=${user.realGiftValue}, NetWorth=${user.netWorth}`);
            return { scanned: true, value: result.totalValue };
        } else {
            console.log(`⚠️ Scan failed for ${userId}: ${result.error}`);
        }
    }

    return { scanned: false, value: user.realGiftValue || 0 };
}
