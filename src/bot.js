import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import http from 'http';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { CONFIG, calculateRarity, estimateValue } from './config.js';
import { getTonPrice, getTonMarketStats, scrapeFragment, generateShortInsight, generateUsernameSuggestions } from './services/fragmentService.js';
import { getGiftStats, get888Stats } from './services/marketService.js';
import { generateNewsCard, generateNewsCard2, generateMarketCard, getPage, generateFlexCard } from './services/cardGenerator.js';
import { generateFlexCard as generateGiftFlexCard } from './services/flexCardService.js';
import { animateLoading } from './services/animationService.js';
import { fragmentCache, tonPriceCache, portfolioCache, getAllCacheStats } from './services/cacheService.js';
import { getPortfolio, formatPortfolioMessage, getOwnerWalletByUsername } from './services/portfolioService.js';
import { connectDB } from './services/mongoService.js';
import { userStates, getStateStats } from './services/stateService.js';
import { globalLimiter, withUserLimit, isOverloaded, getEstimatedWaitTime, getLimiterStats } from './services/rateLimiter.js';
import * as accountManager from './services/accountManagerService.js';
import { generateGiftReport, parseGiftLink, formatNumber } from './services/marketappService.js';
import { generateWalletReport, handleUsernamePagination, handleNumberPagination, handleGiftPagination } from './services/walletTrackerService.js';
import * as g2g from './services/groupToGroupService.js';
import { jobQueue, JOB_TYPES, PRIORITIES, formatQueueMessage } from './services/queueService.js';
// telegramClient is loaded dynamically when needed to avoid GramJS import issues
import {
    canUseFeature,
    useFeature,
    isPremium,
    isBlocked,
    activatePremium,
    blockUser,
    unblockUser,
    getStats,
    getAllUsers,
    formatCreditsMessage,
    formatNoCreditsMessage,
    initUserService,
    getPremiumExpiry,
    getRemainingLimits,
    getTimeUntilReset,
    getTopGiftHolders,
    getUserRank,
    getSponsorText,
    setSponsorText,
    loadSponsorText,
    processReferral,
    getReferralStats,
    processSpin,
    updateUserPortfolioValue,
    getUserAsync,
    PREMIUM_PRICE,
    PREMIUM_DAYS,
    scanUserGiftsIfNeeded
} from './services/userService.js';

// Bot token
const BOT_TOKEN = process.env.BOT_TOKEN || '5801271507:AAHdSLRlTlHjtK2F7NbIEul7W499fSSRQrE';

if (!BOT_TOKEN) {
    console.error('❌ Error: BOT_TOKEN is not set!');
    process.exit(1);
}

import { spamProtection } from './services/spamProtection.js';

const bot = new Telegraf(BOT_TOKEN);

// Helper: Check if user is admin
function isAdmin(userId) {
    const configAdmin = CONFIG.ADMIN_ID;
    const envAdmin = process.env.ADMIN_USER_ID;
    return String(userId) === String(configAdmin) || String(userId) === String(envAdmin);
}




// 🛡️ Register Anti-Spam Middleware immediately
bot.use(spamProtection.middleware());

// 🛡️ Global Block Check Middleware
// Silently ignore all updates from blocked users
bot.use(async (ctx, next) => {
    if (ctx.from && isBlocked(ctx.from.id)) {
        return; // Stop processing immediately, no response
    }
    return next();
});



// ==================== TELEGRAM CLIENT LAZY LOADER ====================
let telegramClientModule = null;
async function getTelegramClient() {
    if (!telegramClientModule) {
        try {
            telegramClientModule = await import('./services/telegramClientService.js');
        } catch (error) {
            console.warn('⚠️ Telegram client service not available:', error.message);
            return null;
        }
    }
    return telegramClientModule;
}

// ==================== USER STATE MANAGEMENT ====================
// Now handled by stateService.js with automatic cleanup
// userStates is imported from stateService.js with Map-compatible interface

// ==================== GIFT HOURLY RATE LIMITER ====================
// Anti-abuse: Max 3 gift reports per hour (even for premium)
const giftHourlyLimiter = new Map(); // userId -> { count, resetTime }
const GIFT_HOURLY_LIMIT = 3;
const GIFT_HOUR_MS = 60 * 60 * 1000; // 1 hour in ms

// ==================== USERNAME REPORT CACHE ====================
// Cache full report results to avoid repeated expensive scraping
const usernameReportCache = new Map(); // username -> { data, timestamp }
const REPORT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes cache

/**
 * Get cached username report if available
 */
function getCachedReport(username) {
    const key = username.toLowerCase();
    const cached = usernameReportCache.get(key);

    if (cached && (Date.now() - cached.timestamp) < REPORT_CACHE_DURATION) {
        console.log(`📦 Cache HIT for @${username}`);
        return cached.data;
    }

    // Clean up expired entry
    if (cached) {
        usernameReportCache.delete(key);
    }

    return null;
}

/**
 * Cache username report result
 */
function setCachedReport(username, data) {
    const key = username.toLowerCase();
    usernameReportCache.set(key, {
        data,
        timestamp: Date.now()
    });

    // Limit cache size to 500 entries
    if (usernameReportCache.size > 500) {
        // Remove oldest 100 entries
        const entries = Array.from(usernameReportCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        entries.slice(0, 100).forEach(([k]) => usernameReportCache.delete(k));
    }

    console.log(`💾 Cached report for @${username} (Total: ${usernameReportCache.size})`);
}

/**
 * Get cache statistics
 */
function getReportCacheStats() {
    return {
        size: usernameReportCache.size,
        maxSize: 500,
        cacheDurationMinutes: REPORT_CACHE_DURATION / 60000
    };
}

function checkGiftHourlyLimit(userId) {
    const now = Date.now();
    const id = String(userId);

    if (!giftHourlyLimiter.has(id)) {
        giftHourlyLimiter.set(id, { count: 0, resetTime: now + GIFT_HOUR_MS });
    }

    const limiter = giftHourlyLimiter.get(id);

    // Reset if hour has passed
    if (now >= limiter.resetTime) {
        limiter.count = 0;
        limiter.resetTime = now + GIFT_HOUR_MS;
    }

    // Check if limit exceeded
    if (limiter.count >= GIFT_HOURLY_LIMIT) {
        const waitMs = limiter.resetTime - now;
        const waitMinutes = Math.ceil(waitMs / (60 * 1000));
        return { allowed: false, waitMinutes };
    }

    return { allowed: true };
}

function useGiftHourlyLimit(userId) {
    const id = String(userId);
    if (giftHourlyLimiter.has(id)) {
        giftHourlyLimiter.get(id).count++;
    }
}


// ==================== CHANNEL MEMBERSHIP CHECK ====================

/**
 * Check if user is member of required channel
 */
async function isChannelMember(userId) {
    try {
        const member = await bot.telegram.getChatMember(CONFIG.REQUIRED_CHANNEL, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.error('Channel check error:', error.message);
        return false;
    }
}

/**
 * Send join channel message
 */
function sendJoinChannelMessage(ctx) {
    return ctx.replyWithMarkdown(`
🔒 *Please Join First!*

To use this bot, you must join our channel.

👇 Click the button below to join:
`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📢 Join Channel', url: CONFIG.CHANNEL_LINK }],
                [{ text: '✅ I Joined', callback_data: 'check_membership' }]
            ]
        }
    });
}

// ==================== DASHBOARD HELPERS ====================

function getGreeting(name) {
    const hour = new Date().getHours();
    let timeGreeting = 'Good Morning';
    let icon = '☀️';

    if (hour >= 12 && hour < 18) {
        timeGreeting = 'Good Afternoon';
        icon = '🌤';
    } else if (hour >= 18 || hour < 4) {
        timeGreeting = 'Good Evening';
        icon = '🌙';
    }

    return `${icon} *${timeGreeting} ${name}, Welcome back!*`;
}

function getRandomTip() {
    const tips = [
        // Username Tips (1-10)
        'Usernames with 4 letters are highly liquid assets.',
        'Single-word English usernames sell 3x faster than random strings.',
        'Avoid underscores — clean names are more valuable.',
        'Verified usernames (blue check) carry a 50%+ premium.',
        'Short dictionary words like @trade, @shop, @news are gold.',
        'Check similar sold names to price your username correctly.',
        'Personal names like @alex, @john have steady demand.',
        'Crypto-related names (@wallet, @defi) are trending.',
        'Bot usernames (@xxxbot) are essential for developers.',
        'Seasonal names spike in value during holidays.',

        // Gift Tips (11-18)
        'Gifts with lower issuance numbers often hold more value.',
        'First 100 minted gifts are considered "OG" collectibles.',
        'Check floor price before buying any gift NFT.',
        'Rare backdrop colors increase gift value significantly.',
        'Limited edition gifts appreciate faster than common ones.',
        'Gift collections with celebrity endorsements trend higher.',
        'Hold gifts during market dips — they recover well.',
        'Share your best gifts with the world.',

        // Anonymous Numbers Tips (19-24)
        '+888 numbers are non-custodial and safer for long-term.',
        'Numbers with repeating digits (+88888) are premium.',
        'Fragment numbers provide privacy AND ownership.',
        'Ascending sequences like +12345 are collectible.',
        'Even random +888 numbers have baseline value.',
        'Numbers can be used for multiple Telegram accounts.',

        // Market & Trading Tips (25-30)
        'Market activity usually peaks around 12:00 - 16:00 UTC.',
        'Check "Top 30" to see what whales are collecting.',
        'Use "Compare Names" to find undervalued usernames.',
        'Setting a username on your profile increases trust.',
        'Weekends often have lower trading volume.',
        'TON price directly affects all Fragment assets.'
    ];
    return tips[Math.floor(Math.random() * tips.length)];
}

// Initial values
tonPriceCache.set('marketStats', { price: 5.50, change24h: 0, timestamp: 0 }); // Safe default
tonPriceCache.set('price', 5.50);

// Use a flag to prevent double initialization if hot reload occurs
let backgroundUpdatesStarted = false;

// ==================== CACHE PERSISTENCE ====================
const CACHE_FILE = './market_data_cache.json';

async function loadPersistentCache() {
    try {
        const data = await fs.readFile(CACHE_FILE, 'utf8');
        const json = JSON.parse(data);
        if (json.tonStats) {
            tonPriceCache.set('marketStats', json.tonStats);
            tonPriceCache.set('price', json.tonStats.price);
        }
        if (json.floor888) {
            tonPriceCache.set('floor888', json.floor888);
        }
        console.log('✅ Persistent market cache loaded');
    } catch (e) {
        console.log('⚠️ No persistent cache found, starting fresh');
    }
}

