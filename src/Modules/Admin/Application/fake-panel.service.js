/**
 * Fake Panel Service
 * Handles member addition, views, reactions, comments for groups/channels
 */

import * as accountManager from '../../User/Application/account-manager.service.js';
import { orders, accounts, proxies, accountStatus } from '../../../database/panelDatabase.js';

// ==================== CONFIGURATION ====================

const CONFIG = {
    MEMBER_DELAY_MS: 30000,        // 30 seconds between each member add
    VIEW_DELAY_MS: 2000,           // 2 seconds between views
    REACTION_DELAY_MS: 3000,       // 3 seconds between reactions
    COMMENT_DELAY_MS: 5000,        // 5 seconds between comments
    MAX_CONCURRENT_ACCOUNTS: 10,   // Max accounts working simultaneously
    REST_TIME_MINUTES: 60          // Rest time after hitting limits
};

// Active operations tracking
const activeOperations = new Map(); // orderId -> { status, progress, cancel }

// ==================== MEMBER SERVICE ====================

/**
 * Add members to a group/channel using multiple accounts
 * @param {string} targetChat - Target group/channel username or link
 * @param {string[]} userIds - List of user IDs to add
 * @param {function} progressCallback - Callback for progress updates
 * @returns {Promise<object>} Result with success/fail counts
 */
export async function addMembersToGroup(targetChat, userIds, progressCallback = null) {
    const orderId = orders.create('member', targetChat, userIds.length);
    const result = { success: 0, failed: 0, errors: [] };

    activeOperations.set(orderId, { status: 'running', cancel: false });

    try {
        for (let i = 0; i < userIds.length; i++) {
            // Check if cancelled
            if (activeOperations.get(orderId)?.cancel) {
                orders.cancel(orderId);
                break;
            }

            const userId = userIds[i];

            // Get next available account
            const account = await getNextAvailableAccount();
            if (!account) {
                result.errors.push(`هیچ اکانت فعالی موجود نیست`);
                break;
            }

            try {
                const client = await accountManager.getClientByPhone(account.phone);
                if (!client) {
                    result.failed++;
                    continue;
                }

                // Try to add user to group
                await addUserToChat(client, targetChat, userId);
                result.success++;

                // Update progress
                orders.updateProgress(orderId, result.success);
                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: userIds.length,
                        success: result.success,
                        failed: result.failed
                    });
                }

            } catch (error) {
                result.failed++;
                result.errors.push(`${userId}: ${error.message}`);

                // Check for flood/spam errors
                if (isFloodError(error)) {
                    accountStatus.markResting(account.phone, CONFIG.REST_TIME_MINUTES);
                }
                if (isReportError(error)) {
                    accountStatus.markReported(account.phone);
                }
            }

            // Delay between adds
            await sleep(CONFIG.MEMBER_DELAY_MS);
        }

        orders.complete(orderId);
    } catch (error) {
        orders.fail(orderId, error.message);
        throw error;
    } finally {
        activeOperations.delete(orderId);
    }

    return result;
}

/**
 * Add forced members to channel (users must start bot first)
 */
export async function addForcedMembersToChannel(targetChannel, userIds, progressCallback = null) {
    return addMembersToGroup(targetChannel, userIds, progressCallback);
}

/**
 * Make local accounts join a channel/group (Mass Join)
 * @param {string} targetChat - Target group/channel link
 * @param {number} count - Number of accounts to join
 * @param {function} progressCallback - Progress callback
 */
