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
    formatNoCreditsMessage,
    getRemainingLimits,
    getTimeUntilReset,
    getSponsorText
} from '../../Modules/User/Application/user.service.js';
import { handlePortfolioByWallet, handleGroupCommand } from './group.handler.js';
import { handleComparison } from './comparison.handler.js';
import {
    handleUsernamePagination,
    handleGiftPagination,
    handleNumberPagination,
    handleViewUsernames,
    handleViewNumbers,
    handleViewGifts,
    handleOverviewBack
} from '../../Modules/Monitoring/Application/wallet-tracker.service.js';
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
        const limits = getRemainingLimits(userId);
        const resetTime = getTimeUntilReset(userId);

        let accountMessage = `✦ *MY PROFILE*\n`;
        accountMessage += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        accountMessage += `📝 *User Information*\n`;
        accountMessage += `├ 👤 *Name:* ${user.first_name}${user.last_name ? ' ' + user.last_name : ''}\n`;
        accountMessage += `├ 🔗 *Username:* ${user.username ? '@' + user.username : '_Hidden_'}\n`;
        accountMessage += `└ 🪪 *Telegram ID:* \`${userId}\`\n\n`;

        accountMessage += `💳 *Balance & Limits*\n`;
        accountMessage += `├ 🪙 *Current Balance:* \`${limits.credits || 0}\` *FRG*\n`;
        accountMessage += `├ 🎁 *Daily Reward:* +1 FRG\n`;
        accountMessage += `└ ⏳ *Next Reward In:* *${resetTime.formatted}*\n\n`;

        accountMessage += `💎 *How to get more FRG:*\n`;
        accountMessage += `Earn **+300 FRG** by actively participating in the [Fragment Investors](https://t.me/FragmentInvestors) club.\n`;

        const buttons = [
            [{ text: '💸 Transfer FRG', callback_data: 'menu_transfer' }],
            [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
        ];

        try {
            await ctx.editMessageText(accountMessage, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons },
                disable_web_page_preview: true
            });
        } catch (e) {
            await ctx.replyWithMarkdown(accountMessage, {
                reply_markup: { inline_keyboard: buttons },
                disable_web_page_preview: true
            });
        }
    });

    // ==================== TRANSFER FRG ====================

    bot.action('menu_transfer', async (ctx) => {
        await ctx.answerCbQuery();

        userStates.set(ctx.chat.id, {
            action: 'transfer_frg_target',
            timestamp: Date.now()
        });

        const promptText = `
✦ *TRANSFER FRG BALANCE*
━━━━━━━━━━━━━━━━━━━━━

You can securely transfer your FRG balance to another user\\.

✧ *Recipient details:*
💬 _Please send the exact @username or Telegram User ID of the recipient:_
`;

        try {
            await ctx.editMessageText(promptText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'back_to_menu' }]]
                }
            });
        } catch (e) {
            await ctx.replyWithMarkdown(promptText, {
                reply_markup: {
                    inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'back_to_menu' }]]
                }
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
✦ *USERNAME SCANNER*
━━━━━━━━━━━━━━━━━━━━━

Our system will fetch and analyze the value of any Telegram username\\.

├ 💵 *Estimated Live Market Value*
├ 🧠 *AI\\-Driven Price Prediction*
├ 🧬 *Linguistic Quality Tier*
└ 📊 *Historical Market Trends*

✧ *Ready to scan:*
💬 _Please send any Telegram @username to begin:_
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
✦ *GIFT VALUATION SCANNER*
━━━━━━━━━━━━━━━━━━━━━

Instantly analyze the true market value of any Telegram Gift using multi\\-market data\\.

├ 🏦 *Multi\\-Market Floor Prices*
├ 🧬 *Calculated Rarity & Attribute Stats*
├ 📈 *Live Sales Dynamics*
└ 💎 *Deep AI Real\\-Time Valuation*

📌 Example: \`https://t.me/nft/PlushPepe-1\`

✧ *Ready to analyze:*
💬 _Please send the link of the NFT Gift below:_
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

    // ==================== ANONYMOUS NUMBERS (+888) ====================

    bot.action('report_numbers', async (ctx) => {
        await ctx.answerCbQuery();
        userStates.set(ctx.chat.id, {
            action: 'number_report',
            timestamp: Date.now()
        });

        const promptText = `
✦ *+888 ANONYMOUS NUMBERS*
━━━━━━━━━━━━━━━━━━━━━

Analyze collectible anonymous numbers from Fragment\\.