async function savePersistentCache() {
    try {
        const tonStats = tonPriceCache.get('marketStats');
        const floor888 = tonPriceCache.get('floor888');
        // Only save if we have valid data
        if (tonStats || floor888) {
            const data = { tonStats, floor888 };
            await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Failed to save persistence cache:', e.message);
    }
}

function startBackgroundUpdates() {
    if (backgroundUpdatesStarted) return;
    backgroundUpdatesStarted = true;

    console.log('🔄 Starting background market data updates...');

    // Update function
    const updateMarketData = async () => {
        try {
            const stats = await getTonMarketStats();
            if (stats) {
                const data = { ...stats, timestamp: Date.now() };
                tonPriceCache.set('marketStats', data);
                tonPriceCache.set('price', stats.price);
                savePersistentCache(); // Persist on update
            }
        } catch (e) {
            console.error('Background TON update failed:', e.message);
        }
    };

    const update888Data = async () => {
        try {
            const price888 = await get888Stats();
            if (price888) {
                tonPriceCache.set('floor888', { price: price888, timestamp: Date.now() });
                savePersistentCache(); // Persist on update
            }
        } catch (e) {
            console.error('Background +888 update failed:', e.message);
        }
    };

    // Run immediately
    updateMarketData();
    update888Data();

    // Schedule intervals
    // TON Price: Every 1 hour
    setInterval(updateMarketData, 60 * 60 * 1000);

    // +888// Update every 1 hour (reduced load)
    setInterval(update888Data, 3600000);
}

// Optimized: Returns data from cache INSTANTLY - no fetch delays!
// All price updates happen in background every hour via startBackgroundUpdates()
function getDashboardData() {
    // Get stats from cache - NEVER block on fetches
    const tonStats = tonPriceCache.get('marketStats') || { price: 5.50, change24h: 0, timestamp: 0 };
    const floor888 = tonPriceCache.get('floor888');

    // If stale, trigger background update (non-blocking)
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    if (!tonStats.timestamp || Date.now() - tonStats.timestamp > TWO_HOURS) {
        // Background fetch - don't await
        getTonMarketStats().then(freshStats => {
            if (freshStats && freshStats.price > 0) {
                tonPriceCache.set('marketStats', { ...freshStats, timestamp: Date.now() });
                tonPriceCache.set('price', freshStats.price);
            }
        }).catch(() => { });
    }

    // Background 888 update if stale - don't await
    if (!floor888 || !floor888.timestamp || Date.now() - floor888.timestamp > 60 * 60 * 1000) {
        get888Stats().then(p => {
            if (p) tonPriceCache.set('floor888', { price: p, timestamp: Date.now() });
        }).catch(() => { });
    }

    // Return cached data immediately - never wait
    return {
        tonPrice: tonStats.price || 5.50,
        tonChange: tonStats.change24h || 0,
        price888: floor888 ? floor888.price : null
    };
}

// Initialize and launch bot
async function initAndLaunch() {
    // Connect to MongoDB first
    try {
        await connectDB();
        await initUserService();
    } catch (error) {
        console.log('⚠️ MongoDB not available, using in-memory storage');
    }

    // Load persistent cache first (for fast restart)
    await loadPersistentCache();

    // Force initial TON price fetch (FAST) - awaited to ensure accuracy on boot
    try {
        const stats = await getTonMarketStats();
        if (stats && stats.price > 0) {
            tonPriceCache.set('marketStats', { ...stats, timestamp: Date.now() });
            tonPriceCache.set('price', stats.price);
            console.log(`✅ Initial TON Price: $${stats.price}`);
        }
    } catch (e) { console.error('Initial TON fetch failed'); }

    // Start background tasks (including slow 888 fetch)
    startBackgroundUpdates();

    // ==================== JOB QUEUE SETUP (BEFORE LAUNCH) ====================
    // Set bot reference for queue to send messages
    jobQueue.setBot(bot);

    // Register Gift Report handler
    jobQueue.registerHandler(JOB_TYPES.GIFT_REPORT, async (job) => {
        const { chatId, data, userId } = job;
        const { link, tonPrice } = data;

        try {
            const result = await generateGiftReport(link, tonPrice);

            // Send report
            await bot.telegram.sendMessage(chatId, result.report, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎁 Analyze Another Gift', callback_data: 'report_gifts' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });

            // Generate story card
            try {
                const cardData = {
                    collectionName: result.collection,
                    itemNumber: result.itemNumber,
                    imageUrl: `https://nft.fragment.com/gift/${result.slug.toLowerCase()}-${result.itemNumber}.lottie.json`,
                    price: formatNumber(Math.round(result.estimatedValue)),
                    verdict: result.verdict || "STANDARD",
                    badges: result.badges || [],
                    appraiserNote: result.appraiserData?.analysis || "",
                    color: result.color
                };

                let imageBuffer = await generateGiftFlexCard(cardData);
                if (!Buffer.isBuffer(imageBuffer)) {
                    imageBuffer = Buffer.from(imageBuffer);
                }

                if (imageBuffer && imageBuffer.length > 0) {
                    await bot.telegram.sendPhoto(chatId, { source: imageBuffer }, {
                        caption: `💎 *${result.collection} #${result.itemNumber}*`,
                        parse_mode: 'Markdown'
                    });
                }
            } catch (cardError) {
                console.error('Queue: Card generation error:', cardError.message);
            }

            return { success: true, result };
        } catch (error) {
            await bot.telegram.sendMessage(chatId,
                `❌ Error generating gift report:\n${error.message}\n\nPlease check the link and try again.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'report_gifts' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            throw error;
        }
    });

    // Register Username Report handler
    jobQueue.registerHandler(JOB_TYPES.USERNAME_REPORT, async (job) => {
        const { chatId, data, userId } = job;
        const { username, tonPrice } = data;

        try {
            // Check cache first
            let cached = getCachedReport(username);

            if (cached) {
                const { fragmentData, cardData, tonPrice: cachedTonPrice, rarity, estValue, suggestions } = cached;
                const imageBuffer = await generateFlexCard(cardData);
                const caption = buildFullCaption(fragmentData, cardData, cachedTonPrice, rarity, estValue, suggestions);

                if (imageBuffer && imageBuffer.length >= 1000) {
                    await bot.telegram.sendPhoto(chatId, { source: Buffer.from(imageBuffer) }, {
                        caption: caption + '\n\n_⚡ From cache_',
                        parse_mode: 'Markdown'
                    });
                } else {
                    await bot.telegram.sendMessage(chatId, caption + '\n\n_⚡ From cache_', {
                        parse_mode: 'Markdown'
                    });
                }
                return { success: true, cached: true };
            }

            // Fresh fetch
            const [fragmentData, currentTonPrice, insight, suggestions] = await Promise.all([
                scrapeFragment(username),
                tonPrice || getTonPrice(),
                generateShortInsight(username),
                generateUsernameSuggestions(username)
            ]);

            const rarity = calculateRarity(username);
            const estValue = estimateValue(username, fragmentData.lastSalePrice, currentTonPrice, fragmentData.status);

            const cardData = {
                username,
                tagline: insight,
                status: fragmentData.status,
                statusText: fragmentData.statusText,
                rarity,
                estValueTon: estValue.ton,
                estValueUsd: estValue.usd,
                lastSalePrice: fragmentData.lastSalePrice,
                lastSaleDate: fragmentData.lastSaleDate || 'N/A',
                currentPrice: fragmentData.priceTon || fragmentData.highestBid || fragmentData.minBid || estValue.ton,
                priceType: fragmentData.priceTon ? 'Buy Now' :
                    fragmentData.highestBid ? 'Highest Bid' :
                        fragmentData.minBid ? 'Min Bid' : 'Estimated',
                ownerWallet: fragmentData.ownerWallet || 'Unknown'
            };

            const imageBuffer = await generateFlexCard(cardData);

            // Cache the result
            setCachedReport(username, { fragmentData, cardData, tonPrice: currentTonPrice, rarity, estValue, suggestions });

            const caption = buildFullCaption(fragmentData, cardData, currentTonPrice, rarity, estValue, suggestions);

            if (imageBuffer && imageBuffer.length >= 1000) {
                const keyboard = fragmentData.ownerWalletFull
                    ? {
                        inline_keyboard: [
                            [{ text: '💼 Portfolio Tracker', callback_data: `portfolio:${fragmentData.ownerWalletFull}` }],
                            [{ text: '🔗 View on Fragment', url: fragmentData.url }]
                        ]
                    }
                    : { inline_keyboard: [[{ text: '🔗 View on Fragment', url: fragmentData.url }]] };

                await bot.telegram.sendPhoto(chatId, { source: Buffer.from(imageBuffer) }, {
                    caption,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                await bot.telegram.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
            }

            return { success: true };
        } catch (error) {
            await bot.telegram.sendMessage(chatId,
                `❌ Error generating report:\n${error.message}\n\nPlease try again.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'report_username' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
            throw error;
        }
    });

    console.log('📋 Job queue handlers registered');

    // Retry logic for 409 conflicts during Render deployment
    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            await bot.launch();
            console.log('✅ Bot is running!\n📝 Send /start to begin');
            return;
        } catch (err) {
            console.error(`❌ Launch Error (Attempt ${attempt}/5):`, err.message);

            if (attempt < 5) {
                // Determine wait time: 3s for conflict (409), 5s for others (network/timeout)
                const waitTime = (err.response?.error_code === 409) ? 3000 : 5000;
                console.log(`⏳ Retrying in ${waitTime / 1000}s...`);
                await new Promise(r => setTimeout(r, waitTime));
            } else {
                console.error('❌ Final Failure. Could not log in to Telegram.');
                process.exit(1);
            }
        }
    }
}

initAndLaunch();

// ==================== GROUP COMMAND HANDLER ====================

async function handleGroupCommand(ctx, input) {
    const userId = ctx.from.id;
    const parts = input.trim().split(/\s+/); // Handle multiple spaces
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Helper for username validation (local fallback)
    const isValidUser = (u) => /^[a-zA-Z0-9_]{4,32}$/.test(u);

    // 1. Check Premium Status first
    if (!isPremium(userId)) {
        await ctx.reply(`
💎 *Premium Access Required*

You've discovered a **Power Feature**! ⚡️

Using commands like \`!Gifts\` inside groups is reserved for our **Elite Traders**. This ensures faster speeds and exclusive access for our supporters.

🚀 **Go Limitless**
Upgrade to Premium to unlock group commands, deep insights, and portfolio tracking everywhere.

💡 **Free Alternative**
You can use all these features for **FREE** in my private chat!

👇 *Tap below to start:*
👉 @${ctx.botInfo.username.replace('@', '')}
`, { parse_mode: 'Markdown' });
        return;
    }

    // 2. Handle Commands
    try {
        // !Gifts <link>
        if (command === '!gifts' || command === '!gift') {
            if (args.length === 0) return ctx.reply('⚠️ Usage: `!Gifts <link>`', { parse_mode: 'Markdown' });

            const link = args[0];
            const parsed = parseGiftLink(link);

            if (!parsed.isValid) {
                return ctx.reply('⚠️ Invalid gift link format.', { parse_mode: 'Markdown' });
            }

            const statusMessage = await ctx.reply('🔮 Analyzing gift...', { reply_to_message_id: ctx.message.message_id });

            try {
                const tonPrice = tonPriceCache.get('price') || await getTonPrice();
                const result = await generateGiftReport(link, tonPrice);

                try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id); } catch (e) { }

                await ctx.replyWithMarkdown(result.report, {
                    disable_web_page_preview: true,
                    reply_to_message_id: ctx.message.message_id
                });

                // Visual card
                try {
                    const cardData = {
                        collectionName: result.collection,
                        itemNumber: result.itemNumber,
                        imageUrl: `https://nft.fragment.com/gift/${result.slug.toLowerCase()}-${result.itemNumber}.lottie.json`,
                        price: formatNumber(Math.round(result.estimatedValue)),
                        verdict: result.verdict || "STANDARD",
                        badges: result.badges || [],
                        appraiserNote: result.appraiserData?.analysis || "",
                        color: result.color
                    };

                    let imageBuffer = await generateGiftFlexCard(cardData);
                    if (!Buffer.isBuffer(imageBuffer)) imageBuffer = Buffer.from(imageBuffer);

                    if (imageBuffer && imageBuffer.length > 0) {
                        await ctx.replyWithPhoto({ source: imageBuffer }, {
                            caption: `💎 *${result.collection} #${result.itemNumber}*`,
                            parse_mode: 'Markdown',
                            reply_to_message_id: ctx.message.message_id
                        });
                    }
                } catch (cardError) {
                    console.error('Link Card error:', cardError);
                }

            } catch (error) {
                try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id); } catch (e) { }
                await ctx.reply(`❌ Error: ${error.message}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // !Username <username>
        else if (command === '!username' || command === '!u') {
            if (args.length === 0) return ctx.reply('⚠️ Usage: `!Username @name`', { parse_mode: 'Markdown' });

            let username = args[0].replace('@', '').toLowerCase();
            if (!isValidUser(username)) return ctx.reply('⚠️ Invalid username format.', { reply_to_message_id: ctx.message.message_id });

            const statusMsg = await ctx.reply(`🔍 Analyzing @${username}...`, { reply_to_message_id: ctx.message.message_id });

            try {
                // Reuse logic similar to view_username
                const [fragmentData, tonPrice, insight] = await Promise.all([
                    scrapeFragment(username),
                    getTonPrice(),
                    generateShortInsight(username)
                ]);

                const rarity = calculateRarity(username);
                const estValue = estimateValue(username, fragmentData.lastSalePrice, tonPrice, fragmentData.status);

                const cardData = {
                    username,
                    tagline: insight,
                    status: fragmentData.status,
                    statusText: fragmentData.statusText,
                    rarity,
                    estValueTon: estValue.ton,
                    estValueUsd: estValue.usd,
                    lastSalePrice: fragmentData.lastSalePrice,
                    lastSaleDate: fragmentData.lastSaleDate || 'N/A',
                    currentPrice: fragmentData.priceTon || fragmentData.highestBid || fragmentData.minBid || estValue.ton,
                    priceType: fragmentData.priceTon ? 'Buy Now' :
                        fragmentData.highestBid ? 'Highest Bid' :
                            fragmentData.minBid ? 'Min Bid' : 'Estimated',
                    ownerWallet: fragmentData.ownerWallet || 'Unknown'
                };

                const caption = buildFullCaption(fragmentData, cardData, tonPrice, rarity, estValue, []);

                try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) { }

                // Generate Card Image
                let imageBuffer = null;
                try {
                    imageBuffer = await generateFlexCard(cardData);
                } catch (e) { console.error('Card gen error:', e); }

                // Groups: No buttons to prevent spam/misclicking
                const keyboard = {};

                if (imageBuffer && imageBuffer.length > 1000) {
                    await ctx.replyWithPhoto(
                        { source: Buffer.from(imageBuffer) },
                        {
                            caption: caption,
                            parse_mode: 'Markdown',
                            reply_to_message_id: ctx.message.message_id,
                            ...keyboard
                        }
                    );
                } else {
                    await ctx.replyWithMarkdown(caption, {
                        reply_to_message_id: ctx.message.message_id,
                        ...keyboard
                    });
                }
            } catch (error) {
                console.error('Username report error:', error);
                try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) { }
                await ctx.reply(`❌ Error: ${error.message}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // !Compare <user1> <user2>
        else if (command === '!compare' || command === '!c' || command === '!vs') {
            if (args.length < 2) return ctx.reply('⚠️ Usage: `!Compare @user1 @user2`', { parse_mode: 'Markdown' });

            const u1 = args[0].replace('@', '').toLowerCase();
            const u2 = args[1].replace('@', '').toLowerCase();

            if (!isValidUser(u1) || !isValidUser(u2)) return ctx.reply('⚠️ Invalid username format.', { reply_to_message_id: ctx.message.message_id });

            // Call existing handleComparison
            // Note: handleComparison sends its own replies and status messages. 
            // We should ensure it handles reply_to_message if possible, but currently it doesn't support it explicitly.
            // We can wrap it or modify it, but for now direct call is acceptable.
            await handleComparison(ctx, u1, u2);
        }


        // !Wallet <address|username>
        else if (command === '!wallet' || command === '!w' || command === '!portfolio') {
            if (args.length === 0) return ctx.reply('⚠️ Usage: `!Wallet <address|@username>`', { parse_mode: 'Markdown' });

            const target = args[0];

            if (target.startsWith('UQ') || target.startsWith('EQ') || target.length > 40) {
                await handlePortfolioByWallet(ctx, target);
            } else {
                const username = target.replace('@', '').toLowerCase();
                if (isValidUser(username)) {
                    await handlePortfolioByUsername(ctx, username);
                } else {
                    await ctx.reply('⚠️ Invalid wallet address or username.', { reply_to_message_id: ctx.message.message_id });
                }
            }
        }

        // !me - Premium Profile Card
        else if (command === '!me') {
            // Check cache first
            const { getMeCache, saveMeCache } = await import('./services/mongoService.js');
            const cachedData = await getMeCache(userId);
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

            if (cachedData && (Date.now() - new Date(cachedData.updatedAt).getTime() < SEVEN_DAYS)) {
                // Return cached result
                const daysRemaining = Math.ceil((SEVEN_DAYS - (Date.now() - new Date(cachedData.updatedAt).getTime())) / (24 * 60 * 60 * 1000));

                await ctx.replyWithPhoto(cachedData.fileId, {
                    caption: cachedData.caption + `\n\n_Example of cached data. Update available in ${daysRemaining} days._`,
                    parse_mode: 'Markdown',
                    reply_to_message_id: ctx.message.message_id
                });
                return;
            }

            const statusMsg = await ctx.reply('🎨 Generating your Premium Profile...', { reply_to_message_id: ctx.message.message_id });

            try {
                // Fetch Data
                const telegramClientService = await getTelegramClient();
                const [giftsData, tonPrice] = await Promise.all([
                    telegramClientService.getUserGiftsWithValue(userId),
                    tonPriceCache.get('price') || await getTonPrice()
                ]);

                if (!giftsData.success) {
                    throw new Error('Could not fetch gift data. Make sure your profile is public.');
                }

                // Calculate Values
                const totalStars = giftsData.totalValue;
                // Approximate: 1 Star = $0.015 (adjust as needed) or use TON conversion
                // Standard Telegram Star price is roughly $0.015 - $0.02 depending on pack
                // Let's use $0.016 as a baseline estimate
                const totalValueUsd = Math.round(totalStars * 0.016);

                const userProfile = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
                let photoUrl = null;
                if (userProfile && userProfile.total_count > 0) {
                    const fileId = userProfile.photos[0][0].file_id;
                    const fileLink = await ctx.telegram.getFileLink(fileId);
                    photoUrl = fileLink.href;
                }

                // Find Most Valuable Gift
                let crownJewel = { name: 'None', value: 0 };
                if (giftsData.gifts && giftsData.gifts.length > 0) {
                    crownJewel = giftsData.gifts.reduce((prev, current) => (prev.value > current.value) ? prev : current);
                }

                // Generate Extraordinary Caption
                const caption = `
🌟 *THE GILDED COLLECTION* | ${ctx.from.first_name}

_Your digital empire speaks for itself. A masterpiece of wealth and taste._

━━━━━━━━━━━━━━━━━━━━
🏛 *Net Worth:*  \`${totalValueUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}\`
🏆 *Vault Status:* \`${giftsData.giftCount} Rare Collectibles\`
💎 *Crown Jewel:* \`${crownJewel.name} (~${Math.round(crownJewel.value * 0.016).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})\`
━━━━━━━━━━━━━━━━━━━━

🥂 _"Some collect moments. You collect legends."_

🔐 _Created By @${ctx.botInfo.username}_
`;

                // Generate Image
                const { generateProfileCard } = await import('./services/meCardService.js');
                const imageBuffer = await generateProfileCard({
                    username: ctx.from.username || ctx.from.first_name,
                    totalValueUsd,
                    giftCount: giftsData.giftCount,
                    photoUrl
                });

                try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) { }

                const sentMsg = await ctx.replyWithPhoto({ source: imageBuffer }, {
                    caption: caption,
                    parse_mode: 'Markdown',
                    reply_to_message_id: ctx.message.message_id
                });

                // Save to Cache
                if (sentMsg && sentMsg.photo && sentMsg.photo.length > 0) {
                    // Get the largest photo file_id
                    const fileId = sentMsg.photo[sentMsg.photo.length - 1].file_id;
                    await saveMeCache(userId, {
                        fileId,
                        caption, // Store base caption without footer
                        totalValueUsd
                    });
                }

            } catch (error) {
                console.error('/me error:', error);
                try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) { }
                await ctx.reply(`❌ Error: ${error.message}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

    } catch (e) {
        console.error('Group command error:', e);
    }
}


// Membership check helper for protected features
async function checkMembershipOrStop(ctx) {
    try {
        // Admins bypass
        if (isAdmin(ctx.from.id)) return true;

        const isMember = await isChannelMember(ctx.from.id);
        if (!isMember) {
            try {
                await ctx.answerCbQuery('❌ Join our channel to use this feature!', { show_alert: true });
            } catch (e) {
                // Callback may have expired, ignore
            }
            // Don't delete previous message, just send new one
            await sendJoinChannelMessage(ctx);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Membership check error:', error.message);
        try {
            await ctx.answerCbQuery('⚠️ Please try again', { show_alert: false });
        } catch (e) {
            // Ignore
        }
        await sendJoinChannelMessage(ctx);
        return false;
    }
}

async function sendDashboard(ctx, isEdit = false) {
    // Show typing status while fetching data
    if (!isEdit) ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(() => { });

    const { tonPrice, tonChange, price888 } = getDashboardData();
    const firstName = ctx.from.first_name || 'Trader';
    const userIsPremium = isPremium(ctx.from.id);

    // Trigger background gift scan (non-blocking)
    scanUserGiftsIfNeeded(ctx.from.id).catch(err => console.error('Background gift scan error:', err));

    // Format header with market stats
    const changeIcon = tonChange >= 0 ? '📈' : '📉';
    const changeText = Math.abs(tonChange).toFixed(2) + '%';
    const sign = tonChange >= 0 ? '+' : '-';

    // Build market stats line
    let marketStats = `💎 *TON:* $${tonPrice.toFixed(2)} (${changeIcon} ${sign}${changeText})`;
    if (price888) {
        marketStats += `\n🏴‍☠️ *+888:* ${price888.toLocaleString()} TON`;
    }

    // Premium badge
    const premiumBadge = userIsPremium ? '⭐' : '';

    const message = `
${marketStats}

${getGreeting(firstName)} ${premiumBadge}

⚡ *Analyze Usernames, Value Gifts, and Track your Portfolio in seconds.*

💡 _${getRandomTip()}_

━━━━━━━━━━━━━━━━
👇 *Choose an action:*
`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                // 📊 ANALYSIS TOOLS (3 main tools)
                [
                    { text: '👤 Username', callback_data: 'report_username' },
                    { text: '🎁 Gift', callback_data: 'report_gifts' },
                    { text: '🏴‍☠️ Anon Number', callback_data: 'report_numbers' }
                ],

                // 🔧 UTILITY TOOLS
                [
                    { text: '💼 Wallet Tracker', callback_data: 'menu_portfolio' },
                    { text: '🆚 Compare Names', callback_data: 'menu_compare' }
                ],

                // 🎮 ENGAGEMENT & SOCIAL
                [
                    { text: '🎲 Daily Reward', callback_data: 'menu_spin' }
                ],

                // 👤 PERSONAL
                [
                    { text: userIsPremium ? '⭐ My Profile' : '👤 My Profile', callback_data: 'menu_account' },
                    { text: '👥 Invite & Earn', callback_data: 'menu_invites' }
                ],

                // 📢 INFO
                [{ text: '💎 Partners & Sponsors', callback_data: 'menu_sponsors' }]
            ]
        }
    };

    if (isEdit) {
        try {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
        } catch (e) {
            if (!e.message.includes('message is not modified')) {
                await ctx.replyWithMarkdown(message, keyboard);
            }
        }
    } else {
        await ctx.replyWithMarkdown(message, keyboard);
    }
}

// Daily Spin (Dart Challenge) Handler
bot.action('menu_spin', async (ctx) => {
    await ctx.answerCbQuery();

    // Check membership first (Lazy check)
    if (!await checkMembershipOrStop(ctx)) return;

    // Send animation (Dart)
    const diceMsg = await ctx.replyWithDice({ emoji: '🎯' });

    // Skill/Luck Check based on dice value
    // Value 6 = Bullseye (Win)
    // Value 1-5 = Miss (Lose)
    setTimeout(async () => {
        try {
            const score = diceMsg.dice.value;
            const isWin = score === 6; // Only bullseye wins

            // Process cooldown and reward
            const result = await processSpin(ctx.from.id);

            // Override result success based on skill check (if cooldown allows)
            // If user is on cooldown, processSpin returns success:false
            if (!result.success) {
                const nextTime = new Date(result.nextSpin);
                const hrs = Math.ceil((nextTime - new Date()) / (1000 * 60 * 60));

                await ctx.replyWithMarkdown(`
⏳ *Cooldown Active*

You've already played today!
Please wait *${hrs} hours* for your next shot.

_Win valuable prizes by hitting the Bullseye 🎯!_
`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                        ]
                    }
                });
                return;
            }

            // User has spin available, check if they won the Dart game
            if (!isWin) {
                // Determine miss message
                const missMsg = score < 3 ? 'Way off! 😅' : 'So close! 🤏';

                await ctx.replyWithMarkdown(`
❌ *${missMsg}*

You missed the Bullseye! No prize this time.
Try again tomorrow!
`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                        ]
                    }
                });
                return;
            }

            // THEY WON! (Hit Bullseye)
            let message = `
🎉 *BULLSEYE! YOU WON!* 🎯

🎁 *Reward:* ${result.reward.label}

_Great shot! Come back tomorrow._
`;

            await ctx.replyWithMarkdown(message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });

        } catch (e) {
            console.error('Spin error:', e);
            await ctx.reply('❌ Error processing spin. Please try again.');
        }
    }, 4000); // 4 seconds delay for dice animation
});

// Invite Friends Handler
bot.action('menu_invites', async (ctx) => {
    await ctx.answerCbQuery();
    const stats = await getReferralStats(ctx.from.id);
    const progressPercent = Math.min(100, Math.round(((stats.progress) / stats.target) * 100));
    const progressBar = '▓'.repeat(stats.progress) + '░'.repeat(stats.target - stats.progress);

    const message = `
👥 *Invite Friends & Earn Premium*

Invite your friends to use ${CONFIG.BOT_NAME} and get *Free Premium* access!

🎁 *Your Reward Progress:*
${progressBar} *${stats.progress}/${stats.target}*
_Invite ${stats.target - stats.progress} more friends to get 7 Days Premium!_

🔗 *Your Referral Link:*
\`${stats.link}\`

📊 *Total Invites:* ${stats.count}

_Tap the link to copy and share it!_
`;

    try {
        await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📤 Share Link', url: `https://t.me/share/url?url=${encodeURIComponent(stats.link)}&text=Check+out+this+amazing+bot+for+Fragment+Trading!` }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(message, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📤 Share Link', url: `https://t.me/share/url?url=${encodeURIComponent(stats.link)}&text=Check+out+this+amazing+bot+for+Fragment+Trading!` }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }
});

