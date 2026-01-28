
import { Markup } from 'telegraf';
import { getPortfolio } from './portfolioService.js';
import * as telegramClient from './telegramClientService.js';

// Utility format number
const formatNum = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
};

// Pagination settings
const ITEMS_PER_PAGE = 40;

// Store pagination data temporarily (wallet -> data)
const paginationCache = new Map();

/**
 * Generate and send the 4-part Wallet Report with pagination
 */
export async function generateWalletReport(ctx, walletAddress) {
    const loadingMsg = await ctx.reply('🔍 Scanning wallet...');

    try {
        let portfolio = await getPortfolio(walletAddress);

        if (!portfolio || portfolio.error) {
            await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => { });
            await ctx.reply('❌ Failed to fetch portfolio. Please try again.');
            return;
        }

        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => { });

        const totalGifts = portfolio.totalGifts || 0;
        const gifts = portfolio.gifts || [];

        // Store portfolio for pagination
        const cacheKey = `${ctx.chat.id}`;
        paginationCache.set(cacheKey, {
            portfolio,
            walletAddress,
            timestamp: Date.now()
        });

        // ======================================================
        // MESSAGE 1: USERNAMES (Page 1)
        // ======================================================

        const msg1 = await ctx.reply(`💎 *Scanning ${portfolio.usernames.length} Usernames...*`, { parse_mode: 'Markdown' });

        // Check activity for first batch
        const USERNAMES_TO_CHECK = portfolio.usernames.slice(0, 20);
        const usernameStatuses = [];

        for (const u of portfolio.usernames) {
            let status = '';
            if (USERNAMES_TO_CHECK.includes(u)) {
                const check = await telegramClient.checkUsername(u.name);
                status = check.active ? ' ✅' : ' 💤';
            }
            usernameStatuses.push(status);
        }

        // Store statuses for pagination
        paginationCache.get(cacheKey).usernameStatuses = usernameStatuses;

        const usernameMsg = formatUsernamesPage(portfolio.usernames, usernameStatuses, 0);
        const usernameKeyboard = getUsernamesKeyboard(portfolio.usernames.length, 0);

        await ctx.telegram.editMessageText(ctx.chat.id, msg1.message_id, undefined, usernameMsg.text, {
            parse_mode: 'Markdown',
            reply_markup: usernameKeyboard
        }).catch(async () => {
            await ctx.replyWithMarkdown(usernameMsg.text, { reply_markup: usernameKeyboard });
        });

        // ======================================================
        // MESSAGE 2: ANONYMOUS NUMBERS (Page 1)
        // ======================================================

        const msg2 = await ctx.reply(`📱 *Checking ${portfolio.anonymousNumbers.length} Numbers...*`, { parse_mode: 'Markdown' });

        const NUMBERS_TO_CHECK = portfolio.anonymousNumbers.slice(0, 5);
        const numberStatuses = [];

        for (const n of portfolio.anonymousNumbers) {
            let status = '';
            if (NUMBERS_TO_CHECK.includes(n)) {
                const check = await telegramClient.checkPhoneNumber(n.number);
                status = check.registered ? ' 🟢' : ' ⚫';
            }
            numberStatuses.push(status);
        }

        paginationCache.get(cacheKey).numberStatuses = numberStatuses;

        const numberMsg = formatNumbersPage(portfolio.anonymousNumbers, numberStatuses, 0);
        const numberKeyboard = getNumbersKeyboard(portfolio.anonymousNumbers.length, 0);

        await ctx.telegram.editMessageText(ctx.chat.id, msg2.message_id, undefined, numberMsg.text, {
            parse_mode: 'Markdown',
            reply_markup: numberKeyboard
        }).catch(async () => {
            await ctx.replyWithMarkdown(numberMsg.text, { reply_markup: numberKeyboard });
        });

        // ======================================================
        // MESSAGE 3: NFT GIFTS (Page 1)
        // ======================================================

        const msg3 = await ctx.reply(`🎁 *Loading Gifts...*`, { parse_mode: 'Markdown' });

        const giftMsg = formatGiftsPage(gifts, 0);
        const giftKeyboard = getGiftsKeyboard(gifts.length, 0);

        await ctx.telegram.editMessageText(ctx.chat.id, msg3.message_id, undefined, giftMsg.text, {
            parse_mode: 'Markdown',
            reply_markup: giftKeyboard
        }).catch(async () => {
            await ctx.replyWithMarkdown(giftMsg.text, { reply_markup: giftKeyboard });
        });

        // ======================================================
        // MESSAGE 4: STRATEGIC OVERVIEW
        // ======================================================

        const totalAssets = portfolio.totalUsernames + portfolio.totalNumbers + totalGifts;

        let highlight = '';
        if (portfolio.usernames.length > 0) {
            const shortest = portfolio.usernames.reduce((prev, curr) =>
                curr.name.length < prev.name.length ? curr : prev
            );
            highlight = `\n\n👑 *Crown Jewel:* @${shortest.name} (${shortest.name.length} chars)`;
        }

        let walletType = '🔹 Empty Wallet';
        if (portfolio.totalUsernames > 10) walletType = '💎 Username Collector';
        else if (portfolio.totalNumbers > 5) walletType = '🔐 Privacy Holder';
        else if (totalGifts > 10) walletType = '🎁 Gift Enthusiast';
        else if (totalAssets > 5) walletType = '📦 Mixed Portfolio';
        else if (totalAssets > 0) walletType = '🌱 Starter Wallet';

        const overviewMsg = `
📊 *Portfolio Summary*
━━━━━━━━━━━━━━━━

*Assets Breakdown:*
💎 Usernames: ${portfolio.totalUsernames}
📱 Numbers: ${portfolio.totalNumbers}
🎁 Gifts: ${totalGifts}
📦 *Total Assets:* ${totalAssets}

🏷️ *Wallet Type:* ${walletType}${highlight}

🔗 \`${walletAddress.substring(0, 8)}...${walletAddress.slice(-6)}\`
`;

        await ctx.replyWithMarkdown(overviewMsg, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 View on TonViewer', url: `https://tonviewer.com/${walletAddress}` }],
                    [{ text: '🔙 Main Menu', callback_data: 'back_to_menu' }]
                ]
            }
        });

    } catch (error) {
        console.error('Wallet Report Error:', error);
        await ctx.reply(`❌ Error generating report: ${error.message}`);
    }
}

