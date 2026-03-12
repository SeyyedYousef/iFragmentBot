import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import http from 'http';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { CONFIG, calculateRarity, estimateValue } from '../core/Config/app.config.js';
import { isValidUsername, formatNum, buildFullCaption, generateComparisonReport, drawProgressBar, getScoreLabel, drawBar, getQualityBadge, analyzeWordType, getTrendIndicator, getPerfectFor, escapeMD } from './Helpers/report.helper.js';

import { getCachedReport, setCachedReport, getReportCacheStats, clearAllReportCache, checkGiftHourlyLimit, useGiftHourlyLimit, GIFT_HOURLY_LIMIT } from './Helpers/cache.helper.js';
import { getTonPrice, getTonMarketStats, scrapeFragment, generateShortInsight, generateUsernameSuggestions } from '../Modules/Market/Infrastructure/fragment.repository.js';
import { getGiftStats, get888Stats } from '../Modules/Market/Application/market.service.js';
import { generateNewsCard, generateNewsCard2, generateMarketCard, getPage, generateFlexCard } from '../Shared/UI/Components/card-generator.component.js';
import { generateFlexCard as generateGiftFlexCard } from '../Modules/Admin/Application/flex-card.service.js';
import { animateLoading } from '../Shared/UI/Logic/animation.service.js';
import { fragmentCache, tonPriceCache, portfolioCache, getAllCacheStats } from '../Shared/Infra/Cache/cache.service.js';

// ==================== RENDER KEEPALIVE & HEALTH CHECK ====================
// This dummy server is CRITICAL for Render deployments.
// It binds to the PORT to signal "I am alive" so Render can kill the old instance.
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('iFragmentBot is running!');
    res.end();
}).listen(PORT, () => {
    console.log(`✅ Web Server on port ${PORT}`);
});


import { connectDB } from '../Shared/Infra/Database/mongo.repository.js';
import { userStates, getStateStats } from '../Shared/Infra/State/state.service.js';
import { getPoolStats } from '../Modules/Market/Infrastructure/fragment.repository.js';
import { globalLimiter, withUserLimit, isOverloaded, getEstimatedWaitTime, getLimiterStats } from '../Shared/Infra/Network/rate-limiter.service.js';
import * as accountManager from '../Modules/User/Application/account-manager.service.js';
import { generateGiftReport, parseGiftLink, formatNumber } from '../Modules/Market/Application/marketapp.service.js';
// import salesMonitor from '../Modules/Monitoring/Application/sales-monitor.service.js'; // REMOVED
import * as dailyScheduler from '../Modules/Automation/Application/daily-scheduler.service.js';
import { generateWalletReport, handleUsernamePagination, handleNumberPagination, handleGiftPagination } from '../Modules/Monitoring/Application/wallet-tracker.service.js';
import { getOwnerWalletByUsername } from '../Modules/Market/Application/portfolio.service.js';
import * as g2g from '../Modules/Automation/Application/group-to-group.service.js';
import { jobQueue, JOB_TYPES, PRIORITIES, formatQueueMessage } from '../Modules/Automation/Application/queue.service.js';
import { registerPanelHandlers } from '../Modules/Admin/Presentation/panel.handler.js';
import { registerFakePanelHandlers, handleFakePanelTextMessage } from '../Modules/Admin/Presentation/fake-panel.handler.js';
import { registerAccountHandlers, handleAccountTextMessage, handleAccountFileMessage } from '../Modules/User/Presentation/account.handler.js';
import { registerSettingsHandlers, handleSettingsTextMessage } from '../App/Routes/settings.handler.js';
import { registerOperationsHandlers, handleOperationsTextMessage } from '../App/Routes/operations.handler.js';
// ==================== EXTRACTED HANDLER MODULES ====================
import { registerMonitorHandlers } from '../App/Routes/monitor.handler.js';
import { registerAdminHandlers, handleAdminTextMessage } from '../App/Routes/admin.handler.js';
import { registerMenuHandlers, handleMenuTextMessage } from '../App/Routes/menu.handler.js';
import { handleGroupCommand, handlePortfolioByWallet, handlePortfolioByUsername } from '../App/Routes/group.handler.js';
import { sendDashboard } from '../App/Helpers/dashboard.helper.js';
import { checkMembershipOrStop as checkMembershipOrStopHelper } from '../App/Helpers/membership.helper.js';
import { handleComparison } from '../App/Routes/comparison.handler.js';
import { generateComparisonCard } from '../Shared/UI/Components/comparison-card.component.js';
// telegramClient is loaded dynamically when needed to avoid GramJS import issues
import {
    canUseFeature,
    useFeature,
    isBlocked,
    blockUser,
    unblockUser,
    getStats,
    getAllUsers,
    formatCreditsMessage,
    formatNoCreditsMessage,
    initUserService,
    addFrgCredits,
    getRemainingLimits,
    getTimeUntilReset,
    getTopGiftHolders,
    getUserRank,
    getSponsorText,
    setSponsorText,
    loadSponsorText,
    updateUserPortfolioValue,
    getUserAsync,
    scanUserGiftsIfNeeded
} from '../Modules/User/Application/user.service.js';

