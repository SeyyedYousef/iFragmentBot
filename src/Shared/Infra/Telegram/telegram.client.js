/**
 * Telegram Client Service - MTProto Client for Gift Data
 * Uses GramJS to access Telegram API directly for gift information
 * Sessions are persisted in MongoDB for deployment survival
 */

import { saveTelegramSession, loadTelegramSession, deleteTelegramSession } from '../Database/mongo.repository.js'; // Keeping for backward compat/backup
import * as accountManager from '../../../Modules/User/Application/account-manager.service.js';

// Lazy load telegram to avoid issues if not properly installed
let TelegramClient = null;
let Api = null;
let StringSession = null;

async function loadGramJS() {
    if (!TelegramClient) {
        try {
            const telegram = await import('telegram');
            TelegramClient = telegram.TelegramClient;
            Api = telegram.Api;
            const sessions = await import('telegram/sessions/index.js');
            StringSession = sessions.StringSession;
            return true;
        } catch (error) {
            console.warn('⚠️ GramJS not available:', error.message);
            return false;
        }
    }
    return true;
}

// Configuration
const API_ID = parseInt(process.env.TELEGRAM_API_ID) || 0;
const API_HASH = process.env.TELEGRAM_API_HASH || '';

// Client instance
let client = null;
let sessionString = '';
let isConnected = false;
let loginState = null; // For tracking login flow

/**
 * Load saved session from MongoDB
 */
async function loadSession() {
    try {
        const sessionData = await loadTelegramSession();
        if (sessionData && sessionData.session) {
            sessionString = sessionData.session;
            console.log('📱 Telegram session loaded from MongoDB');
            return true;
        }
    } catch (error) {
        console.warn('⚠️ Could not load session:', error.message);
    }
    return false;
}

/**
 * Save session to MongoDB
 */
async function saveSession(session, userInfo = null) {
    sessionString = session;
    await saveTelegramSession(session, userInfo);
}

/**
 * Initialize the Telegram client
 */
/**
 * Initialize the Telegram client pool
 */
async function initClient() {
    if (!await loadGramJS()) {
        return false;
    }

    try {
        await accountManager.initAccounts();

        // Also maintain a temporary client for login operations if needed
        // but main operations will use the pool
        return true;
    } catch (error) {
        console.error('❌ Init client error:', error.message);
        return false;
    }
}

/**
 * Start phone login process
 * @param {string} phoneNumber - Phone number with country code
 * @returns {object} - Login state
 */