// ======================================================
// FORMATTING FUNCTIONS
// ======================================================

function formatUsernamesPage(usernames, statuses, page) {
    const total = usernames.length;
    const start = page * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, total);
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    let text = `💎 *Telegram Usernames* (${total})\n`;
    text += `━━━━━━━━━━━━━━━━\n\n`;

    if (total === 0) {
        text += '_No usernames found in this wallet._';
        return { text };
    }

    const pageItems = usernames.slice(start, end);
    pageItems.forEach((u, i) => {
        const globalIndex = start + i + 1;
        const status = statuses[start + i] || '';
        text += `${globalIndex}. @${u.name.replace(/_/g, '\\_')}${status}\n`;
    });

    if (totalPages > 1) {
        text += `\n📄 _Page ${page + 1}/${totalPages}_`;
    }

    text += `\n\n_✅ = Active | 💤 = Not in use_`;

    return { text };
}

function formatNumbersPage(numbers, statuses, page) {
    const total = numbers.length;
    const start = page * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, total);
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    let text = `📱 *Anonymous Numbers (+888)* (${total})\n`;
    text += `━━━━━━━━━━━━━━━━\n\n`;

    if (total === 0) {
        text += '_No anonymous numbers found._';
        return { text };
    }

    const pageItems = numbers.slice(start, end);
    pageItems.forEach((n, i) => {
        const globalIndex = start + i + 1;
        const status = statuses[start + i] || '';
        text += `${globalIndex}. \`${n.number}\`${status}\n`;
    });

    if (totalPages > 1) {
        text += `\n📄 _Page ${page + 1}/${totalPages}_`;
    }

    text += `\n\n_🟢 = Registered | ⚫ = Not Active_`;

    return { text };
}

