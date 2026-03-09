/**
 * Membership Helper Module
 * Channel membership checks and join message utilities.
 * Extracted from bot.entry.js to reduce monolith size.
 */

import { CONFIG } from '../../core/Config/app.config.js';

/**
 * Check if user is member of required channel.
 * @param {object} bot - Telegraf bot instance
 * @param {number} userId - Telegram user ID
 * @returns {Promise<boolean>}
 */
export async function isChannelMember(bot, userId) {
    try {
        const member = await bot.telegram.getChatMember(CONFIG.REQUIRED_CHANNEL, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.error('Channel check error:', error.message);
        return false;
    }
}

/**
 * Send join channel message.
 * @param {object} ctx - Telegraf context
 */
export function sendJoinChannelMessage(ctx) {
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

/**
 * Check membership and stop if not a member.
 * Used as a guard for protected features.
 * 
 * @param {object} ctx - Telegraf context
 * @param {object} bot - Telegraf bot instance
 * @param {function} isAdmin - Admin check function
 * @returns {Promise<boolean>} true if user can proceed, false otherwise
 */
export async function checkMembershipOrStop(ctx, bot, isAdmin) {
    try {
        // Admins bypass membership check
        if (isAdmin(ctx.from.id)) return true;

        const isMember = await isChannelMember(bot, ctx.from.id);
        if (!isMember) {
            try {
                await ctx.answerCbQuery(`❌ Join ${CONFIG.REQUIRED_CHANNEL} to use this feature!`, { show_alert: true });
            } catch (e) {
                // Callback may have expired, ignore
            }
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