// Welcome with main menu
bot.start(async (ctx) => {
    // Handle Referral Payload
    if (ctx.payload && ctx.payload.startsWith('ref_')) {
        const referrerId = ctx.payload.replace('ref_', '');
        if (referrerId && /^\d+$/.test(referrerId)) {
            // Process referral asynchronously
            processReferral(ctx.from.id, parseInt(referrerId)).then(result => {
                if (result.success && result.rewardGiven) {
                    // Notify referrer about reward
                    bot.telegram.sendMessage(result.referrerId, `
🎉 *Congratulations!*

You invited 5 friends and earned *7 Days of Premium*! 🌟

Thank you for supporting our community! 🚀
`, { parse_mode: 'Markdown' }).catch(() => { });
                } else if (result.success) {
                    // Notify referrer about new invite
                    bot.telegram.sendMessage(result.referrerId, `
👤 *New Referral!*

A new user joined via your link!
You have invited: *${result.referralCount}/5* friends.

_Invite ${5 - (result.referralCount % 5)} more to get Free Premium!_
`, { parse_mode: 'Markdown' }).catch(() => { });
                }
            }).catch(err => console.error('Referral error:', err));
        }
    }

    // Membership check removed from start - moved to specific features

    return sendDashboard(ctx, false);
});

// Check membership handler
bot.action('check_membership', async (ctx) => {
    const isMember = await isChannelMember(ctx.from.id);

    if (isMember) {
        await ctx.answerCbQuery('✅ Welcome!');
        await sendDashboard(ctx, true);
    } else {
        await ctx.answerCbQuery('❌ You are not a member yet! Please join the channel first.', { show_alert: true });
        // Refresh join message
        try { await ctx.deleteMessage(); } catch (e) { }
        return sendJoinChannelMessage(ctx);
    }
});


// Help
bot.help((ctx) => ctx.replyWithMarkdown(`
🌟 *${CONFIG.BOT_NAME} Help*

Send any username to get complete market analysis.
`));

// ==================== ADMIN PANEL ====================



// /panel command - Admin only
bot.command('panel', async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return ctx.reply('❌ Access denied. Admin only.');
    }

    const stats = getStats();
    const limiterStats = getLimiterStats();

    await ctx.replyWithMarkdown(`
🔐 *Admin Panel*

📊 *Quick Stats:*
• Total Users: ${stats.totalUsers}
• Premium: ${stats.premiumUsers} 🌟
• Free: ${stats.freeUsers}
• Blocked: ${stats.blockedUsers} 🚫

🚦 *System Load:*
• Active requests: ${limiterStats.global.running}
• Queued: ${limiterStats.global.queued}

Choose an action:
`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Stats', callback_data: 'admin_stats' }, { text: '🔧 System', callback_data: 'admin_system' }],
                [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
                [{ text: '📊 Market Stats', callback_data: 'admin_market_stats' }],
                [{ text: '🖼️ News Post', callback_data: 'admin_frag_news' }, { text: '🖼️ News Post 2', callback_data: 'admin_frag_news_2' }],
                [{ text: '🚫 Block User', callback_data: 'admin_block' }, { text: '✅ Unblock', callback_data: 'admin_unblock' }],
                [{ text: '🌟 Add Premium', callback_data: 'admin_premium' }],
                [{ text: '✏️ Edit Sponsor', callback_data: 'admin_edit_sponsor' }],
                [{ text: '📱 My Accounts', callback_data: 'admin_accounts' }]
            ]
        }
    });
});

// Admin Fragment News - Set state
bot.action('admin_frag_news', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, {
        action: 'frag_news_await_photo',
        timestamp: Date.now()
    });

    await ctx.replyWithMarkdown(`
🖼️ *New Community News Post*

First, send the *image* you want to use.
_Ideally a square or portrait image._

Type /cancel to cancel.
`);
});

// Admin Fragment News 2 - Full Image (No Cropping)
bot.action('admin_frag_news_2', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, {
        action: 'frag_news_2_await_photo',
        timestamp: Date.now()
    });

    await ctx.replyWithMarkdown(`
🖼️ *News Post 2 - Full Image Edition*

Send the *image* you want to use.
_Image will be displayed in FULL without any cropping._

Type /cancel to cancel.
`);
});

// Admin Edit Sponsor Text
bot.action('admin_edit_sponsor', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    const currentText = getSponsorText();

    userStates.set(ctx.chat.id, {
        action: 'admin_edit_sponsor',
        timestamp: Date.now()
    });

    await ctx.replyWithMarkdown(`
✏️ *Edit Sponsor Text*

Current sponsor text:
━━━━━━━━━━━━━━━━
${currentText}
━━━━━━━━━━━━━━━━

*Send the new sponsor text below.*
_You can use Markdown formatting._

Type /cancel to cancel.
`);
});

// Market Stats Handler
bot.action('admin_market_stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied').catch(() => { });

    // Initial feedback to user - wrapped in try/catch to prevent global error handler
    await ctx.answerCbQuery().catch(() => { });
    const loadingMsg = await ctx.reply('⏳ Scraping market data (Gifts & +888)... This may take ~30s.');

    try {
        // Run tasks in parallel
        const [tonPrice, gifts, price888] = await Promise.all([
            getTonPrice(),
            getGiftStats(),
            get888Stats()
        ]);

        // gifts now always has data (with fallback if scraping failed)
        const giftCount = Object.keys(gifts).length;

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMsg.message_id,
            undefined,
            '🎨 Generating Market Card...'
        ).catch(() => { });

        const imageBuffer = await generateMarketCard({
            gifts,
            price888,
            tonPrice
        });

        // Delete loading message - ignore errors if already deleted
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => { });

        await ctx.replyWithPhoto({ source: Buffer.from(imageBuffer) }, {
            caption: `📊 *Market Stats Report*\n\n💎 TON: $${tonPrice.toFixed(2)}\n🎁 Gifts: ${giftCount} tracked\n📞 +888 Floor: ${price888 != null ? price888.toLocaleString() + ' TON' : 'N/A'}`,
            parse_mode: 'Markdown'
        });

    } catch (error) {
        console.error('Market Stats Error:', error);
        // Try to show error in the loading message, ignore if it fails
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMsg.message_id,
            undefined,
            `❌ Error: ${error.message}`
        ).catch(() => { });
    }
});

// Admin Stats
bot.action('admin_stats', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    const stats = getStats();
    const allUsers = getAllUsers();
    const premiumList = allUsers
        .filter(u => u.premium?.active)
        .slice(0, 5)
        .map(u => `• ${u.id}`)
        .join('\n') || 'None';

    await ctx.replyWithMarkdown(`
📊 *Detailed Statistics*

👥 *Users:*
• Total: ${stats.totalUsers}
• Premium: ${stats.premiumUsers} 🌟
• Free: ${stats.freeUsers}
• Blocked: ${stats.blockedUsers} 🚫

🌟 *Recent Premium Users:*
${premiumList}

⏰ _Updated: ${new Date().toLocaleString()}_
`);
});

// Admin System Stats
bot.action('admin_system', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    const limiterStats = getLimiterStats();
    const cacheStats = getAllCacheStats();
    const stateStats = getStateStats();
    const poolStats = getPoolStats();

    await ctx.replyWithMarkdown(`
🔧 *System Performance*

🏊 *Browser Pool:*
• Active: ${poolStats.borrowed}/${poolStats.max}
• Available: ${poolStats.available}
• Pending: ${poolStats.pending}

🚦 *Rate Limiter:*
• Global: ${limiterStats.global.running} active, ${limiterStats.global.queued} queued
• Fragment: ${limiterStats.fragment.running} active, ${limiterStats.fragment.queued} queued
• User limiters: ${limiterStats.userLimitersCount}

📦 *Caches:*
• Fragment: ${cacheStats.fragment.size} entries (${cacheStats.fragment.hitRate} hit)
• Portfolio: ${cacheStats.portfolio.size} entries
• TON Price: ${cacheStats.tonPrice.size} entries

🧠 *State Manager:*
• Active states: ${stateStats.size}/${stateStats.maxSize}
• Utilization: ${stateStats.utilization}

⏰ _Updated: ${new Date().toLocaleString()}_
`);
});

// Admin Broadcast - Set state
bot.action('admin_broadcast', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, {
        action: 'admin_broadcast',
        timestamp: Date.now()
    });

    await ctx.replyWithMarkdown(`
📢 *Broadcast Message*

Send the message you want to broadcast to all users.

_Supports Markdown formatting._

Type /cancel to cancel.
`);
});

// Admin Block User - Set state
bot.action('admin_block', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, {
        action: 'admin_block',
        timestamp: Date.now()
    });

    await ctx.replyWithMarkdown(`
🚫 *Block User*

Send the user ID to block.

_Example: 123456789_

Type /cancel to cancel.
`);
});

// Admin Unblock User - Set state
bot.action('admin_unblock', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, {
        action: 'admin_unblock',
        timestamp: Date.now()
    });

    await ctx.replyWithMarkdown(`
✅ *Unblock User*

Send the user ID to unblock.

_Example: 123456789_

Type /cancel to cancel.
`);
});

// Admin Add Premium - Set state
bot.action('admin_premium', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, {
        action: 'admin_premium',
        timestamp: Date.now()
    });

    await ctx.reply(`🌟 Add Premium

Send the user ID and number of days:

Format: user_id days
Example: 123456789 30

Type /cancel to cancel.`);
});

// ==================== ACCOUNT MANAGEMENT HANDLERS ====================

// 1. Main Accounts Menu
bot.action('admin_accounts', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    try { await ctx.answerCbQuery(); } catch (e) { }

    const accounts = accountManager.getAccountList();
    const activeCount = accounts.filter(a => a.statusDisplay.includes('Active')).length;

    await ctx.editMessageText(`
📱 *My Accounts*

Manage your connected Telegram sessions.

📊 *Summary:*
• Total: ${accounts.length}
• Active: ${activeCount}
• Disconnected: ${accounts.length - activeCount}

👇 Choose an option:
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 Manage Accounts', callback_data: 'admin_manage_list' }],
                [{ text: '➕ Add Account', callback_data: 'panel_add_account' }],
                [{ text: '👥 Group To Group', callback_data: 'admin_g2g_menu' }],
                [{ text: '📊 Global Stats', callback_data: 'admin_global_stats' }],
                [{ text: '🔙 Back to Panel', callback_data: 'admin_panel' }]
            ]
        }
    }); // Fallback to new message if edit fails handled by try/catch in caller usually, but here we assume context
});

// Back to Panel handler (needs to be capable of editing)
bot.action('admin_panel', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();
    // Re-trigger the panel command logic but via edit
    // To simplify, we just delete and send fresh or edit text.
    // Let's call the command logic but adapted for edit.

    const stats = getStats();
    const limiterStats = getLimiterStats();

    await ctx.editMessageText(`
🔐 *Admin Panel*

📊 *Quick Stats:*
• Total Users: ${stats.totalUsers}
• Premium: ${stats.premiumUsers} 🌟
• Free: ${stats.freeUsers}
• Blocked: ${stats.blockedUsers} 🚫

🚦 *System Load:*
• Active requests: ${limiterStats.global.running}
• Queued: ${limiterStats.global.queued}

Choose an action:
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📊 Stats', callback_data: 'admin_stats' }, { text: '🔧 System', callback_data: 'admin_system' }],
                [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
                [{ text: '📊 Market Stats', callback_data: 'admin_market_stats' }],
                [{ text: '🖼️ News Post', callback_data: 'admin_frag_news' }, { text: '🖼️ News Post 2', callback_data: 'admin_frag_news_2' }],
                [{ text: '🚫 Block User', callback_data: 'admin_block' }, { text: '✅ Unblock', callback_data: 'admin_unblock' }],
                [{ text: '🌟 Add Premium', callback_data: 'admin_premium' }],
                [{ text: '✏️ Edit Sponsor', callback_data: 'admin_edit_sponsor' }],
                [{ text: '📱 My Accounts', callback_data: 'admin_accounts' }]
            ]
        }
    });
});

// 2. Manage List (List all accounts)
bot.action('admin_manage_list', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
    await ctx.answerCbQuery();

    const accounts = accountManager.getAccountList();

    // Generate buttons for each account
    const buttons = accounts.map(acc => {
        let icon = acc.isActive ? (acc.connected ? '🟢' : '🔴') : '⚫';
        let roleTag = acc.role === 'scanner' ? '[Scan]' : acc.role === 'checker' ? '[Check]' : '';
        return [{
            text: `${icon} ${acc.phone} ${roleTag}`,
            callback_data: `admin_manage_one:${acc.phone}`
        }];
    });

    // Add back button
    buttons.push([{ text: '🔙 Back', callback_data: 'admin_accounts' }]);

    await ctx.editMessageText(`
📋 *Account List*

Select an account to manage.

🟢 = Active & Connected
🔴 = Active but Disconnected
⚫ = Disabled
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: buttons
        }
    });
});

// 3. Single Account Management Menu
bot.action(/admin_manage_one:(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
    const phone = ctx.match[1];
    const acc = accountManager.getAccount(phone);

    if (!acc) return ctx.answerCbQuery('❌ Account not found', { show_alert: true });
    await ctx.answerCbQuery();

    const status = acc.isActive ? (accountManager.getClient(acc.role) ? '🟢 Connected' : '🔴 Disconnected') : '⚫ Disabled'; // Logic approx

    await ctx.editMessageText(`
👤 *Account Details*

📱 *Phone:* \`${acc.phone}\`
👤 *User:* ${acc.firstName} (@${acc.username || 'NoUser'})
🏷️ *Role:* ${acc.role.toUpperCase()}
🔌 *Status:* ${status}
🌐 *Proxy:* ${acc.proxy ? `✅ Enabled (${acc.proxy.ip})` : '❌ Direct'}

📊 *Stats Today:*
• Requests: ${acc.stats.requestsToday}
• Failed: ${acc.stats.failedRequests}

👇 Actions:
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'ℹ️ Health Check', callback_data: `admin_acc_health:${phone}` }],
                [{ text: acc.isActive ? '⏸️ Disable' : '▶️ Enable', callback_data: `admin_acc_toggle:${phone}` },
                { text: '🎭 Set Role', callback_data: `admin_acc_role:${phone}` }],
                [{ text: '🛡️ Set Proxy', callback_data: `admin_acc_proxy:${phone}` },
                { text: '🗑️ Delete', callback_data: `admin_acc_del_ask:${phone}` }],
                [{ text: '🔙 Back to List', callback_data: 'admin_manage_list' }]
            ]
        }
    });
});

// 4. Toggle Active Status
bot.action(/admin_acc_toggle:(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    const phone = ctx.match[1];
    await accountManager.toggleAccount(phone);

    // Refresh the view by calling the manager handler again
    // We simulate a callback match
    ctx.match = [null, phone];
    // Trick to re-render: call the function directly or re-emit? 
    // Easiest is to manually call the body of admin_manage_one logic logic again or just edit text.
    // Let's create a reusable render function or just copy logic? 
    // For now, simpler to just trigger the view again.

    // We can't easily call local function if it's not extracted.
    // Let's just send a quick alert and re-open the menu?
    // Better: Duplicate logic briefly for refresh
    const acc = accountManager.getAccount(phone);
    const status = acc.isActive ? 'Enabled' : 'Disabled';
    await ctx.answerCbQuery(`✅ Account ${status}`);

    // Re-render
    // trigger action manually?
    // bot.handleUpdate? No, too complex.
    // Just edit the message again.
    const fullStatus = acc.isActive ? (accountManager.getClient(acc.role) ? '🟢 Connected' : '🔴 Disconnected') : '⚫ Disabled';

    await ctx.editMessageText(`
👤 *Account Details*

📱 *Phone:* \`${acc.phone}\`
👤 *User:* ${acc.firstName} (@${acc.username || 'NoUser'})
🏷️ *Role:* ${acc.role.toUpperCase()}
🔌 *Status:* ${fullStatus}
🌐 *Proxy:* ${acc.proxy ? `✅ Enabled (${acc.proxy.ip})` : '❌ Direct'}

📊 *Stats Today:*
• Requests: ${acc.stats.requestsToday}
• Failed: ${acc.stats.failedRequests}

👇 Actions:
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'ℹ️ Health Check', callback_data: `admin_acc_health:${phone}` }],
                [{ text: acc.isActive ? '⏸️ Disable' : '▶️ Enable', callback_data: `admin_acc_toggle:${phone}` },
                { text: '🎭 Set Role', callback_data: `admin_acc_role:${phone}` }],
                [{ text: '🛡️ Set Proxy', callback_data: `admin_acc_proxy:${phone}` },
                { text: '🗑️ Delete', callback_data: `admin_acc_del_ask:${phone}` }],
                [{ text: '🔙 Back to List', callback_data: 'admin_manage_list' }]
            ]
        }
    });
});

// 5. Health Check
bot.action(/admin_acc_health:(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
    const phone = ctx.match[1];

    await ctx.answerCbQuery('🩺 Checking health...');

    const health = await accountManager.checkAccountHealth(phone);

    let msg = `🩺 *Health Check Report: ${phone}*\n\n`;
    if (health.connected) {
        msg += `✅ *Connected*\n`;
        msg += `📡 Ping: ${health.ping}\n`;
        msg += `👤 User: ${health.user}\n`;
        msg += `🌟 Premium: ${health.isPremium ? 'Yes' : 'No'}\n`;
    } else {
        msg += `❌ *Connection Failed*\n`;
        msg += `⚠️ Error: ${health.error}\n`;
    }

    await ctx.reply(msg, { parse_mode: 'Markdown' });
});

// 6. Set Role Menu
bot.action(/admin_acc_role:(.+)/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery();
    const phone = ctx.match[1];
    await ctx.answerCbQuery();

    await ctx.editMessageText(`
🎭 *Select Role for ${phone}*

• *ALL*: Can do everything (default)
• *SCANNER*: Only scans gifts (high speed, riskier)
• *CHECKER*: Only checks usernames/phones (lower rate limit)

Current: *${accountManager.getAccount(phone).role.toUpperCase()}*
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'ALL', callback_data: `admin_pset_role:${phone}:all` }],
                [{ text: 'SCANNER', callback_data: `admin_pset_role:${phone}:scanner` }],
                [{ text: 'CHECKER', callback_data: `admin_pset_role:${phone}:checker` }],
                [{ text: '🔙 Cancel', callback_data: `admin_manage_one:${phone}` }]
            ]
        }
    });
});