📌 Example: \`https://fragment.com/number/8881234567890\`
📌 Or: \`+8881234567890\`

✧ *Ready to analyze:*
💬 _Please send the number link or +888 number below:_
`;

        try {
            await ctx.editMessageText(promptText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '❌ Cancel', callback_data: 'cancel_number_report' }]
                    ]
                }
            });
        } catch (e) {
            await ctx.replyWithMarkdown(promptText, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '❌ Cancel', callback_data: 'cancel_number_report' }]
                    ]
                }
            });
        }
    });

    // ==================== CANCEL REPORT HANDLERS ====================

    const reportCancelMenu = `
✦ *OPERATION CANCELLED*
━━━━━━━━━━━━━━━━━━━━━

You have cancelled the current operation and returned to the menu\\.

├ 👤 *Username Scan* — Analyze username prices
├ 🎁 *Gift Valuation* — Check gift NFT values
└ 🏴‍☠️ *\\+888 Numbers* — Analyze anonymous numbers

✧ _Please select a service below to continue:_
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

    bot.action('cancel_number_report', async (ctx) => {
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
✦ *COMPARE USERNAMES*
━━━━━━━━━━━━━━━━━━━━━

Compare two different Telegram usernames to see which one holds more market value\\.

├ 💵 *Detailed Price Comparison*
├ 🧬 *Rarity & Quality Matchup*
└ 🏆 *Algorithmic Winner Selection*

✧ *Let's begin the comparison:*
💬 _Step 1 — Send the first @username:_
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
✦ *WALLET TRACKER & PORTFOLIO*
━━━━━━━━━━━━━━━━━━━━━

Scan any Telegram user or TON wallet to view their complete Fragment portfolio\\.

├ 💎 *Archived Usernames*
├ 🏴‍☠️ *Anonymous \\+888 Numbers*
├ 🎁 *Telegram Gifts Collection*
└ 📊 *Total Estimated Net Worth*

✧ *Ready to track:*
💬 _Please send the TON wallet address or @username:_
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

            const estimatedWait = jobQueue.getEstimatedWait(null);

            await jobQueue.add({
                type: JOB_TYPES.PORTFOLIO,
                userId: ctx.from.id,
                chatId: ctx.chat.id,
                data: { walletAddress },
                priority: PRIORITIES.NORMAL
            });

            if (estimatedWait > 5) {
                await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, false), { parse_mode: 'Markdown' });
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

    // Handle View Detail Lists
    bot.action('wt_view_user', async (ctx) => {
        const { handleViewUsernames } = await import('../../Modules/Monitoring/Application/wallet-tracker.service.js');
        await handleViewUsernames(ctx);
        await ctx.answerCbQuery();
    });

    bot.action('wt_view_num', async (ctx) => {
        const { handleViewNumbers } = await import('../../Modules/Monitoring/Application/wallet-tracker.service.js');
        await handleViewNumbers(ctx);
        await ctx.answerCbQuery();
    });

    bot.action('wt_view_gift', async (ctx) => {
        const { handleViewGifts } = await import('../../Modules/Monitoring/Application/wallet-tracker.service.js');
        await handleViewGifts(ctx);
        await ctx.answerCbQuery();
    });

    // New: Handle Specific Gift Detail View
    bot.action(/wt_gift_det_(\d+)/, async (ctx) => {
        const index = parseInt(ctx.match[1]);
        try {
            const { handleGiftDetail } = await import('../../Modules/Monitoring/Application/wallet-tracker.service.js');
            await handleGiftDetail(ctx, index);
            await ctx.answerCbQuery();
        } catch (e) {
            console.error('Gift detail error:', e);
            await ctx.answerCbQuery('⚠️ Error loading details');
        }
    });

    bot.action('wt_overview', async (ctx) => {
        const { handleOverviewBack } = await import('../../Modules/Monitoring/Application/wallet-tracker.service.js');
        await handleOverviewBack(ctx);
        await ctx.answerCbQuery();
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

    // Handle Number Report
    if (state.action === 'number_report') {
        userStates.delete(chatId);
        await handleGroupCommand(ctx, `!number ${input}`, handleComparison, getTelegramClient);
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
✅ *First username saved:* \`@${input.replace('@', '')}\`

━━━━━━━━━━━━━━━━━━━━━
💬 *Step 2: Now send the second @username to compare with:*
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
                const jobData = { user1, user2 };
                const estimatedWait = jobQueue.getEstimatedWait(null);

                await jobQueue.add({
                    type: JOB_TYPES.COMPARISON,
                    userId: ctx.from.id,
                    chatId: ctx.chat.id,
                    data: jobData,
                    priority: PRIORITIES.NORMAL
                });

                if (estimatedWait > 5) {
                    await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, false), { parse_mode: 'Markdown' });
                } else {
                    await ctx.reply(`⚔️ Comparing @${user1} vs @${user2}...`);
                }
            } catch (error) {
                await ctx.reply(`❌ ${error.message}`);
            }
            return true;
        }
    }

    // Handle Portfolio / Wallet Tracker
    if (state.action === 'portfolio') {
        userStates.delete(chatId);

        // Limit Check (Consume Credit)
        const limitCheck = useFeature(ctx.from.id, 'portfolio');
        if (!limitCheck.success) {
            return ctx.reply(formatNoCreditsMessage('portfolio', ctx.from.id), { parse_mode: 'Markdown' });
        }

        let walletAddress = input.trim();
        const isWalletFormat = walletAddress.startsWith('UQ') || walletAddress.startsWith('EQ') || walletAddress.length >= 40;

        if (!isWalletFormat) {
            // User sent a @username — resolve to wallet
            const username = walletAddress.replace('@', '').toLowerCase();
            if (!/^[a-zA-Z0-9_]{4,32}$/.test(username)) {
                await ctx.reply('❌ Invalid wallet address or username format. Please try again.');
                return true;
            }

            const loadingMsg = await ctx.reply(`🔍 Finding wallet for @${username}...`);

            try {
                const { getOwnerWalletByUsername } = await import('../../Modules/Market/Application/portfolio.service.js');
                const ownerWallet = await getOwnerWalletByUsername(username);
                if (!ownerWallet) {
                    try { await ctx.telegram.deleteMessage(chatId, loadingMsg.message_id); } catch (e) {}
                    await ctx.reply(`❌ Could not find owner wallet for @${username}.\n\nThis username may be:\n• Available for purchase\n• Not assigned to a wallet\n• Owner info not public`, {
                        reply_markup: {
                            inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]]
                        }
                    });
                    return true;
                }
                walletAddress = ownerWallet;
                try { await ctx.telegram.deleteMessage(chatId, loadingMsg.message_id); } catch (e) {}
            } catch (e) {
                try { await ctx.telegram.deleteMessage(chatId, loadingMsg.message_id); } catch (e2) {}
                await ctx.reply(`❌ Error resolving username: ${e.message}`, {
                    reply_markup: {
                        inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]]
                    }
                });
                return true;
            }
        }

        // Queue the portfolio job
        try {
            const estimatedWait = jobQueue.getEstimatedWait(null);

            await jobQueue.add({
                type: JOB_TYPES.PORTFOLIO,
                userId: ctx.from.id,
                chatId: ctx.chat.id,
                data: { walletAddress },
                priority: PRIORITIES.NORMAL
            });

            if (estimatedWait > 5) {
                await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, false), { parse_mode: 'Markdown' });
            } else {
                await ctx.reply(`💼 Analyzing portfolio for \`${walletAddress.substring(0, 8)}...${walletAddress.slice(-6)}\``, { parse_mode: 'Markdown' });
            }
        } catch (error) {
            await ctx.reply(`❌ ${error.message}`);
        }
        return true;
    }
    if (state.action === 'transfer_frg_target') {
        const target = input.replace('@', '');
        userStates.set(chatId, {
            action: 'transfer_frg_amount',
            target: target,
            timestamp: Date.now()
        });

        await ctx.replyWithMarkdown(`✅ *Target Secured:* \`${target}\`\n\n━━━━━━━━━━━━━━━━━━━━━\n💬 *Enter the exact amount of FRG you wish to transmit (e.g., 50):*`, {
            reply_markup: {
                inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'back_to_menu' }]]
            }
        });
        return true;
    }

    // Handle Transfer FRG (Amount)
    if (state.action === 'transfer_frg_amount') {
        const amount = parseInt(input);
        if (isNaN(amount) || amount <= 0) {
            await ctx.reply('❌ Please enter a valid positive number.');
            return true;
        }

        const target = state.target;
        userStates.delete(chatId);

        try {
            // Find target userId by username if target is not numeric
            let targetId = target;
            if (isNaN(parseInt(target))) {
                const allUsers = getAllUsers();
                const found = allUsers.find(u => u.username?.toLowerCase() === target.toLowerCase());
                if (!found) throw new Error("Could not find a user with that username in my database. They must have used the bot at least once.");
                targetId = found.id;
            }

            const { transferFrgCredits } = await import('../../Modules/User/Application/user.service.js');
            const result = await transferFrgCredits(ctx.from.id, targetId, amount);

            await ctx.replyWithMarkdown(`✅ *Transfer Successful!*\n\n💰 Sent: \`${amount} FRG\`\n👤 To: \`${target}\`\n📉 Your balance: \`${result.senderBalance} FRG\``);

            // Notify receiver if possible
            try {
                await bot.telegram.sendMessage(targetId, `🎊 *You received FRG!*\n\n👤 From: \`${ctx.from.username || ctx.from.id}\`\n💰 Amount: \`+${amount} FRG\`\n\nUse it now for detailed reports!`, { parse_mode: 'Markdown' });
            } catch (notifyErr) { /* ignore */ }

        } catch (err) {
            await ctx.reply(`❌ Transfer failed: ${err.message}`);
        }
        return true;
    }

    return false;
}

export default {
    registerMenuHandlers,
    handleMenuTextMessage
};