async function startLogin(phoneNumber) {
    console.log('📱 startLogin called with:', phoneNumber);

    if (!API_ID || !API_HASH) {
        console.log('❌ API_ID or API_HASH not configured');
        return { success: false, error: 'API_ID and API_HASH not configured' };
    }

    console.log('📱 API credentials found, loading GramJS...');

    if (!await loadGramJS()) {
        console.log('❌ GramJS failed to load');
        return { success: false, error: 'GramJS library not available' };
    }

    console.log('📱 GramJS loaded, connecting...');

    try {
        if (!client) {
            const stringSession = new StringSession('');
            client = new TelegramClient(stringSession, API_ID, API_HASH, {
                connectionRetries: 3,
                timeout: 30, // 30 seconds timeout
            });
            console.log('📱 Connecting to Telegram servers...');
            await client.connect();
            console.log('📱 Connected!');
        }

        const result = await client.invoke(
            new Api.auth.SendCode({
                phoneNumber: phoneNumber,
                apiId: API_ID,
                apiHash: API_HASH,
                settings: new Api.CodeSettings({
                    allowFlashcall: false,
                    currentNumber: false,
                    allowAppHash: true,
                }),
            })
        );

        loginState = {
            phoneNumber,
            phoneCodeHash: result.phoneCodeHash,
            step: 'awaiting_code'
        };

        return {
            success: true,
            step: 'awaiting_code',
            message: 'Code sent successfully'
        };
    } catch (error) {
        console.error('❌ Send code error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Submit verification code
 * @param {string} code - Verification code
 * @returns {object} - Login result
 */
async function submitCode(code) {
    if (!loginState || loginState.step !== 'awaiting_code') {
        return { success: false, error: 'No pending login' };
    }

    try {
        const result = await client.invoke(
            new Api.auth.SignIn({
                phoneNumber: loginState.phoneNumber,
                phoneCodeHash: loginState.phoneCodeHash,
                phoneCode: code,
            })
        );

        // Success - save session to Account Manager
        sessionString = client.session.save();
        const me = await client.getMe();

        await accountManager.addSession(me.phone || loginState.phoneNumber, sessionString, {
            id: me.id.toString(),
            firstName: me.firstName,
            lastName: me.lastName,
            username: me.username
        });

        isConnected = true;
        loginState = null;

        return {
            success: true,
            step: 'completed',
            user: {
                id: me.id.toString(),
                firstName: me.firstName,
                lastName: me.lastName,
                username: me.username
            }
        };
    } catch (error) {
        if (error.message.includes('SESSION_PASSWORD_NEEDED')) {
            loginState.step = 'awaiting_2fa';
            return { success: true, step: 'awaiting_2fa' };
        }
        console.error('❌ Sign in error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Submit 2FA password
 * @param {string} password - 2FA password
 * @returns {object} - Login result
 */
async function submit2FA(password) {
    if (!loginState || loginState.step !== 'awaiting_2fa') {
        return { success: false, error: 'No pending 2FA' };
    }

    try {
        const passwordInfo = await client.invoke(new Api.account.GetPassword());

        const result = await client.invoke(
            new Api.auth.CheckPassword({
                password: await client._computeCheck(passwordInfo, password),
            })
        );

        // Success - save session to Account Manager
        sessionString = client.session.save();
        const me = await client.getMe();

        await accountManager.addSession(me.phone || loginState.phoneNumber, sessionString, {
            id: me.id.toString(),
            firstName: me.firstName,
            lastName: me.lastName,
            username: me.username
        });

        isConnected = true;
        loginState = null;

        return {
            success: true,
            step: 'completed',
            user: {
                id: me.id.toString(),
                firstName: me.firstName,
                lastName: me.lastName,
                username: me.username
            }
        };
    } catch (error) {
        console.error('❌ 2FA error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Resend verification code
 * @returns {object} - Result
 */
async function resendCode() {
    if (!loginState || loginState.step !== 'awaiting_code') {
        return { success: false, error: 'No pending login' };
    }

    try {
        const result = await client.invoke(
            new Api.auth.ResendCode({
                phoneNumber: loginState.phoneNumber,
                phoneCodeHash: loginState.phoneCodeHash
            })
        );

        // Update hash if changed (usually it does)
        if (result.phoneCodeHash) {
            loginState.phoneCodeHash = result.phoneCodeHash;
        }

        return {
            success: true,
            message: 'Code resent successfully',
            type: result.type ? result.type.className : 'unknown'
        };
    } catch (error) {
        console.error('❌ Resend code error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Ensure connection is established (legacy wrapper)
 * Checks if account manager has active clients
 */
async function ensureConnection() {
    // If we have accounts in the pool, we are "connected"
    if (await accountManager.getClient()) {
        isConnected = true;
        return true;
    }

    // Try to init if empty
    console.log('🔄 No active accounts, initializing pool...');
    await initClient();

    if (await accountManager.getClient()) {
        isConnected = true;
        return true;
    }

    return false;
}

/**
 * Get gift information from Telegram using Account Pool
 * @param {string} collectionSlug - Collection slug (e.g., "PlushPepe")
 * @param {number} itemNumber - Item number
 * @returns {object} - Gift data
 */
async function getGiftInfo(collectionSlug, itemNumber) {
    console.log(`🎁 getGiftInfo called: ${collectionSlug}-${itemNumber}`);

    try {
        return await accountManager.executeWithSmartRetry(async (client) => {
            const giftLink = `https://t.me/nft/${collectionSlug}-${itemNumber}`;
            console.log(`🔗 Fetching web preview for: ${giftLink}`);

            // Get web preview which contains gift info
            const webPreview = await client.invoke(
                new Api.messages.GetWebPage({
                    url: giftLink,
                    hash: 0,
                })
            ).catch((err) => {
                console.log('❌ GetWebPage error:', err.message);
                return null;
            });

            if (webPreview && webPreview.webpage) {
                const page = webPreview.webpage;
                // Parse attributes
                const description = page.description || '';
                const attributes = {};

                const modelMatch = description.match(/Model[:\s]+([^\n·,]+)/i);
                if (modelMatch) attributes.model = modelMatch[1].trim();

                const backdropMatch = description.match(/Backdrop[:\s]+([^\n·,]+)/i);
                if (backdropMatch) attributes.backdrop = backdropMatch[1].trim();

                const symbolMatch = description.match(/Symbol[:\s]+([^\n·,]+)/i);
                if (symbolMatch) attributes.symbol = symbolMatch[1].trim();

                if (!attributes.model && !attributes.backdrop) {
                    const parts = description.split('·').map(s => s.trim());
                    if (parts.length >= 2) {
                        attributes.model = parts[0];
                        attributes.backdrop = parts[1];
                        if (parts.length >= 3) attributes.symbol = parts[2];
                    }
                }

                return {
                    success: true,
                    data: {
                        title: page.title,
                        description: page.description,
                        siteName: page.siteName,
                        collectionSlug,
                        itemNumber,
                        attributes
                    }
                };
            }
            throw new Error('Could not retrieve gift info - no preview available');
        }, 'scanner');

    } catch (error) {
        console.error('❌ Get gift info error:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get all star gifts for a user and calculate total value
 * @param {string|number} userId - Telegram user ID
 * @returns {object} - { success, totalValue, giftCount, gifts }
 */
async function getUserGiftsWithValue(userId) {
    console.log(`🎁 Fetching gifts for user: ${userId}`);

    try {
        return await accountManager.executeWithSmartRetry(async (client) => {
            // Resolve user entity
            let userEntity;
            try {
                userEntity = await client.getEntity(userId);
            } catch (e) {
                throw new Error('Could not resolve user: ' + e.message);
            }

            // Fetch user's star gifts with Pagination Logic
            // برای دریافت بیش از 100 گیفت، باید از لوپ offset استفاده کنیم
            let allGifts = [];
            let offset = '';
            let loopCount = 0;
            let totalValue = 0; // Initialize totalValue
            const MAX_LOOPS = 20; // Safety Limit (Max 2000 gifts)

            do {
                console.log(`🎁 Fetching gifts chunk ${loopCount + 1}... (Offset: ${offset || 'Start'})`);

                const result = await client.invoke(
                    new Api.functions.payments.GetUserStarGifts({
                        userId: userEntity,
                        offset: offset,
                        limit: 100
                    })
                );

                if (!result || !result.gifts || result.gifts.length === 0) {
                    break;
                }

                // پردازش گیفت‌های این صفحه
                for (const userGift of result.gifts) {
                    const gift = userGift.gift;
                    let value = 0;
                    if (userGift.convertStars) {
                        value = Number(userGift.convertStars);
                    } else if (gift && gift.stars) {
                        value = Number(gift.stars);
                    }
                    totalValue += value;

                    // Extract attributes and new 9.4 fields
                    let model = '';
                    let backdrop = '';
                    let symbol = '';
                    let slug = gift.slug || '';
                    let rarityPerMillion = 0; // default

                    if (gift.attributes) {
                        for (const attr of gift.attributes) {
                            if (attr.className === 'StarGiftAttributeModel') {
                                model = attr.name;
                                // New Rarity Field (if present in attribute)
                                if (attr.rarityPermille) rarityPerMillion = attr.rarityPermille;
                            } else if (attr.className === 'StarGiftAttributeBackdrop') {
                                backdrop = attr.name;
                            } else if (attr.className === 'StarGiftAttributePattern') {
                                symbol = attr.name;
                            }
                        }
                    }

                    // Direct rarity field check (API 9.4)
                    if (gift.rarity) {
                        rarityPerMillion = gift.rarity.permille || 0;
                    }

                    // Burned status check
                    const isBurned = !!(userGift.isBurned || userGift.burned);

                    allGifts.push({
                        id: userGift.msgId || gift?.id,
                        name: gift?.title || 'Star Gift',
                        value: value,
                        date: userGift.date,
                        slug: slug,
                        model: model,
                        backdrop: backdrop,
                        symbol: symbol,
                        isNft: !!userGift.nft,
                        rarityPermille: rarityPerMillion,
                        isBurned: isBurned
                    });
                }

                // بروزرسانی افست برای صفحه بعدی
                // نکته: تلگرام معمولاً next_offset را برمی‌گرداند
                if (result.nextOffset) {
                    offset = result.nextOffset;
                } else {
                    break; // پایان لیست
                }

                loopCount++;

            } while (offset && loopCount < MAX_LOOPS);

            console.log(`✅ Found total ${allGifts.length} gifts across ${loopCount} pages, total value: ${totalValue} Stars`);
            return {
                success: true,
                totalValue,
                giftCount: allGifts.length,
                gifts: allGifts
            };
        }, 'scanner');

    } catch (error) {
        if (error.message.includes('No available clients')) {
            console.warn('⚠️ Gift Scan Skipped: No Telegram accounts available. Add accounts via /panel to enable gift scanning.');
            return { success: false, error: 'no_accounts', skipped: true };
        }

        console.error('❌ Get user gifts error:', error.message);

        // Fallback or specific error handling
        if (error.message.includes('UNKNOWN_METHOD') || error.message.includes('not found')) {
            console.log('⚠️ payments.GetUserStarGifts not available, trying profile scrape...');
            return await getUserGiftsFromProfile(userId);
        }

        return { success: false, error: error.message };
    }
}

/**
 * Fallback: Get gifts from user profile (if API method not available)
 */
async function getUserGiftsFromProfile(userId) {
    try {
        const useClient = await accountManager.getClient('scanner');
        if (!useClient) return { success: false, error: 'No active accounts' };

        const fullUser = await useClient.invoke(
            new Api.users.GetFullUser({
                id: userId
            })
        );

        // Check if user has gifts info in profile
        // This is a fallback and may have limited data
        console.log('📋 Full user profile fetched');

        return {
            success: true,
            totalValue: 0,
            giftCount: 0,
            gifts: [],
            note: 'Limited data from profile - API method not available'
        };
    } catch (error) {
        console.error('❌ Profile fallback failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Get account status
 */
async function getAccountStatus() {
    await ensureConnection();

    if (!isConnected || !client) {
        return { connected: false };
    }

    try {
        const me = await client.getMe();
        return {
            connected: true,
            user: {
                id: me.id.toString(),
                firstName: me.firstName,
                lastName: me.lastName,
                username: me.username,
                phone: me.phone
            }
        };
    } catch (error) {
        return { connected: false, error: error.message };
    }
}

/**
 * Disconnect and clear session
 */
async function logout() {
    try {
        if (client) {
            await client.disconnect();
        }
        // Delete session from MongoDB
        await deleteTelegramSession();

        client = null;
        isConnected = false;
        sessionString = '';
        loginState = null;
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Check if API credentials are configured
 */
function isConfigured() {
    return API_ID > 0 && API_HASH.length > 0;
}

/**
 * Get current login state
 */
function getLoginState() {
    return loginState;
}

// Auto-initialize if credentials are present (with delay to allow DB connection)
setTimeout(() => {
    initClient().catch(err => console.error('Failed to auto-init Telegram client:', err));
}, 3000);

export {
    initClient,
    startLogin,
    submitCode,
    resendCode,
    submit2FA,
    getGiftInfo,
    getUserGiftsWithValue,
    getAccountStatus,
    logout,
    isConfigured,
    getLoginState,
    checkUsername,
    checkPhoneNumber
};

/**
 * Check if a username is active on Telegram
 * @param {string} username - Username to check
 * @returns {Promise<{active: boolean, type: string, id: string}>}
 */
async function checkUsername(username) {
    console.log(`🔎 Checking username activity: @${username}`);

    try {
        return await accountManager.executeWithSmartRetry(async (client) => {
            const result = await client.invoke(new Api.contacts.ResolveUsername({
                username: username
            }));

            if (result) {
                let type = 'unknown';
                let id = '';

                if (result.users && result.users.length > 0) {
                    const user = result.users[0];
                    type = user.bot ? 'bot' : 'user';
                    id = user.id.toString();
                } else if (result.chats && result.chats.length > 0) {
                    type = 'channel/group';
                    id = result.chats[0].id.toString();
                }

                console.log(`✅ Username @${username} is ACTIVE (${type})`);
                return { active: true, type, id };
            }
            return { active: false };
        }, 'checker');

    } catch (error) {
        if (error.message.includes('USERNAME_NOT_OCCUPIED') || error.message.includes('USERNAME_INVALID')) {
            console.log(`❌ Username @${username} is NOT occupied`);
            return { active: false };
        }
        console.warn(`⚠️ Error checking username @${username}:`, error.message);
        return { active: false, error: error.message };
    }
}

/**
 * Check if a phone number is registered on Telegram
 * CRITICAL: Uses ImportContacts which has strict rate limits.
 * @param {string} phoneNumber - Phone number in +888... format
 * @returns {Promise<{registered: boolean, id: string}>}
 */
async function checkPhoneNumber(phoneNumber) {
    console.log(`🔎 Checking phone number registration: ${phoneNumber}`);

    try {
        return await accountManager.executeWithSmartRetry(async (client) => {
            const clientId = Math.floor(Math.random() * 1000000);

            const result = await client.invoke(new Api.contacts.ImportContacts({
                contacts: [new Api.InputPhoneContact({
                    clientId: clientId,
                    phone: phoneNumber,
                    firstName: 'Fragment',
                    lastName: 'Check'
                })]
            }));

            if (result.imported && result.imported.length > 0) {
                const userId = result.imported[0].userId.toString();
                console.log(`✅ Number ${phoneNumber} is REGISTERED (ID: ${userId})`);

                // Cleanup
                if (result.users && result.users.length > 0) {
                    try {
                        await client.invoke(new Api.contacts.DeleteContacts({
                            id: [result.users[0]]
                        }));
                    } catch { }
                }
                return { registered: true, id: userId };
            } else {
                return { registered: false };
            }
        }, 'checker');

    } catch (error) {
        console.error(`⚠️ Error checking number ${phoneNumber}:`, error.message);
        return { registered: false, error: error.message };
    }
}