// Market Monitor & Account Manager Fix applied
// Ensure local bot is stopped before deploying!
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error('âŒ Error: BOT_TOKEN is not set!');
    process.exit(1);
}


// Global Error Handlers to prevent crashes
process.on('uncaughtException', (err) => {
    console.error('💥 [Critical] Uncaught Exception:', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [Critical] Unhandled Rejection at:', promise, 'reason:', reason.stack || reason);
});

process.on('exit', (code) => {
    console.log(`ℹ️ [Process] Exiting with code: ${code}`);
});

process.on('beforeExit', (code) => {
    console.log(`ℹ️ [Process] Before Exit event fired with code: ${code}`);
});

// SIGINT/SIGTERM handlers with browser cleanup are registered at the bottom of this file

import { spamProtection } from '../Modules/Security/Application/spam-protection.service.js';

const bot = new Telegraf(BOT_TOKEN);

// ==================== GLOBAL BOT ERROR HANDLER ====================
// This catches ALL unhandled errors in any middleware/handler
// Without this, the bot silently dies on unhandled rejections
bot.catch((err, ctx) => {
    const msg = err.message || '';
    // Suppress harmless Telegram errors that flood logs after restarts
    if (msg.includes('query is too old') || msg.includes('query ID is invalid') ||
        msg.includes('message is not modified') || msg.includes('bot was blocked')) {
        return; // Silently ignore
    }
    console.error(`❌ Bot error [${ctx.updateType}]:`, msg);
    try {
        if (ctx.chat) {
            ctx.reply('⚠️ An unexpected error occurred. Please try again.').catch(() => { });
        }
    } catch (replyErr) {
        // Can't reply, just log
    }
});

// Helper: Check if user is admin - Robust string comparison
function isAdmin(userId) {
    if (!userId) return false;
    const configAdmin = CONFIG.ADMIN_ID;
    const envAdmin = process.env.ADMIN_USER_ID;
    return (configAdmin && String(userId) === String(configAdmin)) ||
        (envAdmin && String(userId) === String(envAdmin));
}




// 🛡️ Register Anti-Spam Middleware immediately
// 🛡️ Global Bot Check Middleware - CRITICAL for preventing loops
// Ignore all messages from other bots (and self)
// Global Bot Check Middleware - CRITICAL for preventing loops
// Ignore all messages from other bots (and self)
bot.use(async (ctx, next) => {
    if (ctx.from && ctx.from.is_bot) {
        return; // Silent ignore, no processing
    }
    return next();
});

// 🛡️ Global Group Monitor (FRG Economy)
bot.use(async (ctx, next) => {
    // Reward users for participating in the FragmentInvestors group
    if (ctx.chat && (ctx.chat.username === 'FragmentInvestors' || String(ctx.chat.id) === '-1002220790800')) {
        if (ctx.from && !ctx.from.is_bot) {
            // Check if it's a Paid Message (Stars)
            const isPaid = !!(ctx.message && ctx.message.paid_media);

            // Reward 300 FRG for any message, but we can log if it was paid
            addFrgCredits(ctx.from.id, 300, isPaid ? "Paid Group Message" : "Group Message");

            // Notify user in DM (optional but requested)
            try {
                await bot.telegram.sendMessage(ctx.from.id, `🪙 *Reward Received!*\n\nYou earned **+300 FRG** for participating in the Investors Club group.\n\n💰 Use it for your next 3 reports!`, { parse_mode: 'Markdown' });
            } catch (e) {
                // Ignore if user hasn't started the bot or blocked it
            }
        }
    }
    return next();
});

// 🛡️ Register Anti-Spam Middleware immediately
bot.use(spamProtection.middleware());

// 🛡️ Global Block Check Middleware
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
            telegramClientModule = await import('../Shared/Infra/Telegram/telegram.client.js');
        } catch (error) {
            console.warn('⚠️ Telegram client service not available:', error.message);
            return null;
        }
    }
    return telegramClientModule;
}

