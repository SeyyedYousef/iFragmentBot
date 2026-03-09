/**
 * Group Command Handler Module
 * Handles all !command processing in group/supergroup chats.
 * Commands: !gifts, !username, !compare, !wallet, !me
 * Extracted from bot.entry.js to reduce monolith size.
 */

import { tonPriceCache } from '../../Shared/Infra/Cache/cache.service.js';
import { calculateRarity, estimateValue } from '../../core/Config/app.config.js';
import { buildFullCaption, escapeMD } from '../Helpers/report.helper.js';
import { scrapeFragment, generateShortInsight, getTonPrice } from '../../Modules/Market/Infrastructure/fragment.repository.js';
import { generateGiftReport, parseGiftLink, formatNumber } from '../../Modules/Market/Application/marketapp.service.js';
import { generateFlexCard } from '../../Shared/UI/Components/card-generator.component.js';
import { generateFlexCard as generateGiftFlexCard } from '../../Modules/Admin/Application/flex-card.service.js';
import { getOwnerWalletByUsername } from '../../Modules/Market/Application/portfolio.service.js';
import { generateWalletReport } from '../../Modules/Monitoring/Application/wallet-tracker.service.js';
import { useFeature, isPremium, formatCreditsMessage, formatNoCreditsMessage } from '../../Modules/User/Application/user.service.js';
import { Markup } from 'telegraf';
import { jobQueue, JOB_TYPES, formatQueueMessage, PRIORITIES } from '../../Modules/Automation/Application/queue.service.js';

// ==================== TIMEOUT HELPER ====================
const SCRAPE_TIMEOUT_MS = 45000; // 45 seconds max (Aligns better with slow Fragment checks)
const RETRY_DELAY_MS = 2000;

// ==================== CONCURRENCY CONTROL ====================
const processingLocks = new Set();


/**
 * Wrap any promise with a timeout. Prevents the bot from hanging forever.
 */
function withScrapeTimeout(promise, ms = SCRAPE_TIMEOUT_MS, label = 'Operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
        )
    ]);
}

/**
 * Retry a function once on failure with a short delay.
 */