// Apply Role
bot.action(/admin_pset_role:(.+):(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    const role = ctx.match[2];

    await accountManager.updateAccount(phone, { role });
    await ctx.answerCbQuery(`✅ Role set to ${role.toUpperCase()}`);

    // Go back to main view (simulated)
    ctx.match = [null, phone]; // Mock for regex match
    // Reuse the view logic... or just call the manage_one button callback
    // We can manually trigger the button click action? No.
    // Let's just send "Role Updated" and show button to go back.

    await ctx.editMessageText(`✅ Role updated to *${role.toUpperCase()}*`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Account', callback_data: `admin_manage_one:${phone}` }]]
        }
    });
});

// 7. Delete Ask
bot.action(/admin_acc_del_ask:(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    await ctx.editMessageText(`
⚠️ *DELETE ACCOUNT?*

Are you sure you want to delete *${phone}*?
This will disconnect the session and remove it from the database.
This action cannot be undone.
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ YES, DELETE', callback_data: `admin_acc_del_confirm:${phone}` }],
                [{ text: '❌ NO, CANCEL', callback_data: `admin_manage_one:${phone}` }]
            ]
        }
    });
});

// Delete Confirm
bot.action(/admin_acc_del_confirm:(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    await accountManager.removeAccount(phone);
    await ctx.answerCbQuery('✅ Account deleted');
    await ctx.editMessageText('✅ Account successfully deleted.', {
        reply_markup: {
            inline_keyboard: [[{ text: '📋 Back to List', callback_data: 'admin_manage_list' }]]
        }
    });
});

// 8. Global Stats
bot.action('admin_global_stats', async (ctx) => {
    const list = accountManager.getAccountList();
    let totalReq = 0;
    let totalFail = 0;
    list.forEach(a => {
        totalReq += a.stats.requestsToday;
        totalFail += a.stats.failedRequests;
    });

    await ctx.editMessageText(`
📊 *Global Account Stats (Today)*

📈 Total Requests: ${totalReq}
⚠️ Failed Requests: ${totalFail}
📉 Error Rate: ${totalReq > 0 ? ((totalFail / totalReq) * 100).toFixed(1) : 0}%

👥 *Breakdown:*
${list.map(a => `• \`${a.phone}\`: ${a.stats.requestsToday} req`).join('\n')}
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin_accounts' }]]
        }
    });
});

// 9. Set Proxy - Set State
bot.action(/admin_acc_proxy:(.+)/, async (ctx) => {
    const phone = ctx.match[1];
    userStates.set(ctx.chat.id, {
        action: 'awaiting_proxy_input',
        phone: phone,
        timestamp: Date.now()
    });

    await ctx.reply(`
🛡️ *Set Proxy for ${phone}*

Send the proxy in one of these formats:
1. \`ip:port:user:pass\` (Socks5 with auth)
2. \`ip:port\` (Socks5 no auth)
3. \`clear\` or \`none\` to remove proxy.

👇 Type below:
`, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery();
});

// Proxy Input Handler (Hook into text handler)
// We need to check this logic in the 'text' listener

// ==================== GROUP TO GROUP HANDLERS ====================

// G2G Main Menu
bot.action('admin_g2g_menu', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    const status = g2g.getStatus();
    const listResult = await g2g.getExtractedList(0, 0);
    const stats = listResult.success ? listResult.stats : { total: 0, addedToContacts: 0, addedToGroup: 0 };

    await ctx.editMessageText(`
👥 *Group To Group*

Extract owners from gift collections and add them to your groups.

📊 *Current Status:*
• Extracted: ${stats.total}
• Added to Contacts: ${stats.addedToContacts}
• Added to Group: ${stats.addedToGroup}
• ${status.isExtracting ? '⏳ Extracting...' : status.isAddingToGroup ? '⏳ Adding to group...' : '✅ Ready'}

👇 Choose an option:
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔍 Extract Owners', callback_data: 'g2g_extract' }],
                [{ text: '📋 View Contacts', callback_data: 'g2g_view' }],
                [{ text: '📱 Add to Contacts', callback_data: 'g2g_add_contacts' }],
                [{ text: '➕ Add to Group', callback_data: 'g2g_add_group' }],
                [{ text: '🗑️ Clear List', callback_data: 'g2g_clear_ask' }],
                [{ text: '🔙 Back', callback_data: 'admin_accounts' }]
            ]
        }
    });
});

// G2G Extract - Ask for collection
bot.action('g2g_extract', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, {
        action: 'g2g_awaiting_collection',
        timestamp: Date.now()
    });

    await ctx.reply(`
🔍 *Extract Owners*

Send the collection info in this format:
\`CollectionName start end\`

*Example:*
\`PlushPepe 1 1000\`

This will extract owners from PlushPepe-1 to PlushPepe-1000.

Type /cancel to cancel.
`, { parse_mode: 'Markdown' });
});

// G2G View Contacts
bot.action('g2g_view', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    const result = await g2g.getExtractedList(10, 0);

    if (!result.success) {
        return ctx.reply(`❌ Error: ${result.error}`);
    }

    const stats = result.stats;
    let contactsList = result.contacts.map((c, i) =>
        `${i + 1}. @${c.username} ${c.addedToContacts ? '📱' : ''} ${c.addedToGroup ? '✅' : ''}`
    ).join('\\n') || 'No contacts yet';

    await ctx.editMessageText(`
📋 *Extracted Contacts*

📊 *Stats:*
• Total: ${stats.total}
• Added to Contacts: ${stats.addedToContacts} 📱
• Added to Group: ${stats.addedToGroup} ✅
• Pending: ${stats.pending}

*Recent 10:*
${contactsList}
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔄 Refresh', callback_data: 'g2g_view' }],
                [{ text: '🔙 Back', callback_data: 'admin_g2g_menu' }]
            ]
        }
    });
});

// G2G Add to Contacts
bot.action('g2g_add_contacts', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery('⏳ Adding to contacts...');

    const loadingMsg = await ctx.reply('⏳ Adding extracted users to contacts...');

    const result = await g2g.addAllToContacts((progress) => {
        ctx.telegram.editMessageText(
            ctx.chat.id, loadingMsg.message_id, undefined,
            `⏳ Adding to contacts: ${progress.added}/${progress.total}`
        ).catch(() => { });
    });

    await ctx.telegram.editMessageText(
        ctx.chat.id, loadingMsg.message_id, undefined,
        result.success
            ? `✅ Added ${result.added} contacts!`
            : `❌ Error: ${result.error}`
    );
});

// G2G Add to Group - Ask for invite link
bot.action('g2g_add_group', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, {
        action: 'g2g_awaiting_invite',
        timestamp: Date.now()
    });

    await ctx.reply(`
➕ *Add to Group*

Send the group invite link:
\`https://t.me/+abc123\`

⚠️ *Anti-ban mode:*
• 30 second delay between adds
• Max 50/day per account
• Auto-pause on FloodWait

Type /cancel to cancel.
`, { parse_mode: 'Markdown' });
});

// G2G Clear - Confirm
bot.action('g2g_clear_ask', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
    await ctx.answerCbQuery();

    await ctx.editMessageText(`
⚠️ *Clear All Contacts?*

This will delete all extracted contacts from the database.
This action cannot be undone.
`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: '✅ YES, Clear All', callback_data: 'g2g_clear_confirm' }],
                [{ text: '❌ Cancel', callback_data: 'admin_g2g_menu' }]
            ]
        }
    });
});

// G2G Clear - Execute
bot.action('g2g_clear_confirm', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');

    const result = await g2g.clearExtractedList();
    await ctx.answerCbQuery(result.success ? `✅ Cleared ${result.deleted} contacts` : '❌ Error');

    // Return to menu
    ctx.match = null;
    return ctx.editMessageText('✅ List cleared!', {
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin_g2g_menu' }]]
        }
    });
});

// G2G Stop Adding
bot.action('g2g_stop', async (ctx) => {
    g2g.stopAdding();
    await ctx.answerCbQuery('⏹️ Stopping...');
});

// ==================== END GROUP TO GROUP ====================

// Cancel command
bot.command('cancel', async (ctx) => {
    userStates.delete(ctx.chat.id);
    await ctx.reply('❌ Action cancelled.');
});

// Handle photos
bot.on('photo', async (ctx) => {
    const chatId = ctx.chat.id;
    const userState = userStates.get(chatId);

    // News Post 1 - Photo handler
    if (userState && userState.action === 'frag_news_await_photo' && isAdmin(ctx.from.id)) {
        try {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const fileLink = await ctx.telegram.getFileLink(photo.file_id);

            // Download image
            const response = await fetch(fileLink);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

            // Update state
            userStates.set(chatId, {
                action: 'frag_news_await_text',
                image: base64,
                timestamp: Date.now()
            });

            await ctx.reply('✅ Image received!\n\nNow send the *Headline* text for the news card:', { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Photo error:', error);
            await ctx.reply(`❌ Error downloading photo:\n${error.message}`);
        }
    }

    // News Post 2 - Photo handler (Full Image, No Cropping)
    if (userState && userState.action === 'frag_news_2_await_photo' && isAdmin(ctx.from.id)) {
        try {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const fileLink = await ctx.telegram.getFileLink(photo.file_id);

            const response = await fetch(fileLink);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

            userStates.set(chatId, {
                action: 'frag_news_2_await_text',
                image: base64,
                timestamp: Date.now()
            });

            await ctx.reply('✅ Image received!\n\nNow send the *Headline* text for the news card:', { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Photo error:', error);
            await ctx.reply(`❌ Error downloading photo:\n${error.message}`);
        }
    }
});

// ==================== G2G TEXT INPUT HANDLERS ====================
// This middleware captures text input specifically for G2G operations
bot.use(async (ctx, next) => {
    const chatId = ctx.chat.id;
    const userState = userStates.get(chatId);

    if (!userState) return next();

    // Handle CSV Document Upload
    if (userState.action === 'g2g_awaiting_csv' && ctx.message?.document && isAdmin(ctx.from.id)) {
        try {
            const doc = ctx.message.document;
            const fileLink = await ctx.telegram.getFileLink(doc.file_id);
            const response = await fetch(fileLink);
            const text = await response.text();

            userStates.delete(chatId);
            const loadingMsg = await ctx.reply('⏳ Importing usernames from CSV...');

            const result = await g2g.importFromCSV(text);

            await ctx.telegram.editMessageText(
                chatId, loadingMsg.message_id, undefined,
                result.success
                    ? `✅ Imported ${result.imported} usernames!`
                    : `❌ Error: ${result.error}`,
                { reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin_g2g_menu' }]] } }
            );
        } catch (e) {
            await ctx.reply(`❌ Upload error: ${e.message}`);
        }
        return;
    }

    if (!ctx.message?.text) return next();

    // G2G: Chat Extraction
    if (userState.action === 'g2g_awaiting_chat' && isAdmin(ctx.from.id)) {
        const text = ctx.message.text.trim();
        userStates.delete(chatId);

        const loadingMsg = await ctx.reply(`⏳ Connecting to ${text} and extracting members...`);

        // Run extraction
        g2g.extractMembersFromChat(text, async (progress) => {
            if (progress.processed % 200 === 0) {
                await ctx.telegram.editMessageText(
                    chatId, loadingMsg.message_id, undefined,
                    `⏳ Extracting from chat...\nFound: ${progress.found}\nProcessed: ${progress.processed}/${progress.total}`
                ).catch(() => { });
            }
        }).then(async (result) => {
            await ctx.telegram.editMessageText(
                chatId, loadingMsg.message_id, undefined,
                result.success
                    ? `✅ Extraction Complete!\n\n📋 Extracted: ${result.extracted} members\n💬 Chat: ${result.chatName}`
                    : `❌ Error: ${result.error}`,
                { reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'admin_g2g_menu' }]] } }
            );
        });
        return;
    }

    // G2G: Collection extraction input
    if (userState.action === 'g2g_awaiting_collection' && isAdmin(ctx.from.id)) {
        const text = ctx.message.text.trim();
        const parts = text.split(/\s+/);

        if (parts.length < 3) {
            return ctx.reply('❌ Invalid format. Use: `CollectionName start end`\nExample: `PlushPepe 1 1000`', { parse_mode: 'Markdown' });
        }

        const [slug, startStr, endStr] = parts;
        const start = parseInt(startStr);
        const end = parseInt(endStr);

        if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
            return ctx.reply('❌ Invalid range. Start must be >= 1 and end must be >= start.');
        }

        // Limit range for safety
        if (end - start > 10000) {
            return ctx.reply('❌ Range too large. Maximum 10,000 items at once.');
        }

        userStates.delete(chatId);
        const loadingMsg = await ctx.reply(`⏳ Extracting owners from ${slug}-${start} to ${slug}-${end}...`);

        // Run in background but update message occasionally
        g2g.extractOwnersFromCollection(slug, start, end, (progress) => {
            // Let the real-time menu handler do the updates, or we can update here too
            if (progress.processed % 5 === 0) {
                ctx.telegram.editMessageText(
                    chatId, loadingMsg.message_id, undefined,
                    `⏳ Extracting: ${progress.processed}/${progress.total} (${progress.percent}%)\n📋 Found: ${progress.found} unique owners`
                ).catch(() => { });
            }
        }).then(async (result) => {
            await ctx.telegram.editMessageText(
                chatId, loadingMsg.message_id, undefined,
                result.success
                    ? `✅ Extraction complete!\n\n📋 Extracted: ${result.extracted} unique owners\n📦 From: ${result.total} items`
                    : `❌ Error: ${result.error}`,
                {
                    reply_markup: {
                        inline_keyboard: [[{ text: '👥 Back to G2G Menu', callback_data: 'admin_g2g_menu' }]]
                    }
                }
            );
        });
        return;
    }

    // G2G: Invite link input for adding to group
    if (userState.action === 'g2g_awaiting_invite' && isAdmin(ctx.from.id)) {
        const text = ctx.message.text.trim();

        if (!text.includes('t.me/') && !text.includes('telegram.me/')) {
            return ctx.reply('❌ Invalid invite link. Send a valid Telegram group invite link.');
        }

        userStates.delete(chatId);
        const loadingMsg = await ctx.reply(`⏳ Starting Smart Add to Group...\n\n⚠️ Running in background with anti-ban protection.`);

        g2g.addContactsToGroup(text, (stats) => {
            // Updates handled by menu status mostly
        }).then(async (result) => {
            await ctx.telegram.sendMessage(chatId,
                result.success
                    ? `✅ Group Adding Task Finished!\n\n✅ Added: ${result.added}\n❌ Failed: ${result.failed}`
                    : `❌ Error: ${result.error}`
            );
        });

        // Return to menu immediately
        return ctx.reply('✅ Task started in background! Check status in G2G Menu.', {
            reply_markup: {
                inline_keyboard: [[{ text: '👥 Go to G2G Menu', callback_data: 'admin_g2g_menu' }]]
            }
        });
    }

    return next();
});

