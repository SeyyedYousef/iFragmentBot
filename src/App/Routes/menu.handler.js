/**
 * Menu Handler Module
 * Handles all main menu action callbacks:
 * - Report username/gifts/numbers
 * - Compare usernames
 * - Portfolio tracker
 * - Sponsors
 * - My Account
 * - Daily Spin
 * - Invite & Earn
 * - Premium payment
 * Extracted from bot.entry.js to reduce monolith size.
 */

import { Markup } from 'telegraf';
import { CONFIG } from '../../core/Config/app.config.js';
import { userStates } from '../../Shared/Infra/State/state.service.js';
import { sendDashboard } from '../Helpers/dashboard.helper.js';
import { checkMembershipOrStop } from '../Helpers/membership.helper.js';
import {
    canUseFeature,
    useFeature,
    isPremium,
    formatNoCreditsMessage,
    getRemainingLimits,
    getTimeUntilReset,
    getPremiumExpiry,
    getPremiumTier,
    getSponsorText,
    getReferralStats,
    getTopReferrers,
    processSpin,
    claimDailyReward,
    getStreakInfo,
    activatePremium,
    PREMIUM_PRICE,
    PREMIUM_DAYS,
    PREMIUM_TIERS,
    REFERRAL_MILESTONES,
    STREAK_REWARDS
} from '../../Modules/User/Application/user.service.js';
import { handlePortfolioByWallet, handleGroupCommand } from './group.handler.js';
import { handleComparison } from './comparison.handler.js';
import { handleUsernamePagination, handleGiftPagination, handleNumberPagination } from '../../Modules/Monitoring/Application/wallet-tracker.service.js';
import { jobQueue, JOB_TYPES, PRIORITIES, formatQueueMessage } from '../../Modules/Automation/Application/queue.service.js';

// ==================== REGISTER HANDLERS ====================

