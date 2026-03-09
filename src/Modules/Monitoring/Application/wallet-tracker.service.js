
import { Markup } from 'telegraf';
import { getPortfolio } from '../../Market/Application/portfolio.service.js';
import * as telegramClient from '../../../Shared/Infra/Telegram/telegram.client.js';

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
        // MESSAGE 4: ENHANCED PORTFOLIO ANALYSIS
        // ======================================================

        const totalAssets = portfolio.totalUsernames + portfolio.totalNumbers + totalGifts;
        const uCount = portfolio.totalUsernames;
        const nCount = portfolio.totalNumbers;
        const gCount = totalGifts;

        // ===== WHALE RANK =====
        let whaleRank = '🦐 Shrimp';
        if (totalAssets > 500) whaleRank = '🐋 MEGA WHALE';
        else if (totalAssets > 200) whaleRank = '🐋 Whale';
        else if (totalAssets > 100) whaleRank = '🦈 Shark';
        else if (totalAssets > 50) whaleRank = '🐬 Dolphin';
        else if (totalAssets > 20) whaleRank = '🦀 Crab';
        else if (totalAssets > 5) whaleRank = '🐟 Fish';

        // ===== DISTRIBUTION BAR =====
        const total = Math.max(totalAssets, 1);
        const uPct = Math.round((uCount / total) * 100);
        const nPct = Math.round((nCount / total) * 100);
        const gPct = Math.round((gCount / total) * 100);

        const makeBar = (pct) => {
            const filled = Math.round(pct / 10);
            return '█'.repeat(filled) + '░'.repeat(10 - filled);
        };

        const distributionBar = totalAssets > 0 ? `
📊 *Distribution:*
\`${makeBar(uPct)}\` 💎 ${uPct}%
\`${makeBar(nPct)}\` 📱 ${nPct}%
\`${makeBar(gPct)}\` 🎁 ${gPct}%` : '';

        // ===== COLLECTOR BADGES =====
        const badges = [];

        // Check for 4-char username
        const has4Char = portfolio.usernames.some(u => u.name.length <= 4);
        if (has4Char) badges.push('🎖️ 4-Char Owner');

        // Check for 5-char username
        const has5Char = portfolio.usernames.some(u => u.name.length === 5);
        if (has5Char && !has4Char) badges.push('💠 5-Char Owner');

        // Number hoarder
        if (nCount >= 10) badges.push('📱 Number Hoarder');
        else if (nCount >= 5) badges.push('📞 Number Collector');

        // Username collector
        if (uCount >= 50) badges.push('💎 Username Legend');
        else if (uCount >= 20) badges.push('💎 Username Master');
        else if (uCount >= 10) badges.push('💎 Username Hunter');

        // Gift enthusiast
        if (gCount >= 20) badges.push('🎁 Gift King');
        else if (gCount >= 10) badges.push('🎁 Gift Lover');

        // Whale badge
        if (totalAssets >= 100) badges.push('🐋 Big Player');

        // Diversified
        if (uCount > 0 && nCount > 0 && gCount > 0) badges.push('🌈 Diversified');

        const badgesText = badges.length > 0
            ? `\n\n🏆 *Badges:*\n${badges.join(' • ')}`
            : '';

        // ===== CROWN JEWEL =====
        let crownJewel = '';
        if (portfolio.usernames.length > 0) {
            const shortest = portfolio.usernames.reduce((prev, curr) =>
                curr.name.length < prev.name.length ? curr : prev
            );
            const stars = shortest.name.length <= 4 ? '⭐⭐⭐' :
                shortest.name.length <= 5 ? '⭐⭐' : '⭐';
            crownJewel = `\n\n👑 *Crown Jewel:* @${shortest.name.replace(/_/g, '\\_')} (${shortest.name.length} chars) ${stars}`;
        }

        // ===== PREMIUM ASSETS LIST =====
        let premiumList = '';
        const premium4Chars = portfolio.usernames.filter(u => u.name.length <= 4).slice(0, 3);
        const premium5Chars = portfolio.usernames.filter(u => u.name.length === 5).slice(0, 3);

        if (premium4Chars.length > 0 || premium5Chars.length > 0) {
            premiumList = '\n\n💎 *Premium Assets:*';
            if (premium4Chars.length > 0) {
                premiumList += `\n   4-char: ${premium4Chars.map(u => '@' + u.name.replace(/_/g, '\\_')).join(', ')}`;
            }
            if (premium5Chars.length > 0) {
                premiumList += `\n   5-char: ${premium5Chars.map(u => '@' + u.name.replace(/_/g, '\\_')).join(', ')}`;
            }
        }

        // ===== BUILD FINAL MESSAGE =====
        const overviewMsg = `
🏦 *Portfolio Analysis*
━━━━━━━━━━━━━━━━━━

${whaleRank}
${distributionBar}

📦 *Assets:*
• 💎 Usernames: ${formatNum(uCount)}
• 📱 Numbers: ${formatNum(nCount)}
• 🎁 Gifts: ${formatNum(gCount)}
• � *Total:* ${formatNum(totalAssets)}${badgesText}${crownJewel}${premiumList}

🔗 \`${walletAddress.substring(0, 8)}...${walletAddress.slice(-6)}\`

━━━━━━━━━━━━━━━━━━
📢 @FragmentsCommunity
`;

        await ctx.replyWithMarkdown(overviewMsg, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔗 TonViewer', url: `https://tonviewer.com/${walletAddress}` },
                        { text: '💎 Fragment', url: `https://fragment.com/?query=${walletAddress}` }
                    ],
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