// ==================== INLINE MODE HANDLER ====================
bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();
    const userId = ctx.from.id;

    if (!query) {
        // Empty query - Show suggestions
        return ctx.answerInlineQuery([
            {
                type: 'article',
                id: 'help_username',
                title: '👤 Search Username',
                description: 'Type @username to analyze value',
                thumb_url: 'https://fragment.com/img/fragment_logo.png', // Fallback or specific icon
                input_message_content: {
                    message_text: 'To analyze a username, type: `@iFragmentBot @username`',
                    parse_mode: 'Markdown'
                }
            },
            {
                type: 'article',
                id: 'help_gift',
                title: '🎁 Search Gift',
                description: 'Paste a gift link to analyze',
                thumb_url: 'https://nft.fragment.com/img/gifts/gift_standard.png', // Example icon
                input_message_content: {
                    message_text: 'To analyze a gift, type: `@iFragmentBot https://t.me/nft/...`',
                    parse_mode: 'Markdown'
                }
            }
        ], { cache_time: 300, is_personal: true });
    }

    const results = [];

    // 1. Handle Gift Link
    const giftParsed = parseGiftLink(query);
    if (giftParsed.isValid) {
        results.push({
            type: 'article',
            id: `gift_${Date.now()}`,
            title: `🎁 Analyze Gift: ${giftParsed.modelName || 'Gift'}`,
            description: `Model: ${giftParsed.modelName} #${giftParsed.pattern || '?'} - Click to generate full report`,
            thumb_url: 'https://nft.fragment.com/img/gifts/gift_premium.png', // Generic gift icon
            input_message_content: {
                message_text: `!Gifts ${query}`, // Trigger the group command
                parse_mode: 'Markdown'
            }
        });

        // Add specific item option if possible (mocked for now as we can't scrape inside inline fast enough)
        return ctx.answerInlineQuery(results, { cache_time: 0 });
    }

    // 2. Handle Wallet Address
    if (query.length > 40 || query.startsWith('UQ') || query.startsWith('EQ')) {
        results.push({
            type: 'article',
            id: `wallet_${Date.now()}`,
            title: `💼 Track Wallet`,
            description: `${query.substring(0, 10)}...${query.substring(query.length - 5)}`,
            thumb_url: 'https://ton.org/download/ton_symbol.png', // TON Logo
            input_message_content: {
                message_text: `!Wallet ${query}`,
                parse_mode: 'Markdown'
            }
        });
        return ctx.answerInlineQuery(results, { cache_time: 300 });
    }

    // 3. Handle Username (@username or username)
    const potentialUsername = query.replace('@', '').toLowerCase();
    if (/^[a-zA-Z0-9_]{4,32}$/.test(potentialUsername)) {

        // Option 1: Quick Analysis (Trigger Command)
        results.push({
            type: 'article',
            id: `user_${potentialUsername}`,
            title: `💎 Analyze @${potentialUsername}`,
            description: 'Click to generate valuation report',
            thumb_url: 'https://fragment.com/img/fragment_logo.png',
            input_message_content: {
                message_text: `!Username @${potentialUsername}`, // Trigger the group command
                parse_mode: 'Markdown'
            }
        });



        // Option 2: Wallet lookup by username
        results.push({
            type: 'article',
            id: `wallet_${potentialUsername}`,
            title: `💼 Portfolio: @${potentialUsername}`,
            description: 'Find owner wallet & assets',
            thumb_url: 'https://ton.org/download/ton_symbol.png',
            input_message_content: {
                message_text: `!Wallet @${potentialUsername}`,
                parse_mode: 'Markdown'
            }
        });

        // Option 3: Compare (if previously cached or simple heuristic)
        // For now, simple trigger is safest to ensure premium checks run in chat
    }

    return ctx.answerInlineQuery(results, { cache_time: 300 });
});

// Handle messages
bot.on('text', async (ctx) => {
    const input = ctx.message.text.trim();
    if (input.startsWith('/')) return;

    const chatId = ctx.chat.id;
    const userId = ctx.from.id;
    const userState = userStates.get(chatId);

    // ==================== GROUP COMMAND HANDLER ====================
    if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        if (input.startsWith('!')) {
            await handleGroupCommand(ctx, input);
            return;
        }
    }

    // ==================== TELEGRAM LOGIN FLOW (PRIORITY) ====================

    // Handle phone number input for Telegram login
    if (userState && userState.action === 'awaiting_phone' && isAdmin(userId)) {
        const phonePattern = /^\+?\d{10,15}$/;
        if (phonePattern.test(input)) {
            // IMMEDIATELY set state to processing to prevent other handlers from processing
            userStates.set(chatId, { action: 'phone_processing', phone: input });

            const msg = await ctx.reply('📤 Sending verification code...');

            try {
                const tc = await getTelegramClient();
                const result = tc ? await tc.startLogin(input) : { success: false, error: 'Service not available' };

                console.log('📱 startLogin result:', result);

                if (result.success) {
                    userStates.set(chatId, { action: 'awaiting_code', phone: input });
                    await ctx.telegram.editMessageText(
                        chatId, msg.message_id, null,
                        '✅ Code sent!\n\n🔐 Please enter the verification code you received:',
                        { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'panel_cancel_login' }]] } }
                    );
                } else {
                    userStates.delete(chatId);
                    await ctx.telegram.editMessageText(
                        chatId, msg.message_id, null,
                        `❌ Failed to send code: ${result.error}\n\nPlease try again with /panel`
                    );
                }
            } catch (error) {
                console.error('❌ Phone handler error:', error);
                userStates.delete(chatId);
                await ctx.telegram.editMessageText(
                    chatId, msg.message_id, null,
                    `❌ Error: ${error.message}\n\nPlease try again with /panel`
                );
            }
            return; // IMPORTANT: Stop processing here
        }
        // If phone pattern doesn't match, still return to avoid username handler
        return;
    }

    // Handle Proxy Input
    if (userState && userState.action === 'awaiting_proxy_input' && isAdmin(userId)) {
        if (input.toLowerCase() === 'clear' || input.toLowerCase() === 'none') {
            await accountManager.updateAccount(userState.phone, { proxy: null });
            await ctx.reply('✅ Proxy removed (Direct connection).');
        } else {
            // Parse ip:port:user:pass
            const parts = input.split(':');
            if (parts.length >= 2) {
                const proxy = {
                    ip: parts[0],
                    port: parts[1],
                    username: parts[2] || '',
                    password: parts[3] || '',
                    type: 'socks5'
                };
                await accountManager.updateAccount(userState.phone, { proxy });
                await ctx.reply(`✅ Proxy set to \`${parts[0]}:${parts[1]}\``, { parse_mode: 'Markdown' });
            } else {
                await ctx.reply('❌ Invalid format. Use `ip:port:user:pass`');
                return;
            }
        }
        userStates.delete(chatId);
        return;
    }

    // Handle verification code input
    if (userState && userState.action === 'awaiting_code' && isAdmin(userId)) {
        const codePattern = /^\d{5,6}$/;
        if (codePattern.test(input)) {
            const msg = await ctx.reply('🔄 Verifying code...');

            const tc = await getTelegramClient();
            const result = tc ? await tc.submitCode(input) : { success: false, error: 'Service not available' };

            if (result.success) {
                if (result.step === 'awaiting_2fa') {
                    userStates.set(chatId, { action: 'awaiting_2fa' });
                    await ctx.telegram.editMessageText(
                        chatId, msg.message_id, null,
                        '🔑 Two-factor authentication required.\n\nPlease enter your 2FA password:',
                        { reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'panel_cancel_login' }]] } }
                    );
                } else {
                    userStates.delete(chatId);
                    await ctx.telegram.editMessageText(
                        chatId, msg.message_id, null,
                        `✅ *Account connected successfully!*\n\n👤 ${result.user.firstName} ${result.user.lastName || ''}\n📱 @${result.user.username || 'no-username'}\n\nYou can now get complete gift information.`,
                        { parse_mode: 'Markdown' }
                    );
                }
            } else {
                userStates.delete(chatId);
                await ctx.telegram.editMessageText(
                    chatId, msg.message_id, null,
                    `❌ Verification failed: ${result.error}\n\nPlease try again with /panel`
                );
            }
            return;
        }
    }

    // Handle 2FA password input
    if (userState && userState.action === 'awaiting_2fa' && isAdmin(userId)) {
        // Delete password message for security
        try { await ctx.deleteMessage(); } catch (e) { }

        const msg = await ctx.reply('🔄 Verifying 2FA...');

        const tc = await getTelegramClient();
        const result = tc ? await tc.submit2FA(input) : { success: false, error: 'Service not available' };

        if (result.success) {
            userStates.delete(chatId);
            await ctx.telegram.editMessageText(
                chatId, msg.message_id, null,
                `✅ *Account connected successfully!*\n\n👤 ${result.user.firstName} ${result.user.lastName || ''}\n📱 @${result.user.username || 'no-username'}\n\nYou can now get complete gift information.`,
                { parse_mode: 'Markdown' }
            );
        } else {
            userStates.delete(chatId);
            await ctx.telegram.editMessageText(
                chatId, msg.message_id, null,
                `❌ 2FA failed: ${result.error}\n\nPlease try again with /panel`
            );
        }
        return;
    }

    // ==================== ADMIN ACTIONS PROCESSING ====================

    // Handle admin broadcast
    if (userState && userState.action === 'admin_broadcast' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const allUsers = getAllUsers();
        let successCount = 0;
        let failCount = 0;

        const statusMsg = await ctx.reply(`📢 Broadcasting to ${allUsers.length} users...`);

        for (const user of allUsers) {
            try {
                await bot.telegram.sendMessage(user.id, input, { parse_mode: 'Markdown' });
                successCount++;
            } catch (e) {
                failCount++;
            }
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 50));
        }

        await ctx.telegram.editMessageText(
            chatId,
            statusMsg.message_id,
            null,
            `✅ Broadcast complete!\n\n• Success: ${successCount}\n• Failed: ${failCount}`
        );
        return;
    }

    // Handle admin block
    if (userState && userState.action === 'admin_block' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const targetId = input.trim();
        if (!/^\d+$/.test(targetId)) {
            return ctx.reply('❌ Invalid user ID. Please send a numeric ID.');
        }

        blockUser(targetId);
        await ctx.reply(`🚫 User ${targetId} has been blocked.`);
        return;
    }

    // Handle admin unblock
    if (userState && userState.action === 'admin_unblock' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const targetId = input.trim();
        if (!/^\d+$/.test(targetId)) {
            return ctx.reply('❌ Invalid user ID. Please send a numeric ID.');
        }

        unblockUser(targetId);
        await ctx.reply(`✅ User ${targetId} has been unblocked.`);
        return;
    }

    // Handle admin premium
    if (userState && userState.action === 'admin_premium' && isAdmin(ctx.from.id)) {
        const parts = input.trim().split(/\s+/);
        if (parts.length !== 2) {
            return ctx.reply('❌ Invalid format. Use: user_id days\nExample: 123456789 30');
        }

        const [targetId, daysStr] = parts;
        const days = parseInt(daysStr);

        if (!/^\d+$/.test(targetId) || isNaN(days) || days < 1) {
            return ctx.reply('❌ Invalid format. User ID must be numeric and days must be positive.');
        }

        // Clear state only after validation passes
        userStates.delete(chatId);

        const result = activatePremium(targetId, days);
        const expiryDate = result.expiresAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await ctx.reply(`🌟 Premium activated!\n\n• User: ${targetId}\n• Days: ${days}\n• Expires: ${expiryDate}`);

        // Try to notify the user
        try {
            await bot.telegram.sendMessage(targetId, `
🎉 *Congratulations!*

You have received *${days} days* of Premium access!

📅 Expires: ${expiryDate}

Enjoy unlimited access to all features! 🌟
`, { parse_mode: 'Markdown' });
        } catch (e) {
            // User may have blocked the bot
        }
        return;
    }

    // Handle admin news generation
    if (userState && userState.action === 'frag_news_await_text' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const headline = input;
        const imageBase64 = userState.image;

        if (!imageBase64) {
            await ctx.reply('❌ Image data lost. Please start over by clicking the button again.');
            return;
        }

        const processingMsg = await ctx.reply('🎨 Generating news card...');

        try {
            console.log('🎨 Starting card generation...');
            const imageBuffer = await generateNewsCard({
                image: imageBase64,
                headline: headline
            });

            console.log(`✅ Card generated! Buffer size: ${imageBuffer ? imageBuffer.length : 0} bytes`);

            if (!imageBuffer || imageBuffer.length < 100) {
                throw new Error('Generated image is empty');
            }

            await ctx.telegram.deleteMessage(chatId, processingMsg.message_id);

            await ctx.replyWithPhoto({ source: Buffer.from(imageBuffer) }, {
                caption: `💎 *Fragment Community News*\n\nYour announcement card is ready!`,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('Story Card Error:', error);
            await ctx.telegram.deleteMessage(chatId, processingMsg.message_id);
            await ctx.reply(`❌ Failed to generate card:\n${error.message}`);
        }
        return;
    }

    // Handle admin news 2 generation (Full Image, No Cropping)
    if (userState && userState.action === 'frag_news_2_await_text' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const headline = input;
        const imageBase64 = userState.image;

        if (!imageBase64) {
            await ctx.reply('❌ Image data lost. Please start over by clicking the button again.');
            return;
        }

        const processingMsg = await ctx.reply('🎨 Generating News Card 2 (Full Image)...');

        try {
            console.log('🎨 Starting News Card 2 generation...');
            const imageBuffer = await generateNewsCard2({
                image: imageBase64,
                headline: headline
            });

            console.log(`✅ Card 2 generated! Buffer size: ${imageBuffer ? imageBuffer.length : 0} bytes`);

            if (!imageBuffer || imageBuffer.length < 100) {
                throw new Error('Generated image is empty');
            }

            await ctx.telegram.deleteMessage(chatId, processingMsg.message_id);

            await ctx.replyWithPhoto({ source: Buffer.from(imageBuffer) }, {
                caption: `💎 *Fragment Community News*\n\n_Full Image Edition_ - Your card is ready!`,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('Card 2 Gen Error:', error);
            await ctx.telegram.deleteMessage(chatId, processingMsg.message_id);
            await ctx.reply(`❌ Failed to generate card:\n${error.message}`);
        }
        return;
    }

    // Handle admin sponsor text edit
    if (userState && userState.action === 'admin_edit_sponsor' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        setSponsorText(input);

        await ctx.replyWithMarkdown(`
✅ *Sponsor text updated successfully!*

New sponsor text:
━━━━━━━━━━━━━━━━
${input}
━━━━━━━━━━━━━━━━
`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Back to Panel', callback_data: 'admin_panel' }]
                ]
            }
        });
        return;
    }

    // ==================== CHECK IF USER IS BLOCKED ====================
    // Global middleware handles this now

    // Handle compare flow
    if (userState && userState.action === 'compare') {
        let username = input.replace('@', '').toLowerCase();

        if (!isValidUsername(username)) {
            return ctx.reply('⚠️ Invalid username. Must be 4-32 characters.\n\n_Example: @crypto_', { parse_mode: 'Markdown' });
        }

        if (userState.step === 1) {
            // Step 1: Save first username, ask for second
            userStates.set(chatId, {
                action: 'compare',
                step: 2,
                username1: username,
                timestamp: Date.now()
            });

            return ctx.replyWithMarkdown(`
✅ First username: *@${username}*

Now send the *second* username to compare:
`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '❌ Cancel', callback_data: 'cancel_compare' }]
                    ]
                }
            });
        } else if (userState.step === 2) {
            // Step 2: Compare both usernames
            const username1 = userState.username1;
            const username2 = username;

            // Check if same username
            if (username1 === username2) {
                return ctx.reply('⚠️ You cannot compare a username with itself!\n\nSend a *different* username:', { parse_mode: 'Markdown' });
            }

            // Clear state
            userStates.delete(chatId);

            // Start comparison
            await handleComparison(ctx, username1, username2);
            return;
        }
    }

    // Handle portfolio flow - check if input is wallet or username for portfolio
    if (userState && userState.action === 'portfolio') {
        userStates.delete(chatId); // Clear state

        // Check if it's a wallet address (starts with UQ or EQ)
        if (input.startsWith('UQ') || input.startsWith('EQ') || input.length > 40) {
            // It's a wallet address - fetch portfolio
            await handlePortfolioByWallet(ctx, input);
            return;
        } else {
            // It's a username - first get the owner wallet, then fetch portfolio
            let username = input.replace('@', '').toLowerCase();
            if (isValidUsername(username)) {
                await handlePortfolioByUsername(ctx, username);
                return;
            }
        }
    }

    // Handle gift report flow - process gift link (QUEUE-BASED)
    if (userState && userState.action === 'gift_report') {
        userStates.delete(chatId); // Clear state

        // Check if it's a valid gift link
        const parsed = parseGiftLink(input);

        if (!parsed.isValid) {
            return ctx.reply('⚠️ Invalid gift link format.\n\nPlease send a link like:\n`https://t.me/nft/PlushPepe-1`', { parse_mode: 'Markdown' });
        }

        // Check if user has credits for gift report (applies to free users)
        if (!canUseFeature(userId, 'gift')) {
            const message = formatNoCreditsMessage('gift report');
            return ctx.replyWithMarkdown(message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌟 Buy Premium', callback_data: 'buy_premium' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }

        // Check hourly rate limit (anti-abuse for PREMIUM users only)
        if (isPremium(userId)) {
            const hourlyCheck = checkGiftHourlyLimit(userId);
            if (!hourlyCheck.allowed) {
                return ctx.replyWithMarkdown(`
⚠️ *Hourly Limit Reached*

To prevent abuse, you can only request *${GIFT_HOURLY_LIMIT} gift reports per hour*.

⏰ Please try again in *${hourlyCheck.waitMinutes} minutes*.
`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                        ]
                    }
                });
            }
        }

        // Deduct credit immediately and track hourly usage
        const creditResult = useFeature(userId, 'gift');
        if (isPremium(userId)) {
            useGiftHourlyLimit(userId);
        }

        // Check if queue is overloaded
        if (jobQueue.isOverloaded()) {
            return ctx.reply('⚠️ *Server is busy*\n\nToo many requests at the moment. Please try again in 1-2 minutes.', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }

        try {
            const tonPrice = tonPriceCache.get('price') || 5.5;
            const userPriority = isPremium(userId) ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL;

            // Add job to queue
            const jobId = await jobQueue.add({
                type: JOB_TYPES.GIFT_REPORT,
                userId,
                chatId,
                data: { link: input, tonPrice },
                priority: userPriority
            });

            // Get queue position
            const position = jobQueue.getPosition(jobId);
            const estimatedWait = jobQueue.getEstimatedWait(jobId);

            // Notify user based on queue status
            if (position <= 2) {
                // Near front of queue - processing soon
                await ctx.reply('🔮 *Processing your gift report...*\n\n_You\'ll receive the result shortly._', {
                    parse_mode: 'Markdown'
                });
            } else {
                // In queue - show position
                const queueMessage = formatQueueMessage(position, estimatedWait, isPremium(userId));
                await ctx.replyWithMarkdown(queueMessage);
            }

        } catch (queueError) {
            console.error('Queue error:', queueError.message);
            await ctx.reply(`❌ ${queueError.message}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'report_gifts' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }
        return;
    }

    // Handle username report flow - process username (QUEUE-BASED)
    if (userState && userState.action === 'username_report') {
        userStates.delete(chatId); // Clear state

        let username = input.replace('@', '').toLowerCase();

        if (!isValidUsername(username)) {
            return ctx.reply('⚠️ Invalid username. Must be 4-32 characters.\n\n_Example: @crypto_', { parse_mode: 'Markdown' });
        }

        // Check if user has credits for report
        if (!canUseFeature(userId, 'report')) {
            const message = formatNoCreditsMessage('report');
            return ctx.replyWithMarkdown(message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌟 Buy Premium', callback_data: 'buy_premium' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }

        // 🚀 CHECK CACHE FIRST - Return immediately if cached (no queue needed)
        const cachedResult = getCachedReport(username);
        if (cachedResult) {
            try {
                const { fragmentData, tonPrice, rarity, estValue, suggestions, cardData } = cachedResult;
                const imageBuffer = await generateFlexCard(cardData);
                const caption = buildFullCaption(fragmentData, cardData, tonPrice, rarity, estValue, suggestions);

                if (imageBuffer && imageBuffer.length >= 1000) {
                    const keyboard = fragmentData.ownerWalletFull
                        ? Markup.inlineKeyboard([
                            [Markup.button.callback('💼 Portfolio Tracker', `portfolio:${fragmentData.ownerWalletFull}`)],
                            [Markup.button.url('🔗 View on Fragment', fragmentData.url)]
                        ])
                        : Markup.inlineKeyboard([
                            [Markup.button.url('🔗 View on Fragment', fragmentData.url)]
                        ]);

                    await ctx.replyWithPhoto(
                        { source: Buffer.from(imageBuffer) },
                        { caption: caption + '\n\n_⚡ From cache_', parse_mode: 'Markdown', ...keyboard }
                    );
                } else {
                    await ctx.replyWithMarkdown(caption + '\n\n_⚡ From cache_');
                }

                // Deduct credit for cached reports
                const creditResult = useFeature(userId, 'report');
                const creditsMsg = formatCreditsMessage(creditResult.remaining, creditResult.isPremium);
                if (!creditResult.isPremium) {
                    await ctx.replyWithMarkdown(creditsMsg, Markup.inlineKeyboard([
                        [Markup.button.callback('💎 Buy Premium', 'buy_premium')]
                    ]));
                } else {
                    await ctx.replyWithMarkdown(creditsMsg);
                }
                return;
            } catch (cacheError) {
                console.error('Cache retrieval error:', cacheError.message);
                // Fall through to queue-based fresh fetch
            }
        }

        // Deduct credit immediately
        const creditResult = useFeature(userId, 'report');

        // Check if queue is overloaded
        if (jobQueue.isOverloaded()) {
            return ctx.reply('⚠️ *Server is busy*\n\nToo many requests at the moment. Please try again in 1-2 minutes.', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }

        try {
            const tonPrice = tonPriceCache.get('price') || 5.5;
            const userPriority = isPremium(userId) ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL;

            // Add job to queue
            const jobId = await jobQueue.add({
                type: JOB_TYPES.USERNAME_REPORT,
                userId,
                chatId,
                data: { username, tonPrice },
                priority: userPriority
            });

            // Get queue position
            const position = jobQueue.getPosition(jobId);
            const estimatedWait = jobQueue.getEstimatedWait(jobId);

            // Notify user based on queue status
            if (position <= 2) {
                // Near front of queue - processing soon
                await ctx.reply('🔮 *Analyzing username...*\n\n_You\'ll receive the result shortly._', {
                    parse_mode: 'Markdown'
                });
            } else {
                // In queue - show position
                const queueMessage = formatQueueMessage(position, estimatedWait, isPremium(userId));
                await ctx.replyWithMarkdown(queueMessage);
            }

        } catch (queueError) {
            console.error('Queue error:', queueError.message);
            await ctx.reply(`❌ ${queueError.message}`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'report_username' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }
        return;
    }

    // ==================== GROUP CHAT SILENCE ====================
    // 🛑 STOP here if it's a group chat
    // We only want generic text processing (username/unknown) in Private DMs
    // Active states (handled above) will still work if user explicitly started an action
    if (ctx.chat.type !== 'private') return;

    // If no valid state and input looks like a username, show helpful error
    let potentialUsername = input.replace('@', '').toLowerCase();
    if (isValidUsername(potentialUsername)) {
        return ctx.replyWithMarkdown(`
⚠️ *To get a report, please use the menu first.*

👇 Click the button below:
`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 Username Report', callback_data: 'report_username' }],
                    [{ text: '🎁 Gift Report', callback_data: 'report_gifts' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }

    // Unknown input - show main menu
    await ctx.reply(`❓ *I didn't understand that!*`, { parse_mode: 'Markdown' });
    return sendDashboard(ctx, false);
});

// Handle Portfolio button click
bot.action(/^portfolio:(.+)$/, async (ctx) => {
    const walletAddress = ctx.match[1];

    await ctx.answerCbQuery('🔄 Loading portfolio...');

    const loadingMsg = await ctx.reply('⏳ Fetching portfolio data...');

    try {
        let portfolio = portfolioCache.get(walletAddress);
        if (!portfolio) {
            portfolio = await getPortfolio(walletAddress);
            portfolioCache.set(walletAddress, portfolio);
        }

        const tonPrice = tonPriceCache.get('price') || await getTonPrice();
        const message = formatPortfolioMessage(portfolio, tonPrice);

        try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch (e) { }

        await ctx.replyWithMarkdown(message + `\n\n💡 *Pro Tip:* Try \`!Wallet ${walletAddress}\` in any group!`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 View on TonViewer', url: `https://tonviewer.com/${walletAddress}` }]
                ]
            }
        });

    } catch (error) {
        console.error('Portfolio error:', error);
        try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch (e) { }
        await ctx.reply('❌ Could not fetch portfolio. Please try again.');
    }
});