// ==================== USER STATE MANAGEMENT ====================
// Now handled by stateService.js with automatic cleanup
// userStates is imported from stateService.js with Map-compatible interface

// Gift hourly limiter and report cache are now imported from ./Helpers/cache.helper.js



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
    let icon = '☀️';

    if (hour >= 12 && hour < 18) {
        timeGreeting = 'Good Afternoon';
        icon = '🌥️';
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
        console.log('⚠️ No persistent cache found, starting fresh');
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
    // TON Price: Every 10 minutes (Updated for real-time accuracy)
    setInterval(updateMarketData, 10 * 60 * 1000);

    // +888 Floor: Every 10 minutes (Updated for real-time accuracy)
    setInterval(update888Data, 10 * 60 * 1000);
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
        console.log('⚠️ MongoDB not available, using in-memory storage');
    }

    // Load persistent cache first (for fast restart)
    await loadPersistentCache();

    // Force initial TON price fetch (FAST) - awaited to ensure accuracy on boot
    // Force initial TON price fetch (FAST) - non-blocking to ensure fast boot
    getTonMarketStats().then(stats => {
        if (stats && stats.price > 0) {
            tonPriceCache.set('marketStats', { ...stats, timestamp: Date.now() });
            tonPriceCache.set('price', stats.price);
            console.log(`✅ Initial TON Price: $${stats.price}`);
        }
    }).catch(e => console.error('Initial TON fetch failed'));

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
                        caption: `💎 *${escapeMD(result.collection)} #${result.itemNumber}*`,
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

                // Send photo first if available (Separate message to avoid caption limit)
                if (imageBuffer && imageBuffer.length >= 1000) {
                    try {
                        await bot.telegram.sendPhoto(chatId, { source: Buffer.from(imageBuffer) }, {
                            caption: `💎 *Analysis for @${escapeMD(username)}*`,
                            parse_mode: 'Markdown'
                        });
                    } catch (e) {
                        console.error('Failed to send cached photo:', e.message);
                    }
                }

                // Send full report as text
                await bot.telegram.sendMessage(chatId, caption, {
                    parse_mode: 'Markdown'
                });
                return { success: true, cached: true };
            }

            // Fresh fetch
            const [fragmentData, currentTonPrice, insight, suggestions] = await Promise.all([
                scrapeFragment(username),
                tonPrice || getTonPrice(),
                generateShortInsight(username),
                generateUsernameSuggestions(username)
            ]);

            const estValue = await estimateValue(username, fragmentData.lastSalePrice, currentTonPrice, fragmentData.status);
            const rarity = await calculateRarity(username, estValue);

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

            const shareText = encodeURIComponent(`💎 Check out the detailed analysis for @${username} on iFragment Bot!\n\n💰 Est. Value: ${estValue.ton.toLocaleString()} TON\n⭐ Rarity: ${rarity.tier}`);
            const shareUrl = `https://t.me/share/url?url=https://t.me/${bot.botInfo?.username || 'iFragmentBot'}?start=${username}&text=${shareText}`;

            const keyboard = {
                inline_keyboard: [
                    fragmentData.ownerWalletFull
                        ? [{ text: '💼 Portfolio', callback_data: `portfolio:${fragmentData.ownerWalletFull}` }, { text: '🔗 Fragment', url: fragmentData.url }]
                        : [{ text: '🔗 View on Fragment', url: fragmentData.url }],
                    [{ text: '📤 Share Report', url: shareUrl }],
                    [{ text: '🔄 Analyze Another', callback_data: 'report_username' }]
                ]
            };

            // Send photo first if available (Separate message)
            if (imageBuffer && imageBuffer.length >= 1000) {
                try {
                    await bot.telegram.sendPhoto(chatId, { source: Buffer.from(imageBuffer) }, {
                        caption: `💎 *Analysis for @${escapeMD(username)}*`,
                        parse_mode: 'Markdown'
                    });
                } catch (e) {
                    console.error('Failed to send fresh photo:', e.message);
                }
            }

            // Send full report text
            await bot.telegram.sendMessage(chatId, caption, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

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

    // Register Comparison Handler
    jobQueue.registerHandler(JOB_TYPES.COMPARISON, async (job) => {
        const { chatId, userId, data } = job;
        const { user1, user2 } = data;
        const { handleComparison } = await import('./Routes/comparison.handler.js');

        // Create fake context
        const fakeCtx = {
            chat: { id: chatId },
            from: { id: userId },
            reply: (text, extra) => bot.telegram.sendMessage(chatId, text, extra),
            replyWithMarkdown: (text, extra) => bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown', ...extra }),
            replyWithPhoto: (photo, extra) => bot.telegram.sendPhoto(chatId, photo, extra),
            telegram: bot.telegram,
            answerCbQuery: () => Promise.resolve() // No-op
        };

        await handleComparison(fakeCtx, user1, user2);
        return { success: true };
    });

    // Register Portfolio Handler
    jobQueue.registerHandler(JOB_TYPES.PORTFOLIO, async (job) => {
        const { chatId, userId, data } = job;
        const { walletAddress } = data;
        const { generateWalletReport } = await import('../Modules/Monitoring/Application/wallet-tracker.service.js');

        // Create fake context
        const fakeCtx = {
            chat: { id: chatId, type: 'private' }, // Assume private for simplicity in reports
            from: { id: userId },
            reply: (text, extra) => bot.telegram.sendMessage(chatId, text, extra),
            replyWithMarkdown: (text, extra) => bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown', ...extra }),
            replyWithPhoto: (photo, extra) => bot.telegram.sendPhoto(chatId, photo, extra),
            telegram: bot.telegram,
            answerCbQuery: () => Promise.resolve()
        };

        await generateWalletReport(fakeCtx, walletAddress);
        return { success: true };
    });

    console.log('📋 Job queue handlers registered');

    // Register all handlers
    registerPanelHandlers(bot, isAdmin);
    registerFakePanelHandlers(bot, isAdmin);
    registerAccountHandlers(bot, isAdmin);
    registerSettingsHandlers(bot, isAdmin);
    registerOperationsHandlers(bot, isAdmin);
    registerAdminHandlers(bot, isAdmin);
    registerMenuHandlers(bot, isAdmin);
    registerMonitorHandlers(bot, isAdmin);
    console.log('✅ All handlers registered');

    // ==================== CLEAR CACHE COMMAND (Admin) ====================
    bot.command('clearcache', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return;
        const count = clearAllReportCache();
        await ctx.reply(`✅ Memory cache cleared successfully! (${count} items removed)`);
    });

    // ==================== ME COMMAND (New) ====================
    bot.command('me', async (ctx) => {
        const { handleMeCommand } = await import('../Modules/User/Presentation/me.handler.js');
        await handleMeCommand(ctx);
    });

    bot.action('refresh_me', async (ctx) => {
        const { handleMeCommand } = await import('../Modules/User/Presentation/me.handler.js');
        await handleMeCommand(ctx);
    });

    // ==================== WALLET TRACKER HANDLERS (New) ====================
    bot.action(/^view_usernames:(.+)$/, async (ctx) => {
        const { handleViewUsernames } = await import('../Modules/Monitoring/Application/wallet-tracker.service.js');
        await handleViewUsernames(ctx, ctx.match[1]);
    });

    bot.action(/^view_numbers:(.+)$/, async (ctx) => {
        const { handleViewNumbers } = await import('../Modules/Monitoring/Application/wallet-tracker.service.js');
        await handleViewNumbers(ctx, ctx.match[1]);
    });

    // ==================== DAILY SCHEDULER (Market Pulse at 9 AM Afghanistan) ====================
    dailyScheduler.setBot(bot);
    dailyScheduler.startScheduler();

    for (let attempt = 1; attempt <= 5; attempt++) {
        try {
            console.log(`🤖 [Bot] Fetching identity (Attempt ${attempt}/5)...`);
            const botInfo = await bot.telegram.getMe();
            bot.botInfo = botInfo;
            console.log(`✅ [Bot] Identity verified: @${botInfo.username}`);

            console.log('🚀 [Bot] Clearing webhooks...');
            await bot.telegram.deleteWebhook();
            
            console.log('🚀 [Bot] Starting polling loop...');
            bot.launch({
                polling: {
                    allowedUpdates: ['message', 'callback_query', 'inline_query'],
                    dropPendingUpdates: true
                }
            }).then(() => {
                console.log('✅ [Bot] Polling active and listening!');
            }).catch(err => {
                console.error('❌ [Bot] Launch Async Error:', err.message);
            });
            
            console.log('✅ [Bot] Startup sequence completed!');
            console.log(`📝 Send any message to @${botInfo.username} to test.`);
            break; // Success
        } catch (err) {
            console.error(`❌ [Bot] Launch Error (Attempt ${attempt}/5):`, err.message);
            if (attempt === 5) {
                console.error('❌ [Bot] Final Failure. Check your token or network connection.');
                process.exit(1);
            }
            const waitTime = (err.response?.error_code === 409) ? 3000 : 5000;
            console.log(`⏳ [Bot] Retrying in ${waitTime / 1000}s...`);
            await new Promise(r => setTimeout(r, waitTime));
        }
    }
}


