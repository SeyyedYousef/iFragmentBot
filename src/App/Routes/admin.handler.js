/**
 * Admin Handler Module
 * Handles all admin panel actions, stats, system info,
 * broadcast, block/unblock, premium, news, and sponsor editing.
 * Extracted from bot.entry.js to reduce monolith size.
 */

import { userStates, getStateStats } from '../../Shared/Infra/State/state.service.js';
import { getPoolStats, getTonPrice } from '../../Modules/Market/Infrastructure/fragment.repository.js';
import { getLimiterStats } from '../../Shared/Infra/Network/rate-limiter.service.js';
import { getAllCacheStats } from '../../Shared/Infra/Cache/cache.service.js';
import { getGiftStats, get888Stats } from '../../Modules/Market/Application/market.service.js';
import { generateNewsCard, generateNewsCard2, generateMarketCard } from '../../Shared/UI/Components/card-generator.component.js';
import giftAssetAPI from '../../Modules/Market/Infrastructure/gift_asset.api.js';
import * as seetgAPI from '../../Modules/Automation/Application/seetg.service.js';
import apifyAPI from '../../Modules/Market/Infrastructure/apify.api.js';
import {
    getStats,
    getAllUsers,
    blockUser,
    unblockUser,
    setSponsorText,
    formatCreditsMessage,
    addFrgCredits
} from '../../Modules/User/Application/user.service.js';

// ==================== REGISTER HANDLERS ====================