export async function massJoinChannel(targetChat, count, progressCallback = null) {
    const orderId = orders.create('join_channel', targetChat, count);
    const result = { success: 0, failed: 0 };

    activeOperations.set(orderId, { status: 'running', cancel: false });

    try {
        const accounts = accountManager.getAccountList().filter(a => a.status === 'active');

        // Shuffle accounts for better distribution (optional)
        // accounts.sort(() => Math.random() - 0.5);

        for (let i = 0; i < Math.min(accounts.length, count); i++) {
            if (activeOperations.get(orderId)?.cancel) {
                orders.cancel(orderId);
                break;
            }

            const account = accounts[i];

            try {
                const client = await accountManager.getClientByPhone(account.phone);
                if (!client) {
                    result.failed++;
                    continue;
                }

                // Join the channel/group
                await joinChat(client, targetChat);
                result.success++;

                orders.updateProgress(orderId, result.success);
                if (progressCallback) {
                    progressCallback({
                        current: result.success,
                        total: count,
                        success: result.success,
                        failed: result.failed
                    });
                }

            } catch (error) {
                result.failed++;
                if (isFloodError(error)) {
                    accountStatus.markResting(account.phone, CONFIG.REST_TIME_MINUTES);
                }
            }

            await sleep(CONFIG.MEMBER_DELAY_MS);
        }

        orders.complete(orderId);
    } catch (error) {
        orders.fail(orderId, error.message);
        throw error;
    } finally {
        activeOperations.delete(orderId);
    }

    return result;
}

// ==================== VIEW SERVICE ====================

/**
 * Add views to a post
 * @param {string} channelUsername - Channel username
 * @param {number} messageId - Message ID to view
 * @param {number} count - Number of views to add
 * @param {function} progressCallback - Progress callback
 */
export async function addViews(channelUsername, messageId, count, progressCallback = null) {
    const orderId = orders.create('view', `${channelUsername}/${messageId}`, count);
    const result = { success: 0, failed: 0 };

    activeOperations.set(orderId, { status: 'running', cancel: false });

    try {
        const accounts = accountManager.getAccountList().filter(a => a.status === 'active');
        const viewsPerAccount = Math.ceil(count / accounts.length);

        for (let i = 0; i < Math.min(accounts.length, count); i++) {
            if (activeOperations.get(orderId)?.cancel) {
                orders.cancel(orderId);
                break;
            }

            const account = accounts[i];

            try {
                const client = await accountManager.getClientByPhone(account.phone);
                if (!client) {
                    result.failed++;
                    continue;
                }

                // View the message
                await viewMessage(client, channelUsername, messageId);
                result.success++;

                orders.updateProgress(orderId, result.success);
                if (progressCallback) {
                    progressCallback({
                        current: result.success,
                        total: count,
                        success: result.success,
                        failed: result.failed
                    });
                }

            } catch (error) {
                result.failed++;
                if (isFloodError(error)) {
                    accountStatus.markResting(account.phone, CONFIG.REST_TIME_MINUTES);
                }
            }

            await sleep(CONFIG.VIEW_DELAY_MS);
        }

        orders.complete(orderId);
    } catch (error) {
        orders.fail(orderId, error.message);
        throw error;
    } finally {
        activeOperations.delete(orderId);
    }

    return result;
}

// ==================== REACTION SERVICE ====================

/**
 * Add reactions to a post
 * @param {string} channelUsername - Channel username
 * @param {number} messageId - Message ID
 * @param {string} emoji - Reaction emoji (👍, ❤️, 🔥, etc.)
 * @param {number} count - Number of reactions
 * @param {function} progressCallback - Progress callback
 */
export async function addReactions(channelUsername, messageId, emoji, count, progressCallback = null) {
    const orderId = orders.create('reaction', `${channelUsername}/${messageId}`, count);
    const result = { success: 0, failed: 0 };

    activeOperations.set(orderId, { status: 'running', cancel: false });

    try {
        const accounts = accountManager.getAccountList().filter(a => a.status === 'active');

        for (let i = 0; i < Math.min(accounts.length, count); i++) {
            if (activeOperations.get(orderId)?.cancel) {
                orders.cancel(orderId);
                break;
            }

            const account = accounts[i];

            try {
                const client = await accountManager.getClientByPhone(account.phone);
                if (!client) {
                    result.failed++;
                    continue;
                }

                // Add reaction
                await sendReaction(client, channelUsername, messageId, emoji);
                result.success++;

                orders.updateProgress(orderId, result.success);
                if (progressCallback) {
                    progressCallback({
                        current: result.success,
                        total: count,
                        success: result.success,
                        failed: result.failed
                    });
                }

            } catch (error) {
                result.failed++;
                if (isFloodError(error)) {
                    accountStatus.markResting(account.phone, CONFIG.REST_TIME_MINUTES);
                }
            }

            await sleep(CONFIG.REACTION_DELAY_MS);
        }

        orders.complete(orderId);
    } catch (error) {
        orders.fail(orderId, error.message);
        throw error;
    } finally {
        activeOperations.delete(orderId);
    }

    return result;
}

