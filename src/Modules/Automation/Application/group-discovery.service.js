/**
 * Group Discovery & Management Service
 * Finds relevant groups, manages unique membership, and handles broadcasting.
 */

import { Api } from 'telegram';
import * as accountManager from '../../User/Application/account-manager.service.js';
import { getDB } from '../../../Shared/Infra/Database/mongo.repository.js';
import fetch from 'node-fetch';

/**
 * Searches for relevant groups using AI-suggested keywords
 * @param {string} category - e.g. 'Gifts', 'Usernames', 'TON'
 */
export async function discoverGroups(category = 'NFT Gifts') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { success: false, error: 'AI key missing' };

    // 1. Get Keywords from AI
    const prompt = `Suggest 10 English and Persian keywords/usernames for Telegram groups related to "${category}". 
    Format: JSON array of strings. Examples: ["fragment_market", "ton_gifts", "بازار_یوزرنیم"]`;

    try {
        const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const aiData = await aiRes.json();
        const keywords = JSON.parse(aiData.candidates[0].content.parts[0].text);

        // 2. Search Telegram using an active account
        const client = await accountManager.getClient('scanner');
        if (!client) return { success: false, error: 'No scanner account' };

        const discovered = [];
        const db = getDB();

        for (const word of keywords) {
            try {
                const results = await client.invoke(new Api.contacts.Search({
                    q: word,
                    limit: 5
                }));

                for (const chat of results.chats) {
                    if (chat.username && (chat._ === 'chat' || chat._ === 'channel' || chat.broadcast === false)) {
                        // Check if already in our DB
                        const exists = await db.collection('discovered_groups').findOne({ username: chat.username });
                        if (!exists) {
                            const groupData = {
                                id: chat.id.toString(),
                                title: chat.title,
                                username: chat.username,
                                participants: chat.participantsCount || 0,
                                category,
                                status: 'pending_approval',
                                discoveredAt: new Date()
                            };
                            await db.collection('discovered_groups').insertOne(groupData);
                            discovered.push(groupData);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Search failed for ${word}: ${e.message}`);
            }
        }

        return { success: true, found: discovered.length };
    } catch (e) {
        console.error('Discovery Error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Joins an approved group with exactly ONE unique account
 */
export async function joinGroupUniquely(groupId) {
    const db = getDB();
    const group = await db.collection('discovered_groups').findOne({ _id: groupId });
    if (!group) return { success: false, error: 'Group not found' };

    // Enforce: "Two accounts are not allowed to join one group"
    const alreadyOccupied = await db.collection('group_occupancy').findOne({ groupUsername: group.username });
    if (alreadyOccupied) return { success: false, error: 'Group already occupied by another account' };

    // Find an account that is NOT in this group and has capacity
    const accounts = accountManager.getAccountList().filter(a => a.connected);

    // Check which accounts are NOT already in too many groups (e.g. limit 10 groups per account for safety)
    let bestAccount = null;
    for (const acc of accounts) {
        const count = await db.collection('group_occupancy').countDocuments({ accountPhone: acc.phone });
        if (count < 10) {
            // Check if this account already in THIS group (extra safety)
            const inThis = await db.collection('group_occupancy').findOne({ accountPhone: acc.phone, groupUsername: group.username });
            if (!inThis) {
                bestAccount = acc;
                break;
            }
        }
    }

    if (!bestAccount) return { success: false, error: 'No account with capacity available' };

    const client = await accountManager.getClientByPhone(bestAccount.phone);
    try {
        await client.invoke(new Api.channels.JoinChannel({
            channel: group.username
        }));

        await db.collection('group_occupancy').insertOne({
            accountPhone: bestAccount.phone,
            groupUsername: group.username,
            groupId: group.id,
            joinedAt: new Date()
        });

        await db.collection('discovered_groups').updateOne({ _id: groupId }, { $set: { status: 'joined', occupiedBy: bestAccount.phone } });

        return { success: true, account: bestAccount.phone };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Broadcasts a message to all joined groups
 */
export async function broadcastToGroups(message) {
    const db = getDB();
    const joined = await db.collection('group_occupancy').find({}).toArray();

    let success = 0;
    let failed = 0;

    for (const membership of joined) {
        try {
            const client = await accountManager.getClientByPhone(membership.accountPhone);
            if (client) {
                await client.sendMessage(membership.groupUsername, { message });
                success++;
            } else {
                failed++;
            }
            // Small delay to avoid global flood
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.warn(`Broadcast failed for ${membership.groupUsername}: ${e.message}`);
            failed++;
        }
    }

    return { success, failed };
}