async function withRetryOnce(fn, label = 'Operation') {
    try {
        return await fn();
    } catch (firstError) {
        console.warn(`⚠️ ${label} failed, retrying in ${RETRY_DELAY_MS}ms: ${firstError.message}`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        return await fn(); // Let the second attempt throw if it fails
    }
}

// ==================== SHARED HELPERS ====================

/**
 * Build cardData object for username reports.
 * Used in multiple places — DRY helper.
 */
export function buildUsernameCardData(username, fragmentData, rarity, estValue, insight) {
    return {
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
}

/**
 * Build gift card data from gift report result.
 */
export function buildGiftCardData(result) {
    return {
        collectionName: result.collection,
        itemNumber: result.itemNumber,
        imageUrl: `https://nft.fragment.com/gift/${result.slug.toLowerCase()}-${result.itemNumber}.lottie.json`,
        price: formatNumber(Math.round(result.estimatedValue)),
        verdict: result.verdict || "STANDARD",
        badges: result.badges || [],
        appraiserNote: result.appraiserData?.analysis || "",
        color: result.color
    };
}

// ==================== MAIN HANDLER ====================

/**
 * Handle a group !command.
 * @param {object} ctx - Telegraf context
 * @param {string} input - Raw text input starting with !
 * @param {function} handleComparison - Comparison handler function from main bot
 * @param {function} getTelegramClient - Lazy-loaded telegram client getter
 */
export async function handleGroupCommand(ctx, input, handleComparison, getTelegramClient) {
    const userId = ctx.from.id;
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Prevent duplicate processing
    const lockKey = `${ctx.chat.id}:${command}:${args[0] || 'none'}`;
    if (processingLocks.has(lockKey)) {
        // Silent ignore or ephemeral reply to avoid spam
        return;
    }

    processingLocks.add(lockKey);

    const isValidUser = (u) => /^[a-zA-Z0-9_]{4,32}$/.test(u);

    try {
        // !Gifts <link>
        if (command === '!gifts' || command === '!gift') {
            if (args.length === 0) return ctx.reply('⚠️ Usage: `!Gifts <link>`', { parse_mode: 'Markdown' });

            const link = args[0];
            const parsed = parseGiftLink(link);

            if (!parsed.isValid) {
                return ctx.reply('⚠️ Invalid gift link format.', { parse_mode: 'Markdown' });
            }
            // Check Limits
            const limitCheck = useFeature(userId, 'credits');
            if (!limitCheck.success) {
                return ctx.reply(formatNoCreditsMessage('credits', userId), { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            try {
                // Delegate to Job Queue to prevent memory leaks and handle concurrency
                const tonPrice = tonPriceCache.get('price') || 5.5; // Optimistic price fetch
                const isPremiumUser = await isPremium(userId);

                const jobData = {
                    link,
                    tonPrice
                };

                const position = jobQueue.getPosition(null); // Approximate
                const estimatedWait = jobQueue.getEstimatedWait(null);

                await jobQueue.add({
                    type: JOB_TYPES.GIFT_REPORT,
                    userId,
                    chatId: ctx.chat.id,
                    data: jobData,
                    priority: isPremiumUser ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL,
                    messageId: ctx.message.message_id // Optional: reply to original
                });

                // Reply with queuing status if queue is busy
                if (estimatedWait > 5) {
                    await ctx.reply(formatQueueMessage(position + 1, estimatedWait, isPremiumUser), {
                        parse_mode: 'Markdown',
                        reply_to_message_id: ctx.message.message_id
                    });
                } else {
                    await ctx.reply('🔮 Analyzing gift...', { reply_to_message_id: ctx.message.message_id });
                }

            } catch (error) {
                await ctx.reply(`❌ ${error.message}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // !Username <username>
        else if (command === '!username' || command === '!u') {
            if (args.length === 0) return ctx.reply('⚠️ Usage: `!Username @name`', { parse_mode: 'Markdown' });

            let username = args[0].replace('@', '').toLowerCase();
            if (!isValidUser(username)) return ctx.reply('⚠️ Invalid username format.', { reply_to_message_id: ctx.message.message_id });

            // Check Limits
            const limitCheck = useFeature(userId, 'credits');
            if (!limitCheck.success) {
                return ctx.reply(formatNoCreditsMessage('credits', userId), { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            try {
                // Delegate to Job Queue
                const tonPrice = tonPriceCache.get('price') || 5.5;
                const isPremiumUser = await isPremium(userId);

                const jobData = {
                    username,
                    tonPrice
                };

                const estimatedWait = jobQueue.getEstimatedWait(null);

                await jobQueue.add({
                    type: JOB_TYPES.USERNAME_REPORT,
                    userId,
                    chatId: ctx.chat.id,
                    data: jobData,
                    priority: isPremiumUser ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL,
                    messageId: ctx.message.message_id
                });

                if (estimatedWait > 5) {
                    await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, isPremiumUser), {
                        parse_mode: 'Markdown',
                        reply_to_message_id: ctx.message.message_id
                    });
                } else {
                    await ctx.reply(`🔍 Analyzing @${username}...`, { reply_to_message_id: ctx.message.message_id });
                }

            } catch (error) {
                await ctx.reply(`❌ ${error.message}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // !Compare <user1> <user2>
        else if (command === '!compare' || command === '!c' || command === '!vs') {
            if (args.length < 2) return ctx.reply('⚠️ Usage: `!Compare @user1 @user2`', { parse_mode: 'Markdown' });

            const u1 = args[0].replace('@', '').toLowerCase();
            const u2 = args[1].replace('@', '').toLowerCase();

            if (!isValidUser(u1) || !isValidUser(u2)) return ctx.reply('⚠️ Invalid username format.', { reply_to_message_id: ctx.message.message_id });

            // Check Limits
            const limitCheck = useFeature(userId, 'credits');
            if (!limitCheck.success) {
                return ctx.reply(formatNoCreditsMessage('credits', userId), { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            try {
                const isPremiumUser = await isPremium(userId);
                const jobData = { user1: u1, user2: u2 };

                const estimatedWait = jobQueue.getEstimatedWait(null);

                await jobQueue.add({
                    type: JOB_TYPES.COMPARISON,
                    userId,
                    chatId: ctx.chat.id,
                    data: jobData,
                    priority: isPremiumUser ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL
                });

                if (estimatedWait > 5) {
                    await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, isPremiumUser), {
                        parse_mode: 'Markdown',
                        reply_to_message_id: ctx.message.message_id
                    });
                } else {
                    await ctx.reply(`⚔️ Comparing @${u1} vs @${u2}...`, { reply_to_message_id: ctx.message.message_id });
                }

            } catch (error) {
                await ctx.reply(`❌ ${error.message}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // !Wallet <address|username>
        else if (command === '!wallet' || command === '!w' || command === '!portfolio') {
            if (args.length === 0) return ctx.reply('⚠️ Usage: `!Wallet <address|@username>`', { parse_mode: 'Markdown' });

            let target = args[0];
            let isUser = false;

            // Resolve username if needed
            if (!target.startsWith('UQ') && !target.startsWith('EQ') && target.length < 40) {
                const username = target.replace('@', '').toLowerCase();
                if (isValidUser(username)) {
                    // Try to resolve username to wallet first?
                    // Actually, better to let the job handle it or do it here lightly.
                    // Let's resolve here quickly via TonAPI if possible, or pass username to job if supported.
                    // The job handler expects walletAddress. So we resolve here.

                    await ctx.reply(`🔍 Finding owner of @${username}...`, { reply_to_message_id: ctx.message.message_id });

                    try {
                        const ownerWallet = await getOwnerWalletByUsername(username);
                        if (ownerWallet) {
                            target = ownerWallet;
                            isUser = true;
                        } else {
                            // Fallback to fragment scrape in job? 
                            // No, let's keep it simple. If simple lookup fails, maybe fail or try simple scrape.
                            // For now, let's block if not found to avoid queue spam with invalid names.
                            return ctx.reply(`❌ Could not find owner wallet for @${username}.`, { reply_to_message_id: ctx.message.message_id });
                        }
                    } catch (e) {
                        return ctx.reply(`❌ Error resolving username: ${e.message}`, { reply_to_message_id: ctx.message.message_id });
                    }
                } else {
                    return ctx.reply('⚠️ Invalid wallet address or username.', { reply_to_message_id: ctx.message.message_id });
                }
            }

            // Check Limits
            const limitCheck = useFeature(userId, 'credits');
            if (!limitCheck.success) {
                return ctx.reply(formatNoCreditsMessage('credits', userId), { parse_mode: 'Markdown', reply_to_message_id: ctx.message.message_id });
            }

            try {
                const isPremiumUser = await isPremium(userId);

                const estimatedWait = jobQueue.getEstimatedWait(null);

                await jobQueue.add({
                    type: JOB_TYPES.PORTFOLIO, // Uses WALLET_CHECK or PORTFOLIO
                    userId,
                    chatId: ctx.chat.id,
                    data: { walletAddress: target },
                    priority: isPremiumUser ? PRIORITIES.PREMIUM : PRIORITIES.NORMAL
                });

                if (estimatedWait > 5) {
                    await ctx.reply(formatQueueMessage(jobQueue.getPosition(null) + 1, estimatedWait, isPremiumUser), {
                        parse_mode: 'Markdown',
                        reply_to_message_id: ctx.message.message_id
                    });
                } else {
                    await ctx.reply(`💼 Analyzing portfolio...`, { reply_to_message_id: ctx.message.message_id });
                }

            } catch (error) {
                await ctx.reply(`❌ ${error.message}`, { reply_to_message_id: ctx.message.message_id });
            }
        }

        // !me - Premium Profile Card
        else if (command === '!me') {
            const { getMeCache, saveMeCache } = await import('../../Shared/Infra/Database/mongo.repository.js');
            const cachedData = await getMeCache(userId);
            const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

            if (cachedData && (Date.now() - new Date(cachedData.updatedAt).getTime() < SEVEN_DAYS)) {
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
                const telegramClientService = await getTelegramClient();
                const [giftsData, tonPrice] = await Promise.all([
                    telegramClientService.getUserGiftsWithValue(userId),
                    tonPriceCache.get('price') || await getTonPrice()
                ]);

                if (!giftsData.success) {
                    throw new Error('Could not fetch gift data. Make sure your profile is public.');
                }

                const totalStars = giftsData.totalValue;
                const totalValueUsd = Math.round(totalStars * 0.016);

                const userProfile = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
                let photoUrl = null;
                if (userProfile && userProfile.total_count > 0) {
                    const fileId = userProfile.photos[0][0].file_id;
                    const fileLink = await ctx.telegram.getFileLink(fileId);
                    photoUrl = fileLink.href;
                }

                let crownJewel = { name: 'None', value: 0 };
                if (giftsData.gifts && giftsData.gifts.length > 0) {
                    crownJewel = giftsData.gifts.reduce((prev, current) => (prev.value > current.value) ? prev : current);
                }

                const caption = `
🌟 *THE GILDED COLLECTION* | ${escapeMD(ctx.from.first_name)}

_Your digital empire speaks for itself. A masterpiece of wealth and taste._

━━━━━━━━━━━━━━━━━━━━
🏛 *Net Worth:*  \`${totalValueUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}\`
🏆 *Vault Status:* \`${giftsData.giftCount} Rare Collectibles\`
💎 *Crown Jewel:* \`${crownJewel.name} (~${Math.round(crownJewel.value * 0.016).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})\`
━━━━━━━━━━━━━━━━━━━━

🥂 _"Some collect moments. You collect legends."_

🔐 _Created By @${escapeMD(ctx.botInfo.username)}_
`;

                const { generateProfileCard } = await import('../../Modules/User/Application/me-card.service.js');
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

                if (sentMsg && sentMsg.photo && sentMsg.photo.length > 0) {
                    const fileId = sentMsg.photo[sentMsg.photo.length - 1].file_id;
                    await saveMeCache(userId, {
                        fileId,
                        caption,
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
        try {
            await ctx.reply(`❌ Error processing command: ${e.message}\n\nPlease try again later.`);
        } catch (replyError) {
            console.error('Failed to send error message:', replyError);
        }
    } finally {
        processingLocks.delete(lockKey);
    }
}

// ==================== PORTFOLIO HELPERS (Shared with DM) ====================

/**
 * Handle portfolio lookup by wallet address.
 * Uses walletTrackerService for deep analysis.
 */
export async function handlePortfolioByWallet(ctx, walletAddress) {
    try {
        await generateWalletReport(ctx, walletAddress);

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
            await ctx.replyWithMarkdown(creditsMsg);
        }

    } catch (error) {
        console.error('Portfolio error:', error);
        await ctx.reply('❌ Could not fetch portfolio. Please check the wallet address and try again.');
    }
}

/**
 * Handle portfolio lookup by username (find owner wallet first).
 */
export async function handlePortfolioByUsername(ctx, username) {
    const loadingMsg = await ctx.reply(`🔍 Finding owner of @${username}...`);

    try {
        let ownerWallet = null;

        // Method 1: TonAPI DNS resolution (faster)
        ownerWallet = await getOwnerWalletByUsername(username);

        // Method 2: Fallback to Fragment scraping
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

        await generateWalletReport(ctx, ownerWallet);

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
            await ctx.replyWithMarkdown(creditsMsg);
        }

    } catch (error) {
        console.error('Portfolio by username error:', error);
        try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id); } catch (e) { }
        await ctx.reply('❌ Could not fetch portfolio. Please try again.');
    }
}

export default {
    handleGroupCommand,
    handlePortfolioByWallet,
    handlePortfolioByUsername,
    buildUsernameCardData,
    buildGiftCardData
};