export function registerMenuHandlers(bot, isAdmin) {

    // ==================== BACK TO MENU ====================

    bot.action('back_to_menu', async (ctx) => {
        await ctx.answerCbQuery();
        userStates.delete(ctx.chat.id);
        await sendDashboard(ctx, true);
    });

    // ==================== SPONSORS ====================

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

    // ==================== MY ACCOUNT ====================

    bot.action('menu_account', async (ctx) => {
        await ctx.answerCbQuery();

        const userId = ctx.from.id;
        const user = ctx.from;
        const userIsPremium = isPremium(userId);
        const limits = getRemainingLimits(userId);
        const resetTime = getTimeUntilReset(userId);
        const streakInfo = await getStreakInfo(userId);
        const refStats = await getReferralStats(userId);
        const tier = getPremiumTier(userId);

        let accountMessage = `👤 *My Account*\n\n`;
        accountMessage += `━━━ 📋 *Profile* ━━━\n`;
        accountMessage += `• Name: ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}\n`;
        accountMessage += `• Username: ${user.username ? '@' + user.username : 'Not set'}\n`;
        accountMessage += `• ID: \`${userId}\`\n\n`;

        accountMessage += `━━━ ⭐ *Subscription* ━━━\n`;

        if (userIsPremium && tier) {
            const expiry = getPremiumExpiry(userId);
            const expiryDate = expiry ? expiry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
            const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;
            accountMessage += `• Plan: ${tier.badge} *${tier.label}*\n`;
            accountMessage += `• Expires: ${daysLeft > 9000 ? 'Never 🌟' : expiryDate}\n`;
            if (daysLeft <= 9000) accountMessage += `• Days Left: *${daysLeft} days*\n`;
            accountMessage += `• 🛡️ Streak Shield: ${streakInfo.shieldActive ? '✅ Active' : '❌ Used'}\n\n`;
        } else {
            accountMessage += `• Type: 🆓 Free\n`;
            accountMessage += `• Credits: ${limits.credits || 0}/1\n`;
            accountMessage += `• Reset in: *${resetTime.formatted}*\n\n`;
        }

        accountMessage += `━━━ 🔥 *Daily Streak* ━━━\n`;
        accountMessage += `• Current: Day *${streakInfo.current}*/7\n`;
        accountMessage += `• Total Days: *${streakInfo.totalDays}*\n`;
        if (streakInfo.weekNumber > 0) accountMessage += `• Weeks: *${streakInfo.weekNumber}*\n`;
        accountMessage += `\n`;

        accountMessage += `━━━ 👥 *Referrals* ━━━\n`;
        accountMessage += `• Confirmed: *${refStats.count}*\n`;
        if (refStats.pending > 0) accountMessage += `• Pending: *${refStats.pending}*\n`;
        if (refStats.badges.length > 0) accountMessage += `• Badges: ${refStats.badges.join(' ')}\n`;

        const buttons = [];
        if (userIsPremium) {
            buttons.push([{ text: '💎 Upgrade/Extend', callback_data: 'buy_premium' }]);
        } else {
            buttons.push([{ text: '🌟 Get Premium', callback_data: 'buy_premium' }]);
        }
        buttons.push(
            [{ text: '🔥 Daily Streak', callback_data: 'menu_spin' }, { text: '👥 Invite Friends', callback_data: 'menu_invites' }],
            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
        );

        try {
            await ctx.editMessageText(accountMessage, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });
        } catch (e) {
            await ctx.replyWithMarkdown(accountMessage, {
                reply_markup: { inline_keyboard: buttons }
            });
        }
    });

    // ==================== USERNAME REPORT ====================

    bot.action('report_username', async (ctx) => {
        if (!await checkMembershipOrStop(ctx, bot, isAdmin)) return;
        await ctx.answerCbQuery();

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

    // ==================== GIFT REPORT ====================

    bot.action('report_gifts', async (ctx) => {
        if (!await checkMembershipOrStop(ctx, bot, isAdmin)) return;
        await ctx.answerCbQuery();

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

    // ==================== ANONYMOUS NUMBERS (Coming Soon) ====================

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

    // ==================== CANCEL REPORT HANDLERS ====================

    const reportCancelMenu = `
📊 *Get Report*

Choose what you want to analyze:

• 👤 *Username* - Analyze any Telegram username
• 🎁 *Gifts* - Get detailed gift NFT report
• 📱 *Anonymous Numbers* - Coming soon!

_Select an option below:_
`;

    const reportCancelKeyboard = {
        inline_keyboard: [
            [{ text: '👤 Username', callback_data: 'report_username' }],
            [{ text: '🎁 Gifts', callback_data: 'report_gifts' }],
            [{ text: '📱 Anonymous Numbers', callback_data: 'report_numbers' }],
            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
        ]
    };

    bot.action('cancel_username_report', async (ctx) => {
        await ctx.answerCbQuery('❌ Cancelled');
        userStates.delete(ctx.chat.id);

        try {
            await ctx.editMessageText(reportCancelMenu, {
                parse_mode: 'Markdown',
                reply_markup: reportCancelKeyboard
            });
        } catch (e) {
            await ctx.replyWithMarkdown(reportCancelMenu, {
                reply_markup: reportCancelKeyboard
            });
        }
    });

    bot.action('cancel_gift_report', async (ctx) => {
        await ctx.answerCbQuery('❌ Cancelled');
        userStates.delete(ctx.chat.id);

        try {
            await ctx.editMessageText(reportCancelMenu, {
                parse_mode: 'Markdown',
                reply_markup: reportCancelKeyboard
            });
        } catch (e) {
            await ctx.replyWithMarkdown(reportCancelMenu, {
                reply_markup: reportCancelKeyboard
            });
        }
    });

    // ==================== COMPARE USERNAMES ====================

    bot.action('menu_compare', async (ctx) => {
        if (!await checkMembershipOrStop(ctx, bot, isAdmin)) return;
        await ctx.answerCbQuery();
        const userId = ctx.from.id;

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

    bot.action('cancel_compare', async (ctx) => {
        await ctx.answerCbQuery('❌ Cancelled');
        userStates.delete(ctx.chat.id);
        await sendDashboard(ctx, true);
    });

    // ==================== PORTFOLIO TRACKER ====================

    bot.action('menu_portfolio', async (ctx) => {
        if (!await checkMembershipOrStop(ctx, bot, isAdmin)) return;
        await ctx.answerCbQuery();
        const userId = ctx.from.id;

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

    bot.action('cancel_portfolio', async (ctx) => {
        await ctx.answerCbQuery('❌ Cancelled');
        userStates.delete(ctx.chat.id);
        await sendDashboard(ctx, true);
    });

    // ==================== DAILY STREAK REWARD ====================

    bot.action('menu_spin', async (ctx) => {
        await ctx.answerCbQuery();
        if (!await checkMembershipOrStop(ctx, bot, isAdmin)) return;
        const streakInfo = await getStreakInfo(ctx.from.id);
        let calendarLines = '';
        for (let i = 0; i < STREAK_REWARDS.length; i++) {
            const reward = STREAK_REWARDS[i];
            const dayNum = i + 1;
            let status = '⬜';
            if (dayNum < streakInfo.current) status = '✅';
            else if (dayNum === streakInfo.current && streakInfo.claimedToday) status = '🌟';
            else if (dayNum === streakInfo.current && !streakInfo.claimedToday) status = '👉';
            else if (dayNum === (streakInfo.current + 1) && !streakInfo.claimedToday) status = '👉';
            calendarLines += `${status} Day ${dayNum}: ${reward.label}\n`;
        }
        const shieldMsg = streakInfo.shieldActive ? '\n🛡️ _Streak Shield Active (Premium perk)_' : '';
        const weekMsg = streakInfo.weekNumber > 0 ? `\n🏆 Weeks completed: *${streakInfo.weekNumber}*` : '';
        const currentDay = streakInfo.claimedToday ? streakInfo.current : Math.min((streakInfo.current || 0) + 1, 7);
        const message = `
📅 *Daily Streak Rewards*

Come back every day for *guaranteed rewards!*
🔥 Current Streak: *Day ${currentDay}/${STREAK_REWARDS.length}*
📊 Total Days: *${streakInfo.totalDays}*${weekMsg}${shieldMsg}

━━━━ 🎁 This Week\'s Rewards ━━━━

${calendarLines}
━━━━━━━━━━━━━━━━━━━━━

💡 _Miss a day? Streak resets! Premium users get a Shield._
`;
        const buttons = [];
        if (!streakInfo.claimedToday) {
            buttons.push([{ text: '🎁 Claim Today\'s Reward!', callback_data: 'claim_daily_reward' }]);
        } else {
            buttons.push([{ text: '✅ Already Claimed Today', callback_data: 'already_claimed_info' }]);
        }
        buttons.push([{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]);
        try {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
        } catch (e) {
            await ctx.replyWithMarkdown(message, { reply_markup: { inline_keyboard: buttons } });
        }
    });

    bot.action('claim_daily_reward', async (ctx) => {
        await ctx.answerCbQuery();
        const result = await claimDailyReward(ctx.from.id);
        if (!result.success) {
            if (result.reason === 'already_claimed') {
                const hrs = Math.ceil((result.nextClaim - new Date()) / (1000 * 60 * 60));
                const nextDay = (result.streak?.current || 0) + 1 > 7 ? 1 : (result.streak?.current || 0) + 1;
                await ctx.replyWithMarkdown(`✅ *Already Claimed!*\n\nCome back in *~${hrs} hours* for Day ${nextDay}!\n🔥 Current Streak: Day *${result.streak?.current || 0}*`, {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]] }
                });
                return;
            }
        }
        let extra = result.streakBroken ? '\n⚠️ _Your streak was partially reset._' : '';
        extra += result.shieldUsed ? '\n🛡️ _Streak Shield saved your streak!_' : '';
        const nextDay = result.streakDay + 1 > 7 ? 1 : result.streakDay + 1;
        await ctx.replyWithMarkdown(`🎉 *Day ${result.streakDay} Reward Claimed!*\n\n🎁 *${result.reward.label}*${extra}\n\n🔥 Streak: Day *${result.streakDay}/${STREAK_REWARDS.length}*\n📊 Total Days: *${result.totalDays}*\n${result.weekNumber > 0 ? '🏆 Weeks: *' + result.weekNumber + '*\n' : ''}━━━━━━━━━━━━━━━━\n💡 _Come back tomorrow for Day ${nextDay} reward!_`, {
            reply_markup: { inline_keyboard: [[{ text: '📅 View Streak Calendar', callback_data: 'menu_spin' }], [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]] }
        });
    });

    bot.action('already_claimed_info', async (ctx) => {
        await ctx.answerCbQuery('✅ Already claimed today! Come back tomorrow.', { show_alert: true });
    });

    // ==================== INVITE & EARN (Enhanced) ====================

    bot.action('menu_invites', async (ctx) => {
        await ctx.answerCbQuery();
        const stats = await getReferralStats(ctx.from.id);
        let milestonesText = '';
        for (const m of REFERRAL_MILESTONES) {
            const isReached = stats.count >= m.count;
            const isCurrent = !isReached && (stats.lastMilestone < m.count);
            const icon = isReached ? '✅' : (isCurrent && stats.count > stats.lastMilestone ? '🔴' : '⬜');
            milestonesText += `${icon} *${m.count}* invites \u2192 ${m.reward.label}\n`;
            if (isCurrent && !isReached) break;
        }
        const progressPct = Math.min(stats.progress / stats.target, 1);
        const filled = Math.round(progressPct * 10);
        const progressBar = '▓'.repeat(filled) + '░'.repeat(10 - filled);
        const badgeText = stats.badges.length > 0 ? `\n🏅 *Badges:* ${stats.badges.join(' | ')}` : '';
        const pendingText = stats.pending > 0 ? `\n⏳ *Pending:* ${stats.pending} _(must join channel)_` : '';
        const message = `
👥 *Invite Friends & Earn Premium*

Invite friends and earn *free rewards* with every milestone!
🛡️ _Referrals only count when they join ${CONFIG.REQUIRED_CHANNEL}_

📊 *Your Stats:*
✅ Confirmed: *${stats.count}*${pendingText}

━━━━ 🏆 Milestone Progress ━━━━

${milestonesText}
${progressBar} *${stats.progress}/${stats.target}*
🎁 Next: ${stats.nextReward}${badgeText}

━━━━━━━━━━━━━━━━━━━━━

🔗 *Your Referral Link:*
\`${stats.link}\`

_Share to start earning!_
`;
        const shareText = encodeURIComponent('💎 Check out this amazing Fragment bot!');
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(stats.link)}&text=${shareText}`;
        try {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📤 Share Link', url: shareUrl }], [{ text: '🏆 Referral Leaderboard', callback_data: 'referral_leaderboard' }], [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]] } });
        } catch (e) {
            await ctx.replyWithMarkdown(message, { reply_markup: { inline_keyboard: [[{ text: '📤 Share Link', url: shareUrl }], [{ text: '🏆 Referral Leaderboard', callback_data: 'referral_leaderboard' }], [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]] } });
        }
    });

    bot.action('referral_leaderboard', async (ctx) => {
        await ctx.answerCbQuery();
        const topReferrers = await getTopReferrers(10);
        let text = '🏆 *Top Referrers*\n\n';
        if (topReferrers.length === 0) {
            text += '_No referrals yet. Be the first!_\n';
        } else {
            const medals = ['🥇', '🥈', '🥉'];
            for (const ref of topReferrers) {
                const medal = medals[ref.rank - 1] || (ref.rank + '.');
                let name = ref.username ? ('@' + ref.username) : (ref.firstName || null);
                // Fallback: fetch from Telegram API if name is missing
                if (!name) {
                    try {
                        const chat = await ctx.telegram.getChat(ref.userId);
                        name = chat.username ? ('@' + chat.username) : (chat.first_name || 'Anonymous');
                    } catch {
                        name = 'Anonymous';
                    }
                }
                text += `${medal} *${name}* \u2014 ${ref.count} invites\n`;
            }
        }
        text += '\n_Invite more friends to climb the ranks!_';
        try {
            await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Referral', callback_data: 'menu_invites' }], [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]] } });
        } catch (e) {
            await ctx.replyWithMarkdown(text, { reply_markup: { inline_keyboard: [[{ text: '🔙 Back to Referral', callback_data: 'menu_invites' }], [{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]] } });
        }
    });

    // ==================== PREMIUM PAYMENT (Multi-Tier) ====================

    bot.action('buy_premium', async (ctx) => {
        await ctx.answerCbQuery();
        const userIsPremium = isPremium(ctx.from.id);
        const currentTier = getPremiumTier(ctx.from.id);
        let header = '';
        if (userIsPremium && currentTier) {
            const expiry = getPremiumExpiry(ctx.from.id);
            const expiryStr = expiry ? expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
            header = currentTier.badge + ' *Current Plan: ' + currentTier.label + '*\n\ud83d\udcc5 Expires: *' + expiryStr + '*\n\n_Upgrade or extend below:_\n';
        } else {
            header = '\n\ud83d\ude80 *Unlock Premium Features*\n\nChoose the plan that fits you best:\n';
        }
        const trialPPD = (PREMIUM_TIERS.trial.price / PREMIUM_TIERS.trial.days).toFixed(1);
        const weeklyPPD = (PREMIUM_TIERS.weekly.price / PREMIUM_TIERS.weekly.days).toFixed(1);
        const monthlyPPD = (PREMIUM_TIERS.monthly.price / PREMIUM_TIERS.monthly.days).toFixed(1);
        const seasonPPD = (PREMIUM_TIERS.season.price / PREMIUM_TIERS.season.days).toFixed(1);

        const monthlySavings = Math.round((1 - (PREMIUM_TIERS.monthly.price / PREMIUM_TIERS.monthly.days) / (PREMIUM_TIERS.weekly.price / PREMIUM_TIERS.weekly.days)) * 100);

        const message = '🌟 *iFragment Premium*\n' + header + '\n━━━━━━━━━━━━━━━━━━━━\n\n' +
            '🎟️ *Trial* \u2014 ' + PREMIUM_TIERS.trial.price + '⭐ (' + PREMIUM_TIERS.trial.days + ' day)\n   Try premium risk-free! _(' + trialPPD + '⭐/day)_\n\n' +
            '⭐ *Weekly* \u2014 ' + PREMIUM_TIERS.weekly.price + '⭐ (' + PREMIUM_TIERS.weekly.days + ' days)\n   Unlimited reports _(' + weeklyPPD + '⭐/day)_\n\n' +
            '💎 *Monthly* \u2014 ' + PREMIUM_TIERS.monthly.price + '⭐ (' + PREMIUM_TIERS.monthly.days + ' days) \u2b05\ufe0f *BEST VALUE*\n   Save ' + monthlySavings + '% vs Weekly! _(' + monthlyPPD + '⭐/day)_\n\n' +
            '👑 *Season* \u2014 ' + PREMIUM_TIERS.season.price + '⭐ (' + PREMIUM_TIERS.season.days + ' days)\n   Premium Tier _(' + seasonPPD + '⭐/day)_\n\n' +
            '━━━━━━━━━━━━━━━━━━━━\n\n✨ *All plans include:*\n• \u26a1 Instant activation\n• 🛡️ Streak Shield\n• 📊 Unlimited Reports\n• 🚀 Priority Queue\n\n💡 _Earn free premium via Daily Streak & Referrals!_';
        const trialBtn = '🎟️ Trial ' + PREMIUM_TIERS.trial.price + '⭐';
        const weeklyBtn = '⭐ Weekly ' + PREMIUM_TIERS.weekly.price + '⭐';
        const monthlyBtn = '💎 Monthly ' + PREMIUM_TIERS.monthly.price + '⭐ ✨';
        const seasonBtn = '👑 Season ' + PREMIUM_TIERS.season.price + '⭐';
        const kb = [[{ text: trialBtn, callback_data: 'buy_tier_trial' }], [{ text: weeklyBtn, callback_data: 'buy_tier_weekly' }, { text: monthlyBtn, callback_data: 'buy_tier_monthly' }], [{ text: seasonBtn, callback_data: 'buy_tier_season' }], [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]];
        try {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: kb } });
        } catch (e) {
            await ctx.replyWithMarkdown(message, { reply_markup: { inline_keyboard: kb } });
        }
    });

    // Handle tier purchase buttons
    for (const [tierKey, tierData] of Object.entries(PREMIUM_TIERS)) {
        bot.action('buy_tier_' + tierKey, async (ctx) => {
            await ctx.answerCbQuery();
            try {
                const daysLabel = tierData.days >= 9999 ? 'Lifetime' : (tierData.days + ' days');
                await ctx.replyWithInvoice({
                    title: '🌟 iFragment ' + tierData.label,
                    description: daysLabel + ' of premium access:\n\u2022 Unlimited Reports\n\u2022 Priority Queue\n\u2022 Streak Shield\n\u2022 ' + tierData.badge + ' Badge',
                    payload: 'premium_' + tierKey + '_' + ctx.from.id + '_' + Date.now(),
                    currency: 'XTR',
                    prices: [{ label: tierData.label + ' Premium', amount: tierData.price }],
                    provider_token: '',
                });
            } catch (error) {
                console.error('Invoice error:', error);
                await ctx.reply('❌ Error creating invoice. Please try again later.');
            }
        });
    }

    // Pre-checkout query handler
    bot.on('pre_checkout_query', async (ctx) => {
        try {
            await ctx.answerPreCheckoutQuery(true);
        } catch (error) {
            console.error('Pre-checkout error:', error);
            await ctx.answerPreCheckoutQuery(false, 'Payment error. Please try again.');
        }
    });

    // Successful payment handler (with tier detection)
    bot.on('successful_payment', async (ctx) => {
        const userId = ctx.from.id;
        const payment = ctx.message.successful_payment;
        const payload = payment.invoice_payload || '';
        console.log('\ud83d\udcb0 Payment received from user ' + userId + ':', payment);
        try {
            let tier = 'weekly';
            let days = PREMIUM_DAYS;
            for (const [key, data] of Object.entries(PREMIUM_TIERS)) {
                if (payload.includes('premium_' + key + '_')) {
                    tier = key;
                    days = data.days;
                    break;
                }
            }
            const result = activatePremium(userId, days, tier);
            const tierInfo = PREMIUM_TIERS[tier];
            const expiryDate = result.expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            const expiryText = days >= 9999 ? 'Never! 🌟' : expiryDate;
            await ctx.replyWithMarkdown('🎉 *Congratulations!*\n\n' + tierInfo.badge + ' Your *' + tierInfo.label + '* subscription is now active!\n\n━━━━━━━━━━━━━━━━\n\n📅 *Expires:* ' + expiryText + '\n✨ *Features:* Unlimited\n🛡️ *Streak Shield:* Active\n\nEnjoy your premium experience! 💎\n\n━━━━━━━━━━━━━━━━\n\nThank you for your support! 🙏', {
                reply_markup: { inline_keyboard: [[{ text: '🏠 Main Menu', callback_data: 'back_to_menu' }]] }
            });
        } catch (error) {
            console.error('Payment processing error:', error);
            await ctx.reply('✅ Payment received! Your premium will be activated shortly.');
        }
    });

    // ==================== PORTFOLIO REGEX & PAGINATION handlers ====================
    // Moved from bot.entry.js to keep orchestrator clean

    // Portfolio Deep Link / Button Handler
    // Portfolio Deep Link / Button Handler
    bot.action(/^portfolio:(.+)$/, async (ctx) => {
        const walletAddress = ctx.match[1];
        await ctx.answerCbQuery('🔄 Queuing portfolio check...');

        try {
            // Limit Check (Consume Credit)
            const limitCheck = useFeature(ctx.from.id, 'portfolio');
            if (!limitCheck.success) {
                return ctx.reply(formatNoCreditsMessage('portfolio', ctx.from.id), { parse_mode: 'Markdown' });
            }

            const isPremiumUser = await isPremium(ctx.from.id);
            const estimatedWait = jobQueue.getEstimatedWait(null);

            await jobQueue.add({
                type: JOB_TYPES.PORTFOLIO,
                userId: ctx.from.id,
                chatId: ctx.chat.id,
                data: { walletAddress },
                priority: isPremiumUser ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL
            });

            if (estimatedWait > 5) {
                await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, isPremiumUser), { parse_mode: 'Markdown' });
            } else {
                await ctx.reply(`💼 Analyzing portfolio: \`${walletAddress}\``, { parse_mode: 'Markdown' });
            }
        } catch (error) {
            await ctx.reply(`❌ ${error.message}`);
        }
    });

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

}


// ==================== TEXT MESSAGE HANDLER ====================

/**
 * Handle menu text messages (reports, comparison, portfolio).
 * @returns {boolean} true if the message was handled, false otherwise.
 */
export async function handleMenuTextMessage(ctx, state, bot, isAdmin, getTelegramClient) {
    const input = ctx.message.text.trim();
    const chatId = ctx.chat.id;

    // Handle Username Report
    if (state.action === 'username_report') {
        userStates.delete(chatId);
        // Normalize input
        const username = input.replace('@', '');
        await handleGroupCommand(ctx, `!u ${username}`, handleComparison, getTelegramClient);
        return true;
    }

    // Handle Gift Report
    if (state.action === 'gift_report') {
        userStates.delete(chatId);
        await handleGroupCommand(ctx, `!gift ${input}`, handleComparison, getTelegramClient);
        return true;
    }

    // Handle Compare (Step 1 or 2)
    if (state.action === 'compare') {
        if (state.step === 1) {
            // First username received, ask for second
            userStates.set(chatId, {
                action: 'compare',
                step: 2,
                user1: input.replace('@', ''),
                timestamp: Date.now()
            });

            await ctx.replyWithMarkdown(`
✅ *First Username:* \`@${input.replace('@', '')}\`

Now send the *second* username to compare:
`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '❌ Cancel', callback_data: 'cancel_compare' }]
                    ]
                }
            });
            return true;

        } else if (state.step === 2) {
            // Second username received, execute compare

            // Limit Check (Consume Credit)
            const limitCheck = useFeature(ctx.from.id, 'compare');
            if (!limitCheck.success) {
                userStates.delete(chatId);
                return ctx.reply(formatNoCreditsMessage('compare', ctx.from.id), { parse_mode: 'Markdown' });
            }

            userStates.delete(chatId);
            const user1 = state.user1;
            const user2 = input.replace('@', '');

            // Use Job Queue instead of direct call
            try {
                const isPremiumUser = await isPremium(ctx.from.id);
                const jobData = { user1, user2 };
                const estimatedWait = jobQueue.getEstimatedWait(null);

                await jobQueue.add({
                    type: JOB_TYPES.COMPARISON,
                    userId: ctx.from.id,
                    chatId: ctx.chat.id,
                    data: jobData,
                    priority: isPremiumUser ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL
                });

                if (estimatedWait > 5) {
                    await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, isPremiumUser), { parse_mode: 'Markdown' });
                } else {
                    await ctx.reply(`⚔️ Comparing @${user1} vs @${user2}...`);
                }
            } catch (error) {
                await ctx.reply(`❌ ${error.message}`);
            }
            return true;
        }
    }

    // Handle Portfolio
    if (state.action === 'portfolio') {
        userStates.delete(chatId);

        if (input.length > 40 && (input.startsWith('EQ') || input.startsWith('UQ'))) {
            // Limit Check (Consume Credit)
            const limitCheck = useFeature(ctx.from.id, 'portfolio');
            if (!limitCheck.success) {
                return ctx.reply(formatNoCreditsMessage('portfolio', ctx.from.id), { parse_mode: 'Markdown' });
            }

            // Use Job Queue
            try {
                const isPremiumUser = await isPremium(ctx.from.id);
                const estimatedWait = jobQueue.getEstimatedWait(null);

                await jobQueue.add({
                    type: JOB_TYPES.PORTFOLIO,
                    userId: ctx.from.id,
                    chatId: ctx.chat.id,
                    data: { walletAddress: input },
                    priority: isPremiumUser ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL
                });

                if (estimatedWait > 5) {
                    await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, isPremiumUser), { parse_mode: 'Markdown' });
                } else {
                    await ctx.reply(`💼 Analyzing portfolio...`);
                }
            } catch (error) {
                await ctx.reply(`❌ ${error.message}`);
            }
        } else {
            // Assume username - delegate to handleGroupCommand which is already queued
            const username = input.replace('@', '');
            await handleGroupCommand(ctx, `!wallet @${username}`, handleComparison, getTelegramClient);
        }
        return true;
    }

    return false;
}

export default {
    registerMenuHandlers,
    handleMenuTextMessage
};