// ==================== GLOBAL MIDDLEWARE (Logging) ====================
bot.use(async (ctx, next) => {
    console.log(`📡 [Update] Type: ${ctx.updateType} | From: ${ctx.from?.id || 'Unknown'}`);
    return next();
});

// ==================== BOT.START (Welcome) ====================
bot.start(async (ctx) => {
    return sendDashboard(ctx, false);
});

// ==================== CHECK MEMBERSHIP ====================
bot.action('check_membership', async (ctx) => {
    const isMember = await isChannelMember(ctx.from.id);

    if (isMember) {
        await ctx.answerCbQuery('✅ Welcome!');
        await sendDashboard(ctx, true);
    } else {
        await ctx.answerCbQuery(`❌ You are not a member yet! Please join ${CONFIG.REQUIRED_CHANNEL} first.`, { show_alert: true });
        try { await ctx.deleteMessage(); } catch (e) { }
        return sendJoinChannelMessage(ctx);
    }
});

// ==================== HELP ====================
bot.help((ctx) => ctx.replyWithMarkdown(`
🌟 *${CONFIG.BOT_NAME} Help*

Send any username to get complete market analysis.
`));

// ==================== PHOTO HANDLER (Admin News Cards) ====================
bot.on('photo', async (ctx) => {
    const chatId = ctx.chat.id;
    const userState = userStates.get(chatId);

    // News Post 1 - Photo handler
    if (userState && userState.action === 'frag_news_await_photo' && isAdmin(ctx.from.id)) {
        try {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const fileLink = await ctx.telegram.getFileLink(photo.file_id);

            const response = await fetch(fileLink);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

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

    // News Post 2 - Photo handler (Full Image)
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

    // Account file messages (session imports etc.)
    if (userState) {
        try {
            await handleAccountFileMessage(ctx, userState, bot);
        } catch (e) { }
    }
});

// ==================== G2G DOCUMENT MIDDLEWARE ====================
bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return next();
    const userState = userStates.get(chatId);
    if (!userState) return next();

    // Handle CSV Document Upload for G2G
    if (userState.action === 'g2g_awaiting_csv' && ctx.message?.document && isAdmin(ctx.from.id)) {
        try {
            const doc = ctx.message.document;
            const fileLink = await ctx.telegram.getFileLink(doc.file_id);
            const response = await fetch(fileLink);
            const text = await response.text();

            userStates.delete(chatId);
            const loadingMsg = await ctx.reply('🔄 Importing usernames from CSV...');

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

    return next();
});

// ==================== INLINE QUERY HANDLER ====================
bot.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();

    if (!query) {
        return ctx.answerInlineQuery([
            {
                type: 'article',
                id: 'help_username',
                title: '👤 Search Username',
                description: 'Type @username to analyze value',
                thumb_url: 'https://fragment.com/img/fragment_logo.png',
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
                thumb_url: 'https://nft.fragment.com/img/gifts/gift_standard.png',
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
            thumb_url: 'https://nft.fragment.com/img/gifts/gift_premium.png',
            input_message_content: {
                message_text: `!Gifts ${query}`,
                parse_mode: 'Markdown'
            }
        });
        return ctx.answerInlineQuery(results, { cache_time: 0 });
    }

    // 2. Handle Wallet Address
    if (query.length > 40 || query.startsWith('UQ') || query.startsWith('EQ')) {
        results.push({
            type: 'article',
            id: `wallet_${Date.now()}`,
            title: `💼 Track Wallet`,
            description: `${query.substring(0, 10)}...${query.substring(query.length - 5)}`,
            thumb_url: 'https://ton.org/download/ton_symbol.png',
            input_message_content: {
                message_text: `!Wallet ${query}`,
                parse_mode: 'Markdown'
            }
        });
        return ctx.answerInlineQuery(results, { cache_time: 300 });
    }

    // 3. Handle Username
    const potentialUsername = query.replace('@', '').toLowerCase();
    if (/^[a-zA-Z0-9_]{4,32}$/.test(potentialUsername)) {
        results.push({
            type: 'article',
            id: `user_${potentialUsername}`,
            title: `🔍 Analyze @${potentialUsername}`,
            description: 'Click to generate valuation report',
            thumb_url: 'https://fragment.com/img/fragment_logo.png',
            input_message_content: {
                message_text: `!Username @${potentialUsername}`,
                parse_mode: 'Markdown'
            }
        });

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
    }

    return ctx.answerInlineQuery(results, { cache_time: 300 });
});

// ==================== MAIN TEXT MESSAGE ROUTER ====================
bot.on('text', async (ctx, next) => {
    try {
        const userId = ctx.from.id;
        const input = ctx.message.text ? ctx.message.text.trim() : '';
        if (!input) return;

        console.log(`📩 [Text] From ${userId} in ${ctx.chat.type}: ${input}`);

        if (input.startsWith('/')) return next(); // Pass commands to other handlers

        const chatId = ctx.chat.id;
        const isPrivate = ctx.chat.type === 'private';
        const state = userStates.get(chatId);

        // ==================== GROUP COMMAND HANDLER ====================
        if ((ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') && input.startsWith('!')) {
            await handleGroupCommand(ctx, input, handleComparison, getTelegramClient);
            return;
        }

        // ==================== TELEGRAM LOGIN FLOW (PRIORITY) ====================
        if (state && state.action === 'awaiting_phone' && isAdmin(userId)) {
            const phonePattern = /^\+?\d{10,15}$/;
            if (phonePattern.test(input)) {
                userStates.set(chatId, { action: 'phone_processing', phone: input });
                const msg = await ctx.reply('📱 Sending verification code...');

                try {
                    const tc = await getTelegramClient();
                    const result = tc ? await tc.startLogin(input) : { success: false, error: 'Service not available' };

                    if (result.success) {
                        userStates.set(chatId, { action: 'awaiting_code', phone: input });
                        await ctx.telegram.editMessageText(
                            chatId, msg.message_id, null,
                            '✅ Code sent!\n\n🔐 Please enter the verification code you received:',
                            { reply_markup: { inline_keyboard: [[{ text: '🔄 Resend Code', callback_data: 'panel_resend_code' }], [{ text: '❌ Cancel', callback_data: 'panel_cancel_login' }]] } }
                        );
                    } else {
                        userStates.delete(chatId);
                        await ctx.telegram.editMessageText(
                            chatId, msg.message_id, null,
                            `❌ Login failed: ${result.error}\n\nPlease try again with /panel`
                        );
                    }
                } catch (error) {
                    userStates.delete(chatId);
                    await ctx.telegram.editMessageText(
                        chatId, msg.message_id, null,
                        `❌ Error: ${error.message}`
                    );
                }
            }
            return;
        }

        // Handle verification code input
        if (state && state.action === 'awaiting_code' && isAdmin(userId)) {
            try { await ctx.deleteMessage(); } catch (e) { }
            const msg = await ctx.reply('🔄 Verifying code...');

            const tc = await getTelegramClient();
            const result = tc ? await tc.submitCode(input) : { success: false, error: 'Service not available' };

            if (result.success) {
                userStates.delete(chatId);
                await ctx.telegram.editMessageText(
                    chatId, msg.message_id, null,
                    `✅ *Account connected successfully!*\n\n👤 ${result.user.firstName} ${result.user.lastName || ''}\n📱 @${result.user.username || 'no-username'}`,
                    { parse_mode: 'Markdown' }
                );
            } else if (result.needs2FA) {
                userStates.set(chatId, { action: 'awaiting_2fa' });
                await ctx.telegram.editMessageText(
                    chatId, msg.message_id, null,
                    '🔐 2FA Required!\n\nPlease enter your Two-Factor Authentication password:'
                );
            } else {
                userStates.delete(chatId);
                await ctx.telegram.editMessageText(
                    chatId, msg.message_id, null,
                    `❌ Verification failed: ${result.error}\n\nPlease try again with /panel`
                );
            }
            return;
        }

        // Handle 2FA password input
        if (state && state.action === 'awaiting_2fa' && isAdmin(userId)) {
            try { await ctx.deleteMessage(); } catch (e) { }
            const msg = await ctx.reply('🔄 Verifying 2FA...');

            const tc = await getTelegramClient();
            const result = tc ? await tc.submit2FA(input) : { success: false, error: 'Service not available' };

            if (result.success) {
                userStates.delete(chatId);
                await ctx.telegram.editMessageText(
                    chatId, msg.message_id, null,
                    `✅ *Account connected successfully!*\n\n👤 ${result.user.firstName} ${result.user.lastName || ''}\n📱 @${result.user.username || 'no-username'}`,
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

        // ==================== STATE-BASED HANDLERS ====================
        if (state) {
            if (await handleAdminTextMessage(ctx, state, bot, isAdmin)) return;
            if (await handleFakePanelTextMessage(ctx, state, bot, isAdmin)) return;
            if (await handleAccountTextMessage(ctx, state, bot)) return;
            if (await handleSettingsTextMessage(ctx, state, bot)) return;
            if (await handleOperationsTextMessage(ctx, state, bot)) return;
            if (await handleMenuTextMessage(ctx, state, bot, isAdmin, getTelegramClient)) return;
        }

        // ==================== PRIVATE CHAT: GROUP COMMANDS ====================
        if (isPrivate && input.startsWith('!')) {
            await handleGroupCommand(ctx, input, handleComparison, getTelegramClient);
            return;
        }

        // ==================== PRIVATE CHAT: SMART SEARCH ====================
        if (isPrivate && !state) {
            // A. Wallet / Portfolio
            if (input.length > 40 && (input.startsWith('EQ') || input.startsWith('UQ'))) {
                console.log(`🔍 [SmartSearch] Matched Wallet: ${input}`);
                await handleGroupCommand(ctx, `!wallet ${input}`, handleComparison, getTelegramClient);
                return;
            }

            // B. Gift Link
            const giftParsed = parseGiftLink(input);
            if (giftParsed.isValid) {
                console.log(`🔍 [SmartSearch] Matched Gift Link: ${input}`);
                await handleGroupCommand(ctx, `!gift ${input}`, handleComparison, getTelegramClient);
                return;
            }

            // C. Username
            const cleanUser = input.replace('@', '');
            if (/^[a-zA-Z0-9_]{4,32}$/.test(cleanUser)) {
                console.log(`🔍 [SmartSearch] Matched Username: ${cleanUser}`);
                await handleGroupCommand(ctx, `!u ${cleanUser}`, handleComparison, getTelegramClient);
                return;
            }
        }
    } catch (error) {
        console.error('❌ Text router error:', error);
        try {
            await ctx.reply('⚠️ An error occurred. Please try again.');
        } catch (replyError) {
            console.error('❌ Failed to send error reply:', replyError.message);
        }
    }
});

// ==================== GRACEFUL SHUTDOWN ====================
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
bot.catch((err, ctx) => {
    console.error(`❌ Telegraf Error for ${ctx.updateType}:`, err);
});

initAndLaunch();