// ==================== COMMENT SERVICE ====================

/**
 * Add comments to a post
 * @param {string} channelUsername - Channel username
 * @param {number} messageId - Message ID
 * @param {string[]} comments - List of comments to post
 * @param {function} progressCallback - Progress callback
 */
export async function addComments(channelUsername, messageId, comments, progressCallback = null) {
    const orderId = orders.create('comment', `${channelUsername}/${messageId}`, comments.length);
    const result = { success: 0, failed: 0 };

    activeOperations.set(orderId, { status: 'running', cancel: false });

    try {
        const accounts = accountManager.getAccountList().filter(a => a.status === 'active');

        for (let i = 0; i < comments.length; i++) {
            if (activeOperations.get(orderId)?.cancel) {
                orders.cancel(orderId);
                break;
            }

            const account = accounts[i % accounts.length];
            const comment = comments[i];

            try {
                const client = await accountManager.getClientByPhone(account.phone);
                if (!client) {
                    result.failed++;
                    continue;
                }

                // Send comment
                await sendComment(client, channelUsername, messageId, comment);
                result.success++;

                orders.updateProgress(orderId, result.success);
                if (progressCallback) {
                    progressCallback({
                        current: result.success,
                        total: comments.length,
                        success: result.success,
                        failed: result.failed
                    });
                }

            } catch (error) {
                result.failed++;
                if (isFloodError(error)) {
                    accountStatus.markResting(account.phone, CONFIG.REST_TIME_MINUTES);
                }
            }

            await sleep(CONFIG.COMMENT_DELAY_MS);
        }

        orders.complete(orderId);
    } catch (error) {
        orders.fail(orderId, error.message);
        throw error;
    } finally {
        activeOperations.delete(orderId);
    }

    return result;
}

// ==================== BOT START SERVICE ====================

/**
 * Start a bot with multiple accounts
 * @param {string} botUsername - Target bot username
 * @param {number} count - Number of starts
 * @param {function} progressCallback - Progress callback
 */
export async function startBot(botUsername, count, progressCallback = null) {
    const orderId = orders.create('bot_start', botUsername, count);
    const result = { success: 0, failed: 0 };

    activeOperations.set(orderId, { status: 'running', cancel: false });

    try {
        const accounts = accountManager.getAccountList().filter(a => a.status === 'active');

        for (let i = 0; i < Math.min(accounts.length, count); i++) {
            if (activeOperations.get(orderId)?.cancel) {
                orders.cancel(orderId);
                break;
            }

            const account = accounts[i];

            try {
                const client = await accountManager.getClientByPhone(account.phone);
                if (!client) {
                    result.failed++;
                    continue;
                }

                // Start the bot
                await sendStartToBot(client, botUsername);
                result.success++;

                orders.updateProgress(orderId, result.success);
                if (progressCallback) {
                    progressCallback({
                        current: result.success,
                        total: count,
                        success: result.success,
                        failed: result.failed
                    });
                }

            } catch (error) {
                result.failed++;
            }

            await sleep(CONFIG.VIEW_DELAY_MS);
        }

        orders.complete(orderId);
    } catch (error) {
        orders.fail(orderId, error.message);
        throw error;
    } finally {
        activeOperations.delete(orderId);
    }

    return result;
}

// ==================== OPERATION CONTROL ====================

/**
 * Cancel an active operation
 */
export function cancelOperation(orderId) {
    const op = activeOperations.get(orderId);
    if (op) {
        op.cancel = true;
        return true;
    }
    return false;
}

/**
 * Get active operations
 */
export function getActiveOperations() {
    return Array.from(activeOperations.entries()).map(([id, op]) => ({
        orderId: id,
        status: op.status
    }));
}

