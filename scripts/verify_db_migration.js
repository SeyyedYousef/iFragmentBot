
import { accounts } from '../src/database/panelDatabase.js';
import * as accountManager from '../src/services/accountManagerService.js';
import fs from 'fs';
import path from 'path';

async function verify() {
    console.log('🔍 Starting Verification...');

    // 1. Check initial DB state
    const initialCount = accounts.count();
    console.log(`📊 Initial DB Count: ${initialCount}`);

    // 2. Trigger Load/Migration
    console.log('🔄 Triggering loadAccounts...');
    await accountManager.loadAccounts();

    // 3. Check post-load DB state
    const finalCount = accounts.count();
    console.log(`📊 Final DB Count: ${finalCount}`);

    // 4. Check file status
    const sessionsPath = path.resolve('data/sessions.json');
    const migratedPath = sessionsPath + '.migrated';

    if (fs.existsSync(sessionsPath)) {
        console.log('⚠️ sessions.json still exists (Migration might have skipped if DB was not empty or file missing)');
    } else if (fs.existsSync(migratedPath)) {
        console.log('✅ sessions.json renamed to .migrated');
    } else {
        console.log('ℹ️ No sessions file found (Clean state or already migrated)');
    }

    // 5. Verify Data Integrity
    const allAccounts = accounts.getAll();
    if (allAccounts.length > 0) {
        console.log('✅ Accounts found in DB:');
        console.log(`   - First Account: ${allAccounts[0].phone} (Active: ${allAccounts[0].isActive})`);
        if (allAccounts[0].session && allAccounts[0].session.length > 20) {
            console.log('   - Session string present (encrypted)');
        } else {
            console.log('   ⚠️ Session string missing or empty');
        }
    }

    process.exit(0);
}

verify().catch(console.error);
