/**
 * Dashboard Helper Module
 * Extracted from bot.entry.js — handles dashboard rendering,
 * greetings, tips, and market data retrieval.
 */

import { CONFIG } from '../../core/Config/app.config.js';
import { tonPriceCache } from '../../Shared/Infra/Cache/cache.service.js';
import { getTonMarketStats } from '../../Modules/Market/Infrastructure/fragment.repository.js';
import { get888Stats } from '../../Modules/Market/Application/market.service.js';
import { scanUserGiftsIfNeeded, updateUserInfo, getRemainingLimits, getTimeUntilReset } from '../../Modules/User/Application/user.service.js';

// ==================== GREETING HELPER ====================

export function getGreeting(name) {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: `*${name}*`, icon: '☀️', period: 'Good Morning' };
    if (hour >= 12 && hour < 18) return { text: `*${name}*`, icon: '🌤', period: 'Good Afternoon' };
    if (hour >= 18 && hour < 22) return { text: `*${name}*`, icon: '🌙', period: 'Good Evening' };
    return { text: `*${name}*`, icon: '🌃', period: 'Night Owl Mode' };
}

// ==================== DASHBOARD DATA (from cache) ====================

/**
 * Returns dashboard data INSTANTLY from cache.
 * All price updates happen in background via startBackgroundUpdates().
 */
export function getDashboardData() {
    const tonStats = tonPriceCache.get('marketStats') || { price: 5.50, change24h: 0, timestamp: 0 };
    const floor888 = tonPriceCache.get('floor888');

    // If stale, trigger background update (non-blocking)
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    if (!tonStats.timestamp || Date.now() - tonStats.timestamp > TWO_HOURS) {
        getTonMarketStats().then(freshStats => {
            if (freshStats && freshStats.price > 0) {
                tonPriceCache.set('marketStats', { ...freshStats, timestamp: Date.now() });
                tonPriceCache.set('price', freshStats.price);
            }
        }).catch(() => { });
    }

    // Background 888 update if stale
    if (!floor888 || !floor888.timestamp || Date.now() - floor888.timestamp > 60 * 60 * 1000) {
        get888Stats().then(p => {
            if (p) tonPriceCache.set('floor888', { price: p, timestamp: Date.now() });
        }).catch(() => { });
    }

    return {
        tonPrice: tonStats.price || 5.50,
        tonChange: tonStats.change24h || 0,
        price888: floor888 ? floor888.price : null
    };
}

// ==================== SEND DASHBOARD ====================

export async function sendDashboard(ctx, isEdit = false, forceAdmin = false) {
    const userId = ctx.from.id;
    // Helper to check admin if not forced
    const isAdminUser = forceAdmin || (String(userId) === String(CONFIG.ADMIN_ID) || String(userId) === String(process.env.ADMIN_USER_ID));

    // Show typing status while fetching data
    if (!isEdit) ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(() => { });

    const { tonPrice, tonChange, price888 } = getDashboardData();
    const firstName = ctx.from.first_name || 'Trader';

    // Save user info for leaderboard display
    updateUserInfo(userId, ctx.from.username, firstName);

    // Trigger background gift scan (non-blocking)
    scanUserGiftsIfNeeded(userId).catch(err => console.error('Background gift scan error:', err));

    // Get personalized data
    const greeting = getGreeting(firstName);
    const remaining = getRemainingLimits(userId);
    const credits = remaining.credits || 0;

    // -- Market Pulse --
    const changeIcon = tonChange >= 0 ? '📈' : '📉';
    const sign = tonChange >= 0 ? '+' : '';
    const changeText = sign + tonChange.toFixed(2) + '%';

    // ═══════════════════════════════
    //  ULTRA-PRO DASHBOARD FORMAT
    // ═══════════════════════════════

    let message = '';

    // ── BRAND HEADER ──
    message += `✦ *iFragment Main Menu*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // ── GREETING ──
    message += `${greeting.icon} ${greeting.period}, ${greeting.text}\n`;
    message += `_This bot provides advanced analytics and real-time valuation for Fragment assets._\n\n`;

    // ── LIVE MARKET ──
    message += `🌍 *Live Market Overview*\n`;
    message += `├ 💎 *TON:* \`$${tonPrice.toFixed(2)}\` ${changeIcon} ${changeText}\n`;
    if (price888) {
        message += `└ 🏴‍☠️ *+888:* \`${price888.toLocaleString()} TON\`\n`;
    } else {
        message += `└ 🏴‍☠️ *+888:* \`Synching...\`\n`;
    }
    message += `\n`;

    message += `💳 *Your Balance:* \`${credits} FRG\`\n\n`;

    message += `💎 *How to get FRG:*\n`;
    message += `Earn **+300 FRG** by sending messages in the [Fragment Investors](https://t.me/FragmentInvestors) club.\n\n`;

    // ── CTA ──
    message += `👇 *Please select a service from the menu below:*`;

    // ═══════════════════════════════
    //  KEYBOARD — Premium Compact Layout
    // ═══════════════════════════════

    const keyboardButtons = [
        // Row 1
        [
            { text: '🆔 Username', callback_data: 'report_username' },
            { text: '🎁 Gift', callback_data: 'report_gifts' },
            { text: '🏴‍☠️ +888', callback_data: 'report_numbers' }
        ],
        // Row 2
        [
            { text: '💼 Wallet Tracker', callback_data: 'menu_portfolio' },
            { text: '⚖️ Compare Usernames', callback_data: 'menu_compare' }
        ],
        // Row 3
        [
            { text: '⚙️ My Profile', callback_data: 'menu_account' }
        ]
    ];


    const keyboard = {
        reply_markup: {
            inline_keyboard: keyboardButtons
        }
    };

    if (isEdit) {
        try {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', disable_web_page_preview: true, ...keyboard });
        } catch (e) {
            if (!e.message.includes('message is not modified')) {
                await ctx.reply(message, { parse_mode: 'Markdown', disable_web_page_preview: true, ...keyboard });
            }
        }
    } else {
        await ctx.reply(message, { parse_mode: 'Markdown', disable_web_page_preview: true, ...keyboard });
    }
}
