/**
 * Account Manager Service
 * Handles multiple Telegram sessions for rotation and load balancing.
 * Stores sessions in a JSON file (data/sessions.json).
 */

import fs from 'fs';
import path from 'path';
import { StringSession } from 'telegram/sessions/index.js';
import { TelegramClient } from 'telegram';

// Configuration
const SESSIONS_FILE = path.resolve('data/sessions.json');
const API_ID = parseInt(process.env.TELEGRAM_API_ID) || 0;
const API_HASH = process.env.TELEGRAM_API_HASH || '';

// State
let accounts = []; // Array of Account objects
let clients = new Map(); // Map<phoneNumber, TelegramClient>
let currentIndex = 0; // For round-robin rotation

// Ensure data directory exists
if (!fs.existsSync('data')) {
    fs.mkdirSync('data');
}

/**
 * Load accounts from disk
 */
async function loadAccounts() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
            const loaded = JSON.parse(data);

            // Migrate/Validate data structure
            accounts = loaded.map(acc => ({
                ...acc,
                isActive: acc.isActive !== undefined ? acc.isActive : true,
                role: acc.role || 'all', // all, scanner, checker
                proxy: acc.proxy || null, // { ip, port, username, password, type: 'socks5' }
                stats: acc.stats || {
                    requestsToday: 0,
                    failedRequests: 0,
                    lastActive: null,
                    startBanCheck: null
                }
            }));

            console.log(`📂 Loaded ${accounts.length} accounts from storage.`);
            return true;
        }
    } catch (error) {
        console.error('❌ Error loading accounts:', error.message);
    }
    return false;
}

/**
 * Save accounts to disk
 */
async function saveAccounts() {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(accounts, null, 2));
    } catch (error) {
        console.error('❌ Error saving accounts:', error.message);
    }
}

/**
 * Initialize all accounts (connect clients)
 */
async function initAccounts() {
    if (!API_ID || !API_HASH) {
        console.warn('⚠️ API_ID or API_HASH missing for Account Manager.');
        return;
    }

    await loadAccounts();

    console.log('🔄 Initializing Account Pool...');
    const promises = accounts.map(async (acc) => {
        if (acc.isActive && acc.session) {
            return connectClient(acc);
        }
    });

    await Promise.allSettled(promises);
    console.log(`✅ Account Pool Ready: ${clients.size}/${accounts.filter(a => a.isActive).length} active.`);
}

/**
 * Connect a specific account and add to pool
 */
async function connectClient(account) {
    try {
        // Handle Proxy
        let clientParams = {
            connectionRetries: 3,
            useWSS: false
        };

        if (account.proxy) {
            clientParams.proxy = {
                ip: account.proxy.ip,
                port: parseInt(account.proxy.port),
                username: account.proxy.username,
                password: account.proxy.password,
                socksType: 5 // Default to socks5
            };
        }

        const stringSession = new StringSession(account.session);
        const client = new TelegramClient(stringSession, API_ID, API_HASH, clientParams);

        // Suppress detailed logging for multiple accounts
        client.setLogLevel('warn');

        await client.connect();

        if (await client.isUserAuthorized()) {
            clients.set(account.phone, client);
            // Update status without saving to avoid IO spam
            account.status = 'active';
            account.stats.lastActive = Date.now();
            return true;
        } else {
            console.warn(`⚠️ Account ${account.phone} not authorized.`);
            account.status = 'invalid';
            account.isActive = false; // Auto-disable invalid accounts
            await saveAccounts();
        }
    } catch (error) {
        console.error(`❌ Failed to connect ${account.phone}:`, error.message);
        account.status = 'error';
    }
    return false;
}

/**
 * Add a new session to the manager
 */
async function addSession(phoneNumber, sessionString, user) {
    // Check if exists
    const existingIndex = accounts.findIndex(a => a.phone === phoneNumber);

    const newAccount = {
        id: user.id.toString(),
        phone: phoneNumber,
        username: user.username,
        firstName: user.firstName,
        session: sessionString,
        status: 'active',
        isActive: true,
        role: 'all',
        proxy: null,
        addedAt: new Date().toISOString(),
        stats: {
            requestsToday: 0,
            failedRequests: 0,
            lastActive: Date.now()
        }
    };

    if (existingIndex >= 0) {
        // Preserve existing stats/config if re-adding
        const oldToken = accounts[existingIndex];
        newAccount.role = oldToken.role || 'all';
        newAccount.proxy = oldToken.proxy || null;
        newAccount.stats = oldToken.stats || newAccount.stats;
        accounts[existingIndex] = newAccount;
    } else {
        accounts.push(newAccount);
    }

    await saveAccounts();

    // Connect immediately
    await connectClient(newAccount);

    return true;
}

