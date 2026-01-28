/**
 * Telegram Client Service - MTProto Client for Gift Data
 * Uses GramJS to access Telegram API directly for gift information
 * Sessions are persisted in MongoDB for deployment survival
 */

import { saveTelegramSession, loadTelegramSession, deleteTelegramSession } from './mongoService.js'; // Keeping for backward compat/backup
import * as accountManager from './accountManagerService.js';

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
 * Ensure connection is established (legacy wrapper)
 * Checks if account manager has active clients
 */
async function ensureConnection() {
    // If we have accounts in the pool, we are "connected"
    if (accountManager.getClient()) {
        isConnected = true;
        return true;
    }

    // Try to init if empty
    console.log('🔄 No active accounts, initializing pool...');
    await initClient();

    if (accountManager.getClient()) {
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

    // Get a client from the pool
    const activeClient = accountManager.getClient('scanner');

    if (!activeClient) {
        // Try to re-init
        await ensureConnection();
        if (!accountManager.getClient()) {
            console.log('❌ No active Telegram accounts available');
            return { success: false, error: 'No active Telegram accounts' };
        }
    }

    // Use the fetched client
    const useClient = accountManager.getClient('scanner');

    try {
        const giftLink = `https://t.me/nft/${collectionSlug}-${itemNumber}`;
        console.log(`🔗 Fetching web preview for: ${giftLink}`);

        // Get web preview which contains gift info
        const webPreview = await useClient.invoke(
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
            console.log('📄 Web preview found:', page.title);
            console.log('📝 Description:', page.description);

            // Parse attributes from description
            // Example description: "Model: Blue · Backdrop: Pink · Symbol: Star"
            const description = page.description || '';
            const attributes = {};

            // Try to extract Model
            const modelMatch = description.match(/Model[:\s]+([^\n·,]+)/i);
            if (modelMatch) attributes.model = modelMatch[1].trim();

            // Try to extract Backdrop
            const backdropMatch = description.match(/Backdrop[:\s]+([^\n·,]+)/i);
            if (backdropMatch) attributes.backdrop = backdropMatch[1].trim();

            // Try to extract Symbol
            const symbolMatch = description.match(/Symbol[:\s]+([^\n·,]+)/i);
            if (symbolMatch) attributes.symbol = symbolMatch[1].trim();

            // Alternative format: "Blue · Pink · Star" or simple list
            if (!attributes.model && !attributes.backdrop) {
                const parts = description.split('·').map(s => s.trim());
                if (parts.length >= 2) {
                    attributes.model = parts[0];
                    attributes.backdrop = parts[1];
                    if (parts.length >= 3) attributes.symbol = parts[2];
                }
            }

            console.log('✅ Parsed attributes:', attributes);

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

        console.log('❌ No web preview available');
        return { success: false, error: 'Could not retrieve gift info - no preview available' };
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

    // Get a client from the pool
    const activeClient = accountManager.getClient('scanner');

    if (!activeClient) {
        // Try to re-init
        await ensureConnection();
        if (!accountManager.getClient()) {
            console.log('❌ No active Telegram accounts available');
            return { success: false, error: 'No active Telegram accounts' };
        }
    }

    // Use the fetched client
    const useClient = accountManager.getClient('scanner');

    try {
        // Resolve user entity
        let userEntity;
        try {
            userEntity = await useClient.getEntity(userId);
        } catch (e) {
            console.log(`⚠️ Could not resolve user ${userId}:`, e.message);
            return { success: false, error: 'Could not resolve user' };
        }

        // Fetch user's star gifts using Telegram API
        // The method is payments.GetUserStarGifts
        const result = await useClient.invoke(
            new Api.payments.GetUserStarGifts({
                userId: userEntity,
                offset: '',
                limit: 100
            })
        );

        let totalValue = 0;
        const gifts = [];

        if (result && result.gifts) {
            for (const userGift of result.gifts) {
                // Each userGift has a 'gift' object and potentially 'convertStars' value
                const gift = userGift.gift;

                // Get value - could be from convertStars or stars price
                let value = 0;
                if (userGift.convertStars) {
                    value = Number(userGift.convertStars);
                } else if (gift && gift.stars) {
                    value = Number(gift.stars);
                }

                totalValue += value;

                gifts.push({
                    id: userGift.msgId || gift?.id,
                    name: gift?.title || 'Star Gift',
                    value: value,
                    date: userGift.date
                });
            }
        }

        console.log(`✅ Found ${gifts.length} gifts, total value: ${totalValue} Stars`);

        return {
            success: true,
            totalValue,
            giftCount: gifts.length,
            gifts
        };
    } catch (error) {
        console.error('❌ Get user gifts error:', error.message);

        // If method doesn't exist, try alternative approach
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
        const useClient = accountManager.getClient('scanner');
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

    // Get a client from the pool
    const activeClient = accountManager.getClient('checker');

    if (!activeClient) {
        await ensureConnection();
        if (!accountManager.getClient()) {
            return { active: false, error: 'No active Telegram accounts' };
        }
    }

    const useClient = accountManager.getClient('checker');

    try {
        // Use ResolveUsername to check existence
        const result = await useClient.invoke(new Api.contacts.ResolveUsername({
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
    } catch (error) {
        // If username not found or invalid
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

    // Get a client from the pool
    const activeClient = accountManager.getClient('checker');

    if (!activeClient) {
        await ensureConnection();
        if (!accountManager.getClient()) {
            return { registered: false, error: 'No active Telegram accounts' };
        }
    }

    const useClient = accountManager.getClient('checker');

    try {
        // Create a random client ID to avoid collisions
        const clientId = Math.floor(Math.random() * 1000000);

        // Try to import the contact
        const result = await useClient.invoke(new Api.contacts.ImportContacts({
            contacts: [new Api.InputPhoneContact({
                clientId: clientId,
                phone: phoneNumber,
                firstName: 'Fragment',
                lastName: 'Check'
            })]
        }));

        // Check if import was successful
        if (result.imported && result.imported.length > 0) {
            const userId = result.imported[0].userId.toString();
            console.log(`✅ Number ${phoneNumber} is REGISTERED (ID: ${userId})`);

            // CLEANUP: Immediately delete the contact to avoid polluting the address book
            // We need the user entity to delete properly
            if (result.users && result.users.length > 0) {
                try {
                    await client.invoke(new Api.contacts.DeleteContacts({
                        id: [result.users[0]]
                    }));
                    console.log(`🧹 Deleted temp contact for ${phoneNumber}`);
                } catch (cleanupError) {
                    console.warn(`⚠️ Failed to cleanup contact ${phoneNumber}:`, cleanupError.message);
                }
            }

            return { registered: true, id: userId };
        } else {
            console.log(`❌ Number ${phoneNumber} is NOT registered`);
            return { registered: false };
        }
    } catch (error) {
        console.error(`⚠️ Error checking number ${phoneNumber}:`, error.message);
        return { registered: false, error: error.message };
    }
}