function formatGiftsPage(gifts, page) {
    const total = gifts.length;
    const totalCount = gifts.reduce((sum, g) => sum + (g.count || 1), 0);
    const start = page * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, total);
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    let text = `🎁 *Official Telegram Gifts* (${totalCount})\n`;
    text += `━━━━━━━━━━━━━━━━\n\n`;

    if (total === 0) {
        text += '_No official Telegram gifts found._';
        return { text };
    }

    const pageItems = gifts.slice(start, end);
    pageItems.forEach((g, i) => {
        const globalIndex = start + i + 1;
        const countText = g.count > 1 ? ` ×${g.count}` : '';
        text += `${globalIndex}. ${g.collection || g.name}${countText}\n`;
    });

    if (totalPages > 1) {
        text += `\n📄 _Page ${page + 1}/${totalPages}_`;
    }

    return { text };
}

// ======================================================
// KEYBOARD FUNCTIONS (with pagination buttons)
// ======================================================

function getUsernamesKeyboard(total, page) {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    if (totalPages <= 1) return undefined;

    const buttons = [];
    if (page > 0) {
        buttons.push({ text: '◀️ Prev', callback_data: `wt_user_${page - 1}` });
    }
    if (page < totalPages - 1) {
        buttons.push({ text: 'Next ▶️', callback_data: `wt_user_${page + 1}` });
    }

    return { inline_keyboard: [buttons] };
}

function getNumbersKeyboard(total, page) {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    if (totalPages <= 1) return undefined;

    const buttons = [];
    if (page > 0) {
        buttons.push({ text: '◀️ Prev', callback_data: `wt_num_${page - 1}` });
    }
    if (page < totalPages - 1) {
        buttons.push({ text: 'Next ▶️', callback_data: `wt_num_${page + 1}` });
    }

    return { inline_keyboard: [buttons] };
}

function getGiftsKeyboard(total, page) {
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    if (totalPages <= 1) return undefined;

    const buttons = [];
    if (page > 0) {
        buttons.push({ text: '◀️ Prev', callback_data: `wt_gift_${page - 1}` });
    }
    if (page < totalPages - 1) {
        buttons.push({ text: 'Next ▶️', callback_data: `wt_gift_${page + 1}` });
    }

    return { inline_keyboard: [buttons] };
}

// ======================================================
// PAGINATION HANDLERS (to be called from bot.js)
// ======================================================

export function handleUsernamePagination(ctx, page) {
    const cacheKey = `${ctx.chat.id}`;
    const cached = paginationCache.get(cacheKey);

    if (!cached) {
        return ctx.answerCbQuery('⚠️ Session expired. Please scan again.');
    }

    const { portfolio, usernameStatuses } = cached;
    const msg = formatUsernamesPage(portfolio.usernames, usernameStatuses || [], page);
    const keyboard = getUsernamesKeyboard(portfolio.usernames.length, page);

    return ctx.editMessageText(msg.text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

export function handleNumberPagination(ctx, page) {
    const cacheKey = `${ctx.chat.id}`;
    const cached = paginationCache.get(cacheKey);

    if (!cached) {
        return ctx.answerCbQuery('⚠️ Session expired. Please scan again.');
    }

    const { portfolio, numberStatuses } = cached;
    const msg = formatNumbersPage(portfolio.anonymousNumbers, numberStatuses || [], page);
    const keyboard = getNumbersKeyboard(portfolio.anonymousNumbers.length, page);

    return ctx.editMessageText(msg.text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

export function handleGiftPagination(ctx, page) {
    const cacheKey = `${ctx.chat.id}`;
    const cached = paginationCache.get(cacheKey);

    if (!cached) {
        return ctx.answerCbQuery('⚠️ Session expired. Please scan again.');
    }

    const { portfolio } = cached;
    const gifts = portfolio.gifts || [];
    const msg = formatGiftsPage(gifts, page);
    const keyboard = getGiftsKeyboard(gifts.length, page);

    return ctx.editMessageText(msg.text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
    });
}

// Cleanup old cache entries (older than 30 minutes)
setInterval(() => {
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;
    for (const [key, value] of paginationCache.entries()) {
        if (now - value.timestamp > THIRTY_MINUTES) {
            paginationCache.delete(key);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes
