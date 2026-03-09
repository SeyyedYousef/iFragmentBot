/**
 * Dashboard Helper Module
 * Extracted from bot.entry.js — handles dashboard rendering,
 * greetings, tips, and market data retrieval.
 */

import { CONFIG } from '../../core/Config/app.config.js';
import { tonPriceCache } from '../../Shared/Infra/Cache/cache.service.js';
import { getTonMarketStats } from '../../Modules/Market/Infrastructure/fragment.repository.js';
import { get888Stats } from '../../Modules/Market/Application/market.service.js';
import { isPremium, getPremiumTier, getStreakInfo, getReferralStats, scanUserGiftsIfNeeded, updateUserInfo } from '../../Modules/User/Application/user.service.js';

// ==================== GREETING HELPER ====================

export function getGreeting(name) {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { text: `Good Morning, *${name}*`, icon: '☀️' };
    if (hour >= 12 && hour < 18) return { text: `Good Afternoon, *${name}*`, icon: '🌤' };
    if (hour >= 18 && hour < 22) return { text: `Good Evening, *${name}*`, icon: '🌙' };
    return { text: `Hey *${name}*, still up?`, icon: '🌃' };
}

// ==================== SMART TIP (Context-Aware) ====================
// Tips removed per new UI design requirements

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

export async function sendDashboard(ctx, isEdit = false) {
    // Show typing status while fetching data
    if (!isEdit) ctx.telegram.sendChatAction(ctx.chat.id, 'typing').catch(() => { });

    const { tonPrice, tonChange, price888 } = getDashboardData();
    const firstName = ctx.from.first_name || 'Trader';
    const userId = ctx.from.id;
    const userIsPremium = isPremium(userId);

    // Save user info for leaderboard display
    updateUserInfo(userId, ctx.from.username, firstName);

    // Trigger background gift scan (non-blocking)
    scanUserGiftsIfNeeded(userId).catch(err => console.error('Background gift scan error:', err));

    // Get personalized data
    const streakInfo = await getStreakInfo(userId);
    const refStats = await getReferralStats(userId);
    const tier = getPremiumTier(userId);
    const greeting = getGreeting(firstName);
    // -- Header & Market Pulse --
    const changeIcon = tonChange >= 0 ? '📈' : '📉';
    const sign = tonChange >= 0 ? '+' : '';
    const changeText = sign + tonChange.toFixed(2) + '%';

    let marketLine = '💎 *TON Market:* $' + tonPrice.toFixed(2) + ' (' + changeIcon + ' ' + changeText + ')';
    if (price888) {
        marketLine += '\n🏴‍☠️ *+888 Floor:* ' + price888.toLocaleString() + ' TON';
    }

    const header = '🔮 *iFragment* — Your Intelligence Hub\n\n' +
        '📊 _Real-time pricing, rarity checks, and deep analytics for Telegram Usernames & Gifts._\n\n' +
        marketLine + '\n━━━━━━━━━━━━━━━━\n';

    // -- Premium Badge --
    let badgeText = ' 『🆓 Free』';
    if (tier) {
        const tBadge = tier.badge || '⭐';
        const tLabel = tier.label || tier.key || 'Premium';
        badgeText = ' 『' + tBadge + ' ' + tLabel + '』';
    }

    const greetingLine = greeting.icon + ' ' + greeting.text + badgeText + '\n\n';

    // -- Streak Line (Visual Progress Bar) --
    let streakLine = '';
    if (streakInfo.claimedToday) {
        let bar = '';
        for (let i = 1; i <= 7; i++) {
            if (i < streakInfo.current) bar += '✅';
            else if (i === streakInfo.current) bar += '🌟';
            else bar += '◻️';
        }
        streakLine = '🔥 *Streak:* ' + bar + ' (Day ' + streakInfo.current + '/7)\n';
    } else {
        const nextDay = Math.min((streakInfo.current || 0) + 1, 7);
        let bar = '';
        for (let i = 1; i <= 7; i++) {
            if (i <= (streakInfo.current || 0)) bar += '✅';
            else if (i === nextDay) bar += '👉';
            else bar += '◻️';
        }
        streakLine = '🔥 *Streak:* ' + bar + ' (Day ' + nextDay + ' waiting!)\n';
    }

    // -- Referral Line (Visual Progress Bar) --
    let refLine = '';
    const target = refStats.target || 10;
    const count = refStats.count || 0;
    const pct = Math.min(count / target, 1);
    const filled = Math.round(pct * 10);
    const refBar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
    refLine = '👥 *Invites:* ' + refBar + ' (' + count + '/' + target + ')\n';
    if (refStats.pending > 0) {
        refLine += '   (⏳ ' + refStats.pending + ' pending)\n';
    }

    // -- Smart CTA --
    let cta;
    if (!userIsPremium && streakInfo && !streakInfo.claimedToday) {
        cta = '⚡ *Claim your daily reward & explore!* 👇';
    } else if (!userIsPremium && count === 0) {
        cta = '🚀 *Start by checking any username!* 👇';
    } else if (userIsPremium) {
        cta = '👑 *Your premium dashboard is ready* 👇';
    } else {
        cta = '⚡ *What\'s your next move?* 👇';
    }

    const message = header + greetingLine + streakLine + refLine + '\n' + cta;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                // ANALYSIS
                [
                    { text: '👤 Username', callback_data: 'report_username' },
                    { text: '🎁 Gift', callback_data: 'report_gifts' },
                    { text: '🏴‍☠️ +888', callback_data: 'report_numbers' }
                ],
                // TOOLS
                [
                    { text: '💼 Wallet Tracker', callback_data: 'menu_portfolio' },
                    { text: '🆚 Compare Names', callback_data: 'menu_compare' }
                ],
                // ENGAGEMENT
                [
                    { text: '🔥 Daily Streak', callback_data: 'menu_spin' },
                    { text: '👥 Invite & Earn', callback_data: 'menu_invites' }
                ],
                // PERSONAL
                [
                    { text: userIsPremium ? ((tier?.badge || '⭐') + ' My Profile') : '👤 My Profile', callback_data: 'menu_account' },
                    { text: '💎 Premium', callback_data: 'buy_premium' }
                ],
                // INFO
                [{ text: '🤝 Partners & Sponsors', callback_data: 'menu_sponsors' }]
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
