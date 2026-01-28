/**
 * User Service - Manages user data with MongoDB persistence
 * Falls back to in-memory cache if MongoDB is unavailable
 */

import { getDB } from './mongoService.js';
import { getUserGiftsWithValue } from './telegramClientService.js';

const FREE_LIMITS = {
    report: 1,
    compare: 1,
    portfolio: 1,
    gift: 1
};

// Premium price in Telegram Stars
export const PREMIUM_PRICE = 100;
export const PREMIUM_DAYS = 15;

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
            expiresAt: null
        },
        dailyLimits: {
            report: FREE_LIMITS.report,
            compare: FREE_LIMITS.compare,
            portfolio: FREE_LIMITS.portfolio,
            gift: FREE_LIMITS.gift,
            lastReset: getUTCDate()
        },
        giftValue: 0, // Total estimated value of gifts reported
        referral: {
            referredBy: null,
            count: 0,
            progress: 0
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

// Check if daily limits need reset
function checkAndResetLimits(user) {
    const today = getUTCDate();

    if (user.dailyLimits.lastReset !== today) {
        user.dailyLimits = {
            report: FREE_LIMITS.report,
            compare: FREE_LIMITS.compare,
            portfolio: FREE_LIMITS.portfolio,
            gift: FREE_LIMITS.gift,
            lastReset: today
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

    return user.dailyLimits[feature] > 0;
}

// Use a feature (decrement limit)
export function useFeature(userId, feature) {
    if (isPremium(userId)) {
        return {
            success: true,
            isPremium: true,
            remaining: { report: '∞', compare: '∞', portfolio: '∞', gift: '∞' }
        };
    }

    const user = getUser(userId);
    checkAndResetLimits(user);

    if (user.dailyLimits[feature] <= 0) {
        return {
            success: false,
            remaining: {
                report: user.dailyLimits.report,
                compare: user.dailyLimits.compare,
                portfolio: user.dailyLimits.portfolio,
                gift: user.dailyLimits.gift
            }
        };
    }

    user.dailyLimits[feature]--;
    saveUserToDB(userId).catch(() => { });

    return {
        success: true,
        isPremium: false,
        remaining: {
            report: user.dailyLimits.report,
            compare: user.dailyLimits.compare,
            portfolio: user.dailyLimits.portfolio,
            gift: user.dailyLimits.gift
        }
    };
}

// Get remaining limits
export function getRemainingLimits(userId) {
    if (isPremium(userId)) {
        return { report: '∞', compare: '∞', portfolio: '∞', gift: '∞', isPremium: true };
    }

    const user = getUser(userId);
    checkAndResetLimits(user);

    return {
        report: user.dailyLimits.report,
        compare: user.dailyLimits.compare,
        portfolio: user.dailyLimits.portfolio,
        gift: user.dailyLimits.gift,
        isPremium: false
    };
}

// Activate premium for user
export function activatePremium(userId, days = PREMIUM_DAYS) {
    const user = getUser(userId);

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    user.premium = {
        active: true,
        expiresAt: expiryDate.toISOString()
    };

    saveUserToDB(userId).catch(() => { });

    return {
        success: true,
        expiresAt: expiryDate
    };
}

// Get premium expiry date
export function getPremiumExpiry(userId) {
    const user = getUser(userId);
    if (!user.premium.active) return null;
    return user.premium.expiresAt ? new Date(user.premium.expiresAt) : null;
}

// Get time until next reset (00:00 UTC)
export function getTimeUntilReset() {
    const now = new Date();
    const resetTime = new Date(now);
    resetTime.setUTCHours(24, 0, 0, 0);

    const diff = resetTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes, formatted: `${hours}h ${minutes}m` };
}

// Format remaining credits message
export function formatCreditsMessage(remaining, userIsPremium = false) {
    if (userIsPremium) {
        return `\n🌟 *Premium Active* - Unlimited Access`;
    }

    const reportIcon = remaining.report > 0 ? '✅' : '❌';
    const compareIcon = remaining.compare > 0 ? '✅' : '❌';
    const portfolioIcon = remaining.portfolio > 0 ? '✅' : '❌';
    const giftIcon = remaining.gift > 0 ? '✅' : '❌';

    return `
📊 *Daily Credits:*
• Report: ${remaining.report}/1 ${reportIcon}
• Compare: ${remaining.compare}/1 ${compareIcon}
• Portfolio: ${remaining.portfolio}/1 ${portfolioIcon}
• Gift: ${remaining.gift}/1 ${giftIcon}

💎 _For unlimited access, get ${PREMIUM_DAYS}-day Premium for ${PREMIUM_PRICE}⭐_`;
}

// Format "out of credits" message
export function formatNoCreditsMessage(feature) {
    const resetTime = getTimeUntilReset();

    return `⚠️ *Daily Limit Reached*

You've used your free ${feature} for today.

⏰ Next reset: *${resetTime.formatted}* (00:00 UTC)

━━━━━━━━━━━━━━━━

🌟 *Go Premium!*
• ${PREMIUM_DAYS} days unlimited access
• All features unlocked
• Only ${PREMIUM_PRICE} ⭐ Telegram Stars`;
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


// ==================== REFERRAL SYSTEM ==================== 

/** 
 * Process a new referral connection 
 * @param {number} newUserId - The new user's Telegram ID 
 * @param {number} referrerId - The referrer's Telegram ID 
 * @returns {Promise<object>} Result of the referral process 
 */
export async function processReferral(newUserId, referrerId) {
    // 1. Validation 
    if (String(newUserId) === String(referrerId)) return { success: false, reason: 'self' };

    // Get users (ensure fresh from DB) 
    let newUser = await getUserAsync(newUserId);
    let referrer = await getUserAsync(referrerId);

    if (!referrer) return { success: false, reason: 'referrer_not_found' };

    // Check if new user is already referred 
    if (newUser.referral && newUser.referral.referredBy) {
        return { success: false, reason: 'already_referred' };
    }

    // 2. Update New User 
    const db = getDB();
    const newUserIdStr = String(newUserId);
    const referrerIdStr = String(referrerId);

    // Initialize structure if missing (migration) 
    if (!newUser.referral) newUser.referral = { referredBy: null, count: 0, progress: 0 };
    newUser.referral.referredBy = referrerIdStr;

    // Save New User 
    usersCache.set(newUserIdStr, newUser);
    if (db) await db.collection('userData').updateOne({ id: newUserIdStr }, { $set: { referral: newUser.referral } }, { upsert: true });

    // 3. Update Referrer 
    if (!referrer.referral) referrer.referral = { referredBy: null, count: 0, progress: 0 };

    referrer.referral.count = (referrer.referral.count || 0) + 1;
    referrer.referral.progress = (referrer.referral.progress || 0) + 1;

    let rewardGiven = false;
    let rewardDays = 0;

    // Check Reward Condition (Every 5 invites) 
    if (referrer.referral.progress >= 5) {
        referrer.referral.progress = 0; // Reset progress bar 
        rewardDays = 7;

        // Apply Premium Reward 
        const now = new Date();
        const currentExpiry = referrer.premium && referrer.premium.expiresAt ? new Date(referrer.premium.expiresAt) : now;
        // If expired, start from now. If active, extend. 
        const basisDate = currentExpiry > now ? currentExpiry : now;

        const newExpiry = new Date(basisDate);
        newExpiry.setDate(newExpiry.getDate() + rewardDays);

        referrer.premium = {
            active: true,
            expiresAt: newExpiry.toISOString()
        };
        rewardGiven = true;
    }

    // Save Referrer 
    usersCache.set(referrerIdStr, referrer);
    if (db) {
        const updateDoc = {
            referral: referrer.referral
        };
        if (rewardGiven) {
            updateDoc.premium = referrer.premium;
        }
        await db.collection('userData').updateOne({ id: referrerIdStr }, { $set: updateDoc }, { upsert: true });
    }

    return {
        success: true,
        referrerId: referrerId,
        referralCount: referrer.referral.count,
        rewardGiven,
        rewardDays
    };
}

/** 
 * Get referral stats for dashboard 
 */
export async function getReferralStats(userId) {
    const user = await getUserAsync(userId);
    return {
        count: user.referral?.count || 0,
        progress: user.referral?.progress || 0,
        target: 5,
        link: 'https://t.me/' + (process.env.BOT_USERNAME || 'iFragmentBot') + '?start=ref_' + userId
    };
}


// ==================== DAILY SPIN SYSTEM ==================== 

/** 
 * Process daily lucky spin 
 * @param {number} userId 
 * @returns {Promise<object>} 
 */
export async function processSpin(userId) {
    const user = await getUserAsync(userId);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Check cooldown 
    if (user.lastSpin && (now - new Date(user.lastSpin).getTime() < oneDay)) {
        const nextSpin = new Date(new Date(user.lastSpin).getTime() + oneDay);
        return { success: false, reason: 'cooldown', nextSpin };
    }

    // Determine Reward (Weighted Random) 
    const rand = Math.random() * 100;
    let reward = null;
    let type = '';

    if (rand < 5) { // 5% chance 
        type = 'premium_3d';
        reward = { days: 3, label: '?? 3 Days Premium' };
    } else if (rand < 15) { // 10% chance 
        type = 'premium_1d';
        reward = { days: 1, label: '?? 1 Day Premium' };
    } else if (rand < 40) { // 25% chance 
        type = 'discount';
        reward = { label: '?? 50% Discount' };
        // Logic to clear discount after use would go here 
    } else if (rand < 70) { // 30% chance 
        type = 'report';
        reward = { label: '?? 1 Free Report' };
        // Grant free report 
        if (!user.extraLimits) user.extraLimits = { report: 0 };
        user.extraLimits.report = (user.extraLimits.report || 0) + 1;
    } else { // 30% chance 
        type = 'none';
        reward = { label: '?? Try Again Tomorrow' };
    }

    // Apply Premium Rewards 
    if (type.startsWith('premium')) {
        const days = reward.days;
        const currentExpiry = user.premium && user.premium.expiresAt ? new Date(user.premium.expiresAt) : new Date();
        const basisDate = currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiry = new Date(basisDate);
        newExpiry.setDate(newExpiry.getDate() + days);

        user.premium = { active: true, expiresAt: newExpiry.toISOString() };
    }

    // Save state 
    user.lastSpin = new Date().toISOString();

    const strId = String(userId);
    usersCache.set(strId, user);

    const db = getDB();
    if (db) {
        const updateDoc = { lastSpin: user.lastSpin };
        if (type.startsWith('premium')) updateDoc.premium = user.premium;
        if (type === 'report') updateDoc.extraLimits = user.extraLimits;
        await db.collection('userData').updateOne({ id: strId }, { $set: updateDoc }, { upsert: true });
    }

    return { success: true, reward, type };
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