// ==================== MAIN MENU HANDLERS ====================

// Get Report button handler - Show submenu with 3 options
// Menu Report handler removed as part of UX improvements (flattened menu)

// Back to Main Menu handler
bot.action('back_to_menu', async (ctx) => {
    await ctx.answerCbQuery();
    await sendDashboard(ctx, true);
});



// Sponsors handler
bot.action('menu_sponsors', async (ctx) => {
    await ctx.answerCbQuery();

    const sponsorMessage = getSponsorText();

    try {
        await ctx.editMessageText(sponsorMessage, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(sponsorMessage, {
            disable_web_page_preview: true,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }
});

// My Account handler
bot.action('menu_account', async (ctx) => {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;
    const user = ctx.from;
    const userIsPremium = isPremium(userId);
    const limits = getRemainingLimits(userId);
    const resetTime = getTimeUntilReset();

    // Build profile section
    let accountMessage = `👤 *My Account*\n\n`;
    accountMessage += `━━━ 📋 *Profile* ━━━\n`;
    accountMessage += `• Name: ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}\n`;
    accountMessage += `• Username: ${user.username ? '@' + user.username : 'Not set'}\n`;
    accountMessage += `• ID: \`${userId}\`\n\n`;

    // Build subscription section
    accountMessage += `━━━ ⭐ *Subscription* ━━━\n`;

    if (userIsPremium) {
        const expiry = getPremiumExpiry(userId);
        const expiryDate = expiry ? expiry.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : 'N/A';

        // Calculate days remaining
        const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;

        accountMessage += `• Type: 🌟 *Premium*\n`;
        accountMessage += `• Expires: ${expiryDate}\n`;
        accountMessage += `• Days Left: *${daysLeft} days*\n\n`;
    } else {
        accountMessage += `• Type: 🆓 Free\n`;
        accountMessage += `• Daily Credits:\n`;

        const reportIcon = limits.report > 0 ? '✅' : '❌';
        const compareIcon = limits.compare > 0 ? '✅' : '❌';
        const portfolioIcon = limits.portfolio > 0 ? '✅' : '❌';
        const giftIcon = limits.gift > 0 ? '✅' : '❌';

        accountMessage += `  📊 Reports: ${limits.report}/1 ${reportIcon}\n`;
        accountMessage += `  🆚 Compare: ${limits.compare}/1 ${compareIcon}\n`;
        accountMessage += `  💼 Portfolio: ${limits.portfolio}/1 ${portfolioIcon}\n`;
        accountMessage += `  🎁 Gift: ${limits.gift}/1 ${giftIcon}\n`;
        accountMessage += `• Reset in: *${resetTime.formatted}*\n\n`;
    }

    // Build buttons
    const buttons = userIsPremium
        ? [
            [{ text: '💎 Extend Premium', callback_data: 'buy_premium' }],
            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
        ]
        : [
            [{ text: '🌟 Upgrade to Premium', callback_data: 'buy_premium' }],
            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
        ];

    try {
        await ctx.editMessageText(accountMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(accountMessage, {
            reply_markup: {
                inline_keyboard: buttons
            }
        });
    }
});

// Username Report handler (moved from menu_report)
bot.action('report_username', async (ctx) => {
    if (!await checkMembershipOrStop(ctx)) return;
    await ctx.answerCbQuery();

    // Set user state to expect username
    userStates.set(ctx.chat.id, {
        action: 'username_report',
        messageId: ctx.callbackQuery.message.message_id,
        timestamp: Date.now()
    });

    const promptText = `
🔮 *Username Intelligence Report*

Unlock the full potential of any Telegram username!

*What you'll discover:*
⚡ Real-time Fragment market status
💰 AI-powered value estimation
🌟 Rarity tier ranking (S/A/B/C/D)
🔗 Similar premium names to explore
🔬 Deep analysis with quality metrics

━━━━━━━━━━━━━━━━━━━━━
_Type any username to begin:_
`;

    try {
        await ctx.editMessageText(promptText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel_username_report' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(promptText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel_username_report' }]
                ]
            }
        });
    }
});

// Gifts Report handler
bot.action('report_gifts', async (ctx) => {
    if (!await checkMembershipOrStop(ctx)) return;
    await ctx.answerCbQuery();

    // Set user state to expect gift link
    userStates.set(ctx.chat.id, {
        action: 'gift_report',
        messageId: ctx.callbackQuery.message.message_id,
        timestamp: Date.now()
    });

    const promptText = `
🎁 *Gift Report*

Get a complete analysis for any Telegram Gift NFT!

*You'll receive:*
• 📦 Gift details (Model, Backdrop, Symbol)
• 💰 Current price & estimated value
• 📊 Collection statistics
• 🎯 Rarity analysis
• 💎 Value verdict

*Send a gift link like:*
\`https://t.me/nft/PlushPepe-1\`

_Paste your gift link below:_
`;

    try {
        await ctx.editMessageText(promptText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel_gift_report' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(promptText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel_gift_report' }]
                ]
            }
        });
    }
});

// Anonymous Numbers handler (Coming Soon)
bot.action('report_numbers', async (ctx) => {
    await ctx.answerCbQuery('🚧 Coming Soon!');

    const promptText = `
📱 *Anonymous Numbers Report*

🚧 *Coming Soon!*

This feature will be unlocked when we reach *10,000 users*!

💡 Invite your friends to help us reach this goal faster!

Stay tuned! 🎉
`;

    try {
        await ctx.editMessageText(promptText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎁 Invite Friends', callback_data: 'menu_invites' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(promptText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎁 Invite Friends', callback_data: 'menu_invites' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }
});

// Cancel username report handler
bot.action('cancel_username_report', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelled');
    userStates.delete(ctx.chat.id);

    // Go back to report menu
    const promptText = `
📊 *Get Report*

Choose what you want to analyze:

• 👤 *Username* - Analyze any Telegram username
• 🎁 *Gifts* - Get detailed gift NFT report
• 📱 *Anonymous Numbers* - Coming soon!

_Select an option below:_
`;

    try {
        await ctx.editMessageText(promptText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 Username', callback_data: 'report_username' }],
                    [{ text: '🎁 Gifts', callback_data: 'report_gifts' }],
                    [{ text: '📱 Anonymous Numbers', callback_data: 'report_numbers' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(promptText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 Username', callback_data: 'report_username' }],
                    [{ text: '🎁 Gifts', callback_data: 'report_gifts' }],
                    [{ text: '📱 Anonymous Numbers', callback_data: 'report_numbers' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }
});

// Cancel gift report handler
bot.action('cancel_gift_report', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelled');
    userStates.delete(ctx.chat.id);

    // Go back to report menu
    const promptText = `
📊 *Get Report*

Choose what you want to analyze:

• 👤 *Username* - Analyze any Telegram username
• 🎁 *Gifts* - Get detailed gift NFT report
• 📱 *Anonymous Numbers* - Coming soon!

_Select an option below:_
`;

    try {
        await ctx.editMessageText(promptText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 Username', callback_data: 'report_username' }],
                    [{ text: '🎁 Gifts', callback_data: 'report_gifts' }],
                    [{ text: '📱 Anonymous Numbers', callback_data: 'report_numbers' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(promptText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👤 Username', callback_data: 'report_username' }],
                    [{ text: '🎁 Gifts', callback_data: 'report_gifts' }],
                    [{ text: '📱 Anonymous Numbers', callback_data: 'report_numbers' }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });
    }
});

// Compare Usernames button handler
bot.action('menu_compare', async (ctx) => {
    if (!await checkMembershipOrStop(ctx)) return;
    await ctx.answerCbQuery();
    const userId = ctx.from.id;

    // Check if user has credits for compare
    if (!canUseFeature(userId, 'compare')) {
        const message = formatNoCreditsMessage('compare');
        try {
            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌟 Buy Premium', callback_data: 'buy_premium' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        } catch (e) {
            await ctx.replyWithMarkdown(message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌟 Buy Premium', callback_data: 'buy_premium' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }
        return;
    }

    // Set user state to compare step 1 with message ID
    userStates.set(ctx.chat.id, {
        action: 'compare',
        step: 1,
        messageId: ctx.callbackQuery.message.message_id,
        timestamp: Date.now()
    });

    const promptText = `
🆚 *Compare Usernames*

Compare two usernames side by side and discover which one has more value!

*You'll get:*
• 📊 Price comparison
• 📈 Value analysis
• 🏆 Winner recommendation

Send the *first* username:
`;

    try {
        await ctx.editMessageText(promptText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel_compare' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(promptText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel_compare' }]
                ]
            }
        });
    }
});

// Cancel compare handler - edit back to main menu
bot.action('cancel_compare', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelled');
    userStates.delete(ctx.chat.id);
    await sendDashboard(ctx, true);
});

// Portfolio Tracker button handler
bot.action('menu_portfolio', async (ctx) => {
    if (!await checkMembershipOrStop(ctx)) return;
    await ctx.answerCbQuery();
    const userId = ctx.from.id;

    // Check if user has credits for portfolio
    if (!canUseFeature(userId, 'portfolio')) {
        const message = formatNoCreditsMessage('portfolio');
        try {
            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌟 Buy Premium', callback_data: 'buy_premium' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        } catch (e) {
            await ctx.replyWithMarkdown(message, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌟 Buy Premium', callback_data: 'buy_premium' }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            });
        }
        return;
    }

    // Set user state to portfolio mode with message ID for later editing
    userStates.set(ctx.chat.id, {
        action: 'portfolio',
        messageId: ctx.callbackQuery.message.message_id,
        timestamp: Date.now()
    });

    const promptText = `
🔍 *Deep Wallet Analysis*

Scan any TON wallet to discover all Fragment assets!

*Send:*
📌 A *wallet address* (\`UQ...\` or \`EQ...\`)
📌 Or a *@username* to find its owner

*Full Report Includes:*
💎 Telegram Usernames (with activity check)
📱 Anonymous Numbers (+888)
🎁 Official Telegram Gifts
📊 AI-Powered Portfolio Analysis

_Enter a wallet or username:_
`;

    try {
        await ctx.editMessageText(promptText, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel_portfolio' }]
                ]
            }
        });
    } catch (e) {
        await ctx.replyWithMarkdown(promptText, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '❌ Cancel', callback_data: 'cancel_portfolio' }]
                ]
            }
        });
    }
});

// Back to menu handler
bot.action('back_to_menu', async (ctx) => {
    await ctx.answerCbQuery();
    userStates.delete(ctx.chat.id); // Clear any active state
    await sendDashboard(ctx, true);
});

// Cancel portfolio handler - edit back to main menu
bot.action('cancel_portfolio', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelled');
    userStates.delete(ctx.chat.id);
    await sendDashboard(ctx, true);
});

// ==================== PREMIUM PAYMENT HANDLERS ====================

// Buy Premium button - send invoice
bot.action('buy_premium', async (ctx) => {
    await ctx.answerCbQuery();

    try {
        await ctx.replyWithInvoice({
            title: '🌟 iFragment Premium',
            description: `${PREMIUM_DAYS} days of unlimited access to all features:\n• Unlimited Reports\n• Unlimited Comparisons\n• Unlimited Portfolio Tracking`,
            payload: `premium_${ctx.from.id}_${Date.now()}`,
            currency: 'XTR', // Telegram Stars
            prices: [{ label: `Premium ${PREMIUM_DAYS} Days`, amount: PREMIUM_PRICE }],
            provider_token: '', // Empty for Telegram Stars
        });
    } catch (error) {
        console.error('Invoice error:', error);
        await ctx.reply('❌ Error creating invoice. Please try again later.');
    }
});

// Pre-checkout query handler
bot.on('pre_checkout_query', async (ctx) => {
    try {
        // Always approve for Telegram Stars
        await ctx.answerPreCheckoutQuery(true);
    } catch (error) {
        console.error('Pre-checkout error:', error);
        await ctx.answerPreCheckoutQuery(false, 'Payment error. Please try again.');
    }
});

// Successful payment handler
bot.on('successful_payment', async (ctx) => {
    const userId = ctx.from.id;
    const payment = ctx.message.successful_payment;

    console.log(`💰 Payment received from user ${userId}:`, payment);

    try {
        // Activate premium
        const result = activatePremium(userId, PREMIUM_DAYS);

        const expiryDate = result.expiresAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        await ctx.replyWithMarkdown(`
🎉 *Congratulations!*

Your Premium subscription is now active!

━━━━━━━━━━━━━━━━

📅 *Expires:* ${expiryDate}
✨ *Features:* Unlimited

Enjoy unlimited access to all features! 🌟

━━━━━━━━━━━━━━━━

Thank you for your support! 💎
`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });

    } catch (error) {
        console.error('Payment processing error:', error);
        await ctx.reply('✅ Payment received! Your premium will be activated shortly.');
    }
});