// ==================== HELPER FUNCTIONS ====================

async function getNextAvailableAccount() {
    const accounts = accountManager.getAccountList();
    for (const account of accounts) {
        if (account.status !== 'active') continue;

        const status = accountStatus.get(account.phone);
        if (status?.is_reported) continue;
        if (status?.is_resting) {
            const restUntil = new Date(status.rest_until);
            if (restUntil > new Date()) continue;
            // Rest time passed, clear it
            accountStatus.clearRest(account.phone);
        }

        return account;
    }
    return null;
}

async function addUserToChat(client, chatLink, userId) {
    // This would use the Telegram client to add user
    // Implementation depends on the client library (GramJS/Telethon)
    try {
        const { Api } = await import('telegram');
        await client.invoke(new Api.channels.InviteToChannel({
            channel: chatLink,
            users: [userId]
        }));
    } catch (error) {
        throw error;
    }
}

async function joinChat(client, chatLink) {
    try {
        const { Api } = await import('telegram');

        // Resolve the link first
        let inviteHash = null;
        if (chatLink.includes('+') || chatLink.includes('joinchat')) {
            inviteHash = chatLink.split('/').pop().replace('+', '');
            await client.invoke(new Api.messages.ImportChatInvite({ hash: inviteHash }));
        } else {
            // Public channel/group
            const username = chatLink.replace('https://t.me/', '').replace('@', '');
            await client.invoke(new Api.channels.JoinChannel({
                channel: username
            }));
        }
    } catch (error) {
        // Handle ALREADY_PARTICIPANT as success?
        if (error.message.includes('ALREADY_PARTICIPANT')) return;
        throw error;
    }
}

async function viewMessage(client, channelUsername, messageId) {
    try {
        const { Api } = await import('telegram');
        await client.invoke(new Api.messages.GetMessagesViews({
            peer: channelUsername,
            id: [messageId],
            increment: true
        }));
    } catch (error) {
        throw error;
    }
}

async function sendReaction(client, channelUsername, messageId, emoji) {
    try {
        const { Api } = await import('telegram');
        await client.invoke(new Api.messages.SendReaction({
            peer: channelUsername,
            msgId: messageId,
            reaction: [new Api.ReactionEmoji({ emoticon: emoji })]
        }));
    } catch (error) {
        throw error;
    }
}

async function sendComment(client, channelUsername, messageId, comment) {
    try {
        const { Api } = await import('telegram');
        // Get discussion chat for the channel post
        const result = await client.invoke(new Api.messages.GetDiscussionMessage({
            peer: channelUsername,
            msgId: messageId
        }));

        if (result.messages.length > 0) {
            await client.sendMessage(result.chats[0], {
                message: comment,
                replyTo: result.messages[0].id
            });
        }
    } catch (error) {
        throw error;
    }
}

async function sendStartToBot(client, botUsername) {
    try {
        await client.sendMessage(botUsername, { message: '/start' });
    } catch (error) {
        throw error;
    }
}

function isFloodError(error) {
    const message = error.message?.toLowerCase() || '';
    return message.includes('flood') ||
        message.includes('too many') ||
        message.includes('wait');
}

function isReportError(error) {
    const message = error.message?.toLowerCase() || '';
    return message.includes('banned') ||
        message.includes('restricted') ||
        message.includes('spam');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== PREDEFINED COMMENTS ====================

export const predefinedComments = {
    positive: [
        '👍 عالی بود!',
        '❤️ ممنون بابت اشتراک‌گذاری',
        '🔥 محتوای فوق‌العاده',
        '👏 دمت گرم',
        '⭐ خیلی مفید بود',
        '💯 عالی',
        '🙏 ممنون',
        '👌 بسیار عالی'
    ],
    neutral: [
        'جالب بود',
        'ممنون',
        'خوب بود',
        'آفرین',
        'لایک',
        '👍',
        '❤️'
    ]
};

export default {
    addMembersToGroup,
    addForcedMembersToChannel,
    massJoinChannel,
    addViews,
    addReactions,
    addComments,
    startBot,
    cancelOperation,
    getActiveOperations,
    predefinedComments
};
