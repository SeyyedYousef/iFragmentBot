/**
 * Group To Group Service v5 - Full Featured
 * 
 * Features:
 * 1. Owner extraction from NFT gifts (fixed)
 * 2. Real-time progress tracking
 * 3. Pause/Resume functionality
 * 4. Extract from chat/channel
 * 5. CSV file import
 * 6. Smart account rotation
 * 7. Daily stats per account
 * 8. Scheduling system
 */

import * as accountManager from './accountManagerService.js';
import { getDB } from './mongoService.js';
import { Api } from 'telegram';
import { scrapeGiftOwner } from './fragmentService.js';

// ==================== STATE ====================
let state = {
    isExtracting: false,
    isPaused: false,
    isAddingToGroup: false,
    currentTask: null, // { type, progress, total, found }
    schedule: null // { enabled, startHour, endHour }
};

let addingStats = { added: 0, failed: 0, remaining: 0 };

// ==================== CONFIG ====================
const CONFIG = {
    ADD_DELAY_MS: 30000,
    MAX_ADDS_PER_ACCOUNT_PER_DAY: 50,
    EXTRACTION_DELAY_MS: 1000,
    CHAT_EXTRACTION_DELAY_MS: 200
};

// ==================== STATS TRACKING ====================
async function trackStat(accountPhone, action, success) {
    const db = getDB();
    if (!db) return;

    const today = new Date().toISOString().split('T')[0];
    const key = `${accountPhone}_${today}`;

    try {
        await db.collection('g2g_stats').updateOne(
            { key },
            {
                $inc: {
                    [`${action}_success`]: success ? 1 : 0,
                    [`${action}_fail`]: success ? 0 : 1,
                    total: 1
                },
                $set: { accountPhone, date: today, updatedAt: new Date() },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );
    } catch (e) {
        console.log(`⚠️ Stats tracking error: ${e.message}`);
    }
}

async function getDailyStats(accountPhone = null) {
    const db = getDB();
    if (!db) return [];

    const today = new Date().toISOString().split('T')[0];
    const query = accountPhone ? { accountPhone, date: today } : { date: today };

    return await db.collection('g2g_stats').find(query).toArray();
}

// ==================== SMART ACCOUNT ROTATION ====================
let accountUsage = new Map(); // phone -> { adds: number, lastUsed: Date }

function getNextAccount() {
    const accounts = accountManager.getAccountList().filter(a => a.connected);
    if (accounts.length === 0) return null;

    const today = new Date().toDateString();

    // Find account with least usage today
    let bestAccount = null;
    let minUsage = Infinity;

    for (const acc of accounts) {
        const key = `${acc.phone}_${today}`;
        const usage = accountUsage.get(key) || { adds: 0, lastUsed: new Date(0) };

        if (usage.adds < CONFIG.MAX_ADDS_PER_ACCOUNT_PER_DAY && usage.adds < minUsage) {
            minUsage = usage.adds;
            bestAccount = acc;
        }
    }

    return bestAccount;
}

function recordAccountUsage(phone) {
    const today = new Date().toDateString();
    const key = `${phone}_${today}`;
    const usage = accountUsage.get(key) || { adds: 0, lastUsed: new Date(0) };
    usage.adds++;
    usage.lastUsed = new Date();
    accountUsage.set(key, usage);
}

// ==================== SCHEDULING ====================
function isWithinSchedule() {
    if (!state.schedule?.enabled) return true;

    const now = new Date();
    const hour = now.getHours();

    return hour >= state.schedule.startHour && hour < state.schedule.endHour;
}

function setSchedule(enabled, startHour = 9, endHour = 21) {
    state.schedule = { enabled, startHour, endHour };
    return { success: true, schedule: state.schedule };
}

function getSchedule() {
    return state.schedule || { enabled: false, startHour: 9, endHour: 21 };
}

// ==================== PAUSE/RESUME ====================
function pause() {
    state.isPaused = true;
    return { success: true, message: 'Paused' };
}

function resume() {
    state.isPaused = false;
    return { success: true, message: 'Resumed' };
}

function stop() {
    state.isExtracting = false;
    state.isAddingToGroup = false;
    state.isPaused = false;
    state.currentTask = null;
    return { success: true, message: 'Stopped' };
}

// ==================== OWNER EXTRACTION (Fixed with Puppeteer) ====================
async function extractOwnerFromGift(client, collectionSlug, itemNumber) {
    try {
        console.log(`🔍 Extracting: ${collectionSlug}-${itemNumber} via Fragment Scraping...`);

        // Use Puppeteer scraper
        const scrapedData = await scrapeGiftOwner(collectionSlug, itemNumber);

        if (scrapedData && scrapedData.username) {
            const username = scrapedData.username;
            console.log(`✅ Scraper found: @${username}`);

            // Verify existence and get details via Telegram API
            try {
                const entity = await client.getEntity(username);
                return {
                    id: entity.id?.toString(),
                    username: entity.username || username,
                    firstName: entity.firstName || username,
                    accessHash: entity.accessHash?.toString(),
                    giftItem: `${collectionSlug}-${itemNumber}`
                };
            } catch (e) {
                console.log(`⚠️ User @${username} found but not resolvable: ${e.message}`);
                // Still return it, maybe we can resolve later
                return {
                    id: null,
                    username,
                    firstName: username,
                    accessHash: null,
                    giftItem: `${collectionSlug}-${itemNumber}`
                };
            }
        } else {
            console.log(`❌ No owner username found for ${collectionSlug}-${itemNumber} (Wallet: ${scrapedData?.wallet || 'none'})`);
        }

        return null;
    } catch (error) {
        console.log(`⚠️ Extract error: ${error.message}`);
        return null;
    }
}

// ==================== EXTRACT FROM COLLECTION ====================
async function extractOwnersFromCollection(collectionSlug, startNum, endNum, progressCallback = null) {
    if (state.isExtracting) {
        return { success: false, error: 'Already extracting' };
    }

    const client = accountManager.getClient('scanner');
    if (!client) {
        return { success: false, error: 'No active accounts' };
    }

    state.isExtracting = true;
    state.isPaused = false;
    const owners = new Map();
    let processed = 0;
    const total = endNum - startNum + 1;

    state.currentTask = { type: 'collection', progress: 0, total, found: 0 };

    try {
        for (let i = startNum; i <= endNum; i++) {
            // Check pause/stop
            while (state.isPaused) {
                await new Promise(r => setTimeout(r, 1000));
            }
            if (!state.isExtracting) break;

            // Check schedule
            if (!isWithinSchedule()) {
                console.log('⏰ Outside schedule, waiting...');
                await new Promise(r => setTimeout(r, 60000));
                continue;
            }

            const owner = await extractOwnerFromGift(client, collectionSlug, i);

            if (owner && owner.username && !owners.has(owner.username)) {
                owners.set(owner.username, {
                    ...owner,
                    source: 'collection',
                    sourceDetail: `${collectionSlug}-${i}`,
                    addedToContacts: false,
                    addedToGroup: false,
                    extractedAt: new Date()
                });
            }

            processed++;
            state.currentTask.progress = processed;
            state.currentTask.found = owners.size;

            if (progressCallback) {
                progressCallback({
                    processed,
                    total,
                    found: owners.size,
                    percent: Math.round((processed / total) * 100),
                    isPaused: state.isPaused
                });
            }

            await new Promise(r => setTimeout(r, CONFIG.EXTRACTION_DELAY_MS));
        }

        // Save to DB
        const db = getDB();
        if (db) {
            for (const owner of owners.values()) {
                await db.collection('extracted_contacts').updateOne(
                    { username: owner.username },
                    { $set: owner },
                    { upsert: true }
                );
            }
        }

        state.isExtracting = false;
        state.currentTask = null;

        return {
            success: true,
            extracted: owners.size,
            total: processed
        };

    } catch (error) {
        state.isExtracting = false;
        state.currentTask = null;
        return { success: false, error: error.message };
    }
}

// ==================== EXTRACT FROM CHAT/CHANNEL ====================
async function extractMembersFromChat(chatLink, progressCallback = null) {
    if (state.isExtracting) {
        return { success: false, error: 'Already extracting' };
    }

    const client = accountManager.getClient('scanner');
    if (!client) {
        return { success: false, error: 'No active accounts' };
    }

    state.isExtracting = true;
    state.isPaused = false;

    try {
        // Resolve chat entity
        let chatEntity;
        try {
            // Handle different link formats
            let username = chatLink;
            if (chatLink.includes('t.me/')) {
                username = chatLink.split('t.me/')[1].split('/')[0].replace('+', '');
            }

            if (chatLink.includes('+') || chatLink.includes('joinchat')) {
                // Private invite link
                const hash = chatLink.split('/').pop().replace('+', '');
                try {
                    const result = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
                    chatEntity = result.chats?.[0];
                } catch (e) {
                    if (e.message.includes('ALREADY')) {
                        // Already a member, resolve the chat
                        const dialogs = await client.getDialogs({ limit: 100 });
                        // Find by matching hash (simplified)
                    }
                }
            } else {
                chatEntity = await client.getEntity(username);
            }
        } catch (e) {
            state.isExtracting = false;
            return { success: false, error: `Could not resolve chat: ${e.message}` };
        }

        if (!chatEntity) {
            state.isExtracting = false;
            return { success: false, error: 'Could not find chat' };
        }

        console.log(`📋 Extracting members from: ${chatEntity.title || chatEntity.username}`);

        // Get participants
        const members = new Map();
        let offset = 0;
        const limit = 100;

        state.currentTask = { type: 'chat', progress: 0, total: 0, found: 0 };

        while (state.isExtracting) {
            while (state.isPaused) {
                await new Promise(r => setTimeout(r, 1000));
            }

            try {
                const participants = await client.invoke(
                    new Api.channels.GetParticipants({
                        channel: chatEntity,
                        filter: new Api.ChannelParticipantsRecent(),
                        offset,
                        limit,
                        hash: BigInt(0)
                    })
                );

                if (!participants.users || participants.users.length === 0) break;

                for (const user of participants.users) {
                    if (user.username && !user.bot && !members.has(user.username)) {
                        members.set(user.username, {
                            id: user.id?.toString(),
                            username: user.username,
                            firstName: user.firstName || user.username,
                            accessHash: user.accessHash?.toString(),
                            source: 'chat',
                            sourceDetail: chatEntity.title || chatEntity.username,
                            addedToContacts: false,
                            addedToGroup: false,
                            extractedAt: new Date()
                        });
                    }
                }

                offset += participants.users.length;
                state.currentTask.progress = offset;
                state.currentTask.found = members.size;

                if (progressCallback) {
                    progressCallback({
                        processed: offset,
                        total: participants.count || offset,
                        found: members.size,
                        percent: participants.count ? Math.round((offset / participants.count) * 100) : 0
                    });
                }

                if (participants.users.length < limit) break;

                await new Promise(r => setTimeout(r, CONFIG.CHAT_EXTRACTION_DELAY_MS));

            } catch (e) {
                console.log(`⚠️ Participant fetch error: ${e.message}`);
                break;
            }
        }

        // Save to DB
        const db = getDB();
        if (db) {
            for (const member of members.values()) {
                await db.collection('extracted_contacts').updateOne(
                    { username: member.username },
                    { $set: member },
                    { upsert: true }
                );
            }
        }

        state.isExtracting = false;
        state.currentTask = null;

        return {
            success: true,
            extracted: members.size,
            chatName: chatEntity.title || chatEntity.username
        };

    } catch (error) {
        state.isExtracting = false;
        state.currentTask = null;
        return { success: false, error: error.message };
    }
}

// ==================== IMPORT FROM CSV ====================
async function importFromCSV(csvContent) {
    try {
        // Parse CSV - expect username per line or comma-separated
        const lines = csvContent.split(/[\n,]/).map(l => l.trim()).filter(Boolean);
        const usernames = [];

        for (const line of lines) {
            // Clean username
            let username = line.replace('@', '').trim();
            if (username.length >= 3 && /^[a-zA-Z][a-zA-Z0-9_]{2,30}$/.test(username)) {
                usernames.push(username);
            }
        }

        if (usernames.length === 0) {
            return { success: false, error: 'No valid usernames found' };
        }

        // Save to DB
        const db = getDB();
        if (!db) return { success: false, error: 'DB not connected' };

        let imported = 0;
        for (const username of usernames) {
            await db.collection('extracted_contacts').updateOne(
                { username },
                {
                    $set: {
                        username,
                        firstName: username,
                        source: 'csv',
                        addedToContacts: false,
                        addedToGroup: false,
                        extractedAt: new Date()
                    }
                },
                { upsert: true }
            );
            imported++;
        }

        return { success: true, imported, total: usernames.length };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ==================== ADD TO CONTACTS ====================
async function addAllToContacts(progressCallback = null) {
    const db = getDB();
    if (!db) return { success: false, error: 'DB not connected' };

    const pending = await db.collection('extracted_contacts')
        .find({ addedToContacts: { $ne: true } })
        .toArray();

    if (pending.length === 0) {
        return { success: true, added: 0, message: 'No pending contacts' };
    }

    let added = 0;
    let failed = 0;

    for (const contact of pending) {
        while (state.isPaused) {
            await new Promise(r => setTimeout(r, 1000));
        }

        const account = getNextAccount();
        if (!account) {
            return { success: false, error: 'No available accounts (daily limit reached)' };
        }

        const client = accountManager.getClientByPhone(account.phone);
        if (!client) continue;

        try {
            const entity = await client.getEntity(contact.username);

            await client.invoke(new Api.contacts.AddContact({
                id: entity,
                firstName: contact.firstName || contact.username,
                lastName: 'G2G',
                phone: '',
                addPhonePrivacyException: false
            }));

            await db.collection('extracted_contacts').updateOne(
                { username: contact.username },
                { $set: { addedToContacts: true, addedAt: new Date(), addedBy: account.phone } }
            );

            recordAccountUsage(account.phone);
            await trackStat(account.phone, 'contact', true);
            added++;
            console.log(`✅ Added @${contact.username}`);

        } catch (e) {
            await trackStat(account.phone, 'contact', false);
            failed++;
            console.log(`⚠️ Failed @${contact.username}: ${e.message}`);
        }

        if (progressCallback && (added + failed) % 3 === 0) {
            progressCallback({ added, failed, total: pending.length });
        }

        await new Promise(r => setTimeout(r, 1500));
    }

    return { success: true, added, failed, total: pending.length };
}

// ==================== ADD TO GROUP ====================
async function addContactsToGroup(inviteLink, progressCallback = null) {
    if (state.isAddingToGroup) {
        return { success: false, error: 'Already adding' };
    }

    const db = getDB();
    if (!db) return { success: false, error: 'DB not connected' };

    state.isAddingToGroup = true;
    state.isPaused = false;
    addingStats = { added: 0, failed: 0, remaining: 0 };

    const pending = await db.collection('extracted_contacts')
        .find({ addedToContacts: true, addedToGroup: { $ne: true } })
        .toArray();

    if (pending.length === 0) {
        state.isAddingToGroup = false;
        return { success: true, added: 0, message: 'No contacts ready' };
    }

    addingStats.remaining = pending.length;
    const hash = inviteLink.split('/').pop().replace('+', '');
    let delay = CONFIG.ADD_DELAY_MS;

    for (const contact of pending) {
        while (state.isPaused) {
            await new Promise(r => setTimeout(r, 1000));
        }
        if (!state.isAddingToGroup) break;
        if (!isWithinSchedule()) {
            await new Promise(r => setTimeout(r, 60000));
            continue;
        }

        const account = getNextAccount();
        if (!account) {
            console.log('⚠️ All accounts reached daily limit');
            break;
        }

        const client = accountManager.getClientByPhone(account.phone);
        if (!client) continue;

        try {
            const user = await client.getEntity(contact.username).catch(() => null);
            if (!user) {
                addingStats.failed++;
                addingStats.remaining--;
                continue;
            }

            // Join group
            let chat;
            try {
                const result = await client.invoke(new Api.messages.ImportChatInvite({ hash }));
                chat = result.chats?.[0];
            } catch (e) { }

            if (chat) {
                await client.invoke(new Api.channels.InviteToChannel({
                    channel: chat,
                    users: [user]
                }));

                await db.collection('extracted_contacts').updateOne(
                    { username: contact.username },
                    { $set: { addedToGroup: true, addedToGroupAt: new Date(), addedToGroupBy: account.phone } }
                );

                recordAccountUsage(account.phone);
                await trackStat(account.phone, 'group', true);
                addingStats.added++;
            }

        } catch (e) {
            await trackStat(account.phone, 'group', false);

            if (e.message?.includes('FLOOD_WAIT')) {
                const wait = parseInt(e.message.match(/\d+/)?.[0] || 60) * 1000;
                console.log(`⏳ Flood wait: ${wait / 1000}s`);
                await new Promise(r => setTimeout(r, wait));
                delay = Math.min(delay * 1.5, 120000);
            }

            addingStats.failed++;
        }

        addingStats.remaining--;
        if (progressCallback) progressCallback(addingStats);
        await new Promise(r => setTimeout(r, delay));
    }

    state.isAddingToGroup = false;
    return { success: true, ...addingStats };
}

// ==================== UTILITY FUNCTIONS ====================
async function getExtractedList(limit = 50, skip = 0) {
    const db = getDB();
    if (!db) return { success: false, error: 'DB not connected' };

    const contacts = await db.collection('extracted_contacts')
        .find({}).sort({ extractedAt: -1 }).skip(skip).limit(limit).toArray();

    const total = await db.collection('extracted_contacts').countDocuments();
    const addedToContacts = await db.collection('extracted_contacts').countDocuments({ addedToContacts: true });
    const addedToGroup = await db.collection('extracted_contacts').countDocuments({ addedToGroup: true });

    return {
        success: true,
        contacts,
        stats: { total, addedToContacts, addedToGroup, pending: total - addedToGroup }
    };
}

async function clearExtractedList() {
    const db = getDB();
    if (!db) return { success: false };
    const result = await db.collection('extracted_contacts').deleteMany({});
    return { success: true, deleted: result.deletedCount };
}

async function deleteContact(username) {
    const db = getDB();
    if (!db) return { success: false };
    await db.collection('extracted_contacts').deleteOne({ username });
    return { success: true };
}

function getStatus() {
    return {
        ...state,
        addingStats,
        schedule: getSchedule()
    };
}

export {
    // Extraction
    extractOwnersFromCollection,
    extractMembersFromChat,
    importFromCSV,
    // Actions
    addAllToContacts,
    addContactsToGroup,
    // Control
    pause,
    resume,
    stop,
    // Scheduling
    setSchedule,
    getSchedule,
    // Stats
    getDailyStats,
    // Utility
    getExtractedList,
    clearExtractedList,
    deleteContact,
    getStatus
};