// ==================== PORTFOLIO HANDLERS ====================

/**
 * Handle portfolio lookup by wallet address
 * Uses new walletTrackerService for 4-message deep analysis
 */
async function handlePortfolioByWallet(ctx, walletAddress) {
    try {
        // Use new wallet tracker service for deep analysis
        await generateWalletReport(ctx, walletAddress);

        // Deduct credit after successful report
        const creditResult = useFeature(ctx.from.id, 'portfolio');
        const creditsMsg = formatCreditsMessage(creditResult.remaining, creditResult.isPremium);
        if (ctx.chat.type === 'private') {
            if (!creditResult.isPremium) {
                await ctx.replyWithMarkdown(creditsMsg, Markup.inlineKeyboard([
                    [Markup.button.callback('💎 Buy Premium', 'buy_premium')]
                ]));
            } else {
                await ctx.replyWithMarkdown(creditsMsg);
            }
        } else {
            // Group: Just send the text, no buttons
            await ctx.replyWithMarkdown(creditsMsg);
        }

    } catch (error) {
        console.error('Portfolio error:', error);
        await ctx.reply('❌ Could not fetch portfolio. Please check the wallet address and try again.');
    }
}

/**
 * Handle portfolio lookup by username (first find owner wallet)
 * Uses TonAPI DNS resolution first, then Fragment scraping as fallback
 */
async function handlePortfolioByUsername(ctx, username) {
    const loadingMsg = await ctx.reply(`🔍 Finding owner of @${username}...`);

    try {
        let ownerWallet = null;

        // Method 1: Try TonAPI DNS resolution first (faster and more reliable)
        ownerWallet = await getOwnerWalletByUsername(username);

        // Method 2: Fallback to Fragment scraping if TonAPI didn't work
        if (!ownerWallet) {
            console.log(`⚠️ TonAPI lookup failed for @${username}, trying Fragment scraping...`);
            const fragmentData = await scrapeFragment(username);
            ownerWallet = fragmentData.ownerWalletFull;
        }

        if (!ownerWallet) {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
            await ctx.reply(`❌ Could not find owner wallet for @${username}.\n\nThis username may be:\n• Available for purchase\n• Not assigned to a wallet\n• Owner info not public`);
            return;
        }

        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

        // Use new wallet tracker service for deep 4-message analysis
        await generateWalletReport(ctx, ownerWallet);

        // Deduct credit after successful report
        const creditResult = useFeature(ctx.from.id, 'portfolio');
        const creditsMsg = formatCreditsMessage(creditResult.remaining, creditResult.isPremium);
        if (ctx.chat.type === 'private') {
            if (!creditResult.isPremium) {
                await ctx.replyWithMarkdown(creditsMsg, Markup.inlineKeyboard([
                    [Markup.button.callback('💎 Buy Premium', 'buy_premium')]
                ]));
            } else {
                await ctx.replyWithMarkdown(creditsMsg);
            }
        } else {
            // Group: Just send the text
            await ctx.replyWithMarkdown(creditsMsg);
        }

    } catch (error) {
        console.error('Portfolio by username error:', error);
        try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch (e) { }
        await ctx.reply('❌ Could not fetch portfolio. Please try again.');
    }
}

// ==================== WALLET TRACKER PAGINATION HANDLERS ====================

// Handle Username Pagination
bot.action(/wt_user_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    try {
        await handleUsernamePagination(ctx, page);
        await ctx.answerCbQuery();
    } catch (e) {
        console.error('Pagination error:', e);
        await ctx.answerCbQuery('⚠️ Error loading page');
    }
});

// Handle Number Pagination
bot.action(/wt_num_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    try {
        await handleNumberPagination(ctx, page);
        await ctx.answerCbQuery();
    } catch (e) {
        console.error('Pagination error:', e);
        await ctx.answerCbQuery('⚠️ Error loading page');
    }
});

// Handle Gift Pagination
bot.action(/wt_gift_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    try {
        await handleGiftPagination(ctx, page);
        await ctx.answerCbQuery();
    } catch (e) {
        console.error('Pagination error:', e);
        await ctx.answerCbQuery('⚠️ Error loading page');
    }
});

// ==================== COMPARISON HANDLER ====================

/**
 * Handle username comparison - fetch data and generate report
 */
async function handleComparison(ctx, username1, username2) {
    const statusMessage = await ctx.reply('🔄 Analyzing usernames...\n\n⏳ Fetching market data & AI insights...');

    try {
        console.log(`Starting comparison for ${username1} vs ${username2}`);

        // Fetch data for both usernames in parallel
        let tonPrice = tonPriceCache.get('price');
        if (!tonPrice) {
            try {
                tonPrice = await getTonPrice();
            } catch (e) {
                console.error('Error fetching TON price:', e);
                tonPrice = 6.0; // Fallback
            }
        }

        console.log('Fetching data points...');
        const [data1, data2, insight1, insight2] = await Promise.all([
            scrapeFragment(username1).catch(e => ({ statusText: 'Error', status: 'unknown' })),
            scrapeFragment(username2).catch(e => ({ statusText: 'Error', status: 'unknown' })),
            generateShortInsight(username1).catch(e => 'No insight'),
            generateShortInsight(username2).catch(e => 'No insight')
        ]);

        console.log('Calculating stats...');
        const rarity1 = calculateRarity(username1);
        const rarity2 = calculateRarity(username2);

        const estValue1 = estimateValue(username1, data1.lastSalePrice, tonPrice, data1.status);
        const estValue2 = estimateValue(username2, data2.lastSalePrice, tonPrice, data2.status);

        // Delete loading message
        try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id); } catch (e) { }

        // Generate comparison report with AI insights
        console.log('Generating text report...');
        let report = '';
        try {
            report = generateComparisonReport(
                { username: username1, data: data1, rarity: rarity1, estValue: estValue1, insight: insight1 },
                { username: username2, data: data2, rarity: rarity2, estValue: estValue2, insight: insight2 },
                tonPrice
            );
        } catch (repErr) {
            console.error('Report generation error:', repErr);
            report = `Comparison: ${username1} vs ${username2}\n\nError generating detailed report.`;
        }

        // Generate comparison card image
        const comparisonCardData = {
            username1,
            username2,
            status1: data1.statusText || 'Unknown',
            status2: data2.statusText || 'Unknown',
            value1: estValue1.ton || 0,
            value2: estValue2.ton || 0,
            valueUsd1: estValue1.usd || 0,
            valueUsd2: estValue2.usd || 0,
            rarity1: rarity1,
            rarity2: rarity2,
            insight1: insight1,
            insight2: insight2
        };

        let imageBuffer;
        try {
            console.log('Generating card image...');
            imageBuffer = await generateComparisonCard(comparisonCardData);
        } catch (cardError) {
            if (cardError) console.error('Story Card gen error (bg):', cardError.message);
            imageBuffer = null;
        }

        // Send response
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔄 New Comparison', callback_data: 'menu_compare' }],
                    [
                        { text: '📸 Share Story', callback_data: `story_username:${username1}` },
                        { text: `📊 @${username2}`, callback_data: `view_username:${username2}` }
                    ],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        };

        if (imageBuffer && imageBuffer.length > 1000) {
            await ctx.replyWithPhoto(
                { source: Buffer.from(imageBuffer) },
                {
                    caption: report,
                    parse_mode: 'Markdown',
                    ...keyboard
                }
            );
        } else {
            await ctx.replyWithMarkdown(report, keyboard);
        }

        // Deduct credit and show remaining
        const creditResult = useFeature(ctx.from.id, 'compare');
        const creditsMsg = formatCreditsMessage(creditResult.remaining, creditResult.isPremium);
        if (!creditResult.isPremium) {
            await ctx.replyWithMarkdown(creditsMsg, Markup.inlineKeyboard([
                [Markup.button.callback('💎 Buy Premium', 'buy_premium')]
            ]));
        } else {
            await ctx.replyWithMarkdown(creditsMsg);
        }

    } catch (error) {
        console.error('Comparison error (Fatal):', error);
        try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id); } catch (e) { }
        await ctx.reply(`❌ Error comparing usernames: ${error.message}`);
    }
}

/**
 * Generate professional comparison report
 */
function generateComparisonReport(item1, item2, tonPrice) {
    const { username: u1, data: d1, rarity: r1, estValue: v1, insight: i1 } = item1;
    const { username: u2, data: d2, rarity: r2, estValue: v2, insight: i2 } = item2;

    let msg = `🆚 *Username Comparison*\n\n`;

    // Username 1
    msg += `━━━ 👤 *First Username* ━━━\n`;
    msg += `💎 *@${u1}*\n`;
    msg += `• Status: ${d1.statusText}\n`;
    msg += `• Value: ~${formatNumber(v1.ton)} TON ($${formatNumber(v1.usd)})\n`;
    msg += `• Rarity: ${r1.stars} ${r1.tier}\n`;
    msg += `• Length: ${u1.length} chars\n`;
    if (i1) msg += `• AI: _${i1}_\n`;
    msg += `\n`;

    // Username 2
    msg += `━━━ 👤 *Second Username* ━━━\n`;
    msg += `💎 *@${u2}*\n`;
    msg += `• Status: ${d2.statusText}\n`;
    msg += `• Value: ~${formatNumber(v2.ton)} TON ($${formatNumber(v2.usd)})\n`;
    msg += `• Rarity: ${r2.stars} ${r2.tier}\n`;
    msg += `• Length: ${u2.length} chars\n`;
    if (i2) msg += `• AI: _${i2}_\n`;
    msg += `\n`;

    // Analysis
    msg += `━━━ 📊 *Analysis* ━━━\n\n`;

    // Value comparison
    const valueDiff = v2.ton !== 0 ? ((v1.ton - v2.ton) / v2.ton * 100).toFixed(0) : 0;
    const valueWinner = v1.ton > v2.ton ? u1 : u2;
    const valueSign = v1.ton > v2.ton ? '+' : '';
    msg += `💰 *Value Gap:* ${valueSign}${valueDiff}% (@${valueWinner})\n`;

    // Rarity comparison
    const rarityTiers = { 'S-Tier': 5, 'A-Tier': 4, 'B-Tier': 3, 'C-Tier': 2, 'D-Tier': 1 };
    const r1Score = rarityTiers[r1.tier] || 0;
    const r2Score = rarityTiers[r2.tier] || 0;
    const rarityWinner = r1Score >= r2Score ? u1 : u2;
    msg += `⭐ *Rarity Winner:* @${rarityWinner} (${r1Score >= r2Score ? r1.tier : r2.tier})\n`;

    // Length comparison
    const lengthWinner = u1.length <= u2.length ? u1 : u2;
    msg += `📏 *Shorter Name:* @${lengthWinner} (${Math.min(u1.length, u2.length)} chars)\n\n`;

    // Verdict
    msg += `━━━ 🏆 *AI Verdict* ━━━\n\n`;

    // Calculate overall score
    let score1 = 0, score2 = 0;
    if (v1.ton > v2.ton) score1 += 2; else score2 += 2;
    if (r1Score > r2Score) score1 += 2; else if (r2Score > r1Score) score2 += 2;
    if (u1.length < u2.length) score1 += 1; else if (u2.length < u1.length) score2 += 1;

    const overallWinner = score1 >= score2 ? u1 : u2;
    const winnerReason = score1 >= score2
        ? (v1.ton > v2.ton ? 'higher valuation' : 'superior rarity')
        : (v2.ton > v1.ton ? 'higher valuation' : 'superior rarity');

    msg += `🏅 *Recommended:* @${overallWinner}\n`;
    msg += `_${winnerReason} with better investment potential_\n\n`;

    msg += `💹 *TON Price:* $${tonPrice.toFixed(2)}`;
    msg += `\n\n💡 *Pro Tip:* Try \`!Compare @${u1} @${u2}\` in any group!`;

    return msg;
}

/**
 * Generate comparison card image - Professional Design
 */
