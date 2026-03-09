/**
 * Ghost Service
 * Simulates human activity to warm up accounts
 */

import * as accountManager from '../../User/Application/account-manager.service.js';
import { settings } from '../../../database/panelDatabase.js';

let ghostInterval = null;
let isRunning = false;

// Configuration
const ACTIVITY_TYPES = ['read', 'scroll', 'typing'];
const BATCH_SIZE_MIN = 2;
const BATCH_SIZE_MAX = 5;

/**
 * Perform a random ghost action
 */
async function performGhostAction(client, phone) {
    try {
        const { Api } = await import('telegram');

        // Pick random action
        const action = ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];

        // Get dialogs (recent chats)
        const dialogs = await client.getDialogs({ limit: 5 });
        if (!dialogs || dialogs.length === 0) return;

        // Pick random chat
        const chat = dialogs[Math.floor(Math.random() * dialogs.length)];

        console.log(`👻 Ghost (${phone}): Performing '${action}' on ${chat.title || chat.id}`);

        switch (action) {
            case 'read':
                await client.markAsRead(chat.entity);
                break;

            case 'typing':
                await client.invoke(new Api.messages.SetTyping({
                    peer: chat.inputEntity,
                    action: new Api.SendMessageTypingAction()
                }));
                break;

            case 'scroll':
                // Just fetching messages simulates scrolling/viewing
                await client.getMessages(chat.entity, { limit: 10 });
                break;
        }

    } catch (error) {
        // Ignore errors, ghost should be silent
        // console.error(`Ghost error for ${phone}:`, error.message);
    }
}

/**
 * Run a ghost cycle
 */
async function runGhostCycle() {
    if (!isRunning) return;

    try {
        const accounts = accountManager.getAccountList().filter(a => a.status === 'active');
        if (accounts.length === 0) return;

        // Pick random batch of accounts
        const count = Math.floor(Math.random() * (BATCH_SIZE_MAX - BATCH_SIZE_MIN + 1)) + BATCH_SIZE_MIN;
        const selected = [];

        for (let i = 0; i < count; i++) {
            const acc = accounts[Math.floor(Math.random() * accounts.length)];
            if (!selected.includes(acc)) selected.push(acc);
        }

        // Run actions in parallel
        await Promise.all(selected.map(async (acc) => {
            const client = await accountManager.getClientByPhone(acc.phone);
            if (client) {
                await performGhostAction(client, acc.phone);
                // Random sleep to de-sync actions
                await new Promise(r => setTimeout(r, Math.random() * 5000));
            }
        }));

    } catch (error) {
        console.error('Ghost Cycle Error:', error);
    }
}

/**
 * Start Ghost Mode
 */
export function startGhostMode(intervalMinutes = 15) {
    if (ghostInterval) clearInterval(ghostInterval);

    isRunning = true;
    settings.set('ghost_mode_enabled', true);
    settings.set('ghost_mode_interval', intervalMinutes);

    console.log(`👻 Ghost Mode started (Interval: ${intervalMinutes}m)`);

    // Run immediately
    runGhostCycle();

    ghostInterval = setInterval(() => {
        runGhostCycle();
    }, intervalMinutes * 60 * 1000);
}

/**
 * Stop Ghost Mode
 */
export function stopGhostMode() {
    if (ghostInterval) clearInterval(ghostInterval);
    ghostInterval = null;
    isRunning = false;
    settings.set('ghost_mode_enabled', false);
    console.log('👻 Ghost Mode stopped');
}

/**
 * Initialize
 */
export function init() {
    const enabled = settings.get('ghost_mode_enabled', false);
    if (enabled) {
        const interval = settings.get('ghost_mode_interval', 15);
        startGhostMode(interval);
    }
}

/**
 * Get Status
 */
export function getStatus() {
    return {
        isEnabled: isRunning,
        interval: settings.get('ghost_mode_interval', 15)
    };
}

export default {
    startGhostMode,
    stopGhostMode,
    getStatus,
    init
};