/**
 * Get a client using Round-Robin rotation with filters
 */
function getClient(role = 'all') {
    if (clients.size === 0) return null;

    // Filter eligible accounts
    const eligibleAccounts = accounts.filter(acc =>
        acc.isActive &&
        clients.has(acc.phone) &&
        (role === 'all' || acc.role === 'all' || acc.role === role)
    );

    if (eligibleAccounts.length === 0) {
        // Fallback to any active account if specific role not found (optional, but safer)
        if (role !== 'all') return getClient('all');
        return null;
    }

    // Simple Round Robin for eligible
    // Note: currentIndex might point to an invalid one after filtering, but we pick from the filtered list
    // Use a random pick for better distribution across filtered subsets? 
    // Or maintain separate indices. For simplicity, let's use Random for now to distribute load.
    const account = eligibleAccounts[Math.floor(Math.random() * eligibleAccounts.length)];

    // Update usage stats
    if (account.stats) {
        account.stats.requestsToday = (account.stats.requestsToday || 0) + 1;
        account.stats.lastActive = Date.now();
    }

    // We should periodically save stats, but not on every request.
    // Maybe implement a periodic save in background if needed.

    return clients.get(account.phone);
}

/**
 * Get a specific client by phone number
 * @param {string} phone 
 * @returns {object|null} TelegramClient instance
 */
function getClientByPhone(phone) {
    if (!clients.has(phone)) return null;
    return clients.get(phone);
}

/**
 * Get list of accounts with full details
 */
function getAccountList() {
    return accounts.map(a => ({
        ...a,
        connected: clients.has(a.phone),
        statusDisplay: clients.has(a.phone) ? '🟢 Active' : (a.isActive ? '🔴 Disconnected' : '⚫ Disabled')
    }));
}

/**
 * Get specific account details
 */
function getAccount(phone) {
    return accounts.find(a => a.phone === phone);
}

/**
 * Update account settings
 */
async function updateAccount(phone, updates) {
    const account = accounts.find(a => a.phone === phone);
    if (!account) return false;

    // Apply updates
    if (updates.role) account.role = updates.role;
    if (updates.proxy !== undefined) account.proxy = updates.proxy; // allow setting to null
    if (updates.isActive !== undefined) {
        account.isActive = updates.isActive;
        // Handle connection state changes
        if (account.isActive && !clients.has(phone)) {
            await connectClient(account);
        } else if (!account.isActive && clients.has(phone)) {
            const client = clients.get(phone);
            try { await client.disconnect(); } catch (e) { }
            clients.delete(phone);
        }
    }

    await saveAccounts();
    return true;
}

/**
 * Toggle account active status
 */
async function toggleAccount(phone) {
    const account = accounts.find(a => a.phone === phone);
    if (!account) return false;

    return updateAccount(phone, { isActive: !account.isActive });
}

/**
 * Remove an account
 */
async function removeAccount(phoneNumber) {
    const client = clients.get(phoneNumber);
    if (client) {
        try {
            await client.disconnect();
        } catch (e) { }
        clients.delete(phoneNumber);
    }

    accounts = accounts.filter(a => a.phone !== phoneNumber);
    await saveAccounts();
    return true;
}

/**
 * Check account health (Ping/Spam Block)
 */
async function checkAccountHealth(phone) {
    const client = clients.get(phone);
    if (!client) return { connected: false, error: 'Not connected' };

    const start = Date.now();
    try {
        // Ping: Check 'Me'
        const me = await client.getMe();
        const ping = Date.now() - start;

        // Check for spam block (simulated or real if possible)
        // Usually we check by sending a message to @SpamBot, but that's invasive.
        // We'll return just ping and basic status for now.

        return {
            connected: true,
            ping: `${ping}ms`,
            user: me.username || me.firstName,
            isPremium: me.premium || false
        };

    } catch (e) {
        return { connected: true, error: e.message };
    }
}

// Pre-save cleanup interval (save stats every 5 minutes)
setInterval(() => {
    saveAccounts().catch(console.error);
}, 5 * 60 * 1000);

export {
    initAccounts,
    addSession,
    getClient,
    getClientByPhone,
    getAccountList,
    getAccount,
    updateAccount,
    toggleAccount,
    removeAccount,
    checkAccountHealth
};