export function registerAdminHandlers(bot, isAdmin) {

    // /panel command - Admin only
    // /panel command removed to prevent conflict with panel.handler.js
    // All panel logic is now centralized in panel.handler.js

    // ==================== ADMIN STATS ====================

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
• Active: ${stats.totalUsers - stats.blockedUsers}
• Blocked: ${stats.blockedUsers} 🚫

⏰ _Updated: ${new Date().toLocaleString()}_
`);
    });

    // ==================== ADMIN SYSTEM ====================

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

    // ==================== BROADCAST ====================

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

    // ==================== BLOCK / UNBLOCK / PREMIUM ====================

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

    // admin_premium handler removed - managed in panel.handler.js

    // ==================== NEWS POSTS ====================

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

    // ==================== EDIT SPONSOR ====================

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

    // ==================== MARKET STATS ====================

    // admin_market_stats handler removed - managed in panel.handler.js

    // ==================== ADVANCED AI ====================

    bot.action('admin_advanced', async (ctx) => {
        if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('❌ Access denied');
        await ctx.answerCbQuery();

        await ctx.replyWithMarkdown(`
🚀 *Advanced AI Settings*

Capabilities:
• 🧠 Model Training (Coming Soon)
• 🤖 Auto-Response Tuning
• 📊 Deep Analytics

_This module is currently under development._
`);
    });
}

// ==================== TEXT MESSAGE HANDLERS ====================

/**
 * Handle admin text messages (broadcast, block, unblock, premium, news, sponsor).
 * @returns {boolean} true if the message was handled, false otherwise.
 */
export async function handleAdminTextMessage(ctx, state, bot, isAdmin) {
    const chatId = ctx.chat.id;
    const input = ctx.message.text.trim();

    // Handle admin broadcast
    if (state.action === 'admin_broadcast' && isAdmin(ctx.from.id)) {
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
            await new Promise(r => setTimeout(r, 50));
        }

        await ctx.telegram.editMessageText(
            chatId,
            statusMsg.message_id,
            null,
            `✅ Broadcast complete!\n\n• Success: ${successCount}\n• Failed: ${failCount}`
        );
        return true;
    }

    // Handle admin block
    if (state.action === 'admin_block' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const targetId = input;
        if (!/^\d+$/.test(targetId)) {
            await ctx.reply('❌ Invalid user ID. Please send a numeric ID.');
            return true;
        }

        blockUser(targetId);
        await ctx.reply(`🚫 User ${targetId} has been blocked.`);
        return true;
    }

    // Handle admin unblock
    if (state.action === 'admin_unblock' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const targetId = input;
        if (!/^\d+$/.test(targetId)) {
            await ctx.reply('❌ Invalid user ID. Please send a numeric ID.');
            return true;
        }

        unblockUser(targetId);
        await ctx.reply(`✅ User ${targetId} has been unblocked.`);
        return true;
    }

    // Handle admin add credits
    if (state.action === 'admin_add_frg' && isAdmin(ctx.from.id)) {
        const parts = input.split(/\s+/);
        if (parts.length !== 2) {
            await ctx.reply('❌ Invalid format. Use: user_id amount\nExample: 123456789 10');
            return true;
        }

        const [targetId, amountStr] = parts;
        const amount = parseInt(amountStr);

        if (!/^\d+$/.test(targetId) || isNaN(amount) || amount < 1) {
            await ctx.reply('❌ Invalid format. User ID must be numeric and amount must be positive.');
            return true;
        }

        userStates.delete(chatId);

        const newBalance = addFrgCredits(targetId, amount, "Admin Gift");

        await ctx.reply(`🪙 *Credits Added!*
        
👤 *User:* \`${targetId}\`
💰 *Amount:* \`${amount} FRG\`
📈 *New Balance:* \`${newBalance} FRG\``, { parse_mode: 'Markdown' });

        // Notify the user
        try {
            await bot.telegram.sendMessage(targetId, `
🎁 *You received FRG Credits!*

The admin has gifted you **${amount} FRG Credits**.

💰 New Balance: **${newBalance} FRG**
🚀 Use it now for detailed reports!
`, { parse_mode: 'Markdown' });
        } catch (e) {
            // User may have blocked the bot
        }
        return true;
    }

    // Handle admin remove credits
    if (state.action === 'admin_remove_frg' && isAdmin(ctx.from.id)) {
        const parts = input.split(/\s+/);
        if (parts.length !== 2) {
            await ctx.reply('❌ Invalid format. Use: user_id amount\nExample: 123456789 20');
            return true;
        }

        const [targetId, amountStr] = parts;
        const amount = parseInt(amountStr);

        if (!/^\d+$/.test(targetId) || isNaN(amount) || amount < 1) {
            await ctx.reply('❌ Invalid format. User ID must be numeric and amount must be positive.');
            return true;
        }

        userStates.delete(chatId);

        // We use addFrgCredits with negative amount 
        const { addFrgCredits } = await import('../../Modules/User/Application/user.service.js');
        const newBalance = await addFrgCredits(targetId, -amount, "Admin Removal");

        await ctx.reply(`📉 *Credits Removed!*
        
👤 *User:* \`${targetId}\`
📉 *Removed:* \`${amount} FRG\`
💰 *New Balance:* \`${newBalance} FRG\``, { parse_mode: 'Markdown' });

        // Notify the user
        try {
            await bot.telegram.sendMessage(targetId, `
📉 *FRG Credits Deducted*

The admin has removed **${amount} FRG Credits** from your balance.

💰 New Balance: **${newBalance} FRG**
`, { parse_mode: 'Markdown' });
        } catch (e) {
            // User may have blocked the bot
        }
        return true;
    }

    // Handle admin news generation (type 1)
    if (state.action === 'frag_news_await_text' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const headline = input;
        const imageBase64 = state.image;

        if (!imageBase64) {
            await ctx.reply('❌ Image data lost. Please start over by clicking the button again.');
            return true;
        }

        const processingMsg = await ctx.reply('🎨 Generating news card...');

        try {
            const imageBuffer = await generateNewsCard({
                image: imageBase64,
                headline: headline
            });

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
        return true;
    }

    // Handle admin news 2 generation (Full Image)
    if (state.action === 'frag_news_2_await_text' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const headline = input;
        const imageBase64 = state.image;

        if (!imageBase64) {
            await ctx.reply('❌ Image data lost. Please start over by clicking the button again.');
            return true;
        }

        const processingMsg = await ctx.reply('🎨 Generating News Card 2 (Full Image)...');

        try {
            const imageBuffer = await generateNewsCard2({
                image: imageBase64,
                headline: headline
            });

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
        return true;
    }

    // Handle sponsor text edit
    if (state.action === 'admin_edit_sponsor' && isAdmin(ctx.from.id)) {
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
        return true;
    }
    // Handle Gift-Asset API token addition
    if (state.action === 'admin_add_ga_token' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const token = input.trim();
        const added = await giftAssetAPI.addToken(token);

        if (added) {
            await ctx.replyWithMarkdown(`✅ *Token Added!*\n\n🔑 \`${token.substring(0, 8)}...${token.slice(-4)}\`\n📊 Total: *${giftAssetAPI.getTokenCount()}* tokens\n\n_Token rotation is automatic._`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 API Keys', callback_data: 'admin_api_keys' }]
                    ]
                }
            });
        } else {
            await ctx.replyWithMarkdown(`❌ *Failed to add token.*\n\nEither the token is too short or it already exists.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 API Keys', callback_data: 'admin_api_keys' }]
                    ]
                }
            });
        }
        return true;
    }

    // Handle See.tg API token update
    if (state.action === 'admin_update_seetg' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const token = input.trim();
        const updated = await seetgAPI.updateToken(token);

        if (updated) {
            await ctx.replyWithMarkdown(`✅ *See.tg Token Updated!*\n\n📡 Token: \`${token.substring(0, 8)}...${token.slice(-4)}\`\n\n_New token is now active for all market requests._`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 API Keys', callback_data: 'admin_api_keys' }]
                    ]
                }
            });
        } else {
            await ctx.replyWithMarkdown(`❌ *Failed to update See.tg token.*`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 API Keys', callback_data: 'admin_api_keys' }]
                    ]
                }
            });
        }
        return true;
    }

    // Handle Apify token addition
    if (state.action === 'admin_add_apify_token' && isAdmin(ctx.from.id)) {
        userStates.delete(chatId);

        const token = input.trim();
        const added = await apifyAPI.addToken(token);

        if (added) {
            await ctx.replyWithMarkdown(
                `✅ *Apify Token Added!*\n\n🧩 \`${token.substring(0, 8)}...${token.slice(-4)}\`\n📊 Total: *${apifyAPI.getTokenCount()}* tokens`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 API Keys', callback_data: 'admin_api_keys' }]
                    ]
                }
            });
        } else {
            await ctx.replyWithMarkdown(
                `❌ *Failed to add Apify token.*\n\nEither the token is too short or it already exists.`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 API Keys', callback_data: 'admin_api_keys' }]
                    ]
                }
            });
        }
        return true;
    }

    return false; // Not handled
}

export default {
    registerAdminHandlers,
    handleAdminTextMessage
};