async function generateComparisonCard(data) {
    const winner = data.value1 >= data.value2 ? 1 : 2;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Inter:wght@400;600&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
                width: 1080px;
                height: 1080px;
                /* Enhanced Font Stack for Emojis */
                font-family: 'Inter', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Android Emoji', sans-serif;
                background: linear-gradient(135deg, #050505 0%, #1a1a2e 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                overflow: hidden;
                position: relative;
            }
            
            /* Ambient Glows */
            .glow {
                position: absolute;
                border-radius: 50%;
                filter: blur(150px);
                opacity: 0.15;
            }
            .glow-1 { width: 800px; height: 800px; background: #00d4ff; top: -300px; left: -300px; }
            .glow-2 { width: 700px; height: 700px; background: #9d00ff; bottom: -200px; right: -200px; }
            
            .container {
                z-index: 10;
                width: 100%;
                height: 100%;
                padding: 60px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
            }
            
            .header {
                text-align: center;
                margin-top: 20px;
            }
            
            .header h1 {
                font-family: 'Unbounded', sans-serif;
                font-size: 36px;
                font-weight: 800;
                color: rgba(255,255,255,0.8);
                letter-spacing: 2px;
                text-transform: uppercase;
            }
            
            .battle-arena {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                flex: 1;
                gap: 40px;
                position: relative;
            }
            
            .fighter-card {
                flex: 1;
                height: 750px;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.05);
                backdrop-filter: blur(20px);
                border-radius: 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: transform 0.3s;
            }
            
            .fighter-card.winner {
                border: 2px solid rgba(255, 215, 0, 0.4);
                background: radial-gradient(circle at center, rgba(255, 215, 0, 0.05) 0%, rgba(255,255,255,0.03) 100%);
                box-shadow: 0 0 60px rgba(255, 215, 0, 0.1);
            }
            
            .crown {
                font-size: 48px;
                margin-bottom: 20px;
                filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
            }
            
            .username {
                font-family: 'Unbounded', sans-serif;
                font-size: 42px;
                font-weight: 900;
                margin-bottom: 40px;
                text-align: center;
                line-height: 1.1;
                word-break: break-all;
                padding: 0 20px;
            }
            
            .username.u1 { color: #00d4ff; text-shadow: 0 0 30px rgba(0, 212, 255, 0.3); }
            .username.u2 { color: #00ff88; text-shadow: 0 0 30px rgba(0, 255, 136, 0.3); }
            
            .stats {
                width: 100%;
                padding: 0 30px;
                text-align: center;
            }
            
            .stat-val {
                font-size: 32px;
                font-weight: 700;
                color: white;
                margin-bottom: 5px;
            }
            
            .stat-lbl {
                font-size: 14px;
                color: rgba(255,255,255,0.4);
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 20px;
            }
            
            .vs-badge {
                position: absolute;
                width: 100px;
                height: 100px;
                background: #fff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Unbounded', sans-serif;
                font-size: 32px;
                font-weight: 900;
                color: black;
                z-index: 20;
                box-shadow: 0 0 50px rgba(255,255,255,0.3);
            }
            
            .footer {
                margin-bottom: 20px;
                font-family: 'Unbounded', sans-serif;
                font-size: 20px;
                color: rgba(255, 255, 255, 0.3);
                letter-spacing: 3px;
                font-weight: 700;
            }
        </style>
    </head>
    <body>
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>
        
        <div class="container">
            <div class="header">
                <h1>Face Off</h1>
            </div>
            
            <div class="battle-arena">
                <div class="fighter-card ${winner === 1 ? 'winner' : ''}">
                    ${winner === 1 ? '<div class="crown">👑</div>' : '<div style="height: 68px"></div>'}
                    <div class="username u1">@${data.username1}</div>
                    
                    <div class="stats">
                        <div class="stat-val">~${formatNumber(data.value1)}</div>
                        <div class="stat-lbl">TON Value</div>
                        
                        <div class="stat-val">${data.rarity1.tier}</div>
                        <div class="stat-lbl">Rarity</div>
                    </div>
                </div>
                
                <div class="vs-badge">VS</div>
                
                <div class="fighter-card ${winner === 2 ? 'winner' : ''}">
                    ${winner === 2 ? '<div class="crown">👑</div>' : '<div style="height: 68px"></div>'}
                    <div class="username u2">@${data.username2}</div>
                    
                    <div class="stats">
                        <div class="stat-val">~${formatNumber(data.value2)}</div>
                        <div class="stat-lbl">TON Value</div>
                        
                        <div class="stat-val">${data.rarity2.tier}</div>
                        <div class="stat-lbl">Rarity</div>
                    </div>
                </div>
            </div>
            
            <div class="footer">@iFragmentBot</div>
        </div>
    </body>
    </html>
    `;

    const page = await getPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1080, height: 1080 });

    // Wait for fonts
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(r => setTimeout(r, 500));

    const imageBuffer = await page.screenshot({ type: 'png' });
    await page.close();
    return imageBuffer;
}

// Handler for viewing individual username from comparison
bot.action(/^view_username:(.+)$/, async (ctx) => {
    const username = ctx.match[1];
    await ctx.answerCbQuery(`📊 Loading @${username}...`);

    const loadingMsg = await ctx.reply('🎨 Creating Story Card...');

    try {
        const [fragmentData, tonPrice, insight] = await Promise.all([
            scrapeFragment(username),
            getTonPrice(),
            generateShortInsight(username)
        ]);

        const rarity = calculateRarity(username);
        const estValue = estimateValue(username, fragmentData.lastSalePrice, tonPrice, fragmentData.status);

        const cardData = {
            username,
            tagline: insight,
            status: fragmentData.status,
            statusText: fragmentData.statusText,
            rarity,
            estValueTon: estValue.ton,
            estValueUsd: estValue.usd,
            lastSalePrice: fragmentData.lastSalePrice,
            lastSaleDate: fragmentData.lastSaleDate || 'N/A',
            currentPrice: fragmentData.priceTon || fragmentData.highestBid || fragmentData.minBid || estValue.ton,
            priceType: fragmentData.priceTon ? 'Buy Now' :
                fragmentData.highestBid ? 'Highest Bid' :
                    fragmentData.minBid ? 'Min Bid' : 'Estimated',
            ownerWallet: fragmentData.ownerWallet || 'Unknown'
        };

        const caption = buildFullCaption(fragmentData, cardData, tonPrice, rarity, estValue, []);

        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

        const keyboard = fragmentData.ownerWalletFull
            ? {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💼 Portfolio Tracker', callback_data: `portfolio:${fragmentData.ownerWalletFull}` }],
                        [{ text: '🔗 View on Fragment', url: fragmentData.url }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            }
            : {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔗 View on Fragment', url: fragmentData.url }],
                        [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                    ]
                }
            };

        await ctx.replyWithMarkdown(caption, keyboard);

    } catch (error) {
        console.error('View username error:', error);
        try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch (e) { }
        await ctx.reply('❌ Error generating report. Please try again.');
    }
});

/**
 * Build FULL detailed caption - PREMIUM format (MODULARIZED)
 */
function buildFullCaption(data, cardData, tonPrice, rarity, estValue, suggestions = []) {
    const username = data.username;

    let msg = '';
    msg += buildHeaderSection(username, cardData);
    msg += buildMarketSection(data, tonPrice);
    msg += buildValuationSection(estValue, rarity);
    msg += buildAnalysisSection(username, rarity);
    msg += buildSuggestionsSection(suggestions);
    msg += buildFooterSection(data, tonPrice, username);

    return msg;
}

/**
 * Build header section with username and tagline
 */
function buildHeaderSection(username, cardData) {
    let section = `💎 *${username}*\n`;
    const cleanTagline = cardData.tagline.replace(/\*\*/g, '').trim();
    section += `_${cleanTagline}_\n\n`;
    return section;
}

/**
 * Build market data section
 */
function buildMarketSection(data, tonPrice) {
    const statusIcons = {
        'sold': '🟢 Sold', 'for_sale': '🟡 For Sale', 'on_auction': '🔨 On Auction',
        'available': '🟢 Available', 'taken': '⚫ Taken', 'unknown': '⚪ Unknown'
    };
    const statusText = statusIcons[data.status] || '⚪ Unknown';

    let section = `📊 *MARKET DATA*\n`;
    section += `• Status: ${statusText}\n`;

    // Price Information
    if (data.status === 'for_sale' && data.priceTon) {
        const usd = Math.floor(data.priceTon * tonPrice);
        section += `• Price: *${formatNum(data.priceTon)} TON* ($${formatNum(usd)})\n`;
    } else if (data.status === 'on_auction') {
        if (data.highestBid) {
            section += `• Top Bid: *${formatNum(data.highestBid)} TON*\n`;
        }
        if (data.minBid) {
            section += `• Min Bid: *${formatNum(data.minBid)} TON*\n`;
        }
        if (data.auctionEnds) {
            section += `• Ends: ${data.auctionEnds}\n`;
        }
    } else if (data.lastSalePrice) {
        const usd = Math.floor(data.lastSalePrice * tonPrice);
        section += `• Last Sale: *${formatNum(data.lastSalePrice)} TON* ($${formatNum(usd)})\n`;
        if (data.lastSaleDate && data.lastSaleDate !== 'N/A') {
            section += `• Date: ${data.lastSaleDate}\n`;
        }
    }

    if (data.ownerWallet) {
        section += `• Owner: \`${data.ownerWallet}\`\n`;
    }
    section += `\n`;

    return section;
}

/**
 * Build valuation section
 */
function buildValuationSection(estValue, rarity) {
    let section = `💰 *VALUATION*\n`;
    section += `• Est. Value: *~${formatNum(estValue.ton)} TON* ($${formatNum(estValue.usd)})\n`;
    section += `• Rarity: *${rarity.tier}* ${rarity.stars}\n`;
    section += `• Trend: ${getTrendIndicator(rarity.tier)}\n`;
    section += `\n`;
    return section;
}

/**
 * Build analysis section
 */
function buildAnalysisSection(username, rarity) {
    let section = `🔬 *DEEP ANALYSIS*\n`;
    section += `• Length: ${username.length} letters\n`;
    section += `• Type: ${analyzeWordType(username)}\n`;
    section += `• Best For: ${getPerfectFor(username)}\n`;
    section += `• Quality: *${getQualityBadge(username, rarity.tier)}*\n`;
    section += `\n`;
    return section;
}

/**
 * Build suggestions section
 */
function buildSuggestionsSection(suggestions) {
    if (!suggestions || suggestions.length === 0) return '';

    let section = `🔗 *SIMILAR NAMES*\n`;
    const suggestionLinks = suggestions.slice(0, 5).map(s =>
        `[@${s}](https://fragment.com/username/${s})`
    ).join('  ');
    section += `${suggestionLinks}\n\n`;
    return section;
}

/**
 * Build footer section
 */
function buildFooterSection(data, tonPrice, username) {
    let section = `────────────────\n`;
    section += `💹 TON: $${tonPrice.toFixed(2)} • [Market](${data.url})`;
    if (data.ownerWalletFull) {
        section += ` • [Owner](https://tonviewer.com/${data.ownerWalletFull})`;
    }
    section += `\n\n💡 *Pro Tip:* Try \`!Username ${username}\` in any group!`;
    return section;
}

/**
 * Get quality badge based on username characteristics
 * Updated to use new tier names from TheOracle
 */
function getQualityBadge(username, tier) {
    const len = username.length;
    const hasNumbers = /\d/.test(username);
    const hasUnderscore = /_/.test(username);

    // Premium indicators - Updated tier names
    if (tier === 'God Tier') return '👑 Godlike';
    if (tier === 'Mythic') return '🌟 Legendary';
    if (tier === 'Apex') return '💎 Premium';
    if (tier === 'Legendary') return '✨ High-Value';
    if (tier === 'Grand') return '⭐ Valuable';
    if (tier === 'Rare') return '🔷 Quality';

    // Legacy tiers (backwards compatibility)
    if (tier === 'S-Tier') return '🌟 Legendary';
    if (tier === 'A-Tier') return '💎 Premium';
    if (len <= 4 && !hasNumbers && !hasUnderscore) return '✨ Ultra-Rare';
    if (len <= 5 && !hasNumbers) return '⭐ High-Value';
    if (len <= 6) return '🔷 Quality';
    if (hasNumbers || hasUnderscore) return '🔹 Standard';
    return '📌 Basic';
}

/**
 * Analyze word type - Enhanced with more detail
 */
function analyzeWordType(username) {
    const hasNumbers = /\d/.test(username);
    const hasUnderscore = /_/.test(username);
    const len = username.length;
    const isAllLetters = /^[a-zA-Z]+$/.test(username);

    // Check vowel ratio for pronounceability
    const vowels = (username.match(/[aeiou]/gi) || []).length;
    const vowelRatio = vowels / len;
    const isPronouceable = vowelRatio >= 0.25 && vowelRatio <= 0.55;

    // Premium short handles
    if (len <= 3 && isAllLetters) return 'Ultra-Rare';
    if (len === 4 && isAllLetters && isPronouceable) return '4L Premium';
    if (len === 4 && isAllLetters) return '4L Asset';
    if (len === 5 && isAllLetters && isPronouceable) return '5L Word';
    if (len === 5 && isAllLetters) return '5L Handle';

    // Pattern types
    if (/^\d+$/.test(username)) return 'Numeric';
    if (/^[a-z]+bot$/i.test(username)) return 'Bot Handle';
    if (hasNumbers && hasUnderscore) return 'Complex';
    if (hasNumbers) return 'Alphanum';
    if (hasUnderscore) return 'Compound';

    // Word types
    if (len <= 6 && isPronouceable) return 'Short Word';
    if (len <= 8 && isPronouceable) return 'Dictionary';
    if (len <= 8) return 'Handle';
    if (isPronouceable) return 'Long Word';

    return 'Standard';
}

/**
 * Get trend indicator - Updated for new tier system from TheOracle
 * Maps tier names to market trend indicators
 */
function getTrendIndicator(tier) {
    // Match tier names from TheOracle.getTier() in config.js
    switch (tier) {
        // Premium Tiers - High demand
        case 'God Tier': return '🔥🔥 Explosive';
        case 'Mythic': return '🔥 Hot';
        case 'Apex': return '📈 Rising Fast';
        case 'Legendary': return '📈 Rising';
        case 'Grand': return '📊 High Interest';

        // Mid Tiers - Stable/Growing
        case 'Rare': return '✨ Promising';
        case 'Uncommon': return '➡️ Stable';
        case 'Common': return '📊 Normal';

        // Lower Tiers
        case 'Scrap': return '💤 Sleeper';
        case 'Worthless': return '📉 Low';

        // Legacy tier names (backwards compatibility)
        case 'S-Tier': return '🔥 Hot';
        case 'A-Tier': return '📈 Rising';
        case 'B-Tier': return '➡️ Stable';
        case 'C-Tier': return '💤 Sleeper';
        case 'D-Tier': return '📉 Low';

        default: return '➖ N/A';
    }
}

/**
 * Get perfect use cases - Comprehensive list
 */
function getPerfectFor(username) {
    const lower = username.toLowerCase();

    // Category matching with expanded keywords
    const categories = [
        { keywords: ['game', 'play', 'gaming', 'clash', 'pubg', 'fortnite', 'minecraft', 'roblox', 'valorant', 'esport', 'twitch', 'stream', 'gamer', 'clan', 'guild'], result: 'Gaming/Esports' },
        { keywords: ['crypto', 'bitcoin', 'nft', 'token', 'coin', 'btc', 'eth', 'ton', 'defi', 'wallet', 'web3', 'chain'], result: 'Crypto/Web3' },
        { keywords: ['shop', 'store', 'buy', 'sell', 'market', 'mall', 'deal', 'sale', 'trade'], result: 'E-commerce' },
        { keywords: ['news', 'media', 'press', 'daily', 'times', 'post', 'report'], result: 'Media/News' },
        { keywords: ['tech', 'dev', 'code', 'ai', 'bot', 'app', 'cyber', 'data', 'cloud', 'hack'], result: 'Tech/Dev' },
        { keywords: ['music', 'art', 'film', 'movie', 'song', 'beat', 'studio', 'dj', 'record'], result: 'Creative' },
        { keywords: ['travel', 'tour', 'fly', 'hotel', 'trip', 'vacation', 'explore'], result: 'Travel' },
        { keywords: ['food', 'eat', 'cook', 'chef', 'pizza', 'burger', 'coffee', 'cafe'], result: 'Food/Lifestyle' },
        { keywords: ['fashion', 'style', 'wear', 'brand', 'luxury', 'designer'], result: 'Fashion' },
        { keywords: ['health', 'fit', 'gym', 'sport', 'yoga', 'workout'], result: 'Fitness' },
        { keywords: ['king', 'queen', 'god', 'boss', 'elite', 'alpha', 'legend', 'master'], result: 'Personal Brand' },
        { keywords: ['wolf', 'lion', 'tiger', 'eagle', 'dragon', 'phoenix', 'fire', 'storm'], result: 'Bold Brands' }
    ];

    for (const cat of categories) {
        if (cat.keywords.some(w => lower.includes(w))) {
            return cat.result;
        }
    }

    // Default based on characteristics
    if (username.length <= 4) return 'Premium VIP';
    if (username.length <= 6) return 'Brand/Personal';
    return 'General Use';
}

/**
 * Format number with commas
 */
function formatNum(num) {
    if (!num && num !== 0) return '—';
    return Math.floor(num).toLocaleString('en-US');
}

function isValidUsername(username) {
    return /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username);
}

// ==================== INLINE MODE ====================
bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim().replace('@', '').toLowerCase();

    if (!query || query.length < 4) {
        return ctx.answerInlineQuery([], {
            switch_pm_text: '💎 Enter a username to search',
            switch_pm_parameter: 'start',
            cache_time: 10
        });
    }

    if (!isValidUsername(query)) {
        return ctx.answerInlineQuery([], {
            switch_pm_text: '⚠️ Invalid username format',
            switch_pm_parameter: 'start',
            cache_time: 10
        });
    }

    try {
        // Check cache first
        let fragmentData = fragmentCache.get(query);
        if (!fragmentData) {
            fragmentData = await scrapeFragment(query);
            fragmentCache.set(query, fragmentData);
        }

        const tonPrice = tonPriceCache.get('price') || await getTonPrice();
        const rarity = calculateRarity(query);
        const estValue = estimateValue(query, fragmentData.lastSalePrice, tonPrice, fragmentData.status);

        // Create inline result
        const results = [{
            type: 'article',
            id: `username_${query}_${Date.now()}`,
            title: `💎 @${query}`,
            description: `${fragmentData.statusText} | Est: ${estValue.ton.toLocaleString()} TON | ${rarity.stars} ${rarity.tier}`,
            thumb_url: 'https://fragment.com/favicon.ico',
            input_message_content: {
                message_text: `💎 *@${query}*\n\n` +
                    `📊 *Status:* ${fragmentData.statusText}\n` +
                    `💰 *Est. Value:* ~${estValue.ton.toLocaleString()} TON (~$${estValue.usd.toLocaleString()})\n` +
                    `⭐ *Rarity:* ${rarity.stars} ${rarity.tier}\n` +
                    (fragmentData.lastSalePrice ? `📜 *Last Sale:* ${fragmentData.lastSalePrice.toLocaleString()} TON\n` : '') +
                    `\n🔗 [View on Fragment](${fragmentData.url})` +
                    (fragmentData.ownerWalletFull ? ` • [TonViewer](https://tonviewer.com/${fragmentData.ownerWalletFull})` : ''),
                parse_mode: 'Markdown'
            },
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔍 Full Analysis', url: `https://t.me/iFragmentBot?start=${query}` }],
                    [{ text: '🔗 View on Fragment', url: fragmentData.url }]
                ]
            }
        }];

        await ctx.answerInlineQuery(results, { cache_time: 60 });
        console.log(`✅ Inline query: @${query}`);

    } catch (error) {
        console.error('Inline query error:', error);
        await ctx.answerInlineQuery([], {
            switch_pm_text: '❌ Error fetching data',
            switch_pm_parameter: 'start',
            cache_time: 5
        });
    }
});

bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ An error occurred.').catch(() => { });
});

process.once('SIGINT', async () => {
    await closeBrowser();
    bot.stop('SIGINT');
});
process.once('SIGTERM', async () => {
    await closeBrowser();
    bot.stop('SIGTERM');
});

// ==================== TELEGRAM ACCOUNT LOGIN ACTIONS ====================

// Panel: Add Account
bot.action('panel_add_account', async (ctx) => {
    const userId = ctx.from.id;
    if (!isAdmin(userId)) return ctx.answerCbQuery('Access denied');

    await ctx.answerCbQuery();

    userStates.set(ctx.chat.id, { action: 'awaiting_phone' });

    await ctx.editMessageText(
        '📱 *Add Telegram Account*\n\n' +
        'Please send your phone number with country code.\n' +
        'Example: `+989123456789`\n\n' +
        '_This account will be used to fetch gift data._',
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'panel_cancel_login' }]] } }
    );
});

// Panel: Cancel Login
bot.action('panel_cancel_login', async (ctx) => {
    userStates.delete(ctx.chat.id);
    await ctx.answerCbQuery('Login cancelled');
    await ctx.deleteMessage();
});

// HTTP server for Render Web Service (prevents "no open ports" warning)
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('iFragment Bot is running!');
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP server running on port ${PORT}`);
});

console.log('🚀 Starting iFragment Bot...');

// ==================== ACCOUNT MANAGER ADMIN COMMANDS ====================

// Command: /accounts - List all active sessions
bot.command('accounts', async (ctx) => {
    const userId = ctx.from.id;
    if (!isAdmin(userId)) return; // Silent fail for non-admins

    const accounts = accountManager.getAccountList();

    let msg = `📋 *Account Manager (${accounts.length})*\n\n`;

    if (accounts.length === 0) {
        msg += '_No accounts connected._\n';
    } else {
        accounts.forEach((acc, i) => {
            msg += `${i + 1}. \`${acc.phone}\` - ${acc.status}\n   👤 \`${acc.username || 'No Username'}\`\n`;
        });
    }

    msg += `\nTo add an account, click the button below.`;
    msg += `\nTo remove, use \`/remove_account +1234567890\``;

    return ctx.replyWithMarkdown(msg, {
        reply_markup: {
            inline_keyboard: [
                [{ text: '➕ Add Account', callback_data: 'panel_add_account' }],
                [{ text: '🔄 Refresh List', callback_data: 'refresh_accounts' }]
            ]
        }
    });
});

// Action: Refresh List
bot.action('refresh_accounts', async (ctx) => {
    const userId = ctx.from.id;
    if (!isAdmin(userId)) return ctx.answerCbQuery('Access denied');

    const accounts = accountManager.getAccountList();
    let msg = `📋 *Account Manager (${accounts.length})*\n\n`;

    if (accounts.length === 0) {
        msg += '_No accounts connected._\n';
    } else {
        accounts.forEach((acc, i) => {
            msg += `${i + 1}. \`${acc.phone}\` - ${acc.status}\n   👤 \`${acc.username || 'No Username'}\`\n`;
        });
    }

    msg += `\nTo add an account, click the button below.`;
    msg += `\nTo remove, use \`/remove_account +1234567890\``;

    try {
        await ctx.editMessageText(msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ Add Account', callback_data: 'panel_add_account' }],
                    [{ text: '🔄 Refresh List', callback_data: 'refresh_accounts' }]
                ]
            }
        });
    } catch (e) { await ctx.answerCbQuery('Updated'); }
});


// Command: /remove_account - Remove a session
bot.command('remove_account', async (ctx) => {
    const userId = ctx.from.id;
    if (!isAdmin(userId)) return;

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('⚠️ Usage: `/remove_account +1234567890`', { parse_mode: 'Markdown' });
    }

    const phone = args[1].trim();
    const success = await accountManager.removeAccount(phone);

    if (success) {
        return ctx.reply(`✅ Account \`${phone}\` removed successfully.`, { parse_mode: 'Markdown' });
    } else {
        return ctx.reply(`❌ Account \`${phone}\` not found.`, { parse_mode: 'Markdown' });
    }
});





